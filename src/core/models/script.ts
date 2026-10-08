/**
 * CommentaryScript — 解说脚本（L1 内容生成层核心产物）
 *
 * 设计原则：
 * - 段落级（Paragraph）模型，替代旧架构中 ScriptSegment 的
 *   text/content 双字段歧义问题。
 * - 每个段落与场景强绑定（targetSceneId + timeRange），这是行业
 *   调研确认的「时间轴对齐」关键差异点：解说词 ↔ 视频时间段精确绑定，
 *   为配音、画面剪辑、字幕生成提供统一基准。
 * - estimatedSpeakSecs 按语速估算朗读时长；配音完成后 audio 回填实际
 *   音频路径与时长（L2 产物）。
 */

import type { ScriptStylePreset } from '@/types/script';

// ─── 段落 ───

export interface Paragraph {
  id: string;
  /** 解说词正文 */
  text: string;
  /** 情感标注（如 "suspense" / "warm"），供 TTS 情感调节与画面匹配使用 */
  emotion?: string;
  /** 绑定的源场景（无对应场景时为 null，如开场白） */
  targetSceneId: string | null;
  /** 解析后回填的视频时间区间（毫秒） */
  timeRange: { startMs: number; endMs: number } | null;
  /** 按语速估算的朗读时长（秒） */
  estimatedSpeakSecs: number;
  /** L2 回填：配音产物（路径 + 实际时长） */
  audio: { path: string; durationSecs: number } | null;
}

// ─── 脚本 ───

export interface CommentaryScript {
  id: string;
  /** 解说风格预设（复用既有 5 种风格） */
  style: ScriptStylePreset;
  /** 解说角度（来自导演计划） */
  angle: string;
  /** 段落列表（按叙述顺序） */
  paragraphs: Paragraph[];
  /** 全脚本估算时长（秒） */
  estimatedDurationSecs: number;
  /** 全脚本字数 */
  wordCount: number;
  /** 审阅状态：draft（AI 初稿）→ reviewing（人工编辑中）→ approved（锁定） */
  status: 'draft' | 'reviewing' | 'approved';
  /** 生成使用的模型 */
  modelUsed: string;
  /** 生成使用的提供商 */
  provider: string;
  /** 生成时间戳 */
  createdAt: string;
  /** 更新时间戳 */
  updatedAt: string;
}

// ─── 常量 ──────────────────────────────────────────────────────

/** 默认中文解说朗读语速（字/分钟），用于估算朗读时长 */
export const DEFAULT_SPEAK_CPS = 4.2;

// ─── 工厂与纯函数 ──────────────────────────────────────────────

/**
 * 从 LLM 输出创建解说脚本
 *
 * @param input 生成器输出（段落文本、风格、角度等）
 * @returns 初始脚本（status = draft，段落无时间轴绑定）
 */
