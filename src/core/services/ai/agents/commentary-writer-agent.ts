/**
 * core/services/ai/agents/commentary-writer-agent.ts
 *
 * Agent 3: 分镜解说文案大师 (CommentaryWriterAgent)
 *
 * 职责：
 * 1. 依据剧情节拍与时间轴区间，为每个场景撰写精炼、富有视听节奏的解说配音词；
 * 2. 自动根据画面时长计算字数上下限（通常中文解说语速为 3.5 - 4.5 字/秒）；
 * 3. 标注镜头机位提示 (shotType)、情绪 (emotion)、音效建议 (soundFx) 与配乐建议 (bgmSuggestion)；
 * 4. 支持卡片级单镜头 AI 重写微调 (rewriteBeat)。
 */

import { hybridModelRouter, type HybridModelRouter } from '../hybrid-model-router';
import type {
  ScreenplayEmotion,
  ScreenplaySceneBeat,
  ScreenplayShotType,
} from '@/core/models/screenplay-ast';
import { formatSecToTimecode } from '@/core/models/screenplay-ast';
import type { CommentaryDraft, DeconstructResult, RewriteBeatOptions } from './types';
import { logger } from '@/shared/utils/logging';

export class CommentaryWriterAgent {
  constructor(private readonly router: HybridModelRouter = hybridModelRouter) {}

  public async writeCommentary(
    deconstructed: DeconstructResult,
    targetDurationSec: number,
    styleMode = 'standard'
  ): Promise<CommentaryDraft> {
    const prompt = this.buildPrompt(deconstructed, targetDurationSec, styleMode);

    try {
      const response = await this.router.routeChat({
        prompt,
        systemPrompt:
          '你是一位擅长影视解说与快节奏剪辑的王牌文案总监。你的解说词声画呼应、通俗抓人、节奏紧凑，严禁多余废话。必须以合法 JSON 格式输出，不要输出任何 markdown 代码块外部的说明文字。',
        temperature: 0.65,
        timeoutMs: 35000,
      });

      return this.parseCommentary(response.content, deconstructed, targetDurationSec);
    } catch (error) {
      logger.error('CommentaryWriterAgent writeCommentary failed, using fallback:', error);
      return this.fallbackCommentary(deconstructed, targetDurationSec);
    }
  }

  public async rewriteBeat(options: RewriteBeatOptions): Promise<ScreenplaySceneBeat> {
    const duration = Math.max(2, options.currentBeat.endTimeSec - options.currentBeat.startTimeSec);
    const maxChars = Math.round(duration * 4.2);

    const prompt = `
请按照用户的要求，针对以下单个分镜卡片重新撰写解说文案与镜头标注：
- 当前解说词: "${options.currentBeat.voiceoverText}"
- 当前画面描述: "${options.currentBeat.visualCue}"
- 当前镜头类型: ${options.currentBeat.shotType}
- 当前情绪: ${options.currentBeat.emotion}
- 镜头时长: ${duration} 秒（建议解说词字数在 ${Math.floor(duration * 3)} - ${maxChars} 字以内）
- 背景故事梗概: ${options.contextSynopsis || '无'}
- 用户改写指令: ${options.instruction}
${options.targetEmotion ? `- 目标指定情绪: ${options.targetEmotion}` : ''}

输出要求（JSON 结构）：
{
  "visualCue": "精简画面核心事件",
  "shotType": "${options.currentBeat.shotType}", // CU | MS | LS | PAN | ACTION
  "voiceoverText": "重新撰写的配音台词",
  "emotion": "${options.targetEmotion || options.currentBeat.emotion}", // tense | humorous | dramatic | suspenseful | neutral | heartfelt
  "soundFx": "环境音或转场音效提示",
  "bgmSuggestion": "背景音乐情绪建议"
}
`.trim();

    try {
      const response = await this.router.routeChat({
        prompt,
        systemPrompt: '你是一位精通微调短视频分镜台词的 AI 导演，严格按 JSON 格式返回。',
        temperature: 0.7,
        timeoutMs: 15000,
      });

      const cleaned = this.extractJson(response.content);
      const parsed = JSON.parse(cleaned);

      return {
        ...options.currentBeat,
        visualCue: typeof parsed.visualCue === 'string' && parsed.visualCue ? parsed.visualCue : options.currentBeat.visualCue,
        shotType: this.sanitizeShotType(parsed.shotType),
        voiceoverText: typeof parsed.voiceoverText === 'string' && parsed.voiceoverText ? parsed.voiceoverText : options.currentBeat.voiceoverText,
        emotion: this.sanitizeEmotion(parsed.emotion),
        soundFx: typeof parsed.soundFx === 'string' ? parsed.soundFx : options.currentBeat.soundFx,
        bgmSuggestion: typeof parsed.bgmSuggestion === 'string' ? parsed.bgmSuggestion : options.currentBeat.bgmSuggestion,
      };
    } catch (error) {
      logger.error('CommentaryWriterAgent rewriteBeat failed, returning original:', error);
      return options.currentBeat;
    }
  }

