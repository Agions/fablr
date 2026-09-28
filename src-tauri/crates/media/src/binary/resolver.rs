//! Binary path resolution — finds external executables in PATH or common locations

use std::path::{Path, PathBuf};

/// Check if a candidate file exists in the given directory (accounting for `.exe` on Windows).
fn check_candidate(dir: &Path, binary_name: &str) -> Option<String> {
    let candidate = dir.join(binary_name);
    if candidate.exists() && !candidate.is_dir() {
        return Some(candidate.display().to_string());
    }
    if !std::env::consts::EXE_SUFFIX.is_empty() && !binary_name.ends_with(std::env::consts::EXE_SUFFIX) {
        let candidate_exe = dir.join(format!("{binary_name}{}", std::env::consts::EXE_SUFFIX));
        if candidate_exe.exists() && !candidate_exe.is_dir() {
            return Some(candidate_exe.display().to_string());
        }
    }
    None
}

/// Resolve a binary path, checking env vars, PATH, and common system directories.
pub fn resolve_binary_path(binary_name: &str) -> String {
    if binary_name.is_empty() {
        return binary_name.to_string();
    }
    let fablr_env = format!("FABLR_{}_PATH", binary_name.to_uppercase());
    let cutdeck_env = format!("CUTDECK_{}_PATH", binary_name.to_uppercase());
    let path_val = std::env::var(&fablr_env).or_else(|_| std::env::var(&cutdeck_env));
    if let Ok(path) = path_val {
        let p = Path::new(&path);
        if !path.trim().is_empty() && p.exists() && !p.is_dir() {
            return path;
        }
        if !std::env::consts::EXE_SUFFIX.is_empty() && !path.ends_with(std::env::consts::EXE_SUFFIX) {
            let p_exe = PathBuf::from(format!("{path}{}", std::env::consts::EXE_SUFFIX));
            if p_exe.exists() && !p_exe.is_dir() {
                return p_exe.display().to_string();
            }
        }
    }

    if binary_name == "ffprobe" {
        let ffmpeg_env = std::env::var("FABLR_FFMPEG_PATH")
            .or_else(|_| std::env::var("CUTDECK_FFMPEG_PATH"));
        if let Ok(ffmpeg_path) = ffmpeg_env {
            let ffmpeg = PathBuf::from(ffmpeg_path);
            if let Some(parent) = ffmpeg.parent() {
                if let Some(found) = check_candidate(parent, "ffprobe") {
                    return found;
                }
            }
        }
    }

    // Search PATH directories
    if let Some(path_var) = std::env::var_os("PATH") {
        for dir in std::env::split_paths(&path_var) {
            if let Some(found) = check_candidate(&dir, binary_name) {
                return found;
            }
        }
    }

    // Fallback to common system directories across platforms
    let common_dirs = [
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/usr/bin",
        "/bin",
        "/snap/bin",
        "/home/linuxbrew/.linuxbrew/bin",
        "C:\\ffmpeg\\bin",
        "C:\\Program Files\\ffmpeg\\bin",
        "C:\\Program Files (x86)\\ffmpeg\\bin",
        "C:\\ProgramData\\chocolatey\\bin",
    ];
    for dir in common_dirs {
        if let Some(found) = check_candidate(Path::new(dir), binary_name) {
            return found;
        }
    }

    #[cfg(windows)]
    {
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let winget_links = PathBuf::from(&local_app_data).join(r"Microsoft\WinGet\Links");
            if let Some(found) = check_candidate(&winget_links, binary_name) {
                return found;
            }
            let winget_pkgs = PathBuf::from(&local_app_data).join(r"Microsoft\WinGet\Packages");
            if let Some(found) = check_candidate(&winget_pkgs, binary_name) {
                return found;
            }
        }
        if let Ok(user_profile) = std::env::var("USERPROFILE") {
            let scoop = PathBuf::from(&user_profile).join(r"scoop\shims");
            if let Some(found) = check_candidate(&scoop, binary_name) {
                return found;
            }
        }
    }

    // Check directory of current executable or bundled resources
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(exe_dir) = current_exe.parent() {
            if let Some(found) = check_candidate(exe_dir, binary_name) {
                return found;
            }
            let resources_bin = exe_dir.join("resources").join("bin");
            if let Some(found) = check_candidate(&resources_bin, binary_name) {
                return found;
            }
        }
    }

    binary_name.to_string()
}

pub fn ffmpeg_binary() -> String { resolve_binary_path("ffmpeg") }
pub fn ffprobe_binary() -> String { resolve_binary_path("ffprobe") }