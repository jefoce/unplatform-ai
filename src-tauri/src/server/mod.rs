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
