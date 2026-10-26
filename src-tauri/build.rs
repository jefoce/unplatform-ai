fn main() {
    let attributes =
        tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&[
            "update_info",
            "update_check",
            "update_install",
            "update_set_auto",
            "update_open_release",
        ]));
    tauri_build::try_build(attributes).expect("failed to run tauri-build");
}
