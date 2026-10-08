//! domain — Fablr 领域模型与契约定义
//!
//! 与前端 `src/core/domain` 对齐的 Rust 类型定义。
//! 落地完整领域模型：Intent / Production / Storyline / Assembly / Platform / Job / SSML / DTO Types。
//!
//! 序列化约定：字段 snake_case + `serde(rename_all = "camelCase")`。

pub mod assembly;
pub mod intent;
pub mod job;
pub mod platform;
pub mod production;
pub mod ssml;
pub mod storyline;
pub mod subtitle;
pub mod time;
pub mod types;

pub use assembly::{create_assembly, is_assembly_renderable, AssemblyKit, AudioSegment, AudioTrack, AudioTrackType, SubtitleCue, SubtitleTrack, VideoClip, VideoTrack};
pub use intent::{default_duration_by_intent, intent_default_config, intensity_to_style, is_valid_intent, ContentIntent, IntentAudience, IntentConfig, IntentLanguage, ScriptStyle, DEFAULT_INTENT_CONFIG};
pub use job::{JobPhase, PhaseRunState, PipelineJob};
pub use platform::{get_platform, list_platforms, require_platform, AspectRatio, AudioCodec, Container, PlatformId, PlatformPreset, SubtitleStyle as PlatformSubtitleStyle, VideoCodec};
pub use production::{Production, ProductionSource, ProductionStatus};
pub use storyline::Storyline;
pub use subtitle::*;
pub use time::now_iso8601;
pub use types::*;
