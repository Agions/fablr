/**
 * core/models/storyline 测试
 * 覆盖剧情时间线的创建、场景查找、时间码格式化与覆盖率计算
 */
import { describe, it, expect } from 'vitest';
import {
  createEmptyStoryline,
  findSceneAtTime,
  formatTimecode,
  sceneCoverage,
  parseStoryline,
} from './storyline';
import type { Storyline } from './storyline';

const makeStoryline = (overrides?: Partial<Storyline>): Storyline => ({
  ...createEmptyStoryline(),
  scenes: [
    { id: 'scene_1', startTime: 0, endTime: 10, type: 'intro', score: 0.5 },
    { id: 'scene_2', startTime: 10, endTime: 30, type: 'action', score: 0.9 },
    { id: 'scene_3', startTime: 30, endTime: 50, type: 'outro', score: 0.6 },
  ],
  ...overrides,
});

describe('createEmptyStoryline', () => {
  it('创建空剧情时间线（默认版本 1）', () => {
    const s = createEmptyStoryline();
    expect(s.version).toBe(1);
    expect(s.scenes).toEqual([]);
    expect(s.subtitles).toEqual([]);
    expect(s.highlights).toEqual([]);
    expect(s.summary).toBe('');
    expect(s.confidence).toBe(0);
  });

  it('支持显式指定版本号', () => {
    expect(createEmptyStoryline({ version: 3 }).version).toBe(3);
  });
});

describe('findSceneAtTime', () => {
  it('命中区间内的场景（含边界）', () => {
    const s = makeStoryline();
    // scene_1: 0-10s → 0ms-10000ms
    expect(findSceneAtTime(s, 0)?.id).toBe('scene_1');
    expect(findSceneAtTime(s, 10_000)?.id).toBe('scene_1');
    // scene_2: 10-30s → 10000ms-30000ms
    expect(findSceneAtTime(s, 15_000)?.id).toBe('scene_2');
    expect(findSceneAtTime(s, 30_000)?.id).toBe('scene_2');
  });

  it('区间外返回 null', () => {
    const s = makeStoryline();
    expect(findSceneAtTime(s, 51_000)).toBeNull();
    expect(findSceneAtTime(s, -100)).toBeNull();
  });

  it('空场景列表返回 null', () => {
    expect(findSceneAtTime({ scenes: [] }, 5000)).toBeNull();
  });
});

describe('formatTimecode', () => {
  it('格式化 mm:ss', () => {
    expect(formatTimecode(0)).toBe('00:00');
    expect(formatTimecode(204)).toBe('03:24');
    expect(formatTimecode(65.9)).toBe('01:05');
  });

  it('负值钳制为 00:00', () => {
    expect(formatTimecode(-5)).toBe('00:00');
  });
});

describe('sceneCoverage', () => {
  it('计算已覆盖时长占比', () => {
    const s = makeStoryline(); // 覆盖 0-50s，共 50s
    expect(sceneCoverage(s, 100)).toBeCloseTo(0.5);
  });

  it('场景超出总时长时钳制边界', () => {
    const s = makeStoryline();
    expect(sceneCoverage(s, 40)).toBeCloseTo(1);
  });

  it('总时长为 0 或负值时返回 0', () => {
    const s = makeStoryline();
    expect(sceneCoverage(s, 0)).toBe(0);
    expect(sceneCoverage(s, -10)).toBe(0);
  });

  it('无场景时返回 0', () => {
    expect(sceneCoverage({ scenes: [] }, 100)).toBe(0);
  });
});

describe('parseStoryline', () => {
  it('完整对象原样归一化', () => {
    const raw = {
      version: 2,
      scenes: [{ id: 's1', startTime: 0, endTime: 5, type: 'dialog', score: 0.9 }],
      subtitles: [],
      highlights: [],
      summary: '摘要',
      keyPoints: ['点1'],
      confidence: 0.7,
      analyzeMs: 120,
      analyzedAt: '2026-01-01T00:00:00Z',
    };
    const s = parseStoryline(raw);
    expect(s?.version).toBe(2);
    expect(s?.scenes).toHaveLength(1);
    expect(s?.summary).toBe('摘要');
    expect(s?.keyPoints).toEqual(['点1']);
  });

  it('缺失字段兜底为空数组 / 默认值', () => {
    const s = parseStoryline({});
    expect(s).not.toBeNull();
    expect(s?.version).toBe(1);
    expect(s?.scenes).toEqual([]);
    expect(s?.subtitles).toEqual([]);
    expect(s?.highlights).toEqual([]);
    expect(s?.summary).toBe('');
    expect(s?.confidence).toBe(0);
  });

  it('非数值字段兜底（NaN / 字符串）', () => {
    const s = parseStoryline({ version: 'x', confidence: Number.NaN, summary: 123 });
    expect(s?.version).toBe(1);
    expect(s?.confidence).toBe(0);
    expect(s?.summary).toBe('');
  });

  it('keyPoints 过滤非字符串元素', () => {
    const s = parseStoryline({ keyPoints: ['a', 1, null, 'b'] });
    expect(s?.keyPoints).toEqual(['a', 'b']);
  });

  it('非对象输入（null / 数组 / 原始值）返回 null', () => {
    expect(parseStoryline(null)).toBeNull();
    expect(parseStoryline([1, 2])).toBeNull();
    expect(parseStoryline('str')).toBeNull();
    expect(parseStoryline(42)).toBeNull();
  });
});
