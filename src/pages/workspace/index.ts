/**
 * Fablr Workspace — 专业视听剪辑工作台导出
 * 统一暴露 Dark Studio 剪辑台、5轨时间轴、视听类型与共享配置
 */
export { default, WorkspaceStudioPage, WorkspacePage } from './index.tsx';
export * from './types';
export * from './shared';

// 兼容旧架构向后引用
export { default as ProjectSetup } from './edit-step/project-setup';
export { default as VideoUpload } from './edit-step/video-upload';
export { default as AIVisualizer } from './assemble/ai-visualizer';
export { default as ScriptWriting } from './edit-step/script-writing';
export { default as VideoComposing } from './assemble/video-composing';
export { default as ClipRippling } from './assemble/clip-rippling';
export { Highlights, type Highlight, type HighlightsProps } from './assemble/highlights/highlights';

export * as editStep from './edit-step';
export * as assemble from './assemble';
