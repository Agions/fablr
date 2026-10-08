//! Fablr — AI 影视/短剧解说创作平台 (Tauri 2 + Rust)
//! Tauri 后端入口点与 IPC 桥接层

use tauri::Manager;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

pub mod commands;

pub use commands::{
    ai, assembly, auto_save, crash_recovery, export_state, ffprobe, file_ops, llm, pipeline, platform, project, render, subtitle, understanding, video,
};
pub use models::*;
pub use db::ProjectService;
pub use commands::ffprobe::{analyze_video, check_ffmpeg, run_ffprobe, system_diagnostics};
pub use commands::ai::{
    detect_highlights, detect_smart_segments, detect_zcr_bursts, get_export_dir, list_tts_backends,
    run_ai_director_plan, synthesize_speech, synthesize_speech_batch, synthesize_speech_ssml,
    check_tts_available, translate_text, TtsBackendInfo,
};
pub use commands::video::{cut_video, extract_key_frames, get_audio_duration, mix_audio};
pub use commands::subtitle::transcribe_audio;
pub use commands::project::{
    project_create, project_delete, project_list, project_load, project_save,
};
pub use commands::pipeline::{
    pipeline_approve_phase, pipeline_retry_phase, pipeline_run_auto, pipeline_skip_phase,
    pipeline_start_phase,
};
pub use commands::render::{
    export_video, generate_preview, render_autonomous_cut, transcode_with_crop,
};
pub use commands::export_state::cancel_export;
pub use commands::file_ops::{clean_temp_file, open_file, voice_discovery};
pub use commands::platform::{list_platform_presets, platform_export, PlatformExportInput, PlatformExportResult};
pub use commands::assembly::{assembly_kit_load, assembly_kit_save, AssemblyKitMeta, LoadedAssemblyKit};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 初始化日志
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "fablr=info,warn".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // 安装 panic hook
    media::utils::install_panic_hook();

    tracing::info!("Fablr 启动中...");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        // 注册资源限流器：render/transcribe/whisper 等重活必须先 acquire()
        .manage(media::utils::ResourceLimiter::shared())
        .invoke_handler(tauri::generate_handler![
            // Project CRUD (v3 · SQLite)
            project_create,
            project_list,
            project_load,
            project_save,
            project_delete,
            // Pipeline 5 phase
            pipeline_start_phase,
            pipeline_approve_phase,
            pipeline_retry_phase,
            pipeline_skip_phase,
            pipeline_run_auto,
            run_ai_director_plan,
            render_autonomous_cut,
            transcode_with_crop,
            generate_preview,
            export_video,
            cancel_export,
            clean_temp_file,
            open_file,
            voice_discovery,
            cut_video,
            mix_audio,
            get_audio_duration,
            extract_key_frames,
            check_ffmpeg,
            analyze_video,
            run_ffprobe,
            system_diagnostics,
            // Platform presets + 平台导出（Stage 15.2）
            list_platform_presets,
            platform_export,
            // AssemblyKit 持久化（Stage 16.3）
            assembly_kit_save,
            assembly_kit_load,
            // Whisper subtitle transcription
            transcribe_audio,
            // Highlight detection & smart segmentation
            detect_highlights,
            detect_zcr_bursts,
            detect_smart_segments,
            // TTS / AI
            synthesize_speech,
            synthesize_speech_ssml,
            synthesize_speech_batch,
            check_tts_available,
            list_tts_backends,
            translate_text,
            get_export_dir,
            // Auto-save / crash recovery
            auto_save::auto_save_project,
            auto_save::clear_autosave,
            auto_save::list_recoverable_projects,
            auto_save::recover_autosave,
            auto_save::preview_autosave,
            // L0 Understanding layer (v3) — storyline 编排
            understanding::analyze_production,
            // LLM / AI 脚本生成
            commands::llm::generate_narration_script,
            commands::llm::analyze_video_for_narration,
            commands::llm::list_available_models,
            // Crash recovery
            commands::crash_recovery::list_crashes,
            commands::crash_recovery::read_crash,
            commands::crash_recovery::delete_crash,
            commands::crash_recovery::clear_crashes,
        ])
        .setup(|app| {
            tracing::info!("[Fablr] 应用初始化中...");

            let app_data_dir = app.path().app_data_dir().unwrap_or_default();
            tracing::info!("[Fablr] App数据目录: {:?}", app_data_dir);

            // 初始化 SQLite 数据库（自动迁移）
            let db_path = app_data_dir.join("fablr.db");
            match db::Db::open(&db_path) {
                Ok(db) => {
                    let schema_v = db.schema_version().unwrap_or(0);
                    tracing::info!(
                        "[Fablr] SQLite 已就绪: {} (schema v{})",
                        db_path.display(),
                        schema_v
                    );
                    let db = std::sync::Arc::new(db);
                    app.manage(crate::commands::project::ProjectService::new(db));
                }
                Err(e) => {
                    tracing::error!("[Fablr] SQLite 初始化失败: {}", e);
                }
            }

            // macOS / Windows / Linux 平台日志路径
            if let Ok(log_dir) = app_data_dir.join("logs").canonicalize() {
                tracing::info!("[Fablr] 日志目录: {:?}", log_dir);
            }

            if let Some(window) = app.get_webview_window("main") {
                tracing::info!("[Fablr] 主窗口已获取");

                // 确保窗口标题正确
                let _ = window.set_title("Fablr (剧工) — AI 影视/短剧解说创作平台");
            }

            tracing::info!("[Fablr] 启动完成");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
