/**
 * core/services/ai/agents/types.ts
 *
 * 4-Agent 协同编排与工作流类型定义：
 * - DramaDeconstructAgent
 * - HookCraftAgent
 * - CommentaryWriterAgent
 * - StoryboardAlignerAgent
 * - DramaWorkflowCoordinator
 */

import type {
  DramaCharacter,
  DramaPlotBeat,
  DramaHook,
  ScreenplaySceneBeat,
  DramaScreenplayIR,
} from '@/core/models/screenplay-ast';

export type WorkflowPhase =
  | 'idle'
  | 'deconstructing'
  | 'crafting_hook'
  | 'writing_commentary'
  | 'aligning'
  | 'completed'
  | 'failed';

export interface WorkflowProgressEvent {
  phase: WorkflowPhase;
  progressPercent: number; // 0 - 100
  message: string;
  partialOutput?: Partial<DramaScreenplayIR>;
}

export type WorkflowProgressCallback = (event: WorkflowProgressEvent) => void;

export interface AgentExecutionContext {
  projectId: string;
  projectTitle: string;
  videoDurationSec: number;
  styleMode?: string; // e.g. "suspense", "fast_paced", "humorous", "standard"
  rawTranscriptionText?: string;
  sceneSummaryHints?: string[];
  targetDurationSec?: number;
}

export interface DeconstructResult {
  title: string;
  synopsis: string;
  characters: DramaCharacter[];
  plotBeats: DramaPlotBeat[];
}

export interface HookCraftResult {
  hook: DramaHook;
}

export interface CommentaryDraft {
  sceneBeats: Omit<ScreenplaySceneBeat, 'id'>[];
}

export interface RewriteBeatOptions {
  currentBeat: ScreenplaySceneBeat;
  instruction: string;
  contextSynopsis?: string;
  targetEmotion?: ScreenplaySceneBeat['emotion'];
}

export interface RewriteHookOptions {
  currentHook: DramaHook;
  synopsis: string;
  hookType?: DramaHook['hookType'];
  styleMode?: string;
}
