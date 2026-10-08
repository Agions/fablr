/**
 * ProductionVoiceConfig — 音色配置（L1 产物）
 *
 * 设计原则：
 * - 收敛旧架构中 VoiceConfig / VoiceSettings / DEFAULT_VOICE_SETTINGS
 *   （workflow.ts）的多处分散定义，成为 Production 的配音配置唯一来源。
 * - 复用 @/types/voice 既有类型（VoiceInfo / TtsBackendName），
 *   本文件只做工程级的配置聚合与纯函数。
 */

import type { VoiceInfo, TtsBackendName } from '@/types/voice';

// ─── 工程级音色配置 ───

export interface ProductionVoiceConfig {
  /** 音色 ID（对应 VoiceInfo.id） */
  voiceId: string;
  /** TTS 后端（edge / azure） */
  backend: TtsBackendName;
  /** 语速倍率（0.5-2.0） */
  speed: number;
  /** 音量（0.0-1.0） */
  volume: number;
  /** 音频格式（mp3 / wav / ogg） */
  format: 'mp3' | 'wav' | 'ogg';
  /** 音色详情快照（选择时记录，用于 UI 展示，避免重复查询） */
  voiceInfo: VoiceInfo | null;
}

// ─── 常量 ──────────────────────────────────────────────────────

/** 默认音色配置（与旧 DEFAULT_VOICE_SETTINGS 对齐） */
export const DEFAULT_PRODUCTION_VOICE_CONFIG: ProductionVoiceConfig = {
  voiceId: 'female_zh',
  backend: 'edge',
  speed: 1.0,
  volume: 0.8,
  format: 'mp3',
  voiceInfo: null,
};

// ─── 工厂与纯函数 ──────────────────────────────────────────────

/** 创建默认音色配置 */
export function createDefaultVoiceConfig(): ProductionVoiceConfig {
  return { ...DEFAULT_PRODUCTION_VOICE_CONFIG };
}

/**
 * 创建带指定音色的配置
 *
 * @param voiceId 音色 ID
 * @param voiceInfo 音色详情（可选）
 * @param overrides 覆盖默认参数（speed/volume/backend/format）
 * @returns 新配置
 */
export function createVoiceConfig(
  voiceId: string,
  voiceInfo?: VoiceInfo | null,
  overrides: Partial<Omit<ProductionVoiceConfig, 'voiceId' | 'voiceInfo'>> = {}
): ProductionVoiceConfig {
  return {
    ...DEFAULT_PRODUCTION_VOICE_CONFIG,
    voiceId,
    voiceInfo: voiceInfo ?? null,
    ...overrides,
  };
}

/**
 * 更新配置项（不可变）
 *
 * @param config 当前配置
 * @param patch 部分更新
 * @returns 新配置
 */
export function withVoiceConfigPatch(
  config: ProductionVoiceConfig,
  patch: Partial<ProductionVoiceConfig>
): ProductionVoiceConfig {
  return { ...config, ...patch };
}

/**
 * 校验语速与音量是否在合法范围
 *
 * @param config 待校验配置
 * @returns 非法项的错误信息；全部合法返回 null
 */
export function validateVoiceConfig(config: ProductionVoiceConfig): string | null {
  if (config.speed < 0.5 || config.speed > 2.0) {
    return `语速 ${config.speed} 超出合法范围 0.5-2.0`;
  }
  if (config.volume < 0 || config.volume > 1.0) {
    return `音量 ${config.volume} 超出合法范围 0.0-1.0`;
  }
  return null;
}