  private buildPrompt(
    deconstructed: DeconstructResult,
    targetDurationSec: number,
    styleMode: string
  ): string {
    const beatsDesc = deconstructed.plotBeats
      .map(
        b =>
          `[节拍 ${b.sceneIndex + 1}] (${b.timeRange[0]}s - ${b.timeRange[1]}s) ${b.title}: ${b.summary}`
      )
      .join('\n');

    return `
请为以下剧集节拍编写完整的分镜解说台词与视听标注：
- 剧名: ${deconstructed.title}
- 核心大纲: ${deconstructed.synopsis}
- 总目标时长: ${targetDurationSec} 秒
- 风格模式: ${styleMode}
- 剧情节拍序列:
${beatsDesc}

输出要求（JSON 结构，返回 sceneBeats 数组）：
{
  "sceneBeats": [
    {
      "sceneIndex": 0,
      "startTimeSec": 0,
      "endTimeSec": 15,
      "visualCue": "画面呈现的具体人物动作与冲突画面",
      "shotType": "CU", // CU(特写) | MS(中景) | LS(全景) | PAN(摇移) | ACTION(动作)
      "voiceoverText": "对应该时间区间的朗读解说台词，注意字数语速配合（约 3.8 字/秒）",
      "emotion": "suspenseful", // tense | humorous | dramatic | suspenseful | neutral | heartfelt
      "soundFx": "急促心跳声/雷声",
      "bgmSuggestion": "低沉压抑弦乐"
    }
  ]
}
`.trim();
  }

  private parseCommentary(
    rawText: string,
    deconstructed: DeconstructResult,
    targetDurationSec: number
  ): CommentaryDraft {
    const cleaned = this.extractJson(rawText);
    try {
      const parsed = JSON.parse(cleaned);

      if (Array.isArray(parsed.sceneBeats) && parsed.sceneBeats.length > 0) {
        const beats: Omit<ScreenplaySceneBeat, 'id'>[] = parsed.sceneBeats.map(
          (b: Record<string, unknown>, idx: number) => {
            const start = typeof b.startTimeSec === 'number' ? Math.max(0, b.startTimeSec) : idx * 15;
            const end = typeof b.endTimeSec === 'number' && b.endTimeSec > start ? b.endTimeSec : start + 15;
            return {
              sceneIndex: typeof b.sceneIndex === 'number' ? b.sceneIndex : idx,
              startTimeSec: start,
              endTimeSec: end,
              timecode: `${formatSecToTimecode(start)} - ${formatSecToTimecode(end)}`,
              visualCue: typeof b.visualCue === 'string' ? b.visualCue : `场景 ${idx + 1} 画面`,
              shotType: this.sanitizeShotType(b.shotType),
              voiceoverText: typeof b.voiceoverText === 'string' ? b.voiceoverText : '主角在这个瞬间迎来了命运的抉择。',
              emotion: this.sanitizeEmotion(b.emotion),
              soundFx: typeof b.soundFx === 'string' ? b.soundFx : undefined,
              bgmSuggestion: typeof b.bgmSuggestion === 'string' ? b.bgmSuggestion : undefined,
            };
          }
        );
        return { sceneBeats: beats };
      }
      return this.fallbackCommentary(deconstructed, targetDurationSec);
    } catch {
      return this.fallbackCommentary(deconstructed, targetDurationSec);
    }
  }

  private extractJson(text: string): string {
    const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch && jsonBlockMatch[1]) {
      return jsonBlockMatch[1].trim();
    }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return text.slice(firstBrace, lastBrace + 1).trim();
    }
    return text.trim();
  }

  private sanitizeShotType(shot: unknown): ScreenplayShotType {
    if (shot === 'CU' || shot === 'MS' || shot === 'LS' || shot === 'PAN' || shot === 'ACTION') {
      return shot;
    }
    return 'MS';
  }

  private sanitizeEmotion(emotion: unknown): ScreenplayEmotion {
    if (
      emotion === 'tense' ||
      emotion === 'humorous' ||
      emotion === 'dramatic' ||
      emotion === 'suspenseful' ||
      emotion === 'neutral' ||
      emotion === 'heartfelt'
    ) {
      return emotion;
    }
    return 'dramatic';
  }

  private fallbackCommentary(
    deconstructed: DeconstructResult,
    targetDurationSec: number
  ): CommentaryDraft {
    const beatsCount = Math.max(deconstructed.plotBeats.length, 2);
    const step = Math.floor(targetDurationSec / beatsCount) || 15;

    const fallbackBeats: Omit<ScreenplaySceneBeat, 'id'>[] = [];
    for (let i = 0; i < beatsCount; i++) {
      const start = i * step;
      const end = i === beatsCount - 1 ? targetDurationSec : (i + 1) * step;
      const plot = deconstructed.plotBeats[i];

      fallbackBeats.push({
        sceneIndex: i,
        startTimeSec: start,
        endTimeSec: end,
        timecode: `${formatSecToTimecode(start)} - ${formatSecToTimecode(end)}`,
        visualCue: plot ? `${plot.title}：${plot.summary}` : `场景 ${i + 1} 画面`,
        shotType: i === 0 ? 'CU' : i % 2 === 0 ? 'MS' : 'ACTION',
        voiceoverText: plot
          ? `这一刻，${plot.summary}`
          : `随着局势升级，更加不可思议的冲突接踵而至。`,
        emotion: i === 0 ? 'suspenseful' : 'dramatic',
        bgmSuggestion: i === 0 ? '悬疑铺垫' : '高潮激昂',
      });
    }

    return { sceneBeats: fallbackBeats };
  }
}

export const commentaryWriterAgent = new CommentaryWriterAgent();
