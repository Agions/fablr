//! Pipeline 5 个 Tauri command 实现
//!
//! v3 启动时仅做：
//! - PipelineJob 状态机推进（复用 crates/models/src/job.rs 等价 Rust 实现）
//! - 事件发送（app.emit）
//! - 落盘到 SQLite（db::Db）
//!
//! 真实业务逻辑（Director / Script / TTS / Render）在 steps/ 增量落地。

use tauri::{AppHandle, Emitter, Runtime, State};

use crate::commands::project::ProjectService;
use db::JobRow;
use models::job::{JobArtifacts, JobError, JobPhase, PhaseRunState, PipelineJob};
use media::utils::now_iso8601;

use super::types::{
    PhaseNeedsReviewEvent, PhaseParams, PhaseProgressEvent, PhaseStartedEvent, EVT_PHASE_NEEDS_REVIEW,
    EVT_PHASE_PROGRESS, EVT_PHASE_STARTED,
};

// ─── 5 个 Tauri Command ──────────────────────────────────────

/// 启动指定阶段（状态机 → running + 发送 started 事件）
#[tauri::command]
pub async fn pipeline_start_phase(
    app: AppHandle,
    service: State<'_, ProjectService>,
    input: PhaseParams,
) -> Result<PipelineJob, String> {
    start_phase_impl(&app, &service, input)
        .await
        .map_err(stringify_err)
}

/// 审批阶段产物（推进到下一阶段，调用真实执行函数）
#[tauri::command]
pub async fn pipeline_approve_phase(
    app: AppHandle,
    service: State<'_, ProjectService>,
    project_id: String,
    phase: String,
    modifications: Option<serde_json::Value>,
) -> Result<PipelineJob, String> {
    approve_phase_impl(&app, &service, &project_id, &phase, modifications)
        .await
        .map_err(stringify_err)
}

/// 重试失败阶段
#[tauri::command]
pub async fn pipeline_retry_phase(
    service: State<'_, ProjectService>,
    project_id: String,
    phase: String,
) -> Result<PipelineJob, String> {
    retry_phase_impl(&service, &project_id, &phase).map_err(stringify_err)
}

/// 跳过阶段
#[tauri::command]
pub async fn pipeline_skip_phase(
    service: State<'_, ProjectService>,
    project_id: String,
    phase: String,
) -> Result<PipelineJob, String> {
    skip_phase_impl(&service, &project_id, &phase).map_err(stringify_err)
}

/// 自动跑完无 gate 阶段（understanding + planning）
#[tauri::command]
pub async fn pipeline_run_auto(
    app: AppHandle,
    service: State<'_, ProjectService>,
    project_id: String,
) -> Result<PipelineJob, String> {
    super::orchestrator::run_auto(&app, &service, &project_id)
        .await
        .map_err(stringify_err)
}

// ─── 纯函数实现（便于单元测试） ──────────────────────────────

pub async fn start_phase_impl<R: Runtime>(
    app: &AppHandle<R>,
    service: &ProjectService,
    input: PhaseParams,
) -> Result<PipelineJob, String> {
    let phase = parse_phase(&input.phase)?;
    let now = now_unix();
    let job_id = format!("job_{}_{}", input.project_id, phase_key(&phase));

    // 1. 加载/创建 PipelineJob
    let mut job = service
        .db()
        .latest_job(&input.project_id)
        .map_err(stringify_err)?
        .map(job_row_to_job)
        .unwrap_or_else(|| PipelineJob::new(job_id.clone()));

    // 2. 状态机推进 → running
    if !is_phase_runnable(&job, &phase) {
        return Err(format!("phase '{}' not runnable (前置未完成)", phase_key(&phase)));
    }
    let updated = start_phase_state(&job, &phase);
    job = updated;

    // 3. 落盘
    let row = job_to_row(&job, &input.project_id, now);
    service.db().upsert_job(&row).map_err(stringify_err)?;

    // 4. 发送事件
    let _ = app.emit(
        EVT_PHASE_STARTED,
        PhaseStartedEvent {
            project_id: input.project_id.clone(),
            phase: phase_key(&phase).to_string(),
            started_at: now_iso8601(),
        },
    );
    let _ = app.emit(
        EVT_PHASE_PROGRESS,
        PhaseProgressEvent {
            project_id: input.project_id.clone(),
            phase: phase_key(&phase).to_string(),
            progress: 0.0,
            message: Some(format!("开始 {}", phase_key(&phase))),
        },
    );

    Ok(job)
}

