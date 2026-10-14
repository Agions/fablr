/**
 * Video Processing Module
 *
 * 架构：
 * - IVideoProcessor.ts    → 接口（后端无关）
 * - BaseVideoProcessor.ts → 基类（通用逻辑：错误归一化、FFmpeg 缓存）
 * - TauriVideoProcessor.ts → Tauri invoke 实现
 * - formatters.ts         → 纯格式化函数
 *
 * 类型已统一从 @/types 导入（2026-07 Stage 8 PR-1.4）
 *
 * 使用方式：
 *   import { videoProcessor } from '@/core/video';
 *   const metadata = await videoProcessor.analyze('/path/to/video.mp4');
 *
 * 实现新驱动（以 WebCodecs 为例）：
 *   class WebCodecsVideoProcessor extends BaseVideoProcessor {
 *     protected doAnalyze(path) { ... }
 *     ...
 *   }
 */
export * from './ivideo-processor';
export {
  BaseVideoProcessor,
  VideoProcessingError,
  normalizeVideoError,
} from './base-video-processor';
export { videoProcessor, TauriVideoProcessor } from './tauri-video-processor';
export * from './formatters';
export * from './output-colors';
export * from './deduplication-matrix';
