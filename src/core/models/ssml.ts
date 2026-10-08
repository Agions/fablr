/**
 * SSML — Speech Synthesis Markup Language（Stage 14.1）
 *
 * 用途：为 TTS 合成文本添加停顿、情感、角色、读法等标记。
 * 后端 wrap 成标准 SSML 字符串后传给 edge-tts / Azure / CosyVoice 等
 * TTS 后端（不同后端支持的 SSML 标签子集可能不同，见 SsmlCapability）。
 *
 * 标签集合（与 SSML 1.1 对齐 + Fablr 实际需求收敛）：
 * - <break>      停顿
 * - <emphasis>   强调
 * - <prosody>    韵律（rate / pitch / volume）
 * - <say-as>     读法（数字、日期、电话号码等）
 * - <phoneme>    自定义发音
 * - <voice>      角色切换（多角色配音核心）
 * - <audio>      内嵌音频
 * - <sub>        同义词替换
 */

// ─── 基础属性 ───────────────────────────────────────────────────

/** SSML 1.1 强度（emphasis） */
export type EmphasisLevel = 'none' | 'reduced' | 'moderate' | 'strong';

/** SSML 时间值（支持 ms / s） */
export interface SsmlDuration {
  value: number;
  unit: 'ms' | 's';
}

/** 数字/日期格式化（say-as interpret-as） */
export type SayAsInterpretAs =
  | 'cardinal'      // 数字
  | 'ordinal'       // 序数
  | 'digits'        // 逐位读
  | 'fraction'      // 分数
  | 'unit'          // 单位
  | 'date'          // 日期
  | 'time'          // 时间
  | 'telephone'     // 电话
  | 'address'       // 地址
  | 'currency'      // 货币
  | 'name'          // 姓名
  | 'spell-out';    // 拼读

// ─── 标签节点类型 ───────────────────────────────────────────────

/** <break> 节点 — 停顿 */
export interface BreakNode {
  type: 'break';
  /** 持续时间（省略则用 TTS 默认停顿） */
  duration?: SsmlDuration;
  /** 强度 'none' | 'x-weak' | 'weak' | 'medium' | 'strong' | 'x-strong' */
  strength?: 'none' | 'x-weak' | 'weak' | 'medium' | 'strong' | 'x-strong';
}

/** <emphasis> 节点 — 强调 */
export interface EmphasisNode {
  type: 'emphasis';
  level?: EmphasisLevel;
  children: SsmlInline[];
}

/** <prosody> 节点 — 韵律（rate / pitch / volume / duration） */
export interface ProsodyNode {
  type: 'prosody';
  /** 相对语速 0.5-2.0（也支持 percentage / named） */
  rate?: number | string;
  /** 相对音调 0.5-2.0（也支持 percentage / named） */
  pitch?: number | string;
  /** 相对音量 0.0-1.0（也支持 dB / percentage） */
  volume?: number | string;
  children: SsmlInline[];
}

/** <say-as> 节点 — 读法 */
export interface SayAsNode {
  type: 'say-as';
  interpretAs: SayAsInterpretAs;
  /** interpret-as='date' 时 'ymd' | 'mdy' | 'dmy'；其他类型 'characters' | 'digits' 等 */
  format?: string;
  children: SsmlInline[];
}

/** <phoneme> 节点 — 自定义发音（IPA / X-SAMPA） */
export interface PhonemeNode {
  type: 'phoneme';
  /** IPA / X-SAMPA / X-CMU 等 */
  alphabet: 'ipa' | 'x-sampa' | 'x-cmu';
  /** 音标 */
  ph: string;
  children: SsmlInline[];
}

/** <voice> 节点 — 角色切换（多角色配音核心） */
export interface VoiceNode {
  type: 'voice';
  /** 音色 ID（Edge TTS: zh-CN-YunxiNeural 等） */
  name: string;
  /** 语言（zh-CN / en-US / ja-JP ...），部分后端需要 */
  xmlLang?: string;
  children: SsmlInline[];
}

/** <audio> 节点 — 内嵌音频 */
export interface AudioNode {
  type: 'audio';
  src: string;
  /** 标签替换文本（音频无法播放时） */
  fallback?: string;
}

/** <sub> 节点 — 同义词替换 */
export interface SubNode {
  type: 'sub';
  /** 实际朗读的文本（alias） */
  alias: string;
  children: SsmlInline[];
}

/** 纯文本片段 */
export interface TextNode {
  type: 'text';
  text: string;
}

/** SSML 内联节点（标签 + 文本） */
export type SsmlInline =
  | TextNode
  | BreakNode
  | EmphasisNode
  | ProsodyNode
  | SayAsNode
  | PhonemeNode
  | VoiceNode
  | AudioNode
  | SubNode;

// ─── 顶层文档（必须包含 <speak> 根） ───────────────────────────

export interface SsmlDocument {
  /** 根语言（必需） */
  xmlLang: 'zh-CN' | 'en-US' | 'ja-JP' | 'ko-KR' | string;
  /** 顶层音色（默认音色，所有未包裹 <voice> 的内容都用这个） */
  defaultVoice?: string;
  /** 内联节点 */
  children: SsmlInline[];
}

