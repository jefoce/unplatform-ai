use super::{
    boot::{self, Health},
    RuntimeInfo, State, SHUTDOWN_TIMEOUT,
};
use crate::settings;
use std::{
    sync::atomic::Ordering,
    thread,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager, Wry};
use tauri_plugin_dialog::{
    DialogExt, MessageDialogButtons, MessageDialogKind, MessageDialogResult,
};

const SENDING_WAIT: Duration = Duration::from_secs(65);
const SEND_POLL: Duration = Duration::from_millis(250);

#[derive(Default)]
struct Pending {
    generating: u32,
    downloading: u32,
    sending: u32,
    uploading: u32,
    grace: u32,
}

impl Pending {
    fn from_health(health: Option<Health>) -> Self {
        let Some(health) = health else {
            return Self::default();
        };
        Self {
            generating: health.generating,
            downloading: health.downloading,
            sending: health.sending,
            uploading: health.uploading,
            grace: health.grace,
        }
    }

    fn busy(&self) -> bool {
        self.generating + self.downloading + self.sending + self.uploading + self.grace > 0
    }
}

/// Posts to the sidecar shutdown route with its session cookie.
fn request_shutdown(runtime: &RuntimeInfo, timeout: Duration) {
    let origin = format!("http://127.0.0.1:{}", runtime.port);
    let cookie = format!("upai_session={}", runtime.token);
    let _ = ureq::post(&format!("{origin}/api/system/shutdown"))
        .timeout(timeout)
        .set("Cookie", &cookie)
        .set("Origin", &origin)
        .call();
}

/// Prevents the default exit, asks the server to stop, then exits once.
pub fn shutdown_then_exit(app: &AppHandle<Wry>, api: tauri::ExitRequestApi) {
    let state = app.state::<State>();
    if state.exiting.load(Ordering::Relaxed) {
        return;
    }
    api.prevent_exit();
    if state.shutting_down.swap(true, Ordering::SeqCst) {
        return;
    }
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let pending = pending_work(&app).await;
        if pending.busy() && !confirm_quit(&app, &pending).await {
            app.state::<State>()
                .shutting_down
                .store(false, Ordering::SeqCst);
            return;
        }
        shutdown(app, pending.sending > 0).await;
    });
}

/// Last resort for exits that skip ExitRequested (macOS quit, AppleScript quit).
pub fn emergency_cleanup(app: &AppHandle<Wry>) {
    let state = app.state::<State>();
    if state.exiting.load(Ordering::Relaxed) {
        return;
    }
    state.shutting_down.store(true, Ordering::SeqCst);

    let runtime = state.runtime.lock().unwrap().clone();
    let sending = runtime
        .as_ref()
        .and_then(|runtime| boot::health(runtime.port))
        .is_some_and(|health| health.sending > 0);

    if let Some(runtime) = runtime {
        request_shutdown(&runtime, Duration::from_secs(2));
    }

    let deadline = Instant::now()
        + if sending {
            SENDING_WAIT
        } else {
            Duration::from_millis(1200)
        };
    while state.child.lock().unwrap().is_some() && Instant::now() < deadline {
        thread::sleep(Duration::from_millis(50));
    }

    if let Some(child) = state.child.lock().unwrap().take() {
        let _ = child.kill();
    };
}

async fn pending_work(app: &AppHandle<Wry>) -> Pending {
    let runtime = app.state::<State>().runtime.lock().unwrap().clone();
    let Some(runtime) = runtime else {
        return Pending::default();
    };
    let health = tauri::async_runtime::spawn_blocking(move || boot::health(runtime.port))
        .await
        .ok()
        .flatten();
    Pending::from_health(health)
}

/// True means Keep running. Runs off the main thread because the dialog blocks.
async fn confirm_quit(app: &AppHandle<Wry>, pending: &Pending) -> bool {
    let app = app.clone();
    let message = guard_text(pending);
    let choice = tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .message(message)
            .title("Videos still in progress")
            .kind(MessageDialogKind::Warning)
            .buttons(MessageDialogButtons::OkCancelCustom(
                "Keep running".to_string(),
                "Quit anyway".to_string(),
            ))
            .blocking_show_with_result()
    })
    .await
    .unwrap_or(MessageDialogResult::Cancel);

    !matches!(choice, MessageDialogResult::Custom(label) if label == "Quit anyway")
}

