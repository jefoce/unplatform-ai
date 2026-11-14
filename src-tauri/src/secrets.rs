use crate::server::State;
use serde::Deserialize;
use std::{
    collections::BTreeMap,
    sync::{atomic::Ordering, Mutex},
};
use tauri::{AppHandle, Manager, Wry};

pub(crate) const PREFIX: &str = "@@upai-secrets ";
const SERVICE: &str = "unplatform-ai";
/// The old single item that held every key as one JSON object.
const LEGACY_ACCOUNT: &str = "secrets";
const MAX_VALUE: usize = 2048;
const TOO_LONG: &str = "This value is too long. The limit is 2048 bytes.";
const ALLOWED: [&str; 7] = [
    "OPENROUTER_API_KEY",
    "OPENROUTER_MANAGEMENT_KEY",
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
    "CUSTOM_ENDPOINT_TOKENS",
];

/// Serializes read-modify-write cycles and the one-time migration.
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
            let value = request
                .value
                .as_deref()
                .ok_or_else(|| TOO_LONG.to_string())?;
            if !is_valid_value(value) {
                return Err(TOO_LONG.to_string());
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
    migrate()?;

    match request.op.as_str() {
        "getAll" => {
            let mut values = BTreeMap::new();
            let mut first_error: Option<KeyError> = None;
            let mut read_count = 0;
            for name in ALLOWED {
                match entry_for(name).and_then(|entry| read_entry(&entry)) {
                    Ok(Some(value)) => {
                        values.insert(name.to_string(), value);
                        read_count += 1;
                    }
                    Ok(None) => {
                        read_count += 1;
                    }
                    Err(error) => {
                        if first_error.is_none() {
                            first_error = Some(error);
                        }
                    }
                }
            }
            if read_count == 0 {
                return Err(
                    first_error.unwrap_or_else(|| KeyError::Failed("no secrets".to_string()))
                );
            }
            let json = serde_json::to_string(&values)
                .map_err(|error| KeyError::Failed(error.to_string()))?;
            Ok(Some(json))
        }
        "get" => read_entry(&entry_for(&request.name)?),
        "set" => {
            let value = request
                .value
                .as_deref()
                .ok_or_else(|| KeyError::Failed("missing value".to_string()))?;
            write_entry(&entry_for(&request.name)?, value)?;
            Ok(None)
        }
        "remove" => {
            let entry = entry_for(&request.name)?;
            match entry.delete_credential() {
                Ok(()) | Err(keyring::Error::NoEntry) => {}
                Err(error) => return Err(error.into()),
            }
            remove_from_legacy(&request.name)?;
            Ok(None)
        }
        _ => Err(KeyError::Failed("unknown op".to_string())),
    }
}

fn is_valid_value(value: &str) -> bool {
    !value.is_empty() && value.len() <= MAX_VALUE
}

fn entry_for(name: &str) -> Result<keyring::Entry, KeyError> {
    keyring::Entry::new(SERVICE, name).map_err(KeyError::from)
}

fn read_entry(entry: &keyring::Entry) -> Result<Option<String>, KeyError> {
    match entry.get_password() {
        Ok(value) if is_valid_value(&value) => Ok(Some(value)),
        Ok(_) => Ok(None),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(error.into()),
    }
}

fn write_entry(entry: &keyring::Entry, value: &str) -> Result<(), KeyError> {
    if !is_valid_value(value) {
        return Err(KeyError::Failed(TOO_LONG.to_string()));
    }
    entry.set_password(value).map_err(KeyError::from)
}

/// Parses the old JSON item and keeps only allowed names with valid values.
fn parse_object(raw: &str) -> BTreeMap<String, String> {
    let parsed: BTreeMap<String, String> = serde_json::from_str(raw).unwrap_or_default();
    parsed
        .into_iter()
        .filter(|(name, value)| ALLOWED.contains(&name.as_str()) && is_valid_value(value))
        .collect()
}

fn read_legacy() -> Result<Option<BTreeMap<String, String>>, KeyError> {
    let entry = keyring::Entry::new(SERVICE, LEGACY_ACCOUNT).map_err(KeyError::from)?;
    match entry.get_password() {
        Ok(raw) => Ok(Some(parse_object(&raw))),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(error.into()),
    }
}

/// Allowed names in order that exist in the legacy item and not as their own item.
fn migration_plan(
    current: &BTreeMap<String, String>,
    legacy: &BTreeMap<String, String>,
) -> Vec<(String, String)> {
    ALLOWED
        .iter()
        .filter_map(|name| {
            if current.contains_key(*name) {
                return None;
            }
            let value = legacy.get(*name)?;
            if !is_valid_value(value) {
                return None;
            }
            Some(((*name).to_string(), value.clone()))
        })
        .collect()
}

