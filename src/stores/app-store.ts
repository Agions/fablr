/**
 * AppStore — 全局 UI 状态 + 用户偏好（含 AI 设置）
 *
 * 职责边界：
 *  - 全局 UI 状态：sidebarCollapsed / theme / isDarkMode
 *  - 应用级设置：autoSave
 *  - 用户偏好：recentProjects（userSettings）
 *  - AI 模型偏好：selectedAIModel / aiModelsSettings（由 settings-store 合并而来）
 *
 * 持久化 key：fablr-app（向后兼容读取 legacy: StoryFab-app）
 * 中间件：devtools + persist（createPersistedStore 封装）
 */

import { createPersistedStore } from './create-persisted-store';
import { createJSONStorage } from 'zustand/middleware';
import type { AIModelSettings, ModelProvider } from '@/types';

// ─── 子状态接口 ──────────────────────────────────────────────

export interface UserSettings {
  /** 最近打开的项目 ID 列表（新 → 旧，限 50） */
  recentProjects: string[];
}

export interface AISettings {
  selectedAIModel: ModelProvider;
  aiModelsSettings: Record<ModelProvider, AIModelSettings>;
}

// ─── 主状态接口 ──────────────────────────────────────────────

export interface AppState {
  // UI 状态
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark';
  /** 派生自 theme === 'dark'（保持向后兼容，不直接 set） */
  isDarkMode: boolean;

  // 应用设置
  autoSave: boolean;

  // 用户偏好
  userSettings: UserSettings;

  // AI 模型偏好（原 settings-store 迁移而来）
  aiSettings: AISettings;

  // UI actions
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  setAutoSave: (autoSave: boolean) => void;
  addRecentProject: (projectId: string) => void;

  // AI settings actions（原 settings-store 迁移而来）
  updateAIModelSettings: (model: ModelProvider, settings: Partial<AIModelSettings>) => void;
  setSelectedAIModel: (model: ModelProvider) => void;
}

// ─── 默认值 ──────────────────────────────────────────────────

const defaultSettings: UserSettings = {
  recentProjects: [],
};

const defaultAIModelSettings: Record<ModelProvider, AIModelSettings> = {
  openai:     { enabled: false },
  anthropic:  { enabled: false },
  google:     { enabled: false },
  alibaba:    { enabled: false },
  zhipu:      { enabled: false },
  moonshot:   { enabled: false },
  deepseek:   { enabled: false },
  iflytek:    { enabled: false },
  local:      { enabled: false },
  custom:     { enabled: false },
};

const defaultAISettings: AISettings = {
  selectedAIModel: 'openai',
  aiModelsSettings: defaultAIModelSettings,
};

// ─── 副作用 ──────────────────────────────────────────────────

const applyThemeClass = (theme: 'light' | 'dark') => {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }
};

// ─── Store ───────────────────────────────────────────────────

export const useAppStore = createPersistedStore<AppState>({
  name: 'fablr-app',
  legacyName: 'StoryFab-app',
  devtoolsName: 'AppStore',
  storage: createJSONStorage(() => localStorage),
  partialize: (state) => ({
    theme: state.theme,
    sidebarCollapsed: state.sidebarCollapsed,
    userSettings: state.userSettings,
    autoSave: state.autoSave,
    // AI 设置持久化
    aiSettings: {
      selectedAIModel: state.aiSettings.selectedAIModel,
      aiModelsSettings: state.aiSettings.aiModelsSettings,
    },
  }),
  state: (set, get) => ({
    sidebarCollapsed: false,
    theme: 'light',
    isDarkMode: false,
    autoSave: true,
    userSettings: defaultSettings,
    aiSettings: defaultAISettings,

    setTheme: (theme) => {
      applyThemeClass(theme);
      set({ theme, isDarkMode: theme === 'dark' });
    },

    toggleTheme: () => {
      const next = get().theme === 'dark' ? 'light' : 'dark';
      get().setTheme(next);
    },

    toggleSidebar: () =>
      set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

    setAutoSave: (autoSave) => set({ autoSave }),

    addRecentProject: (projectId) =>
      set((state) => ({
        userSettings: {
          ...state.userSettings,
          recentProjects: [
            projectId,
            ...state.userSettings.recentProjects.filter((id) => id !== projectId),
          ].slice(0, 50),
        },
      })),

    // AI settings actions
    updateAIModelSettings: (model, settings) =>
      set((state) => ({
        aiSettings: {
          ...state.aiSettings,
          aiModelsSettings: {
            ...state.aiSettings.aiModelsSettings,
            [model]: { ...state.aiSettings.aiModelsSettings[model], ...settings },
          },
        },
      })),

    setSelectedAIModel: (model) =>
      set((state) => ({
        aiSettings: {
          ...state.aiSettings,
          selectedAIModel: model,
        },
      })),
  }),
});
