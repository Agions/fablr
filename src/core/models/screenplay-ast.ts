/**
 * core/models/screenplay-ast.ts — 视听剧本单一真相源 (Screenplay IR / Storyboard AST)
 *
 * 职责：
 * 1. 定义多 Agent 剧本工坊的结构化领域数据模型（大纲、人物、3秒Hook、场景分镜列表）；
 * 2. 提供 AST 校验、构造、时间统计与分镜增量对齐的纯函数工具；
 * 3. 纯类型与纯函数（零外部框架依赖），向下支撑 5 轨工作台与剪映导出。
 */

export interface DramaCharacter {
  id: string;
  name: string;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'narrator';
  description: string;
  emotionalArc: string;
}

export interface DramaPlotBeat {
  id: string;
  sceneIndex: number;
  timeRange: [number, number]; // [startSec, endSec]
  title: string;
  conflictType: 'twist' | 'climax' | 'revelation' | 'setup' | 'suspense';
  intensity: number; // 1-10
  summary: string;
}

export interface DramaHook {
  hookType: 'question' | 'shocking_statement' | 'flash_forward' | 'emotional_punch';
  headline: string;
  openingText: string;
  durationSec: number;
}

export type ScreenplayShotType = 'CU' | 'MS' | 'LS' | 'PAN' | 'ACTION';
export type ScreenplayEmotion = 'tense' | 'humorous' | 'dramatic' | 'suspenseful' | 'neutral' | 'heartfelt';

export interface ScreenplaySceneBeat {
  id: string;
  sceneIndex: number;
  timecode: string; // e.g. "00:00:15 - 00:00:23"
  startTimeSec: number;
  endTimeSec: number;
  visualCue: string;
  shotType: ScreenplayShotType;
  voiceoverText: string;
  emotion: ScreenplayEmotion;
  soundFx?: string;
  bgmSuggestion?: string;
}

export interface DramaScreenplayIR {
  projectId: string;
  title: string;
  styleMode: string;
  synopsis: string;
  characters: DramaCharacter[];
  plotBeats: DramaPlotBeat[];
  hook: DramaHook;
  sceneBeats: ScreenplaySceneBeat[];
  totalEstimatedDurationSec: number;
  generatedAt: string;
  modelVersion?: string;
}

// ─────────────────────────────────────────────────────────────
// 纯函数辅助工具
// ─────────────────────────────────────────────────────────────

/** 格式化秒数为标准时码 00:MM:SS */
export function formatSecToTimecode(seconds: number): string {
  const safeSec = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safeSec / 60);
  const secs = safeSec % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `00:${pad(mins)}:${pad(secs)}`;
}

/** 计算单句旁白基于语速（默认中文字符 3.8 字/秒）的保底时长 */
export function estimateVoiceoverDurationSec(text: string, charsPerSec = 3.8): number {
  const trimmed = text.trim();
  if (!trimmed) return 3.0;
  // 保底最少 3 秒，防止剪辑切点过碎
  return Math.max(3.0, Number((trimmed.length / charsPerSec).toFixed(1)));
}

/** 增量/全量重计算分镜时间戳并保证时间轴连续性 */
export function alignSceneBeats(
  beats: ScreenplaySceneBeat[],
  options?: { minDurationSec?: number; charsPerSec?: number }
): { beats: ScreenplaySceneBeat[]; totalDurationSec: number } {
  const minDuration = options?.minDurationSec ?? 3.0;
  const cps = options?.charsPerSec ?? 3.8;

  let currentSec = 0;
  const aligned = beats.map((beat, index) => {
    const estimated = estimateVoiceoverDurationSec(beat.voiceoverText, cps);
    const originalSpan = Math.max(0, beat.endTimeSec - beat.startTimeSec);
    const actualDuration = Math.max(minDuration, Math.max(estimated, originalSpan));

    const start = currentSec;
    const end = Number((start + actualDuration).toFixed(1));
    currentSec = end;

    return {
      ...beat,
      sceneIndex: index,
      startTimeSec: start,
      endTimeSec: end,
      timecode: `${formatSecToTimecode(start)} - ${formatSecToTimecode(end)}`,
    };
  });

  return { beats: aligned, totalDurationSec: Number(currentSec.toFixed(1)) };
}

/** 校验并补齐 Screenplay IR 的基本完整性 */
export function validateScreenplayIR(ir: unknown): ir is DramaScreenplayIR {
  if (!ir || typeof ir !== 'object') return false;
  const candidate = ir as Partial<DramaScreenplayIR>;

  return (
    typeof candidate.projectId === 'string' &&
    typeof candidate.title === 'string' &&
    Array.isArray(candidate.characters) &&
    Array.isArray(candidate.plotBeats) &&
    typeof candidate.hook === 'object' &&
    candidate.hook !== null &&
    Array.isArray(candidate.sceneBeats) &&
    typeof candidate.totalEstimatedDurationSec === 'number'
  );
}

/** 创建初始空白 Screenplay IR */
export function createEmptyScreenplayIR(projectId: string, title = '未命名视听剧本'): DramaScreenplayIR {
  return {
    projectId,
    title,
    styleMode: 'fast_recap',
    synopsis: '',
    characters: [],
    plotBeats: [],
    hook: {
      hookType: 'flash_forward',
      headline: '黄金 3 秒抓人引子',
      openingText: '',
      durationSec: 5,
    },
    sceneBeats: [],
    totalEstimatedDurationSec: 0,
    generatedAt: new Date().toISOString(),
  };
}
