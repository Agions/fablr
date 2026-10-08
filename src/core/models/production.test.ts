/**
 * core/models/production 测试
 * 覆盖 Production 根聚合的创建、状态推导与不可变更新
 */
import { describe, it, expect } from 'vitest';
import {
  createProduction,
  deriveProductionStatus,
  withProductionPatch,
  parseRenderResult,
} from './production';
import type { Production } from './production';
import type { PipelineJob } from './job';
import { createDirectorPlan } from './plan';

const baseMetadata = {
  duration: 100,
  width: 1920,
  height: 1080,
  fps: 30,
  codec: 'h264',
  bitrate: 8_000_000,
};

const makeProduction = (overrides?: Partial<Production>): Production => ({
  ...createProduction({
    name: '测试工程',
    videoPath: '/tmp/movie.mp4',
    durationSecs: 100,
    metadata: baseMetadata,
  }),
  ...overrides,
});

const mockPlan = createDirectorPlan({
  id: 'plan_1',
  summary: '剧情摘要',
  angle: '悬疑角度',
  targetDurationSecs: 300,
  estimatedSegments: 8,
  segmentMode: 'silent_only',
  recommendedVoice: 'male_zh',
  keyPoints: ['点1'],
  warnings: [],
  confidence: 0.85,
});

describe('createProduction', () => {
  it('创建初始 draft 状态工程，无任何产物', () => {
    const p = createProduction({
      name: '测试工程',
      videoPath: '/tmp/movie.mp4',
      durationSecs: 100,
      metadata: baseMetadata,
    });
    expect(p.status).toBe('draft');
    expect(p.storyline).toBeNull();
    expect(p.plan).toBeNull();
    expect(p.script).toBeNull();
    expect(p.voiceConfig).toBeNull();
    expect(p.render).toBeNull();
    expect(p.job).toBeNull();
    expect(p.id).toMatch(/^production_/);
  });

  it('支持显式传入 id', () => {
    const p = createProduction({
      id: 'prod_fixed',
      name: '测试工程',
      videoPath: '/tmp/movie.mp4',
      durationSecs: 100,
      metadata: baseMetadata,
    });
    expect(p.id).toBe('prod_fixed');
  });

  it('记录源视频信息', () => {
    const p = createProduction({
      name: '测试工程',
      videoPath: '/tmp/movie.mp4',
      durationSecs: 100,
      metadata: baseMetadata,
    });
    expect(p.source.videoPath).toBe('/tmp/movie.mp4');
    expect(p.source.durationSecs).toBe(100);
    expect(p.source.metadata.width).toBe(1920);
  });
});

describe('deriveProductionStatus', () => {
  it('draft：无任何产物', () => {
    expect(
      deriveProductionStatus({ plan: null, script: null, render: null, exportSettings: null })
    ).toBe('draft');
  });

  it('scripted：有导演计划但无脚本', () => {
    expect(
      deriveProductionStatus({ plan: mockPlan, script: null, render: null, exportSettings: null })
    ).toBe('scripted');
  });

  it('synthesized：有脚本（视为已完成配音阶段）', () => {
    expect(
      deriveProductionStatus({
        plan: mockPlan,
        script: {} as Production['script'],
        render: null,
        exportSettings: null,
      })
    ).toBe('synthesized');
  });

  it('rendered：有成片', () => {
    expect(
      deriveProductionStatus({
        plan: mockPlan,
        script: {} as Production['script'],
        render: {
          outputPath: '/tmp/out.mp4',
          durationSecs: 300,
          usedScenes: [],
          subtitleBurned: true,
          renderMs: 1000,
          renderedAt: '2026-01-01T00:00:00Z',
        },
        exportSettings: null,
      })
    ).toBe('rendered');
  });

  it('exported：有成片且配置过导出', () => {
    expect(
      deriveProductionStatus({
        plan: mockPlan,
        script: {} as Production['script'],
        render: {
          outputPath: '/tmp/out.mp4',
          durationSecs: 300,
          usedScenes: [],
          subtitleBurned: true,
          renderMs: 1000,
          renderedAt: '2026-01-01T00:00:00Z',
        },
        exportSettings: {} as Production['exportSettings'],
      })
    ).toBe('exported');
  });
});

describe('withProductionPatch', () => {
  it('以不可变方式挂载产物并刷新 status/updatedAt', () => {
    const base = makeProduction();
    const next = withProductionPatch(base, { plan: mockPlan });
    expect(next.plan).toBe(mockPlan);
    expect(next.status).toBe('scripted');
    expect(next.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // 原对象不被修改
    expect(base.plan).toBeNull();
    expect(base.status).toBe('draft');
  });

  it('挂载 job 时保持原状态推导逻辑', () => {
    const base = makeProduction();
    const job: PipelineJob = {
      id: 'job_1',
      phase: 'understanding',
      phaseStatus: {
        understanding: 'running',
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
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    const next = withProductionPatch(base, { job });
    expect(next.job?.phase).toBe('understanding');
    expect(next.status).toBe('draft');
  });
});

describe('parseRenderResult', () => {
  const valid = {
    outputPath: '/o.mp4',
    durationSecs: 10,
    usedScenes: ['0-5'],
    subtitleBurned: true,
    renderMs: 123,
    renderedAt: '2026-01-01T00:00:00.000Z',
  };

  it('正常解析完整对象', () => {
    expect(parseRenderResult(valid)).toEqual(valid);
  });

  it('顶层非对象 / 数组 / null 返回 null', () => {
    expect(parseRenderResult(null)).toBeNull();
    expect(parseRenderResult([])).toBeNull();
    expect(parseRenderResult('str')).toBeNull();
    expect(parseRenderResult(undefined)).toBeNull();
  });

  it('outputPath 缺失或为空时返回 null', () => {
    expect(parseRenderResult({ durationSecs: 1 })).toBeNull();
    expect(parseRenderResult({ outputPath: '' })).toBeNull();
  });

  it('非法数值与数组字段做兜底', () => {
    const result = parseRenderResult({
      outputPath: '/o.mp4',
      durationSecs: 'x',
      usedScenes: ['ok', 42],
      renderMs: NaN,
      subtitleBurned: 'yes',
    });
    expect(result).toEqual({
      outputPath: '/o.mp4',
      durationSecs: 0,
      usedScenes: ['ok'],
      subtitleBurned: false,
      renderMs: 0,
      renderedAt: new Date(0).toISOString(),
    });
  });
});
