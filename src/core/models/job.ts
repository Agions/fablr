/**
 * PipelineJob — 流水线任务（执行状态机）
 *
 * 设计原则：
 * - 替代旧架构 `run_commentary_pipeline` 一键黑盒：不再强制 autoApprove，
 *   job 记录每个阶段的产物落盘状态，支持中断恢复与单阶段重试。
 * - 阶段流转由前端 `core/pipeline/workflow-machine.ts` 驱动，
 *   本文件只负责 job 实体的创建与纯状态更新。
 * - artifacts 全部为磁盘路径，store 与 job 仅存引用，保证可序列化。
 */

// ─── 阶段定义 ───

/** 流水线阶段（与三层模型对齐：L0 理解 / L1 规划+脚本 / L2 配音+渲染） */
export type JobPhase = 'understanding' | 'planning' | 'scripting' | 'voicing' | 'rendering';

export type PhaseRunState = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

/** 阶段顺序（用于阶段推进与恢复判断） */
export const JOB_PHASE_ORDER: readonly JobPhase[] = [
  'understanding',
  'planning',
  'scripting',
  'voicing',
  'rendering',
];

// ─── 任务实体 ───

export interface PipelineJob {
  id: string;
  /** 当前所在阶段 */
  phase: JobPhase;
  /** 各阶段执行状态 */
  phaseStatus: Record<JobPhase, PhaseRunState>;
  /** 整体进度 0.0-1.0 */
  progressPct: number;
  /** 最近一次错误（阶段 + 信息），成功后清空 */
  error: { phase: JobPhase; message: string } | null;
  /** 产物落盘路径（按阶段填充） */
  artifacts: {
    /** L0 剧情时间线 JSON */
    storylinePath: string | null;
    /** L1 导演计划 JSON */
    planPath: string | null;
    /** L1 解说脚本 JSON */
    scriptPath: string | null;
    /** L2 段落配音目录 */
    audioDir: string | null;
    /** L2 成片路径 */
    outputPath: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

// ─── 工厂 ──────────────────────────────────────────────────────

/** 创建初始流水线任务（从理解阶段开始，全部 pending） */
export function createPipelineJob(input: { id?: string } = {}): PipelineJob {
  const now = new Date().toISOString();
  return {
    id: input.id ?? `job_${Date.now()}`,
    phase: 'understanding',
    phaseStatus: {
      understanding: 'pending',
      planning: 'pending',
      scripting: 'pending',
      voicing: 'pending',
      rendering: 'pending',
    },
    progressPct: 0,
    error: null,
    artifacts: {
      storylinePath: null,
      planPath: null,
      scriptPath: null,
      audioDir: null,
      outputPath: null,
    },
    createdAt: now,
    updatedAt: now,
  };
}

// ─── 阶段状态机（纯函数） ──────────────────────────────────────

/**
 * 标记某阶段开始运行
 *
 * @param job 当前任务
 * @param phase 目标阶段
 * @returns 新任务（前置阶段未完成时返回原任务不变）
 */
export function startPhase(job: PipelineJob, phase: JobPhase): PipelineJob {
  if (!isPhaseRunnable(job, phase)) return job;
  const phaseStatus = { ...job.phaseStatus, [phase]: 'running' as const };
  return { ...job, phase, phaseStatus, error: null, updatedAt: new Date().toISOString() };
}

/**
 * 标记某阶段完成，并推进到下一阶段
 *
 * @param job 当前任务
 * @param phase 完成的阶段
 * @param artifactPath 该阶段产物的落盘路径（写入 artifacts）
 * @returns 新任务
 */
export function completePhase(
  job: PipelineJob,
  phase: JobPhase,
  artifactPath: string | null
): PipelineJob {
  // 幂等：已完成阶段重复上报直接返回
  if (job.phaseStatus[phase] === 'done') return job;
  // 仅 running 状态可完成
  if (job.phaseStatus[phase] !== 'running') return job;
  const phaseStatus = { ...job.phaseStatus, [phase]: 'done' as const };
  const idx = JOB_PHASE_ORDER.indexOf(phase);
  const nextPhase = idx < JOB_PHASE_ORDER.length - 1 ? JOB_PHASE_ORDER[idx + 1] : phase;
  const nextPhaseStatus =
    idx < JOB_PHASE_ORDER.length - 1
      ? { ...phaseStatus, [nextPhase]: 'pending' as const }
      : phaseStatus;
  const progressPct = computeProgressPct(nextPhaseStatus);

  return {
    ...job,
    phase: nextPhase,
    phaseStatus: nextPhaseStatus,
    progressPct,
    artifacts: attachArtifact(job.artifacts, phase, artifactPath),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 标记某阶段失败（可重试该阶段，不重跑前置阶段）
 *
 * @param job 当前任务
 * @param phase 失败的阶段
 * @param message 错误信息
 * @returns 新任务（phase 回退到失败阶段）
 */
export function failPhase(job: PipelineJob, phase: JobPhase, message: string): PipelineJob {
  const phaseStatus = { ...job.phaseStatus, [phase]: 'failed' as const };
  return {
    ...job,
    phase,
    phaseStatus,
    error: { phase, message },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 重试已失败阶段（将 failed 重置为 pending，等待重新运行）
 *
 * @param job 当前任务
 * @param phase 要重试的阶段
 * @returns 新任务；该阶段未失败时返回原任务不变
 */
export function retryPhase(job: PipelineJob, phase: JobPhase): PipelineJob {
  if (job.phaseStatus[phase] !== 'failed') return job;
  const phaseStatus = { ...job.phaseStatus, [phase]: 'pending' as const };
  return { ...job, phase, phaseStatus, error: null, updatedAt: new Date().toISOString() };
}

/** 跳过某阶段（如用户已有脚本，跳过脚本生成） */
export function skipPhase(job: PipelineJob, phase: JobPhase): PipelineJob {
  if (job.phaseStatus[phase] === 'done') return job;
  const phaseStatus = { ...job.phaseStatus, [phase]: 'skipped' as const };
  const idx = JOB_PHASE_ORDER.indexOf(phase);
  const nextPhase = idx < JOB_PHASE_ORDER.length - 1 ? JOB_PHASE_ORDER[idx + 1] : phase;
  const nextPhaseStatus =
    idx < JOB_PHASE_ORDER.length - 1
      ? { ...phaseStatus, [nextPhase]: 'pending' as const }
      : phaseStatus;
  return {
    ...job,
    phase: nextPhase,
    phaseStatus: nextPhaseStatus,
    progressPct: computeProgressPct(nextPhaseStatus),
    updatedAt: new Date().toISOString(),
  };
}

/** 任务是否全部完成 */
export function isJobComplete(job: PipelineJob): boolean {
  return JOB_PHASE_ORDER.every(
    p => job.phaseStatus[p] === 'done' || job.phaseStatus[p] === 'skipped'
  );
}

/** 阶段是否可运行（前置阶段全部 done/skipped，且自身非 done/skipped/running） */
export function isPhaseRunnable(job: PipelineJob, phase: JobPhase): boolean {
  const idx = JOB_PHASE_ORDER.indexOf(phase);
  if (job.phaseStatus[phase] === 'done' || job.phaseStatus[phase] === 'skipped') return false;
  return JOB_PHASE_ORDER.slice(0, idx).every(
    prev => job.phaseStatus[prev] === 'done' || job.phaseStatus[prev] === 'skipped'
  );
}

// ─── 内部工具 ──────────────────────────────────────────────────

/** 计算整体进度：done/skipped 阶段占比 */
function computeProgressPct(phaseStatus: Record<JobPhase, PhaseRunState>): number {
  const done = JOB_PHASE_ORDER.filter(
    p => phaseStatus[p] === 'done' || phaseStatus[p] === 'skipped'
  ).length;
  return Math.round((done / JOB_PHASE_ORDER.length) * 100) / 100;
}

/** 将阶段产物路径写入 artifacts 对应槽位 */
function attachArtifact(
  artifacts: PipelineJob['artifacts'],
  phase: JobPhase,
  path: string | null
): PipelineJob['artifacts'] {
  switch (phase) {
    case 'understanding':
      return { ...artifacts, storylinePath: path };
    case 'planning':
      return { ...artifacts, planPath: path };
    case 'scripting':
      return { ...artifacts, scriptPath: path };
    case 'voicing':
      return { ...artifacts, audioDir: path };
    case 'rendering':
      return { ...artifacts, outputPath: path };
  }
}
