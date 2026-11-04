use std::io::{Read, Write};
use std::net::TcpListener;
use std::thread;

use serde_json::{json, Map, Value};
use tauri::test::{mock_builder, mock_context, noop_assets};
use tauri_plugin_updater::UpdaterExt;

/// Target keys the updater may look for, with and without a bundle suffix.
fn platform_keys() -> Vec<String> {
    let os = match std::env::consts::OS {
        "macos" => "darwin",
        other => other,
    };
    let base = format!("{os}-{}", std::env::consts::ARCH);

    ["", "-app", "-appimage", "-deb", "-nsis", "-rpm"]
        .iter()
        .map(|suffix| format!("{base}{suffix}"))
        .collect()
}

/// Serves one update manifest from a local port and returns its URL.
fn serve_manifest(version: &str) -> String {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind");
    let url = format!(
        "http://{}/latest.json",
        listener.local_addr().expect("addr")
    );
    let platforms: Map<String, Value> = platform_keys()
        .into_iter()
        .map(|key| {
            let entry = json!({ "url": "http://127.0.0.1:1/app.tar.gz", "signature": "" });

            (key, entry)
        })
        .collect();
    let body = json!({
        "version": version,
        "notes": "local test",
        "pub_date": "2026-11-03T00:00:00Z",
        "platforms": platforms,
    })
    .to_string();

    thread::spawn(move || {
        let (mut stream, _) = listener.accept().expect("accept");
        let mut request = [0_u8; 1024];
        let _ = stream.read(&mut request);
        let response = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        );
        stream.write_all(response.as_bytes()).expect("write");
    });

    url
}

#[test]
fn finds_local_update_without_installing() {
    let url = serve_manifest("0.1.1");
    let mut context = mock_context(noop_assets());
    context
        .config_mut()
        .plugins
        .0
        .insert("updater".to_string(), json!({ "pubkey": "" }));
    let app = mock_builder()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .build(context)
        .expect("build app");
    let endpoint = url.parse().expect("endpoint");
    let exe = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("target-test/UnplatformAI.app/Contents/MacOS/unplatform-ai");
    let updater = app
        .updater_builder()
        .executable_path(exe)
        .endpoints(vec![endpoint])
        .expect("endpoints")
        .build()
        .expect("updater");
    let update = tauri::async_runtime::block_on(updater.check())
        .expect("check")
        .expect("update found");

    assert_eq!(update.version, "0.1.1");
    assert_eq!(update.current_version, "0.1.0");
}
