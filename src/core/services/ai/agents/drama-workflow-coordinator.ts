/**
 * core/services/ai/agents/drama-workflow-coordinator.ts
 *
 * 核心协同调度器 (DramaWorkflowCoordinator)
 *
 * 职责：
 * 1. 编排 4-Agent DAG 工作流 (Deconstruct -> Hook -> Commentary -> Aligner)；
 * 2. 调度执行过程中的阶段流转事件与百分比进度更新 (WorkflowProgressEvent)；
 * 3. 支持卡片级单镜头 AI 改写 (rewriteBeat) 与 Hook 重新提炼 (rewriteHook)；
 * 4. 支持任务打断取消 (AbortSignal) 与优雅降级。
 */

import type { DramaScreenplayIR, ScreenplaySceneBeat } from '@/core/models/screenplay-ast';
import {
  dramaDeconstructAgent,
  DramaDeconstructAgent,
} from './drama-deconstruct-agent';
import { hookCraftAgent, HookCraftAgent } from './hook-craft-agent';
import {
  commentaryWriterAgent,
  CommentaryWriterAgent,
} from './commentary-writer-agent';
import {
  storyboardAlignerAgent,
  StoryboardAlignerAgent,
} from './storyboard-aligner-agent';
import type {
  AgentExecutionContext,
  RewriteBeatOptions,
  RewriteHookOptions,
  WorkflowProgressCallback,
} from './types';
import { logger } from '@/shared/utils/logging';

export class DramaWorkflowCoordinator {
  constructor(
    private readonly deconstructAgent: DramaDeconstructAgent = dramaDeconstructAgent,
    private readonly hookAgent: HookCraftAgent = hookCraftAgent,
    private readonly writerAgent: CommentaryWriterAgent = commentaryWriterAgent,
    private readonly alignerAgent: StoryboardAlignerAgent = storyboardAlignerAgent
  ) {}

  /**
   * 执行完整的 4-Agent 自动化研磨管线
   */
  public async executePipeline(
    context: AgentExecutionContext,
    onProgress?: WorkflowProgressCallback,
    signal?: AbortSignal
  ): Promise<DramaScreenplayIR> {
    const notify = (
      phase: import('./types').WorkflowPhase,
      progressPercent: number,
      message: string,
      partialOutput?: Partial<DramaScreenplayIR>
    ) => {
      if (onProgress) {
        onProgress({ phase, progressPercent, message, partialOutput });
      }
    };

    if (signal?.aborted) {
      throw new Error('Workflow aborted before execution');
    }

    // ── Phase 1: 剧情解构 ──────────────────────────────────────
    notify('deconstructing', 10, '正在深度解构长视频故事脉络与角色画像...');
    const deconstructed = await this.deconstructAgent.deconstruct(context);
    if (signal?.aborted) throw new Error('Workflow aborted during deconstruction');

    notify('deconstructing', 28, '剧情结构与高潮节拍划分完成', {
      title: deconstructed.title,
      synopsis: deconstructed.synopsis,
      characters: deconstructed.characters,
      plotBeats: deconstructed.plotBeats,
    });

    // ── Phase 2: 黄金 3 秒 Hook 提炼 ─────────────────────────────
    notify('crafting_hook', 35, '正在研发黄金 3 秒吸睛爆款悬念开场词...');
    const hookResult = await this.hookAgent.craftHook(deconstructed, context.styleMode);
    if (signal?.aborted) throw new Error('Workflow aborted during hook crafting');

    notify('crafting_hook', 50, '黄金 3 秒悬念 Hook 生成完毕', {
      hook: hookResult.hook,
    });

    // ── Phase 3: 分镜解说文案撰写 ────────────────────────────────
    notify('writing_commentary', 58, '正在根据时间轴撰写场景解说词与视听标注...');
    const targetDuration = context.targetDurationSec || context.videoDurationSec || 120;
    const commentaryDraft = await this.writerAgent.writeCommentary(
      deconstructed,
      targetDuration,
      context.styleMode
    );
    if (signal?.aborted) throw new Error('Workflow aborted during commentary writing');

    notify('writing_commentary', 82, '分镜配音文案初稿生成完毕');

    // ── Phase 4: 时间轴对齐与 AST 编译 ───────────────────────────
    notify('aligning', 88, '正在进行声画时间轴连续性校验与 AST 语法树对齐...');
    const finalScreenplay = this.alignerAgent.align(
      context,
      deconstructed,
      hookResult,
      commentaryDraft
    );

    notify('completed', 100, '视听剧本编排全流程完成！', finalScreenplay);
    logger.info('DramaWorkflowCoordinator successfully generated ScreenplayIR', {
      projectId: finalScreenplay.projectId,
      beatsCount: finalScreenplay.sceneBeats.length,
      duration: finalScreenplay.totalEstimatedDurationSec,
    });

    return finalScreenplay;
  }

  /**
   * 卡片级单镜头 AI 改写
   */
  public async rewriteBeat(
    screenplay: DramaScreenplayIR,
    beatId: string,
    options: Omit<RewriteBeatOptions, 'currentBeat'>
  ): Promise<DramaScreenplayIR> {
    const targetBeat = screenplay.sceneBeats.find(b => b.id === beatId);
    if (!targetBeat) {
      throw new Error(`Scene beat with ID ${beatId} not found in screenplay`);
    }

    const updatedBeat = await this.writerAgent.rewriteBeat({
      ...options,
      currentBeat: targetBeat,
      contextSynopsis: options.contextSynopsis || screenplay.synopsis,
    });

    const updatedBeats = screenplay.sceneBeats.map(b =>
      b.id === beatId ? updatedBeat : b
    );

    return {
      ...screenplay,
      sceneBeats: updatedBeats,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * 黄金 3 秒开场词重新提炼
   */
  public async rewriteHook(
    screenplay: DramaScreenplayIR,
    options: Omit<RewriteHookOptions, 'currentHook' | 'synopsis'>
  ): Promise<DramaScreenplayIR> {
    const updatedHook = await this.hookAgent.rewriteHook({
      ...options,
      currentHook: screenplay.hook,
      synopsis: screenplay.synopsis,
    });

    return {
      ...screenplay,
      hook: updatedHook,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * 批量更新单个镜头数据
   */
  public updateBeat(
    screenplay: DramaScreenplayIR,
    beatId: string,
    patch: Partial<ScreenplaySceneBeat>
  ): DramaScreenplayIR {
    const updatedBeats = screenplay.sceneBeats.map(b => {
      if (b.id !== beatId) return b;
      return { ...b, ...patch };
    });

    return {
      ...screenplay,
      sceneBeats: updatedBeats,
      updatedAt: new Date().toISOString(),
    };
  }
}

export const dramaWorkflowCoordinator = new DramaWorkflowCoordinator();
