use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::PathBuf,
    sync::atomic::{AtomicU64, Ordering},
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct DesktopSettings {
    pub port: u16,
    pub window: WindowBounds,
    pub close_hint_shown: bool,
}

impl Default for DesktopSettings {
    fn default() -> Self {
        Self {
            port: DEFAULT_PORT,
            window: WindowBounds::default(),
            close_hint_shown: false,
        }
    }
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

/// Writes desktop.json atomically through a temp file and rename.
pub fn save(settings: &DesktopSettings) -> Result<(), String> {
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
    let mut settings = load();
    settings.window = WindowBounds {
        x: Some(position.x as f64 / scale),
        y: Some(position.y as f64 / scale),
        width: size.width as f64 / scale,
        height: size.height as f64 / scale,
    };
    if let Err(error) = save(&settings) {
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
