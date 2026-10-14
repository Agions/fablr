/**
 * Tauri Commands Type Definitions
 *
 * 为所有已注册的 Tauri 命令提供类型安全的输入/输出定义
 * Phase 3 Task 1: Tauri invoke 泛型化
 *
 * 注意：字段名使用 camelCase 以匹配 TypeScript 代码约定
 * Tauri 会自动在 TS 和 Rust 之间转换命名
 */

import type { VideoMetadataResult } from '@/types';
import type { SubtitleTrack } from '@/types';

export type SystemDiagnosticsResult = {
  os: string;
  arch: string;
  ffmpegInstalled: boolean;
  ffmpegPath?: string;
  ffmpegVersion?: string;
  ffprobeInstalled: boolean;
  ffprobePath?: string;
  hwAccel: string;
  hwAccelName: string;
  pythonInstalled: boolean;
  pythonPath?: string;
  whisperAvailable: boolean;
};

// Project DTO（与 Rust ProjectDto 对齐，Stage 12.5）
export type ProjectDto = {
  id: string;
  name: string;
  intent: {
    intent: string;
    targetDurationSecs: number;
    language: string;
    audience: string;
    toneIntensity: number;
  };
  videoPath: string;
  subtitlePath: string | null;
  createdAt: string;
  updatedAt: string;
  latestJob: {
    id: string;
    projectId: string;
    phase: string;
    phaseStatus: Record<string, string>;
    progressPct: number;
    error: { phase: string; message: string } | null;
    createdAt: string;
    updatedAt: string;
  } | null;
};

// PipelineJob DTO（与 Rust PipelineJob 对齐，Stage 13）
// 5 阶段：understanding / planning / scripting / voicing / rendering
export type PipelineJobDto = {
  id: string;
  phase: 'understanding' | 'planning' | 'scripting' | 'voicing' | 'rendering';
  phaseStatus: Record<
    'understanding' | 'planning' | 'scripting' | 'voicing' | 'rendering',
    'pending' | 'running' | 'done' | 'failed' | 'skipped'
  >;
  progressPct: number;
  error: { phase: string; message: string } | null;
  artifacts: {
    storylinePath: string | null;
    planPath: string | null;
    scriptPath: string | null;
    audioDir: string | null;
    outputPath: string | null;
  };
  createdAt: string;
  updatedAt: string;
};

// ============================================================
// 命令名称联合类型（与 TauriCommand 常量的值一一对应）
// ============================================================

export type TauriCommandName =
  | 'check_ffmpeg'
  | 'system_diagnostics'
  | 'analyze_video'
  | 'extract_key_frames'
  | 'get_export_dir'
  | 'run_ffprobe'
  | 'detect_highlights'
  | 'detect_zcr_bursts'
  | 'detect_smart_segments'
  | 'export_video'
  | 'export_jianying_draft'
  | 'transcode_with_crop'
  | 'render_autonomous_cut'
  | 'generate_preview'
  | 'cut_video'
  | 'subtitle_extract'
  | 'subtitle_burn_in'
  | 'transcribe_audio'
  | 'synthesize_speech'
  | 'synthesize_speech_ssml'
  | 'synthesize_speech_batch'
  | 'list_tts_backends'
  | 'check_tts_available'
  | 'mix_audio'
  | 'get_audio_duration'
  | 'run_ai_director_plan'
  | 'analyze_production'
  | 'translate_text'
  | 'read_text_file'
  | 'write_text_file'
  | 'delete_file'
  | 'file_exists'
  | 'clean_temp_file'
  | 'open_file'
  | 'voice_discovery'
  | 'get_file_size'
  | 'load_project_file'
  | 'save_project_file'
  | 'delete_project_file'
  | 'list_project_files'
  | 'list_app_data_files'
  | 'check_app_data_directory'
  | 'project_create'
  | 'project_list'
  | 'project_load'
  | 'project_save'
  | 'project_delete'
  | 'list_platform_presets'
  | 'platform_export'
  | 'assembly_kit_save'
  | 'assembly_kit_load'
  | 'pipeline_start_phase'
  | 'pipeline_approve_phase'
  | 'pipeline_retry_phase'
  | 'pipeline_skip_phase'
  | 'pipeline_run_auto'
  | 'window_minimize'
  | 'window_maximize'
  | 'window_close'
  | 'cancel_export'
  | 'generate_narration_script'
  | 'analyze_video_for_narration'
  | 'list_available_models'
  | 'auto_save_project'
  | 'clear_autosave'
  | 'list_recoverable_projects'
  | 'recover_autosave'
  | 'preview_autosave'
  | 'list_crashes'
  | 'read_crash'
  | 'delete_crash'
  | 'clear_crashes';

