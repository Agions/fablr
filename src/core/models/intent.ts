/**
 * Intent — 创作意图（v3 新增 · Stage 12.1）
 *
 * 设计原则：
 * - 显式抽象「用户想做哪种解说」，驱动 L0-L2 各阶段的策略选择
 *   （如 short-drama 偏钩子+反转，movie-review 偏深度分析）。
 * - 替代 v2 隐式的「5 种 ScriptStylePreset」风格枚举：v3 把风格
 *   收敛到 IntentConfig.toneIntensity 一个 0.0-1.0 维度，不再是离散枚举。
 * - 数据流：用户在 workspace/pick-intent.tsx 选 intent → 写入 Project.intent
 *   → 流水线各 step 读取 project.intent 调整 prompt / 段落数 / 风格。
 *
 * v3 仅实现 zh-CN（中文）；en-US / ja-JP 留 enum 占位，前端 v3.1 补 UI。
 */

import type { ScriptStylePreset } from '@/types/script';

/** 内容意图（v3 枚举） */
export type ContentIntent =
  | 'movie-review' // 电影解说：深度分析 + 剧情梳理
  | 'short-drama' // 短剧解说：钩子 + 反转 + 吐槽
  | 'comic-drama' // 漫剧解说：v3 数据层预留，UI v3.1 补
  | 'episode-recap' // 剧集回顾：按集
  | 'voice-over' // 纯配音：v3 数据层预留，UI v3.1 补
  | 'highlight' // 高光集锦：复用 v2 剪辑模式能力
  | 'auto'; // AI 自动判断（基于视频元数据）

/** 支持的语言（v3 仅 zh-CN，其余占位） */
export type IntentLanguage = 'zh-CN' | 'en-US' | 'ja-JP';

/** 目标受众 */
export type IntentAudience = 'general' | 'professional' | 'young';

/** 意图配置（写入 Project.intent） */
export interface IntentConfig {
  intent: ContentIntent;
  /** 目标解说时长（秒）。短剧 60-180，电影 180-600，episode-recap 180-300。 */
  targetDurationSecs: number;
  language: IntentLanguage;
  audience: IntentAudience;
  /** 语气强度：0 = 克制，1 = 强烈（替代 v2 离散风格枚举） */
  toneIntensity: number;
  /** 可选：v2 风格预设映射（保留向后兼容字段，v3.1 移除） */
  legacyStyle?: ScriptStylePreset;
}

// ─── 常量 ──────────────────────────────────────────────────

/** 默认配置（普通解说 · 中文 · 通用受众 · 中性语气） */
export const DEFAULT_INTENT_CONFIG: IntentConfig = {
  intent: 'short-drama',
  targetDurationSecs: 180,
  language: 'zh-CN',
  audience: 'general',
  toneIntensity: 0.5,
};

/** 各意图的默认目标时长（秒） */
export const DEFAULT_DURATION_BY_INTENT: Record<ContentIntent, number> = {
  'movie-review': 300,
  'short-drama': 120,
  'comic-drama': 120,
  'episode-recap': 240,
  'voice-over': 60,
  highlight: 60,
  auto: 180,
};

// ─── 纯函数 ──────────────────────────────────────────────

/** 校验意图字符串是否合法 */
export function isValidIntent(s: string): s is ContentIntent {
  return [
    'movie-review',
    'short-drama',
    'comic-drama',
    'episode-recap',
    'voice-over',
    'highlight',
    'auto',
  ].includes(s);
}

/** 根据 intent 推导默认 IntentConfig（其余字段为默认） */
export function intentDefaultConfig(intent: ContentIntent): IntentConfig {
  return {
    ...DEFAULT_INTENT_CONFIG,
    intent,
    targetDurationSecs: DEFAULT_DURATION_BY_INTENT[intent],
  };
}

/** toneIntensity 0-1 转 5 档风格枚举（兼容 v2 ScriptStylePreset） */
export function intensityToStyle(intensity: number): ScriptStylePreset {
  if (intensity < 0.2) return 'serious';
  if (intensity < 0.4) return 'conversational';
  if (intensity < 0.6) return 'warm';
  if (intensity < 0.8) return 'humorous';
  return 'suspense';
}
