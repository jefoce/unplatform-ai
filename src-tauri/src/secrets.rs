use crate::server::State;
use serde::Deserialize;
use std::{
    collections::BTreeMap,
    sync::{atomic::Ordering, Mutex},
};
use tauri::{AppHandle, Manager, Wry};

pub(crate) const PREFIX: &str = "@@upai-secrets ";
const SERVICE: &str = "unplatform-ai";
/// The single JSON item. Current on macOS and Linux, legacy on Windows.
const SINGLE_ACCOUNT: &str = "secrets";
/// Per-name cap.
/// The single JSON item that holds every value is never capped.
const MAX_VALUE: usize = 2048;
const TOO_LONG: &str = "This value is too long. The limit is 2048 bytes.";
const INVALID_ITEM: &str = "invalid secrets item";
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

/// One keychain account: get, set and delete.
/// Raw, no app cap on the value.
trait Keychain {
    fn get(&self, account: &str) -> Result<Option<String>, KeyError>;
    fn set(&self, account: &str, value: &str) -> Result<(), KeyError>;
    fn delete(&self, account: &str) -> Result<(), KeyError>;
}

/// Reads one per-name item, where the app cap applies. An oversize item is an
/// error, never a missing value that a later write could overwrite.
fn read_name<K: Keychain>(keychain: &K, name: &str) -> Result<Option<String>, KeyError> {
    let Some(value) = keychain.get(name)? else {
        return Ok(None);
    };
    if value.is_empty() {
        return Ok(None);
    }
    if value.len() > MAX_VALUE {
        return Err(KeyError::Failed(TOO_LONG.to_string()));
    }
    Ok(Some(value))
}

/// Values for every allowed secret name.
trait SecretStore {
    fn read_all(&self) -> Result<BTreeMap<String, String>, KeyError>;
    fn write(&self, name: &str, value: &str) -> Result<(), KeyError>;
    fn remove(&self, name: &str) -> Result<(), KeyError>;
}

struct OsKeychain;

impl Keychain for OsKeychain {
    fn get(&self, account: &str) -> Result<Option<String>, KeyError> {
        let entry = keyring::Entry::new(SERVICE, account).map_err(KeyError::from)?;
        match entry.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => Err(error.into()),
        }
    }

    fn set(&self, account: &str, value: &str) -> Result<(), KeyError> {
        let entry = keyring::Entry::new(SERVICE, account).map_err(KeyError::from)?;
        entry.set_password(value).map_err(KeyError::from)
    }

    fn delete(&self, account: &str) -> Result<(), KeyError> {
        let entry = keyring::Entry::new(SERVICE, account).map_err(KeyError::from)?;
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(error.into()),
        }
    }
}

/// Every secret in one JSON item. Used on macOS and Linux, where an item is not size capped.
#[cfg_attr(target_os = "windows", allow(dead_code))]
struct SingleItemStore<K: Keychain> {
    keychain: K,
}

#[cfg_attr(target_os = "windows", allow(dead_code))]
impl<K: Keychain> SingleItemStore<K> {
    fn new(keychain: K) -> Self {
        Self { keychain }
    }

    fn write_item(&self, values: &BTreeMap<String, String>) -> Result<(), KeyError> {
        let json =
            serde_json::to_string(values).map_err(|error| KeyError::Failed(error.to_string()))?;
        self.keychain.set(SINGLE_ACCOUNT, &json)
    }

    /// Merges per-name items into the single item, then drops them only after a verified read-back.
    fn migrate_per_name(&self) -> Result<BTreeMap<String, String>, KeyError> {
        let mut values = BTreeMap::new();
        for name in ALLOWED {
            if let Some(value) = read_name(&self.keychain, name)? {
                values.insert(name.to_string(), value);
            }
        }
        if values.is_empty() {
            return Ok(values);
        }
        self.write_item(&values)?;
        let raw = self
            .keychain
            .get(SINGLE_ACCOUNT)?
            .ok_or_else(|| KeyError::Failed("merged secrets item is missing".to_string()))?;
        let written = parse_object(&raw)?;
        let is_complete = values
            .iter()
            .all(|(name, value)| written.get(name) == Some(value));
        if !is_complete {
            return Err(KeyError::Failed(
                "merged secrets item does not match".to_string(),
            ));
        }
        for name in ALLOWED {
            self.keychain.delete(name)?;
        }
        Ok(values)
    }
}

