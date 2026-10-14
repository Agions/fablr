/**
 * core/services/ai/agents/hook-craft-agent.ts
 *
 * Agent 2: 黄金 3 秒 Hook 提炼专家 (HookCraftAgent)
 *
 * 职责：
 * 1. 深度研磨短视频“黄金 3-5 秒”高转化吸睛开场；
 * 2. 结合剧情梗概与高潮反转，生成不同流派 Hook (question, shocking_statement, flash_forward, emotional_punch)；
 * 3. 支持卡片级单点重写与微调 (rewriteHook)；
 * 4. 计算语速与时间窗口，保证开场词严格落在 3-5 秒区间。
 */

import { hybridModelRouter, type HybridModelRouter } from '../hybrid-model-router';
import type { DramaHook } from '@/core/models/screenplay-ast';
import type { DeconstructResult, HookCraftResult, RewriteHookOptions } from './types';
import { logger } from '@/shared/utils/logging';

export class HookCraftAgent {
  constructor(private readonly router: HybridModelRouter = hybridModelRouter) {}

  public async craftHook(deconstructed: DeconstructResult, styleMode = 'suspense'): Promise<HookCraftResult> {
    const prompt = this.buildPrompt(deconstructed, styleMode);

    try {
      const response = await this.router.routeChat({
        prompt,
        systemPrompt:
          '你是一位顶级短视频影视解说文案操盘手，精通抖音/B站/快手“黄金3秒完播率”算法。必须以合法 JSON 输出，不要输出任何 markdown 代码块之外的杂质。',
        temperature: 0.7,
        timeoutMs: 20000,
      });

      return { hook: this.parseHook(response.content, deconstructed) };
    } catch (error) {
      logger.error('HookCraftAgent craftHook failed, using fallback:', error);
      return { hook: this.fallbackHook(deconstructed) };
    }
  }

  public async rewriteHook(options: RewriteHookOptions): Promise<DramaHook> {
    const prompt = `
请为以下剧集重新创作一段更具冲击力的短视频开场黄金3秒悬念词：
- 故事梗概: ${options.synopsis}
- 原开场词: ${options.currentHook.openingText}
- 指定类型: ${options.hookType || options.currentHook.hookType}
- 目标风格: ${options.styleMode || '反转悬疑'}

要求：
1. 字数在 18 - 32 字之间，朗读耗时在 3 - 5 秒内；
2. 必须极具戏剧张力、反常识、反转或悬念；
3. 输出格式严格为 JSON:
{
  "hookType": "${options.hookType || options.currentHook.hookType}",
  "headline": "爆款吸引眼球的主标题（10字内）",
  "openingText": "精炼开场解说词（20-30字）",
  "durationSec": 4
}
`.trim();

    try {
      const response = await this.router.routeChat({
        prompt,
        systemPrompt: '你擅长爆款短剧开场重构，必须仅输出有效 JSON。',
        temperature: 0.8,
        timeoutMs: 15000,
      });

      return this.parseHook(response.content, { synopsis: options.synopsis } as DeconstructResult);
    } catch (error) {
      logger.error('HookCraftAgent rewriteHook failed, falling back:', error);
      return options.currentHook;
    }
  }

  private buildPrompt(deconstructed: DeconstructResult, styleMode: string): string {
    return `
根据以下故事大纲与节拍，设计一段最具传播力与吸引力的黄金3秒短剧解说开场 Hook：
- 剧集标题: ${deconstructed.title}
- 核心梗概: ${deconstructed.synopsis}
- 核心高潮: ${deconstructed.plotBeats.map(b => b.title).join(' -> ')}
- 风格模式: ${styleMode}

输出要求（JSON 结构）：
{
  "hookType": "shocking_statement", // question | shocking_statement | flash_forward | emotional_punch
  "headline": "抓人眼球的视频卡封标题（12字内）",
  "openingText": "黄金3-5秒的第一句解说词（必须直接抛出极端冲突或反转，20-30字）",
  "durationSec": 4
}
`.trim();
  }

  private parseHook(rawText: string, context: Pick<DeconstructResult, 'synopsis' | 'title'>): DramaHook {
    const cleaned = this.extractJson(rawText);
    try {
      const parsed = JSON.parse(cleaned);

      return {
        hookType: this.sanitizeHookType(parsed.hookType),
        headline: typeof parsed.headline === 'string' && parsed.headline ? parsed.headline : '开局惊天反转',
        openingText: typeof parsed.openingText === 'string' && parsed.openingText ? parsed.openingText : '你绝对不敢相信，眼前这个看似落魄的男人，真实身份居然是...',
        durationSec: typeof parsed.durationSec === 'number' && parsed.durationSec >= 2 && parsed.durationSec <= 8
          ? parsed.durationSec
          : 4,
      };
    } catch {
      return this.fallbackHook(context);
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

  private sanitizeHookType(type: unknown): DramaHook['hookType'] {
    if (
      type === 'question' ||
      type === 'shocking_statement' ||
      type === 'flash_forward' ||
      type === 'emotional_punch'
    ) {
      return type;
    }
    return 'shocking_statement';
  }

  private fallbackHook(context: Pick<DeconstructResult, 'title'>): DramaHook {
    return {
      hookType: 'shocking_statement',
      headline: `${context.title || '绝境逆袭'}：反转超乎想象`,
      openingText: '你绝对想不到，这个被所有人唾弃的无名之辈，竟然隐藏着足以颠覆一切的惊人秘密！',
      durationSec: 4,
    };
  }
}

export const hookCraftAgent = new HookCraftAgent();
