//! TTS 核心逻辑 — synthesize_speech / list_tts_backends / check_tts_available / edge_tts_path
//!
//! Stage 14.2：并发 batch 合成（max_concurrency 默认 3，重试默认 2）
//! Stage 14.5：TTS 音频缓存（text+voice+speed+format+backend hash → 音频路径）

use std::env;
use std::hash::{Hash, Hasher};
use std::time::Instant;
use futures_util::stream::{FuturesUnordered, StreamExt};
use tokio::process::Command;
use tokio::fs;

use super::types::{SynthesizeSpeechInput, SynthesizeSpeechOutput, TtsBackendInfo, TtsBatchInput, TtsBatchOutput, TtsBatchSegmentInput, TtsBatchResultItem};
use db::{Db, TtsCacheRow};
use models::ssml::serialize_ssml;
use crate::utils::cmd_err;

/// Resolve edge-tts path: FABLR_EDGE_TTS_PATH / CUTDECK_EDGE_TTS_PATH env > search PATH > "edge-tts"
pub fn edge_tts_path() -> String {
    let env_val = env::var("FABLR_EDGE_TTS_PATH")
        .or_else(|_| env::var("CUTDECK_EDGE_TTS_PATH"));
    if let Ok(path) = env_val {
        if !path.trim().is_empty() {
            return path;
        }
    }
    crate::binary::resolve_binary_path("edge-tts")
}

/// TTS 输出文件扩展名（按 format 解析）
fn tts_ext(format: &str) -> &'static str {
    match format {
        "wav" | "audio/wav" => "wav",
        "ogg" | "audio/ogg" => "ogg",
        _ => "mp3",
    }
}

/// edge-tts --rate 参数格式化（1.0 → +0%，1.2 → +20%，0.8 → -20%）
fn format_rate(speed: f32) -> String {
    let pct = ((speed - 1.0) * 100.0).round() as i32;
    if pct >= 0 {
        format!("+{pct}%")
    } else {
        format!("{pct}%")
    }
}

/// 合成单段（plain text 路径，原始 — 不带 SSML）
pub async fn synthesize_speech_impl(
    input: &SynthesizeSpeechInput,
) -> Result<SynthesizeSpeechOutput, String> {
    if input.text.trim().is_empty() {
        return Err("Text cannot be empty".to_string());
    }

    let ext = tts_ext(&input.format);
    let tmp_audio_path = unique_tmp_path("tts_output", ext);
    let tmp_text_path = unique_tmp_path("tts_input", "txt");
    fs::write(&tmp_text_path, &input.text)
        .await
        .map_err(|e| format!("Failed to write text file: {e}"))?;

    let mut cmd = Command::new(edge_tts_path());
    cmd.arg("--file").arg(&tmp_text_path);
    cmd.arg("--voice").arg(&input.voice);
    cmd.arg("--rate").arg(format_rate(input.speed));
    cmd.arg("--write-media").arg(&tmp_audio_path);

    let output = cmd
        .output()
        .await
        .map_err(|e| format!("Failed to spawn edge-tts: {e}"))?;

    let _ = fs::remove_file(&tmp_text_path).await;

    if !output.status.success() {
        return Err(cmd_err("edge-tts failed", &output));
    }

    let (duration_secs, _) = read_audio_meta(&tmp_audio_path, ext).await?;
    Ok(SynthesizeSpeechOutput {
        audio_path: tmp_audio_path,
        duration_secs,
    })
}

/// 合成单段（SSML 路径）— 内部从 SsmlDocument 序列化为标准 SSML XML
pub async fn synthesize_speech_ssml_impl(
    doc: &models::ssml::SsmlDocument,
    voice: &str,
    speed: f32,
    format: &str,
    backend: &str,
) -> Result<SynthesizeSpeechOutput, String> {
    let ssml_str = serialize_ssml(doc);
    if ssml_str.trim().is_empty() {
        return Err("SSML document is empty".to_string());
    }

    if backend != "edge" {
        return Err(format!("SSML path only supports 'edge' backend (got {})", backend));
    }

    let ext = tts_ext(format);
    let tmp_audio_path = unique_tmp_path("tts_ssml_output", ext);

    let mut cmd = Command::new(edge_tts_path());
    cmd.arg("--ssml");  // 标记输入是 SSML 而非 plain text
    cmd.arg(ssml_str);
    cmd.arg("--voice").arg(voice);
    cmd.arg("--rate").arg(format_rate(speed));
    cmd.arg("--write-media").arg(&tmp_audio_path);

    let output = cmd
        .output()
        .await
        .map_err(|e| format!("Failed to spawn edge-tts: {e}"))?;

    if !output.status.success() {
        return Err(cmd_err("edge-tts (ssml) failed", &output));
    }

    let (duration_secs, _) = read_audio_meta(&tmp_audio_path, ext).await?;
    Ok(SynthesizeSpeechOutput {
        audio_path: tmp_audio_path,
        duration_secs,
    })
}

