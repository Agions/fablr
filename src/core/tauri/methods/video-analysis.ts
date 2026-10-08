import { invoke, TauriCommand } from '../invoke';
import type { SystemDiagnosticsResult } from '../command-types';
import type { VideoMetadataResult } from '@/types';

export const videoAnalysis = {
  /** 检查 FFmpeg 是否已安装 */
  async checkFFmpeg(): Promise<{ installed: boolean; version?: string }> {
    return invoke(TauriCommand.CHECK_FFMPEG, undefined);
  },

  /** 执行系统运行环境与硬件加速自检 */
  async runSystemDiagnostics(): Promise<SystemDiagnosticsResult> {
    return invoke(TauriCommand.SYSTEM_DIAGNOSTICS, undefined);
  },

  /** 分析视频，返回元数据 */
  async analyzeVideo(path: string): Promise<VideoMetadataResult> {
    return invoke(TauriCommand.ANALYZE_VIDEO, { path });
  },

  /** 提取视频关键帧 */
  async extractKeyFrames(
    path: string,
    options?: { maxFrames?: number; sceneThreshold?: number }
  ): Promise<string[]> {
    return invoke(TauriCommand.EXTRACT_KEY_FRAMES, {
      path,
      maxFrames: options?.maxFrames,
      sceneThreshold: options?.sceneThreshold,
    });
  },

  /** 运行 FFprobe，返回原始输出 */
  async runFFprobe(args: string[]): Promise<string> {
    return invoke(TauriCommand.RUN_FFPROBE, { args });
  },
};

