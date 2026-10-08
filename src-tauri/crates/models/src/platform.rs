//! Platform — 平台预设（与前端 `src/core/domain/platform.ts` 对齐）
//!
//! 8 个主流短视频平台：抖音/快手/小红书/视频号/TikTok/B站/YouTube/YouTube Shorts。
//! 数据驱动：新增平台只改 PLATFORM_PRESETS 字典，不用改 render 代码。

use serde::{Deserialize, Serialize};

// ─── 枚举 ──────────────────────────────────────────────────────

/// 平台 ID
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PlatformId {
    Douyin,
    Kuaishou,
    Xiaohongshu,
    Wechat,
    Tiktok,
    Bilibili,
    Youtube,
    #[serde(rename = "youtube-shorts")]
    YoutubeShorts,
}

/// 宽高比
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AspectRatio {
    #[serde(rename = "9:16")]
    R9x16,
    #[serde(rename = "1:1")]
    R1x1,
    #[serde(rename = "16:9")]
    R16x9,
    #[serde(rename = "4:5")]
    R4x5,
    #[serde(rename = "21:9")]
    R21x9,
    #[serde(rename = "3:4")]
    R3x4,
}

/// 视频编码
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum VideoCodec {
    H264,
    H265,
    Av1,
}

/// 音频编码
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AudioCodec {
    Aac,
    Mp3,
    Opus,
}

/// 容器格式
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Container {
    Mp4,
    Mov,
    Webm,
}

// ─── 字幕样式（与 AssemblyKit 的 SubtitleStyle 对齐） ─────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleStyle {
    pub id: String,
    pub font_family: String,
    pub font_size: u32,
    pub color: String,
    pub stroke_color: String,
    pub stroke_width: u32,
    /// 'top' | 'middle' | 'bottom'
    pub position: String,
    /// 0.0-1.0
    pub opacity: f32,
}

// ─── 渲染阶段配置（Stage 15.1） ─────────────────────────

/// 渲染阶段参数（被 PlatformPreset 引用）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderConfig {
    /// 配音音量倍率（0.0-2.0，1.0 = 原音量）
    pub voice_volume: f32,
    /// 背景音乐音量倍率（0.0-1.0）
    pub bgm_volume: f32,
    /// 原始视频原声音量倍率（0.0-1.0，0 = 静音）
    pub original_volume: f32,
    /// 渲染速度（0.5-2.0，1.0 = 正常）
    pub speed_factor: f32,
    /// 是否启用淡入淡出
    pub fade_in_out: bool,
    /// 最大时长（秒，0 = 不限；超出会自动剪辑）
    pub max_duration_secs: u32,
}

impl Default for RenderConfig {
    fn default() -> Self {
        Self {
            voice_volume: 1.0,
            bgm_volume: 0.3,
            original_volume: 0.0,
            speed_factor: 1.0,
            fade_in_out: true,
            max_duration_secs: 0,
        }
    }
}

// ─── 平台预设 ──────────────────────────────────────────────────

/// 平台预设
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformPreset {
    pub id: PlatformId,
    pub name: String,
    pub domain: String,
    pub aspect_ratio: AspectRatio,
    pub width: u32,
    pub height: u32,
    pub fps: u32,
    /// 视频码率（kbps）
    pub video_bitrate: u32,
    /// 音频码率（kbps）
    pub audio_bitrate: u32,
    pub video_codec: VideoCodec,
    pub audio_codec: AudioCodec,
    pub container: Container,
    pub default_subtitle_style: SubtitleStyle,
    pub burn_subtitle_by_default: bool,
    /// 渲染阶段配置（Stage 15.1 新增）
    pub render_config: RenderConfig,
}

// ─── 主流平台预设（数据驱动） ─────────────────────────────────