pub async fn approve_phase_impl<R: Runtime>(
    app: &AppHandle<R>,
    service: &ProjectService,
    project_id: &str,
    phase: &str,
    _modifications: Option<serde_json::Value>,
) -> Result<PipelineJob, String> {
    let phase_enum = parse_phase(phase)?;
    let now = now_unix();
    let job_id = format!("job_{}_{}", project_id, phase_key(&phase_enum));

    let mut job = service
        .db()
        .latest_job(project_id)
        .map_err(stringify_err)?
        .map(job_row_to_job)
        .unwrap_or_else(|| PipelineJob::new(job_id.clone()));

    // 1. 标记当前阶段完成（产物路径暂用 placeholder，Stage 13.1+ 接入真实执行）
    let artifact_path = format!("/tmp/fablr/{}/{}.json", project_id, phase_key(&phase_enum));
    let updated = complete_phase_state(&job, &phase_enum, Some(artifact_path));
    job = updated;

    // 2. 落盘
    let row = job_to_row(&job, project_id, now);
    service.db().upsert_job(&row).map_err(stringify_err)?;

    // 3. 触发下一个 gate（如有）
    let next_phase = next_after(&phase_enum);
    if let Some(next) = next_phase {
        let gate = gate_for(&next);
        if let Some(g) = gate {
            let _ = app.emit(
                EVT_PHASE_NEEDS_REVIEW,
                PhaseNeedsReviewEvent {
                    project_id: project_id.to_string(),
                    phase: phase_key(&next).to_string(),
                    gate: g.to_string(),
                },
            );
        }
    }

    Ok(job)
}

pub fn retry_phase_impl(
    service: &ProjectService,
    project_id: &str,
    phase: &str,
) -> Result<PipelineJob, String> {
    let phase_enum = parse_phase(phase)?;
    let now = now_unix();
    let job_id = format!("job_{}_{}", project_id, phase_key(&phase_enum));

    let mut job = service
        .db()
        .latest_job(project_id)
        .map_err(stringify_err)?
        .map(job_row_to_job)
        .unwrap_or_else(|| PipelineJob::new(job_id.clone()));

    let updated = retry_phase_state(&job, &phase_enum);
    job = updated;

    let row = job_to_row(&job, project_id, now);
    service.db().upsert_job(&row).map_err(stringify_err)?;

    Ok(job)
}

pub fn skip_phase_impl(
    service: &ProjectService,
    project_id: &str,
    phase: &str,
) -> Result<PipelineJob, String> {
    let phase_enum = parse_phase(phase)?;
    let now = now_unix();
    let job_id = format!("job_{}_{}", project_id, phase_key(&phase_enum));

    let mut job = service
        .db()
        .latest_job(project_id)
        .map_err(stringify_err)?
        .map(job_row_to_job)
        .unwrap_or_else(|| PipelineJob::new(job_id.clone()));

    let updated = skip_phase_state(&job, &phase_enum);
    job = updated;

    let row = job_to_row(&job, project_id, now);
    service.db().upsert_job(&row).map_err(stringify_err)?;

    Ok(job)
}

// ─── Orchestrator（run_auto 走这里） ──────────────────────────

