/**
 * stores/screenplay-store.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useScreenplayStore } from './screenplay-store';
import { dramaWorkflowCoordinator } from '@/core/services/ai/agents/drama-workflow-coordinator';
import type { DramaScreenplayIR } from '@/core/models/screenplay-ast';

describe('useScreenplayStore', () => {
  const sampleIR: DramaScreenplayIR = {
    projectId: 'p1',
    title: '逆转剧本',
    styleMode: 'standard',
    synopsis: '大纲说明',
    characters: [],
    plotBeats: [],
    hook: {
      hookType: 'shocking_statement',
      headline: '爆款开局',
      openingText: '开场白',
      durationSec: 4,
    },
    sceneBeats: [
      {
        id: 'beat-1',
        sceneIndex: 0,
        startTimeSec: 0,
        endTimeSec: 15,
        timecode: '00:00:00 - 00:00:15',
        visualCue: '画面描述',
        shotType: 'CU',
        voiceoverText: '台词文本',
        emotion: 'tense',
      },
    ],
    totalEstimatedDurationSec: 19,
    generatedAt: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    useScreenplayStore.getState().reset();
  });

  it('initializes with default idle state', () => {
    const state = useScreenplayStore.getState();
    expect(state.screenplay).toBeNull();
    expect(state.workflowPhase).toBe('idle');
    expect(state.isGenerating).toBe(false);
    expect(state.progressPercent).toBe(0);
  });

  it('runs startWorkflow and updates screenplay on completion', async () => {
    vi.spyOn(dramaWorkflowCoordinator, 'executePipeline').mockImplementation(
      async (_ctx, onProgress) => {
        if (onProgress) {
          onProgress({ phase: 'deconstructing', progressPercent: 25, message: '解构中' });
          onProgress({ phase: 'completed', progressPercent: 100, message: '完成' });
        }
        return sampleIR;
      }
    );

    const store = useScreenplayStore.getState();
    const result = await store.startWorkflow({
      projectId: 'p1',
      projectTitle: '逆转剧本',
      videoDurationSec: 60,
    });

    expect(result).toEqual(sampleIR);
    const updated = useScreenplayStore.getState();
    expect(updated.screenplay).toEqual(sampleIR);
    expect(updated.workflowPhase).toBe('completed');
    expect(updated.progressPercent).toBe(100);
    expect(updated.activeBeatId).toBe('beat-1');
  });

  it('handles workflow cancellation gracefully', async () => {
    vi.spyOn(dramaWorkflowCoordinator, 'executePipeline').mockRejectedValueOnce(
      new Error('Workflow aborted by user')
    );

    const store = useScreenplayStore.getState();
    const resultPromise = store.startWorkflow({
      projectId: 'p1',
      projectTitle: '逆转剧本',
      videoDurationSec: 60,
    });

    store.cancelWorkflow();
    const result = await resultPromise;

    expect(result).toBeNull();
    const state = useScreenplayStore.getState();
    expect(state.isGenerating).toBe(false);
    expect(state.workflowPhase).toBe('idle');
  });

  it('rewrites single card beat and supports undo/redo', async () => {
    const store = useScreenplayStore.getState();
    store.setScreenplay(sampleIR);

    const updatedIR: DramaScreenplayIR = {
      ...sampleIR,
      sceneBeats: [
        {
          ...sampleIR.sceneBeats[0],
          voiceoverText: '改写后的台词',
        },
      ],
    };

    vi.spyOn(dramaWorkflowCoordinator, 'rewriteBeat').mockResolvedValueOnce(updatedIR);

    const success = await store.rewriteCardBeat('beat-1', '语气更凶猛一点');
    expect(success).toBe(true);
    expect(useScreenplayStore.getState().screenplay?.sceneBeats[0].voiceoverText).toBe('改写后的台词');

    // 撤销回上一步
    useScreenplayStore.getState().undo();
    expect(useScreenplayStore.getState().screenplay?.sceneBeats[0].voiceoverText).toBe('台词文本');

    // 重做到改写后
    useScreenplayStore.getState().redo();
    expect(useScreenplayStore.getState().screenplay?.sceneBeats[0].voiceoverText).toBe('改写后的台词');
  });

  it('updates scene beat directly with partial patch', () => {
    const store = useScreenplayStore.getState();
    store.setScreenplay(sampleIR);

    store.updateSceneBeat('beat-1', { emotion: 'heartfelt' });
    expect(useScreenplayStore.getState().screenplay?.sceneBeats[0].emotion).toBe('heartfelt');
  });
});
