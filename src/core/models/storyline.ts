/**
 * Storyline — 剧情时间线（L0 内容理解层核心产物）
 *
 * 设计原则：
 * - Storyline 是「内容理解层」的唯一产物，统一收敛旧架构中
 *   segment（场景切分）、subtitle（ASR 字幕）、highlight（高光检测）、
 *   director analysis（剧情分析）四套相互割裂的分析结果。
 * - 场景/字幕/高光复用 @/types/media 既有类型（Scene / SubtitleEntry /
 *   HighlightSegment），不重复定义；本文件只补充剧情层面的聚合结构。
 * - 版本号 version 用于支持产物缓存失效判断（算法升级后增量重算）。
 */

import type { Scene, SubtitleEntry, HighlightSegment } from '@/types/media';

// ─── 剧情时间线 ───

export interface Storyline {
  /** 产物版本（算法或 prompt 升级时 +1，用于缓存失效） */
  version: number;
  /** 场景切分结果（复用既有 Scene 类型） */
  scenes: Scene[];
  /** ASR 字幕（复用既有 SubtitleEntry 类型） */
  subtitles: SubtitleEntry[];
  /** 高光片段（复用既有 HighlightSegment 类型） */
  highlights: HighlightSegment[];
  /** LLM 剧情摘要 */
  summary: string;
  /** 关键信息点（导演计划与脚本生成的输入素材） */
  keyPoints: string[];
  /** 剧情时间线置信度 0.0-1.0 */
  confidence: number;
  /** 分析耗时（毫秒） */
  analyzeMs: number;
  /** 分析时间戳 */
  analyzedAt: string;
}

// ─── 工厂与纯函数 ──────────────────────────────────────────────

/** 创建空的剧情时间线（占位用，实际产物由后端分析生成） */
export function createEmptyStoryline(input: { version?: number } = {}): Storyline {
  return {
    version: input.version ?? 1,
    scenes: [],
    subtitles: [],
    highlights: [],
    summary: '',
    keyPoints: [],
    confidence: 0,
    analyzeMs: 0,
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * 防御性解析 storyline.json（磁盘产物）
 *
 * 磁盘产物可能因算法升级、写入中断或手工编辑而畸形。本函数对顶层字段
 * 做类型兜底（数组缺省为空数组、数值缺省为 0、字符串缺省为空串），
 * 保证消费方不会因 undefined 访问而崩溃。
 *
 * @param raw JSON.parse 后的原始值
 * @returns 归一化后的 Storyline；输入非对象时返回 null
 */
export function parseStoryline(raw: unknown): Storyline | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const num = (v: unknown, fallback = 0): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');

  return {
    version: num(obj.version, 1),
    scenes: Array.isArray(obj.scenes) ? (obj.scenes as Scene[]) : [],
    subtitles: Array.isArray(obj.subtitles) ? (obj.subtitles as SubtitleEntry[]) : [],
    highlights: Array.isArray(obj.highlights) ? (obj.highlights as HighlightSegment[]) : [],
    summary: str(obj.summary),
    keyPoints: Array.isArray(obj.keyPoints)
      ? obj.keyPoints.filter((k): k is string => typeof k === 'string')
      : [],
    confidence: num(obj.confidence),
    analyzeMs: num(obj.analyzeMs),
    analyzedAt: str(obj.analyzedAt),
  };
}

/**
 * 按时间区间查找对应场景
 *
 * @param storyline 剧情时间线
 * @param timeMs 目标时间点（毫秒）
 * @returns 命中的场景，未命中返回 null
 */
export function findSceneAtTime(
  storyline: Pick<Storyline, 'scenes'>,
  timeMs: number
): Scene | null {
  return (
    storyline.scenes.find(s => timeMs >= s.startTime * 1000 && timeMs <= s.endTime * 1000) ?? null
  );
}

/**
 * 将时间点解析为可读的 mm:ss 文本
 *
 * @param secs 秒数
 * @returns 格式如 "03:24"
 */
export function formatTimecode(secs: number): string {
  const total = Math.max(0, Math.floor(secs));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** 场景覆盖率：已有场景切分覆盖的视频时长占比（0.0-1.0） */
export function sceneCoverage(
  storyline: Pick<Storyline, 'scenes'>,
  totalDurationSecs: number
): number {
  if (totalDurationSecs <= 0) return 0;
  const covered = storyline.scenes.reduce((acc, s) => {
    const start = Math.max(0, s.startTime);
    const end = Math.min(totalDurationSecs, s.endTime);
    return acc + Math.max(0, end - start);
  }, 0);
  return Math.min(1, covered / totalDurationSecs);
}
