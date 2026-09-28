/**
 * TauriVideoProcessor — 单元测试（mock @/core/tauri + @tauri-apps/api/event）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/core/tauri', () => ({
  tauri: {
    checkFFmpeg: vi.fn(),
    analyzeVideo: vi.fn(),
    cutVideo: vi.fn(),
    generatePreview: vi.fn(),
    exportVideo: vi.fn(),
    cancelExport: vi.fn(),
    extractKeyFrames: vi.fn(),
  },
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

import { tauri } from '@/core/tauri';
import { listen } from '@tauri-apps/api/event';
import { TauriVideoProcessor, videoProcessor } from './tauri-video-processor';

const checkFFmpegMock = vi.mocked(tauri.checkFFmpeg);
const analyzeVideoMock = vi.mocked(tauri.analyzeVideo);
const cutVideoMock = vi.mocked(tauri.cutVideo);
const generatePreviewMock = vi.mocked(tauri.generatePreview);
const exportVideoMock = vi.mocked(tauri.exportVideo);
const cancelExportMock = vi.mocked(tauri.cancelExport);
const extractKeyFramesMock = vi.mocked(tauri.extractKeyFrames);
const listenMock = vi.mocked(listen);

describe('TauriVideoProcessor', () => {
  let processor: TauriVideoProcessor;
  // mock 当前时间以跳过 BaseVideoProcessor 的 FFmpeg 状态缓存（30s TTL）。
  // 每次测试递增 1 分钟，保证不同测试间缓存一定过期。
  let mockNow = 1_700_000_000_000;

  beforeEach(() => {
    mockNow += 60_000;
    vi.spyOn(Date, 'now').mockReturnValue(mockNow);
    // FFmpeg 已安装（避免 BaseVideoProcessor 抛"未安装FFmpeg"）
    checkFFmpegMock.mockReset();
    checkFFmpegMock.mockResolvedValue({ installed: true, version: '6.0' });
    analyzeVideoMock.mockReset();
    cutVideoMock.mockReset();
    generatePreviewMock.mockReset();
    exportVideoMock.mockReset();
    cancelExportMock.mockReset();
    listenMock.mockReset();
    listenMock.mockResolvedValue(() => {}); // 默认返回 noop unlisten
    processor = new TauriVideoProcessor();
  });

  // ---------- FFmpeg ----------

  describe('checkStatus / ensureAvailable', () => {
    it('caches installed=true after first call', async () => {
      const status = await processor.checkStatus();
      expect(status.installed).toBe(true);
      expect(status.version).toBe('6.0');
      expect(checkFFmpegMock).toHaveBeenCalledOnce();
    });

    it('ensureAvailable returns true when FFmpeg installed', async () => {
      const ok = await processor.ensureAvailable();
      expect(ok).toBe(true);
    });
  });

  describe('getHardwareAcceleration', () => {
    it('returns null (no hardware acceleration util exposed)', async () => {
      const result = await processor.getHardwareAcceleration();
      expect(result).toBeNull();
    });
  });

  // ---------- Analysis ----------

  describe('analyze', () => {
    it('returns metadata mapped from tauri.analyzeVideo', async () => {
      analyzeVideoMock.mockResolvedValue({
        duration: 120,
        width: 1920,
        height: 1080,
        fps: 30,
        codec: 'h264',
        bitrate: 5000,
      });
      const meta = await processor.analyze('/v/a.mp4');
      expect(meta).toEqual({
        duration: 120,
        width: 1920,
        height: 1080,
        fps: 30,
        codec: 'h264',
        bitrate: 5000,
      });
    });

    it('throws when videoPath is empty', async () => {
      await expect(processor.analyze('')).rejects.toThrow(/路径/);
    });

    it('throws when FFmpeg not installed', async () => {
      checkFFmpegMock.mockResolvedValue({ installed: false });
      await expect(processor.analyze('/v/a.mp4')).rejects.toThrow(/FFmpeg/);
    });
  });

  // ---------- Extraction ----------

  describe('extractKeyFrames', () => {
    it('calls tauri.extractKeyFrames and returns KeyFrame array', async () => {
      extractKeyFramesMock.mockResolvedValue(['/tmp/f1.jpg', '/tmp/f2.jpg']);
      const frames = await processor.extractKeyFrames('/v/a.mp4', { maxFrames: 2, sceneThreshold: 0.4 }, 20);
      expect(extractKeyFramesMock).toHaveBeenCalledWith('/v/a.mp4', {
        maxFrames: 2,
        sceneThreshold: 0.4,
      });
      expect(frames).toHaveLength(2);
      expect(frames[0].path).toBe('/tmp/f1.jpg');
      expect(frames[1].path).toBe('/tmp/f2.jpg');
    });

    it('returns empty array when tauri command fails or returns empty', async () => {
      extractKeyFramesMock.mockResolvedValue([]);
      const frames = await processor.extractKeyFrames('/v/a.mp4');
      expect(frames).toEqual([]);
    });

    it('throws when videoPath is empty', async () => {
      await expect(processor.extractKeyFrames('')).rejects.toThrow(/路径/);
    });
  });

  describe('generateThumbnail', () => {
    it('returns empty string (no tauri command exposed)', async () => {
      const path = await processor.generateThumbnail('/v/a.mp4');
      expect(path).toBe('');
    });

    it('throws when videoPath is empty', async () => {
      await expect(processor.generateThumbnail('')).rejects.toThrow(/路径/);
    });
  });

  // ---------- Editing ----------

  describe('cut', () => {
    it('maps SimpleVideoSegment[] to {start,end}[] and returns tauri result', async () => {
      cutVideoMock.mockResolvedValue('/out/cut.mp4');
      const result = await processor.cut('/in.mp4', '/out.mp4', [
        { start: 0, end: 5 },
        { start: 10, end: 20 },
      ]);
      expect(result).toBe('/out/cut.mp4');
      expect(cutVideoMock).toHaveBeenCalledWith('/in.mp4', '/out.mp4', [
        { start: 0, end: 5 },
        { start: 10, end: 20 },
      ]);
    });

    it('subscribes to processing-progress when onProgress is provided', async () => {
      cutVideoMock.mockResolvedValue('/out.mp4');
      const onProgress = vi.fn();
      await processor.cut('/in.mp4', '/out.mp4', [{ start: 0, end: 5 }], { onProgress });
      expect(listenMock).toHaveBeenCalledWith('processing-progress', expect.any(Function));
    });

    it('does not subscribe when onProgress is omitted', async () => {
      cutVideoMock.mockResolvedValue('/out.mp4');
      await processor.cut('/in.mp4', '/out.mp4', [{ start: 0, end: 5 }]);
      expect(listenMock).not.toHaveBeenCalled();
    });

    it('unsubscribes even when cut throws', async () => {
      const unlisten = vi.fn();
      listenMock.mockResolvedValue(unlisten);
      // 错误消息不包含 'ffmpeg/未安装/未找到视频流/权限/空间' 等关键词，
      // 避免触发 normalizeVideoError 的特殊归一化分支。
      cutVideoMock.mockRejectedValue(new Error('segmentation failed'));

      await expect(
        processor.cut('/in.mp4', '/out.mp4', [{ start: 0, end: 5 }], { onProgress: vi.fn() })
      ).rejects.toThrow('segmentation failed');
      expect(unlisten).toHaveBeenCalled();
    });

    it('invokes onProgress with event.payload when processing-progress fires (L85-L87)', async () => {
      // 捕获 listen 注册的回调，手动触发以覆盖 L86 (fn 7)：
      //   (event) => { options.onProgress?.(event.payload); }
      let capturedHandler: ((event: { payload: unknown }) => void) | null = null;
      const unlisten = vi.fn();
      listenMock.mockImplementation(async (_event, handler) => {
        capturedHandler = handler as (event: { payload: unknown }) => void;
        return unlisten;
      });
      cutVideoMock.mockResolvedValue('/out.mp4');

      const onProgress = vi.fn();
      await processor.cut('/in.mp4', '/out.mp4', [{ start: 0, end: 5 }], { onProgress });

      expect(capturedHandler).not.toBeNull();
      capturedHandler!({ payload: { progress: 0.42, stage: 'muxing' } });
      expect(onProgress).toHaveBeenCalledWith({ progress: 0.42, stage: 'muxing' });
      expect(unlisten).toHaveBeenCalled();
    });

    it('throws when input or output path is empty', async () => {
      await expect(processor.cut('', '/out.mp4', [{ start: 0, end: 5 }])).rejects.toThrow();
      await expect(processor.cut('/in.mp4', '', [{ start: 0, end: 5 }])).rejects.toThrow();
    });

    it('throws when segments is empty', async () => {
      await expect(processor.cut('/in.mp4', '/out.mp4', [])).rejects.toThrow(/片段/);
    });
  });

  describe('preview', () => {
    it('passes segment {start,end} to tauri.generatePreview', async () => {
      generatePreviewMock.mockResolvedValue('/preview.mp4');
      const result = await processor.preview('/in.mp4', { start: 5, end: 10 });
      expect(result).toBe('/preview.mp4');
      expect(generatePreviewMock).toHaveBeenCalledWith('/in.mp4', { start: 5, end: 10 });
    });

    it('throws when videoPath is empty', async () => {
      await expect(processor.preview('', { start: 0, end: 5 })).rejects.toThrow(/路径/);
    });
  });

  // ---------- Export (Tauri-specific: doExport / doCancelExport) ----------

  describe('export / cancelExport (Tauri-only protected hooks)', () => {
    // 子类把 protected 方法暴露为 public，便于直接验证
    class TestableProcessor extends TauriVideoProcessor {
      publicExport = (
        inputPath: string,
        outputPath: string,
        format: string,
        options?: Parameters<TauriVideoProcessor['doExport']>[3]
      ) =>
        (
          this as unknown as {
            doExport: (a: string, b: string, c: string, d?: unknown) => Promise<string>;
          }
        ).doExport(inputPath, outputPath, format, options as unknown);
      publicCancelExport = (exportId: string) =>
        (this as unknown as { doCancelExport: (id: string) => Promise<void> }).doCancelExport(
          exportId
        );
    }

    it('doExport returns result.outputPath from tauri.exportVideo', async () => {
      exportVideoMock.mockResolvedValue({
        outputPath: '/exported.mp4',
        duration: 10,
        fileSize: 1024,
      });
      const tp = new TestableProcessor();
      const result = await tp.publicExport('/in.mp4', '/out.mp4', 'mp4');
      expect(result).toBe('/exported.mp4');
    });

    it('forwards optional export options to tauri.exportVideo', async () => {
      exportVideoMock.mockResolvedValue({ outputPath: '/e.mp4', duration: 0, fileSize: 0 });
      const tp = new TestableProcessor();
      await tp.publicExport('/in.mp4', '/out.mp4', 'mp4', {
        resolution: '1080p',
        frameRate: 60,
        videoCodec: 'h264',
        audioCodec: 'aac',
        crf: 23,
        subtitleEnabled: true,
        subtitlePath: '/s.ass',
        burnSubtitles: false,
      });
      expect(exportVideoMock).toHaveBeenCalledWith({
        inputPath: '/in.mp4',
        outputPath: '/out.mp4',
        format: 'mp4',
        resolution: '1080p',
        frameRate: 60,
        videoCodec: 'h264',
        audioCodec: 'aac',
        crf: 23,
        subtitleEnabled: true,
        subtitlePath: '/s.ass',
        burnSubtitles: false,
      });
    });

    it('doCancelExport passes exportId to tauri.cancelExport', async () => {
      cancelExportMock.mockResolvedValue(undefined);
      const tp = new TestableProcessor();
      await tp.publicCancelExport('export-42');
      expect(cancelExportMock).toHaveBeenCalledWith('export-42');
    });
  });

  // ---------- Singleton ----------

  describe('videoProcessor singleton', () => {
    it('is an instance of TauriVideoProcessor', () => {
      expect(videoProcessor).toBeInstanceOf(TauriVideoProcessor);
    });
  });
});