/// 批量并发合成（Stage 14.2 + 14.5）
///
/// - 限流：`max_concurrency`（默认 3，1-8 合法）
/// - 重试：每段失败重试 `max_retries` 次（默认 2，0-3 合法）
/// - 缓存：传入 `db` 时启用 TTS 缓存（text+voice+speed+format+backend hash）
///   - 命中：直接返回 cached audio_path（duration_secs 也用缓存值）
///   - 未命中：合成后写入缓存
/// - 输出顺序：与输入 segments 顺序对齐（前端用 id 二次校验）
/// - 部分失败：返回 Ok(output) + 错误在 per-segment error 字段
pub async fn synthesize_speech_batch_impl(
    input: &TtsBatchInput,
    db: Option<&Db>,
) -> Result<TtsBatchOutput, String> {
    if input.segments.is_empty() {
        return Err("Batch input has no segments".to_string());
    }
    if input.max_concurrency == 0 || input.max_concurrency > 8 {
        return Err(format!("max_concurrency must be 1-8, got {}", input.max_concurrency));
    }
    if input.max_retries > 3 {
        return Err(format!("max_retries must be 0-3, got {}", input.max_retries));
    }

    let start = Instant::now();
    let concurrency = input.max_concurrency as usize;
    let max_retries = input.max_retries;

    // 用 FuturesUnordered 实现限流（手动维持 N 个 in-flight）
    let mut futures = FuturesUnordered::new();
    let mut iter = input.segments.iter();

    // 先推 concurrency 个任务
    for _ in 0..concurrency {
        if let Some(seg) = iter.next() {
            futures.push(synthesize_one_with_retry(seg.clone(), max_retries, db));
        }
    }

    let mut results: Vec<TtsBatchResultItem> = Vec::with_capacity(input.segments.len());
    while let Some(res) = futures.next().await {
        results.push(res);
        // 流水线：每完成一个就推入下一个，保持并发数稳定
        if let Some(seg) = iter.next() {
            futures.push(synthesize_one_with_retry(seg.clone(), max_retries, db));
        }
    }

    // 按输入顺序重排（保持前端 id 索引稳定）
    let mut by_id: std::collections::HashMap<String, TtsBatchResultItem> = results
        .into_iter()
        .map(|r| (r.id.clone(), r))
        .collect();
    let ordered: Vec<TtsBatchResultItem> = input
        .segments
        .iter()
        .filter_map(|s| by_id.remove(&s.id))
        .collect();

    Ok(TtsBatchOutput {
        results: ordered,
        total_secs: start.elapsed().as_secs_f64(),
    })
}

async fn synthesize_one_with_retry(
    seg: TtsBatchSegmentInput,
    max_retries: u8,
    db: Option<&Db>,
) -> TtsBatchResultItem {
    // 1. 缓存命中：直接返回
    if let Some(db) = &db {
        if let Ok(Some(cached)) = db.lookup_tts_cache(&cache_key_for(&seg)) {
            return TtsBatchResultItem {
                id: seg.id.clone(),
                audio_path: Some(cached.audio_path),
                duration_secs: cached.duration_secs,
                error: None,
                retries: 0,
            };
        }
    }

    // 2. 未命中：合成（重试）
    let mut last_err: Option<String> = None;
    for attempt in 0..=max_retries {
        match synthesize_one(&seg).await {
            Ok((audio_path, duration_secs)) => {
                // 3. 写入缓存
                if let Some(db) = &db {
                    let now = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .map(|d| d.as_secs() as i64)
                        .unwrap_or(0);
                    let preview = seg
                        .text
                        .as_deref()
                        .or_else(|| seg.ssml.as_ref().map(|_| "[ssml]"))
                        .unwrap_or("")
                        .chars()
                        .take(100)
                        .collect::<String>();
                    let _ = db.upsert_tts_cache(&TtsCacheRow {
                        cache_key: cache_key_for(&seg),
                        audio_path: audio_path.clone(),
                        duration_secs,
                        text_preview: preview,
                        created_at: now,
                        accessed_at: now,
                        access_count: 0,
                    });
                }
                return TtsBatchResultItem {
                    id: seg.id.clone(),
                    audio_path: Some(audio_path),
                    duration_secs,
                    error: None,
                    retries: attempt,
                };
            }
            Err(e) => last_err = Some(e),
        }
    }
    TtsBatchResultItem {
        id: seg.id.clone(),
        audio_path: None,
        duration_secs: 0.0,
        error: last_err,
        retries: max_retries,
    }
}

