/**
 * Production — 解说工程根聚合（v3 领域模型）
 *
 * 设计原则：
 * - Production 是「一个解说工程」的根实体，替代旧模型中的
 *   Project + DirectorSession + Pipeline 状态混杂结构。
 * - 各阶段产物（storyline / plan / script / render）以引用形式挂载，
 *   大体积产物（字幕、音频、成片）落盘于 artifacts 目录，仅存路径。
 * - 本文件只含纯类型与纯函数，不依赖 React / Tauri / Zustand。
 */

import type { VideoMetadata, Scene, SubtitleEntry, HighlightSegment } from '@/types/media';
import type { DirectorPlan } from './plan';
import type { ExportSettings } from '@/types/export';
import type { IntentConfig } from './intent';
import { DEFAULT_INTENT_CONFIG } from './intent';

// ─── 工程状态 ───

/** 工程生命周期状态（由阶段产物推导，不直接手工设置） */
export type ProductionStatus =
  | 'draft' // 已创建，尚无分析产物
  | 'understanding' // L0 分析进行中 / 已完成
  | 'planning' // L1 导演计划生成中
  | 'scripted' // L1 脚本已生成（可编辑）
  | 'synthesized' // L2 配音已合成
  | 'rendered' // L2 成片已渲染
  | 'exported'; // 已导出

/** 阶段产物状态（每个 L0/L1/L2 产物的落盘状态） */
export type ArtifactStatus = 'none' | 'running' | 'done' | 'failed';

// ─── 源视频 ───

export interface ProductionSource {
  /** 源视频绝对路径 */
  videoPath: string;
  /** 视频时长（秒） */
  durationSecs: number;
  /** 元数据（宽高/帧率/编码等） */
  metadata: VideoMetadata;
}

// ─── 渲染结果（L2 产物） ───

export interface RenderResult {
  /** 成片输出路径 */
  outputPath: string;
  /** 成片时长（秒） */
  durationSecs: number;
  /** 视频轨道来源（素材重组时记录用到的源片段） */
  usedScenes: string[];
  /** 是否已烧录字幕 */
  subtitleBurned: boolean;
  /** 渲染耗时（毫秒） */
  renderMs: number;
  /** 渲染时间戳 */
  renderedAt: string;
}

// ─── 根聚合 ───

export interface Production {
  id: string;
  name: string;
  /** v3 创作意图（驱动 L0-L2 各阶段策略） */
  intent: IntentConfig;
  source: ProductionSource;
  /** L0 产物：剧情时间线（可空 = 尚未分析） */
  storyline: import('./storyline').Storyline | null;
  /** L1 产物：导演计划（approved 后锁定，修订生成新版本） */
  plan: DirectorPlan | null;
  /** L1 产物：解说脚本（段落级） */
  script: import('./script').CommentaryScript | null;
  /** L1 产物：音色配置 */
  voiceConfig: import('./voice').ProductionVoiceConfig | null;
  /** L2 产物：渲染结果 */
  render: RenderResult | null;
  /** 导出配置（最近一次） */
  exportSettings: ExportSettings | null;
  /** 流水线任务执行状态（支持断点续传） */
  job: import('./job').PipelineJob | null;
  /** 派生状态，见 deriveProductionStatus */
  status: ProductionStatus;
  createdAt: string;
  updatedAt: string;
}

// ─── 工厂与纯函数 ──────────────────────────────────────────────

/**
 * 创建新的解说工程
 *
 * @param input 源视频信息与工程名（intent 可选，默认 short-drama）
 * @returns 初始 Production（status = draft，无任何产物）
 */
export function createProduction(input: {
  id?: string;
  name: string;
  videoPath: string;
  durationSecs: number;
  metadata: VideoMetadata;
  intent?: IntentConfig;
}): Production {
  const now = new Date().toISOString();
  return {
    id: input.id ?? `production_${Date.now()}`,
    name: input.name,
    intent: input.intent ?? DEFAULT_INTENT_CONFIG,
    source: {
      videoPath: input.videoPath,
      durationSecs: input.durationSecs,
      metadata: input.metadata,
    },
    storyline: null,
    plan: null,
    script: null,
    voiceConfig: null,
    render: null,
    exportSettings: null,
    job: null,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 修改工程的 intent（不可变更新，刷新 updatedAt）
 *
 * 注意：不修改 status（intent 变化不影响产物进度），但下游 step 在
 * 重新执行时会读取新 intent 调整策略。
 */
export function withIntent(production: Production, intent: IntentConfig): Production {
  return {
    ...production,
    intent,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 根据阶段产物推导工程状态
 *
 * 优先级：exported > rendered > synthesized > scripted > draft。
 * 产物缺失时回退到前一档状态。
 */
export function deriveProductionStatus(
  p: Pick<Production, 'plan' | 'script' | 'render' | 'exportSettings'>
): ProductionStatus {
  if (p.exportSettings && p.render) return 'exported';
  if (p.render) return 'rendered';
  if (p.script) return 'synthesized';
  if (p.plan) return 'scripted';
  return 'draft';
}

/**
 * 以不可变方式更新 Production 的某段产物，并自动刷新 updatedAt 与派生 status
 *
 * @param production 当前工程
 * @param patch 部分产物更新
 * @returns 新 Production 实例
 */
export function withProductionPatch(
  production: Production,
  patch: Partial<
    Pick<
      Production,
      'storyline' | 'plan' | 'script' | 'voiceConfig' | 'render' | 'exportSettings' | 'job'
    >
  >
): Production {
  const next: Production = {
    ...production,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  next.status = deriveProductionStatus(next);
  return next;
}

// ─── 防御性解析（L2 落盘产物） ───────────────────────────────

/**
 * 防御性解析磁盘 JSON 为 RenderResult
 *
 * 顶层非对象或关键字段缺失时返回 null，由调用方决定降级策略；
 * 数值/数组字段做类型兜底，避免旧版本或损坏文件污染渲染流程。
 */
export function parseRenderResult(raw: unknown): RenderResult | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.outputPath !== 'string' || obj.outputPath.length === 0) return null;
  const durationSecs =
    typeof obj.durationSecs === 'number' && Number.isFinite(obj.durationSecs)
      ? obj.durationSecs
      : 0;
  const usedScenes = Array.isArray(obj.usedScenes)
    ? obj.usedScenes.filter((s): s is string => typeof s === 'string')
    : [];
  const renderMs =
    typeof obj.renderMs === 'number' && Number.isFinite(obj.renderMs) ? obj.renderMs : 0;
  return {
    outputPath: obj.outputPath,
    durationSecs,
    usedScenes,
    subtitleBurned: obj.subtitleBurned === true,
    renderMs,
    renderedAt: typeof obj.renderedAt === 'string' ? obj.renderedAt : new Date(0).toISOString(),
  };
}

// ─── 类型导出（供 IPC DTO 引用） ───────────────────────────────

export type { Scene, SubtitleEntry, HighlightSegment };
