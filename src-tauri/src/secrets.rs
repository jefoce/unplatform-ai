use crate::server::State;
use serde::Deserialize;
use std::{
    collections::BTreeMap,
    sync::{atomic::Ordering, Mutex},
};
use tauri::{AppHandle, Manager, Wry};

pub(crate) const PREFIX: &str = "@@upai-secrets ";
const SERVICE: &str = "unplatform-ai";
/// One keychain item holds every key as a JSON object.
const ACCOUNT: &str = "secrets";
const MAX_VALUE: usize = 4096;
const ALLOWED: [&str; 7] = [
    "OPENROUTER_API_KEY",
    "OPENROUTER_MANAGEMENT_KEY",
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
    "CUSTOM_ENDPOINT_TOKENS",
];

/// Serializes read-modify-write cycles on the single item.
static LOCK: Mutex<()> = Mutex::new(());

#[derive(Debug)]
pub(crate) enum KeyError {
    Unavailable(String),
    Failed(String),
}

impl From<keyring::Error> for KeyError {
    fn from(error: keyring::Error) -> Self {
        match &error {
            // Only a missing keyring service on Linux may fall back to the file backend.
            // A denied prompt on macOS or Windows must surface as a failure, never a file.
            keyring::Error::NoStorageAccess(_) | keyring::Error::PlatformFailure(_)
                if cfg!(target_os = "linux") =>
            {
                KeyError::Unavailable(error.to_string())
            }
            _ => KeyError::Failed(error.to_string()),
        }
    }
}

#[derive(Debug, Deserialize)]
pub(crate) struct Request {
    pub id: u64,
    pub op: String,
    pub name: String,
    #[serde(default)]
    pub value: Option<String>,
}

/// Parses and validates one `@@upai-secrets` payload. Never logs values.
pub(crate) fn parse(payload: &str) -> Result<Request, String> {
    let request: Request = serde_json::from_str(payload).map_err(|_| "invalid JSON".to_string())?;
    match request.op.as_str() {
        "getAll" => return Ok(request),
        "get" | "remove" => {}
        "set" => {
            let value = request.value.as_deref().ok_or("missing value")?;
            if value.is_empty() || value.len() > MAX_VALUE {
                return Err("value must be 1 to 4096 bytes".to_string());
            }
        }
        _ => return Err("unknown op".to_string()),
    }
    if !ALLOWED.contains(&request.name.as_str()) {
        return Err("unknown name".to_string());
    }
    Ok(request)
}

/// Runs one keychain operation on the calling blocking thread.
pub(crate) fn execute(request: &Request) -> Result<Option<String>, KeyError> {
    let _guard = LOCK
        .lock()
        .map_err(|_| KeyError::Failed("keychain lock poisoned".to_string()))?;
    let entry = keyring::Entry::new(SERVICE, ACCOUNT).map_err(KeyError::from)?;

    match request.op.as_str() {
        "getAll" => {
            let values = read_object(&entry)?;
            let json = serde_json::to_string(&values)
                .map_err(|error| KeyError::Failed(error.to_string()))?;
            Ok(Some(json))
        }
        "get" => Ok(read_object(&entry)?.get(&request.name).cloned()),
        "set" => {
            let value = request
                .value
                .as_deref()
                .ok_or_else(|| KeyError::Failed("missing value".to_string()))?;
            let mut values = read_object(&entry)?;
            values.insert(request.name.clone(), value.to_string());
            write_object(&entry, &values)?;
            Ok(None)
        }
        "remove" => {
            let mut values = read_object(&entry)?;
            values.remove(&request.name);
            write_object(&entry, &values)?;
            Ok(None)
        }
        _ => Err(KeyError::Failed("unknown op".to_string())),
    }
}

/// Reads the shared item, migrating the old per-key items once when missing.
fn read_object(entry: &keyring::Entry) -> Result<BTreeMap<String, String>, KeyError> {
    match entry.get_password() {
        Ok(raw) => parse_object(&raw),
        Err(keyring::Error::NoEntry) => migrate(entry),
        Err(error) => Err(error.into()),
    }
}

fn parse_object(raw: &str) -> Result<BTreeMap<String, String>, KeyError> {
    let mut values: BTreeMap<String, String> = serde_json::from_str(raw)
        .map_err(|_| KeyError::Failed("invalid secrets item".to_string()))?;
    values.retain(|name, value| {
        ALLOWED.contains(&name.as_str()) && !value.is_empty() && value.len() <= MAX_VALUE
    });
    Ok(values)
}

fn write_object(entry: &keyring::Entry, values: &BTreeMap<String, String>) -> Result<(), KeyError> {
    let json =
        serde_json::to_string(values).map_err(|error| KeyError::Failed(error.to_string()))?;
    entry.set_password(&json).map_err(KeyError::from)
}

