use super::{
    boot::{self, Health},
    shutdown_waits::{DOWNLOAD_WAIT_MS, IMAGE_WAIT_MS, WORK_WAIT_MS},
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

// Generated from src/core/constants.ts by scripts/shutdown-waits.mjs.
const IMAGE_WORK_WAIT: Duration = Duration::from_millis(IMAGE_WAIT_MS);
const DOWNLOAD_WORK_WAIT: Duration = Duration::from_millis(DOWNLOAD_WAIT_MS);
// Quitting waits for the slowest case, never less than the image waves.
const WORK_WAIT: Duration = Duration::from_millis(WORK_WAIT_MS);
const WORK_POLL: Duration = Duration::from_millis(250);

#[derive(Default)]
pub(crate) struct Pending {
    generating: u32,
    downloading: u32,
    sending: u32,
    image_sending: u32,
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
            image_sending: health.image_sending,
            uploading: health.uploading,
            grace: health.grace,
        }
    }

    pub(crate) fn busy(&self) -> bool {
        self.generating
            + self.downloading
            + self.sending
            + self.image_sending
            + self.uploading
            + self.grace
            > 0
    }

    pub(crate) fn needs_wait(&self) -> bool {
        self.sending + self.image_sending + self.downloading > 0
    }

    /// A confirmed quit waits only for sends. Downloads resume next launch.
    pub(crate) fn needs_send_wait(&self) -> bool {
        self.sending + self.image_sending > 0
    }

    fn has_videos(&self) -> bool {
        self.generating + self.downloading + self.sending + self.uploading + self.grace > 0
    }
}

