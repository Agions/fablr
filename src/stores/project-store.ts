/**
 * ProjectStore — 项目元数据 / 模式 / 步骤 / 产物状态
 *
 * 管理项目核心工作流状态（WorkflowState）。
 * 视频资产（currentVideo / duration）真源，EditorStore 通过 subscribe 投影。
 *
 * 设计选择：
 *  - 保留 Fablr reducer 协议（SET_MODE / SET_STEP / ...）作为状态机核心，
 *    避免一次性重写 reducer 触发回归；复合 action（updateVideo、resetStep 等）
 *    以 action creator 形式包在 store action 上。
 *  - 持久化：项目数据由 project-file-service 项目管理，按需原子写入。
 */
import { create } from 'zustand';
import type { VideoInfo, VideoAnalysis, ProjectData, ExportSettings } from '@/types';
import type {
  WorkflowState,
  WorkflowStep,
  WorkflowFeatureType,
  WorkflowMode,
  WorkflowAction,
} from '@/core/workflow';
import {
  initialState,
  getNextStep,
  getPrevStep,
  getTotalSteps,
} from '@/core/workflow';
import { workflowReducer } from '@/core/workflow';

/** 派生初始状态（每次调用返回新对象，避免共享引用） */
const createInitialState = (): WorkflowState => ({
  ...initialState,
  project: initialState.project ? { ...initialState.project } : null,
  analysis: null,
});

export interface ProjectStore {
  // ── 状态机核心 ──
  state: WorkflowState;

  // ── action creators（保留 dispatch 过渡期）──
  dispatch: (action: WorkflowAction) => void;

  // ── 元数据 setter ──
  setMode: (mode: WorkflowMode) => void;
  setStep: (step: WorkflowStep) => void;
  setFeature: (feature: WorkflowFeatureType) => void;
  setProject: (project: ProjectData | null) => void;
  setVideo: (video: VideoInfo | null) => void;
  setAnalysis: (analysis: VideoAnalysis | null) => void;
  setOcrSubtitle: (data: Array<{ startTime: number; endTime: number; text: string }> | null) => void;
  setAsrSubtitle: (data: Array<{ startTime: number; endTime: number; text: string; speaker?: string }> | null) => void;
  setNarrationScript: (script: import('@/types').ScriptData | null) => void;
  setRemixScript: (script: import('@/types').ScriptData | null) => void;
  setVoice: (audioUrl: string | null, settings?: { voiceId?: string; speed?: number; volume?: number }) => void;
  setSynthesis: (videoUrl: string | null, settings?: { syncAudioVideo?: boolean; addSubtitles?: boolean; addWatermark?: boolean }) => void;
  setExportSettings: (settings: ExportSettings | null) => void;
  setDuration: (duration: number) => void;

  // ── 复合 action ──
  updateVideo: (updates: Partial<VideoInfo>) => void;
  goToNextStep: () => void;
  goToPrevStep: () => void;
  reset: () => void;
  resetStep: (step: WorkflowStep) => void;

  // ── 派生（getter）──
  canProceed: () => boolean;
  get completedSteps(): number;
  get totalSteps(): number;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  state: createInitialState(),

  dispatch: (action) => {
    set((s) => ({ state: workflowReducer(s.state, action) }));
  },

  setMode: (mode) => get().dispatch({ type: 'SET_MODE', payload: mode }),
  setStep: (step) => get().dispatch({ type: 'SET_STEP', payload: step }),
  setFeature: (feature) => get().dispatch({ type: 'SET_FEATURE', payload: feature }),
  setProject: (project) => get().dispatch({ type: 'SET_PROJECT', payload: project }),
  setVideo: (video) => get().dispatch({ type: 'SET_VIDEO', payload: video }),
  setAnalysis: (analysis) => get().dispatch({ type: 'SET_ANALYSIS', payload: analysis }),
  setOcrSubtitle: (data) => get().dispatch({ type: 'SET_OCR_SUBTITLE', payload: data }),
  setAsrSubtitle: (data) => get().dispatch({ type: 'SET_ASR_SUBTITLE', payload: data }),
  setNarrationScript: (script) => get().dispatch({ type: 'SET_NARRATION_SCRIPT', payload: script }),
  setRemixScript: (script) => get().dispatch({ type: 'SET_REMIX_SCRIPT', payload: script }),
  setVoice: (audioUrl, settings) => get().dispatch({ type: 'SET_VOICE', payload: { audioUrl, settings } }),
  setSynthesis: (videoUrl, settings) => get().dispatch({ type: 'SET_SYNTHESIS', payload: { finalVideoUrl: videoUrl, settings } }),
  setExportSettings: (settings) => get().dispatch({ type: 'SET_EXPORT_SETTINGS', payload: settings }),
  setDuration: (duration) => get().dispatch({ type: 'SET_DURATION', payload: duration }),

  updateVideo: (updates) => {
    const { state } = get();
    if (state.currentVideo) {
      get().dispatch({ type: 'SET_VIDEO', payload: { ...state.currentVideo, ...updates } });
    }
  },

  goToNextStep: () => {
    const { state } = get();
    const next = getNextStep(state.currentStep, state.mode);
    get().dispatch({ type: 'SET_STEP', payload: next });
  },

  goToPrevStep: () => {
    const { state } = get();
    const prev = getPrevStep(state.currentStep, state.mode);
    get().dispatch({ type: 'SET_STEP', payload: prev });
  },

  reset: () => {
    set({ state: createInitialState() });
  },

  resetStep: (step) => get().dispatch({ type: 'RESET_STEP', payload: step }),

  canProceed: () => {
    const { state } = get();
    return state.stepStatus[state.currentStep] || state.currentStep === 'project-create';
  },

  get completedSteps() {
    return Object.values(get().state.stepStatus).filter(Boolean).length;
  },

  get totalSteps() {
    return getTotalSteps(get().state.mode);
  },
}));
