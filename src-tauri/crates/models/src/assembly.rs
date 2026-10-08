//! Assembly — L2 多轨装配（与前端 `src/core/domain/assembly.ts` 对齐）
//!
//! AssemblyKit 是 L2 阶段的"装配图"：视频轨 + 配音轨 + 字幕轨 + 封面 + BGM。
//! 替代 v2 仅记输出路径的 RenderResult，支持用户编辑后再交给 FFmpeg 出片。

use serde::{Deserialize, Serialize};
use super::platform::SubtitleStyle;

// ─── 音轨 ──────────────────────────────────────────────────────

/// 音轨类型
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AudioTrackType {
    /// 旁白（解说主轨）
    Narration,
    /// 角色对话
    Dialogue,
    /// 音效
    Sfx,
    /// 背景音乐
    Bgm,
}

/// 段落级音轨段位（时间对齐）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioSegment {
    pub id: String,
    /// 起始时间（秒，相对最终成片时间轴）
    pub start_secs: f64,
    /// 结束时间（秒）
    pub end_secs: f64,
    /// 配音文本（旁白 / 对话）
    pub text: String,
    /// SSML 标记（情绪、停顿、韵律）
    pub ssml: Option<String>,
    /// 实际音频文件路径（TTS 合成后回填）
    pub audio_path: Option<String>,
    /// 角色 ID（旁白/角色A/角色B，无角色对话时为 null）
    pub role_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioTrack {
    pub id: String,
    #[serde(rename = "type")]
    pub track_type: AudioTrackType,
    /// 音色 ID（对应 VoiceInfo.id）
    pub voice_id: String,
    /// 音量 0.0-1.0（最终混音权重）
    pub volume: f32,
    /// 段位（按 start_secs 升序）
    pub segments: Vec<AudioSegment>,
}

// ─── 视频轨 ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoClip {
    pub id: String,
    /// 源视频路径（裁剪或重组时为原视频，全片时为 source.videoPath）
    pub source_path: String,
    /// 裁剪入点（秒，相对源视频）
    pub source_in_secs: f64,
    /// 裁剪出点（秒，相对源视频）
    pub source_out_secs: f64,
    /// 在成片中的起始时间（秒）
    pub output_start_secs: f64,
    /// 字幕烧录标记（true = 字幕烧入视频帧）
    pub burn_subtitle: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoTrack {
    pub id: String,
    /// 单轨 = 全片使用，array length > 1 = 素材重组
    pub clips: Vec<VideoClip>,
}

// ─── 字幕轨 ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleCue {
    pub id: String,
    pub start_secs: f64,
    pub end_secs: f64,
    pub text: String,
    /// 样式 ID（关联 SubtitleStyle）
    pub style_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleTrack {
    /// 字幕轨（一般 1 条；多语言时多条）
    pub cues: Vec<SubtitleCue>,
    /// 样式表（v3.1 引入 ASS/SSA 样式引擎）
    pub styles: Vec<SubtitleStyle>,
}

// ─── 根聚合 ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssemblyKit {
    pub id: String,
    /// 关联的 Production ID
    pub production_id: String,
    /// 视频轨（单条 = 全片，>1 = 素材重组）
    pub video_tracks: Vec<VideoTrack>,
    /// 音轨（旁白 + 角色 + BGM + 音效）
    pub audio_tracks: Vec<AudioTrack>,
    pub subtitle_track: SubtitleTrack,
    /// 封面图片路径（无封面 = 用视频首帧）
    pub cover_path: Option<String>,
    /// 目标平台预设 ID（决定编码参数 + 字幕烧录策略）
    pub platform_id: String,
    /// 总时长（秒，由音频时长推导）
    pub total_duration_secs: f64,
    pub created_at: String,
    pub updated_at: String,
}

// ─── 工厂与纯函数 ──────────────────────────────────────────

/// 创建空装配图（仅 1 视频轨 + 1 旁白轨 + 1 字幕轨）
pub fn create_assembly(production_id: &str, platform_id: &str) -> AssemblyKit {
    let now = crate::time::now_iso8601();
    let id_suffix = now_ts();
    AssemblyKit {
        id: format!("assembly_{}", id_suffix),
        production_id: production_id.to_string(),
        video_tracks: vec![VideoTrack {
            id: format!("video_{}", id_suffix),
            clips: Vec::new(),
        }],
        audio_tracks: vec![AudioTrack {
            id: format!("narration_{}", id_suffix),
            track_type: AudioTrackType::Narration,
            voice_id: String::new(),
            volume: 1.0,
            segments: Vec::new(),
        }],
        subtitle_track: SubtitleTrack {
            cues: Vec::new(),
            styles: vec![SubtitleStyle {
                id: "default".to_string(),
                font_family: "Source Han Sans".to_string(),
                font_size: 22,
                color: "#FFFFFF".to_string(),
                stroke_color: "#000000".to_string(),
                stroke_width: 2,
                position: "bottom".to_string(),
                opacity: 1.0,
            }],
        },
        cover_path: None,
        platform_id: platform_id.to_string(),
        total_duration_secs: 0.0,
        created_at: now.clone(),
        updated_at: now,
    }
}

/// 校验：装配图是否可渲染（至少 1 视频轨 + 1 配音轨 + 总时长 > 0）
pub fn is_assembly_renderable(kit: &AssemblyKit) -> bool {
    let has_video = kit.video_tracks.iter().any(|t| !t.clips.is_empty());
    let has_narration = kit.audio_tracks.iter().any(|t| {
        t.track_type == AudioTrackType::Narration && !t.segments.is_empty()
    });
    has_video && has_narration && kit.total_duration_secs > 0.0
}

// ─── 内部工具 ──────────────────────────────────────────────

fn now_ts() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}