fn guard_text(pending: &Pending) -> String {
    let lines: Vec<String> = [
        group(
            pending.generating,
            "1 video keeps generating on OpenRouter, and the app downloads it when you open it again. Finished videos are kept only for a limited time, so open the app again within a few hours.",
            "{} videos keep generating on OpenRouter, and the app downloads them when you open it again. Finished videos are kept only for a limited time, so open the app again within a few hours.",
        ),
        group(
            pending.downloading,
            "1 video is being saved right now. Its download restarts the next time you open the app.",
            "{} videos are being saved right now. Their downloads restart the next time you open the app.",
        ),
        group(
            pending.sending,
            "1 video is being sent right now. The app finishes sending before it quits (up to a minute).",
            "{} videos are being sent right now. The app finishes sending before it quits (up to a minute).",
        ),
        group(
            pending.uploading,
            "1 video is uploading right now. Quitting stops the upload and you can run it again, nothing was charged.",
            "{} videos are uploading right now. Quitting stops the uploads and you can run them again, nothing was charged.",
        ),
        group(
            pending.grace,
            "1 video has not been sent yet. If the app stays closed for more than a minute, it will not be sent.",
            "{} videos have not been sent yet. If the app stays closed for more than a minute, they will not be sent.",
        ),
    ]
    .into_iter()
    .flatten()
    .collect();

    lines.join("\n\n")
}

fn group(count: u32, one: &str, many: &str) -> Option<String> {
    if count == 0 {
        return None;
    }
    Some(if count == 1 {
        one.to_string()
    } else {
        many.replace("{}", &count.to_string())
    })
}

async fn shutdown(app: AppHandle<Wry>, wait_sending: bool) {
    let state = app.state::<State>();
    let runtime = state.runtime.lock().unwrap().clone();

    if wait_sending {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.set_title("Unplatform AI (finishing sending...)");
        }
    }

    if let Some(runtime) = runtime.clone() {
        let _ = tauri::async_runtime::spawn_blocking(move || {
            request_shutdown(&runtime, Duration::from_secs(2));
        })
        .await;
    }

    let mut deadline = Instant::now()
        + if wait_sending {
            SENDING_WAIT
        } else {
            SHUTDOWN_TIMEOUT
        };
    let mut watching_sending = wait_sending;
    loop {
        if state.child.lock().unwrap().is_none() || Instant::now() >= deadline {
            break;
        }
        if watching_sending {
            let port = runtime.as_ref().map(|runtime| runtime.port);
            let still_sending = match port {
                Some(port) => tauri::async_runtime::spawn_blocking(move || boot::health(port))
                    .await
                    .ok()
                    .flatten()
                    .is_some_and(|health| health.sending > 0),
                None => false,
            };
            if !still_sending {
                watching_sending = false;
                deadline = deadline.min(Instant::now() + SHUTDOWN_TIMEOUT);
            }
        }
        let pause = if wait_sending {
            SEND_POLL
        } else {
            Duration::from_millis(100)
        };
        let _ = tauri::async_runtime::spawn_blocking(move || thread::sleep(pause)).await;
    }

    if let Some(window) = app.get_webview_window("main") {
        settings::save_window_bounds(&window);
    }
    if let Some(child) = state.child.lock().unwrap().take() {
        let _ = child.kill();
    }
    state.exiting.store(true, Ordering::SeqCst);
    app.exit(0);
}

#[cfg(test)]
mod tests {
    use super::{guard_text, Pending};

    #[test]
    fn counts_each_group_once() {
        let text = guard_text(&Pending {
            downloading: 1,
            ..Pending::default()
        });
        assert!(text.contains("being saved right now"));
        assert!(!text.contains("keeps generating"));
    }

    #[test]
    fn grace_only_says_not_sent() {
        let text = guard_text(&Pending {
            grace: 1,
            ..Pending::default()
        });
        assert!(text.contains("has not been sent yet"));
        assert!(!text.contains("keeps generating"));
    }

    #[test]
    fn uploading_says_nothing_was_charged() {
        let text = guard_text(&Pending {
            uploading: 1,
            ..Pending::default()
        });
        assert!(text.contains("nothing was charged"));
    }
}
