/**
 * Platform — 平台预设（v3 新增 · Stage 12.1）
 *
 * 设计原则：
 * - 把抖音/B 站/视频号/YouTube/TikTok 的"选平台 → 自动配置"
 *   流程做成数据驱动：preset JSON 决定编码参数 + 字幕烧录策略，
 *   前端 UI 不用写 5 套硬编码。
 * - 接入 v2 `export_video` 流程：v3 在 L2 render 阶段读取 preset，
 *   调用 Rust 端 ffmpeg-sidecar 出片。
 * - 字段命名遵循 FFmpeg 习惯（width/height/bitrate/fps），不抽象
 *   "quality" 这种语义词（避免双重翻译）。
 */

import type { SubtitleStyle } from './assembly';
import { OUT_SUBTITLE_FG, OUT_SUBTITLE_STROKE } from '@/core/video/output-colors';

// ─── 比例与分辨率 ───────────────────────────────────────

/** 宽高比枚举（v3 主流平台覆盖） */
export type AspectRatio = '9:16' | '1:1' | '16:9' | '4:5' | '21:9' | '3:4';

/** 平台 ID（短横线风格，匹配文件系统友好） */
export type PlatformId =
  | 'douyin' // 抖音
  | 'bilibili' // B 站
  | 'wechat' // 视频号
  | 'youtube' // YouTube
  | 'youtube-shorts' // YouTube Shorts
  | 'tiktok' // TikTok
  | 'xiaohongshu' // 小红书
  | 'kuaishou'; // 快手

// ─── 渲染阶段配置（Stage 15.1） ─────────────────────────

/** 渲染阶段参数（被 PlatformPreset 引用，覆盖默认行为） */
export interface RenderConfig {
  /** 配音音量倍率（0.0-2.0，1.0 = 原音量） */
  voiceVolume: number;
  /** 背景音乐音量倍率（0.0-1.0） */
  bgmVolume: number;
  /** 原始视频原声音量倍率（0.0-1.0，0 = 静音） */
  originalVolume: number;
  /** 渲染速度（0.5-2.0，1.0 = 正常） */
  speedFactor: number;
  /** 是否启用淡入淡出（开头 1s + 结尾 1s） */
  fadeInOut: boolean;
  /** 最大时长（秒，0 = 不限；超出会自动剪辑） */
  maxDurationSecs: number;
}

/** 默认渲染配置（适用多数平台） */
export const DEFAULT_RENDER_CONFIG: RenderConfig = {
  voiceVolume: 1.0,
  bgmVolume: 0.3,
  originalVolume: 0.0,
  speedFactor: 1.0,
  fadeInOut: true,
  maxDurationSecs: 0,
};

// ─── 平台预设 ──────────────────────────────────────────

export interface PlatformPreset {
  id: PlatformId;
  /** 显示名（中文） */
  name: string;
  /** 平台域名（用于导出后跳转提示） */
  domain: string;
  /** 视频比例 */
  aspectRatio: AspectRatio;
  /** 视频宽（px） */
  width: number;
  /** 视频高（px） */
  height: number;
  /** 帧率（fps） */
  fps: number;
  /** 视频码率（kbps） */
  videoBitrate: number;
  /** 音频码率（kbps） */
  audioBitrate: number;
  /** 视频编码：H.264 兼容最广，H.265 体积小，AV1 新兴 */
  videoCodec: 'h264' | 'h265' | 'av1';
  /** 音频编码 */
  audioCodec: 'aac' | 'mp3' | 'opus';
  /** 容器格式 */
  container: 'mp4' | 'mov' | 'webm';
  /** 默认字幕样式（覆盖 AssemblyKit.subtitleTrack.styles[0]） */
  defaultSubtitleStyle: SubtitleStyle;
  /** 是否默认烧录字幕（YouTube/Shorts 平台倾向软字幕，烧录可选） */
  burnSubtitleByDefault: boolean;
  /** 渲染阶段配置（Stage 15.1 新增） */
  renderConfig: RenderConfig;
}

// ─── 主流平台预设（数据驱动 · 新增平台只加 JSON 不改代码） ─────

