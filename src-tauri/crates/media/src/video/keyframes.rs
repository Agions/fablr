// Keyframe extraction via ffmpeg scene detection

use crate::utils::{chrono_like_timestamp, cmd_err};
use std::fs;
use std::process::Command;

/// Extract key frames from a video using scene detection threshold
pub fn extract_keyframes_impl(
    path: &str,
    max_frames: u32,
    scene_threshold: f64,
    ffmpeg_path: &str,
) -> Result<Vec<String>, String> {
    let temp_dir = std::env::temp_dir()
        .join(format!("fablr_frames_{}_{}", std::process::id(), chrono_like_timestamp()));

    fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("创建临时目录失败: {}", e))?;

    let pattern = temp_dir.join("frame_%04d.jpg");

    let output = Command::new(ffmpeg_path)
        .args([
            "-y", "-i", path,
            "-vf", &format!("select='gt(scene\\,{:.2})',scale=iw:-1,qscale=v(2)", scene_threshold),
            "-frames:v", &max_frames.to_string(),
            "-vsync", "vfr",
            &pattern.to_string_lossy(),
        ])
        .output()
        .map_err(|e| format!("提取关键帧失败: {}", e))?;

    if !output.status.success() {
        let _ = fs::remove_dir_all(&temp_dir);
        return Err(cmd_err("提取失败", &output));
    }

    let mut frames: Vec<_> = fs::read_dir(&temp_dir)
        .ok()
        .map(|d| {
            d.filter_map(|e| e.ok()).filter_map(|e| {
                let p = e.path();
                if p.extension().and_then(|e| e.to_str()) == Some("jpg") {
                    Some(p)
                } else {
                    None
                }
            }).collect()
        })
        .unwrap_or_default();

    frames.sort();

    // Fallback: if scene detection found 0 frames, sample frames using thumbnail/fps filter
    if frames.is_empty() {
        let fallback_pattern = temp_dir.join("fallback_%04d.jpg");
        let _ = Command::new(ffmpeg_path)
            .args([
                "-y", "-i", path,
                "-vf", "thumbnail,scale=iw:-1",
                "-frames:v", &max_frames.max(1).to_string(),
                "-vsync", "vfr",
                &fallback_pattern.to_string_lossy(),
            ])
            .output();

        if let Ok(d) = fs::read_dir(&temp_dir) {
            frames = d.filter_map(|e| e.ok()).filter_map(|e| {
                let p = e.path();
                if p.extension().and_then(|e| e.to_str()) == Some("jpg") {
                    Some(p)
                } else {
                    None
                }
            }).collect();
            frames.sort();
        }
    }

    let result: Vec<String> = frames
        .into_iter()
        .take(max_frames as usize)
        .map(|p| p.display().to_string())
        .collect();

    // Do NOT remove temp_dir on success, as returned paths point to the images within it.
    // If no frames were extracted at all, clean up empty temp directory.
    if result.is_empty() {
        let _ = fs::remove_dir_all(&temp_dir);
    }

    Ok(result)
}
