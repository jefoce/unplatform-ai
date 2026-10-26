use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::PathBuf,
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
    thread,
    time::Duration,
};
use tauri::{WebviewWindow, Wry};

pub const DEFAULT_PORT: u16 = 47821;
pub const DEFAULT_WIDTH: f64 = 1440.0;
pub const DEFAULT_HEIGHT: f64 = 900.0;
pub const MIN_WIDTH: f64 = 1024.0;
pub const MIN_HEIGHT: f64 = 700.0;

static SAVE_GENERATION: AtomicU64 = AtomicU64::new(0);
static WRITE_LOCK: Mutex<()> = Mutex::new(());

#[cfg(test)]
static TEST_SETTINGS_PATH: Mutex<Option<PathBuf>> = Mutex::new(None);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct DesktopSettings {
    pub port: u16,
    pub window: WindowBounds,
    pub close_hint_shown: bool,
    #[serde(default = "default_auto_check_updates")]
    pub auto_check_updates: bool,
    #[serde(default)]
    pub last_update_check: Option<String>,
}

impl Default for DesktopSettings {
    fn default() -> Self {
        Self {
            port: DEFAULT_PORT,
            window: WindowBounds::default(),
            close_hint_shown: false,
            auto_check_updates: default_auto_check_updates(),
            last_update_check: None,
        }
    }
}

fn default_auto_check_updates() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct WindowBounds {
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub width: f64,
    pub height: f64,
}

impl Default for WindowBounds {
    fn default() -> Self {
        Self {
            x: None,
            y: None,
            width: DEFAULT_WIDTH,
            height: DEFAULT_HEIGHT,
        }
    }
}

/// The single app data folder used by the server and the desktop shell.
pub fn data_dir() -> Result<PathBuf, String> {
    dirs::home_dir()
        .map(|home| home.join(".unplatform-ai"))
        .ok_or_else(|| "Could not find the home directory".to_string())
}

pub fn logs_dir() -> Result<PathBuf, String> {
    Ok(data_dir()?.join("logs"))
}

/// Parent of the per-version writable server copies.
pub fn runtime_root() -> Result<PathBuf, String> {
    Ok(data_dir()?.join("runtime"))
}

/// Writable server copy for one app version.
pub fn runtime_dir(version: &str) -> Result<PathBuf, String> {
    Ok(runtime_root()?.join(version))
}

fn settings_path() -> Result<PathBuf, String> {
    #[cfg(test)]
    {
        let override_path = TEST_SETTINGS_PATH
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if let Some(path) = override_path.as_ref() {
            return Ok(path.clone());
        }
    }
    Ok(data_dir()?.join("desktop.json"))
}

/// Reads desktop.json, falling back to defaults when missing or invalid.
pub fn load() -> DesktopSettings {
    let Ok(path) = settings_path() else {
        return DesktopSettings::default();
    };
    let Ok(data) = fs::read(path) else {
        return DesktopSettings::default();
    };
    serde_json::from_slice(&data).unwrap_or_default()
}

/// Loads, changes and saves desktop.json under one lock, so writers keep each other's fields.
pub fn update(change: impl FnOnce(&mut DesktopSettings)) -> Result<(), String> {
    let _guard = WRITE_LOCK
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let mut settings = load();
    change(&mut settings);
    save(&settings)
}

/// Writes desktop.json atomically through a temp file and rename.
fn save(settings: &DesktopSettings) -> Result<(), String> {
    let path = settings_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("create data dir: {error}"))?;
    }
    let data =
        serde_json::to_vec_pretty(settings).map_err(|error| format!("encode settings: {error}"))?;
    let temp = path.with_extension("json.tmp");
    fs::write(&temp, data).map_err(|error| format!("write {}: {error}", temp.display()))?;
    fs::rename(&temp, &path).map_err(|error| format!("replace {}: {error}", path.display()))
}

/// Saves the current logical window bounds after a short debounce.
pub fn schedule_window_save(window: WebviewWindow<Wry>) {
    let generation = SAVE_GENERATION.fetch_add(1, Ordering::Relaxed) + 1;
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(500));
        if SAVE_GENERATION.load(Ordering::Relaxed) != generation {
            return;
        }
        save_window_bounds(&window);
    });
}

pub fn save_window_bounds(window: &WebviewWindow<Wry>) {
    let Ok(position) = window.outer_position() else {
        return;
    };
    let Ok(size) = window.inner_size() else {
        return;
    };
    let scale = window.scale_factor().unwrap_or(1.0);
    let bounds = WindowBounds {
        x: Some(position.x as f64 / scale),
        y: Some(position.y as f64 / scale),
        width: size.width as f64 / scale,
        height: size.height as f64 / scale,
    };
    if let Err(error) = update(|settings| settings.window = bounds) {
        eprintln!("[unplatform-ai] could not save window bounds: {error}");
    }
}