pub async fn run_auto<R: Runtime>(
    app: &AppHandle<R>,
    service: &ProjectService,
    project_id: &str,
) -> Result<PipelineJob, String> {
    // 启动 understanding + planning（无 gate 阶段）
    start_phase_impl(
        app,
        service,
        PhaseParams {
            project_id: project_id.to_string(),
            phase: "understanding".to_string(),
            params: serde_json::Value::Null,
        },
    )
    .await?;

    // 模拟 understanding 完成 → 推到 planning
    approve_phase_impl(app, service, project_id, "understanding", None).await?;

    start_phase_impl(
        app,
        service,
        PhaseParams {
            project_id: project_id.to_string(),
            phase: "planning".to_string(),
            params: serde_json::Value::Null,
        },
    )
    .await?;
    approve_phase_impl(app, service, project_id, "planning", None).await?;

    // 拉取最新 job 返回
    let row = service
        .db()
        .latest_job(project_id)
        .map_err(stringify_err)?
        .ok_or_else(|| "no job found".to_string())?;
    Ok(job_row_to_job(row))
}

// ─── 内部状态机（镜像 crates/models/src/job.rs） ────────────

fn start_phase_state(job: &PipelineJob, phase: &JobPhase) -> PipelineJob {
    if !is_phase_runnable(job, phase) {
        return job.clone();
    }
    let mut new_status = job.phase_status.clone();
    new_status.insert(*phase, PhaseRunState::Running);
    PipelineJob {
        phase: *phase,
        phase_status: new_status,
        error: None,
        updated_at: now_iso8601(),
        ..job.clone()
    }
}

fn complete_phase_state(
    job: &PipelineJob,
    phase: &JobPhase,
    _artifact_path: Option<String>,
) -> PipelineJob {
    if job.phase_status.get(phase) != Some(&PhaseRunState::Running) {
        return job.clone();
    }
    let mut new_status = job.phase_status.clone();
    new_status.insert(*phase, PhaseRunState::Done);
    let order = JobPhase::ALL;
    let idx = order.iter().position(|p| p == phase).unwrap_or(0);
    let next_phase = order.get(idx + 1).cloned();
    let new_phase = next_phase.unwrap_or(*phase);
    let mut updated = PipelineJob {
        phase: new_phase,
        phase_status: new_status,
        updated_at: now_iso8601(),
        ..job.clone()
    };
    // 推进到下一阶段 → pending
    if let Some(np) = next_phase {
        updated.phase_status.insert(np, PhaseRunState::Pending);
    }
    let done_count = order
        .iter()
        .filter(|p| {
            matches!(
                updated.phase_status.get(*p),
                Some(PhaseRunState::Done) | Some(PhaseRunState::Skipped)
            )
        })
        .count();
    updated.progress_pct = (done_count as f64) / (order.len() as f64);
    updated
}

fn retry_phase_state(job: &PipelineJob, phase: &JobPhase) -> PipelineJob {
    if job.phase_status.get(phase) != Some(&PhaseRunState::Failed) {
        return job.clone();
    }
    let mut new_status = job.phase_status.clone();
    new_status.insert(*phase, PhaseRunState::Pending);
    PipelineJob {
        phase_status: new_status,
        error: None,
        updated_at: now_iso8601(),
        ..job.clone()
    }
}

fn skip_phase_state(job: &PipelineJob, phase: &JobPhase) -> PipelineJob {
    if matches!(
        job.phase_status.get(phase),
        Some(PhaseRunState::Done) | Some(PhaseRunState::Skipped)
    ) {
        return job.clone();
    }
    let mut new_status = job.phase_status.clone();
    new_status.insert(*phase, PhaseRunState::Skipped);
    PipelineJob {
        phase_status: new_status,
        updated_at: now_iso8601(),
        ..job.clone()
    }
}

fn is_phase_runnable(job: &PipelineJob, phase: &JobPhase) -> bool {
    let order = JobPhase::ALL;
    let idx = order.iter().position(|p| p == phase).unwrap_or(0);
    if matches!(
        job.phase_status.get(phase),
        Some(PhaseRunState::Done) | Some(PhaseRunState::Running) | Some(PhaseRunState::Skipped)
    ) {
        return false;
    }
    order[..idx].iter().all(|p| {
        matches!(
            job.phase_status.get(p),
            Some(PhaseRunState::Done) | Some(PhaseRunState::Skipped)
        )
    })
}

