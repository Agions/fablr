/**
 * videoPlayerReducer 测试
 */
import { describe, it, expect } from 'vitest';
import { videoPlayerReducer, initialVideoPlayerState } from './video-player-reducer';
import type { VideoPlayerState } from './video-player-reducer';

const makeState = (overrides?: Partial<VideoPlayerState>): VideoPlayerState => ({
  ...initialVideoPlayerState,
  ...overrides,
});

describe('videoPlayerReducer', () => {
  describe('SET_IS_PLAYING', () => {
    it('sets isPlaying to true', () => {
      expect(videoPlayerReducer(makeState(), { type: 'SET_IS_PLAYING', payload: true }).isPlaying).toBe(true);
    });

    it('sets isPlaying to false', () => {
      const prev = makeState({ isPlaying: true });
      expect(videoPlayerReducer(prev, { type: 'SET_IS_PLAYING', payload: false }).isPlaying).toBe(false);
    });
  });

  describe('SET_CURRENT_TIME', () => {
    it('sets currentTime', () => {
      expect(videoPlayerReducer(makeState(), { type: 'SET_CURRENT_TIME', payload: 42.5 }).currentTime).toBe(42.5);
    });

    it('sets currentTime to 0', () => {
      const prev = makeState({ currentTime: 100 });
      expect(videoPlayerReducer(prev, { type: 'SET_CURRENT_TIME', payload: 0 }).currentTime).toBe(0);
    });
  });

  describe('SET_DURATION', () => {
    it('sets duration', () => {
      expect(videoPlayerReducer(makeState(), { type: 'SET_DURATION', payload: 3600 }).duration).toBe(3600);
    });
  });

  describe('SET_VOLUME', () => {
    it('sets volume', () => {
      expect(videoPlayerReducer(makeState(), { type: 'SET_VOLUME', payload: 0.5 }).volume).toBe(0.5);
    });

    it('sets volume to 0 (muted)', () => {
      expect(videoPlayerReducer(makeState(), { type: 'SET_VOLUME', payload: 0 }).volume).toBe(0);
    });

    it('sets volume to 1 (max)', () => {
      const prev = makeState({ volume: 0.3 });
      expect(videoPlayerReducer(prev, { type: 'SET_VOLUME', payload: 1 }).volume).toBe(1);
    });
  });

  describe('SET_SHOW_VOLUME_SLIDER', () => {
    it('sets showVolumeSlider to true', () => {
      expect(videoPlayerReducer(makeState(), { type: 'SET_SHOW_VOLUME_SLIDER', payload: true }).showVolumeSlider).toBe(true);
    });

    it('sets showVolumeSlider to false', () => {
      const prev = makeState({ showVolumeSlider: true });
      expect(videoPlayerReducer(prev, { type: 'SET_SHOW_VOLUME_SLIDER', payload: false }).showVolumeSlider).toBe(false);
    });
  });

  describe('immutability', () => {
    it('does not mutate original state', () => {
      const state = makeState({ isPlaying: false });
      const next = videoPlayerReducer(state, { type: 'SET_IS_PLAYING', payload: true });
      expect(state.isPlaying).toBe(false);
      expect(next.isPlaying).toBe(true);
      expect(next).not.toBe(state);
    });
  });

  describe('default', () => {
    it('returns same state for unknown action', () => {
      const state = makeState();
      // Test default case: pass an unknown action via unknown cast
      const unknownAction = { type: 'UNKNOWN' } as unknown as Parameters<typeof videoPlayerReducer>[1];
      expect(videoPlayerReducer(state, unknownAction)).toBe(state);
    });
  });
});
