/**
 * stores/screenplay-store.ts
 *
 * 视听剧本与多智能体分镜状态机 (Screenplay & Multi-Agent Storyboard Store)
 *
 * 职责：
 * 1. 响应式管理 DramaScreenplayIR 抽象语法树与分镜列表；
 * 2. 调度 DramaWorkflowCoordinator 执行 4-Agent 自动化研磨管线并流式派发进度；
 * 3. 驱动卡片级局部改写 (rewriteCardBeat) 与 Hook 重新提炼 (rewriteStoryHook)；
 * 4. 提供撤销/重做快照栈，支持创作者无损探索不同剧本分支。
 */

import { create } from 'zustand';
import type {
  DramaHook,
  DramaScreenplayIR,
  ScreenplayEmotion,
  ScreenplaySceneBeat,
} from '@/core/models/screenplay-ast';
import { dramaWorkflowCoordinator } from '@/core/services/ai/agents/drama-workflow-coordinator';
import type {
  AgentExecutionContext,
  WorkflowPhase,
  WorkflowProgressEvent,
} from '@/core/services/ai/agents/types';
import { logger } from '@/shared/utils/logging';

export interface ScreenplayState {
  /** 当前剧本单一事实来源 */
  screenplay: DramaScreenplayIR | null;

  /** 4-Agent 协同工作流当前执行阶段 */
  workflowPhase: WorkflowPhase;

  /** 执行进度 (0 - 100) */
  progressPercent: number;

  /** 状态提示文案 */
  progressMessage: string;

  /** 是否处于全流程生成中 */
  isGenerating: boolean;

  /** 当前高亮或正在编辑的分镜卡片 ID */
  activeBeatId: string | null;

  /** 是否正在执行卡片级局部改写 */
  isRewritingBeat: boolean;

  /** 是否正在执行黄金 Hook 重新提炼 */
  isRewritingHook: boolean;

  /** 错误信息 */
  lastError: string | null;

  /** 历史快照栈 (用于撤销/重做) */
  history: DramaScreenplayIR[];
  historyIndex: number;

  // ── Actions ──────────────────────────────────────────────────
  /** 启动 4-Agent 自动化研磨管线 */
  startWorkflow: (context: AgentExecutionContext) => Promise<DramaScreenplayIR | null>;

  /** 中止当前工作流 */
  cancelWorkflow: () => void;

  /** 重设/直设 Screenplay */
  setScreenplay: (ir: DramaScreenplayIR | null) => void;

  /** 选中高亮的分镜卡片 */
  setActiveBeatId: (beatId: string | null) => void;

  /** 卡片级 AI 改写单分镜 */
  rewriteCardBeat: (
    beatId: string,
    instruction: string,
    emotion?: ScreenplayEmotion
  ) => Promise<boolean>;

  /** 重新提炼黄金 3 秒 Hook */
  rewriteStoryHook: (
    hookType?: DramaHook['hookType'],
    styleMode?: string
  ) => Promise<boolean>;

  /** 手动修改单个分镜字段 */
  updateSceneBeat: (beatId: string, patch: Partial<ScreenplaySceneBeat>) => void;

  /** 撤销到上一快照 */
  undo: () => void;

  /** 重做到下一快照 */
  redo: () => void;

  /** 重置所有状态 */
  reset: () => void;
}

let activeAbortController: AbortController | null = null;