impl<K: Keychain> SecretStore for SingleItemStore<K> {
    fn read_all(&self) -> Result<BTreeMap<String, String>, KeyError> {
        match self.keychain.get(SINGLE_ACCOUNT)? {
            Some(raw) => parse_object(&raw),
            None => self.migrate_per_name(),
        }
    }

    fn write(&self, name: &str, value: &str) -> Result<(), KeyError> {
        if !is_valid_value(value) {
            return Err(KeyError::Failed(TOO_LONG.to_string()));
        }
        let mut values = self.read_all()?;
        values.insert(name.to_string(), value.to_string());
        self.write_item(&values)
    }

    fn remove(&self, name: &str) -> Result<(), KeyError> {
        let mut values = self.read_all()?;
        values.remove(name);
        self.write_item(&values)
    }
}

/// One item per name. Used on Windows, whose Credential Manager caps an item near 2560 bytes.
#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
struct PerNameStore<K: Keychain> {
    keychain: K,
}

#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
impl<K: Keychain> PerNameStore<K> {
    fn new(keychain: K) -> Self {
        Self { keychain }
    }

    fn read_legacy(&self) -> Result<Option<BTreeMap<String, String>>, KeyError> {
        match self.keychain.get(SINGLE_ACCOUNT)? {
            Some(raw) => parse_object(&raw).map(Some),
            None => Ok(None),
        }
    }

    /// Copies the old JSON item into one item per name, then drops it when all writes worked.
    fn migrate(&self) -> Result<(), KeyError> {
        let Some(legacy) = self.read_legacy()? else {
            return Ok(());
        };
        let mut current = BTreeMap::new();
        for name in ALLOWED {
            if let Some(value) = read_name(&self.keychain, name)? {
                current.insert(name.to_string(), value);
            }
        }
        let plan = migration_plan(&current, &legacy);
        let wrote_all = apply_plan(&plan, |name, value| self.keychain.set(name, value));
        if wrote_all {
            let _ = self.keychain.delete(SINGLE_ACCOUNT);
        }
        Ok(())
    }

    /// Drops one name from the old JSON item on remove, so a later migration cannot revive it.
    fn remove_from_legacy(&self, name: &str) -> Result<(), KeyError> {
        let Some(mut legacy) = self.read_legacy()? else {
            return Ok(());
        };
        legacy.remove(name);
        if legacy.is_empty() {
            let _ = self.keychain.delete(SINGLE_ACCOUNT);
            return Ok(());
        }
        let json =
            serde_json::to_string(&legacy).map_err(|error| KeyError::Failed(error.to_string()))?;
        self.keychain.set(SINGLE_ACCOUNT, &json)
    }
}

impl<K: Keychain> SecretStore for PerNameStore<K> {
    fn read_all(&self) -> Result<BTreeMap<String, String>, KeyError> {
        self.migrate()?;
        let mut values = BTreeMap::new();
        let mut first_error: Option<KeyError> = None;
        for name in ALLOWED {
            match read_name(&self.keychain, name) {
                Ok(Some(value)) => {
                    values.insert(name.to_string(), value);
                }
                Ok(None) => {}
                Err(error) => {
                    if first_error.is_none() {
                        first_error = Some(error);
                    }
                }
            }
        }
        match first_error {
            Some(error) => Err(error),
            None => Ok(values),
        }
    }

    fn write(&self, name: &str, value: &str) -> Result<(), KeyError> {
        if !is_valid_value(value) {
            return Err(KeyError::Failed(TOO_LONG.to_string()));
        }
        self.keychain.set(name, value)
    }

