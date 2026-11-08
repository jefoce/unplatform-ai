use std::path::Path;

fn main() {
    embed_test_manifest();
    let attributes =
        tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&[
            "update_info",
            "update_check",
            "update_install",
            "update_set_auto",
            "update_open_release",
            "log_client_error",
        ]));
    tauri_build::try_build(attributes).expect("failed to run tauri-build");
}

/// Links the Common Controls v6 manifest into test executables on Windows.
fn embed_test_manifest() {
    let is_windows = std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows");
    if !is_windows {
        return;
    }

    let manifest = Path::new(env!("CARGO_MANIFEST_DIR")).join("windows-test.manifest");
    println!("cargo:rerun-if-changed={}", manifest.display());
    println!("cargo:rustc-link-arg-tests=/MANIFEST:EMBED");
    println!(
        "cargo:rustc-link-arg-tests=/MANIFESTINPUT:{}",
        manifest.display()
    );
}