export const useScreenplayStore = create<ScreenplayState>((set, get) => ({
  screenplay: null,
  workflowPhase: 'idle',
  progressPercent: 0,
  progressMessage: '准备就绪',
  isGenerating: false,
  activeBeatId: null,
  isRewritingBeat: false,
  isRewritingHook: false,
  lastError: null,
  history: [],
  historyIndex: -1,

  startWorkflow: async (context: AgentExecutionContext) => {
    if (activeAbortController) {
      activeAbortController.abort();
    }
    const controller = new AbortController();
    activeAbortController = controller;

    set({
      isGenerating: true,
      lastError: null,
      workflowPhase: 'deconstructing',
      progressPercent: 5,
      progressMessage: '启动 4-Agent 协同编排引擎...',
    });

    try {
      const result = await dramaWorkflowCoordinator.executePipeline(
        context,
        (event: WorkflowProgressEvent) => {
          set({
            workflowPhase: event.phase,
            progressPercent: event.progressPercent,
            progressMessage: event.message,
            ...(event.partialOutput ? { screenplay: { ...(get().screenplay || {}), ...event.partialOutput } as DramaScreenplayIR } : {}),
          });
        },
        controller.signal
      );

      const history = [...get().history.slice(0, get().historyIndex + 1), result];
      set({
        screenplay: result,
        isGenerating: false,
        workflowPhase: 'completed',
        progressPercent: 100,
        progressMessage: '剧本研磨完成',
        activeBeatId: result.sceneBeats[0]?.id || null,
        history,
        historyIndex: history.length - 1,
      });

      return result;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const isAborted = errMsg.includes('aborted');

      logger.warn('Workflow aborted or failed:', { isAborted, error });
      set({
        isGenerating: false,
        workflowPhase: isAborted ? 'idle' : 'failed',
        progressMessage: isAborted ? '工作流已取消' : `生成失败: ${errMsg}`,
        lastError: isAborted ? null : errMsg,
      });
      return null;
    } finally {
      if (activeAbortController === controller) {
        activeAbortController = null;
      }
    }
  },

  cancelWorkflow: () => {
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
    set({
      isGenerating: false,
      workflowPhase: 'idle',
      progressMessage: '已取消生成',
    });
  },

  setScreenplay: (ir: DramaScreenplayIR | null) => {
    if (!ir) {
      set({ screenplay: null, activeBeatId: null, history: [], historyIndex: -1 });
      return;
    }
    const history = [...get().history.slice(0, get().historyIndex + 1), ir];
    set({
      screenplay: ir,
      activeBeatId: ir.sceneBeats[0]?.id || null,
      history,
      historyIndex: history.length - 1,
    });
  },

  setActiveBeatId: (beatId: string | null) => {
    set({ activeBeatId: beatId });
  },

  rewriteCardBeat: async (
    beatId: string,
    instruction: string,
    emotion?: ScreenplayEmotion
  ) => {
    const { screenplay } = get();
    if (!screenplay) return false;

    set({ isRewritingBeat: true, lastError: null });
    try {
      const updatedScreenplay = await dramaWorkflowCoordinator.rewriteBeat(
        screenplay,
        beatId,
        {
          instruction,
          targetEmotion: emotion,
        }
      );

      const history = [...get().history.slice(0, get().historyIndex + 1), updatedScreenplay];
      set({
        screenplay: updatedScreenplay,
        isRewritingBeat: false,
        history,
        historyIndex: history.length - 1,
      });
      return true;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('rewriteCardBeat failed:', error);
      set({ isRewritingBeat: false, lastError: errMsg });
      return false;
    }
  },

  rewriteStoryHook: async (
    hookType?: DramaHook['hookType'],
    styleMode?: string
  ) => {
    const { screenplay } = get();
    if (!screenplay) return false;

    set({ isRewritingHook: true, lastError: null });
    try {
      const updatedScreenplay = await dramaWorkflowCoordinator.rewriteHook(
        screenplay,
        {
          hookType,
          styleMode,
        }
      );

      const history = [...get().history.slice(0, get().historyIndex + 1), updatedScreenplay];
      set({
        screenplay: updatedScreenplay,
        isRewritingHook: false,
        history,
        historyIndex: history.length - 1,
      });
      return true;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('rewriteStoryHook failed:', error);
      set({ isRewritingHook: false, lastError: errMsg });
      return false;
    }
  },

  updateSceneBeat: (beatId: string, patch: Partial<ScreenplaySceneBeat>) => {
    const { screenplay } = get();
    if (!screenplay) return;

    const updatedScreenplay = dramaWorkflowCoordinator.updateBeat(
      screenplay,
      beatId,
      patch
    );

    const history = [...get().history.slice(0, get().historyIndex + 1), updatedScreenplay];
    set({
      screenplay: updatedScreenplay,
      history,
      historyIndex: history.length - 1,
    });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      set({
        screenplay: history[newIndex],
        historyIndex: newIndex,
      });
    }
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      set({
        screenplay: history[newIndex],
        historyIndex: newIndex,
      });
    }
  },

  reset: () => {
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
    set({
      screenplay: null,
      workflowPhase: 'idle',
      progressPercent: 0,
      progressMessage: '准备就绪',
      isGenerating: false,
      activeBeatId: null,
      isRewritingBeat: false,
      isRewritingHook: false,
      lastError: null,
      history: [],
      historyIndex: -1,
    });
  },
}));
