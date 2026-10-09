import { describe, it, expect } from 'vitest';
import { formatScriptDuration, estimateVoiceDuration } from './time';

describe('time utilities', () => {
  it('formats script duration accurately', () => {
    expect(formatScriptDuration(0)).toBe('0秒');
    expect(formatScriptDuration(45)).toBe('45秒');
    expect(formatScriptDuration(75)).toBe('1分15秒');
  });

  it('estimates voice duration accurately', () => {
    expect(estimateVoiceDuration('')).toBe(0);
    expect(estimateVoiceDuration('你好世界')).toBe(1);
    expect(estimateVoiceDuration('这是一段测试台词，包含十二个字。')).toBe(4);
    expect(estimateVoiceDuration('这是一段测试台词')).toBe(2);
  });
});
