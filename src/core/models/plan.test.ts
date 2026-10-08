/**
 * core/models/plan 测试
 * 覆盖导演计划的创建、审批、修订与防御性解析
 */
import { describe, it, expect } from 'vitest';
import {
  createDirectorPlan,
  approveDirectorPlan,
  reviseDirectorPlan,
  isPlanApproved,
  parseDirectorPlan,
} from './plan';

describe('createDirectorPlan', () => {
  it('创建 draft 计划（version = 1，缺省字段兜底）', () => {
    const plan = createDirectorPlan({
      summary: '摘要',
      angle: '悬疑揭秘',
      targetDurationSecs: 120,
    });
    expect(plan.status).toBe('draft');
    expect(plan.version).toBe(1);
    expect(plan.summary).toBe('摘要');
    expect(plan.segmentMode).toBe('silent_only');
    expect(plan.keyPoints).toEqual([]);
    expect(plan.warnings).toEqual([]);
    expect(plan.targetAudience).toBe('');
  });

  it('支持完整字段输入', () => {
    const plan = createDirectorPlan({
      id: 'plan_1',
      summary: 's',
      angle: 'a',
      targetAudience: '短剧爱好者',
      targetDurationSecs: 60,
      estimatedSegments: 8,
      segmentMode: 'montage',
      recommendedVoice: 'voice_x',
      keyPoints: ['k1'],
      warnings: ['w1'],
      confidence: 0.9,
      modelUsed: 'gpt-4o',
    });
    expect(plan.id).toBe('plan_1');
    expect(plan.segmentMode).toBe('montage');
    expect(plan.confidence).toBe(0.9);
  });
});

describe('approveDirectorPlan', () => {
  it('draft → approved', () => {
    const plan = createDirectorPlan({ summary: 's', angle: 'a', targetDurationSecs: 60 });
    const approved = approveDirectorPlan(plan);
    expect(approved.status).toBe('approved');
    expect(approved).not.toBe(plan);
  });

  it('已批准时原样返回（幂等）', () => {
    const plan = approveDirectorPlan(
      createDirectorPlan({ summary: 's', angle: 'a', targetDurationSecs: 60 })
    );
    expect(approveDirectorPlan(plan)).toBe(plan);
  });
});

describe('reviseDirectorPlan', () => {
  it('修订字段 + version 递增 + 状态回到 draft', () => {
    const plan = approveDirectorPlan(
      createDirectorPlan({ summary: 's', angle: 'a', targetDurationSecs: 60 })
    );
    const revised = reviseDirectorPlan(plan, { angle: '情感共鸣', targetDurationSecs: 90 });
    expect(revised.angle).toBe('情感共鸣');
    expect(revised.targetDurationSecs).toBe(90);
    expect(revised.version).toBe(2);
    expect(revised.status).toBe('draft');
    // 未修订字段保留
    expect(revised.summary).toBe('s');
  });
});

describe('isPlanApproved', () => {
  it('null 与 draft 返回 false，approved 返回 true', () => {
    expect(isPlanApproved(null)).toBe(false);
    const draft = createDirectorPlan({ summary: 's', angle: 'a', targetDurationSecs: 60 });
    expect(isPlanApproved(draft)).toBe(false);
    expect(isPlanApproved(approveDirectorPlan(draft))).toBe(true);
  });
});

describe('parseDirectorPlan', () => {
  it('完整对象原样归一化', () => {
    const plan = createDirectorPlan({
      summary: 's',
      angle: 'a',
      targetDurationSecs: 60,
      segmentMode: 'montage',
      keyPoints: ['k'],
    });
    const parsed = parseDirectorPlan(plan);
    expect(parsed?.summary).toBe('s');
    expect(parsed?.segmentMode).toBe('montage');
    expect(parsed?.keyPoints).toEqual(['k']);
  });

  it('缺失字段兜底', () => {
    const parsed = parseDirectorPlan({});
    expect(parsed).not.toBeNull();
    expect(parsed?.status).toBe('draft');
    expect(parsed?.version).toBe(1);
    expect(parsed?.segmentMode).toBe('silent_only');
    expect(parsed?.keyPoints).toEqual([]);
  });

  it('非法 segmentMode 回退默认值', () => {
    const parsed = parseDirectorPlan({ segmentMode: 'bogus' });
    expect(parsed?.segmentMode).toBe('silent_only');
  });

  it('version 最小为 1', () => {
    expect(parseDirectorPlan({ version: 0 })?.version).toBe(1);
    expect(parseDirectorPlan({ version: -3 })?.version).toBe(1);
  });

  it('非对象输入返回 null', () => {
    expect(parseDirectorPlan(null)).toBeNull();
    expect(parseDirectorPlan([1])).toBeNull();
    expect(parseDirectorPlan('x')).toBeNull();
  });
});
