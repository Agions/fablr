//! PipelineJob — 流水线任务（后端侧类型）
//!
//! 与前端 `src/core/domain/job.ts` 对齐。
//! M0 阶段仅落地类型骨架；阶段流转逻辑由前端
//! `core/pipeline/workflow-machine.ts` 驱动，Rust 端在 M4
//! （任务编排）阶段实现 job 状态机 + artifacts 管理 + 断点续传。

use serde::{Deserialize, Serialize};

/// 流水线阶段（与三层模型对齐：L0 理解 / L1 规划+脚本 / L2 配音+渲染）
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JobPhase {
    Understanding,
    Planning,
    Scripting,
    Voicing,
    Rendering,
}

impl JobPhase {
    /// 阶段顺序（用于阶段推进与恢复判断）
    pub const ALL: [JobPhase; 5] = [
        JobPhase::Understanding,
        JobPhase::Planning,
        JobPhase::Scripting,
        JobPhase::Voicing,
        JobPhase::Rendering,
    ];

    /// 阶段序号（0 起）
    pub fn index(self) -> usize {
        match self {
            JobPhase::Understanding => 0,
            JobPhase::Planning => 1,
            JobPhase::Scripting => 2,
            JobPhase::Voicing => 3,
            JobPhase::Rendering => 4,
        }
    }

    /// 下一阶段（最后一阶段返回 None）
    pub fn next(self) -> Option<JobPhase> {
        Self::ALL.get(self.index() + 1).copied()
    }
}

/// 单阶段执行状态
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PhaseRunState {
    Pending,
    Running,
    Done,
    Failed,
    Skipped,
}

/// 产物落盘路径（按阶段填充；store 与 job 仅存磁盘引用，保证可序列化）
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobArtifacts {
    /// L0 剧情时间线 JSON
    pub storyline_path: Option<String>,
    /// L1 导演计划 JSON
    pub plan_path: Option<String>,
    /// L1 解说脚本 JSON
    pub script_path: Option<String>,
    /// L2 段落配音目录
    pub audio_dir: Option<String>,
    /// L2 成片路径
    pub output_path: Option<String>,
}

/// 最近一次错误（阶段 + 信息），成功后清空
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobError {
    pub phase: JobPhase,
    pub message: String,
}

/// 流水线任务实体
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PipelineJob {
    pub id: String,
    /// 当前所在阶段
    pub phase: JobPhase,
    /// 各阶段执行状态
    pub phase_status: std::collections::BTreeMap<JobPhase, PhaseRunState>,
    /// 整体进度 0.0-1.0
    pub progress_pct: f64,
    pub error: Option<JobError>,
    pub artifacts: JobArtifacts,
    pub created_at: String,
    pub updated_at: String,
}

impl PipelineJob {
    /// 创建初始流水线任务（从理解阶段开始，全部 pending）
    pub fn new(id: String) -> Self {
        let now = crate::time::now_iso8601();
        let phase_status = JobPhase::ALL
            .into_iter()
            .map(|p| (p, PhaseRunState::Pending))
            .collect();
        Self {
            id,
            phase: JobPhase::Understanding,
            phase_status,
            progress_pct: 0.0,
            error: None,
            artifacts: JobArtifacts::default(),
            created_at: now.clone(),
            updated_at: now,
        }
    }

    /// 查询某阶段的执行状态
    pub fn status(&self, phase: JobPhase) -> PhaseRunState {
        self.phase_status
            .get(&phase)
            .copied()
            .unwrap_or(PhaseRunState::Pending)
    }
}