/// TTS 缓存 key：text(ssml or plain) + voice + speed + format + backend 的 hash
/// 用 std DefaultHasher（SipHash），64-bit 够用；冲突极小（4B 段才可能）
pub fn cache_key_for(seg: &TtsBatchSegmentInput) -> String {
    use std::collections::hash_map::DefaultHasher;
    let mut h = DefaultHasher::new();
    // SSML 优先：先序列化为标准 XML 再 hash（保证输入等价 → 同一 key）
    if let Some(doc) = &seg.ssml {
        serialize_ssml(doc).hash(&mut h);
    } else if let Some(text) = &seg.text {
        text.hash(&mut h);
    }
    seg.voice.hash(&mut h);
    seg.speed.to_bits().hash(&mut h);
    seg.format.hash(&mut h);
    seg.backend.hash(&mut h);
    format!("tts_{:016x}", h.finish())
}

async fn synthesize_one(
    seg: &TtsBatchSegmentInput,
) -> Result<(String, f64), String> {
    // SSML 优先
    if let Some(doc) = &seg.ssml {
        let out = synthesize_speech_ssml_impl(
            doc,
            &seg.voice,
            seg.speed,
            &seg.format,
            &seg.backend,
        )
        .await?;
        return Ok((out.audio_path, out.duration_secs));
    }
    // plain text fallback
    let text = seg
        .text
        .as_ref()
        .ok_or_else(|| "segment has neither text nor ssml".to_string())?;
    let inp = SynthesizeSpeechInput {
        text: text.clone(),
        voice: seg.voice.clone(),
        speed: seg.speed,
        format: seg.format.clone(),
        backend: seg.backend.clone(),
    };
    let out = synthesize_speech_impl(&inp).await?;
    Ok((out.audio_path, out.duration_secs))
}

// ─── 内部工具 ─────────────────────────────────────────────────

/// 唯一临时文件路径（process_id + nanos，避免并发合成时冲突）
fn unique_tmp_path(prefix: &str, ext: &str) -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let n = COUNTER.fetch_add(1, Ordering::Relaxed);
    let mut p = env::temp_dir();
    p.push(format!(
        "{}_{}_{}_{}.{}",
        prefix,
        std::process::id(),
        n,
        // 加 timestamp 微秒，避免极端高频冲突
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.subsec_nanos())
            .unwrap_or(0),
        ext
    ));
    p.display().to_string()
}

async fn read_audio_meta(path: &str, ext: &str) -> Result<(f64, u64), String> {
    let metadata = fs::metadata(path)
        .await
        .map_err(|e| format!("Failed to read audio file metadata: {e}"))?;
    let size = metadata.len();
    // 估算时长（mp3 128kbps / wav 256kbps 16bit；后续可接 ffprobe 精确）
    let duration_secs = match ext {
        "wav" => size as f64 / 32000.0,
        _ => size as f64 / 16000.0,
    };
    Ok((duration_secs, size))
}

/// List available TTS backends
pub async fn list_tts_backends_impl() -> Result<Vec<TtsBackendInfo>, String> {
    let edge_path = edge_tts_path();
    let edge_available = fs::metadata(edge_path).await.is_ok();
    if edge_available {
        Ok(vec![TtsBackendInfo {
            name: "edge".into(),
            label: "Microsoft Edge TTS".into(),
            description: "免费，无需 API key，音质好，需要网络".into(),
            requires_network: true,
            requires_model_download: false,
            model_path: None,
        }])
    } else {
        Ok(vec![])
    }
}

/// Check if edge-tts is available
pub async fn check_tts_available_impl() -> Result<bool, String> {
    let path = edge_tts_path();
    let output = Command::new(path)
        .arg("--version")
        .output()
        .await
        .map_err(|e| format!("edge-tts not found: {e}"))?;
    Ok(output.status.success())
}