// ============================================================
// 辅助类型：将命令字符串值映射到对应的输入/输出类型
// ============================================================

type CommandNameToDefs = {
  check_ffmpeg: { input: Record<string, never>; output: { installed: boolean; version?: string } };
  system_diagnostics: { input: Record<string, never>; output: SystemDiagnosticsResult };
  analyze_video: { input: { path: string }; output: VideoMetadataResult };
  extract_key_frames: {
    input: { path: string; maxFrames?: number; sceneThreshold?: number };
    output: string[];
  };
  get_export_dir: { input: Record<string, never>; output: string };
  run_ffprobe: { input: { args: string[] }; output: string };

  detect_highlights: {
    input: {
      videoPath: string;
      threshold?: number;
      minDurationMs?: number;
      topN?: number;
      windowMs?: number;
      detectScene?: boolean;
      sceneThreshold?: number;
    };
    output: Array<{
      startMs: number;
      endMs: number;
      score: number;
      reason: string;
      audioScore?: number;
      sceneScore?: number;
      motionScore?: number;
    }>;
  };
  detect_zcr_bursts: {
    input: { audioPath: string; windowMs?: number; zcrThresholdMult?: number };
    output: Array<{ startMs: number; endMs: number; score: number }>;
  };
  detect_smart_segments: {
    input: {
      videoPath: string;
      minDurationMs?: number;
      maxDurationMs?: number;
      sceneThreshold?: number;
      silenceThresholdDb?: number;
      detectDialogue?: boolean;
      detectTransitions?: boolean;
    };
    output: Array<{
      startMs: number;
      endMs: number;
      segmentType: string;
      durationMs: number;
      confidence: number;
      isSceneChange?: boolean;
      peakEnergy?: number;
      silenceRatio?: number;
      suggestedSpeed?: number;
    }>;
  };

  export_video: {
    input: {
      inputPath: string;
      outputPath: string;
      format?: string;
      resolution?: string;
      frameRate?: number;
      videoCodec?: string;
      audioCodec?: string;
      crf?: number;
      subtitleEnabled?: boolean;
      subtitlePath?: string;
      burnSubtitles?: boolean;
    };
    output: { outputPath: string; duration: number; fileSize: number };
  };
  export_jianying_draft: {
    input: { input: Record<string, unknown> };
    output: Record<string, unknown>;
  };
  transcode_with_crop: {
    input: {
      inputPath: string;
      outputPath: string;
      aspect: string;
      startTime?: number;
      endTime?: number;
      quality?: string;
    };
    output: string;
  };
  render_autonomous_cut: {
    input: {
      inputPath: string;
      outputPath: string;
      startTime?: number;
      endTime?: number;
      transition?: string;
      transitionDuration?: number;
      burnSubtitles?: boolean;
      subtitles?: Array<{ text: string }>;
      overlayMarkers?: Array<{ label: string }>;
      segments?: Array<{ start: number; end: number }>;
    };
    output: string;
  };
  generate_preview: {
    input: {
      inputPath: string;
      segment: { start: number; end: number; segType?: string };
      transition?: string;
      transitionDuration?: number;
      volume?: number;
      addSubtitles?: boolean;
    };
    output: string;
  };
  cut_video: {
    input: {
      inputPath: string;
      outputPath: string;
      segments: Array<{ start: number; end: number; sourceStartMs?: number; sourceEndMs?: number }>;
      useHwAccel?: boolean;
    };
    output: string;
  };

  subtitle_extract: { input: { videoPath: string; language?: string }; output: SubtitleTrack };
  subtitle_burn_in: {
    input: { videoPath: string; subtitlePath: string; outputPath: string };
    output: { outputPath: string };
  };
  transcribe_audio: {
    input: { audioPath: string; modelSize?: string; language?: string };
    output: SubtitleTrack;
  };

  synthesize_speech: {
    input: { text: string; voice: string; speed?: number; format?: string; backend?: string };
    output: { audioPath: string; durationSecs: number };
  };
  // Stage 14.1：结构化 SSML → 合成
  synthesize_speech_ssml: {
    input: {
      doc: import('../models/ssml').SsmlDocument;
      voice: string;
      speed: number;
      format: string;
      backend: string;
    };
    output: { audioPath: string; durationSecs: number };
  };
  // Stage 14.2：批量并发合成（max 8 并行，0-3 重试）
  synthesize_speech_batch: {
    input: {
      segments: Array<{
        id: string;
        text?: string | null;
        ssml?: import('../models/ssml').SsmlDocument | null;
        voice: string;
        speed: number;
        format: string;
        backend: string;
      }>;
      maxConcurrency?: number;
      maxRetries?: number;
    };
    output: {
      results: Array<{
        id: string;
        audioPath: string | null;
        durationSecs: number;
        error: string | null;
        retries: number;
      }>;
      totalSecs: number;
    };
  };
  list_tts_backends: {
    input: Record<string, never>;
    output: Array<{
      id: string;
      name: string;
      label: string;
      description: string;
      requiresNetwork: boolean;
      requiresModelDownload: boolean;
      modelPath?: string;
    }>;
  };
  check_tts_available: { input: Record<string, never>; output: boolean };
  mix_audio: {
    input: {
      videoPath: string;
      ttsAudioPath: string;
      outputPath: string;
      ttsVolume?: number;
      backgroundVolume?: number;
      offsetSeconds?: number;
    };
    output: string;
  };
  get_audio_duration: { input: { audioPath: string }; output: number };

  run_ai_director_plan: {
    input: {
      sessionId: string;
      plan: {
        segments: Array<{ id: string; content: string }>;
        scenes: Array<{ id: string; startTime: number; endTime: string }>;
        targetDuration: number;
        mode: string;
        autoOriginalOverlay: boolean;
      };
    };
    output: {
      pacingFactor: number;
      beatCount: number;
      preferredTransition: string;
      confidence: number;
    };
  };

  analyze_production: {
    input: { productionId: string; videoPath: string; whisperModel?: string; language?: string };
    output: {
      storylinePath: string;
      scenesCount: number;
      subtitlesCount: number;
      highlightsCount: number;
      durationSecs: number;
    };
  };

  translate_text: { input: { text: string; fromLang: string; toLang: string }; output: string };

  read_text_file: { input: { path: string }; output: string };
  write_text_file: { input: { path: string; content: string }; output: Record<string, never> };
  delete_file: { input: { path: string }; output: boolean };
  file_exists: { input: { path: string }; output: boolean };
  clean_temp_file: { input: { path: string }; output: Record<string, never> };
  open_file: { input: { path: string }; output: Record<string, never> };
  voice_discovery: {
    input: Record<string, never>;
    output: { voices: Array<{ name: string; locale: string; gender: string }> };
  };
  get_file_size: { input: { path: string }; output: number };

  load_project_file: { input: { projectId: string }; output: string };
  save_project_file: { input: { projectId: string; content: string }; output: boolean };
  delete_project_file: { input: { projectId: string }; output: boolean };
  list_project_files: {
    input: Record<string, never>;
    output: Array<{ id: string; [key: string]: unknown }>;
  };
  list_app_data_files: { input: { directory: string }; output: string[] };
  check_app_data_directory: { input: Record<string, never>; output: string };

  // Project (v3 · SQLite-backed · Stage 12.5)
  project_create: {
    input: {
      id?: string;
      name: string;
      videoPath: string;
      durationSecs: number;
      metadata: Record<string, unknown>;
      intent?: { intent: string; targetDurationSecs: number; language: string; audience: string; toneIntensity: number };
    };
    output: ProjectDto;
  };
  project_list: { input: Record<string, never>; output: ProjectDto[] };
  project_load: { input: { id: string }; output: ProjectDto };
  project_save: {
    input: {
      id: string;
      name: string;
      intent: { intent: string; targetDurationSecs: number; language: string; audience: string; toneIntensity: number };
      videoPath: string;
      subtitlePath: string | null;
    };
    output: ProjectDto;
  };
  project_delete: { input: { id: string }; output: null };

  // Platform presets (Stage 15.2) — 数据驱动平台预设 + 一键导出
  list_platform_presets: {
    input: Record<string, never>;
    output: Array<import('../models/platform').PlatformPreset>;
  };
  platform_export: {
    input: {
      platformId: import('../models/platform').PlatformId;
      inputPath: string;
      outputPath: string;
      subtitlePath?: string | null;
      burnSubtitles?: boolean | null;
    };
    output: {
      outputPath: string;
      duration: number;
      fileSize: number;
      platform: import('../models/platform').PlatformPreset;
    };
  };

  // AssemblyKit 持久化 (Stage 16.3) — 整段 JSON 存 SQLite
  assembly_kit_save: {
    input: { projectId: string; assemblyJson: string };
    output: { projectId: string; createdAt: number; updatedAt: number };
  };
  assembly_kit_load: {
    input: { projectId: string };
    output: {
      projectId: string;
      assemblyJson: string;
      createdAt: number;
      updatedAt: number;
    } | null;
  };

  // Pipeline (Stage 13) — 5 阶段流水线 IPC
  pipeline_start_phase: {
    input: {
      projectId: string;
      phase: 'understanding' | 'planning' | 'scripting' | 'voicing' | 'rendering';
      params: Record<string, unknown> | null;
    };
    output: PipelineJobDto;
  };
  pipeline_approve_phase: {
    input: {
      projectId: string;
      phase: string;
      modifications: Record<string, unknown> | null;
    };
    output: PipelineJobDto;
  };
  pipeline_retry_phase: {
    input: { projectId: string; phase: string };
    output: PipelineJobDto;
  };
  pipeline_skip_phase: {
    input: { projectId: string; phase: string };
    output: PipelineJobDto;
  };
  pipeline_run_auto: {
    input: { projectId: string };
    output: PipelineJobDto;
  };

  window_minimize: { input: Record<string, never>; output: Record<string, never> };
  window_maximize: { input: Record<string, never>; output: Record<string, never> };
  window_close: { input: Record<string, never>; output: Record<string, never> };

  cancel_export: { input: { exportId: string }; output: Record<string, never> };

  generate_narration_script: {
    input: {
      subtitles: string;
      durationSecs?: number;
      targetDurationSecs?: number;
      style?: string;
      provider?: string;
      model?: string;
      apiKey?: string;
      baseUrl?: string;
    };
    output: {
      script: string;
      estimatedDurationSecs: number;
      segments: Array<{
        index: number;
        start: number;
        end: number;
        text: string;
      }>;
    };
  };
  analyze_video_for_narration: {
    input: { videoPath: string; duration?: number; analysisType?: string };
    output: { videoType: string; summary: string; keyScenes: number[] };
  };
  list_available_models: {
    input: Record<string, never>;
    output: Array<{ id: string; name: string; provider: string; contextLimit: number }>;
  };

  // Auto-save
  auto_save_project: {
    input: { projectId: string; content: string };
    output: Record<string, never>;
  };
  clear_autosave: { input: { projectId: string }; output: Record<string, never> };
  list_recoverable_projects: { input: Record<string, never>; output: string[] };
  recover_autosave: { input: { projectId: string }; output: string };
  preview_autosave: { input: { projectId: string }; output: string };

  // Crash recovery
  list_crashes: {
    input: Record<string, never>;
    output: Array<{ filename: string; timestamp: number; sizeBytes: number; preview?: string }>;
  };
  read_crash: {
    input: { filename: string };
    output: {
      filename: string;
      timestamp: number;
      payload: string;
      location: string;
      backtrace?: string;
      version?: string;
    };
  };
  delete_crash: { input: { filename: string }; output: Record<string, never> };
  clear_crashes: { input: Record<string, never>; output: number };
};

// 提取每个命令的输入类型（{} 表示无参数，等同于 undefined）
export type TauriCommandInput<C extends TauriCommandName> = CommandNameToDefs[C]['input'];

// 提取每个命令的输出类型
export type TauriCommandOutput<C extends TauriCommandName> = CommandNameToDefs[C]['output'];
