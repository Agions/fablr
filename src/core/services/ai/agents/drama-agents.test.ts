/**
 * core/services/ai/agents/drama-agents.test.ts
 *
 * 4-Agent 协同编排与工作流单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DramaDeconstructAgent } from './drama-deconstruct-agent';
import { HookCraftAgent } from './hook-craft-agent';
import { CommentaryWriterAgent } from './commentary-writer-agent';
import { StoryboardAlignerAgent } from './storyboard-aligner-agent';
import { DramaWorkflowCoordinator } from './drama-workflow-coordinator';
import type { HybridModelRouter } from '../hybrid-model-router';
import type { AgentExecutionContext, WorkflowProgressEvent } from './types';
import type { DramaScreenplayIR, ScreenplaySceneBeat } from '@/core/models/screenplay-ast';

describe('Drama Multi-Agent System', () => {
  let mockRouter: HybridModelRouter;

  const sampleContext: AgentExecutionContext = {
    projectId: 'proj-drama-101',
    projectTitle: '隐秘的继承者',
    videoDurationSec: 120,
    styleMode: 'suspense',
    rawTranscriptionText: '开场一个暴雨之夜，豪宅里突然停电。主角推开书房门发现遗嘱失踪。',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockRouter = {
      routeChat: vi.fn(),
      routeChatStream: vi.fn(),
    } as unknown as HybridModelRouter;
  });

  // ─────────────────────────────────────────────────────────────
  // 1. DramaDeconstructAgent
  // ─────────────────────────────────────────────────────────────
  describe('DramaDeconstructAgent', () => {
    it('successfully parses valid JSON response from LLM', async () => {
      const mockLlmResponse = JSON.stringify({
        title: '豪门遗产谜局',
        synopsis: '暴雨夜离奇失踪的遗嘱，掀开多方角力的序幕。',
        characters: [
          {
            id: 'c1',
            name: '林霄',
            role: 'protagonist',
            description: '隐退侦探',
            emotionalArc: '从怀疑到笃定',
          },
        ],
        plotBeats: [
          {
            id: 'b1',
            sceneIndex: 0,
            timeRange: [0, 60],
            title: '密室惊魂',
            conflictType: 'twist',
            intensity: 8,
            summary: '遗嘱在严密监控下消失',
          },
        ],
      });

      vi.spyOn(mockRouter, 'routeChat').mockResolvedValueOnce({
        content: `\`\`\`json\n${mockLlmResponse}\n\`\`\``,
        meta: { target: 'local', provider: 'local', model: 'qwen2.5:7b', fallbackTriggered: false, latencyMs: 120 },
      });

      const agent = new DramaDeconstructAgent(mockRouter);
      const result = await agent.deconstruct(sampleContext);

      expect(result.title).toBe('豪门遗产谜局');
      expect(result.synopsis).toContain('暴雨夜');
      expect(result.characters).toHaveLength(1);
      expect(result.characters[0].name).toBe('林霄');
      expect(result.plotBeats).toHaveLength(1);
      expect(result.plotBeats[0].conflictType).toBe('twist');
    });

    it('gracefully falls back to default structure when LLM fails or errors', async () => {
      vi.spyOn(mockRouter, 'routeChat').mockRejectedValueOnce(new Error('LLM timeout'));

      const agent = new DramaDeconstructAgent(mockRouter);
      const result = await agent.deconstruct(sampleContext);

      expect(result.title).toBe(sampleContext.projectTitle);
      expect(result.characters.length).toBeGreaterThanOrEqual(1);
      expect(result.plotBeats.length).toBeGreaterThanOrEqual(2);
      expect(result.plotBeats[0].timeRange[0]).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. HookCraftAgent
  // ─────────────────────────────────────────────────────────────
  describe('HookCraftAgent', () => {
    const deconstructed = {
      title: '真假千金',
      synopsis: '被掉包二十年的真千金回到豪门，迎接她的却是致命陷阱。',
      characters: [],
      plotBeats: [{ id: 'b1', sceneIndex: 0, timeRange: [0, 30] as [number, number], title: '对峙', conflictType: 'climax' as const, intensity: 9, summary: '身份曝光' }],
    };

    it('generates high-tension 3-second hook', async () => {
      const mockHookJson = JSON.stringify({
        hookType: 'shocking_statement',
        headline: '绝境归来掀翻全场',
        openingText: '你敢相信吗？身价千亿的豪门千金，竟然在街头给人擦了三年皮鞋！',
        durationSec: 4,
      });

      vi.spyOn(mockRouter, 'routeChat').mockResolvedValueOnce({
        content: mockHookJson,
        meta: { target: 'cloud', provider: 'cloud', model: 'deepseek-chat', fallbackTriggered: true, latencyMs: 250 },
      });

      const agent = new HookCraftAgent(mockRouter);
      const result = await agent.craftHook(deconstructed);

      expect(result.hook.hookType).toBe('shocking_statement');
      expect(result.hook.headline).toBe('绝境归来掀翻全场');
      expect(result.hook.openingText).toContain('擦了三年皮鞋');
      expect(result.hook.durationSec).toBe(4);
    });

    it('supports rewriteHook with user customization', async () => {
      const currentHook = {
        hookType: 'question' as const,
        headline: '原标题',
        openingText: '原开场词',
        durationSec: 3,
      };

      const newHookJson = JSON.stringify({
        hookType: 'reversal',
        headline: '逆风翻盘',
        openingText: '如果有人告诉你，你最恨的人其实为你默默抗下了所有...',
        durationSec: 5,
      });

      vi.spyOn(mockRouter, 'routeChat').mockResolvedValueOnce({
        content: newHookJson,
        meta: { target: 'local', provider: 'local', model: 'qwen2.5:7b', fallbackTriggered: false, latencyMs: 100 },
      });

      const agent = new HookCraftAgent(mockRouter);
      const updated = await agent.rewriteHook({
        currentHook,
        synopsis: deconstructed.synopsis,
        hookType: 'question',
      });

      expect(updated.headline).toBe('逆风翻盘');
      expect(updated.openingText).toContain('默默抗下了所有');
      expect(updated.durationSec).toBe(5);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. CommentaryWriterAgent
  // ─────────────────────────────────────────────────────────────
  describe('CommentaryWriterAgent', () => {
    const deconstructed = {
      title: '绝地求生',
      synopsis: '小镇青年破解离奇失踪案。',
      characters: [],
      plotBeats: [
        { id: 'b1', sceneIndex: 0, timeRange: [0, 40] as [number, number], title: '初探现场', conflictType: 'setup' as const, intensity: 5, summary: '发现遗留脚印' },
        { id: 'b2', sceneIndex: 1, timeRange: [40, 80] as [number, number], title: '深夜追凶', conflictType: 'climax' as const, intensity: 9, summary: '凶手现身' },
      ],
    };

    it('generates sceneBeats commentary with temporal alignment', async () => {
      const mockCommentaryJson = JSON.stringify({
        sceneBeats: [
          {
            sceneIndex: 0,
            startTimeSec: 0,
            endTimeSec: 40,
            visualCue: '主角打着手电筒在泥泞树林中搜寻',
            shotType: 'MS',
            voiceoverText: '漆黑的雨夜，一道诡异的影子正在悄悄逼近。',
            emotion: 'suspenseful',
            soundFx: '雷鸣雨声',
            bgmSuggestion: '悬疑低音',
          },
          {
            sceneIndex: 1,
            startTimeSec: 40,
            endTimeSec: 80,
            visualCue: '神秘黑影突然举起利刃',
            shotType: 'CU',
            voiceoverText: '就在主角回头的瞬间，一把冰冷的匕首已经悬在了半空！',
            emotion: 'tense',
            soundFx: '金属出鞘声',
            bgmSuggestion: '急促小提琴',
          },
        ],
      });

      vi.spyOn(mockRouter, 'routeChat').mockResolvedValueOnce({
        content: mockCommentaryJson,
        meta: { target: 'local', provider: 'local', model: 'qwen2.5:7b', fallbackTriggered: false, latencyMs: 300 },
      });

      const agent = new CommentaryWriterAgent(mockRouter);
      const draft = await agent.writeCommentary(deconstructed, 80);

      expect(draft.sceneBeats).toHaveLength(2);
      expect(draft.sceneBeats[0].voiceoverText).toContain('诡异的影子');
      expect(draft.sceneBeats[1].shotType).toBe('CU');
      expect(draft.sceneBeats[1].timecode).toBe('00:00:40 - 00:01:20');
    });

    it('rewrites single beat while preserving timing boundaries', async () => {
      const currentBeat: ScreenplaySceneBeat = {
        id: 'beat-1',
        sceneIndex: 0,
        startTimeSec: 10,
        endTimeSec: 25,
        timecode: '00:00:10 - 00:00:25',
        visualCue: '原画面',
        shotType: 'MS',
        voiceoverText: '原台词',
        emotion: 'neutral',
      };

      const rewriteJson = JSON.stringify({
        visualCue: '主角眼神凌厉，嘴角泛起冷笑',
        shotType: 'CU',
        voiceoverText: '他以为吃定了我，却不知道真正的猎人，往往以猎物的姿态出现。',
        emotion: 'dramatic',
        soundFx: '心跳急促音',
        bgmSuggestion: '反派逆转旋律',
      });

      vi.spyOn(mockRouter, 'routeChat').mockResolvedValueOnce({
        content: rewriteJson,
        meta: { target: 'cloud', provider: 'cloud', model: 'deepseek-chat', fallbackTriggered: true, latencyMs: 200 },
      });

      const agent = new CommentaryWriterAgent(mockRouter);
      const updated = await agent.rewriteBeat({
        currentBeat,
        instruction: '改得更霸气反派一点',
      });

      expect(updated.id).toBe('beat-1');
      expect(updated.startTimeSec).toBe(10);
      expect(updated.endTimeSec).toBe(25);
      expect(updated.shotType).toBe('CU');
      expect(updated.voiceoverText).toContain('真正的猎人');
      expect(updated.emotion).toBe('dramatic');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. StoryboardAlignerAgent
  // ─────────────────────────────────────────────────────────────
  describe('StoryboardAlignerAgent', () => {
    it('compiles and validates complete ScreenplayIR AST', () => {
      const deconstructed = {
        title: '双面人生',
        synopsis: '一个替身的自我救赎。',
        characters: [
          { id: 'c1', name: '李铭', role: 'protagonist' as const, description: '替身演员', emotionalArc: '觉醒' },
        ],
        plotBeats: [
          { id: 'b1', sceneIndex: 0, timeRange: [0, 30] as [number, number], title: '登台', conflictType: 'setup' as const, intensity: 6, summary: '替身登场' },
        ],
      };

      const hookResult = {
        hook: {
          hookType: 'shocking_statement' as const,
          headline: '惊天替身',
          openingText: '你看到的所有光芒，背后都是他在流血。',
          durationSec: 4,
        },
      };

      const commentaryDraft = {
        sceneBeats: [
          {
            sceneIndex: 0,
            startTimeSec: 0,
            endTimeSec: 30,
            timecode: '00:00:00 - 00:00:30',
            visualCue: '聚光灯下替身的身影',
            shotType: 'LS' as const,
            voiceoverText: '他站在万人中央，却无一人知晓他的真实姓名。',
            emotion: 'heartfelt' as const,
          },
        ],
      };

      const agent = new StoryboardAlignerAgent();
      const screenplay = agent.align(sampleContext, deconstructed, hookResult, commentaryDraft);

      expect(screenplay.projectId).toBe(sampleContext.projectId);
      expect(screenplay.title).toBe('双面人生');
      expect(screenplay.sceneBeats).toHaveLength(1);
      expect(screenplay.sceneBeats[0].id).toContain('beat-');
      expect(screenplay.totalEstimatedDurationSec).toBeGreaterThan(0);
      expect(screenplay.modelVersion).toBe('hybrid-v3');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 5. DramaWorkflowCoordinator
  // ─────────────────────────────────────────────────────────────
  describe('DramaWorkflowCoordinator', () => {
    it('executes full pipeline with sequential progress callbacks', async () => {
      const mockDeconstruct = new DramaDeconstructAgent(mockRouter);
      const mockHook = new HookCraftAgent(mockRouter);
      const mockWriter = new CommentaryWriterAgent(mockRouter);
      const mockAligner = new StoryboardAlignerAgent();

      vi.spyOn(mockDeconstruct, 'deconstruct').mockResolvedValueOnce({
        title: '测试剧集',
        synopsis: '大纲概要',
        characters: [],
        plotBeats: [{ id: 'b1', sceneIndex: 0, timeRange: [0, 60], title: '节拍', conflictType: 'setup', intensity: 5, summary: '概要' }],
      });

      vi.spyOn(mockHook, 'craftHook').mockResolvedValueOnce({
        hook: { hookType: 'question', headline: '开场问句', openingText: '这是真的吗？', durationSec: 3 },
      });

      vi.spyOn(mockWriter, 'writeCommentary').mockResolvedValueOnce({
        sceneBeats: [
          {
            sceneIndex: 0,
            startTimeSec: 0,
            endTimeSec: 60,
            timecode: '00:00:00 - 00:01:00',
            visualCue: '画面1',
            shotType: 'MS',
            voiceoverText: '第一句解说。',
            emotion: 'neutral',
          },
        ],
      });

      const coordinator = new DramaWorkflowCoordinator(
        mockDeconstruct,
        mockHook,
        mockWriter,
        mockAligner
      );

      const events: WorkflowProgressEvent[] = [];
      const result = await coordinator.executePipeline(sampleContext, e => events.push(e));

      expect(result.title).toBe('测试剧集');
      expect(result.sceneBeats).toHaveLength(1);
      expect(events.length).toBeGreaterThanOrEqual(4);
      expect(events[0].phase).toBe('deconstructing');
      expect(events[events.length - 1].phase).toBe('completed');
      expect(events[events.length - 1].progressPercent).toBe(100);
    });

    it('aborts pipeline immediately when AbortSignal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      const coordinator = new DramaWorkflowCoordinator();
      await expect(
        coordinator.executePipeline(sampleContext, undefined, controller.signal)
      ).rejects.toThrow(/aborted/i);
    });

    it('rewrites beat and updates screenplay immutably', async () => {
      const coordinator = new DramaWorkflowCoordinator();
      const initialScreenplay: DramaScreenplayIR = {
        projectId: 'p1',
        title: '剧目',
        styleMode: 'standard',
        synopsis: '大纲',
        characters: [],
        plotBeats: [],
        hook: { hookType: 'question', headline: 'h', openingText: 'o', durationSec: 4 },
        sceneBeats: [
          {
            id: 'beat-target',
            sceneIndex: 0,
            startTimeSec: 0,
            endTimeSec: 10,
            timecode: '00:00:00 - 00:00:10',
            visualCue: '老画面',
            shotType: 'MS',
            voiceoverText: '老台词',
            emotion: 'neutral',
          },
        ],
        totalEstimatedDurationSec: 10,
        generatedAt: '2026-01-01T00:00:00Z',
      };

      vi.spyOn(coordinator['writerAgent'], 'rewriteBeat').mockResolvedValueOnce({
        id: 'beat-target',
        sceneIndex: 0,
        startTimeSec: 0,
        endTimeSec: 10,
        timecode: '00:00:00 - 00:00:10',
        visualCue: '新画面',
        shotType: 'CU',
        voiceoverText: '新台词',
        emotion: 'dramatic',
      });

      const updated = await coordinator.rewriteBeat(initialScreenplay, 'beat-target', {
        instruction: '修改台词',
      });

      expect(updated.sceneBeats[0].visualCue).toBe('新画面');
      expect(updated.sceneBeats[0].voiceoverText).toBe('新台词');
      expect(updated.sceneBeats[0].shotType).toBe('CU');
    });

    it('updates beat directly with partial patch', () => {
      const coordinator = new DramaWorkflowCoordinator();
      const initialScreenplay: DramaScreenplayIR = {
        projectId: 'p1',
        title: '剧目',
        styleMode: 'standard',
        synopsis: '大纲',
        characters: [],
        plotBeats: [],
        hook: { hookType: 'question', headline: 'h', openingText: 'o', durationSec: 4 },
        sceneBeats: [
          {
            id: 'beat-1',
            sceneIndex: 0,
            startTimeSec: 0,
            endTimeSec: 10,
            timecode: '00:00:00 - 00:00:10',
            visualCue: '原',
            shotType: 'MS',
            voiceoverText: '原',
            emotion: 'neutral',
          },
        ],
        totalEstimatedDurationSec: 10,
        generatedAt: '2026-01-01T00:00:00Z',
      };

      const patched = coordinator.updateBeat(initialScreenplay, 'beat-1', {
        voiceoverText: '手动修改后的配音词',
        emotion: 'heartfelt',
      });

      expect(patched.sceneBeats[0].voiceoverText).toBe('手动修改后的配音词');
      expect(patched.sceneBeats[0].emotion).toBe('heartfelt');
      expect(patched.sceneBeats[0].visualCue).toBe('原'); // unchanged
    });
  });
});
