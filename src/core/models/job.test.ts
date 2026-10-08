/**
 * core/models/job 测试
 * 覆盖流水线任务的阶段状态机：推进、失败重试、跳过、恢复判断
 */
import { describe, it, expect } from 'vitest';
import {
  createPipelineJob,
  startPhase,
  completePhase,
  failPhase,
  retryPhase,
  skipPhase,
  isJobComplete,
  isPhaseRunnable,
  JOB_PHASE_ORDER,
} from './job';
import type { PipelineJob } from './job';

const makeJob = (overrides?: Partial<PipelineJob>): PipelineJob => ({
  ...createPipelineJob({ id: 'job_test' }),
  ...overrides,
});

describe('createPipelineJob', () => {
  it('从理解阶段开始，全部 pending，进度 0', () => {
    const job = createPipelineJob();
    expect(job.phase).toBe('understanding');
    expect(job.phaseStatus.understanding).toBe('pending');
    expect(job.phaseStatus.rendering).toBe('pending');
    expect(job.progressPct).toBe(0);
    expect(job.error).toBeNull();
    expect(job.artifacts.storylinePath).toBeNull();
  });
});

describe('startPhase', () => {
  it('前置阶段完成后可启动目标阶段', () => {
    let job = makeJob();
    job = startPhase(job, 'understanding');
    expect(job.phaseStatus.understanding).toBe('running');

    job = completePhase(job, 'understanding', '/tmp/storyline.json');
    job = startPhase(job, 'planning');
    expect(job.phaseStatus.planning).toBe('running');
    expect(job.phase).toBe('planning');
  });

  it('前置阶段未完成时拒绝启动', () => {
    const job = makeJob();
    const next = startPhase(job, 'scripting');
    expect(next.phaseStatus.scripting).toBe('pending');
    expect(next).toBe(job); // 原实例不变
  });
});

describe('completePhase', () => {
  it('完成阶段后推进到下一阶段并写入产物路径', () => {
    let job = makeJob();
    job = startPhase(job, 'understanding');
    job = completePhase(job, 'understanding', '/tmp/storyline.json');
    expect(job.phaseStatus.understanding).toBe('done');
    expect(job.artifacts.storylinePath).toBe('/tmp/storyline.json');
    expect(job.phase).toBe('planning');
    expect(job.progressPct).toBeCloseTo(0.2);
  });

  it('最后一个阶段完成后不再推进', () => {
    let job = makeJob();
    for (const phase of JOB_PHASE_ORDER) {
      job = startPhase(job, phase);
      job = completePhase(job, phase, `/tmp/${phase}.json`);
    }
    expect(job.phase).toBe('rendering');
    expect(job.phaseStatus.rendering).toBe('done');
    expect(isJobComplete(job)).toBe(true);
    expect(job.progressPct).toBe(1);
  });

  it('非 running 状态不可完成（幂等保护）', () => {
    const job = makeJob(); // all pending
    const next = completePhase(job, 'understanding', '/tmp/x.json');
    expect(next.phaseStatus.understanding).toBe('pending');
    expect(next.artifacts.storylinePath).toBeNull();
  });

  it('已完成阶段重复上报直接返回', () => {
    let job = makeJob();
    job = startPhase(job, 'understanding');
    job = completePhase(job, 'understanding', '/tmp/a.json');
    const next = completePhase(job, 'understanding', '/tmp/b.json');
    expect(next.artifacts.storylinePath).toBe('/tmp/a.json');
  });
});

describe('failPhase / retryPhase', () => {
  it('失败后记录错误并保持阶段回退，可重试', () => {
    let job = makeJob();
    job = startPhase(job, 'understanding');
    job = failPhase(job, 'understanding', 'Whisper 转写失败');
    expect(job.phaseStatus.understanding).toBe('failed');
    expect(job.error).toEqual({ phase: 'understanding', message: 'Whisper 转写失败' });

    job = retryPhase(job, 'understanding');
    expect(job.phaseStatus.understanding).toBe('pending');
    expect(job.error).toBeNull();
  });

  it('非 failed 阶段不可重试', () => {
    const job = makeJob();
    const next = retryPhase(job, 'understanding');
    expect(next).toBe(job);
  });
});

describe('skipPhase', () => {
  it('跳过阶段并推进到下一阶段', () => {
    let job = makeJob();
    job = startPhase(job, 'understanding');
    job = completePhase(job, 'understanding', '/tmp/s.json');
    job = skipPhase(job, 'planning');
    expect(job.phaseStatus.planning).toBe('skipped');
    expect(job.phase).toBe('scripting');
    expect(job.progressPct).toBeCloseTo(0.4);
  });

  it('已完成的阶段不可跳过', () => {
    let job = makeJob();
    job = startPhase(job, 'understanding');
    job = completePhase(job, 'understanding', '/tmp/s.json');
    const next = skipPhase(job, 'understanding');
    expect(next.phaseStatus.understanding).toBe('done');
  });
});

describe('isPhaseRunnable', () => {
  it('首阶段随时可运行，后续阶段需前置完成', () => {
    const fresh = makeJob();
    expect(isPhaseRunnable(fresh, 'understanding')).toBe(true);
    expect(isPhaseRunnable(fresh, 'scripting')).toBe(false);

    let job = makeJob();
    job = startPhase(job, 'understanding');
    job = completePhase(job, 'understanding', '/tmp/s.json');
    expect(isPhaseRunnable(job, 'planning')).toBe(true);
  });

  it('自身已完成/跳过时不可再运行', () => {
    let job = makeJob();
    job = startPhase(job, 'understanding');
    job = completePhase(job, 'understanding', '/tmp/s.json');
    expect(isPhaseRunnable(job, 'understanding')).toBe(false);
  });
});
