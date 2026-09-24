//! Platform 平台预设 IPC（Stage 15.2）
//!
//! 2 个 Tauri command：
//! - platform_list_presets    列出所有平台预设（数据驱动，UI 下拉用）
//! - platform_export         一键按平台预设导出（preset → ExportVideoInput → export_video）
//!
//! 后端 preset 数据在 `src-tauri/crates/models/src/platform.rs`，
//! 与前端 `src/core/models/platform.ts` 镜像。

use serde::{Deserialize, Serialize};

use crate::commands::render::export_video;
use models::platform::{list_platforms as list_platforms_impl, PlatformId, PlatformPreset};
use models::ExportVideoInput;

// ─── 公开 API ───────────────────────────────────────────

/// 列出所有平台预设（Stage 15.2 IPC）
#[tauri::command]
pub fn list_platform_presets() -> Vec<PlatformPreset> {
    list_platforms_impl()
}

/// 平台导出入参
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformExportInput {
    /// 平台 ID（douyin / kuaishou / ...）
    pub platform_id: PlatformId,
    /// 输入视频路径
    pub input_path: String,
    /// 输出视频路径（含文件名 + 后缀）
    pub output_path: String,
    /// 可选字幕路径（SRT/VTT/ASS）
    pub subtitle_path: Option<String>,
    /// 是否烧录字幕（None = 用 preset 的 burnSubtitleByDefault）
    pub burn_subtitles: Option<bool>,
}

/// 平台导出结果（与 ExportVideoResult 一致，方便前端统一处理）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformExportResult {
    pub output_path: String,
    pub duration: f64,
    pub file_size: u64,
    /// 实际使用的平台预设（前端可展示）
    pub platform: PlatformPreset,
}

/// 平台导出 IPC：preset → ExportVideoInput → export_video
#[tauri::command]
pub async fn platform_export(
    limiter: tauri::State<'_, media::utils::ResourceLimiter>,
    input: PlatformExportInput,
) -> Result<PlatformExportResult, String> {
    // 1. 查 preset
    let preset = models::platform::require_platform(input.platform_id);

    // 2. preset → ExportVideoInput 转换
    let burn = input
        .burn_subtitles
        .unwrap_or(preset.burn_subtitle_by_default);

    let export_input = ExportVideoInput {
        input_path: input.input_path,
        output_path: input.output_path.clone(),
        format: Some(format!("{:?}", preset.container).to_lowercase()),
        resolution: Some(format!("{}x{}", preset.width, preset.height)),
        frame_rate: Some(preset.fps),
        video_codec: Some(format!("{:?}", preset.video_codec).to_lowercase()),
        audio_codec: Some(format!("{:?}", preset.audio_codec).to_lowercase()),
        crf: None, // 用平台推荐码率（preset.video_bitrate），不指定 crf
        subtitle_enabled: if burn && input.subtitle_path.is_some() { Some(true) } else { Some(false) },
        subtitle_path: input.subtitle_path,
        burn_subtitles: Some(burn),
    };

    // 3. 调底层 export_video
    let result = export_video(limiter, export_input).await?;

    Ok(PlatformExportResult {
        output_path: result.output_path,
        duration: result.duration,
        file_size: result.file_size,
        platform: preset,
    })
}

// ─── 单元测试 ───────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_platform_presets_returns_8() {
        let presets = list_platform_presets();
        assert_eq!(presets.len(), 8);
    }

    #[test]
    fn platform_export_input_serializes_camel_case() {
        // 仅验证序列化字段名（不入参时跳过 platform_id）
        // 真正序列化测试由前端类型保证
        let json = r#"{"platformId":"douyin","inputPath":"/a.mp4","outputPath":"/b.mp4"}"#;
        let parsed: PlatformExportInput = serde_json::from_str(json).expect("parse");
        assert_eq!(parsed.input_path, "/a.mp4");
        assert_eq!(parsed.output_path, "/b.mp4");
        assert!(parsed.subtitle_path.is_none());
        assert!(parsed.burn_subtitles.is_none());
    }

    #[test]
    fn platform_export_input_optional_subtitle() {
        let json = r#"{"platformId":"bilibili","inputPath":"/a.mp4","outputPath":"/b.mp4","subtitlePath":"/s.srt","burnSubtitles":false}"#;
        let parsed: PlatformExportInput = serde_json::from_str(json).expect("parse");
        assert_eq!(parsed.subtitle_path.as_deref(), Some("/s.srt"));
        assert_eq!(parsed.burn_subtitles, Some(false));
    }

    #[test]
    fn platform_export_result_serializes_camel_case() {
        let result = PlatformExportResult {
            output_path: "/b.mp4".to_string(),
            duration: 60.0,
            file_size: 1024,
            platform: models::platform::require_platform(PlatformId::Douyin),
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("\"outputPath\":\"/b.mp4\""));
        assert!(json.contains("\"duration\":60.0"));
        assert!(json.contains("\"fileSize\":1024"));
        assert!(json.contains("\"platform\":"));
        assert!(json.contains("\"videoBitrate\":3500")); // 平台 preset 内部字段
    }
}
