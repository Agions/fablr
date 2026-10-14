/**
 * core/services/ai/agents/storyboard-aligner-agent.ts
 *
 * Agent 4: 分镜对齐与编译专家 (StoryboardAlignerAgent)
 *
 * 职责：
 * 1. 汇总解构 (Deconstruct)、Hook 以及文案 (Commentary) 结果；
 * 2. 分配持久化唯一 ID (UUID/beat-id)，校准时码 (timecode)；
 * 3. 调用 alignSceneBeats 确保相邻分镜时间轴连续无缝隙或重叠；
 * 4. 统计预估朗读总时长，执行 validateScreenplayIR 严格合规校验；
 * 5. 编译输出系统单一真相源 DramaScreenplayIR。
 */

import type {
  DramaScreenplayIR,
  ScreenplaySceneBeat,
} from '@/core/models/screenplay-ast';
import {
  alignSceneBeats,
  formatSecToTimecode,
  validateScreenplayIR,
} from '@/core/models/screenplay-ast';
import type {
  AgentExecutionContext,
  CommentaryDraft,
  DeconstructResult,
  HookCraftResult,
} from './types';
import { logger } from '@/shared/utils/logging';

export class StoryboardAlignerAgent {
  public align(
    context: AgentExecutionContext,
    deconstructed: DeconstructResult,
    hookResult: HookCraftResult,
    commentaryDraft: CommentaryDraft
  ): DramaScreenplayIR {
    const rawBeats: ScreenplaySceneBeat[] = commentaryDraft.sceneBeats.map((draft, idx) => {
      const beatId = `beat-${context.projectId}-${idx + 1}`;
      const start = Math.max(0, draft.startTimeSec);
      const end = draft.endTimeSec > start ? draft.endTimeSec : start + 10;

      return {
        ...draft,
        id: beatId,
        sceneIndex: idx,
        startTimeSec: start,
        endTimeSec: end,
        timecode: `${formatSecToTimecode(start)} - ${formatSecToTimecode(end)}`,
      };
    });

    // 运行时间轴连续性对齐算法
    const alignResult = alignSceneBeats(rawBeats);
    const alignedBeats = alignResult.beats;

    // 计算分镜整体预估时长（加上开场 Hook 时长）
    const totalEstSec = alignResult.totalDurationSec + (hookResult.hook.durationSec || 4);

    const screenplay: DramaScreenplayIR = {
      projectId: context.projectId,
      title: deconstructed.title || context.projectTitle,
      styleMode: context.styleMode || 'standard',
      synopsis: deconstructed.synopsis,
      characters: deconstructed.characters,
      plotBeats: deconstructed.plotBeats,
      hook: hookResult.hook,
      sceneBeats: alignedBeats,
      totalEstimatedDurationSec: Math.round(totalEstSec),
      generatedAt: new Date().toISOString(),
      modelVersion: 'hybrid-v3',
    };

    const isValid = validateScreenplayIR(screenplay);
    if (!isValid) {
      logger.warn('ScreenplayIR generated with validation failure');
    }

    return screenplay;
  }
}

export const storyboardAlignerAgent = new StoryboardAlignerAgent();
