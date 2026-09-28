use crate::binary::{ffmpeg_binary, ffprobe_binary};
use models::{FFmpegCheckResult, VideoMetadataResult};
use crate::utils::{cmd_err, cmd_first_line, err_msg, parse_fraction};
use serde_json::Value;

/// Parse a u64 from a JSON string or number field, or None.
fn json_parse_u64(v: &Value, key: &str) -> Option<u64> {
    v.get(key).and_then(|val| {
        val.as_u64().or_else(|| val.as_str().and_then(|s| s.parse().ok()))
    })
}

/// Parse a f64 from a JSON string or number field, or None.
fn json_parse_f64(v: &Value, key: &str) -> Option<f64> {
    v.get(key).and_then(|val| {
        val.as_f64().or_else(|| val.as_str().and_then(|s| s.parse::<f64>().ok()))
    })
}


pub async fn check_ffmpeg() -> Result<FFmpegCheckResult, String> {
    let ffmpeg = ffmpeg_binary();
    let output = tokio::process::Command::new(&ffmpeg)
        .arg("-version")
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(FFmpegCheckResult { installed: true, version: cmd_first_line(&output).map(|s| s.trim().to_string()) })
    } else {
        Ok(FFmpegCheckResult { installed: false, version: None })
    }
}


pub async fn analyze_video(path: String) -> Result<VideoMetadataResult, String> {
    if path.trim().is_empty() {
        return Err("路径不能为空".to_string());
    }

    let output = tokio::process::Command::new(ffprobe_binary())
        .arg("-v")
        .arg("error")
        .arg("-select_streams")
        .arg("v:0")
        .arg("-show_entries")
        .arg("stream=width,height,codec_name,r_frame_rate,bit_rate,duration")
        .arg("-show_entries")
        .arg("format=duration,bit_rate")
        .arg("-of")
        .arg("json")
        .arg(&path)
        .output()
        .await
        .map_err(|e| err_msg("运行ffprobe失败", e))?;

    if !output.status.success() {
        return Err(cmd_err("ffprobe命令执行失败", &output));
    }

    let payload: serde_json::Value =
        serde_json::from_slice(&output.stdout).map_err(|e| format!("解析JSON失败: {e}"))?;

    let stream = payload
        .get("streams")
        .and_then(|s| s.as_array())
        .and_then(|arr| arr.first())
        .ok_or_else(|| "未找到视频流".to_string())?;

    let width = stream.get("width").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let height = stream.get("height").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let codec = stream.get("codec_name").and_then(|v| v.as_str()).unwrap_or("unknown").to_string();
    let fps = parse_fraction(stream.get("r_frame_rate").and_then(|v| v.as_str()).unwrap_or("0/1"));

    let format = payload.get("format").cloned().unwrap_or(serde_json::Value::Null);
    let duration = json_parse_f64(&format, "duration")
        .or_else(|| json_parse_f64(stream, "duration"))
        .unwrap_or(0.0);
    let stream_bitrate = json_parse_u64(stream, "bit_rate");
    let format_bitrate = json_parse_u64(&format, "bit_rate");
    let bitrate = stream_bitrate.or(format_bitrate).unwrap_or(0);

    Ok(VideoMetadataResult { duration, width, height, fps, codec, bitrate })
}

/// Allowed ffprobe argument prefixes (whitelist to prevent injection)
const ALLOWED_FFPROBE_ARGS: &[&str] = &[
    "-v", "-select_streams", "-show_entries", "-show_format", "-show_streams",
    "-of", "-count_frames", "-i", "-sexagesimal", "-unit", "-prefix",
    "-hide_banner", "-loglevel", "-threads", "-timeout",
];

/// Validate args are all in the whitelist (no -exec, -report, etc.)
fn validate_ffprobe_args(args: &[String]) -> Result<(), String> {
    for arg in args {
        // Allow flag args (start with -)
        if arg.starts_with('-') {
            let is_allowed = ALLOWED_FFPROBE_ARGS.iter().any(|&p| {
                arg == p || arg.starts_with(&format!("{p}="))
            });
            if !is_allowed {
                return Err(format!("ffprobe 不允许的参数: {}", arg));
            }
        }
        // Non-flag args (file paths, values) are always allowed
    }
    Ok(())
}

/// Run ffprobe with arbitrary args, returns raw stdout.
pub async fn run_ffprobe(args: Vec<String>) -> Result<String, String> {
    validate_ffprobe_args(&args)?;
    let output = tokio::process::Command::new(ffprobe_binary())
        .args(&args)
        .output()
        .await
        .map_err(|e| format!("运行ffprobe失败: {e}"))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(cmd_err("ffprobe exited", &output))
    }
}
