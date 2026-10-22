use super::{
    boot::{choose_port, spawn_child, wait_for_ready, Launch},
    fatal,
    logs::append_log,
    State,
};
use crate::{secrets, settings};
use std::{
    sync::{
        atomic::{AtomicU16, Ordering},
        Arc,
    },
    thread,
    time::Duration,
};
use tauri::{async_runtime::Receiver, AppHandle, Manager, Wry};
use tauri_plugin_shell::process::CommandEvent;

/// Keeps the sidecar alive with one restart, switching port on EADDRINUSE.
pub(crate) async fn supervise(
    app: AppHandle<Wry>,
    mut launch: Launch,
    mut receiver: Receiver<CommandEvent>,
    allowed_port: Arc<AtomicU16>,
) {
    let mut restarts = 0;
    loop {
        let mut last_error = String::new();
        let mut code = None;
        let mut stdout = Vec::new();

        while let Some(event) = receiver.recv().await {
            match event {
                CommandEvent::Stdout(bytes) => feed_stdout(&app, &mut stdout, &bytes),
                CommandEvent::Stderr(bytes) => {
                    last_error = String::from_utf8_lossy(&bytes).into_owned();
                    append_log(&bytes);
                }
                CommandEvent::Error(error) => {
                    last_error = error.clone();
                    append_log(format!("[unplatform-ai] sidecar error: {error}").as_bytes());
                }
                CommandEvent::Terminated(payload) => {
                    flush_stdout(&app, &mut stdout);
                    code = payload.code;
                    break;
                }
                _ => {}
            }
        }

        app.state::<State>().child.lock().unwrap().take();
        if shutting_down(&app) {
            return;
        }
        if code == Some(75) {
            let detail = if last_error.is_empty() {
                "The server lock is held by another instance."
            } else {
                &last_error
            };
            fatal(&app, detail);
            return;
        }
        if restarts >= 1 {
            fatal(&app, "Server stopped. Check the log for details.");
            return;
        }

        restarts += 1;
        let addr_in_use = last_error.contains("EADDRINUSE");
        append_log(b"[unplatform-ai] server stopped, restarting once");
        let _ = tauri::async_runtime::spawn_blocking(|| {
            thread::sleep(Duration::from_millis(500));
        })
        .await;
        if shutting_down(&app) {
            return;
        }

        if addr_in_use {
            match choose_port(0) {
                Ok((port, _)) => switch_port(&app, &mut launch, &allowed_port, port),
                Err(error) => {
                    fatal(&app, &error);
                    return;
                }
            }
        }

        match spawn_child(&app, &launch) {
            Ok(next) => {
                receiver = next;
                let ready = tauri::async_runtime::spawn_blocking({
                    let allowed_port = allowed_port.clone();
                    move || wait_for_ready(allowed_port)
                })
                .await
                .unwrap_or(false);
                if !ready {
                    fatal(&app, "Server restarted but did not become ready.");
                    return;
                }
                if shutting_down(&app) {
                    return;
                }
                if let Some(window) = app.get_webview_window("main") {
                    if let Ok(url) = launch.session_url.parse() {
                        let _ = window.navigate(url);
                    }
                }
            }
            Err(error) => {
                fatal(&app, &error);
                return;
            }
        }
    }
}

/// Splits sidecar stdout on newlines, secrets lines never reach the log.
fn feed_stdout(app: &AppHandle<Wry>, buffer: &mut Vec<u8>, bytes: &[u8]) {
    buffer.extend_from_slice(bytes);
    while let Some(index) = buffer.iter().position(|byte| *byte == b'\n') {
        let line: Vec<u8> = buffer.drain(..=index).collect();
        emit_stdout_line(app, &line[..line.len() - 1]);
    }
}

fn flush_stdout(app: &AppHandle<Wry>, buffer: &mut Vec<u8>) {
    if buffer.is_empty() {
        return;
    }
    let line = std::mem::take(buffer);
    emit_stdout_line(app, &line);
}

fn emit_stdout_line(app: &AppHandle<Wry>, line: &[u8]) {
    let text = String::from_utf8_lossy(line);
    let text = text.trim_end_matches('\r');
    if let Some(payload) = text.strip_prefix(secrets::PREFIX) {
        handle_secret_line(app, payload);
        return;
    }
    if !line.is_empty() {
        append_log(line);
    }
}

fn handle_secret_line(app: &AppHandle<Wry>, payload: &str) {
    let spawn = app.state::<State>().spawn_count.load(Ordering::SeqCst);
    let request = match secrets::parse(payload) {
        Ok(request) => request,
        Err(_) => {
            append_log(b"[unplatform-ai] bad secrets request");
            if let Some(id) = secrets::request_id(payload) {
                secrets::send(app, &secrets::bad_request_line(id), spawn);
            }
            return;
        }
    };
    let app = app.clone();
    let _ = tauri::async_runtime::spawn_blocking(move || {
        let result = secrets::execute(&request);
        let status = if result.is_ok() { "ok" } else { "failed" };
        append_log(
            format!(
                "[unplatform-ai] secrets op {} {} {}",
                request.op, request.name, status
            )
            .as_bytes(),
        );
        secrets::send(&app, &secrets::reply_line(request.id, result), spawn);
    });
}

fn shutting_down(app: &AppHandle<Wry>) -> bool {
    app.state::<State>().shutting_down.load(Ordering::Relaxed)
}

/// Moves the launch, runtime state and persisted settings to a new port.
fn switch_port(app: &AppHandle<Wry>, launch: &mut Launch, allowed_port: &AtomicU16, port: u16) {
    launch.port = port;
    launch.session_url = format!("http://127.0.0.1:{port}/api/session?t={}", launch.token);
    allowed_port.store(port, Ordering::SeqCst);
    if let Some(runtime) = app.state::<State>().runtime.lock().unwrap().as_mut() {
        runtime.port = port;
    }
    let mut desktop = settings::load();
    desktop.port = port;
    if let Err(error) = settings::save(&desktop) {
        append_log(format!("[unplatform-ai] could not save port {port}: {error}").as_bytes());
    }
    append_log(format!("[unplatform-ai] port {port} selected after EADDRINUSE").as_bytes());
}
