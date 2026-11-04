use crate::server::{confirm_quit, logs::append_desktop_log, pending_work, stop_server};
use crate::settings;
use serde::Serialize;
use std::sync::Mutex;
use tauri::{ipc::Channel, AppHandle, Manager, Wry};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_updater::{Update, UpdaterExt};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};

const RELEASE_URL: &str = "https://github.com/jefoce/unplatform-ai/releases/latest";

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
    if let Err(error) = installed {
        append_desktop_log(
            format!("[unplatform-ai] update install failed: {error}").as_bytes(),
        );
        app.request_restart();

        return Err(format!("Update install failed: {error}"));
    }

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
    let is_match = cache
        .as_ref()
        .is_some_and(|(cached, _)| cached == version);
    if !is_match {
        return None;
    }

    cache.take().map(|(_, bytes)| bytes)
}

fn send_progress(channel: &Channel<UpdateProgress>, progress: UpdateProgress) -> Result<(), String> {
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
