import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import type { TauriCommandName, TauriCommandOutput } from './command-types';

// ============================================================
// 命令名称常量（与 Rust 端保持一致）
// ============================================================
export const TauriCommand = {
  CHECK_FFMPEG: 'check_ffmpeg',
  SYSTEM_DIAGNOSTICS: 'system_diagnostics',
  ANALYZE_VIDEO: 'analyze_video',
  EXTRACT_KEY_FRAMES: 'extract_key_frames',
  GET_EXPORT_DIR: 'get_export_dir',
  RUN_FFPROBE: 'run_ffprobe',

  DETECT_HIGHLIGHTS: 'detect_highlights',
  DETECT_ZCR_BURSTS: 'detect_zcr_bursts',
  DETECT_SMART_SEGMENTS: 'detect_smart_segments',

  EXPORT_VIDEO: 'export_video',
  EXPORT_JIANYING_DRAFT: 'export_jianying_draft',
  TRANSCODE_WITH_CROP: 'transcode_with_crop',
  AUTONOMOUS_RENDER: 'render_autonomous_cut',
  GENERATE_PREVIEW: 'generate_preview',
  CUT_VIDEO: 'cut_video',

  TRANSCRIBE_AUDIO: 'transcribe_audio',

  SYNTHESIZE_SPEECH: 'synthesize_speech',
  SYNTHESIZE_SPEECH_SSML: 'synthesize_speech_ssml',
  SYNTHESIZE_SPEECH_BATCH: 'synthesize_speech_batch',
  LIST_TTS_BACKENDS: 'list_tts_backends',
  CHECK_TTS_AVAILABLE: 'check_tts_available',
  MIX_AUDIO: 'mix_audio',
  GET_AUDIO_DURATION: 'get_audio_duration',

  RUN_AI_DIRECTOR_PLAN: 'run_ai_director_plan',

  // L0 Understanding (v3)
  ANALYZE_PRODUCTION: 'analyze_production',

  TRANSLATE_TEXT: 'translate_text',

  FILE_READ: 'read_text_file',
  FILE_DELETE: 'delete_file',
  CLEAN_TEMP_FILE: 'clean_temp_file',
  OPEN_FILE: 'open_file',
  VOICE_DISCOVERY: 'voice_discovery',
  GET_FILE_SIZE: 'get_file_size',

  // Project (v3 · SQLite-backed · Stage 12.5) — 替代 v2 文件存储
  PROJECT_CREATE: 'project_create',
  PROJECT_LIST: 'project_list',
  PROJECT_LOAD: 'project_load',
  PROJECT_SAVE: 'project_save',
  PROJECT_DELETE: 'project_delete',

  // Platform presets (Stage 15.2)
  LIST_PLATFORM_PRESETS: 'list_platform_presets',
  PLATFORM_EXPORT: 'platform_export',

  // AssemblyKit 持久化 (Stage 16.3)
  ASSEMBLY_KIT_SAVE: 'assembly_kit_save',
  ASSEMBLY_KIT_LOAD: 'assembly_kit_load',

  // Pipeline (v3 · 5 阶段流水线 · Stage 13) — 替代 v2 run_commentary_pipeline 黑盒
  PIPELINE_START_PHASE: 'pipeline_start_phase',
  PIPELINE_APPROVE_PHASE: 'pipeline_approve_phase',
  PIPELINE_RETRY_PHASE: 'pipeline_retry_phase',
  PIPELINE_SKIP_PHASE: 'pipeline_skip_phase',
  PIPELINE_RUN_AUTO: 'pipeline_run_auto',

  // 旧 v2 文件存储命令（已删除，但留 enum 以兼容 v2 IPC 客户端）
  LIST_APP_DATA_FILES: 'list_app_data_files',
  CHECK_APP_DATA_DIR: 'check_app_data_directory',

  CANCEL_EXPORT: 'cancel_export',

  GENERATE_NARRATION_SCRIPT: 'generate_narration_script',
  ANALYZE_VIDEO_FOR_NARRATION: 'analyze_video_for_narration',
  LIST_AVAILABLE_MODELS: 'list_available_models',

  // Auto-save
  AUTO_SAVE_PROJECT: 'auto_save_project',
  CLEAR_AUTOSAVE: 'clear_autosave',
  LIST_RECOVERABLE_PROJECTS: 'list_recoverable_projects',
  RECOVER_AUTOSAVE: 'recover_autosave',
  PREVIEW_AUTOSAVE: 'preview_autosave',

  // Crash recovery
  LIST_CRASHES: 'list_crashes',
  READ_CRASH: 'read_crash',
  DELETE_CRASH: 'delete_crash',
  CLEAR_CRASHES: 'clear_crashes',
} as const;

// 命令名称类型（与 command-types.ts 中的 TauriCommandName 保持一致）
export type TauriCommand = TauriCommandName;

// ============================================================
// 错误类型
// ============================================================
export class TauriBridgeError extends Error {
  constructor(
    message: string,
    public readonly command: TauriCommand,
    public readonly cause?: unknown,
    public readonly retryable = false
  ) {
    super(message);
    this.name = 'TauriBridgeError';
  }

  static fromInvoke(command: TauriCommand, error: unknown): TauriBridgeError {
    if (error instanceof Error) {
      const isRetryable =
        error.message.includes('timeout') ||
        error.message.includes('busy') ||
        error.message.includes('temporary');

      return new TauriBridgeError(
        `Tauri invoke '${command}' failed: ${error.message}`,
        command,
        error,
        isRetryable
      );
    }
    return new TauriBridgeError(
      `Tauri invoke '${command}' failed: ${String(error)}`,
      command,
      error,
      false
    );
  }
}

// ============================================================
// Bridge 配置
// ============================================================
export interface BridgeOptions {
  retries?: number;
  signal?: AbortSignal;
}

// ============================================================
// Helpers
// ============================================================

function normalizeArgs(args: Record<string, unknown> | undefined): Record<string, unknown> {
  if (args && Object.keys(args).length > 0) return args;
  return {};
}

// ============================================================
// 核心调用函数
// ============================================================

/**
 * 类型安全的 Tauri invoke
 * 自动推断输入和输出类型
 *
 * @param command 命令名称
 * @param args 命令参数（建议使用命令特定的参数类型）
 * @param options 可选配置
 * @returns 命令执行结果
 */
export async function invoke<C extends TauriCommandName>(
  command: C,
  args: Record<string, unknown> = {},
  options?: BridgeOptions
): Promise<TauriCommandOutput<C>> {
  const { retries = 0, signal } = options ?? {};
  return executeWithRetry(command, normalizeArgs(args), retries, signal);
}

async function executeWithRetry<C extends TauriCommandName>(
  command: C,
  args: Record<string, unknown>,
  retries: number,
  signal: AbortSignal | undefined
): Promise<TauriCommandOutput<C>> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal && signal.aborted) {
      throw TauriBridgeError.fromInvoke(command as TauriCommand, new Error('Request aborted'));
    }

    try {
      return await tauriInvoke(command, args);
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500));
      }
    }
  }

  throw TauriBridgeError.fromInvoke(command as TauriCommand, lastError);
}
