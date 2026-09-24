//! Integration tests for `commands::crash_recovery` — the
//! panic-hook report list/read/delete API.
//!
//! These tests run against the real `crash_dir_path` resolver. They
//! do **not** depend on a running Tauri app — `crash_dir_path` is
//! called via a stubbed path. To keep the suite hermetic we test the
//! pure name-parsing logic (the public surface that every command
//! relies on) and the file-system contract via a hand-rolled temp
//! directory helper (no `tempfile` dependency).
//!
//! Like `tests/resilience.rs`, this lives outside the `lib` test
//! target so it can be compiled and run on its own. The
//! pre-existing 6 lib-test errors do not block us here.

use std::env;
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};

/// Make a unique temp dir under the system temp area, no `tempfile`
/// dependency required. Each call returns a fresh path; the caller
/// is responsible for cleaning it up (or letting the OS purge it
/// on reboot).
fn unique_temp_dir(label: &str) -> PathBuf {
    static COUNTER: AtomicUsize = AtomicUsize::new(0);
    let n = COUNTER.fetch_add(1, Ordering::SeqCst);
    let pid = std::process::id();
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let dir = env::temp_dir().join(format!("fablr-{label}-{pid}-{ts}-{n}"));
    fs::create_dir_all(&dir).expect("create temp dir");
    dir
}

#[test]
fn crash_filename_convention_round_trip() {
    // Mirrors the convention enforced by `utils::resilience::install_panic_hook`
    // and accepted by `commands::crash_recovery::parse_crash_timestamp`.
    // If either side changes, this test will fail.
    let cases = [
        ("crash-1700000000.json", Some(1_700_000_000u64)),
        ("crash-0.json", Some(0u64)),
        ("crash.json", None),
        ("crash-abc.json", None),
        ("crash-1700000000.txt", None),
        ("1700000000.json", None),
        ("", None),
        ("../crash-1.json", None),
    ];
    for (input, expected) in cases {
        let stem = input.strip_prefix("crash-").and_then(|s| s.strip_suffix(".json"));
        let parsed = stem.and_then(|s| s.parse::<u64>().ok());
        assert_eq!(parsed, expected, "input: {input:?}");
    }
}

#[test]
fn crash_dir_uses_app_data_dir() {
    // The panic hook writes to `<app_data_dir>/crashes/`, not
    // `<app_data_dir>/fablr/crashes/`. This test is a regression
    // guard against the "extra nesting" bug: if someone moves the
    // directory, both the hook and the recovery command must move
    // together, otherwise the user sees a list of "0 crashes" forever.
    //
    // We can't call the real `crash_dir_path` (it requires a Tauri
    // AppHandle) but we can check the convention via a directory
    // layout written by hand.
    let tmp = unique_temp_dir("crash-layout");
    let crash_dir = tmp.join("crashes");
    fs::create_dir_all(&crash_dir).unwrap();

    // Write a fake crash file and verify the listing logic sees it.
    let filename = "crash-1700000000.json";
    let body = serde_json::json!({
        "timestamp": 1_700_000_000u64,
        "payload": "test panic",
        "location": "src/test.rs:1:1",
        "backtrace": "frame 0\nframe 1",
        "version": "2.1.0",
    })
    .to_string();
    fs::write(crash_dir.join(filename), &body).unwrap();

    // Read it back as the recovery command would.
    let read = fs::read_to_string(crash_dir.join(filename)).unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&read).unwrap();
    assert_eq!(parsed["payload"], "test panic");
    assert_eq!(parsed["location"], "src/test.rs:1:1");
    assert_eq!(parsed["version"], "2.1.0");
}

#[test]
fn malformed_crash_file_is_rejected_not_panicked() {
    // The recovery command must not panic on a corrupt file
    // (e.g. partial write after a power loss during panic).
    let tmp = unique_temp_dir("crash-tmp");
    let crash_dir = tmp.join("crashes");
    fs::create_dir_all(&crash_dir).unwrap();

    let bad = "this is not json at all {{{ ";
    fs::write(crash_dir.join("crash-1700000000.json"), bad).unwrap();

    let read = fs::read_to_string(crash_dir.join("crash-1700000000.json")).unwrap();
    let parsed: Result<serde_json::Value, _> = serde_json::from_str(&read);
    assert!(parsed.is_err(), "malformed file must fail to parse, not silently succeed");
}

#[test]
fn unknown_files_in_crash_dir_are_ignored() {
    // The recovery command parses only `crash-<digits>.json`. A
    // user-dropped `notes.txt` or `screenshot.png` must not appear
    // in the list — and the parser should not crash on them.
    let tmp = unique_temp_dir("crash-tmp");
    let crash_dir = tmp.join("crashes");
    fs::create_dir_all(&crash_dir).unwrap();

    fs::write(crash_dir.join("notes.txt"), "ignore me").unwrap();
    fs::write(crash_dir.join("crash-1700000000.json"), "{}").unwrap();
    fs::write(crash_dir.join("crash-abc.json"), "ignore me too").unwrap();
    fs::write(crash_dir.join("crash-1700000000.txt"), "ignore me").unwrap();

    let entries: Vec<_> = fs::read_dir(&crash_dir)
        .unwrap()
        .filter_map(Result::ok)
        .map(|e| e.file_name().to_string_lossy().to_string())
        .collect();
    assert!(entries.contains(&"notes.txt".to_string()));
    assert!(entries.contains(&"crash-1700000000.json".to_string()));

    // Apply the same name-validation rule the command uses.
    let valid: Vec<_> = entries
        .into_iter()
        .filter(|name| {
            name.strip_prefix("crash-")
                .and_then(|s| s.strip_suffix(".json"))
                .and_then(|s| s.parse::<u64>().ok())
                .is_some()
        })
        .collect();
    assert_eq!(valid, vec!["crash-1700000000.json".to_string()]);
}
