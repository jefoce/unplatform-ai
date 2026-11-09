mod boot;
mod diagnostics;
pub(crate) mod logs;
mod shutdown;
mod shutdown_waits;
mod supervisor;

use std::{
    sync::{
        atomic::{AtomicBool, AtomicU16, AtomicU64, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};
use tauri::{AppHandle, Manager, Wry};
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};
use tauri_plugin_shell::process::CommandChild;

pub use boot::boot;
pub use shutdown::{emergency_cleanup, shutdown_then_exit};
pub(crate) use shutdown::stop_server;
pub(crate) use shutdown::{confirm_quit, pending_work};

pub(crate) const HEALTH_TIMEOUT: Duration = Duration::from_millis(500);
pub(crate) const READY_TIMEOUT: Duration = Duration::from_secs(30);
pub(crate) const SHUTDOWN_TIMEOUT: Duration = Duration::from_secs(7);
pub(crate) const LOG_LIMIT: u64 = 5 * 1024 * 1024;

#[derive(Default)]
pub struct State {
    pub(crate) child: Mutex<Option<CommandChild>>,
    pub(crate) runtime: Mutex<Option<RuntimeInfo>>,
    /// Shared with the sidecar, so the webview cannot register export paths.
    pub(crate) parent_secret: Mutex<Option<String>>,
    /// Port the webview may navigate to. Updated when the sidecar respawns.
    pub(crate) allowed_port: Arc<AtomicU16>,
    /// Increments per sidecar spawn so replies meant for an older one are dropped.
    pub(crate) spawn_count: AtomicU64,
    pub(crate) shutting_down: AtomicBool,
    pub(crate) exiting: AtomicBool,
    pub(crate) fatal: AtomicBool,
}

#[derive(Clone)]
pub(crate) struct RuntimeInfo {
    pub(crate) port: u16,
    pub(crate) token: String,
}

pub fn show_main(app: &AppHandle<Wry>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Writes a panic message and location to desktop.log before the default hook runs.
pub fn record_panic(info: &std::panic::PanicHookInfo<'_>) {
    let payload = info.payload();
    let message = payload
        .downcast_ref::<&str>()
        .copied()
        .or_else(|| payload.downcast_ref::<String>().map(String::as_str))
        .unwrap_or("non-string panic payload");
    let location = info
        .location()
        .map(|location| {
            format!(
                "{}:{}:{}",
                location.file(),
                location.line(),
                location.column()
            )
        })
        .unwrap_or_else(|| "unknown location".to_string());
    logs::append_desktop_log(format!("[unplatform-ai] panic: {message} at {location}").as_bytes());
}

const CLIENT_RESOURCE_LIMIT: usize = 64;
const CLIENT_MESSAGE_LIMIT: usize = 500;

/// Drops line breaks and caps on a char boundary so client text cannot forge log lines.
fn sanitize_client_text(text: &str, limit: usize) -> String {
    text.chars()
        .filter(|c| !matches!(*c, '\r' | '\n'))
        .take(limit)
        .collect()
}

/// Builds the sanitized desktop log line for a webview failure.
fn client_error_line(resource: &str, message: &str) -> String {
    format!(
        "[unplatform-ai] {}: {}",
        sanitize_client_text(resource, CLIENT_RESOURCE_LIMIT),
        sanitize_client_text(message, CLIENT_MESSAGE_LIMIT),
    )
}

/// Writes a webview failure to desktop.log. The caller passes a resource name, never a path.
#[tauri::command]
pub(crate) fn log_client_error(resource: String, message: String) {
    logs::append_desktop_log(client_error_line(&resource, &message).as_bytes());
}

/// Shows a native fatal dialog and exits. Only the first call has an effect.
pub fn fatal(app: &AppHandle<Wry>, message: &str) {
    let state = app.state::<State>();
    if state.fatal.swap(true, Ordering::SeqCst) {
        return;
    }
    logs::append_log(format!("[unplatform-ai] fatal: {message}").as_bytes());
    let log = crate::settings::logs_dir()
        .map(|dir| dir.join("server.log").display().to_string())
        .unwrap_or_else(|_| "~/.unplatform-ai/logs/server.log".to_string());
    app.dialog()
        .message(format!("{message}\n\nLog: {log}"))
        .title("Unplatform AI")
        .kind(MessageDialogKind::Error)
        .blocking_show();
    app.exit(1);
}

#[cfg(test)]
mod tests {
    use super::client_error_line;

    #[test]
    fn strips_line_breaks() {
        let line = client_error_line("ui\r\nnav", "boom\nhere\r");

        assert_eq!(line, "[unplatform-ai] uinav: boomhere");
    }

    #[test]
    fn caps_the_resource() {
        let resource = "r".repeat(100);
        let line = client_error_line(&resource, "x");

        assert_eq!(line, format!("[unplatform-ai] {}: x", "r".repeat(64)));
    }

    #[test]
    fn caps_the_message() {
        let message = "m".repeat(600);
        let line = client_error_line("ui", &message);

        assert_eq!(line, format!("[unplatform-ai] ui: {}", "m".repeat(500)));
    }

    #[test]
    fn caps_multibyte_at_a_char_boundary() {
        let message = "é".repeat(600);
        let line = client_error_line("ui", &message);
        let expected = format!("[unplatform-ai] ui: {}", "é".repeat(500));

        assert_eq!(line, expected);
    }
}
