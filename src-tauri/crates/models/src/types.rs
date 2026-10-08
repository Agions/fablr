//! Shared DTO (data-transfer-object) types for the Tauri command handlers.
//!
//! These structs form the cross-command JSON contract between the frontend
//! (`src/core/tauri`) and the backend command handlers. Field names are
//! serialized as camelCase.

use serde::{Deserialize, Serialize};

// ─── AI Director ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectorSceneInput {
    pub id: String,
    pub start_time: f64,
    pub end_time: f64,
    #[allow(dead_code)]
    pub r#type: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectorSegmentInput {
    pub id: String,
    pub content: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectorPlanInput {
    pub mode: String,
    pub target_duration: f64,
    pub auto_original_overlay: bool,
    pub scenes: Vec<DirectorSceneInput>,
    pub segments: Vec<DirectorSegmentInput>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectorPlanOutput {
    pub pacing_factor: f64,
    pub beat_count: u32,
    pub preferred_transition: String,
    pub confidence: f64,
}

// ─── Video Analysis ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FFmpegCheckResult {
    pub installed: bool,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemDiagnosticsResult {
    pub os: String,
    pub arch: String,
    pub ffmpeg_installed: bool,
    pub ffmpeg_path: Option<String>,
    pub ffmpeg_version: Option<String>,
    pub ffprobe_installed: bool,
    pub ffprobe_path: Option<String>,
    pub hw_accel: String,
    pub hw_accel_name: String,
    pub python_installed: bool,
    pub python_path: Option<String>,
    pub whisper_available: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoMetadataResult {
    pub duration: f64,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    pub codec: String,
    pub bitrate: u64,
}

// ─── Autonomous Render ────────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutonomousRenderSegment {
    pub start: f64,
    pub end: f64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutonomousSubtitle {
    pub start: f64,
    pub end: f64,
    pub text: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutonomousOverlayMarker {
    pub start: f64,
    pub end: f64,
    pub label: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutonomousRenderInput {
    pub input_path: String,
    pub output_path: String,
    pub start_time: Option<f64>,
    pub end_time: Option<f64>,
    pub transition: Option<String>,
    pub transition_duration: Option<f64>,
    pub burn_subtitles: Option<bool>,
    pub subtitles: Option<Vec<AutonomousSubtitle>>,
    pub apply_overlay_markers: Option<bool>,
    pub overlay_mix_mode: Option<String>,
    pub overlay_opacity: Option<f64>,
    pub overlay_markers: Option<Vec<AutonomousOverlayMarker>>,
    pub segments: Option<Vec<AutonomousRenderSegment>>,
}

// ─── Transcode ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportVideoInput {
    pub input_path: String,
    pub output_path: String,
    pub format: Option<String>,
    pub resolution: Option<String>,
    pub frame_rate: Option<u32>,
    pub video_codec: Option<String>,
    pub audio_codec: Option<String>,
    pub crf: Option<u32>,
    pub subtitle_enabled: Option<bool>,
    pub subtitle_path: Option<String>,
    pub burn_subtitles: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscodeCropInput {
    pub input_path: String,
    pub output_path: String,
    pub aspect: String, // "9:16" | "1:1" | "16:9"
    pub start_time: Option<f64>,
    pub end_time: Option<f64>,
    pub quality: Option<String>, // "low" | "medium" | "high"
}

// ─── Highlights / Smart Segments ─────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectHighlightsInput {
    pub video_path: String,
    pub threshold: Option<f64>,
    pub min_duration_ms: Option<u64>,
    pub top_n: Option<usize>,
    pub window_ms: Option<u64>,
    pub detect_scene: Option<bool>,
    pub scene_threshold: Option<f64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectSmartSegmentsInput {
    pub video_path: String,
    pub min_duration_ms: Option<u64>,
    pub max_duration_ms: Option<u64>,
    pub scene_threshold: Option<f32>,
    pub silence_threshold_db: Option<f32>,
    pub detect_dialogue: Option<bool>,
    pub detect_transitions: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportVideoResult {
    pub output_path: String,
    pub duration: f64,
    pub file_size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CutSegment {
    pub start: f64,
    pub end: f64,
    #[serde(default)]
    pub source_start_ms: Option<f64>,
    #[serde(default)]
    pub source_end_ms: Option<f64>,
}
