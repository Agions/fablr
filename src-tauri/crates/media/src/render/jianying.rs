//! JianYing (CapCut) draft content & metadata generator
//!
//! Generates `draft_content.json` compatible with CapCut / JianYing desktop apps.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JianYingClipInput {
    pub id: String,
    pub source_path: String,
    pub start_time_us: i64,
    pub duration_us: i64,
    pub source_in_us: i64,
    pub source_out_us: i64,
    pub speed: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JianYingAudioClipInput {
    pub id: String,
    pub source_path: String,
    pub start_time_us: i64,
    pub duration_us: i64,
    pub volume: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JianYingSubtitleItemInput {
    pub id: String,
    pub text: String,
    pub start_time_us: i64,
    pub duration_us: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JianYingProjectExportInput {
    pub project_name: String,
    pub aspect_ratio: String, // "9:16", "16:9", "1:1"
    pub fps: Option<i32>,
    pub video_clips: Vec<JianYingClipInput>,
    pub voiceover_clips: Vec<JianYingAudioClipInput>,
    pub bgm_clips: Option<Vec<JianYingAudioClipInput>>,
    pub subtitles: Option<Vec<JianYingSubtitleItemInput>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JianYingCanvasConfig {
    pub ratio: String,
    pub width: i32,
    pub height: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JianYingMaterialVideo {
    pub id: String,
    pub path: String,
    pub duration: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JianYingMaterialAudio {
    pub id: String,
    pub path: String,
    pub duration: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JianYingMaterialText {
    pub id: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JianYingMaterialSpeed {
    pub id: String,
    pub speed: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JianYingMaterials {
    pub videos: Vec<JianYingMaterialVideo>,
    pub audios: Vec<JianYingMaterialAudio>,
    pub texts: Vec<JianYingMaterialText>,
    pub speeds: Vec<JianYingMaterialSpeed>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JianYingTimeRange {
    pub start: i64,
    pub duration: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JianYingTrackSegment {
    pub id: String,
    pub material_id: String,
    pub target_timerange: JianYingTimeRange,
    pub source_timerange: Option<JianYingTimeRange>,
    pub speed_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JianYingTrack {
    pub id: String,
    pub r#type: String, // "video", "audio", "text"
    pub segments: Vec<JianYingTrackSegment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JianYingDraftContent {
    pub id: String,
    pub canvas_config: JianYingCanvasConfig,
    pub duration: i64,
    pub fps: i32,
    pub materials: JianYingMaterials,
    pub tracks: Vec<JianYingTrack>,
    pub version: i32,
}

/// Generates standard draft_content.json struct from high-level input
pub fn generate_draft_content(input: &JianYingProjectExportInput) -> JianYingDraftContent {
    let fps = input.fps.unwrap_or(30);
    let (width, height) = match input.aspect_ratio.as_str() {
        "9:16" => (1080, 1920),
        "1:1" => (1080, 1080),
        _ => (1920, 1080),
    };

    let mut total_duration_us: i64 = 0;
    for c in &input.video_clips {
        let end = c.start_time_us + c.duration_us;
        if end > total_duration_us {
            total_duration_us = end;
        }
    }
    for a in &input.voiceover_clips {
        let end = a.start_time_us + a.duration_us;
        if end > total_duration_us {
            total_duration_us = end;
        }
    }
    if let Some(bgms) = &input.bgm_clips {
        for b in bgms {
            let end = b.start_time_us + b.duration_us;
            if end > total_duration_us {
                total_duration_us = end;
            }
        }
    }
    if let Some(subs) = &input.subtitles {
        for s in subs {
            let end = s.start_time_us + s.duration_us;
            if end > total_duration_us {
                total_duration_us = end;
            }
        }
    }

    let draft_id = format!("draft_{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis());

    // 1. Materials
    let material_videos: Vec<JianYingMaterialVideo> = input.video_clips.iter().map(|c| {
        JianYingMaterialVideo {
            id: format!("mat_v_{}", c.id),
            path: c.source_path.clone(),
            duration: c.duration_us,
        }
    }).collect();

    let mut material_audios: Vec<JianYingMaterialAudio> = input.voiceover_clips.iter().map(|a| {
        JianYingMaterialAudio {
            id: format!("mat_a_{}", a.id),
            path: a.source_path.clone(),
            duration: a.duration_us,
        }
    }).collect();

    if let Some(bgms) = &input.bgm_clips {
        for b in bgms {
            material_audios.push(JianYingMaterialAudio {
                id: format!("mat_bgm_{}", b.id),
                path: b.source_path.clone(),
                duration: b.duration_us,
            });
        }
    }

    let material_texts: Vec<JianYingMaterialText> = input.subtitles.as_ref()
        .map(|subs| {
            subs.iter().map(|s| JianYingMaterialText {
                id: format!("mat_t_{}", s.id),
                content: s.text.clone(),
            }).collect()
        })
        .unwrap_or_default();

    let mut material_speeds: Vec<JianYingMaterialSpeed> = Vec::new();
    for c in &input.video_clips {
        if let Some(sp) = c.speed {
            if (sp - 1.0).abs() > 0.001 {
                material_speeds.push(JianYingMaterialSpeed {
                    id: format!("speed_{}", c.id),
                    speed: sp,
                });
            }
        }
    }

    // 2. Tracks
    let mut tracks: Vec<JianYingTrack> = Vec::new();

    // 视频主轨
    let video_segments: Vec<JianYingTrackSegment> = input.video_clips.iter().map(|c| {
        let speed_id = if c.speed.map(|s| (s - 1.0).abs() > 0.001).unwrap_or(false) {
            Some(format!("speed_{}", c.id))
        } else {
            None
        };

        JianYingTrackSegment {
            id: format!("seg_v_{}", c.id),
            material_id: format!("mat_v_{}", c.id),
            target_timerange: JianYingTimeRange {
                start: c.start_time_us,
                duration: c.duration_us,
            },
            source_timerange: Some(JianYingTimeRange {
                start: c.source_in_us,
                duration: c.source_out_us - c.source_in_us,
            }),
            speed_id,
        }
    }).collect();

    tracks.push(JianYingTrack {
        id: "track_main_video".to_string(),
        r#type: "video".to_string(),
        segments: video_segments,
    });

    // 配音轨
    let voice_segments: Vec<JianYingTrackSegment> = input.voiceover_clips.iter().map(|a| {
        JianYingTrackSegment {
            id: format!("seg_a_{}", a.id),
            material_id: format!("mat_a_{}", a.id),
            target_timerange: JianYingTimeRange {
                start: a.start_time_us,
                duration: a.duration_us,
            },
            source_timerange: Some(JianYingTimeRange {
                start: 0,
                duration: a.duration_us,
            }),
            speed_id: None,
        }
    }).collect();

    tracks.push(JianYingTrack {
        id: "track_voiceover".to_string(),
        r#type: "audio".to_string(),
        segments: voice_segments,
    });

    // BGM 轨
    if let Some(bgms) = &input.bgm_clips {
        if !bgms.is_empty() {
            let bgm_segments: Vec<JianYingTrackSegment> = bgms.iter().map(|b| {
                JianYingTrackSegment {
                    id: format!("seg_bgm_{}", b.id),
                    material_id: format!("mat_bgm_{}", b.id),
                    target_timerange: JianYingTimeRange {
                        start: b.start_time_us,
                        duration: b.duration_us,
                    },
                    source_timerange: Some(JianYingTimeRange {
                        start: 0,
                        duration: b.duration_us,
                    }),
                    speed_id: None,
                }
            }).collect();

            tracks.push(JianYingTrack {
                id: "track_bgm".to_string(),
                r#type: "audio".to_string(),
                segments: bgm_segments,
            });
        }
    }

    // 字幕文本轨
    if let Some(subs) = &input.subtitles {
        if !subs.is_empty() {
            let text_segments: Vec<JianYingTrackSegment> = subs.iter().map(|s| {
                JianYingTrackSegment {
                    id: format!("seg_t_{}", s.id),
                    material_id: format!("mat_t_{}", s.id),
                    target_timerange: JianYingTimeRange {
                        start: s.start_time_us,
                        duration: s.duration_us,
                    },
                    source_timerange: None,
                    speed_id: None,
                }
            }).collect();

            tracks.push(JianYingTrack {
                id: "track_subtitles".to_string(),
                r#type: "text".to_string(),
                segments: text_segments,
            });
        }
    }

    JianYingDraftContent {
        id: draft_id,
        canvas_config: JianYingCanvasConfig {
            ratio: input.aspect_ratio.clone(),
            width,
            height,
        },
        duration: total_duration_us,
        fps,
        materials: JianYingMaterials {
            videos: material_videos,
            audios: material_audios,
            texts: material_texts,
            speeds: material_speeds,
        },
        tracks,
        version: 2,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_draft_content_basic() {
        let input = JianYingProjectExportInput {
            project_name: "测试短剧".to_string(),
            aspect_ratio: "9:16".to_string(),
            fps: Some(30),
            video_clips: vec![JianYingClipInput {
                id: "v1".to_string(),
                source_path: "/path/to/video.mp4".to_string(),
                start_time_us: 0,
                duration_us: 5_000_000,
                source_in_us: 0,
                source_out_us: 5_000_000,
                speed: Some(1.0),
            }],
            voiceover_clips: vec![JianYingAudioClipInput {
                id: "a1".to_string(),
                source_path: "/path/to/voice.mp3".to_string(),
                start_time_us: 0,
                duration_us: 4_000_000,
                volume: Some(1.0),
            }],
            bgm_clips: None,
            subtitles: Some(vec![JianYingSubtitleItemInput {
                id: "s1".to_string(),
                text: "前3秒抓人黄金Hook".to_string(),
                start_time_us: 0,
                duration_us: 4_000_000,
            }]),
        };

        let draft = generate_draft_content(&input);
        assert_eq!(draft.fps, 30);
        assert_eq!(draft.canvas_config.width, 1080);
        assert_eq!(draft.canvas_config.height, 1920);
        assert_eq!(draft.materials.videos.len(), 1);
        assert_eq!(draft.materials.audios.len(), 1);
        assert_eq!(draft.materials.texts.len(), 1);
        assert_eq!(draft.tracks.len(), 3); // video, voiceover, subtitles
    }
}