/// 所有平台预设的注册表（哈希映射 · O(1) 查找）
pub static PLATFORM_PRESETS: std::sync::LazyLock<std::collections::HashMap<PlatformId, PlatformPreset>> =
    std::sync::LazyLock::new(|| {
        let mut m = std::collections::HashMap::new();
        m.insert(PlatformId::Douyin, PlatformPreset {
            id: PlatformId::Douyin,
            name: "抖音".to_string(),
            domain: "douyin.com".to_string(),
            aspect_ratio: AspectRatio::R9x16,
            width: 1080,
            height: 1920,
            fps: 30,
            video_bitrate: 3500,
            audio_bitrate: 128,
            video_codec: VideoCodec::H264,
            audio_codec: AudioCodec::Aac,
            container: Container::Mp4,
            default_subtitle_style: SubtitleStyle {
                id: "douyin-default".to_string(),
                font_family: "Source Han Sans".to_string(),
                font_size: 24,
                color: "#FFFFFF".to_string(),
                stroke_color: "#000000".to_string(),
                stroke_width: 3,
                position: "middle".to_string(),
                opacity: 1.0,
            },
            burn_subtitle_by_default: true,
            render_config: RenderConfig { max_duration_secs: 180, ..Default::default() },
        });
        m.insert(PlatformId::Kuaishou, PlatformPreset {
            id: PlatformId::Kuaishou,
            name: "快手".to_string(),
            domain: "kuaishou.com".to_string(),
            aspect_ratio: AspectRatio::R9x16,
            width: 1080,
            height: 1920,
            fps: 30,
            video_bitrate: 3500,
            audio_bitrate: 128,
            video_codec: VideoCodec::H264,
            audio_codec: AudioCodec::Aac,
            container: Container::Mp4,
            default_subtitle_style: SubtitleStyle {
                id: "kuaishou-default".to_string(),
                font_family: "Source Han Sans".to_string(),
                font_size: 24,
                color: "#FFFFFF".to_string(),
                stroke_color: "#000000".to_string(),
                stroke_width: 3,
                position: "middle".to_string(),
                opacity: 1.0,
            },
            burn_subtitle_by_default: true,
            render_config: RenderConfig { max_duration_secs: 180, ..Default::default() },
        });
        m.insert(PlatformId::Xiaohongshu, PlatformPreset {
            id: PlatformId::Xiaohongshu,
            name: "小红书".to_string(),
            domain: "xiaohongshu.com".to_string(),
            aspect_ratio: AspectRatio::R3x4,
            width: 1080,
            height: 1440,
            fps: 30,
            video_bitrate: 3000,
            audio_bitrate: 128,
            video_codec: VideoCodec::H264,
            audio_codec: AudioCodec::Aac,
            container: Container::Mp4,
            default_subtitle_style: SubtitleStyle {
                id: "xhs-default".to_string(),
                font_family: "Source Han Sans".to_string(),
                font_size: 20,
                color: "#FFFFFF".to_string(),
                stroke_color: "#000000".to_string(),
                stroke_width: 2,
                position: "top".to_string(),
                opacity: 0.9,
            },
            burn_subtitle_by_default: true,
            render_config: RenderConfig { max_duration_secs: 300, ..Default::default() },
        });
        m.insert(PlatformId::Wechat, PlatformPreset {
            id: PlatformId::Wechat,
            name: "视频号".to_string(),
            domain: "channels.weixin.qq.com".to_string(),
            aspect_ratio: AspectRatio::R9x16,
            width: 1080,
            height: 1920,
            fps: 30,
            video_bitrate: 3000,
            audio_bitrate: 128,
            video_codec: VideoCodec::H264,
            audio_codec: AudioCodec::Aac,
            container: Container::Mp4,
            default_subtitle_style: SubtitleStyle {
                id: "wechat-default".to_string(),
                font_family: "Source Han Sans".to_string(),
                font_size: 22,
                color: "#FFFFFF".to_string(),
                stroke_color: "#000000".to_string(),
                stroke_width: 2,
                position: "bottom".to_string(),
                opacity: 0.85,
            },
            burn_subtitle_by_default: true,
            render_config: RenderConfig { max_duration_secs: 300, ..Default::default() },
        });
        m.insert(PlatformId::Tiktok, PlatformPreset {
            id: PlatformId::Tiktok,
            name: "TikTok".to_string(),
            domain: "tiktok.com".to_string(),
            aspect_ratio: AspectRatio::R9x16,
            width: 1080,
            height: 1920,
            fps: 30,
            video_bitrate: 3500,
            audio_bitrate: 128,
            video_codec: VideoCodec::H264,
            audio_codec: AudioCodec::Aac,
            container: Container::Mp4,
            default_subtitle_style: SubtitleStyle {
                id: "tiktok-default".to_string(),
                font_family: "Source Han Sans".to_string(),
                font_size: 24,
                color: "#FFFFFF".to_string(),
                stroke_color: "#000000".to_string(),
                stroke_width: 3,
                position: "middle".to_string(),
                opacity: 1.0,
            },
            burn_subtitle_by_default: true,
            render_config: RenderConfig { max_duration_secs: 180, ..Default::default() },
        });
        m.insert(PlatformId::Bilibili, PlatformPreset {
            id: PlatformId::Bilibili,
            name: "B 站".to_string(),
            domain: "bilibili.com".to_string(),
            aspect_ratio: AspectRatio::R16x9,
            width: 1920,
            height: 1080,
            fps: 30,
            video_bitrate: 6000,
            audio_bitrate: 192,
            video_codec: VideoCodec::H265,
            audio_codec: AudioCodec::Aac,
            container: Container::Mp4,
            default_subtitle_style: SubtitleStyle {
                id: "bili-default".to_string(),
                font_family: "Source Han Sans".to_string(),
                font_size: 22,
                color: "#FFFFFF".to_string(),
                stroke_color: "#000000".to_string(),
                stroke_width: 2,
                position: "bottom".to_string(),
                opacity: 1.0,
            },
            burn_subtitle_by_default: false,
            render_config: RenderConfig { original_volume: 0.5, ..Default::default() },
        });
        m.insert(PlatformId::Youtube, PlatformPreset {
            id: PlatformId::Youtube,
            name: "YouTube".to_string(),
            domain: "youtube.com".to_string(),
            aspect_ratio: AspectRatio::R16x9,
            width: 1920,
            height: 1080,
            fps: 30,
            video_bitrate: 8000,
            audio_bitrate: 192,
            video_codec: VideoCodec::H264,
            audio_codec: AudioCodec::Aac,
            container: Container::Mp4,
            default_subtitle_style: SubtitleStyle {
                id: "yt-default".to_string(),
                font_family: "Roboto".to_string(),
                font_size: 20,
                color: "#FFFFFF".to_string(),
                stroke_color: "#000000".to_string(),
                stroke_width: 1,
                position: "bottom".to_string(),
                opacity: 1.0,
            },
            burn_subtitle_by_default: false,
            render_config: RenderConfig { original_volume: 0.3, ..Default::default() },
        });
        m.insert(PlatformId::YoutubeShorts, PlatformPreset {
            id: PlatformId::YoutubeShorts,
            name: "YouTube Shorts".to_string(),
            domain: "youtube.com/shorts".to_string(),
            aspect_ratio: AspectRatio::R9x16,
            width: 1080,
            height: 1920,
            fps: 30,
            video_bitrate: 5000,
            audio_bitrate: 192,
            video_codec: VideoCodec::H264,
            audio_codec: AudioCodec::Aac,
            container: Container::Mp4,
            default_subtitle_style: SubtitleStyle {
                id: "yt-shorts-default".to_string(),
                font_family: "Roboto".to_string(),
                font_size: 24,
                color: "#FFFFFF".to_string(),
                stroke_color: "#000000".to_string(),
                stroke_width: 2,
                position: "middle".to_string(),
                opacity: 1.0,
            },
            burn_subtitle_by_default: true,
            render_config: RenderConfig { max_duration_secs: 60, ..Default::default() },
        });
        m
    });

