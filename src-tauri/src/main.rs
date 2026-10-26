#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(target_os = "macos")]
mod fps;
mod secrets;
mod server;
mod settings;
mod updater;

fn main() {
    install_panic_hook();
    let builder = tauri::Builder::default();
    // LSUIElement apps can start inactive, so pull the window to the front at launch.
    #[cfg(target_os = "macos")]
    let builder = builder.activate_ignoring_other_apps(true);
    builder
        // Must be registered first so a second launch focuses the existing window.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            server::show_main(app)
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(server::State::default())
        .manage(updater::UpdateState::default())
        .invoke_handler(tauri::generate_handler![
            updater::update_info,
            updater::update_check,
            updater::update_install,
            updater::update_set_auto,
            updater::update_open_release,
        ])
        .setup(|app| {
            // Bundle is LSUIElement so the sidecar stays out of the Dock.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Regular);
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(error) = server::boot(&handle).await {
                    server::fatal(&handle, &error);
                }
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Unplatform AI")
        .run(|app, event| match event {
            tauri::RunEvent::ExitRequested { api, .. } => server::shutdown_then_exit(app, api),
            tauri::RunEvent::Exit => server::emergency_cleanup(app),
            #[cfg(target_os = "macos")]
            tauri::RunEvent::Reopen { .. } => server::show_main(app),
            _ => {}
        });
}

/// Logs every panic to desktop.log, then keeps the default stderr output.
fn install_panic_hook() {
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        server::record_panic(info);
        default_hook(info);
    }));
}
