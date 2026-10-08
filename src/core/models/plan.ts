/**
 * DirectorPlan — 导演计划（L1 内容生成层产物）
 *
 * 设计原则：
 * - 导演计划是 L0 剧情时间线（Storyline）与 L1 解说脚本之间的决策产物：
 *   确定解说角度、目标时长、分段模式、推荐音色与关键信息点。
 * - 分段介入式工作流的关键 gate：计划须人工审批（status = approved）后
 *   才能进入脚本生成阶段（对齐 workflow-machine 的 plan-approval gate）。
 * - 修订通过 revisePlan 产生新版本（version +1），保留修订原因链。
 * - 本文件为 v3 领域真源；旧 src/types/analysis.ts 中的 DirectorPlan 为
 *   旧 IPC DTO，将在 M5 类型治理阶段收敛。
 */

import type { SegmentMode } from '@/types/script';

// ─── 导演计划 ───

export interface DirectorPlan {
  id: string;
  /** 剧情摘要（来自 L0 storyline.summary 或 LLM 补充） */
  summary: string;
  /** 解说角度（如「悬疑揭秘」「情感共鸣」） */
  angle: string;
  /** 目标受众描述 */
  targetAudience: string;
  /** 目标成片时长（秒） */
  targetDurationSecs: number;
  /** 预估解说段落数 */
  estimatedSegments: number;
  /** 画面分段模式 */
  segmentMode: SegmentMode;
  /** 推荐音色 ID */
  recommendedVoice: string;
  /** 关键信息点（脚本生成的素材） */
  keyPoints: string[];
  /** 质量警告（如剧情时间线置信度过低），供审批时参考 */
  warnings: string[];
  /** 计划置信度 0.0-1.0 */
  confidence: number;
  /** 审批状态：draft（AI 初稿）→ approved（人工批准，锁定） */
  status: 'draft' | 'approved';
  /** 修订版本号（每次 revise +1） */
  version: number;
  /** 生成使用的模型 */
  modelUsed: string;
  /** 生成时间戳 */
  createdAt: string;
  /** 更新时间戳 */
  updatedAt: string;
}

/** 可修订字段集合（人工介入的编辑面） */
export interface PlanModifications {
  targetDurationSecs?: number;
  angle?: string;
  segmentMode?: SegmentMode;
  recommendedVoice?: string;
  keyPoints?: string[];
}

// ─── 工厂与纯函数 ──────────────────────────────────────────────

/**
 * 从 LLM 输出创建导演计划（draft 状态）
 *
 * @param input 生成器输出
 * @returns 初始计划（status = draft，version = 1）
 */
export function createDirectorPlan(input: {
  id?: string;
  summary: string;
  angle: string;
  targetAudience?: string;
  targetDurationSecs: number;
  estimatedSegments?: number;
  segmentMode?: SegmentMode;
  recommendedVoice?: string;
  keyPoints?: string[];
  warnings?: string[];
  confidence?: number;
  modelUsed?: string;
}): DirectorPlan {
  const now = new Date().toISOString();
  return {
    id: input.id ?? `plan_${Date.now()}`,
    summary: input.summary,
    angle: input.angle,
    targetAudience: input.targetAudience ?? '',
    targetDurationSecs: input.targetDurationSecs,
    estimatedSegments: input.estimatedSegments ?? 0,
    segmentMode: input.segmentMode ?? 'silent_only',
    recommendedVoice: input.recommendedVoice ?? '',
    keyPoints: input.keyPoints ?? [],
    warnings: input.warnings ?? [],
    confidence: input.confidence ?? 0,
    status: 'draft',
    version: 1,
    modelUsed: input.modelUsed ?? '',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 审批导演计划（分段介入 gate：批准后锁定，进入脚本生成）
 *
 * @param plan 当前计划
 * @returns 新计划实例（status = approved）；已批准时原样返回
 */
export function approveDirectorPlan(plan: DirectorPlan): DirectorPlan {
  if (plan.status === 'approved') return plan;
  return { ...plan, status: 'approved', updatedAt: new Date().toISOString() };
}

/**
 * 修订导演计划（人工编辑可修订字段，version +1，状态回到 draft）
 *
 * @param plan 当前计划
 * @param mods 修订内容（仅提供的字段生效）
 * @returns 新计划实例
 */
export function reviseDirectorPlan(plan: DirectorPlan, mods: PlanModifications): DirectorPlan {
  return {
    ...plan,
    ...mods,
    version: plan.version + 1,
    status: 'draft',
    updatedAt: new Date().toISOString(),
  };
}

/** 计划是否已审批（可作为脚本生成 gate 的判断依据） */
export function isPlanApproved(plan: Pick<DirectorPlan, 'status'> | null): boolean {
  return plan?.status === 'approved';
}

// ─── 防御性解析 ────────────────────────────────────────────────

const SEGMENT_MODES: SegmentMode[] = ['silent_only', 'original_audio', 'montage'];

/**
 * 防御性解析 plan.json（磁盘产物）
 *
 * 与 parseStoryline 同一模式：顶层字段类型兜底，畸形数据不崩溃。
 *
 * @param raw JSON.parse 后的原始值
 * @returns 归一化后的 DirectorPlan；输入非对象时返回 null
 */
export function parseDirectorPlan(raw: unknown): DirectorPlan | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const num = (v: unknown, fallback = 0): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((k): k is string => typeof k === 'string') : [];

  return {
    id: str(obj.id) || `plan_${Date.now()}`,
    summary: str(obj.summary),
    angle: str(obj.angle),
    targetAudience: str(obj.targetAudience),
    targetDurationSecs: num(obj.targetDurationSecs),
    estimatedSegments: num(obj.estimatedSegments),
    segmentMode: SEGMENT_MODES.includes(obj.segmentMode as SegmentMode)
      ? (obj.segmentMode as SegmentMode)
      : 'silent_only',
    recommendedVoice: str(obj.recommendedVoice),
    keyPoints: strArr(obj.keyPoints),
    warnings: strArr(obj.warnings),
    confidence: num(obj.confidence),
    status: obj.status === 'approved' ? 'approved' : 'draft',
    version: Math.max(1, num(obj.version, 1)),
    modelUsed: str(obj.modelUsed),
    createdAt: str(obj.createdAt),
    updatedAt: str(obj.updatedAt),
  };
}
