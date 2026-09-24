/**
 * EditorStore — 时间线 + 剪辑 + 播放 + 素材工作态
 *
 * 管理时间线轨道、切片剪辑、播放控制与素材操作。
 * 视频资产（video 字段）真源在 ProjectStore；EditorStore 通过 subscribe 投影。
 *
 * 设计选择：
 *  - 时间线撤销/重做（trackHistory）保留模块级单实例。
 *  - 持久化 key: `fablr-workspace`（向后兼容读取 legacy `StoryFab-workspace`）。
 *  - 播放态采用单一 `isPlaying` 命名，统一收口播放与预览状态。
 */
import { createPersistedStore } from './create-persisted-store';
import { createJSONStorage } from 'zustand/middleware';
import { createHistory } from './create-history';
import { createSimpleSetters } from './create-simple-setters';
import type { TimelineTrack, TimelineClip, AnimationKeyframe, TrackType } from '@/types';

// ─── 素材工作态 shape（原 workspace 内声明的精简副本）────────────────────────
// 长期应合并到 @/types/video 与 @/types/script，本次保留以控制改动范围。

export interface VideoData {
  id: string;
  url: string;
  duration: number;
}

export interface ScriptData {
  id: string;
  content: string;
}

export interface VoiceData {
  id: string;
  url: string;
}

export type EditorPanel = 'video' | 'script' | 'voice' | 'subtitles' | 'settings';

export interface TimelineSelection {
  segmentId?: string;
  multipleIds: string[];
}

export const DEFAULT_SNAP_THRESHOLD_MS = 100;
export const DEFAULT_ZOOM = 1;
export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 10;
export const VOLUME_MIN = 0;
export const VOLUME_MAX = 1;

const MAX_HISTORY_SIZE = 19;
const trackHistory = createHistory<TimelineTrack[]>({ maxSize: MAX_HISTORY_SIZE });

/**
 * 测试专用命名空间（PR-5.3）：
 * 集中所有测试辅助函数，避免污染模块顶层 export。
 * 命名约定 `__testing.<name>`：双下划线开头是 lint 警告，ESLint 已配置允许。
 */
export const __testing = {
  resetTrackHistory: () => trackHistory.clear(),
};

import {
  updateClipInTracks,
  addKeyframeToClip,
  removeKeyframeFromClip,
  updateKeyframeInClip,
} from './timeline-helpers';

export interface EditorStore {
  // ── 媒体工作态 ──
  video: VideoData | null;
  script: ScriptData | null;
  voice: VoiceData | null;

  // ── 播放态 ──
  isPlaying: boolean;
  currentTime: number;
  volume: number;
  muted: boolean;

  // ── UI 工作态 ──
  activePanel: EditorPanel;
  selection: TimelineSelection;
  zoom: number;
  scrollPosition: number;

  // ── 时间线工作态 ──
  timelineTracks: TimelineTrack[];
  playheadMs: number;
  timelineDuration: number;
  snapEnabled: boolean;
  snapThreshold: number;
  selectedClipId?: string;
  selectedTrackId?: string;
  selectedMultipleIds?: string[];
  inPointMs?: number;
  outPointMs?: number;

  // ── action creators (保持与 workspace-store 接口兼容) ──
  setVideo: (video: VideoData | null) => void;
  setScript: (script: ScriptData | null) => void;
  setVoice: (voice: VoiceData | null) => void;
  setActivePanel: (panel: EditorPanel) => void;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  setSelection: (selection: Partial<TimelineSelection>) => void;
  clearSelection: () => void;
  setZoom: (zoom: number) => void;
  setScrollPosition: (position: number) => void;
  reset: () => void;

  setPlayheadMs: (ms: number) => void;
  setTimelineTracks: (tracks: TimelineTrack[]) => void;
  addTimelineTrack: (type: TrackType, name?: string) => string;
  removeTimelineTrack: (trackId: string) => void;
  updateTimelineTrack: (trackId: string, updates: Partial<TimelineTrack>) => void;
  addClipToTrack: (trackId: string, clipData: Omit<TimelineClip, 'id' | 'trackId'>) => string;
  removeClipFromTrack: (clipId: string) => void;
  updateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
  moveClip: (
    clipId: string,
    targetTrackId: string,
    newStartMs: number,
    newEndMs?: number,
    skipHistory?: boolean
  ) => void;
  splitClip: (clipId: string, splitMs: number) => void;
  addKeyframe: (clipId: string, kfData: Omit<AnimationKeyframe, 'id'>) => string;
  removeKeyframe: (clipId: string, keyframeId: string) => void;
  updateKeyframe: (clipId: string, keyframeId: string, updates: Partial<AnimationKeyframe>) => void;
  setTimelineSelection: (clipId?: string, trackId?: string) => void;
  clearTimelineSelection: () => void;
  setInPoint: () => void;
  setOutPoint: () => void;
  selectAllClips: () => void;
  setTimelineDuration: (ms: number) => void;
  setSnapEnabled: (enabled: boolean) => void;
  saveTrackHistory: () => void;
  undoTrack: () => void;
  redoTrack: () => void;
  canUndoTrack: () => boolean;
  canRedoTrack: () => boolean;
}

