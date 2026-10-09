/**
 * useVideoEditorPage reducer — 集中 15 useState 状态机
 * 来源: refactor/video-editor-page-usereducer (v3.4 §A2 范式)
 * 模式: 1 hook + 1 .reducer.ts + createAutoSetters + Updater<T>
 */
import type { ScriptSegment } from '@/types';
import type { Updater } from '@/shared/hooks/use-auto-setters';
import { genericUpdateReducer } from '@/shared/hooks/use-auto-setters';

export type TransitionType = 'none' | 'fade' | 'dissolve' | 'wipe' | 'slide';

export interface ExportSettingsState {
  videoQuality: string;
  exportFormat: string;
  transitionType: TransitionType;
  transitionDuration: number;
  audioVolume: number;
  useSubtitles: boolean;
}

export interface VideoEditorPageState {
  // player (3 — 保留丢弃 setter 兼容原 API)
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  // processing (2)
  processing: boolean;
  processProgress: number;
  // segment (2)
  selectedSegment: ScriptSegment | null;
  editedSegments: ScriptSegment[];
  // export (3)
  exportSettings: ExportSettingsState;
  settingsTab: string;
  showSettingsModal: boolean;
  // preview (4)
  showPreviewModal: boolean;
  previewSegment: ScriptSegment | null;
  previewLoading: boolean;
  previewUrl: string;
  // drag (3)
  isDragging: boolean;
  dragType: 'move' | 'start' | 'end' | null;
  dragSegmentId: string | null;
}

export const initialVideoEditorPageState: VideoEditorPageState = {
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  processing: false,
  processProgress: 0,
  selectedSegment: null,
  editedSegments: [],
  exportSettings: {
    videoQuality: 'medium',
    exportFormat: 'mp4',
    transitionType: 'fade',
    transitionDuration: 1,
    audioVolume: 100,
    useSubtitles: true,
  },
  settingsTab: 'general',
  showSettingsModal: false,
  showPreviewModal: false,
  previewSegment: null,
  previewLoading: false,
  previewUrl: '',
  isDragging: false,
  dragType: null,
  dragSegmentId: null,
};

export type VideoEditorPageAction = {
  type: 'update';
  key: keyof VideoEditorPageState;
  updater: Updater<unknown>;
};

export const videoEditorPageReducer = genericUpdateReducer<VideoEditorPageState>;
