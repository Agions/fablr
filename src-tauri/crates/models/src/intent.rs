//! Intent — 创作意图（与前端 `src/core/domain/intent.ts` 对齐）
//!
//! v3 新增抽象：替代 v2 离散 ScriptStylePreset 风格枚举，
//! 显式声明「用户想做哪种解说」，驱动 L0-L2 各阶段策略。
//! toneIntensity 0.0-1.0 连续值表达语气强度。

use serde::{Deserialize, Serialize};

// ─── 枚举 ──────────────────────────────────────────────────────

/// 内容意图（v3 枚举，7 值）
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ContentIntent {
    /// 电影解说：深度分析 + 剧情梳理
    MovieReview,
    /// 短剧解说：钩子 + 反转 + 吐槽
    ShortDrama,
    /// 漫剧解说：v3 数据层预留
    ComicDrama,
    /// 剧集回顾：按集
    EpisodeRecap,
    /// 纯配音：v3 数据层预留
    VoiceOver,
    /// 高光集锦：复用 v2 剪辑模式能力
    Highlight,
    /// AI 自动判断
    Auto,
}

/// 支持的语言（v3 仅 zh-CN，其余占位）
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum IntentLanguage {
    #[serde(rename = "zh-CN")]
    ZhCn,
    #[serde(rename = "en-US")]
    EnUs,
    #[serde(rename = "ja-JP")]
    JaJp,
}

/// 目标受众
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum IntentAudience {
    General,
    Professional,
    Young,
}

// ─── 意图配置 ──────────────────────────────────────────────────

/// 意图配置（写入 Production.intent）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IntentConfig {
    pub intent: ContentIntent,
    /// 目标解说时长（秒）
    pub target_duration_secs: f64,
    pub language: IntentLanguage,
    pub audience: IntentAudience,
    /// 语气强度 0.0-1.0
    pub tone_intensity: f32,
}

// ─── 常量 ──────────────────────────────────────────────────────

/// 默认配置（普通解说 · 中文 · 通用受众 · 中性语气）
pub const DEFAULT_INTENT_CONFIG: IntentConfig = IntentConfig {
    intent: ContentIntent::ShortDrama,
    target_duration_secs: 180.0,
    language: IntentLanguage::ZhCn,
    audience: IntentAudience::General,
    tone_intensity: 0.5,
};

/// 各意图的默认目标时长（秒）
pub fn default_duration_by_intent(intent: ContentIntent) -> f64 {
    match intent {
        ContentIntent::MovieReview => 300.0,
        ContentIntent::ShortDrama => 120.0,
        ContentIntent::ComicDrama => 120.0,
        ContentIntent::EpisodeRecap => 240.0,
        ContentIntent::VoiceOver => 60.0,
        ContentIntent::Highlight => 60.0,
        ContentIntent::Auto => 180.0,
    }
}

// ─── 纯函数 ──────────────────────────────────────────────────

/// 校验意图字符串是否合法（前端传来的字符串反序列化时使用）
pub fn is_valid_intent(s: &str) -> bool {
    matches!(
        s,
        "movie-review"
            | "short-drama"
            | "comic-drama"
            | "episode-recap"
            | "voice-over"
            | "highlight"
            | "auto"
    )
}

/// 根据 intent 推导默认 IntentConfig
pub fn intent_default_config(intent: ContentIntent) -> IntentConfig {
    IntentConfig {
        intent,
        target_duration_secs: default_duration_by_intent(intent),
        language: DEFAULT_INTENT_CONFIG.language,
        audience: DEFAULT_INTENT_CONFIG.audience,
        tone_intensity: DEFAULT_INTENT_CONFIG.tone_intensity,
    }
}

/// toneIntensity 0-1 转 5 档风格枚举（与前端 ScriptStylePreset 对齐）
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ScriptStyle {
    Serious,
    Conversational,
    Warm,
    Humorous,
    Suspense,
}

pub fn intensity_to_style(intensity: f32) -> ScriptStyle {
    if intensity < 0.2 {
        ScriptStyle::Serious
    } else if intensity < 0.4 {
        ScriptStyle::Conversational
    } else if intensity < 0.6 {
        ScriptStyle::Warm
    } else if intensity < 0.8 {
        ScriptStyle::Humorous
    } else {
        ScriptStyle::Suspense
    }
}