/// Dialog title that names the kinds still running.
fn quit_title(pending: &Pending) -> &'static str {
    match (pending.has_videos(), pending.image_sending > 0) {
        (true, true) => "Videos and images still in progress",
        (false, true) => "Images still in progress",
        _ => "Videos still in progress",
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
        if pending.busy() && !confirm_quit(&app, &pending, quit_title(&pending)).await {
            app.state::<State>()
                .shutting_down
                .store(false, Ordering::SeqCst);
            return;
        }
        shutdown(&app, pending.needs_send_wait()).await;
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
    let waiting = runtime
        .as_ref()
        .and_then(|runtime| boot::health(runtime.port))
        .is_some_and(|health| {
            health.sending + health.image_sending + health.downloading > 0
        });

    if let Some(runtime) = runtime {
        request_shutdown(&runtime, Duration::from_secs(2));
    }

    let deadline = Instant::now()
        + if waiting {
            WORK_WAIT
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

pub(crate) async fn pending_work(app: &AppHandle<Wry>) -> Pending {
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
pub(crate) async fn confirm_quit(app: &AppHandle<Wry>, pending: &Pending, title: &str) -> bool {
    let app = app.clone();
    let message = guard_text(pending);
    let title = title.to_string();
    let choice = tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .message(message)
            .title(title)
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
            "1 video is being sent right now. The app finishes sending before it quits (up to five minutes).",
            "{} videos are being sent right now. The app finishes sending before it quits (up to five minutes).",
        ),
        group(
            pending.image_sending,
            "1 image request is still generating. If you quit now, it may be charged and lost.",
            "{} image requests are still generating. If you quit now, they may be charged and lost.",
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

/// Stops the sidecar and marks the app as exiting, without exiting the process.
pub(crate) async fn stop_server(app: &AppHandle<Wry>, wait_work: bool) {
    app.state::<State>()
        .shutting_down
        .store(true, Ordering::SeqCst);
    let state = app.state::<State>();
    let runtime = state.runtime.lock().unwrap().clone();

    if wait_work {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.set_title("Unplatform AI (finishing work...)");
        }
    }

    if let Some(runtime) = runtime.clone() {
        let _ = tauri::async_runtime::spawn_blocking(move || {
            request_shutdown(&runtime, Duration::from_secs(2));
        })
        .await;
    }

    let mut deadline = Instant::now()
        + if wait_work {
            WORK_WAIT
        } else {
            SHUTDOWN_TIMEOUT
        };
    let mut watching_work = wait_work;
    loop {
        if state.child.lock().unwrap().is_none() || Instant::now() >= deadline {
            break;
        }
        if watching_work {
            let port = runtime.as_ref().map(|runtime| runtime.port);
            let still_working = match port {
                Some(port) => tauri::async_runtime::spawn_blocking(move || boot::health(port))
                    .await
                    .ok()
                    .flatten()
                    .is_some_and(|health| {
                        health.sending + health.image_sending + health.downloading > 0
                    }),
                None => false,
            };
            if !still_working {
                watching_work = false;
                deadline = deadline.min(Instant::now() + SHUTDOWN_TIMEOUT);
            }
        }
        let pause = if wait_work {
            WORK_POLL
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
}

/// Stops the sidecar, then exits. The quit path keeps its work wait.
async fn shutdown(app: &AppHandle<Wry>, wait_work: bool) {
    stop_server(app, wait_work).await;
    app.exit(0);
}

#[cfg(test)]
mod tests {
    use super::{guard_text, Pending, DOWNLOAD_WORK_WAIT, IMAGE_WORK_WAIT, WORK_WAIT};
    use crate::server::boot::Health;
    use serde_json::json;

    fn health_with_image_sending() -> Health {
        let fixture = json!({
            "app": "unplatform-ai",
            "pid": 4242,
            "version": "0.4.0",
            "desktop": true,
            "ready": true,
            "generating": 0,
            "downloading": 0,
            "sending": 0,
            "imageSending": 1,
            "uploading": 0,
            "grace": 0,
            "rssMb": 120
        });
        serde_json::from_value(fixture).expect("parse health")
    }

    fn health_with_download() -> Health {
        let mut health = health_with_image_sending();
        health.image_sending = 0;
        health.downloading = 1;
        health
    }

    #[test]
    fn work_wait_covers_image_and_download_waits() {
        assert!(WORK_WAIT >= IMAGE_WORK_WAIT);
        assert!(WORK_WAIT >= DOWNLOAD_WORK_WAIT);
    }

    #[test]
    fn parses_image_sending_from_camel_case() {
        assert_eq!(health_with_image_sending().image_sending, 1);
    }

    #[test]
    fn image_sending_keeps_the_quit_guard_waiting() {
        let pending = Pending::from_health(Some(health_with_image_sending()));
        assert!(pending.busy());
        assert!(pending.needs_wait());
    }

    #[test]
    fn downloading_keeps_the_quit_guard_waiting() {
        let pending = Pending::from_health(Some(health_with_download()));
        assert!(pending.busy());
        assert!(pending.needs_wait());
    }

    #[test]
    fn download_only_does_not_need_a_send_wait() {
        let pending = Pending::from_health(Some(health_with_download()));
        assert!(!pending.needs_send_wait());
    }

    #[test]
    fn video_sending_keeps_the_quit_path_waiting() {
        let mut health = health_with_download();
        health.sending = 1;

        let pending = Pending::from_health(Some(health));
        assert!(pending.needs_send_wait());
    }

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
    fn image_sending_warns_about_the_charge() {
        let text = guard_text(&Pending {
            image_sending: 1,
            ..Pending::default()
        });
        assert!(text.contains("1 image request is still generating"));
        assert!(!text.contains("video"));
    }

    #[test]
    fn uploading_says_nothing_was_charged() {
        let text = guard_text(&Pending {
            uploading: 1,
            ..Pending::default()
        });
        assert!(text.contains("nothing was charged"));
    }

    #[test]
    fn quit_title_names_the_pending_kinds() {
        assert_eq!(
            super::quit_title(&Pending {
                generating: 1,
                ..Pending::default()
            }),
            "Videos still in progress"
        );
        assert_eq!(
            super::quit_title(&Pending {
                image_sending: 1,
                ..Pending::default()
            }),
            "Images still in progress"
        );
        assert_eq!(
            super::quit_title(&Pending {
                generating: 1,
                image_sending: 1,
                ..Pending::default()
            }),
            "Videos and images still in progress"
        );
    }
}
