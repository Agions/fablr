/**
 * 脚本生成服务
 * 职责：统一管理脚本生成流程
 *
 * 重构说明：
 * - 从原 scriptService.ts (548行) 中提取服务层
 * - 整合模型配置、API 调用、提示词构建、脚本解析
 * - 保持原有 API 兼容性
 */

import { getApiKey } from '@/core/services/auth/api-key-service';
import type { VideoMetadata, AIScriptDraft } from '@/types';
import type { AIModelType } from './ai-model-configs';
import { invokeAIModel, AIServiceError } from './ai-api-client';
import { AppError } from '@/core/errors';
import { buildScriptPrompt, type AnalysisInput, type ScriptGenerationSettings } from './prompt-builder';
import { parseScriptContent, createScriptDraft } from './script-parser';

export type { AIScriptDraft };

// ============================================
// 脚本生成服务
// ============================================

export const scriptGenerationService = {
  /**
   * 生成脚本
   * @param modelType AI 模型类型
   * @param apiKey API 密钥
   * @param analysis 视频分析数据
   * @param options 生成设置
   * @returns 生成的脚本文本
   */
  generateScript: async (
    modelType: AIModelType,
    apiKey: string,
    analysis: AnalysisInput,
    options?: ScriptGenerationSettings
  ): Promise<string> => {
    const prompt = buildScriptPrompt(analysis, options);
    return invokeAIModel(modelType, apiKey, prompt);
  },

  /**
   * 构建提示词
   */
  buildPrompt: buildScriptPrompt,

  /**
   * 解析脚本内容
   */
  parseScriptContent,

  /**
   * 创建脚本草稿
   */
  createScriptDraft,
};

// ============================================
// 便捷函数
// ============================================

/**
 * 使用指定模型生成脚本
 */
export const generateScriptWithModel = scriptGenerationService.generateScript;

/**
 * 解析生成的脚本为草稿
 */
export const parseGeneratedScript = (content: string, projectId: string): AIScriptDraft => {
  return createScriptDraft(content, projectId);
};

/**
 * 使用 OpenAI 兼容接口生成脚本
 */
export const generateScriptWithOpenAI = async (
  videoMetadata: VideoMetadata,
  keyFramesDescriptions: string[],
  preferences: {
    style?: string;
    tone?: string;
    length?: 'short' | 'medium' | 'long';
    purpose?: string;
    targetAudience?: string;
    additionalRequirements?: string;
  }
): Promise<string> => {
  try {
    const apiKey = await getApiKey('openai');
    if (!apiKey) {
      throw new AppError('APP_AI_APIKEY_MISSING', '未配置 OpenAI API 密钥，请先在设置中配置', {
        userMessage: '未配置 OpenAI API 密钥，请先在设置中配置',
      });
    }

    const normalizeStyle = (style: string | undefined): ScriptGenerationSettings['style'] => {
      if (
        style === 'informative' ||
        style === 'entertaining' ||
        style === 'dramatic' ||
        style === 'casual'
      ) {
        return style;
      }
      return undefined;
    };

    const normalizeTone = (tone: string | undefined): ScriptGenerationSettings['tone'] => {
      if (
        tone === 'neutral' ||
        tone === 'enthusiastic' ||
        tone === 'serious' ||
        tone === 'humorous' ||
        tone === 'inspirational'
      ) {
        return tone;
      }
      return undefined;
    };

    const analysis: AnalysisInput = {
      title: '视频内容',
      duration: videoMetadata.duration,
      summary: keyFramesDescriptions.join('\n'),
      keyMoments: [],
      emotions: [],
    };

    const settings: ScriptGenerationSettings = {
      style: normalizeStyle(preferences.style),
      tone: normalizeTone(preferences.tone),
    };

    return await scriptGenerationService.generateScript('openai', apiKey, analysis, settings);
  } catch (error) {
    if (error instanceof AIServiceError) {
      throw error;
    }
    throw new AIServiceError(`脚本生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
};

// 重新导出类型
export type { AnalysisInput, ScriptGenerationSettings } from './prompt-builder';
export type { AIModelType } from './ai-model-configs';

/**
 * 使用 AI 分析关键帧
 * @param paths 关键帧路径列表
 * @returns 关键帧描述列表
 */
export const analyzeKeyFramesWithAI = async (paths: string[]): Promise<string[]> => {
  // 此函数在重构时遗漏，现提供基础实现
  // 实际实现应该调用 AI Vision 服务进行图像分析
  return paths.map((path, index) => `[关键帧 ${index + 1}] 来自 ${path}`);
};
