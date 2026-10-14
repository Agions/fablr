/**
 * 项目相关类型定义
 * 合并自 core/types.ts + core/types/video-project.ts + shared/types/project.ts
 */

// ─── 项目状态 ───

/**
 * 项目状态。
 *
 * 历史上一度存在一个并行的 ProjectUIStatus（缺 'failed'）。
 * 现统一为单一枚举；UI 端点无需此类型时仍可直接引用 ProjectStatus。
 */
export type ProjectStatus = 'draft' | 'processing' | 'completed' | 'failed';

/** UI 端状态枚举别名（与 ProjectStatus 统一对齐，避免缺少 failed 状态） */
export type ProjectUIStatus = ProjectStatus;

// ─── 项目模型 ───

export interface Project {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  duration: number;
  size: number;
  status: ProjectStatus;
  tags: string[];
  starred: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 项目在主页面（项目列表、工作台、详情）中流通的视图模型。
 *
 * 过去曾分散为 ProjectView（shared/types）、ProjectDetailProject、Project、ProjectData 四种。
 * 现融为唯一「ProjectData」：同一类型的 shape 与字段含义全程一致。
 */
export interface ProjectData {
  id: string;
  name: string;
  description?: string;
  templateId?: string;
  templateName?: string;
  scripts?: import('./script').Script[];
  videoAssets?: import('./media').VideoAsset[];
  videos?: import('./media').VideoInfo[];
  settings?: Record<string, unknown>;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  videoPath?: string;
}

/** 卡片/列表所需的展示统计。推演自 ProjectData，但独立类型以保证 UI 侧语义。 */
export interface ProjectUIStats {
  scriptCount: number;
  videoCount: number;
  status: ProjectStatus;
  progress: number;
}

/**
 * 项目卡片/列表展示视图。
 *
 * 曾是 `shared/types/ProjectView`，现收口。
 * 与 {@link ProjectData} 的关键差异：视图层 `createdAt / updatedAt` 必填 string
 * （asProjectView 强制补全），而数据层这些字段可选。
 */
export interface ProjectView {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  scripts?: unknown[];
  videos?: unknown[];
  videoPath?: string;
}

export type { SubtitleStyle } from './subtitle';

// ─── 项目 UI 状态过滤 ───
// 与 {@link ProjectStatus 完全一致；仅能在 UI 过滤场景补一个 'all' 占位。
export type ProjectStatusFilter = 'all' | ProjectStatus;

// ─── 用户 ───

export interface User {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  role?: 'admin' | 'user';
}

export interface AppSettings {
  autoSave: boolean;
  defaultAIModel?: import('./analysis').ModelProvider;
  aiModelsSettings: Partial<
    Record<import('./analysis').ModelProvider, import('./analysis').AIModelSettings>
  >;
  theme?: 'light' | 'dark' | 'system';
}

// ─── 通用 ───

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

// ─── Detail-page project type (unified base) ─────────────────────────────────
// Replaces the duplicated base fields previously defined in both:
//   hooks/use-project-detail.reducer.ts  → ProjectDetailProject
//   hooks/use-script-detail.reducer.ts   → ScriptDetailProject
// Each consumer augments with its own `scripts` shape via intersection types.

export interface DetailProject {
  id: string;
  name: string;
  description?: string;
  status?: string;
  createdAt?: string;
  updatedAt: string;
  videoPath?: string;
  videos?: Array<{ path?: string }>;
  videoUrl?: string;
}

// Consumer-specific augmentations (kept narrow — only where actually needed)

export interface DetailProjectWithAIScripts extends DetailProject {
  scripts?: import('./script').AIScriptDraft[];
}