export function createCommentaryScript(input: {
  id?: string;
  style: ScriptStylePreset;
  angle: string;
  paragraphs: Array<{ text: string; emotion?: string }>;
  modelUsed: string;
  provider: string;
  speakCps?: number;
}): CommentaryScript {
  const now = new Date().toISOString();
  const paragraphs: Paragraph[] = input.paragraphs.map((p, i) => ({
    id: `paragraph_${Date.now()}_${i}`,
    text: p.text,
    emotion: p.emotion,
    targetSceneId: null,
    timeRange: null,
    estimatedSpeakSecs: estimateSpeakSecs(p.text, input.speakCps),
    audio: null,
  }));
  const wordCount = paragraphs.reduce((acc, p) => acc + countWords(p.text), 0);
  return {
    id: input.id ?? `script_${Date.now()}`,
    style: input.style,
    angle: input.angle,
    paragraphs,
    estimatedDurationSecs: paragraphs.reduce((acc, p) => acc + p.estimatedSpeakSecs, 0),
    wordCount,
    status: 'draft',
    modelUsed: input.modelUsed,
    provider: input.provider,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 估算文本朗读时长（秒）
 *
 * @param text 解说词文本
 * @param speakCps 语速（字/秒），默认 4.2 字/秒 ≈ 250 字/分钟
 * @returns 估算秒数（含句间停顿余量，最小 0.8 秒）
 */
export function estimateSpeakSecs(text: string, speakCps: number = DEFAULT_SPEAK_CPS): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const cps = speakCps > 0 ? speakCps : DEFAULT_SPEAK_CPS;
  return Math.max(0.8, Math.round((trimmed.length / cps) * 10) / 10);
}

/** 统计文本字数（去除空白与标点） */
export function countWords(text: string): number {
  return text.replace(/[\s\p{P}\p{S}]/gu, '').length;
}

// ─── 段落操作（不可变） ────────────────────────────────────────

/**
 * 更新指定段落的文本，并重算该段估算时长与脚本总时长
 *
 * @param script 当前脚本
 * @param paragraphId 目标段落 ID
 * @param text 新文本
 * @returns 新脚本实例
 */
export function updateParagraphText(
  script: CommentaryScript,
  paragraphId: string,
  text: string
): CommentaryScript {
  const paragraphs = script.paragraphs.map(p =>
    p.id === paragraphId ? { ...p, text, estimatedSpeakSecs: estimateSpeakSecs(text) } : p
  );
  return {
    ...script,
    paragraphs,
    wordCount: paragraphs.reduce((acc, p) => acc + countWords(p.text), 0),
    estimatedDurationSecs: paragraphs.reduce((acc, p) => acc + p.estimatedSpeakSecs, 0),
    status: 'reviewing',
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 绑定段落与场景（时间轴对齐）
 *
 * @param script 当前脚本
 * @param paragraphId 目标段落 ID
 * @param sceneId 源场景 ID
 * @param startMs 绑定的起始时间（毫秒）
 * @param endMs 绑定的结束时间（毫秒）
 * @returns 新脚本实例
 */
export function bindParagraphScene(
  script: CommentaryScript,
  paragraphId: string,
  sceneId: string,
  startMs: number,
  endMs: number
): CommentaryScript {
  return {
    ...script,
    paragraphs: script.paragraphs.map(p =>
      p.id === paragraphId ? { ...p, targetSceneId: sceneId, timeRange: { startMs, endMs } } : p
    ),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 回填段落配音产物（L2 阶段调用）
 *
 * @param script 当前脚本
 * @param paragraphId 目标段落 ID
 * @param audio 配音产物（路径 + 实际时长）
 * @returns 新脚本实例
 */
export function attachParagraphAudio(
  script: CommentaryScript,
  paragraphId: string,
  audio: { path: string; durationSecs: number }
): CommentaryScript {
  return {
    ...script,
    paragraphs: script.paragraphs.map(p => (p.id === paragraphId ? { ...p, audio } : p)),
    updatedAt: new Date().toISOString(),
  };
}

/** 全部段落是否已完成配音 */
export function isFullyVoiced(script: Pick<CommentaryScript, 'paragraphs'>): boolean {
  return script.paragraphs.length > 0 && script.paragraphs.every(p => p.audio !== null);
}

/**
 * 计算实际配音总时长（秒）
 *
 * @param script 当前脚本
 * @returns 已配音段落的实际时长总和；无配音时为 0
 */
export function totalVoicedDurationSecs(script: Pick<CommentaryScript, 'paragraphs'>): number {
  return script.paragraphs.reduce((acc, p) => acc + (p.audio?.durationSecs ?? 0), 0);
}

/**
 * 审批脚本（分段介入 gate：批准后锁定，进入配音阶段）
 *
 * @param script 当前脚本
 * @returns 新脚本实例（status = approved）；已批准时原样返回
 */
export function approveScript(script: CommentaryScript): CommentaryScript {
  if (script.status === 'approved') return script;
  return { ...script, status: 'approved', updatedAt: new Date().toISOString() };
}

// ─── 防御性解析 ────────────────────────────────────────────────

/**
 * 防御性解析 script.json（磁盘产物）
 *
 * 与 parseStoryline / parseDirectorPlan 同一模式：顶层字段类型兜底，
 * 段落字段逐项归一化，畸形数据不崩溃。
 *
 * @param raw JSON.parse 后的原始值
 * @returns 归一化后的 CommentaryScript；输入非对象或无段落数组时返回 null
 */
export function parseCommentaryScript(raw: unknown): CommentaryScript | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.paragraphs)) return null;

  const num = (v: unknown, fallback = 0): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');

  const paragraphs: Paragraph[] = obj.paragraphs
    .filter((p): p is Record<string, unknown> => p !== null && typeof p === 'object')
    .map((p, i) => {
      const timeRange =
        p.timeRange !== null && typeof p.timeRange === 'object'
          ? {
              startMs: num((p.timeRange as Record<string, unknown>).startMs),
              endMs: num((p.timeRange as Record<string, unknown>).endMs),
            }
          : null;
      const audio =
        p.audio !== null && typeof p.audio === 'object'
          ? {
              path: str((p.audio as Record<string, unknown>).path),
              durationSecs: num((p.audio as Record<string, unknown>).durationSecs),
            }
          : null;
      return {
        id: str(p.id) || `paragraph_${i}`,
        text: str(p.text),
        emotion: typeof p.emotion === 'string' ? p.emotion : undefined,
        targetSceneId: typeof p.targetSceneId === 'string' ? p.targetSceneId : null,
        timeRange,
        estimatedSpeakSecs: num(p.estimatedSpeakSecs),
        audio,
      };
    });

  const status =
    obj.status === 'approved' ? 'approved' : obj.status === 'reviewing' ? 'reviewing' : 'draft';

  return {
    id: str(obj.id) || `script_${Date.now()}`,
    style: (str(obj.style) || 'neutral') as CommentaryScript['style'],
    angle: str(obj.angle),
    paragraphs,
    estimatedDurationSecs: num(obj.estimatedDurationSecs),
    wordCount: num(obj.wordCount),
    status,
    modelUsed: str(obj.modelUsed),
    provider: str(obj.provider),
    createdAt: str(obj.createdAt),
    updatedAt: str(obj.updatedAt),
  };
}
