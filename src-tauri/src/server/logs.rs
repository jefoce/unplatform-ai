use super::LOG_LIMIT;
use crate::settings;
use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::Path,
};

/// Appends a sidecar log line, rotating the file once it reaches the limit.
pub(crate) fn append_log(line: &[u8]) {
    append_to("server.log", line);
}

/// Appends a shell log line, using the same rotation as the sidecar log.
pub(crate) fn append_desktop_log(line: &[u8]) {
    append_to("desktop.log", line);
}

fn append_to(name: &str, line: &[u8]) {
    let Ok(logs) = settings::logs_dir() else {
        return;
    };
    if fs::create_dir_all(&logs).is_err() {
        return;
    }
    let log = logs.join(name);
    if fs::metadata(&log).is_ok_and(|metadata| metadata.len() >= LOG_LIMIT) {
        rotate_logs(&log);
    }
    let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&log) else {
        return;
    };
    let _ = file.write_all(line);
    if !line.ends_with(b"\n") {
        let _ = file.write_all(b"\n");
    }
}

fn rotate_logs(log: &Path) {
    let third = log.with_extension("log.3");
    let second = log.with_extension("log.2");
    let first = log.with_extension("log.1");
    let _ = fs::remove_file(&third);
    let _ = fs::rename(&second, &third);
    let _ = fs::rename(&first, &second);
    let _ = fs::rename(log, &first);
}
