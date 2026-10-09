/**
 * VideoPlayer Reducer — 视频播放器状态机 (A 类纯 setter，payload 包装风格)
 *
 * 改造前: 55 LoC 同构 switch 样板
 * 改造后: 32 LoC —— 用 createReducer 工厂 + handler map 自动生成。
 *
 * 5 个 useState → 1 个 reducer:
 * - isPlaying / currentTime / duration / volume / showVolumeSlider
 */
import { createReducer } from '@/shared/hooks/create-reducer';

export interface VideoPlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  showVolumeSlider: boolean;
}

export const initialVideoPlayerState: VideoPlayerState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  showVolumeSlider: false,
};

/**
 * action 统一 payload 包装。
 * 字段名：SET_IS_PLAYING → payload: boolean; SET_CURRENT_TIME → payload: number ...
 */
export type VideoPlayerAction =
  | { type: 'SET_IS_PLAYING'; payload: boolean }
  | { type: 'SET_CURRENT_TIME'; payload: number }
  | { type: 'SET_DURATION'; payload: number }
  | { type: 'SET_VOLUME'; payload: number }
  | { type: 'SET_SHOW_VOLUME_SLIDER'; payload: boolean };

const handlers = {
  SET_IS_PLAYING: (s: VideoPlayerState, v: boolean) => ({ ...s, isPlaying: v }),
  SET_CURRENT_TIME: (s: VideoPlayerState, v: number) => ({ ...s, currentTime: v }),
  SET_DURATION: (s: VideoPlayerState, v: number) => ({ ...s, duration: v }),
  SET_VOLUME: (s: VideoPlayerState, v: number) => ({ ...s, volume: v }),
  SET_SHOW_VOLUME_SLIDER: (s: VideoPlayerState, v: boolean) => ({ ...s, showVolumeSlider: v }),
};

export const [videoPlayerReducer] =
  createReducer<VideoPlayerState, typeof handlers>(
    'VIDEO_PLAYER',
    handlers,
    initialVideoPlayerState,
  );
