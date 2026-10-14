//! Render commands — Tauri IPC 桥接层，委托至 media::render

use models::{AutonomousRenderInput, ExportVideoInput, ExportVideoResult, TranscodeCropInput};
use media::render::preview::GeneratePreviewInput;

#[tauri::command]
pub async fn export_video(
    limiter: tauri::State<'_, media::utils::ResourceLimiter>,
    input: ExportVideoInput,
) -> Result<ExportVideoResult, String> {
    media::render::export_video(limiter, input).await
}

#[tauri::command]
pub async fn transcode_with_crop(
    app: tauri::AppHandle,
    limiter: tauri::State<'_, media::utils::ResourceLimiter>,
    input: TranscodeCropInput,
) -> Result<String, String> {
    media::render::transcode_with_crop(app, limiter, input).await
}

#[tauri::command]
pub async fn render_autonomous_cut(
    limiter: tauri::State<'_, media::utils::ResourceLimiter>,
    input: AutonomousRenderInput,
) -> Result<String, String> {
    media::render::render_autonomous_cut(limiter, input).await
}

#[tauri::command]
pub async fn generate_preview(input: GeneratePreviewInput) -> Result<String, String> {
    media::render::generate_preview(input).await
}

#[tauri::command]
pub fn export_jianying_draft(
    input: media::render::JianYingProjectExportInput,
) -> Result<media::render::JianYingDraftContent, String> {
    Ok(media::render::generate_draft_content(&input))
}
