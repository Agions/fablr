/**
 * Services 统一导出
 * 只导出服务实例，类型统一从 @/types 或 @/core/models 导入
 */

// 基础 & providers
export { BaseService, ServiceError } from './providers/base-service';
export * from './providers';

// AI 服务（ai/ 子目录 — 模型调用层）
export { aiService } from './ai/ai-service';
export { visionService } from './ai/vision-service';
export { voiceSynthesisService, VoiceSynthesisService } from './ai/voice-synthesis-service';
export { scriptGenerationService } from './ai/script-service';
export { resolveLegacyModel, getLegacyModelCompatMap } from './ai/ai-model-adapter';

// AI 剪辑批处理（ai-clip/ — 原 ai/batch/，现提升到 services/ 一级）
export { aiClipService, AIClipService } from './ai-clip';
export { analyzeVideo } from './ai-clip/analyzer';
export { batchProcess } from './ai-clip/batch-processor';

// 剪辑 pipeline（pipeline/clip-pipeline/ — 原 ai/pipeline/，现提升到 services/ 一级）
export { clipWorkflowService, ClipWorkflowService } from './pipeline/clip-pipeline/clip-workflow';
export { clipRepurposingPipeline, ClipRepurposingPipeline } from './pipeline/clip-pipeline/pipeline';
export { clipScorer } from './pipeline/clip-pipeline/clip-scorer';
export { multiExporter } from './pipeline/clip-pipeline/multi-export';
export { seoGenerator } from './pipeline/clip-pipeline/seo-generator';

// 导出服务（export/ 子目录）
export { exportService, ExportService } from './export/export-service';

// 字幕服务（subtitle/ 子目录）
export { subtitleService, SubtitleService } from './subtitle/subtitle-service';

// 视频特效 & 信号（video/ 子目录）
export { videoEffectService, VideoEffectService } from './video/video-effect-service';
export { detectEmotionPeaks, calculateEmotionScore } from './video/emotion-detector';

// 项目与升级服务
export { atomicFileDriver, AtomicProjectFileDriver } from './project/atomic-file-driver';
export { updaterService, UpdaterService, detectHostPlatform, findMatchingAsset, compareSemVer } from './updater/updater-service';