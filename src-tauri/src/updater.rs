use crate::server::{
    clear_stop_flags, confirm_quit, logs::append_desktop_log, pending_work, restart_sidecar,
    stop_server, wait_sidecar_ready,
};
use crate::settings;
use serde::Serialize;
use std::sync::Mutex;
use tauri::{ipc::Channel, AppHandle, Manager, Wry};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_updater::{Update, UpdaterExt};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};

const RELEASE_URL: &str = "https://github.com/jefoce/unplatform-ai/releases/latest";
const INSTALL_FAILED: &str =
    "The update could not be installed. Try again or download it from the release page.";

/// Bytes kept for the session so a retry after cancel skips the download.
#[derive(Default)]
pub(crate) struct UpdateState {
    downloaded: Mutex<Option<(String, Vec<u8>)>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UpdateInfo {
    version: String,
    install_kind: &'static str,
    auto_check: bool,
    last_check: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AvailableUpdate {
    version: String,
    notes: String,
    date: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct InstallOutcome {
    cancelled: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UpdateProgress {
    downloaded: u64,
    total: Option<u64>,
    phase: UpdatePhase,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum UpdatePhase {
    Downloading,
    Installing,
}

#[tauri::command]
pub(crate) fn update_info(app: AppHandle<Wry>) -> UpdateInfo {
    let settings = settings::load();

    UpdateInfo {
        version: app.package_info().version.to_string(),
        install_kind: install_kind(),
        auto_check: settings.auto_check_updates,
        last_check: settings.last_update_check,
    }
}

#[tauri::command]
pub(crate) async fn update_check(app: AppHandle<Wry>) -> Result<Option<AvailableUpdate>, String> {
    let update = build_updater(&app)?.check().await.map_err(error_text)?;

    let checked_at = now_rfc3339();
    settings::update(|settings| settings.last_update_check = Some(checked_at))?;

    Ok(update.map(available_update))
}

/// Logs the raw installer error, returns the line the UI may show.
fn install_failure(error: &str, log: impl FnOnce(String)) -> String {
    log(format!("[unplatform-ai] update install failed: {error}"));

    INSTALL_FAILED.to_string()
}

/// Runs the recovery only when the install failed.
fn finish_install<F>(install_error: Option<String>, recover: F) -> Result<(), String>
where
    F: FnOnce(String) -> Result<(), String>,
{
    match install_error {
        Some(error) => recover(error),
        None => Ok(()),
    }
}

/// Starts the sidecar again after the stop that precedes every install.
/// The install error stays in the result, even when the restart also fails.
fn recover_server_after_failed_install(
    install_error: String,
    clear_flags: impl FnOnce(),
    spawn: impl FnOnce() -> Result<(), String>,
    wait_ready: impl FnOnce() -> Result<(), String>,
) -> Result<(), String> {
    clear_flags();
    match spawn().and_then(|()| wait_ready()) {
        Ok(()) => Err(install_error),
        Err(cause) => Err(format!(
            "{install_error} The server did not restart: {cause}"
        )),
    }
}

#[tauri::command]
pub(crate) async fn update_install(
    app: AppHandle<Wry>,
    channel: Channel<UpdateProgress>,
) -> Result<InstallOutcome, String> {
    let updater = build_updater(&app)?;
    let update = updater
        .check()
        .await
        .map_err(error_text)?
        .ok_or_else(|| "No update found".to_string())?;

    if install_kind() == "linux-package" {
        return Err("This Linux package cannot install updates itself. Download the new version from the release page.".to_string());
    }

    let version = update.version.clone();
    let state = app.state::<UpdateState>();
    let cached = take_cached(&state, &version);
    let bytes = match cached {
        Some(bytes) => bytes,
        None => {
            let progress = channel.clone();
            let mut downloaded = 0_u64;

            update
                .download(
                    move |chunk, total| {
                        downloaded += chunk as u64;
                        let _ = progress.send(UpdateProgress {
                            downloaded,
                            total: total.map(|value| value as u64),
                            phase: UpdatePhase::Downloading,
                        });
                    },
                    || {},
                )
                .await
                .map_err(error_text)?
        }
    };

    let pending = pending_work(&app).await;
    if pending.busy() && !confirm_quit(&app, &pending, "Update now?").await {
        state.downloaded.lock().unwrap().replace((version, bytes));

        return Ok(InstallOutcome { cancelled: true });
    }

    send_progress(
        &channel,
        UpdateProgress {
            downloaded: 0,
            total: None,
            phase: UpdatePhase::Installing,
        },
    )?;

    stop_server(&app, pending.needs_wait()).await;

    let installed = tauri::async_runtime::spawn_blocking(move || update.install(bytes))
        .await
        .map_err(|error| format!("Update install task failed: {error}"))?;
    let install_error = installed.err().map(|error| {
        install_failure(&error.to_string(), |line| {
            append_desktop_log(line.as_bytes());
        })
    });
    let handle = app.clone();
    let recovered = tauri::async_runtime::spawn_blocking(move || {
        finish_install(install_error, |error| {
            recover_server_after_failed_install(
                error,
                || clear_stop_flags(&handle),
                || restart_sidecar(&handle),
                || wait_sidecar_ready(&handle),
            )
        })
    })
    .await
    .map_err(|error| format!("Update recovery task failed: {error}"))?;
    recovered?;

    #[cfg(target_os = "macos")]
    clear_quarantine();

    app.request_restart();

    Ok(InstallOutcome { cancelled: false })
}

#[tauri::command]
pub(crate) fn update_set_auto(is_on: bool) -> Result<(), String> {
    settings::update(|settings| settings.auto_check_updates = is_on)
}

#[tauri::command]
pub(crate) fn update_open_release(app: AppHandle<Wry>) -> Result<(), String> {
    app.opener()
        .open_url(RELEASE_URL, None::<String>)
        .map_err(|error| format!("Open release page: {error}"))
}

/// Builds the updater, using `UPAI_UPDATE_ENDPOINT` for release-candidate tests.
fn build_updater(app: &AppHandle<Wry>) -> Result<tauri_plugin_updater::Updater, String> {
    let builder = app.updater_builder();
    let builder = match std::env::var("UPAI_UPDATE_ENDPOINT") {
        Ok(endpoint) if !endpoint.is_empty() => {
            let url = endpoint
                .parse::<tauri::Url>()
                .map_err(|error| format!("Invalid UPAI_UPDATE_ENDPOINT: {error}"))?;
            builder.endpoints(vec![url]).map_err(error_text)?
        }
        _ => builder,
    };

    builder.build().map_err(error_text)
}

fn available_update(update: Update) -> AvailableUpdate {
    AvailableUpdate {
        version: update.version,
        notes: update.body.unwrap_or_default(),
        date: update.date.map(rfc3339),
    }
}

fn take_cached(state: &UpdateState, version: &str) -> Option<Vec<u8>> {
    let mut cache = state.downloaded.lock().unwrap();
    let is_match = cache.as_ref().is_some_and(|(cached, _)| cached == version);
    if !is_match {
        return None;
    }

    cache.take().map(|(_, bytes)| bytes)
}

fn send_progress(
    channel: &Channel<UpdateProgress>,
    progress: UpdateProgress,
) -> Result<(), String> {
    channel
        .send(progress)
        .map_err(|error| format!("Update progress: {error}"))
}

fn now_rfc3339() -> String {
    rfc3339(OffsetDateTime::now_utc())
}

fn rfc3339(date: OffsetDateTime) -> String {
    date.format(&Rfc3339).unwrap_or_else(|_| date.to_string())
}

fn error_text(error: tauri_plugin_updater::Error) -> String {
    error.to_string()
}

#[cfg(target_os = "macos")]
fn install_kind() -> &'static str {
    "macos"
}

#[cfg(target_os = "windows")]
fn install_kind() -> &'static str {
    "windows"
}

#[cfg(target_os = "linux")]
fn install_kind() -> &'static str {
    if std::env::var_os("APPIMAGE").is_some() {
        "appimage"
    } else {
        "linux-package"
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
fn install_kind() -> &'static str {
    "linux-package"
}

/// Removes a quarantine flag from the new bundle. Best effort, never fails the update.
#[cfg(target_os = "macos")]
fn clear_quarantine() {
    use std::process::Command;

    let Some(bundle) = current_bundle() else {
        append_desktop_log(b"[unplatform-ai] update quarantine: no .app bundle");
        return;
    };
    let is_quarantined = Command::new("/usr/bin/xattr")
        .args(["-p", "com.apple.quarantine"])
        .arg(&bundle)
        .output()
        .is_ok_and(|output| output.status.success());
    if !is_quarantined {
        append_desktop_log(b"[unplatform-ai] update quarantine: not present");
        return;
    }

    let outcome = Command::new("/usr/bin/xattr")
        .args(["-dr", "com.apple.quarantine"])
        .arg(&bundle)
        .output();
    let line = match outcome {
        Ok(output) if output.status.success() => "update quarantine: removed".to_string(),
        Ok(output) => format!(
            "update quarantine: removal failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ),
        Err(error) => format!("update quarantine: removal failed: {error}"),
    };
    append_desktop_log(format!("[unplatform-ai] {line}").as_bytes());
}

#[cfg(target_os = "macos")]
fn current_bundle() -> Option<std::path::PathBuf> {
    let exe = std::env::current_exe().ok()?;
    exe.ancestors()
        .find(|path| path.extension().is_some_and(|extension| extension == "app"))
        .map(std::path::Path::to_path_buf)
}

#[cfg(test)]
mod tests {
    use super::{
        finish_install, install_failure, recover_server_after_failed_install, INSTALL_FAILED,
    };
    use std::cell::Cell;

    #[test]
    fn a_failed_install_restarts_the_server() {
        let shutting_down = Cell::new(true);
        let exiting = Cell::new(true);
        let spawns = Cell::new(0);
        let waits = Cell::new(0);

        let outcome = finish_install(Some(INSTALL_FAILED.to_string()), |error| {
            recover_server_after_failed_install(
                error,
                || {
                    shutting_down.set(false);
                    exiting.set(false);
                },
                || {
                    spawns.set(spawns.get() + 1);
                    Ok(())
                },
                || {
                    waits.set(waits.get() + 1);
                    Ok(())
                },
            )
        });

        assert!(!shutting_down.get());
        assert!(!exiting.get());
        assert_eq!(spawns.get(), 1);
        assert_eq!(waits.get(), 1);
        assert_eq!(outcome, Err(INSTALL_FAILED.to_string()));
    }

    #[test]
    fn a_successful_install_does_not_restart_the_server() {
        let spawns = Cell::new(0);

        let outcome = finish_install(None, |_error| {
            spawns.set(spawns.get() + 1);
            Ok(())
        });

        assert_eq!(outcome, Ok(()));
        assert_eq!(spawns.get(), 0);
    }

    #[test]
    fn a_failed_restart_keeps_both_errors() {
        let outcome = recover_server_after_failed_install(
            INSTALL_FAILED.to_string(),
            || {},
            || Err("spawn sidecar: missing binary".to_string()),
            || Ok(()),
        );

        let error = outcome.expect_err("install failure");
        assert!(error.contains(INSTALL_FAILED));
        assert!(error.contains("missing binary"));
    }

    #[test]
    fn a_missing_ready_keeps_both_errors() {
        let outcome = recover_server_after_failed_install(
            INSTALL_FAILED.to_string(),
            || {},
            || Ok(()),
            || Err("The server did not become ready".to_string()),
        );

        let error = outcome.expect_err("install failure");
        assert!(error.contains(INSTALL_FAILED));
        assert!(error.contains("did not become ready"));
    }

    /// The UI gets the friendly line, never the raw installer reason.
    #[test]
    fn install_failure_hides_the_raw_error() {
        let shown = install_failure("mount failed: bad dmg", |_line| {});

        assert_eq!(shown, INSTALL_FAILED);
        assert!(!shown.contains("mount failed"));
    }

    /// The raw reason reaches the log once, with the prefix the log greps for.
    #[test]
    fn install_failure_logs_the_raw_error_once() {
        let mut lines: Vec<String> = Vec::new();
        let _ = install_failure("mount failed: bad dmg", |line| lines.push(line));

        assert_eq!(lines.len(), 1);
        assert!(lines[0].contains("update install failed"));
        assert!(lines[0].contains("mount failed: bad dmg"));
    }

    /// A failed install points the user at the release page.
    #[test]
    fn install_failure_points_at_the_release_page() {
        assert!(INSTALL_FAILED.contains("release page"));
    }
}