const initialEditorState = {
  video: null as VideoData | null,
  script: null as ScriptData | null,
  voice: null as VoiceData | null,
  activePanel: 'video' as EditorPanel,
  isPlaying: false,
  currentTime: 0,
  volume: 1,
  muted: false,
  selection: { segmentId: undefined, multipleIds: [] } as TimelineSelection,
  zoom: DEFAULT_ZOOM,
  scrollPosition: 0,
};

const initialTimelineState = {
  timelineTracks: [] as TimelineTrack[],
  playheadMs: 0,
  timelineDuration: 60000,
  snapEnabled: true,
  snapThreshold: DEFAULT_SNAP_THRESHOLD_MS,
  selectedClipId: undefined as string | undefined,
  selectedTrackId: undefined as string | undefined,
  selectedMultipleIds: undefined as string[] | undefined,
  inPointMs: undefined as number | undefined,
  outPointMs: undefined as number | undefined,
};

export const useEditorStore = createPersistedStore<EditorStore>({
  name: 'fablr-workspace',
  legacyName: 'StoryFab-workspace',
  devtoolsName: 'EditorStore',
  storage: createJSONStorage(() => localStorage),
  partialize: state => ({
    video: state.video,
    zoom: state.zoom,
    volume: state.volume,
    muted: state.muted,
    snapEnabled: state.snapEnabled,
    snapThreshold: state.snapThreshold,
  }),
  state: (set, get) => {
    // 纯赋值 setter：工厂生成（PR-1.5）
    // 带 clamping / 副作用 / history / 跨字段读写 的 setter 保持手写
    const simpleSetterMap = {
      setVideo: 'video',
      setScript: 'script',
      setVoice: 'voice',
      setActivePanel: 'activePanel',
      setIsPlaying: 'isPlaying',
      setCurrentTime: 'currentTime',
      setMuted: 'muted',
      setScrollPosition: 'scrollPosition',
      setSnapEnabled: 'snapEnabled',
    } as const satisfies Record<string, keyof EditorStore & string>;
    const simpleSetters = createSimpleSetters<EditorStore, typeof simpleSetterMap>(
      simpleSetterMap,
      set
    );
    return {
      ...initialEditorState,
      ...initialTimelineState,
      ...simpleSetters,

      setVolume: volume => set({ volume: Math.max(VOLUME_MIN, Math.min(VOLUME_MAX, volume)) }),
      setSelection: selection => set(s => ({ selection: { ...s.selection, ...selection } })),
      clearSelection: () => set({ selection: { segmentId: undefined, multipleIds: [] } }),
      setZoom: zoom => set({ zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom)) }),
      reset: () => set({ ...initialEditorState, ...initialTimelineState }),

      setPlayheadMs: ms => set({ playheadMs: Math.max(0, ms) }),
      setTimelineTracks: tracks => {
        trackHistory.save(get().timelineTracks);
        set({ timelineTracks: tracks });
      },

      addTimelineTrack: (type, name) => {
        const id = crypto.randomUUID();
        const typeNames: Record<string, string> = {
          video: '视频',
          audio: '音频',
          subtitle: '字幕',
          effect: '效果',
        };
        const count = get().timelineTracks.filter(t => t.type === type).length;
        const track: TimelineTrack = {
          id,
          type,
          name: name || `${typeNames[type] || type}轨道 ${count + 1}`,
          clips: [],
          muted: false,
          locked: false,
          visible: true,
          height: type === 'subtitle' ? 50 : 60,
        };
        set(s => ({ timelineTracks: [...s.timelineTracks, track] }));
        return id;
      },

      removeTimelineTrack: trackId => {
        trackHistory.save(get().timelineTracks);
        set(s => ({ timelineTracks: s.timelineTracks.filter(t => t.id !== trackId) }));
      },

      updateTimelineTrack: (trackId, updates) =>
        set(s => ({
          timelineTracks: s.timelineTracks.map(t => (t.id === trackId ? { ...t, ...updates } : t)),
        })),

      addClipToTrack: (trackId, clipData) => {
        const id = crypto.randomUUID();
        const clip: TimelineClip = { ...clipData, id, trackId };
        trackHistory.save(get().timelineTracks);
        set(s => ({
          timelineTracks: s.timelineTracks.map(t =>
            t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t
          ),
          selectedClipId: id,
          selectedTrackId: trackId,
        }));
        return id;
      },

      removeClipFromTrack: clipId => {
        trackHistory.save(get().timelineTracks);
        set(s => ({
          timelineTracks: s.timelineTracks.map(t => ({
            ...t,
            clips: t.clips.filter(c => c.id !== clipId),
          })),
          selectedClipId: s.selectedClipId === clipId ? undefined : s.selectedClipId,
          selectedTrackId: s.selectedClipId === clipId ? undefined : s.selectedTrackId,
        }));
      },

      updateClip: (clipId, updates) => {
        trackHistory.save(get().timelineTracks);
        set(s => ({ timelineTracks: updateClipInTracks(s.timelineTracks, clipId, updates) }));
      },

      moveClip: (clipId, targetTrackId, newStartMs, newEndMs, skipHistory) => {
        if (!skipHistory) trackHistory.save(get().timelineTracks);
        set(s => {
          let clipToMove: TimelineClip | undefined;
          const afterRemove = s.timelineTracks.map(t => {
            const clip = t.clips.find(c => c.id === clipId);
            if (clip) {
              clipToMove = { ...clip, trackId: targetTrackId };
            }
            return clip ? { ...t, clips: t.clips.filter(c => c.id !== clipId) } : t;
          });
          if (!clipToMove) return s;
          const duration = clipToMove.endMs - clipToMove.startMs;
          const updatedSourceEndMs =
            newEndMs !== undefined
              ? clipToMove.sourceStartMs + (newEndMs - newStartMs)
              : clipToMove.sourceEndMs;
          return {
            timelineTracks: afterRemove.map(t =>
              t.id === targetTrackId
                ? {
                    ...t,
                    clips: [
                      ...t.clips,
                      {
                        ...clipToMove!,
                        startMs: newStartMs,
                        endMs: newEndMs ?? newStartMs + duration,
                        sourceEndMs: updatedSourceEndMs,
                      },
                    ],
                  }
                : t
            ),
          };
        });
      },

      splitClip: (clipId, splitMs) => {
        trackHistory.save(get().timelineTracks);
        set(s => ({
          timelineTracks: s.timelineTracks.map(t => {
            const index = t.clips.findIndex(c => c.id === clipId);
            if (index === -1) return t;
            const clip = t.clips[index];
            if (splitMs <= clip.startMs || splitMs >= clip.endMs) return t;
            const offset = splitMs - clip.startMs;
            const sourceSplit = clip.sourceStartMs + offset;
            const leftClip: TimelineClip = { ...clip, endMs: splitMs, sourceEndMs: sourceSplit };
            const rightClip: TimelineClip = {
              ...clip,
              id: crypto.randomUUID(),
              startMs: splitMs,
              endMs: clip.endMs,
              sourceStartMs: sourceSplit,
            };
            const newClips = [...t.clips];
            newClips.splice(index, 1, leftClip, rightClip);
            return { ...t, clips: newClips };
          }),
        }));
      },

      addKeyframe: (clipId, kfData) => {
        trackHistory.save(get().timelineTracks);
        const id = crypto.randomUUID();
        const keyframe: AnimationKeyframe = { ...kfData, id };
        set(s => ({ timelineTracks: addKeyframeToClip(s.timelineTracks, clipId, keyframe) }));
        return id;
      },

      removeKeyframe: (clipId, keyframeId) => {
        trackHistory.save(get().timelineTracks);
        set(s => ({
          timelineTracks: removeKeyframeFromClip(s.timelineTracks, clipId, keyframeId),
        }));
      },

      updateKeyframe: (clipId, keyframeId, updates) => {
        trackHistory.save(get().timelineTracks);
        set(s => ({
          timelineTracks: updateKeyframeInClip(s.timelineTracks, clipId, keyframeId, updates),
        }));
      },

      setTimelineSelection: (clipId, trackId) =>
        set({ selectedClipId: clipId, selectedTrackId: trackId }),

      clearTimelineSelection: () => set({ selectedClipId: undefined, selectedTrackId: undefined }),

      setInPoint: () => set({ inPointMs: get().playheadMs }),
      setOutPoint: () => set({ outPointMs: get().playheadMs }),

      selectAllClips: () => {
        const allClipIds = get().timelineTracks.flatMap(t => t.clips.map(c => c.id));
        if (allClipIds.length === 0) return;
        const [firstId, ...restIds] = allClipIds;
        const firstTrack = get().timelineTracks.find(t => t.clips.some(c => c.id === firstId));
        set({
          selectedClipId: firstId,
          selectedTrackId: firstTrack?.id,
          selectedMultipleIds: restIds,
        });
      },

      setTimelineDuration: ms => set({ timelineDuration: Math.max(0, ms) }),

      saveTrackHistory: () => trackHistory.save(get().timelineTracks),
      undoTrack: () => {
        const prev = trackHistory.undo(get().timelineTracks);
        if (prev !== undefined) set({ timelineTracks: prev });
      },
      redoTrack: () => {
        const next = trackHistory.redo(get().timelineTracks);
        if (next !== undefined) set({ timelineTracks: next });
      },
      canUndoTrack: () => trackHistory.canUndo(),
      canRedoTrack: () => trackHistory.canRedo(),
    };
  },
});