/// Creates the data and log folders the sidecar expects. Owner-only on unix.
pub fn ensure_dirs() -> Result<(), String> {
    let root = data_dir()?;
    let logs = logs_dir()?;
    fs::create_dir_all(&root).map_err(|error| format!("create data dir: {error}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::{DirBuilderExt, PermissionsExt};
        fs::set_permissions(&root, fs::Permissions::from_mode(0o700))
            .map_err(|error| format!("chmod data dir: {error}"))?;
        fs::DirBuilder::new()
            .recursive(true)
            .mode(0o700)
            .create(&logs)
            .map_err(|error| format!("create logs dir: {error}"))?;
    }
    #[cfg(not(unix))]
    fs::create_dir_all(&logs).map_err(|error| format!("create logs dir: {error}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{update, DesktopSettings, WindowBounds, TEST_SETTINGS_PATH};
    use std::{env, fs, path::PathBuf, thread};

    const WRITERS: usize = 50;

    /// Points desktop.json at a throwaway folder and returns the file path.
    fn use_temp_settings() -> PathBuf {
        let dir = env::temp_dir().join(format!("upai-settings-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create temp dir");
        let path = dir.join("desktop.json");
        let mut current = TEST_SETTINGS_PATH
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        *current = Some(path.clone());
        path
    }

    /// 50 threads write at once, then every field must still hold a written value.
    #[test]
    fn concurrent_updates_keep_every_field() {
        let path = use_temp_settings();
        let ports: Vec<u16> = (0..10).map(|index| 40000 + index as u16).collect();
        let sizes: Vec<f64> = (10..20).map(|index| index as f64).collect();
        let stamps: Vec<String> = (41..WRITERS)
            .map(|index| format!("check-{index}"))
            .collect();

        thread::scope(|scope| {
            for index in 0..WRITERS {
                let port = if index < 10 {
                    Some(40000 + index as u16)
                } else {
                    None
                };
                let size = if (10..20).contains(&index) {
                    Some(index as f64)
                } else {
                    None
                };
                let stamp = if index >= 41 {
                    Some(format!("check-{index}"))
                } else {
                    None
                };
                scope.spawn(move || {
                    let result = match (port, size, stamp) {
                        (Some(port), _, _) => update(|settings| settings.port = port),
                        (_, Some(size), _) => update(|settings| {
                            settings.window = WindowBounds {
                                x: Some(size),
                                y: Some(size),
                                width: size,
                                height: size,
                            };
                        }),
                        (_, _, Some(stamp)) => {
                            update(|settings| settings.last_update_check = Some(stamp))
                        }
                        _ if index < 30 => update(|settings| settings.close_hint_shown = true),
                        _ => update(|settings| {
                            settings.auto_check_updates = !settings.auto_check_updates;
                        }),
                    };
                    result.expect("update");
                });
            }
        });

        let data = fs::read(&path).expect("read settings");
        let settings: DesktopSettings = serde_json::from_slice(&data).expect("parse settings");

        assert!(ports.contains(&settings.port));
        assert!(sizes.contains(&settings.window.x.expect("window x")));
        assert!(sizes.contains(&settings.window.width));
        assert!(settings.close_hint_shown);
        assert!(!settings.auto_check_updates);
        assert!(stamps.contains(&settings.last_update_check.expect("last check")));

        let mut current = TEST_SETTINGS_PATH
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        *current = None;
        let _ = fs::remove_dir_all(path.parent().expect("settings dir"));
    }

    #[test]
    fn old_settings_get_update_defaults() {
        let settings: DesktopSettings = serde_json::from_str(
            r#"{"port":47821,"window":{"x":null,"y":null,"width":1440.0,"height":900.0},"close_hint_shown":true}"#,
        )
        .expect("old settings");

        assert!(settings.auto_check_updates);
        assert!(settings.last_update_check.is_none());
    }

    #[test]
    fn update_settings_round_trip() {
        let mut settings = DesktopSettings::default();
        settings.auto_check_updates = false;
        settings.last_update_check = Some("2026-10-25T10:00:00Z".to_string());

        let encoded = serde_json::to_string(&settings).expect("encode");
        let decoded: DesktopSettings = serde_json::from_str(&encoded).expect("decode");

        assert!(!decoded.auto_check_updates);
        assert_eq!(
            decoded.last_update_check.as_deref(),
            Some("2026-10-25T10:00:00Z")
        );
    }
}
