/**
 * core/video/deduplication-matrix.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  buildDeduplicationAudioFilter,
  buildDeduplicationVideoFilter,
  buildFFmpegDeduplicationArgs,
  getDeduplicationPreset,
} from './deduplication-matrix';

describe('Video Deduplication Matrix', () => {
  describe('buildDeduplicationVideoFilter', () => {
    it('generates micro-zoom and crop filter', () => {
      const filter = buildDeduplicationVideoFilter({
        enableZoom: true,
        zoomFactor: 1.05,
      });

      expect(filter).toContain('scale=iw*1.050:ih*1.050');
      expect(filter).toContain('crop=iw/1.050:ih/1.050');
    });

    it('generates color jitter eq filter', () => {
      const filter = buildDeduplicationVideoFilter({
        enableColorJitter: true,
        contrastMultiplier: 1.04,
        brightnessDelta: 0.02,
        saturationMultiplier: 1.05,
      });

      expect(filter).toContain('eq=contrast=1.040:brightness=0.020:saturation=1.050');
    });

    it('generates decimate filter for frame dropping', () => {
      const filter = buildDeduplicationVideoFilter({
        enableDecimate: true,
        decimateCycle: 100,
      });

      expect(filter).toContain('decimate=cycle=100');
    });

    it('generates complex PIP background blur graph when enablePipBlur is active', () => {
      const filter = buildDeduplicationVideoFilter({
        enablePipBlur: true,
        pipBlurRadius: 30,
        outputResolution: { width: 1080, height: 1920 },
      });

      expect(filter).toContain('split=2[fg][bg]');
      expect(filter).toContain('boxblur=30:30');
      expect(filter).toContain('overlay=(W-w)/2:(H-h)/2');
    });
  });

  describe('buildDeduplicationAudioFilter', () => {
    it('generates resampling, equalizer, and compressor filter chain', () => {
      const aFilter = buildDeduplicationAudioFilter({
        enableAudioResampling: true,
      });

      expect(aFilter).toContain('aresample=48000');
      expect(aFilter).toContain('equalizer=f=8000');
      expect(aFilter).toContain('acompressor=threshold=-12dB');
    });

    it('returns anull when audio resampling is disabled', () => {
      const aFilter = buildDeduplicationAudioFilter({
        enableAudioResampling: false,
      });

      expect(aFilter).toBe('anull');
    });
  });

  describe('getDeduplicationPreset', () => {
    it('returns platform-optimized preset for douyin', () => {
      const preset = getDeduplicationPreset('douyin');

      expect(preset.enableZoom).toBe(true);
      expect(preset.enablePipBlur).toBe(true);
      expect(preset.outputResolution).toEqual({ width: 1080, height: 1920 });
      expect(preset.enableDecimate).toBe(true);
    });

    it('returns platform-optimized preset for bilibili', () => {
      const preset = getDeduplicationPreset('bilibili');

      expect(preset.outputResolution).toEqual({ width: 1920, height: 1080 });
      expect(preset.enablePipBlur).toBe(false);
      expect(preset.zoomFactor).toBe(1.02);
    });

    it('returns platform-optimized preset for xiaohongshu', () => {
      const preset = getDeduplicationPreset('xiaohongshu');

      expect(preset.outputResolution).toEqual({ width: 1080, height: 1440 });
      expect(preset.enablePipBlur).toBe(true);
    });
  });

  describe('buildFFmpegDeduplicationArgs', () => {
    it('assembles complete FFmpeg arguments list', () => {
      const preset = getDeduplicationPreset('douyin');
      const args = buildFFmpegDeduplicationArgs('/path/in.mp4', '/path/out.mp4', preset);

      expect(args[0]).toBe('-y');
      expect(args).toContain('-i');
      expect(args).toContain('/path/in.mp4');
      expect(args).toContain('-filter_complex');
      expect(args).toContain('-af');
      expect(args).toContain('-c:v');
      expect(args).toContain('libx264');
      expect(args).toContain('/path/out.mp4');
    });
  });
});
