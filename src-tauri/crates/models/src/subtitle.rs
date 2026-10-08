use serde::{Deserialize, Serialize};

/// A single transcribed word with timing and confidence.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WhisperWord {
    pub word: String,
    pub start_ms: u64,
    pub end_ms: u64,
    pub probability: f32,
}

/// A transcribed subtitle segment containing one or more words.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleSegment {
    pub start_ms: u64,
    pub end_ms: u64,
    pub text: String,
    pub probability: Option<f32>,
    #[serde(default)]
    pub words: Vec<WhisperWord>,
}

/// Full transcription result for an audio/video source.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleResult {
    pub language: String,
    pub language_probability: f32,
    pub duration_ms: u64,
    pub segments: Vec<SubtitleSegment>,
}