    fn remove(&self, name: &str) -> Result<(), KeyError> {
        self.keychain.delete(name)?;
        self.remove_from_legacy(name)
    }
}

/// The one place that picks the backend for the running OS.
fn store() -> Result<Box<dyn SecretStore>, KeyError> {
    let keychain = OsKeychain;

    #[cfg(target_os = "windows")]
    {
        return Ok(Box::new(PerNameStore::new(keychain)));
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(Box::new(SingleItemStore::new(keychain)))
    }
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
    let store = store()?;

    match request.op.as_str() {
        "getAll" => {
            let values = store.read_all()?;
            let json = serde_json::to_string(&values)
                .map_err(|error| KeyError::Failed(error.to_string()))?;
            Ok(Some(json))
        }
        "get" => Ok(store.read_all()?.remove(&request.name)),
        "set" => {
            let value = request
                .value
                .as_deref()
                .ok_or_else(|| KeyError::Failed("missing value".to_string()))?;
            store.write(&request.name, value)?;
            Ok(None)
        }
        "remove" => {
            store.remove(&request.name)?;
            Ok(None)
        }
        _ => Err(KeyError::Failed("unknown op".to_string())),
    }
}

fn is_valid_value(value: &str) -> bool {
    !value.is_empty() && value.len() <= MAX_VALUE
}

/// Parses the old JSON item and keeps only allowed names with valid values.
/// A corrupt item is an error, never an empty map a later write would replace.
fn parse_object(raw: &str) -> Result<BTreeMap<String, String>, KeyError> {
    let parsed: BTreeMap<String, String> =
        serde_json::from_str(raw).map_err(|_| KeyError::Failed(INVALID_ITEM.to_string()))?;
    Ok(parsed
        .into_iter()
        .filter(|(name, value)| ALLOWED.contains(&name.as_str()) && is_valid_value(value))
        .collect())
}

