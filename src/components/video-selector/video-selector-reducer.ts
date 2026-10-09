/**
 * VideoSelector Reducer — 视频选择状态机
 *
 * 5 个 useState → 1 个 reducer:
 * - videoPath: 当前选中视频路径 / 文件名
 * - videoSrc:  视频预览 src (convertFileSrc 或 blob:)
 * - metadata:  视频元信息 (duration/width/height/fps/codec/bitrate)
 * - isAnalyzing: 是否正在分析中
 * - isDragging: 拖拽 UI 高亮
 *
 * 改造: 用 createReducer 工厂 + handler map 自动生成。
 * action 统一 payload 包装: { type: 'SET_X'; payload: T }。
 */
import type { VideoMetadata } from '@/core/video';
import { createReducer } from '@/shared/hooks/create-reducer';

export interface VideoSelectorState {
  videoPath: string | null;
  videoSrc: string | null;
  metadata: VideoMetadata | null;
  isAnalyzing: boolean;
  isDragging: boolean;
}

export type VideoSelectorAction =
  | { type: 'SET_VIDEO_PATH'; payload: string | null }
  | { type: 'SET_VIDEO_SRC'; payload: string | null }
  | { type: 'SET_METADATA'; payload: VideoMetadata | null }
  | { type: 'SET_IS_ANALYZING'; payload: boolean }
  | { type: 'SET_IS_DRAGGING'; payload: boolean }
  | { type: 'RESET'; payload: undefined };

export const initialVideoSelectorState: VideoSelectorState = {
  videoPath: null,
  videoSrc: null,
  metadata: null,
  isAnalyzing: false,
  isDragging: false,
};

const handlers = {
  SET_VIDEO_PATH: (s: VideoSelectorState, v: string | null) => ({ ...s, videoPath: v }),
  SET_VIDEO_SRC: (s: VideoSelectorState, v: string | null) => ({ ...s, videoSrc: v }),
  SET_METADATA: (s: VideoSelectorState, v: VideoMetadata | null) => ({ ...s, metadata: v }),
  SET_IS_ANALYZING: (s: VideoSelectorState, v: boolean) => ({ ...s, isAnalyzing: v }),
  SET_IS_DRAGGING: (s: VideoSelectorState, v: boolean) => ({ ...s, isDragging: v }),
  RESET: () => initialVideoSelectorState,
};

export const [videoSelectorReducer] = createReducer<VideoSelectorState, typeof handlers>(
  'VIDEO_SELECTOR',
  handlers,
  initialVideoSelectorState,
);
