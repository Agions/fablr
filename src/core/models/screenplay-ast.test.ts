import { describe, it, expect } from 'vitest';
import {
  formatSecToTimecode,
  estimateVoiceoverDurationSec,
  alignSceneBeats,
  validateScreenplayIR,
  createEmptyScreenplayIR,
  type ScreenplaySceneBeat,
} from './screenplay-ast';

describe('screenplay-ast domain model', () => {
  describe('formatSecToTimecode', () => {
    it('formats 0 seconds correctly', () => {
      expect(formatSecToTimecode(0)).toBe('00:00:00');
    });

    it('formats seconds within minute', () => {
      expect(formatSecToTimecode(45)).toBe('00:00:45');
    });

    it('formats minutes and seconds', () => {
      expect(formatSecToTimecode(135)).toBe('00:02:15');
    });

    it('clamps negative values to 0', () => {
      expect(formatSecToTimecode(-10)).toBe('00:00:00');
    });
  });

  describe('estimateVoiceoverDurationSec', () => {
    it('returns minimum 3.0 seconds for empty text', () => {
      expect(estimateVoiceoverDurationSec('')).toBe(3.0);
      expect(estimateVoiceoverDurationSec('   ')).toBe(3.0);
    });

    it('calculates duration for Chinese characters', () => {
      // 38 characters at 3.8 cps = 10.0 sec
      const text = '这是一个用于测试视听解说旁白时长的典型句子，通过字符数与预设语速除法计算得到精准耗时。';
      const duration = estimateVoiceoverDurationSec(text, 3.8);
      expect(duration).toBeGreaterThanOrEqual(10.0);
    });
  });

  describe('alignSceneBeats', () => {
    it('aligns consecutive scene beats without time gaps', () => {
      const rawBeats: ScreenplaySceneBeat[] = [
        {
          id: 'b1',
          sceneIndex: 0,
          timecode: '',
          startTimeSec: 0,
          endTimeSec: 2,
          visualCue: '特写',
          shotType: 'CU',
          voiceoverText: '一句话开始',
          emotion: 'tense',
        },
        {
          id: 'b2',
          sceneIndex: 1,
          timecode: '',
          startTimeSec: 0,
          endTimeSec: 5,
          visualCue: '全景',
          shotType: 'LS',
          voiceoverText: '紧接着第二句话展开详细阐述',
          emotion: 'suspenseful',
        },
      ];

      const { beats, totalDurationSec } = alignSceneBeats(rawBeats);

      expect(beats).toHaveLength(2);
      expect(beats[0].startTimeSec).toBe(0);
      expect(beats[0].endTimeSec).toBeGreaterThanOrEqual(3.0);
      expect(beats[1].startTimeSec).toBe(beats[0].endTimeSec);
      expect(beats[1].endTimeSec).toBe(totalDurationSec);
      expect(beats[0].timecode).toContain('00:00:00');
    });
  });

  describe('validateScreenplayIR & createEmptyScreenplayIR', () => {
    it('creates a valid empty screenplay IR', () => {
      const ir = createEmptyScreenplayIR('proj_123', '我的微短剧');
      expect(ir.projectId).toBe('proj_123');
      expect(ir.title).toBe('我的微短剧');
      expect(validateScreenplayIR(ir)).toBe(true);
    });

    it('rejects invalid objects', () => {
      expect(validateScreenplayIR(null)).toBe(false);
      expect(validateScreenplayIR({})).toBe(false);
      expect(validateScreenplayIR({ projectId: 'p1' })).toBe(false);
    });
  });
});
