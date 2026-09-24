//! Audio transcription via faster-whisper — split from subtitle.rs

use crate::binary::resolve_binary_path;
use crate::subtitle::types::{SubtitleResult, TranscribeProgress};
use crate::utils::cmd_err;
use std::path::Path;
use std::process::Command;
use tauri::Emitter;

use super::whisper::whisper_python_code;

/// Extract audio from video file to a temporary WAV (16kHz mono) for whisper
pub fn extract_audio_to_wav(video_path: &str, output_wav: &Path) -> Result<(), String> {
    let ffmpeg = resolve_binary_path("ffmpeg");
    if ffmpeg.is_empty() {
        return Err("无法定位 ffmpeg，请设置 FABLR_FFMPEG_PATH 环境变量".to_string());
    }
    let output = Command::new(&ffmpeg)
        .args([
            "-y", "-i", video_path, "-vn", "-acodec", "pcm_s16le",
            "-ar", "16000", "-ac", "1", "-f", "wav",
            output_wav.to_str().unwrap_or(""),
        ])
        .output()
        .map_err(|e| format!("运行 ffmpeg 提取音频失败: {}", e))?;

    if !output.status.success() {
        return Err(cmd_err("ffmpeg 音频提取失败", &output));
    }
    Ok(())
}

/// Transcribe audio using faster-whisper
pub async fn transcribe_audio(
    app: tauri::AppHandle,
    audio_path: String,
    model_size: Option<String>,
    language: Option<String>,
) -> Result<SubtitleResult, String> {
    let model = model_size.unwrap_or_else(|| "base".into());
    let lang = language.unwrap_or_else(|| "auto".into());

    log::info!("[Fablr] Starting transcription: path={}, model={}, lang={}", audio_path, model, lang);

    let _ = app.emit("whisper-progress", TranscribeProgress {
        stage: "正在准备音频...".to_string(),
        progress: 0.05,
        current_segment: None,
        total_segments: None,
    });

    let input_ext = std::path::Path::new(&audio_path)
        .extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();

    let audio_exts = ["wav", "mp3", "m4a", "flac", "ogg", "aac", "wma"];
    let temp_wav: Option<std::path::PathBuf> =
        if !audio_exts.contains(&input_ext.as_str()) {
            let wav_path = std::env::temp_dir().join(format!("fablr_whisper_{}.wav", std::process::id()));
            extract_audio_to_wav(&audio_path, &wav_path).map_err(|e| format!("音频提取失败: {}", e))?;
            Some(wav_path)
        } else {
            None
        };

    let final_audio_path = temp_wav
        .as_ref()
        .map(|p| p.display().to_string())
        .unwrap_or_else(|| audio_path.clone());

    let _ = app.emit("whisper-progress", TranscribeProgress {
        stage: "正在加载 Whisper 模型...".to_string(),
        progress: 0.15,
        current_segment: None,
        total_segments: None,
    });

    let lang_arg = if lang == "auto" { "None".to_string() } else { format!("'{}'", lang) };
    let python_code = whisper_python_code(&model, &final_audio_path, &lang_arg);

    let _ = app.emit("whisper-progress", TranscribeProgress {
        stage: format!("Whisper {} 模型推理中... (这可能需要几分钟)", model),
        progress: 0.25,
        current_segment: None,
        total_segments: None,
    });

    let output = tokio::task::spawn_blocking(move || {
        std::process::Command::new("python3").arg("-c").arg(&python_code).output()
    })
    .await
    .map_err(|e| format!("执行 faster-whisper 失败: {}", e))?
    .map_err(|e| format!("执行 faster-whisper 失败: {}", e))?;

    if let Some(ref wav) = temp_wav {
        let _ = std::fs::remove_file(wav);
    }

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        log::error!("[Fablr] Whisper transcription failed: {}", stderr);
        if stderr.contains("No module named") || stderr.contains("ModuleNotFoundError") {
            return Err("faster-whisper 未安装。请运行: pip install faster-whisper".to_string());
        }
        if stderr.contains("model not found") || stderr.contains("download") {
            return Err(format!("Whisper {} 模型未找到，faster-whisper 会自动下载。错误: {}", model, stderr));
        }
        return Err(format!("Whisper 转录失败: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let result: SubtitleResult =
        serde_json::from_str(&stdout).map_err(|e| format!("解析 Whisper 输出失败: {}", e))?;

    let seg_count = result.segments.len();
    log::info!(
        "[Fablr] Transcription complete: {} segments, lang={} ({:.2})",
        seg_count,
        result.language,
        result.language_probability
    );

    let _ = app.emit("whisper-progress", TranscribeProgress {
        stage: "转录完成".to_string(),
        progress: 1.0,
        current_segment: Some(seg_count as u32),
        total_segments: Some(seg_count as u32),
    });

    Ok(result)
}
