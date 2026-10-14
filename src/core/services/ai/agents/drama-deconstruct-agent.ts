/**
 * core/services/ai/agents/drama-deconstruct-agent.ts
 *
 * Agent 1: 剧情解构专家 (DramaDeconstructAgent)
 *
 * 职责：
 * 1. 深度分析长视频/短剧文本、字幕或画面线索；
 * 2. 提取故事一句话大纲 (synopsis)、关键出场人物角色画像 (characters)；
 * 3. 划分结构化核心剧情节拍 (plotBeats)，标注冲突类型与紧张度分值；
 * 4. 驱动 HybridModelRouter 执行端侧/云端混合推理并校验输出。
 */

import { hybridModelRouter, type HybridModelRouter } from '../hybrid-model-router';
import type { AgentExecutionContext, DeconstructResult } from './types';
import { logger } from '@/shared/utils/logging';

export class DramaDeconstructAgent {
  constructor(private readonly router: HybridModelRouter = hybridModelRouter) {}

  public async deconstruct(context: AgentExecutionContext): Promise<DeconstructResult> {
    const prompt = this.buildPrompt(context);

    try {
      const response = await this.router.routeChat({
        prompt,
        systemPrompt:
          '你是一位资深影视/短剧编剧与分镜解构总监。你的任务是将输入的音视频字幕与剧情信息结构化提炼为故事梗概、人物画像与关键情节节拍。必须严格以合法 JSON 格式输出，不要包含任何 markdown 代码块外部的说明文字。',
        temperature: 0.6,
        timeoutMs: 30000,
      });

      return this.parseResponse(response.content, context);
    } catch (error) {
      logger.error('DramaDeconstructAgent execution failed, using fallback deconstruction:', error);
      return this.fallbackResult(context);
    }
  }

  private buildPrompt(context: AgentExecutionContext): string {
    const transcriptSnippet = context.rawTranscriptionText
      ? context.rawTranscriptionText.slice(0, 3000)
      : '（暂无字幕文本，根据场景标题与时长推断）';

    return `
请对以下剧目进行结构化解构：
- 项目标题: ${context.projectTitle}
- 视频总时长: ${context.videoDurationSec} 秒
- 风格模式: ${context.styleMode || 'standard'}
- 原文字幕/线索内容:
${transcriptSnippet}

输出要求（JSON 结构）：
{
  "title": "精炼提炼后的剧集/短片主标题",
  "synopsis": "100-200字的故事核心梗概与反转焦点",
  "characters": [
    {
      "id": "char-1",
      "name": "主角姓名/称谓",
      "role": "protagonist", // protagonist | antagonist | supporting | narrator
      "description": "人物性格与身份特征",
      "emotionalArc": "情感或动机演变路线"
    }
  ],
  "plotBeats": [
    {
      "id": "beat-1",
      "sceneIndex": 0,
      "timeRange": [0, 30],
      "title": "开场冲突/异常事件",
      "conflictType": "setup", // twist | climax | revelation | setup | suspense
      "intensity": 7, // 1-10
      "summary": "该场景的核心情节说明"
    }
  ]
}
`.trim();
  }

  private parseResponse(rawText: string, context: AgentExecutionContext): DeconstructResult {
    const cleaned = this.extractJson(rawText);
    try {
      const parsed = JSON.parse(cleaned);

      return {
        title: typeof parsed.title === 'string' && parsed.title ? parsed.title : context.projectTitle,
        synopsis: typeof parsed.synopsis === 'string' && parsed.synopsis ? parsed.synopsis : '故事围绕意外转折展开。',
        characters: Array.isArray(parsed.characters) && parsed.characters.length > 0
          ? parsed.characters.map((c: Record<string, unknown>, idx: number) => ({
              id: typeof c.id === 'string' ? c.id : `char-${idx + 1}`,
              name: typeof c.name === 'string' ? c.name : `角色 ${idx + 1}`,
              role: this.sanitizeRole(c.role),
              description: typeof c.description === 'string' ? c.description : '',
              emotionalArc: typeof c.emotionalArc === 'string' ? c.emotionalArc : '',
            }))
          : this.fallbackResult(context).characters,
        plotBeats: Array.isArray(parsed.plotBeats) && parsed.plotBeats.length > 0
          ? parsed.plotBeats.map((b: Record<string, unknown>, idx: number) => ({
              id: typeof b.id === 'string' ? b.id : `beat-${idx + 1}`,
              sceneIndex: typeof b.sceneIndex === 'number' ? b.sceneIndex : idx,
              timeRange: Array.isArray(b.timeRange) && b.timeRange.length === 2
                ? [Number(b.timeRange[0]), Number(b.timeRange[1])] as [number, number]
                : [idx * 30, (idx + 1) * 30] as [number, number],
              title: typeof b.title === 'string' ? b.title : `情节节拍 ${idx + 1}`,
              conflictType: this.sanitizeConflictType(b.conflictType),
              intensity: typeof b.intensity === 'number' ? Math.min(10, Math.max(1, b.intensity)) : 5,
              summary: typeof b.summary === 'string' ? b.summary : '',
            }))
          : this.fallbackResult(context).plotBeats,
      };
    } catch {
      return this.fallbackResult(context);
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

  private sanitizeRole(role: unknown): 'protagonist' | 'antagonist' | 'supporting' | 'narrator' {
    if (role === 'protagonist' || role === 'antagonist' || role === 'supporting' || role === 'narrator') {
      return role;
    }
    return 'protagonist';
  }

  private sanitizeConflictType(type: unknown): 'twist' | 'climax' | 'revelation' | 'setup' | 'suspense' {
    if (type === 'twist' || type === 'climax' || type === 'revelation' || type === 'setup' || type === 'suspense') {
      return type;
    }
    return 'setup';
  }

  private fallbackResult(context: AgentExecutionContext): DeconstructResult {
    const duration = Math.max(context.videoDurationSec, 60);
    const half = Math.floor(duration / 2);

    return {
      title: context.projectTitle || '短剧解说',
      synopsis: '主角意外卷入重大抉择，在多方博弈中迎来惊险反转。',
      characters: [
        {
          id: 'char-1',
          name: '主角',
          role: 'protagonist',
          description: '身处逆境但机敏果决的核心主角',
          emotionalArc: '从隐忍压抑到果断反击',
        },
      ],
      plotBeats: [
        {
          id: 'beat-1',
          sceneIndex: 0,
          timeRange: [0, half],
          title: '危机潜伏与开端',
          conflictType: 'setup',
          intensity: 6,
          summary: '事件开端展现不同寻常的异常现象与潜在矛盾。',
        },
        {
          id: 'beat-2',
          sceneIndex: 1,
          timeRange: [half, duration],
          title: '高潮冲突与结局反转',
          conflictType: 'climax',
          intensity: 9,
          summary: '矛盾集中爆发，真相浮出水面。',
        },
      ],
    };
  }
}

export const dramaDeconstructAgent = new DramaDeconstructAgent();