/// Allowed names in order that exist in the legacy item and not as their own item.
#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
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
#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
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
    use std::{cell::RefCell, collections::BTreeSet, rc::Rc};

    #[derive(Clone, Default)]
    struct FakeKeychain {
        inner: Rc<FakeKeychainInner>,
    }

    #[derive(Default)]
    struct FakeKeychainInner {
        values: RefCell<BTreeMap<String, String>>,
        failing: RefCell<BTreeSet<String>>,
        failing_get: RefCell<BTreeSet<String>>,
    }

    impl FakeKeychain {
        fn with(entries: &[(&str, &str)]) -> Self {
            let keychain = Self::default();
            for (account, value) in entries {
                keychain
                    .inner
                    .values
                    .borrow_mut()
                    .insert((*account).to_string(), (*value).to_string());
            }
            keychain
        }

        fn fail_set(&self, account: &str) {
            self.inner.failing.borrow_mut().insert(account.to_string());
        }

        fn fail_get(&self, account: &str) {
            self.inner
                .failing_get
                .borrow_mut()
                .insert(account.to_string());
        }

        fn has(&self, account: &str) -> bool {
            self.inner.values.borrow().contains_key(account)
        }
    }

    impl Keychain for FakeKeychain {
        fn get(&self, account: &str) -> Result<Option<String>, KeyError> {
            if self.inner.failing_get.borrow().contains(account) {
                return Err(KeyError::Failed("read failed".to_string()));
            }
            Ok(self.inner.values.borrow().get(account).cloned())
        }

        fn set(&self, account: &str, value: &str) -> Result<(), KeyError> {
            if self.inner.failing.borrow().contains(account) {
                return Err(KeyError::Failed("write failed".to_string()));
            }
            if value.len() > ITEM_LIMIT {
                return Err(KeyError::Failed("keychain item too large".to_string()));
            }
            self.inner
                .values
                .borrow_mut()
                .insert(account.to_string(), value.to_string());
            Ok(())
        }

        fn delete(&self, account: &str) -> Result<(), KeyError> {
            self.inner.values.borrow_mut().remove(account);
            Ok(())
        }
    }

    /// Largest item the fake keychain accepts, in bytes of the stored value.
    ///
    /// Windows Credential Manager rejects a credential blob above
    /// CRED_MAX_CREDENTIAL_BLOB_SIZE = 2560 bytes (wincred.h, Microsoft Learn).
    /// macOS Keychain Services publishes no per-item byte limit and the keyring
    /// apple-native backend forwards to SecItemAdd, so the fake keeps headroom
    /// above the 2048 app cap and the 3000-byte legacy case in the tests.
    /// Linux Secret Service stores the secret as an arbitrary byte array whose
    /// size limit belongs to the running server, so the fake uses the same one.
    #[cfg(target_os = "windows")]
    const ITEM_LIMIT: usize = 2560;
    #[cfg(not(target_os = "windows"))]
    const ITEM_LIMIT: usize = 8192;

    const SHORT_KEYS: [(&str, &str); 6] = [
        (
            "OPENROUTER_API_KEY",
            "sk-or-v*-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        ),
        (
            "OPENROUTER_MANAGEMENT_KEY",
            "sk-or-v*-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        ),
        ("R2_ACCOUNT_ID", "0123456789abcdef0123456789abcdef"),
        ("R2_ACCESS_KEY_ID", "fedcba9876543210fedcba9876543210"),
        (
            "R2_SECRET_ACCESS_KEY",
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        ),
        ("R2_BUCKET", "upai-media-prod"),
    ];

    #[cfg(not(target_os = "windows"))]
    const LEGACY_VALUE_BYTES: usize = 1000;
    #[cfg(target_os = "windows")]
    const LEGACY_VALUE_BYTES: usize = 800;

    /// Five endpoint tokens, about 2000 bytes, plus six short keys.
    fn full_secret_set() -> BTreeMap<String, String> {
        let mut tokens = serde_json::Map::new();
        for index in 1..=5 {
            let value = "t".repeat(386);
            tokens.insert(format!("custom-{index}"), serde_json::Value::String(value));
        }
        let mut values = BTreeMap::from([(
            "CUSTOM_ENDPOINT_TOKENS".to_string(),
            serde_json::Value::Object(tokens).to_string(),
        )]);
        for (name, value) in SHORT_KEYS {
            values.insert(name.to_string(), value.to_string());
        }
        values
    }

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
    fn single_item_store_merges_per_name_entries() {
        let keychain = FakeKeychain::with(&[
            ("OPENROUTER_API_KEY", "sk-or-v1-key"),
            ("R2_BUCKET", "media"),
        ]);
        let store = SingleItemStore::new(keychain.clone());

        let values = store.read_all().expect("read all");

        assert_eq!(
            values.get("OPENROUTER_API_KEY").map(String::as_str),
            Some("sk-or-v1-key")
        );
        assert_eq!(values.get("R2_BUCKET").map(String::as_str), Some("media"));
        assert!(keychain.has(SINGLE_ACCOUNT));
        assert!(!keychain.has("OPENROUTER_API_KEY"));
        assert!(!keychain.has("R2_BUCKET"));
    }

    #[test]
    fn single_item_store_keeps_per_name_entries_when_write_fails() {
        let keychain = FakeKeychain::with(&[
            ("OPENROUTER_API_KEY", "sk-or-v1-key"),
            ("R2_BUCKET", "media"),
        ]);
        keychain.fail_set(SINGLE_ACCOUNT);
        let store = SingleItemStore::new(keychain.clone());

        assert!(store.read_all().is_err());

        assert!(keychain.has("OPENROUTER_API_KEY"));
        assert!(keychain.has("R2_BUCKET"));
        assert!(!keychain.has(SINGLE_ACCOUNT));
    }

    #[test]
    fn single_item_store_round_trips_custom_endpoint_tokens() {
        let keychain = FakeKeychain::default();
        let store = SingleItemStore::new(keychain.clone());
        let tokens = serde_json::json!({
            "custom-1": "a".repeat(40),
            "custom-2": "b".repeat(40),
            "custom-3": "c".repeat(40),
            "custom-4": "d".repeat(40),
            "custom-5": "e".repeat(40),
        })
        .to_string();

        store
            .write("CUSTOM_ENDPOINT_TOKENS", &tokens)
            .expect("write");
        let values = store.read_all().expect("read all");

        assert_eq!(values.get("CUSTOM_ENDPOINT_TOKENS"), Some(&tokens));
        let raw = keychain.get(SINGLE_ACCOUNT).expect("get").expect("item");
        let parsed: BTreeMap<String, String> = serde_json::from_str(&raw).expect("valid json");
        assert_eq!(parsed.get("CUSTOM_ENDPOINT_TOKENS"), Some(&tokens));
    }

    #[test]
    fn single_item_store_round_trips_all_names_past_the_item_cap() {
        let keychain = FakeKeychain::default();
        let store = SingleItemStore::new(keychain.clone());
        let expected = full_secret_set();

        for (name, value) in &expected {
            store.write(name, value).expect("write");
        }

        let raw = keychain.get(SINGLE_ACCOUNT).expect("get").expect("item");
        assert!(raw.len() > MAX_VALUE, "item is {} bytes", raw.len());

        let values = store.read_all().expect("read all");
        assert_eq!(values, expected);
    }

    #[test]
    fn single_item_store_reads_an_oversized_legacy_item() {
        let mut legacy = BTreeMap::new();
        for (name, filler) in [
            ("OPENROUTER_API_KEY", "a"),
            ("OPENROUTER_MANAGEMENT_KEY", "b"),
            ("R2_ACCOUNT_ID", "c"),
        ] {
            legacy.insert(name.to_string(), filler.repeat(LEGACY_VALUE_BYTES));
        }
        legacy.insert("R2_BUCKET".to_string(), "media".to_string());
        let raw = serde_json::to_string(&legacy).expect("json");
        assert!(raw.len() > MAX_VALUE, "item is {} bytes", raw.len());
        assert!(raw.len() <= ITEM_LIMIT, "item is {} bytes", raw.len());

        let keychain = FakeKeychain::with(&[(SINGLE_ACCOUNT, raw.as_str())]);
        let store = SingleItemStore::new(keychain);

        let values = store.read_all().expect("read all");

        assert_eq!(values, legacy);
    }

    #[test]
    fn single_item_store_rejects_an_oversize_per_name_item() {
        let oversize = "x".repeat(MAX_VALUE + 1);
        let keychain = FakeKeychain::with(&[("R2_BUCKET", oversize.as_str())]);
        let store = SingleItemStore::new(keychain.clone());

        let error = store
            .read_all()
            .expect_err("an oversize per-name item is not unset");

        assert!(matches!(error, KeyError::Failed(ref message) if message == TOO_LONG));
        assert!(!keychain.has(SINGLE_ACCOUNT));
    }

    #[test]
    fn single_item_store_reports_a_corrupt_item() {
        let keychain = FakeKeychain::with(&[(SINGLE_ACCOUNT, "{bad")]);
        let store = SingleItemStore::new(keychain);

        let error = store.read_all().expect_err("a corrupt item is not empty");

        assert!(matches!(error, KeyError::Failed(ref message) if message == INVALID_ITEM));
    }

    #[test]
    fn single_item_store_keeps_a_corrupt_item_after_a_write() {
        let keychain = FakeKeychain::with(&[(SINGLE_ACCOUNT, "{bad")]);
        let store = SingleItemStore::new(keychain.clone());

        let error = store
            .write("R2_BUCKET", "media")
            .expect_err("a write after a failed read is rejected");

        assert!(matches!(error, KeyError::Failed(ref message) if message == INVALID_ITEM));
        assert_eq!(
            keychain.get(SINGLE_ACCOUNT).expect("get").as_deref(),
            Some("{bad")
        );
    }

    #[test]
    fn single_item_store_caps_each_value_but_not_the_item() {
        let keychain = FakeKeychain::default();
        let store = SingleItemStore::new(keychain.clone());
        let oversize = "x".repeat(MAX_VALUE + 1);

        let error = store
            .write("R2_BUCKET", &oversize)
            .expect_err("a value over the cap is rejected");

        assert!(matches!(error, KeyError::Failed(ref message) if message == TOO_LONG));
        assert!(!keychain.has(SINGLE_ACCOUNT));

        let at_cap = "x".repeat(MAX_VALUE);
        store.write("R2_BUCKET", &at_cap).expect("write at the cap");
        let raw = keychain.get(SINGLE_ACCOUNT).expect("get").expect("item");
        assert!(raw.len() > MAX_VALUE, "item is {} bytes", raw.len());
        assert_eq!(
            store.read_all().expect("read all").get("R2_BUCKET"),
            Some(&at_cap)
        );
    }

    #[test]
    fn per_name_store_caps_one_value() {
        let keychain = FakeKeychain::default();
        let store = PerNameStore::new(keychain.clone());
        let oversize = "x".repeat(MAX_VALUE + 1);

        let error = store
            .write("R2_BUCKET", &oversize)
            .expect_err("a value over the cap is rejected");

        assert!(matches!(error, KeyError::Failed(ref message) if message == TOO_LONG));
        assert!(!keychain.has("R2_BUCKET"));
    }

    #[test]
    fn per_name_store_reports_a_failed_name_read() {
        let keychain = FakeKeychain::with(&[("R2_BUCKET", "media")]);
        keychain.fail_get("R2_BUCKET");
        let store = PerNameStore::new(keychain);

        let error = store.read_all().expect_err("a failed read is not unset");

        assert!(matches!(error, KeyError::Failed(ref message) if message == "read failed"));
    }

    #[test]
    fn per_name_store_migrates_the_single_item() {
        let raw = serde_json::json!({
            "OPENROUTER_API_KEY": "sk-or-v1-key",
            "R2_BUCKET": "media",
        })
        .to_string();
        let keychain = FakeKeychain::with(&[(SINGLE_ACCOUNT, &raw)]);
        let store = PerNameStore::new(keychain.clone());

        let values = store.read_all().expect("read all");

        assert_eq!(
            values.get("OPENROUTER_API_KEY").map(String::as_str),
            Some("sk-or-v1-key")
        );
        assert_eq!(values.get("R2_BUCKET").map(String::as_str), Some("media"));
        assert!(keychain.has("OPENROUTER_API_KEY"));
        assert!(keychain.has("R2_BUCKET"));
        assert!(!keychain.has(SINGLE_ACCOUNT));
    }

    #[test]
    fn per_name_store_keeps_other_entries_when_a_write_fails() {
        let raw = serde_json::json!({
            "OPENROUTER_API_KEY": "sk-or-v1-key",
            "R2_BUCKET": "media",
        })
        .to_string();
        let keychain = FakeKeychain::with(&[(SINGLE_ACCOUNT, &raw)]);
        keychain.fail_set("R2_BUCKET");
        let store = PerNameStore::new(keychain.clone());

        store.read_all().expect("read all");

        assert!(keychain.has(SINGLE_ACCOUNT));
        assert!(keychain.has("OPENROUTER_API_KEY"));
        assert!(!keychain.has("R2_BUCKET"));
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
        let values = parse_object(&raw).expect("valid json");

        assert_eq!(values.len(), 1);
        assert_eq!(values.get("R2_BUCKET").map(String::as_str), Some("ok"));
    }

    #[test]
    fn parse_object_rejects_invalid_json() {
        let error = parse_object("not json").expect_err("invalid json is an error");

        assert!(matches!(error, KeyError::Failed(ref message) if message == INVALID_ITEM));
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
