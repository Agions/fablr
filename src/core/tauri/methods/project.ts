/**
 * project — Tauri IPC 方法（v3 SQLite-backed · Stage 12.5）
 *
 * 替代 v2 文件存储的 `project.ts`（saveProjectFile / loadProjectFile），
 * 改为 SQLite-backed ProjectService：
 * - project.create / project.list / project.load / project.save / project.delete
 *
 * 数据模型：见 `src/core/models/` (Project / Job / Artifact)
 * 后端实现：见 `src-tauri/src/commands/project.rs`
 */

import { invoke, TauriCommand } from '../invoke';
import type { ContentIntent, IntentConfig } from '@/core/models/intent';
import type { ProjectDto } from '../command-types';

// ─── 公共类型 ──────────────────────────────────────────────

/** Project = ProjectDto（与 Rust ProjectDto 对齐的 IPC 数据契约） */
export type Project = ProjectDto;

// ─── Input DTO ──────────────────────────────────────────────

/** project_create 入参 */
export interface CreateProjectInput {
  id?: string;
  name: string;
  videoPath: string;
  durationSecs: number;
  metadata: Record<string, unknown>;
  intent?: IntentConfig;
}

/** project_save 入参 */
export interface SaveProjectInput {
  id: string;
  name: string;
  intent: IntentConfig;
  videoPath: string;
  subtitlePath: string | null;
}

// ─── 统一导出 ──────────────────────────────────────────────

export const project = {
  // ─── v3 核心 5 个方法（SQLite-backed） ──────────────────

  /**
   * 创建项目（含 IntentConfig）
   * - intent 可选，不传则后端用 DEFAULT_INTENT_CONFIG（short-drama / 180s / 中性）
   * - id 可选，不传则后端自动生成
   */
  async create(input: CreateProjectInput): Promise<Project> {
    return invoke(TauriCommand.PROJECT_CREATE, input as unknown as Record<string, unknown>);
  },

  /** 列出所有项目（按 updatedAt 降序） */
  async list(): Promise<Project[]> {
    return invoke(TauriCommand.PROJECT_LIST, undefined);
  },

  /** 加载单个项目（含最新任务状态） */
  async load(id: string): Promise<Project> {
    return invoke(TauriCommand.PROJECT_LOAD, { id });
  },

  /** 保存项目元数据 */
  async save(input: SaveProjectInput): Promise<Project> {
    return invoke(TauriCommand.PROJECT_SAVE, input as unknown as Record<string, unknown>);
  },

  /** 删除项目（级联任务和产物） */
  async delete(id: string): Promise<void> {
    await invoke(TauriCommand.PROJECT_DELETE, { id });
  },

  /**
   * 工厂：给定 intent 名称推导默认 IntentConfig
   * v3.1 接入 AI 自动判断（基于视频元数据），v3 仅返回 default
   */
  async recommendIntent(_videoPath: string): Promise<IntentConfig> {
    const { DEFAULT_INTENT_CONFIG } = await import('@/core/models/intent');
    return DEFAULT_INTENT_CONFIG;
  },
};

/** Re-export 常用类型 */
export type { ContentIntent, IntentConfig };
