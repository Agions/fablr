/**
 * Video Analysis Tauri Methods — 单元测试
 *
 * 测试三个 invoke 封装方法：
 *  - checkFFmpeg：返回 { installed, version? }
 *  - analyzeVideo：传入 path，返回 VideoMetadataResult
 *  - runFFprobe：传入 args，返回原始输出字符串
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../invoke', () => ({
  invoke: vi.fn(),
  TauriCommand: {
    CHECK_FFMPEG: 'check_ffmpeg',
    SYSTEM_DIAGNOSTICS: 'system_diagnostics',
    ANALYZE_VIDEO: 'analyze_video',
    RUN_FFPROBE: 'run_ffprobe',
    EXTRACT_KEY_FRAMES: 'extract_key_frames',
  },
}));

import { invoke, TauriCommand } from '../invoke';
import { videoAnalysis } from './video-analysis';

const invokeMock = vi.mocked(invoke);

describe('videoAnalysis tauri methods', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  describe('videoAnalysis.checkFFmpeg', () => {
    it('invokes CHECK_FFMPEG with undefined args and returns the result', async () => {
      invokeMock.mockResolvedValue({ installed: true, version: '6.1.1' });

      const result = await videoAnalysis.checkFFmpeg();

      expect(result).toEqual({ installed: true, version: '6.1.1' });
      expect(invokeMock).toHaveBeenCalledWith(TauriCommand.CHECK_FFMPEG, undefined);
    });

    it('returns installed=false when FFmpeg is missing', async () => {
      invokeMock.mockResolvedValue({ installed: false });

      const result = await videoAnalysis.checkFFmpeg();

      expect(result).toEqual({ installed: false });
    });

    it('propagates errors thrown by invoke', async () => {
      invokeMock.mockRejectedValue(new Error('binary not found'));

      await expect(videoAnalysis.checkFFmpeg()).rejects.toThrow('binary not found');
    });
  });

  describe('videoAnalysis.analyzeVideo', () => {
    it('invokes ANALYZE_VIDEO with { path } and returns metadata', async () => {
      const meta = {
        duration: 60,
        width: 1920,
        height: 1080,
        fps: 30,
        codec: 'h264',
        bitrate: 5000,
      };
      invokeMock.mockResolvedValue(meta);

      const result = await videoAnalysis.analyzeVideo('/v/movie.mp4');

      expect(result).toEqual(meta);
      expect(invokeMock).toHaveBeenCalledWith(TauriCommand.ANALYZE_VIDEO, { path: '/v/movie.mp4' });
    });

    it('propagates errors thrown by invoke', async () => {
      invokeMock.mockRejectedValue(new Error('decode failed'));

      await expect(videoAnalysis.analyzeVideo('/bad.mp4')).rejects.toThrow('decode failed');
    });
  });

  describe('videoAnalysis.runFFprobe', () => {
    it('invokes RUN_FFPROBE with { args } and returns raw output', async () => {
      invokeMock.mockResolvedValue('Stream #0:0 video h264 1920x1080');

      const result = await videoAnalysis.runFFprobe(['-v', 'error', '-show_streams', '/v/a.mp4']);

      expect(result).toBe('Stream #0:0 video h264 1920x1080');
      expect(invokeMock).toHaveBeenCalledWith(TauriCommand.RUN_FFPROBE, {
        args: ['-v', 'error', '-show_streams', '/v/a.mp4'],
      });
    });

    it('forwards empty args array', async () => {
      invokeMock.mockResolvedValue('');

      await videoAnalysis.runFFprobe([]);

      expect(invokeMock).toHaveBeenCalledWith(TauriCommand.RUN_FFPROBE, { args: [] });
    });

    it('propagates errors thrown by invoke', async () => {
      invokeMock.mockRejectedValue(new Error('ffprobe crashed'));

      await expect(videoAnalysis.runFFprobe([])).rejects.toThrow('ffprobe crashed');
    });
  });

  describe('videoAnalysis.extractKeyFrames', () => {
    it('invokes EXTRACT_KEY_FRAMES and returns frame paths', async () => {
      invokeMock.mockResolvedValue(['/tmp/frame1.jpg']);

      const result = await videoAnalysis.extractKeyFrames('/v/movie.mp4', {
        maxFrames: 5,
        sceneThreshold: 0.35,
      });

      expect(result).toEqual(['/tmp/frame1.jpg']);
      expect(invokeMock).toHaveBeenCalledWith(TauriCommand.EXTRACT_KEY_FRAMES, {
        path: '/v/movie.mp4',
        maxFrames: 5,
        sceneThreshold: 0.35,
      });
    });

    it('propagates errors thrown by invoke', async () => {
      invokeMock.mockRejectedValue(new Error('extraction failed'));

      await expect(videoAnalysis.extractKeyFrames('/v/bad.mp4')).rejects.toThrow('extraction failed');
    });
  });

  describe('videoAnalysis.runSystemDiagnostics', () => {
    it('invokes SYSTEM_DIAGNOSTICS with undefined and returns diagnostics report', async () => {
      const mockReport = {
        os: 'macos',
        arch: 'aarch64',
        ffmpegInstalled: true,
        ffmpegPath: '/opt/homebrew/bin/ffmpeg',
        ffmpegVersion: 'ffmpeg 7.0',
        ffprobeInstalled: true,
        ffprobePath: '/opt/homebrew/bin/ffprobe',
        hwAccel: 'videotoolbox',
        hwAccelName: 'Apple VideoToolbox',
        pythonInstalled: true,
        pythonPath: '/usr/bin/python3',
        whisperAvailable: true,
      };
      invokeMock.mockResolvedValue(mockReport);

      const result = await videoAnalysis.runSystemDiagnostics();

      expect(result).toEqual(mockReport);
      expect(invokeMock).toHaveBeenCalledWith(TauriCommand.SYSTEM_DIAGNOSTICS, undefined);
    });

    it('propagates errors thrown by invoke', async () => {
      invokeMock.mockRejectedValue(new Error('diagnostics failed'));

      await expect(videoAnalysis.runSystemDiagnostics()).rejects.toThrow('diagnostics failed');
    });
  });
});
