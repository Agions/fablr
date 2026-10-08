//! Production — 解说工程根聚合（后端侧类型）
//!
//! 与前端 `src/core/domain/production.ts` 对齐。
//! 各阶段产物（storyline / plan / script / render）在 M1-M3 迁移阶段
//! 逐步替换为对具体产物类型的引用。

use serde::{Deserialize, Serialize};
use super::intent::{IntentConfig, DEFAULT_INTENT_CONFIG};

/// 工程生命周期状态（由阶段产物推导，前端负责推导逻辑）
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProductionStatus {
    /// 已创建，尚无分析产物
    Draft,
    /// L0 分析进行中 / 已完成
    Understanding,
    /// L1 导演计划生成中
    Planning,
    /// L1 脚本已生成（可编辑）
    Scripted,
    /// L2 配音已合成
    Synthesized,
    /// L2 成片已渲染
    Rendered,
    /// 已导出
    Exported,
}

/// 源视频信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductionSource {
    /// 源视频绝对路径
    pub video_path: String,
    /// 视频时长（秒）
    pub duration_secs: f64,
    /// 元数据（宽高/帧率/编码等，M1 阶段接入 video::metadata 产物）
    pub metadata: serde_json::Value,
}

/// 解说工程根聚合
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Production {
    pub id: String,
    pub name: String,
    /// v3 创作意图（驱动 L0-L2 各阶段策略）
    pub intent: IntentConfig,
    pub source: ProductionSource,
    /// L0 产物：剧情时间线（M1 迁移后替换为 Storyline 引用）
    pub storyline: Option<serde_json::Value>,
    /// L1 产物：导演计划（M2 迁移后替换为 DirectorPlan 引用）
    pub plan: Option<serde_json::Value>,
    /// L1 产物：解说脚本（M2 迁移后替换为 CommentaryScript 引用）
    pub script: Option<serde_json::Value>,
    /// L1 产物：音色配置
    pub voice_config: Option<serde_json::Value>,
    /// L2 产物：渲染结果
    pub render: Option<serde_json::Value>,
    /// 当前关联的流水线任务
    pub job: Option<crate::job::PipelineJob>,
    /// 派生状态
    pub status: ProductionStatus,
    /// 创建时间 (ISO 8601)
    pub created_at: String,
    /// 更新时间 (ISO 8601)
    pub updated_at: String,
}

impl Production {
    /// 创建新作品实体
    pub fn new(id: String, title: String, source: ProductionSource, intent: Option<IntentConfig>) -> Self {
        let now = crate::time::now_iso8601();
        Self {
            id,
            name: title,
            intent: intent.unwrap_or(DEFAULT_INTENT_CONFIG),
            source,
            storyline: None,
            plan: None,
            script: None,
            voice_config: None,
            render: None,
            job: None,
            status: ProductionStatus::Draft,
            created_at: now.clone(),
            updated_at: now,
        }
    }

    /// 更新状态并刷新 updated_at
    pub fn set_status(&mut self, status: ProductionStatus) {
        self.status = status;
        self.updated_at = crate::time::now_iso8601();
    }

    /// 修改 intent（不可变更新，刷新 updatedAt）
    pub fn with_intent(mut self, intent: IntentConfig) -> Self {
        self.intent = intent;
        self.updated_at = crate::time::now_iso8601();
        self
    }
}
