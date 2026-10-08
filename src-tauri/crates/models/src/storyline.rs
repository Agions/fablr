//! Storyline — 剧情时间线（后端侧类型）
//!
//! 与前端 `src/core/domain/storyline.ts` 对齐。
//! Storyline 是「内容理解层」的唯一产物，M1 阶段将收敛旧架构中
//! segment（场景切分）、subtitle（ASR 字幕）、highlight（高光检测）、
//! director analysis（剧情分析）四套分析结果；M0 阶段 scenes/subtitles/
//! highlights 以 serde_json::Value 占位，不引入对旧模块的编译依赖。

use serde::{Deserialize, Serialize};

/// 剧情时间线（L0 内容理解层核心产物）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Storyline {
    /// 产物版本（算法或 prompt 升级时 +1，用于缓存失效）
    pub version: u32,
    /// 场景切分结果（M1 迁移后替换为 Scene 引用）
    pub scenes: Vec<serde_json::Value>,
    /// ASR 字幕（M1 迁移后替换为 SubtitleSegment 引用）
    pub subtitles: Vec<serde_json::Value>,
    /// 高光片段（M1 迁移后替换为 HighlightSegment 引用）
    pub highlights: Vec<serde_json::Value>,
    /// LLM 剧情摘要
    pub summary: String,
    /// 关键信息点（导演计划与脚本生成的输入素材）
    pub key_points: Vec<String>,
    /// 剧情时间线置信度 0.0-1.0
    pub confidence: f64,
    /// 分析耗时（毫秒）
    pub analyze_ms: u64,
    /// 分析时间戳
    pub analyzed_at: String,
}

impl Storyline {
    /// 创建空的剧情时间线（占位用，实际产物由后端分析生成）
    pub fn empty() -> Self {
        Self {
            version: 1,
            scenes: Vec::new(),
            subtitles: Vec::new(),
            highlights: Vec::new(),
            summary: String::new(),
            key_points: Vec::new(),
            confidence: 0.0,
            analyze_ms: 0,
            analyzed_at: crate::time::now_iso8601(),
        }
    }
}
