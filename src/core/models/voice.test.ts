/**
 * core/models/voice 测试
 * 覆盖音色配置的创建、更新与校验
 */
import { describe, it, expect } from 'vitest';
import {
  createDefaultVoiceConfig,
  createVoiceConfig,
  withVoiceConfigPatch,
  validateVoiceConfig,
  DEFAULT_PRODUCTION_VOICE_CONFIG,
} from './voice';

describe('createDefaultVoiceConfig', () => {
  it('创建默认音色配置', () => {
    const config = createDefaultVoiceConfig();
    expect(config).toEqual(DEFAULT_PRODUCTION_VOICE_CONFIG);
  });
});

describe('createVoiceConfig', () => {
  it('创建指定音色配置并保留默认参数', () => {
    const config = createVoiceConfig('male_zh');
    expect(config.voiceId).toBe('male_zh');
    expect(config.speed).toBe(DEFAULT_PRODUCTION_VOICE_CONFIG.speed);
    expect(config.volume).toBe(DEFAULT_PRODUCTION_VOICE_CONFIG.volume);
    expect(config.voiceInfo).toBeNull();
  });

  it('记录音色详情快照', () => {
    const voiceInfo = { id: 'v1', name: '磁性男声', gender: 'male' as const, lang: 'zh' };
    const config = createVoiceConfig('v1', voiceInfo);
    expect(config.voiceInfo).toEqual(voiceInfo);
  });

  it('支持覆盖默认参数', () => {
    const config = createVoiceConfig('female_zh', null, { speed: 1.2, volume: 0.5, format: 'wav' });
    expect(config.speed).toBe(1.2);
    expect(config.volume).toBe(0.5);
    expect(config.format).toBe('wav');
  });
});

describe('withVoiceConfigPatch', () => {
  it('以不可变方式更新配置', () => {
    const base = createDefaultVoiceConfig();
    const next = withVoiceConfigPatch(base, { speed: 1.5 });
    expect(next.speed).toBe(1.5);
    expect(base.speed).toBe(1);
  });
});

describe('validateVoiceConfig', () => {
  it('合法配置返回 null', () => {
    expect(validateVoiceConfig(createDefaultVoiceConfig())).toBeNull();
  });

  it('语速越界报错', () => {
    expect(validateVoiceConfig(createVoiceConfig('v', null, { speed: 0.1 }))).toContain('语速');
    expect(validateVoiceConfig(createVoiceConfig('v', null, { speed: 3 }))).toContain('语速');
  });

  it('音量越界报错', () => {
    expect(validateVoiceConfig(createVoiceConfig('v', null, { volume: -0.1 }))).toContain('音量');
    expect(validateVoiceConfig(createVoiceConfig('v', null, { volume: 1.5 }))).toContain('音量');
  });
});