export const PLATFORM_PRESETS: Record<PlatformId, PlatformPreset> = {
  douyin: {
    id: 'douyin',
    name: '抖音',
    domain: 'douyin.com',
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
    fps: 30,
    videoBitrate: 3500,
    audioBitrate: 128,
    videoCodec: 'h264',
    audioCodec: 'aac',
    container: 'mp4',
    defaultSubtitleStyle: {
      id: 'douyin-default',
      fontFamily: 'Source Han Sans',
      fontSize: 24,
      color: OUT_SUBTITLE_FG,
      strokeColor: OUT_SUBTITLE_STROKE,
      strokeWidth: 3,
      position: 'middle',
      opacity: 1.0,
    },
    burnSubtitleByDefault: true,
    renderConfig: { ...DEFAULT_RENDER_CONFIG, maxDurationSecs: 180 },
  },
  kuaishou: {
    id: 'kuaishou',
    name: '快手',
    domain: 'kuaishou.com',
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
    fps: 30,
    videoBitrate: 3500,
    audioBitrate: 128,
    videoCodec: 'h264',
    audioCodec: 'aac',
    container: 'mp4',
    defaultSubtitleStyle: {
      id: 'kuaishou-default',
      fontFamily: 'Source Han Sans',
      fontSize: 24,
      color: OUT_SUBTITLE_FG,
      strokeColor: OUT_SUBTITLE_STROKE,
      strokeWidth: 3,
      position: 'middle',
      opacity: 1.0,
    },
    burnSubtitleByDefault: true,
    renderConfig: { ...DEFAULT_RENDER_CONFIG, maxDurationSecs: 180 },
  },
  xiaohongshu: {
    id: 'xiaohongshu',
    name: '小红书',
    domain: 'xiaohongshu.com',
    aspectRatio: '3:4',
    width: 1080,
    height: 1440,
    fps: 30,
    videoBitrate: 3000,
    audioBitrate: 128,
    videoCodec: 'h264',
    audioCodec: 'aac',
    container: 'mp4',
    defaultSubtitleStyle: {
      id: 'xhs-default',
      fontFamily: 'Source Han Sans',
      fontSize: 20,
      color: OUT_SUBTITLE_FG,
      strokeColor: OUT_SUBTITLE_STROKE,
      strokeWidth: 2,
      position: 'top',
      opacity: 0.9,
    },
    burnSubtitleByDefault: true,
    renderConfig: { ...DEFAULT_RENDER_CONFIG, maxDurationSecs: 300 },
  },
  wechat: {
    id: 'wechat',
    name: '视频号',
    domain: 'channels.weixin.qq.com',
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
    fps: 30,
    videoBitrate: 3000,
    audioBitrate: 128,
    videoCodec: 'h264',
    audioCodec: 'aac',
    container: 'mp4',
    defaultSubtitleStyle: {
      id: 'wechat-default',
      fontFamily: 'Source Han Sans',
      fontSize: 22,
      color: OUT_SUBTITLE_FG,
      strokeColor: OUT_SUBTITLE_STROKE,
      strokeWidth: 2,
      position: 'bottom',
      opacity: 0.85,
    },
    burnSubtitleByDefault: true,
    renderConfig: { ...DEFAULT_RENDER_CONFIG, maxDurationSecs: 300 },
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    domain: 'tiktok.com',
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
    fps: 30,
    videoBitrate: 3500,
    audioBitrate: 128,
    videoCodec: 'h264',
    audioCodec: 'aac',
    container: 'mp4',
    defaultSubtitleStyle: {
      id: 'tiktok-default',
      fontFamily: 'Source Han Sans',
      fontSize: 24,
      color: OUT_SUBTITLE_FG,
      strokeColor: OUT_SUBTITLE_STROKE,
      strokeWidth: 3,
      position: 'middle',
      opacity: 1.0,
    },
    burnSubtitleByDefault: true,
    renderConfig: { ...DEFAULT_RENDER_CONFIG, maxDurationSecs: 180 },
  },
  bilibili: {
    id: 'bilibili',
    name: 'B 站',
    domain: 'bilibili.com',
    aspectRatio: '16:9',
    width: 1920,
    height: 1080,
    fps: 30,
    videoBitrate: 6000,
    audioBitrate: 192,
    videoCodec: 'h265',
    audioCodec: 'aac',
    container: 'mp4',
    defaultSubtitleStyle: {
      id: 'bili-default',
      fontFamily: 'Source Han Sans',
      fontSize: 22,
      color: OUT_SUBTITLE_FG,
      strokeColor: OUT_SUBTITLE_STROKE,
      strokeWidth: 2,
      position: 'bottom',
      opacity: 1.0,
    },
    burnSubtitleByDefault: false,
    renderConfig: {
      ...DEFAULT_RENDER_CONFIG,
      maxDurationSecs: 0,
      voiceVolume: 1.0,
      originalVolume: 0.5,
    },
  },
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    domain: 'youtube.com',
    aspectRatio: '16:9',
    width: 1920,
    height: 1080,
    fps: 30,
    videoBitrate: 8000,
    audioBitrate: 192,
    videoCodec: 'h264',
    audioCodec: 'aac',
    container: 'mp4',
    defaultSubtitleStyle: {
      id: 'yt-default',
      fontFamily: 'Roboto',
      fontSize: 20,
      color: OUT_SUBTITLE_FG,
      strokeColor: OUT_SUBTITLE_STROKE,
      strokeWidth: 1,
      position: 'bottom',
      opacity: 1.0,
    },
    burnSubtitleByDefault: false,
    renderConfig: {
      ...DEFAULT_RENDER_CONFIG,
      maxDurationSecs: 0,
      voiceVolume: 1.0,
      originalVolume: 0.3,
    },
  },
  'youtube-shorts': {
    id: 'youtube-shorts',
    name: 'YouTube Shorts',
    domain: 'youtube.com/shorts',
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
    fps: 30,
    videoBitrate: 5000,
    audioBitrate: 192,
    videoCodec: 'h264',
    audioCodec: 'aac',
    container: 'mp4',
    defaultSubtitleStyle: {
      id: 'yt-shorts-default',
      fontFamily: 'Roboto',
      fontSize: 24,
      color: OUT_SUBTITLE_FG,
      strokeColor: OUT_SUBTITLE_STROKE,
      strokeWidth: 2,
      position: 'middle',
      opacity: 1.0,
    },
    burnSubtitleByDefault: true,
    renderConfig: { ...DEFAULT_RENDER_CONFIG, maxDurationSecs: 60 },
  },
};