/// Folds old per-key items into the shared item, then deletes them.
fn migrate(entry: &keyring::Entry) -> Result<BTreeMap<String, String>, KeyError> {
    let mut values = BTreeMap::new();
    let mut old = Vec::new();
    for name in ALLOWED {
        let previous = keyring::Entry::new(SERVICE, name).map_err(KeyError::from)?;
        match previous.get_password() {
            Ok(value) if !value.is_empty() && value.len() <= MAX_VALUE => {
                values.insert(name.to_string(), value);
                old.push(previous);
            }
            Ok(_) => {}
            Err(keyring::Error::NoEntry) => {}
            Err(error) => return Err(error.into()),
        }
    }
    if values.is_empty() {
        return Ok(values);
    }

    write_object(entry, &values)?;
    for previous in old {
        let _ = previous.delete_credential();
    }
    Ok(values)
}

/// Numeric id from a payload that failed validation, when one is present.
pub(crate) fn request_id(payload: &str) -> Option<u64> {
    serde_json::from_str::<serde_json::Value>(payload)
        .ok()?
        .get("id")?
        .as_u64()
}

/// True when the sidecar that asked is no longer the running one.
pub(crate) fn is_stale(spawn: u64, current: u64) -> bool {
    spawn != current
}

pub(crate) fn reply_line(id: u64, result: Result<Option<String>, KeyError>) -> String {
    match result {
        Ok(value) => serde_json::json!({ "id": id, "ok": true, "value": value }).to_string(),
        Err(KeyError::Unavailable(error)) => serde_json::json!({
            "id": id,
            "ok": false,
            "code": "unavailable",
            "error": error
        })
        .to_string(),
        Err(KeyError::Failed(error)) => {
            serde_json::json!({ "id": id, "ok": false, "error": error }).to_string()
        }
    }
}

pub(crate) fn bad_request_line(id: u64) -> String {
    serde_json::json!({ "id": id, "ok": false, "error": "bad request" }).to_string()
}

/// Writes one reply line to the child's stdin, unless it belongs to an old spawn.
pub(crate) fn send(app: &AppHandle<Wry>, line: &str, spawn: u64) {
    let state = app.state::<State>();
    let mut child = state.child.lock().unwrap();
    if is_stale(spawn, state.spawn_count.load(Ordering::SeqCst)) {
        return;
    }
    let Some(child) = child.as_mut() else {
        return;
    };
    let mut payload = line.to_string();
    payload.push('\n');
    let _ = child.write(payload.as_bytes());
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_valid_request() {
        let request = parse(r#"{"id":7,"op":"get","name":"OPENROUTER_API_KEY"}"#).unwrap();
        assert_eq!(request.id, 7);
        assert_eq!(request.name, "OPENROUTER_API_KEY");
    }

    #[test]
    fn accepts_get_all_without_a_key_name() {
        let request = parse(r#"{"id":2,"op":"getAll","name":""}"#).unwrap();
        assert_eq!(request.op, "getAll");
    }

    #[test]
    fn rejects_unknown_op() {
        let error = parse(r#"{"id":1,"op":"reset","name":"R2_BUCKET"}"#).unwrap_err();
        assert_eq!(error, "unknown op");
    }

    #[test]
    fn allows_custom_endpoint_tokens() {
        assert!(ALLOWED.contains(&"CUSTOM_ENDPOINT_TOKENS"));
    }

    #[test]
    fn rejects_unknown_name() {
        let error = parse(r#"{"id":1,"op":"get","name":"AWS_SECRET"}"#).unwrap_err();
        assert_eq!(error, "unknown name");
    }

    #[test]
    fn rejects_oversize_value() {
        let payload = format!(
            r#"{{"id":1,"op":"set","name":"R2_BUCKET","value":"{}"}}"#,
            "x".repeat(MAX_VALUE + 1)
        );
        let error = parse(&payload).unwrap_err();
        assert_eq!(error, "value must be 1 to 4096 bytes");
    }

    #[test]
    fn replies_to_bad_requests_with_a_numeric_id() {
        let payload = r#"{"id":9,"op":"reset","name":"R2_BUCKET"}"#;
        assert_eq!(request_id(payload), Some(9));
        let reply: serde_json::Value =
            serde_json::from_str(&bad_request_line(9)).expect("reply json");
        assert_eq!(reply["id"], 9);
        assert_eq!(reply["ok"], false);
        assert_eq!(reply["error"], "bad request");
    }

    #[test]
    fn denied_keychain_access_is_fatal_outside_linux() {
        let error = keyring::Error::NoStorageAccess(Box::new(std::io::Error::other("denied")));
        let mapped = KeyError::from(error);
        #[cfg(target_os = "linux")]
        assert!(matches!(mapped, KeyError::Unavailable(_)));
        #[cfg(not(target_os = "linux"))]
        assert!(matches!(mapped, KeyError::Failed(_)));
    }

    #[test]
    fn marks_an_unavailable_keychain() {
        let reply: serde_json::Value = serde_json::from_str(&reply_line(
            4,
            Err(KeyError::Unavailable("no secret service".to_string())),
        ))
        .expect("reply json");
        assert_eq!(reply["ok"], false);
        assert_eq!(reply["code"], "unavailable");
    }

    #[test]
    fn ignores_bad_requests_without_a_numeric_id() {
        assert_eq!(request_id("not json"), None);
        assert_eq!(request_id(r#"{"id":"9"}"#), None);
    }

    #[test]
    fn drops_replies_from_an_old_spawn() {
        assert!(is_stale(1, 2));
        assert!(!is_stale(2, 2));
    }
}
