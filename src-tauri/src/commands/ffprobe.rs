//! ffprobe commands — Tauri IPC 桥接层，委托至 media::video::ffprobe

use models::{FFmpegCheckResult, SystemDiagnosticsResult, VideoMetadataResult};

#[tauri::command]
pub async fn check_ffmpeg() -> Result<FFmpegCheckResult, String> {
    media::video::check_ffmpeg().await
}

#[tauri::command]
pub async fn system_diagnostics() -> Result<SystemDiagnosticsResult, String> {
    media::video::run_system_diagnostics().await
}

#[tauri::command]
pub async fn analyze_video(path: String) -> Result<VideoMetadataResult, String> {
    media::video::analyze_video(path).await
}

#[tauri::command]
pub async fn run_ffprobe(args: Vec<String>) -> Result<String, String> {
    media::video::run_ffprobe(args).await
}
