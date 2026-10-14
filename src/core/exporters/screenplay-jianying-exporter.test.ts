/**
 * core/exporters/screenplay-jianying-exporter.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  convertScreenplayToJianYingInput,
  exportScreenplayToJianYing,
} from './screenplay-jianying-exporter';
import type { DramaScreenplayIR } from '@/core/models/screenplay-ast';

describe('Screenplay to JianYing Exporter', () => {
  const sampleScreenplay: DramaScreenplayIR = {
    projectId: 'proj-jy-101',
    title: '逆袭风暴',
    styleMode: 'suspense',
    synopsis: '底层青年的绝地逆袭。',
    characters: [
      { id: 'c1', name: '叶凡', role: 'protagonist', description: '主角', emotionalArc: '成长' },
    ],
    plotBeats: [
      { id: 'b1', sceneIndex: 0, timeRange: [0, 10], title: '受辱', conflictType: 'setup', intensity: 7, summary: '主角被当众嘲讽' },
      { id: 'b2', sceneIndex: 1, timeRange: [10, 25], title: '反击', conflictType: 'climax', intensity: 9, summary: '隐藏身份曝光' },
    ],
    hook: {
      hookType: 'shocking_statement',
      headline: '绝境反转',
      openingText: '三年之期已到，龙王归来！',
      durationSec: 3,
    },
    sceneBeats: [
      {
        id: 'beat-1',
        sceneIndex: 0,
        startTimeSec: 0,
        endTimeSec: 10,
        timecode: '00:00:00 - 00:00:10',
        visualCue: '主角在暴雨中低头受辱',
        shotType: 'CU',
        voiceoverText: '他以为忍气吞声就能换来尊重。',
        emotion: 'heartfelt',
        audioPath: '/tmp/audio/vo-1.wav',
        subtitleText: '他以为忍气吞声就能换来尊重。',
      },
      {
        id: 'beat-2',
        sceneIndex: 1,
        startTimeSec: 10,
        endTimeSec: 25,
        timecode: '00:00:10 - 00:00:25',
        visualCue: '车队开进大门，所有人惊慌失措',
        shotType: 'ACTION',
        voiceoverText: '殊不知，真正的龙王早已苏醒！',
        emotion: 'dramatic',
        audioPath: '/tmp/audio/vo-2.wav',
        subtitleText: '殊不知，真正的龙王早已苏醒！',
      },
    ],
    totalEstimatedDurationSec: 28,
    generatedAt: '2026-01-01T00:00:00Z',
  };

  it('converts ScreenplayIR to JianYingProjectExportInput with microsecond accuracy', () => {
    const input = convertScreenplayToJianYingInput(sampleScreenplay, {
      sourceVideoPath: '/media/raw_drama.mp4',
      aspectRatio: '9:16',
      fps: 30,
      bgmPath: '/media/bgm_epic.mp3',
      bgmVolume: 0.3,
      includeHookAsSubtitleCard: true,
    });

    expect(input.projectName).toBe('逆袭风暴');
    expect(input.aspectRatio).toBe('9:16');
    expect(input.videoClips).toHaveLength(2);

    // 验证微秒转换：10s -> 10,000,000us
    expect(input.videoClips[0].durationUs).toBe(10_000_000);
    expect(input.videoClips[0].startTimeUs).toBe(0);
    expect(input.videoClips[1].durationUs).toBe(15_000_000);
    expect(input.videoClips[1].startTimeUs).toBe(10_000_000);

    // 验证音频轨与字幕轨映射
    expect(input.voiceoverClips).toHaveLength(2);
    expect(input.voiceoverClips[0].sourcePath).toBe('/tmp/audio/vo-1.wav');

    // 验证字幕包含 Hook 开场 + 2 个分镜
    expect(input.subtitles).toHaveLength(3);
    expect(input.subtitles![0].text).toContain('龙王归来');
    expect(input.subtitles![1].text).toContain('忍气吞声');

    // 验证背景音乐轨道
    expect(input.bgmClips).toHaveLength(1);
    expect(input.bgmClips![0].volume).toBe(0.3);
    expect(input.bgmClips![0].durationUs).toBe(25_000_000);
  });

  it('exports draft content with valid track structure', async () => {
    const result = await exportScreenplayToJianYing(sampleScreenplay, {
      sourceVideoPath: '/media/test.mp4',
    });

    expect(result.success).toBe(true);
    expect(result.draft).toBeDefined();
    expect(result.draft.tracks.length).toBeGreaterThanOrEqual(2);
    expect(result.draft.materials.videos).toHaveLength(2);
    expect(result.draft.version).toBe(2);
  });
});
