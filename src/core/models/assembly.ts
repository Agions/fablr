/**
 * Assembly — L2 多轨装配（v3 新增 · Stage 12.1）
 *
 * 设计原则：
 * - AssemblyKit 是 L2 阶段的"装配图"，描述「一段成片」由哪些轨组成
 *   （视频轨 + 配音轨 + 字幕轨 + 封面 + BGM）。
 * - 替代 v2 的 `RenderResult`（仅记成片输出路径）：v3 渲染前先有
 *   显式装配图，用户可调整 / 编辑，再交给 FFmpeg 出片。
 * - 多角色配音：audioTracks 数组支持 1-3 个 track（旁白 + 角色 A + 角色 B），
 *   配合 SSML 标记（见 tts/ssml.ts）。
 * - 与 PlatformPreset 关联：装配时即指定目标平台，render step 据此选硬编
 *   /软编、字幕烧录与否。
 */

// ─── 音轨 ────────────────────────────────────────────────
import { OUT_SUBTITLE_FG, OUT_SUBTITLE_STROKE } from '@/core/video/output-colors';

/** 音轨类型 */
export type AudioTrackType = 'narration' | 'dialogue' | 'sfx' | 'bgm';

/** 段落级音轨段位（时间对齐） */
export interface AudioSegment {
  id: string;
  /** 起始时间（秒，相对最终成片时间轴） */
  startSecs: number;
  /** 结束时间（秒） */
  endSecs: number;
  /** 配音文本（旁白 / 对话） */
  text: string;
  /** SSML 标记（情绪、停顿、韵律） */
  ssml: string | null;
  /** 实际音频文件路径（TTS 合成后回填） */
  audioPath: string | null;
  /** 角色 ID（旁白/角色A/角色B，无角色对话时为 null） */
  roleId: string | null;
}

export interface AudioTrack {
  id: string;
  type: AudioTrackType;
  /** 音色 ID（对应 VoiceInfo.id） */
  voiceId: string;
  /** 音量 0.0-1.0（最终混音权重） */
  volume: number;
  /** 段位（按 startSecs 升序） */
  segments: AudioSegment[];
}

// ─── 视频轨 ──────────────────────────────────────────────

export interface VideoClip {
  id: string;
  /** 源视频路径（裁剪或重组时为原视频，全片时为 source.videoPath） */
  sourcePath: string;
  /** 裁剪入点（秒，相对源视频） */
  sourceInSecs: number;
  /** 裁剪出点（秒，相对源视频） */
  sourceOutSecs: number;
  /** 在成片中的起始时间（秒） */
  outputStartSecs: number;
  /** 字幕烧录标记（true = 字幕烧入视频帧） */
  burnSubtitle: boolean;
}

export interface VideoTrack {
  id: string;
  /** 单轨 = 全片使用，array length > 1 = 素材重组 */
  clips: VideoClip[];
}

// ─── 字幕轨 ──────────────────────────────────────────────

export interface SubtitleCue {
  id: string;
  startSecs: number;
  endSecs: number;
  text: string;
  /** 样式 ID（关联 SubtitleStyle） */
  styleId: string;
}

export interface SubtitleTrack {
  /** 字幕轨（一般 1 条；多语言时多条） */
  cues: SubtitleCue[];
  /** 样式表（v3.1 引入 ASS/SSA 样式引擎） */
  styles: SubtitleStyle[];
}

export interface SubtitleStyle {
  id: string;
  /** 字体名（如 "Source Han Sans"） */
  fontFamily: string;
  /** 字号（pt） */
  fontSize: number;
  /** 颜色（hex） */
  color: string;
  /** 描边颜色 */
  strokeColor: string;
  /** 描边宽度（px） */
  strokeWidth: number;
  /** 位置：'top' | 'middle' | 'bottom' */
  position: 'top' | 'middle' | 'bottom';
  /** 不透明度 0.0-1.0 */
  opacity: number;
}

// ─── 根聚合 ──────────────────────────────────────────────