// ─── 工具 ──────────────────────────────────────────────────

fn parse_phase(s: &str) -> Result<JobPhase, String> {
    Ok(match s {
        "understanding" => JobPhase::Understanding,
        "planning" => JobPhase::Planning,
        "scripting" => JobPhase::Scripting,
        "voicing" => JobPhase::Voicing,
        "rendering" => JobPhase::Rendering,
        other => return Err(format!("unknown phase: {}", other)),
    })
}

fn phase_key(p: &JobPhase) -> &'static str {
    match p {
        JobPhase::Understanding => "understanding",
        JobPhase::Planning => "planning",
        JobPhase::Scripting => "scripting",
        JobPhase::Voicing => "voicing",
        JobPhase::Rendering => "rendering",
    }
}

fn next_after(p: &JobPhase) -> Option<JobPhase> {
    let order = [
        JobPhase::Understanding,
        JobPhase::Planning,
        JobPhase::Scripting,
        JobPhase::Voicing,
        JobPhase::Rendering,
    ];
    let idx = order.iter().position(|x| x == p)?;
    order.get(idx + 1).cloned()
}

fn gate_for(p: &JobPhase) -> Option<&'static str> {
    match p {
        JobPhase::Scripting => Some("plan-approval"),
        JobPhase::Voicing => Some("script-review"),
        JobPhase::Rendering => Some("voice-review"),
        _ => None,
    }
}

fn now_unix() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn stringify_err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

// ─── DB Row 转换 ──────────────────────────────────────────

fn job_to_row(job: &PipelineJob, project_id: &str, now: i64) -> JobRow {
    let phase_status_json = serde_json::to_string(&job.phase_status).unwrap_or_else(|_| "{}".to_string());
    let error_json = job.error.as_ref().and_then(|e| serde_json::to_string(e).ok());
    JobRow {
        id: job.id.clone(),
        project_id: project_id.to_string(),
        phase: phase_key(&job.phase).to_string(),
        phase_status_json,
        progress_pct: job.progress_pct as f32,
        error_json,
        created_at: if job.created_at.is_empty() { now } else { parse_iso(&job.created_at).unwrap_or(now) },
        updated_at: parse_iso(&job.updated_at).unwrap_or(now),
    }
}

fn job_row_to_job(row: JobRow) -> PipelineJob {
    let phase_status: std::collections::BTreeMap<JobPhase, PhaseRunState> =
        serde_json::from_str(&row.phase_status_json).unwrap_or_default();
    let error: Option<JobError> = row
        .error_json
        .as_ref()
        .and_then(|s| serde_json::from_str(s).ok());
    PipelineJob {
        id: row.id,
        phase: parse_phase(&row.phase).unwrap_or(JobPhase::Understanding),
        phase_status,
        progress_pct: row.progress_pct as f64,
        error,
        artifacts: JobArtifacts::default(),
        created_at: unix_to_iso(row.created_at),
        updated_at: unix_to_iso(row.updated_at),
    }
}

fn parse_iso(s: &str) -> Option<i64> {
    // 简化的 ISO 解析：取开头的数字当秒数（不严谨但够用）
    s.parse::<i64>().ok()
}

fn unix_to_iso(unix_secs: i64) -> String {
    let (year, month, day, hour, min, sec) = epoch_to_civil(unix_secs);
    format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z", year, month, day, hour, min, sec)
}

fn epoch_to_civil(secs: i64) -> (i32, u32, u32, u32, u32, u32) {
    let days = secs.div_euclid(86_400);
    let secs_of_day = secs.rem_euclid(86_400);
    let hour = (secs_of_day / 3600) as u32;
    let min = ((secs_of_day % 3600) / 60) as u32;
    let sec = (secs_of_day % 60) as u32;
    let z = days + 719_468_i64;
    let era = z.div_euclid(146_097);
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y: i64 = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = (if mp < 10 { mp + 3 } else { mp - 9 }) as u32;
    let year: i32 = if m <= 2 { (y + 1) as i32 } else { y as i32 };
    (year, m, d, hour, min, sec)
}