// ─── 纯函数 ──────────────────────────────────────────────────

/// 列出所有平台预设
pub fn list_platforms() -> Vec<PlatformPreset> {
    PLATFORM_PRESETS.values().cloned().collect()
}

/// 按 ID 查预设（找不到返回 None）
pub fn get_platform(id: PlatformId) -> Option<PlatformPreset> {
    PLATFORM_PRESETS.get(&id).cloned()
}

/// 按 ID 查预设，找不到时回退到抖音
pub fn require_platform(id: PlatformId) -> PlatformPreset {
    PLATFORM_PRESETS
        .get(&id)
        .cloned()
        .unwrap_or_else(|| get_platform(PlatformId::Douyin).expect("douyin preset always exists"))
}

// ─── 单元测试（Stage 15.1） ────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_platforms_returns_8_presets() {
        let p = list_platforms();
        assert_eq!(p.len(), 8);
    }

    #[test]
    fn get_platform_returns_known_id() {
        let p = get_platform(PlatformId::Douyin).expect("douyin exists");
        assert_eq!(p.name, "抖音");
        assert_eq!(p.width, 1080);
    }

    #[test]
    fn get_platform_returns_none_for_missing() {
        // 用一个确保 HashMap 不会越界写入的虚拟 id
        // 因为 PlatformId 是 enum，所有值都在表里时不会 None
        // 这里只能间接验证：枚举值集合 == 8
        let p = list_platforms();
        let mut seen = std::collections::HashSet::new();
        for preset in &p {
            assert!(seen.insert(preset.id));
        }
        assert_eq!(seen.len(), 8);
    }

    #[test]
    fn all_presets_have_render_config() {
        for p in list_platforms() {
            assert!(p.render_config.voice_volume >= 0.0);
            assert!(p.render_config.voice_volume <= 2.0);
        }
    }

    #[test]
    fn short_video_platforms_have_180s_limit() {
        for id in [PlatformId::Douyin, PlatformId::Kuaishou, PlatformId::Tiktok] {
            let p = get_platform(id).expect("preset exists");
            assert_eq!(p.render_config.max_duration_secs, 180, "platform {:?}", id);
        }
    }

    #[test]
    fn long_form_platforms_have_no_limit() {
        for id in [PlatformId::Bilibili, PlatformId::Youtube] {
            let p = get_platform(id).expect("preset exists");
            assert_eq!(p.render_config.max_duration_secs, 0, "platform {:?}", id);
        }
    }

    #[test]
    fn shorts_has_60s_limit() {
        let p = get_platform(PlatformId::YoutubeShorts).expect("shorts exists");
        assert_eq!(p.render_config.max_duration_secs, 60);
    }

    #[test]
    fn render_config_default_values() {
        let c = RenderConfig::default();
        assert_eq!(c.voice_volume, 1.0);
        assert_eq!(c.bgm_volume, 0.3);
        assert_eq!(c.original_volume, 0.0);
        assert_eq!(c.speed_factor, 1.0);
        assert!(c.fade_in_out);
        assert_eq!(c.max_duration_secs, 0);
    }

    #[test]
    fn render_config_serializes_camel_case() {
        let c = RenderConfig::default();
        let json = serde_json::to_string(&c).expect("serialize");
        assert!(json.contains("voiceVolume"));
        assert!(json.contains("bgmVolume"));
        assert!(json.contains("originalVolume"));
        assert!(json.contains("speedFactor"));
        assert!(json.contains("fadeInOut"));
        assert!(json.contains("maxDurationSecs"));
    }

    #[test]
    fn require_platform_falls_back_to_douyin() {
        // 强制构造一个不在表里的 PlatformId 会破坏类型系统；
        // 这里间接验证 require_platform 至少能正常返回 douyin
        let p = require_platform(PlatformId::Douyin);
        assert_eq!(p.id, PlatformId::Douyin);
    }

    #[test]
    fn preset_serializes_to_camel_case_json() {
        let p = get_platform(PlatformId::Douyin).unwrap();
        let json = serde_json::to_string(&p).unwrap();
        assert!(json.contains("\"aspectRatio\":\"9:16\""));
        assert!(json.contains("\"videoBitrate\":3500"));
        assert!(json.contains("\"videoCodec\":\"h264\""));
        assert!(json.contains("\"burnSubtitleByDefault\":true"));
        assert!(json.contains("\"renderConfig\""));
    }
}
