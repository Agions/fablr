//! fablr-media — 音视频剪辑、转写、高光检测、TTS 与 LLM 引擎
//!
//! 核心子模块:
//! - `video`: FFmpeg 视频剪辑、音频混合与时长探测
//! - `render`: ASS 字幕引擎、字幕烧录、转码与自动剪辑
//! - `subtitle`: Whisper 语音转写与时间戳对齐
//! - `highlight`: 场景检测、声音能量与零交叉率高光识别
//! - `segment`: 智能视频切片与分类器
//! - `ai_engine`: TTS 语音合成与导演计划分析
//! - `llm`: 多 Provider LLM 编剧路由
//! - `understanding`: 语义理解与剧本故事线生成
//! - `utils`: 进程调度、音频 PCM 变换、限流器与崩溃恢复

pub mod binary;
pub mod video;
pub mod render;
pub mod subtitle;
pub mod highlight;
pub mod segment;
pub mod ai_engine;
pub mod llm;
pub mod understanding;
pub mod utils;

pub use binary::{hw_accel, HwAccel};
pub use video::{VideoProcessor, cut_video, mix_audio, MixAudioInput, get_audio_duration};
pub use subtitle::{check_whisper_available, resolve_python_binary, transcribe_audio};
pub use render::ass_engine;
pub use render::subtitle_burnin;
pub use render::ffmpeg_builder;
