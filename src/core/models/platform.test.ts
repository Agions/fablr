/**
 * Platform 单元测试（Stage 15.1）
 *
 * 覆盖：getPlatform / requirePlatform fallback / RenderConfig 工厂 + 校验
 */

import { describe, expect, it } from 'vitest';
import {
  PLATFORM_PRESETS,
  listPlatforms,
  getPlatform,
  requirePlatform,
  createRenderConfig,
  validateRenderConfig,
  DEFAULT_RENDER_CONFIG,
  type PlatformId,
} from './platform';

describe('PLATFORM_PRESETS', () => {
  it('contains 8 platforms', () => {
    expect(Object.keys(PLATFORM_PRESETS).length).toBe(8);
  });

  it('all presets have renderConfig', () => {
    for (const p of Object.values(PLATFORM_PRESETS)) {
      expect(p.renderConfig).toBeDefined();
      expect(p.renderConfig.voiceVolume).toBeGreaterThanOrEqual(0);
    }
  });

  it('vertical short-video platforms (douyin/kuaishou/tiktok) have 180s limit', () => {
    expect(PLATFORM_PRESETS.douyin.renderConfig.maxDurationSecs).toBe(180);
    expect(PLATFORM_PRESETS.kuaishou.renderConfig.maxDurationSecs).toBe(180);
    expect(PLATFORM_PRESETS.tiktok.renderConfig.maxDurationSecs).toBe(180);
  });

  it('long-form platforms (bilibili/youtube) have no duration limit', () => {
    expect(PLATFORM_PRESETS.bilibili.renderConfig.maxDurationSecs).toBe(0);
    expect(PLATFORM_PRESETS.youtube.renderConfig.maxDurationSecs).toBe(0);
  });

  it('shorts has 60s limit', () => {
    expect(PLATFORM_PRESETS['youtube-shorts'].renderConfig.maxDurationSecs).toBe(60);
  });
});

describe('listPlatforms', () => {
  it('returns array of 8 presets', () => {
    expect(listPlatforms().length).toBe(8);
  });
});

describe('getPlatform', () => {
  it('returns preset for valid id', () => {
    const p = getPlatform('douyin');
    expect(p).not.toBeNull();
    expect(p?.name).toBe('抖音');
  });

  it('returns null for invalid id', () => {
    // 强制绕过 TS 类型检查
    const p = getPlatform('nonexistent' as PlatformId);
    expect(p).toBeNull();
  });
});

describe('requirePlatform', () => {
  it('returns preset for valid id', () => {
    const p = requirePlatform('bilibili');
    expect(p.name).toBe('B 站');
  });

  it('falls back to douyin for invalid id', () => {
    const p = requirePlatform('nonexistent' as PlatformId);
    expect(p.id).toBe('douyin');
  });
});

describe('createRenderConfig', () => {
  it('returns default when patch is empty', () => {
    const c = createRenderConfig();
    expect(c).toEqual(DEFAULT_RENDER_CONFIG);
  });

  it('overrides specific fields', () => {
    const c = createRenderConfig({ voiceVolume: 1.5, bgmVolume: 0.5 });
    expect(c.voiceVolume).toBe(1.5);
    expect(c.bgmVolume).toBe(0.5);
    // 未覆盖字段保留默认
    expect(c.originalVolume).toBe(0.0);
    expect(c.fadeInOut).toBe(true);
  });

  it('does not mutate DEFAULT_RENDER_CONFIG', () => {
    const c1 = createRenderConfig({ voiceVolume: 1.5 });
    const c2 = createRenderConfig();
    expect(c2.voiceVolume).toBe(DEFAULT_RENDER_CONFIG.voiceVolume);
    expect(c1.voiceVolume).toBe(1.5);
  });
});

describe('validateRenderConfig', () => {
  it('default is valid', () => {
    expect(validateRenderConfig(DEFAULT_RENDER_CONFIG)).toBeNull();
  });

  it('rejects voiceVolume out of range', () => {
    expect(validateRenderConfig({ ...DEFAULT_RENDER_CONFIG, voiceVolume: 2.5 })).toContain('voiceVolume');
    expect(validateRenderConfig({ ...DEFAULT_RENDER_CONFIG, voiceVolume: -0.1 })).toContain('voiceVolume');
  });

  it('rejects bgmVolume > 1.0', () => {
    expect(validateRenderConfig({ ...DEFAULT_RENDER_CONFIG, bgmVolume: 1.5 })).toContain('bgmVolume');
  });

  it('rejects originalVolume > 1.0', () => {
    expect(validateRenderConfig({ ...DEFAULT_RENDER_CONFIG, originalVolume: 2.0 })).toContain('originalVolume');
  });

  it('rejects speedFactor out of 0.5-2.0', () => {
    expect(validateRenderConfig({ ...DEFAULT_RENDER_CONFIG, speedFactor: 3.0 })).toContain('speedFactor');
    expect(validateRenderConfig({ ...DEFAULT_RENDER_CONFIG, speedFactor: 0.1 })).toContain('speedFactor');
  });

  it('rejects negative maxDurationSecs', () => {
    expect(validateRenderConfig({ ...DEFAULT_RENDER_CONFIG, maxDurationSecs: -1 })).toContain('maxDurationSecs');
  });

  it('accepts boundary values', () => {
    expect(validateRenderConfig({ ...DEFAULT_RENDER_CONFIG, voiceVolume: 2.0 })).toBeNull();
    expect(validateRenderConfig({ ...DEFAULT_RENDER_CONFIG, voiceVolume: 0 })).toBeNull();
    expect(validateRenderConfig({ ...DEFAULT_RENDER_CONFIG, speedFactor: 0.5 })).toBeNull();
    expect(validateRenderConfig({ ...DEFAULT_RENDER_CONFIG, speedFactor: 2.0 })).toBeNull();
  });
});