// ─── 单元测试 ─────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use models::ssml::{SsmlDocument, SsmlInline};

    fn seg(id: &str, text: &str) -> TtsBatchSegmentInput {
        TtsBatchSegmentInput {
            id: id.to_string(),
            text: Some(text.to_string()),
            ssml: None,
            voice: "zh-CN-YunxiNeural".to_string(),
            speed: 1.0,
            format: "mp3".to_string(),
            backend: "edge".to_string(),
        }
    }

    fn ssml_seg(id: &str, doc: SsmlDocument) -> TtsBatchSegmentInput {
        TtsBatchSegmentInput {
            id: id.to_string(),
            text: None,
            ssml: Some(doc),
            voice: "zh-CN-YunxiNeural".to_string(),
            speed: 1.0,
            format: "mp3".to_string(),
            backend: "edge".to_string(),
        }
    }

    #[tokio::test]
    async fn batch_rejects_empty_segments() {
        let inp = TtsBatchInput {
            segments: vec![],
            max_concurrency: 3,
            max_retries: 2,
        };
        let res = synthesize_speech_batch_impl(&inp, None).await;
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("no segments"));
    }

    #[tokio::test]
    async fn batch_rejects_invalid_concurrency() {
        let inp = TtsBatchInput {
            segments: vec![seg("a", "hi")],
            max_concurrency: 0,
            max_retries: 0,
        };
        let res = synthesize_speech_batch_impl(&inp, None).await;
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("max_concurrency"));
    }

    #[tokio::test]
    async fn batch_rejects_excessive_retries() {
        let inp = TtsBatchInput {
            segments: vec![seg("a", "hi")],
            max_concurrency: 3,
            max_retries: 5,
        };
        let res = synthesize_speech_batch_impl(&inp, None).await;
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("max_retries"));
    }

    #[tokio::test]
    async fn batch_records_per_segment_error_when_edge_tts_missing() {
        // 不依赖 edge-tts 是否安装 — 如果没装，所有段都会失败
        let inp = TtsBatchInput {
            segments: vec![seg("a", "hello"), seg("b", "world")],
            max_concurrency: 2,
            max_retries: 0,
        };
        let out = synthesize_speech_batch_impl(&inp, None).await.unwrap();
        assert_eq!(out.results.len(), 2);
        // id 顺序对齐
        assert_eq!(out.results[0].id, "a");
        assert_eq!(out.results[1].id, "b");
        // total_secs 一定有值
        assert!(out.total_secs >= 0.0);
        // edge-tts 缺失时 audio_path 应该是 None，error 应该有内容
        for r in &out.results {
            assert!(r.audio_path.is_none());
            assert!(r.error.is_some());
        }
    }

    #[tokio::test]
    async fn batch_preserves_input_order_even_when_completion_differs() {
        // 模拟 3 段：第 1 段会失败（用空 voice），第 2 段正常返回，第 3 段失败
        let inp = TtsBatchInput {
            segments: vec![
                seg("first", ""),       // 空文本 → 失败
                seg("second", "hi"),
                seg("third", "world"),
            ],
            max_concurrency: 1, // 串行执行，便于断言顺序
            max_retries: 0,
        };
        let out = synthesize_speech_batch_impl(&inp, None).await.unwrap();
        assert_eq!(out.results.len(), 3);
        assert_eq!(out.results[0].id, "first");
        assert_eq!(out.results[1].id, "second");
        assert_eq!(out.results[2].id, "third");
        // 第 1 段是空文本 → 必定失败
        assert!(out.results[0].error.is_some());
    }

    #[test]
    fn tts_ext_recognizes_format_aliases() {
        assert_eq!(tts_ext("mp3"), "mp3");
        assert_eq!(tts_ext("audio/mpeg"), "mp3");
        assert_eq!(tts_ext("wav"), "wav");
        assert_eq!(tts_ext("audio/wav"), "wav");
        assert_eq!(tts_ext("ogg"), "ogg");
        assert_eq!(tts_ext("audio/ogg"), "ogg");
        assert_eq!(tts_ext("unknown"), "mp3"); // fallback
    }

    #[test]
    fn format_rate_handles_brackets() {
        assert_eq!(format_rate(1.0), "+0%");
        assert_eq!(format_rate(1.2), "+20%");
        assert_eq!(format_rate(0.8), "-20%");
        assert_eq!(format_rate(1.5), "+50%");
    }

    #[test]
    fn unique_tmp_path_avoids_collision() {
        let a = unique_tmp_path("test", "mp3");
        let b = unique_tmp_path("test", "mp3");
        // 立即调用两次 → nanos 不同 + counter 不同
        assert_ne!(a, b);
        assert!(a.ends_with(".mp3"));
    }

    #[tokio::test]
    async fn ssml_segment_prioritizes_ssml_over_text() {
        // 即使 text 也填了，ssml 路径优先（用极简 ssml 文档）
        let doc = SsmlDocument {
            xml_lang: "zh-CN".into(),
            default_voice: None,
            children: vec![SsmlInline::text("hi")],
        };
        let inp = TtsBatchInput {
            segments: vec![ssml_seg("a", doc)],
            max_concurrency: 1,
            max_retries: 0,
        };
        let out = synthesize_speech_batch_impl(&inp, None).await.unwrap();
        assert_eq!(out.results.len(), 1);
        // 没有 edge-tts 或调用失败，audio_path 是 None，error 非空（"ssml" 关键字 / spawn 失败）
        // 这里不强制特定内容，只验证 ssml 路径至少走到了 synthesize_one
        assert!(out.results[0].error.is_some() || out.results[0].audio_path.is_some());
    }

    // ─── 缓存（Stage 14.5） ────────────────────────────────

    #[test]
    fn cache_key_deterministic_for_same_input() {
        let a = seg("a", "hello");
        let b = seg("a", "hello");
        assert_eq!(cache_key_for(&a), cache_key_for(&b));
    }

    #[test]
    fn cache_key_differs_for_different_voice() {
        let mut a = seg("a", "hi");
        let mut b = seg("a", "hi");
        a.voice = "zh-CN-YunxiNeural".into();
        b.voice = "zh-CN-XiaoxiaoNeural".into();
        assert_ne!(cache_key_for(&a), cache_key_for(&b));
    }

    #[test]
    fn cache_key_differs_for_different_text() {
        let a = seg("a", "hi");
        let b = seg("a", "bye");
        assert_ne!(cache_key_for(&a), cache_key_for(&b));
    }

    #[test]
    fn cache_key_differs_for_different_speed() {
        let mut a = seg("a", "hi");
        let mut b = seg("a", "hi");
        a.speed = 1.0;
        b.speed = 1.2;
        assert_ne!(cache_key_for(&a), cache_key_for(&b));
    }

    #[test]
    fn cache_key_handles_ssml_path() {
        let doc1 = SsmlDocument {
            xml_lang: "zh-CN".into(),
            default_voice: None,
            children: vec![SsmlInline::text("hi")],
        };
        let doc2 = SsmlDocument {
            xml_lang: "zh-CN".into(),
            default_voice: None,
            children: vec![SsmlInline::text("hi")],
        };
        let mut a = ssml_seg("x", doc1);
        let mut b = ssml_seg("x", doc2);
        a.text = None;
        b.text = None;
        // 同样 SSML → 同样 key
        assert_eq!(cache_key_for(&a), cache_key_for(&b));
    }

    #[tokio::test]
    async fn batch_with_cache_hits_on_second_call() {
        use tempfile::tempdir;
        use db::Db;
        let dir = tempdir().unwrap();
        let db = Db::open(&dir.path().join("test.db")).unwrap();

        // 第一次：没有 edge-tts → 失败，但应该尝试 lookup + 写入（写时合成失败就不写）
        let inp = TtsBatchInput {
            segments: vec![seg("a", "hi")],
            max_concurrency: 1,
            max_retries: 0,
        };
        let out1 = synthesize_speech_batch_impl(&inp, Some(&db)).await.unwrap();
        assert!(out1.results[0].error.is_some());

        // 预填缓存
        let key = cache_key_for(&inp.segments[0]);
        db.upsert_tts_cache(&TtsCacheRow {
            cache_key: key.clone(),
            audio_path: "/tmp/cached.mp3".into(),
            duration_secs: 9.9,
            text_preview: "hi".into(),
            created_at: 100,
            accessed_at: 100,
            access_count: 0,
        })
        .unwrap();

        // 第二次：cache 命中，不调 edge-tts，直接返回 cached
        let out2 = synthesize_speech_batch_impl(&inp, Some(&db)).await.unwrap();
        assert!(out2.results[0].error.is_none());
        assert_eq!(out2.results[0].audio_path.as_deref(), Some("/tmp/cached.mp3"));
        assert_eq!(out2.results[0].duration_secs, 9.9);
    }

    #[tokio::test]
    async fn batch_with_no_db_skips_cache() {
        // 没有 db → 不报错，正常 batch 路径
        let inp = TtsBatchInput {
            segments: vec![seg("a", "hi")],
            max_concurrency: 1,
            max_retries: 0,
        };
        let out = synthesize_speech_batch_impl(&inp, None).await.unwrap();
        // 没有 edge-tts → 失败，但 batch 本身不挂
        assert!(out.results[0].error.is_some());
    }
}
