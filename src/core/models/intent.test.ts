/**
 * Intent 领域类型单元测试
 *
 * 覆盖：
 * - isValidIntent 类型守卫
 * - intentDefaultConfig 根据 intent 推导默认时长
 * - intensityToStyle 0-1 连续值 → 5 档离散风格
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DURATION_BY_INTENT,
  DEFAULT_INTENT_CONFIG,
  intentDefaultConfig,
  intensityToStyle,
  isValidIntent,
  type ContentIntent,
} from './intent';

describe('isValidIntent', () => {
  it('accepts all 7 valid ContentIntent values', () => {
    const valid: ContentIntent[] = [
      'movie-review',
      'short-drama',
      'comic-drama',
      'episode-recap',
      'voice-over',
      'highlight',
      'auto',
    ];
    for (const v of valid) {
      expect(isValidIntent(v)).toBe(true);
    }
  });

  it('rejects unknown strings', () => {
    expect(isValidIntent('review')).toBe(false);
    expect(isValidIntent('')).toBe(false);
    expect(isValidIntent('MOVIE-REVIEW')).toBe(false); // 大小写敏感
  });
});

describe('intentDefaultConfig', () => {
  it('derives targetDurationSecs from DEFAULT_DURATION_BY_INTENT', () => {
    expect(intentDefaultConfig('short-drama').targetDurationSecs).toBe(
      DEFAULT_DURATION_BY_INTENT['short-drama'],
    );
    expect(intentDefaultConfig('movie-review').targetDurationSecs).toBe(
      DEFAULT_DURATION_BY_INTENT['movie-review'],
    );
  });

  it('preserves default language/audience/toneIntensity', () => {
    const cfg = intentDefaultConfig('short-drama');
    expect(cfg.language).toBe(DEFAULT_INTENT_CONFIG.language);
    expect(cfg.audience).toBe(DEFAULT_INTENT_CONFIG.audience);
    expect(cfg.toneIntensity).toBe(DEFAULT_INTENT_CONFIG.toneIntensity);
  });
});

describe('intensityToStyle', () => {
  it('maps 0-1 to 5 discrete styles', () => {
    expect(intensityToStyle(0.0)).toBe('serious');
    expect(intensityToStyle(0.1)).toBe('serious');
    expect(intensityToStyle(0.3)).toBe('conversational');
    expect(intensityToStyle(0.5)).toBe('warm');
    expect(intensityToStyle(0.7)).toBe('humorous');
    expect(intensityToStyle(0.9)).toBe('suspense');
    expect(intensityToStyle(1.0)).toBe('suspense');
  });

  it('boundary: 0.2 → conversational (lower bound inclusive)', () => {
    expect(intensityToStyle(0.2)).toBe('conversational');
  });
  it('boundary: 0.6 → humorous (upper bound inclusive)', () => {
    expect(intensityToStyle(0.6)).toBe('humorous');
  });
});