// ─── 纯函数 ──────────────────────────────────────────────

/** 列出所有平台预设（UI 下拉用） */
export function listPlatforms(): PlatformPreset[] {
  return Object.values(PLATFORM_PRESETS);
}

/** 按 ID 查预设（找不到返回 null） */
export function getPlatform(id: PlatformId): PlatformPreset | null {
  return PLATFORM_PRESETS[id] ?? null;
}

/** 按 ID 查预设，找不到时回退到抖音 */
export function requirePlatform(id: PlatformId): PlatformPreset {
  return PLATFORM_PRESETS[id] ?? PLATFORM_PRESETS.douyin;
}

// ─── 工厂 + 校验（Stage 15.1） ─────────────────────────

/** 创建自定义渲染配置（partial patch） */
export function createRenderConfig(patch: Partial<RenderConfig> = {}): RenderConfig {
  return { ...DEFAULT_RENDER_CONFIG, ...patch };
}

/** 校验 RenderConfig 字段范围 */
export function validateRenderConfig(c: RenderConfig): string | null {
  if (c.voiceVolume < 0 || c.voiceVolume > 2.0) {
    return `voiceVolume ${c.voiceVolume} 超出合法范围 0.0-2.0`;
  }
  if (c.bgmVolume < 0 || c.bgmVolume > 1.0) {
    return `bgmVolume ${c.bgmVolume} 超出合法范围 0.0-1.0`;
  }
  if (c.originalVolume < 0 || c.originalVolume > 1.0) {
    return `originalVolume ${c.originalVolume} 超出合法范围 0.0-1.0`;
  }
  if (c.speedFactor < 0.5 || c.speedFactor > 2.0) {
    return `speedFactor ${c.speedFactor} 超出合法范围 0.5-2.0`;
  }
  if (c.maxDurationSecs < 0) {
    return `maxDurationSecs 不能为负数`;
  }
  return null;
}
