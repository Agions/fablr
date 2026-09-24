//! Timestamp and time formatting utilities

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH, Instant};

/// Parse a string like "30/1" or "29.97" into f64 seconds (frame rate parsing).
pub fn parse_fraction(value: &str) -> f64 {
    if let Some((num, den)) = value.split_once('/') {
        let n = num.parse::<f64>().unwrap_or(0.0);
        let d = den.parse::<f64>().unwrap_or(1.0);
        if d.abs() > f64::EPSILON {
            return n / d;
        }
        return 0.0;
    }
    value.parse::<f64>().unwrap_or(0.0)
}

/// Returns timestamp with random suffix to avoid collisions (for temp file names).
static TS_COUNTER: AtomicU64 = AtomicU64::new(0);

pub fn chrono_like_timestamp() -> String {
    let ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    let counter = TS_COUNTER.fetch_add(1, Ordering::Relaxed);
    let nano = Instant::now().elapsed().as_nanos() as u64;
    let rand = (ms ^ counter ^ nano) & 0xffffff_u64;
    format!("{:x}_{:06x}", ms, rand)
}

/// Current UTC time as ISO 8601 string (e.g. "2026-01-01T12:00:00.000Z").
///
/// Added for the models layer (`crates/models`); the crate does not
/// depend on `chrono`, so this is implemented with std only.
pub fn now_iso8601() -> String {
    let ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    let total_secs = ms / 1000;
    let millis = ms % 1000;
    let days = total_secs / 86_400;
    let rem = total_secs % 86_400;
    let hours = rem / 3600;
    let minutes = (rem % 3600) / 60;
    let secs = rem % 60;
    let (y, m, d) = civil_from_days(days);
    format!("{y:04}-{m:02}-{d:02}T{hours:02}:{minutes:02}:{secs:02}.{millis:03}Z")
}

/// Convert days since 1970-01-01 to a (year, month, day) tuple.
/// Howard Hinnant's `civil_from_days` algorithm (valid for the full i64 range).
fn civil_from_days(z: u64) -> (u64, u64, u64) {
    let z = z as i64 + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64; // [0, 146096]
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365; // [0, 399]
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100); // [0, 365]
    let mp = (5 * doy + 2) / 153; // [0, 11]
    let d = doy - (153 * mp + 2) / 5 + 1; // [1, 31]
    let m = if mp < 10 { mp + 3 } else { mp - 9 }; // [1, 12]
    let y = if m <= 2 { y + 1 } else { y };
    (y as u64, m, d)
}

/// Format seconds as HH:MM:SS.mmm (dot separator, used by FFmpeg).
pub fn format_time(seconds: f64) -> String {
    let total_ms = (seconds * 1000.0).round() as u64;
    let hours = total_ms / 3_600_000;
    let minutes = (total_ms % 3_600_000) / 60_000;
    let secs = (total_ms % 60_000) / 1000;
    let millis = total_ms % 1000;
    format!("{:02}:{:02}:{:02}.{:03}", hours, minutes, secs, millis)
}

/// Format seconds as SRT subtitle time: HH:MM:SS,mmm
pub fn format_srt_time(seconds: f64) -> String {
    let total_ms = (seconds * 1000.0).round() as u64;
    let hours = total_ms / 3_600_000;
    let minutes = (total_ms % 3_600_000) / 60_000;
    let secs = (total_ms % 60_000) / 1000;
    let millis = total_ms % 1000;
    format!("{:02}:{:02}:{:02},{:03}", hours, minutes, secs, millis)
}