export interface AssemblyKit {
  id: string;
  /** 关联的 Production ID */
  productionId: string;
  /** 视频轨（单条 = 全片，>1 = 素材重组） */
  videoTracks: VideoTrack[];
  /** 音轨（旁白 + 角色 + BGM + 音效） */
  audioTracks: AudioTrack[];
  /** 字幕轨 */
  subtitleTrack: SubtitleTrack;
  /** 封面图片路径（无封面 = 用视频首帧） */
  coverPath: string | null;
  /** 目标平台预设 ID（决定编码参数 + 字幕烧录策略） */
  platformId: string;
  /** 总时长（秒，由音频时长推导） */
  totalDurationSecs: number;
  /** 创建时间 */
  createdAt: string;
  /** 最后修改时间 */
  updatedAt: string;
}

// ─── 工厂与纯函数 ──────────────────────────────────────────

/** 创建空装配图（仅 1 视频轨 + 1 旁白轨 + 1 字幕轨） */
export function createAssembly(productionId: string, platformId: string): AssemblyKit {
  const now = new Date().toISOString();
  return {
    id: `assembly_${Date.now()}`,
    productionId,
    videoTracks: [
      {
        id: `video_${Date.now()}`,
        clips: [],
      },
    ],
    audioTracks: [
      {
        id: `narration_${Date.now()}`,
        type: 'narration',
        voiceId: '',
        volume: 1.0,
        segments: [],
      },
    ],
    subtitleTrack: {
      cues: [],
      styles: [
        {
          id: 'default',
          fontFamily: 'Source Han Sans',
          fontSize: 22,
          color: OUT_SUBTITLE_FG,
          strokeColor: OUT_SUBTITLE_STROKE,
          strokeWidth: 2,
          position: 'bottom',
          opacity: 1.0,
        },
      ],
    },
    coverPath: null,
    platformId,
    totalDurationSecs: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/** 校验：装配图是否可渲染（至少 1 视频轨 + 1 配音轨 + 总时长 > 0） */
export function isAssemblyRenderable(kit: AssemblyKit): boolean {
  const hasVideo = kit.videoTracks.some(t => t.clips.length > 0);
  const hasNarration = kit.audioTracks.some(t => t.type === 'narration' && t.segments.length > 0);
  return hasVideo && hasNarration && kit.totalDurationSecs > 0;
}

// ─── Timeline ↔ AssemblyKit 适配器 ─────────────────────────
import type { TimelineTrack, TimelineClip } from '@/types/timeline';

/**
 * 将 AssemblyKit 转换为 UI Timeline 轨道列表
 */
export function assemblyKitToTimelineTracks(kit: AssemblyKit): TimelineTrack[] {
  const tracks: TimelineTrack[] = [];

  // 1. 视频轨
  kit.videoTracks.forEach((vt, index) => {
    const clips: TimelineClip[] = vt.clips.map(c => {
      const clipDurationSecs = Math.max(0, c.sourceOutSecs - c.sourceInSecs);
      return {
        id: c.id,
        trackId: vt.id || `video_track_${index}`,
        startMs: Math.round(c.outputStartSecs * 1000),
        endMs: Math.round((c.outputStartSecs + clipDurationSecs) * 1000),
        sourceStartMs: Math.round(c.sourceInSecs * 1000),
        sourceEndMs: Math.round(c.sourceOutSecs * 1000),
        name: c.sourcePath.split('/').pop() || 'Video Clip',
        type: 'video',
      };
    });

    tracks.push({
      id: vt.id || `video_track_${index}`,
      type: 'video',
      name: `视频轨 ${index + 1}`,
      clips,
      muted: false,
      locked: false,
      visible: true,
      height: 64,
    });
  });

  // 2. 音轨
  kit.audioTracks.forEach((at, index) => {
    const clips: TimelineClip[] = at.segments.map(s => ({
      id: s.id,
      trackId: at.id || `audio_track_${index}`,
      startMs: Math.round(s.startSecs * 1000),
      endMs: Math.round(s.endSecs * 1000),
      sourceStartMs: 0,
      sourceEndMs: Math.round((s.endSecs - s.startSecs) * 1000),
      name: s.text || (at.type === 'narration' ? '旁白' : '音轨'),
      type: at.type,
      volume: at.volume,
    }));

    tracks.push({
      id: at.id || `audio_track_${index}`,
      type: 'audio',
      name: at.type === 'narration' ? '旁白配音' : `音轨 ${index + 1}`,
      clips,
      muted: false,
      locked: false,
      visible: true,
      height: 48,
    });
  });

  // 3. 字幕轨
  if (kit.subtitleTrack?.cues?.length > 0) {
    const clips: TimelineClip[] = kit.subtitleTrack.cues.map(cue => ({
      id: cue.id,
      trackId: 'subtitle_track_0',
      startMs: Math.round(cue.startSecs * 1000),
      endMs: Math.round(cue.endSecs * 1000),
      sourceStartMs: 0,
      sourceEndMs: Math.round((cue.endSecs - cue.startSecs) * 1000),
      name: cue.text,
      type: 'subtitle',
    }));

    tracks.push({
      id: 'subtitle_track_0',
      type: 'subtitle',
      name: '字幕轨',
      clips,
      muted: false,
      locked: false,
      visible: true,
      height: 40,
    });
  }

  return tracks;
}

/**
 * 将 UI Timeline 轨道列表还原为 AssemblyKit
 */
export function timelineTracksToAssemblyKit(
  tracks: TimelineTrack[],
  baseKit?: Partial<AssemblyKit>
): AssemblyKit {
  const kit: AssemblyKit = {
    id: baseKit?.id || `assembly_${Date.now()}`,
    productionId: baseKit?.productionId || '',
    videoTracks: [],
    audioTracks: [],
    subtitleTrack: baseKit?.subtitleTrack || { cues: [], styles: [] },
    coverPath: baseKit?.coverPath || null,
    platformId: baseKit?.platformId || 'douyin',
    totalDurationSecs: baseKit?.totalDurationSecs || 0,
    createdAt: baseKit?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  let maxEndSecs = 0;

  for (const track of tracks) {
    if (track.type === 'video') {
      const clips: VideoClip[] = track.clips.map(c => {
        const endSecs = c.endMs / 1000;
        if (endSecs > maxEndSecs) maxEndSecs = endSecs;
        return {
          id: c.id,
          sourcePath: c.name || '',
          sourceInSecs: c.sourceStartMs / 1000,
          sourceOutSecs: c.sourceEndMs / 1000,
          outputStartSecs: c.startMs / 1000,
          burnSubtitle: false,
        };
      });
      kit.videoTracks.push({ id: track.id, clips });
    } else if (track.type === 'audio') {
      const segments: AudioSegment[] = track.clips.map(c => {
        const startSecs = c.startMs / 1000;
        const endSecs = c.endMs / 1000;
        if (endSecs > maxEndSecs) maxEndSecs = endSecs;
        return {
          id: c.id,
          startSecs,
          endSecs,
          text: c.name || '',
          ssml: null,
          audioPath: null,
          roleId: null,
        };
      });
      kit.audioTracks.push({
        id: track.id,
        type: track.name.includes('旁白') ? 'narration' : 'dialogue',
        voiceId: '',
        volume: track.clips[0]?.volume ?? 1.0,
        segments,
      });
    } else if (track.type === 'subtitle') {
      const cues: SubtitleCue[] = track.clips.map(c => {
        const startSecs = c.startMs / 1000;
        const endSecs = c.endMs / 1000;
        if (endSecs > maxEndSecs) maxEndSecs = endSecs;
        return {
          id: c.id,
          startSecs,
          endSecs,
          text: c.name || '',
          styleId: 'default',
        };
      });
      kit.subtitleTrack = {
        cues,
        styles: kit.subtitleTrack.styles.length ? kit.subtitleTrack.styles : [],
      };
    }
  }

  kit.totalDurationSecs = maxEndSecs;
  return kit;
}
