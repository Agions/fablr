//! Video processing module — split from video_processor.rs.
//!
//! Public surface: [`VideoProcessor`] (processor), FFmpeg command builders
//! (ffmpeg_cmd), audio mixing (mix_audio) and duration probing
//! (audio_duration). Internal helpers: metadata, keyframes, thumbnail.
mod metadata;
mod keyframes;
mod thumbnail;
pub mod audio_duration;
pub mod ffmpeg_cmd;
pub mod ffprobe;
pub mod mix_audio;
pub mod processor;

pub use audio_duration::get_audio_duration;
pub use ffmpeg_cmd::cut_video;
pub use ffprobe::{analyze_video, check_ffmpeg, run_ffprobe, run_system_diagnostics};
pub use keyframes::extract_keyframes_impl;
pub use metadata::probe_metadata;
pub use mix_audio::{mix_audio, MixAudioInput};
pub use processor::VideoProcessor;
pub use thumbnail::generate_thumbnail_impl;

/// Async wrapper to extract keyframes via blocking task
pub async fn extract_keyframes(
    path: String,
    max_frames: Option<u32>,
    scene_threshold: Option<f64>,
) -> Result<Vec<String>, String> {
    tokio::task::spawn_blocking(move || {
        let processor = VideoProcessor::new();
        processor.extract_keyframes(
            &path,
            max_frames.unwrap_or(10),
            scene_threshold.unwrap_or(0.3),
        )
    })
    .await
    .map_err(|e| format!("关键帧提取任务失败: {e}"))?
}