/// Writes every entry, never stops early, and reports whether all writes worked.
fn apply_plan(
    plan: &[(String, String)],
    mut write: impl FnMut(&str, &str) -> Result<(), KeyError>,
) -> bool {
    let mut is_ok = true;
    for (name, value) in plan {
        if write(name, value).is_err() {
            is_ok = false;
        }
    }
    is_ok
}

/// Copies the old JSON item into one item per name, then drops it when all writes worked.
fn migrate() -> Result<(), KeyError> {
    let Some(legacy) = read_legacy()? else {
        return Ok(());
    };
    let mut current = BTreeMap::new();
    for name in ALLOWED {
        if let Some(value) = read_entry(&entry_for(name)?)? {
            current.insert(name.to_string(), value);
        }
    }
    let plan = migration_plan(&current, &legacy);
    let wrote_all = apply_plan(&plan, |name, value| {
        let entry = entry_for(name)?;
        write_entry(&entry, value)
    });
    if wrote_all {
        let legacy_entry = keyring::Entry::new(SERVICE, LEGACY_ACCOUNT).map_err(KeyError::from)?;
        let _ = legacy_entry.delete_credential();
    }
    Ok(())
}

/// Drops one name from the old JSON item on remove, so a later migration cannot revive it.
fn remove_from_legacy(name: &str) -> Result<(), KeyError> {
    let Some(mut legacy) = read_legacy()? else {
        return Ok(());
    };
    legacy.remove(name);
    let entry = keyring::Entry::new(SERVICE, LEGACY_ACCOUNT).map_err(KeyError::from)?;
    if legacy.is_empty() {
        let _ = entry.delete_credential();
        return Ok(());
    }
    let json =
        serde_json::to_string(&legacy).map_err(|error| KeyError::Failed(error.to_string()))?;
    entry.set_password(&json).map_err(KeyError::from)
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
        assert_eq!(error, TOO_LONG);
    }

    #[test]
    fn accepts_a_value_at_the_limit() {
        let payload = format!(
            r#"{{"id":1,"op":"set","name":"R2_BUCKET","value":"{}"}}"#,
            "x".repeat(MAX_VALUE)
        );
        assert!(parse(&payload).is_ok());
    }

    #[test]
    fn rejects_a_value_one_byte_over_the_limit() {
        let payload = format!(
            r#"{{"id":1,"op":"set","name":"R2_BUCKET","value":"{}"}}"#,
            "x".repeat(MAX_VALUE + 1)
        );
        assert_eq!(parse(&payload).unwrap_err(), TOO_LONG);
    }

    #[test]
    fn migration_plan_fills_only_missing_valid_names() {
        let mut current = BTreeMap::new();
        current.insert("R2_BUCKET".to_string(), "current".to_string());
        let mut legacy = BTreeMap::new();
        legacy.insert("R2_BUCKET".to_string(), "old".to_string());
        legacy.insert("R2_ACCOUNT_ID".to_string(), "value".to_string());
        legacy.insert("R2_ACCESS_KEY_ID".to_string(), String::new());
        legacy.insert("UNKNOWN".to_string(), "value".to_string());

        let plan = migration_plan(&current, &legacy);

        assert_eq!(
            plan,
            vec![("R2_ACCOUNT_ID".to_string(), "value".to_string())]
        );
    }

    #[test]
    fn apply_plan_writes_every_entry_after_a_failure() {
        let plan = vec![
            ("A".to_string(), "1".to_string()),
            ("B".to_string(), "2".to_string()),
            ("C".to_string(), "3".to_string()),
        ];
        let mut written = Vec::new();
        let outcome = apply_plan(&plan, |name, value| {
            if name == "B" {
                return Err(KeyError::Failed("boom".to_string()));
            }
            written.push((name.to_string(), value.to_string()));
            Ok(())
        });

        assert!(!outcome);
        assert_eq!(
            written,
            vec![
                ("A".to_string(), "1".to_string()),
                ("C".to_string(), "3".to_string())
            ]
        );
    }

    #[test]
    fn parse_object_drops_unknown_empty_and_oversize_entries() {
        let raw = format!(
            r#"{{"R2_BUCKET":"ok","AWS_SECRET":"x","R2_ACCOUNT_ID":"","OPENROUTER_API_KEY":"{}"}}"#,
            "x".repeat(MAX_VALUE + 1)
        );
        let values = parse_object(&raw);

        assert_eq!(values.len(), 1);
        assert_eq!(values.get("R2_BUCKET").map(String::as_str), Some("ok"));
    }

    #[test]
    fn parse_object_is_empty_on_invalid_json() {
        assert!(parse_object("not json").is_empty());
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
