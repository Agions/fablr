/**
 * Fablr 状态管理 - 统一导出
 * 使用 Zustand v5 + 持久化存储
 */

// ── 全局 UI 状态 + 设置 + AI 偏好 ──
export { useAppStore } from './app-store';

// ── 项目元数据与步骤状态机 (原 fablr-store) ──
export { useProjectStore } from './project-store';

// ── 编辑器运行时状态 (原 workspace-store) ──
export { useEditorStore } from './editor-store';

// ── 视听剧本与多智能体分镜状态机 (v3) ──
export { useScreenplayStore } from './screenplay-store';

// ── 混合推理与端侧模型路由状态机 (v3) ──
export { useModelRouterStore } from './model-router-store';

// 注意：useSettingsStore 已合并至 useAppStore.aiSettings，不再单独导出。
