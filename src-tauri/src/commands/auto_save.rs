//! Auto-save and crash-recovery for Fablr projects.
//!
//! Design:
//! - `auto_save_project` writes a `{project_id}.autosave.json` next to the project file.
//!   This is the "in-progress" copy that survives crashes.
//! - After a successful full save, frontend calls `clear_autosave` to remove it.
//! - `list_recoverable_projects` returns any recoverable autosave files for startup recovery UI.
//! - `recover_autosave` renames the autosave back to the main project file.

use std::path::{Path, PathBuf};
use tauri::Manager;
use tokio::fs as tokio_fs;

#[cfg(test)]
mod tests;

// ─── Path helpers ─────────────────────────────────────────────────────────────

/// Returns the autosave path for a given project_id.
pub fn autosave_path(fablr_dir: &Path, project_id: &str) -> PathBuf {
    fablr_dir.join(format!("{}.autosave.json", project_id))
}

/// Returns the main project file path for a given project_id.
pub fn project_path(fablr_dir: &Path, project_id: &str) -> PathBuf {
    fablr_dir.join(format!("{}.json", project_id))
}

// ─── Directory resolution ─────────────────────────────────────────────────────

/// Returns the fablr_dir (shared with project.rs storage).
pub async fn get_fablr_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法获取 AppData 目录: {e}"))?;
    let fablr_dir = app_dir.join("fablr");
    tokio_fs::create_dir_all(&fablr_dir)
        .await
        .map_err(|e| format!("创建目录失败: {e}"))?;
    Ok(fablr_dir)
}

// ─── Tauri Commands ────────────────────────────────────────────────────────────

/// Write an autosave snapshot of the project.
#[tauri::command]
pub async fn auto_save_project(
    app: tauri::AppHandle,
    project_id: String,
    content: String,
) -> Result<(), String> {
    let fablr_dir = get_fablr_dir(&app).await?;
    let target_path = autosave_path(&fablr_dir, &project_id);

    tokio_fs::write(&target_path, &content)
        .await
        .map_err(|e| format!("自动保存失败: {e}"))?;

    tracing::debug!("[Fablr] Autosaved project {} to {:?}", project_id, target_path);
    Ok(())
}

/// Remove the autosave file after a successful full save.
#[tauri::command]
pub async fn clear_autosave(
    app: tauri::AppHandle,
    project_id: String,
) -> Result<(), String> {
    let fablr_dir = get_fablr_dir(&app).await?;
    let autosave = autosave_path(&fablr_dir, &project_id);

    if autosave.exists() {
        tokio_fs::remove_file(&autosave)
            .await
            .map_err(|e| format!("清除自动保存失败: {e}"))?;
        tracing::debug!("[Fablr] Cleared autosave for project {}", project_id);
    }
    Ok(())
}

/// List all projects that have a pending autosave (for crash-recovery UI).
#[tauri::command]
pub async fn list_recoverable_projects(
    app: tauri::AppHandle,
) -> Result<Vec<String>, String> {
    let fablr_dir = get_fablr_dir(&app).await?;
    let mut recoverable = Vec::new();

    let mut entries = tokio_fs::read_dir(&fablr_dir)
        .await
        .map_err(|e| format!("读取项目目录失败: {e}"))?;

    let mut dir_entry = entries
        .next_entry()
        .await
        .map_err(|e| format!("读取目录项失败: {e}"))?;

    while let Some(entry) = dir_entry {
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) == Some("json") {
            if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                if stem.ends_with(".autosave") {
                    let project_id = stem.strip_suffix(".autosave").unwrap_or(stem).to_string();
                    recoverable.push(project_id);
                }
            }
        }
        dir_entry = entries
            .next_entry()
            .await
            .map_err(|e| format!("读取目录项失败: {e}"))?;
    }

    Ok(recoverable)
}

/// Recover a project from its autosave file — renames `.autosave.json` → `.json`.
#[tauri::command]
pub async fn recover_autosave(
    app: tauri::AppHandle,
    project_id: String,
) -> Result<String, String> {
    let fablr_dir = get_fablr_dir(&app).await?;
    let autosave = autosave_path(&fablr_dir, &project_id);
    let main_file = project_path(&fablr_dir, &project_id);

    if !autosave.exists() {
        return Err(format!("没有找到项目 {} 的自动保存", project_id));
    }

    let content = tokio_fs::read_to_string(&autosave)
        .await
        .map_err(|e| format!("读取自动保存失败: {e}"))?;

    if main_file.exists() {
        tokio_fs::remove_file(&main_file)
            .await
            .map_err(|e| format!("删除旧项目文件失败: {e}"))?;
    }

    tokio_fs::rename(&autosave, &main_file)
        .await
        .map_err(|e| format!("恢复自动保存失败: {e}"))?;

    tracing::info!("[Fablr] Recovered project {} from autosave", project_id);
    Ok(content)
}

/// Load the autosave content without recovering it (preview before recovery).
#[tauri::command]
pub async fn preview_autosave(
    app: tauri::AppHandle,
    project_id: String,
) -> Result<String, String> {
    let fablr_dir = get_fablr_dir(&app).await?;
    let autosave = autosave_path(&fablr_dir, &project_id);

    if !autosave.exists() {
        return Err(format!("没有找到项目 {} 的自动保存", project_id));
    }

    tokio_fs::read_to_string(&autosave)
        .await
        .map_err(|e| format!("读取自动保存失败: {e}"))
}
