//! Video commands — Tauri IPC 桥接层，委托至 media::video

use models::CutSegment;
use media::video::MixAudioInput;

#[tauri::command]
pub async fn cut_video(
    source_path: String,
    output_path: String,
    segments: Vec<CutSegment>,
    use_hw_accel: Option<bool>,
) -> Result<String, String> {
    media::video::cut_video(source_path, output_path, segments, use_hw_accel).await
}

#[tauri::command]
pub async fn mix_audio(input: MixAudioInput) -> Result<String, String> {
    media::video::mix_audio(input).await
}

#[tauri::command]
pub async fn get_audio_duration(path: String) -> Result<f64, String> {
    media::video::get_audio_duration(path).await
}

#[tauri::command]
pub async fn extract_key_frames(
    path: String,
    max_frames: Option<u32>,
    scene_threshold: Option<f64>,
) -> Result<Vec<String>, String> {
    media::video::extract_keyframes(path, max_frames, scene_threshold).await
}

