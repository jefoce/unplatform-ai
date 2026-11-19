use flate2::read::GzDecoder;
use std::io::Read;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager, Wry};

const ARCHIVE: &str = "THIRD_PARTY_LICENSES.txt.gz";
const TEXT_FILE: &str = "THIRD_PARTY_LICENSES.txt";

/// Gunzips the bundled archive and decodes it as UTF-8.
fn decode_licenses(archive: &[u8]) -> Result<String, String> {
    let mut text = String::new();
    GzDecoder::new(archive)
        .read_to_string(&mut text)
        .map_err(|error| format!("Decode bundled licenses: {error}"))?;

    Ok(text)
}

/// Writes the licenses into the app cache and opens them in the default text app.
#[tauri::command]
pub fn open_third_party_licenses(app: AppHandle<Wry>) -> Result<(), String> {
    let archive = app
        .path()
        .resolve(ARCHIVE, BaseDirectory::Resource)
        .map_err(|error| format!("Locate bundled licenses: {error}"))?;
    let bytes =
        std::fs::read(&archive).map_err(|error| format!("Read bundled licenses: {error}"))?;
    let text = decode_licenses(&bytes)?;

    let dir = app
        .path()
        .app_cache_dir()
        .map_err(|error| format!("Locate cache directory: {error}"))?;
    std::fs::create_dir_all(&dir).map_err(|error| format!("Create cache directory: {error}"))?;

    let path = dir.join(TEXT_FILE);
    std::fs::write(&path, text).map_err(|error| format!("Write licenses file: {error}"))?;

    tauri_plugin_opener::open_path(path, None::<&str>)
        .map_err(|error| format!("Open licenses file: {error}"))
}

#[cfg(test)]
mod tests {
    use super::decode_licenses;
    use flate2::write::GzEncoder;
    use flate2::Compression;
    use std::io::Write;

    const TEXT: &str = "Package | Version\nleft-pad | 1.3.0\n";

    fn gzip(input: &str) -> Vec<u8> {
        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(input.as_bytes()).unwrap();

        encoder.finish().unwrap()
    }

    #[test]
    fn gzip_archive_decodes_to_the_same_text() {
        assert_eq!(decode_licenses(&gzip(TEXT)), Ok(TEXT.to_string()));
    }

    #[test]
    fn invalid_gzip_data_is_an_error() {
        assert!(decode_licenses(b"not gzip").is_err());
    }
}