// ─── 工厂（让调用方写起来自然） ─────────────────────────────────

export const SSML = {
  text: (text: string): TextNode => ({ type: 'text', text }),

  pause: (ms: number): BreakNode => ({ type: 'break', duration: { value: ms, unit: 'ms' } }),

  pauseSec: (s: number): BreakNode => ({ type: 'break', duration: { value: s, unit: 's' } }),

  emphasis: (level: EmphasisLevel = 'moderate', children: SsmlInline[]): EmphasisNode => ({
    type: 'emphasis',
    level,
    children,
  }),

  prosody: (
    options: { rate?: number | string; pitch?: number | string; volume?: number | string },
    children: SsmlInline[]
  ): ProsodyNode => ({
    type: 'prosody',
    rate: options.rate,
    pitch: options.pitch,
    volume: options.volume,
    children,
  }),

  sayAs: (
    interpretAs: SayAsInterpretAs,
    children: SsmlInline[],
    format?: string
  ): SayAsNode => ({ type: 'say-as', interpretAs, format, children }),

  voice: (name: string, children: SsmlInline[], xmlLang?: string): VoiceNode => ({
    type: 'voice',
    name,
    xmlLang,
    children,
  }),

  audio: (src: string, fallback?: string): AudioNode => ({ type: 'audio', src, fallback }),

  sub: (alias: string, children: SsmlInline[]): SubNode => ({ type: 'sub', alias, children }),
} as const;

// ─── SSML 序列化（标准 XML） ─────────────────────────────────────

/** 转义 XML 特殊字符（仅对 text 节点内部） */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** 格式化 duration（edge-tts 接受 '500ms' / '1.5s'） */
function formatDuration(d: SsmlDuration | undefined): string {
  if (!d) return '';
  return `${d.value}${d.unit}`;
}

/** 序列化单个内联节点 */
function renderInline(node: SsmlInline): string {
  switch (node.type) {
    case 'text':
      return escapeXml(node.text);
    case 'break': {
      const attrs: string[] = [];
      const d = formatDuration(node.duration);
      if (d) attrs.push(`time="${d}"`);
      if (node.strength) attrs.push(`strength="${node.strength}"`);
      return `<break ${attrs.join(' ')}/>`;
    }
    case 'emphasis':
      return `<emphasis level="${node.level ?? 'moderate'}">${node.children.map(renderInline).join('')}</emphasis>`;
    case 'prosody': {
      const attrs: string[] = [];
      if (node.rate !== undefined) attrs.push(`rate="${node.rate}"`);
      if (node.pitch !== undefined) attrs.push(`pitch="${node.pitch}"`);
      if (node.volume !== undefined) attrs.push(`volume="${node.volume}"`);
      return `<prosody ${attrs.join(' ')}>${node.children.map(renderInline).join('')}</prosody>`;
    }
    case 'say-as': {
      const attrs = [`interpret-as="${node.interpretAs}"`];
      if (node.format) attrs.push(`format="${node.format}"`);
      return `<say-as ${attrs.join(' ')}>${node.children.map(renderInline).join('')}</say-as>`;
    }
    case 'phoneme':
      return `<phoneme alphabet="${node.alphabet}" ph="${escapeXml(node.ph)}">${node.children.map(renderInline).join('')}</phoneme>`;
    case 'voice': {
      const attrs = [`name="${escapeXml(node.name)}"`];
      if (node.xmlLang) attrs.push(`xml:lang="${node.xmlLang}"`);
      return `<voice ${attrs.join(' ')}>${node.children.map(renderInline).join('')}</voice>`;
    }
    case 'audio': {
      const attrs = [`src="${escapeXml(node.src)}"`];
      if (node.fallback) attrs.push(`fallback="${escapeXml(node.fallback)}"`);
      return `<audio ${attrs.join(' ')}>`;
    }
    case 'sub':
      return `<sub alias="${escapeXml(node.alias)}">${node.children.map(renderInline).join('')}</sub>`;
  }
}

/** 序列化整个 SSML 文档为标准 XML 字符串 */
export function serializeSsml(doc: SsmlDocument): string {
  const inner = doc.children.map(renderInline).join('');
  return `<speak version="1.1" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${doc.xmlLang}">${inner}</speak>`;
}

// ─── 简易角色片段（多角色配音的高层抽象） ───────────────────────

/** 一段由特定角色朗读的文本 */
export interface VoiceSegment {
  /** 角色音色 ID（如 zh-CN-YunxiNeural） */
  voice: string;
  /** 该角色语言（可省略，默认用全局） */
  language?: string;
  /** 朗读内容（可用 SSML 节点树或纯文本） */
  content: SsmlInline[];
}

/** 多个 VoiceSegment 拼成一个 SSML 文档（多角色配音主入口） */
export function buildMultiVoiceSsml(
  segments: VoiceSegment[],
  options: { xmlLang: SsmlDocument['xmlLang'] } = { xmlLang: 'zh-CN' }
): SsmlDocument {
  return {
    xmlLang: options.xmlLang,
    children: segments.flatMap(seg => [
      SSML.voice(seg.voice, seg.content, seg.language),
      // 角色间加 300ms 停顿，避免粘音
      SSML.pause(300),
    ]),
  };
}
