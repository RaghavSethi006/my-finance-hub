use std::{fs, num::ParseIntError, path::Path};

use aes_gcm::{
  aead::{Aead, KeyInit},
  Aes256Gcm, Nonce,
};
use pbkdf2::pbkdf2_hmac_array;
use rand::random;
use rusqlite::{params, Connection};
use sha2::Sha256;

use super::{
  models::{SecurityStatus, SetAppPinPayload, SetAutoLockTimeoutPayload, SetVaultPasswordPayload},
  storage::{now_unix_timestamp, AppState},
  vault::load_documents,
};

const HASH_ALGORITHM: &str = "pbkdf2-sha256";
const PBKDF2_ITERATIONS: u32 = 210_000;
const PIN_MIN_LENGTH: usize = 4;
const PIN_MAX_LENGTH: usize = 8;
const PASSWORD_MIN_LENGTH: usize = 8;
const FILE_MAGIC: &[u8; 4] = b"FVA1";
const BACKUP_MAGIC: &[u8; 4] = b"FBK1";
const NONCE_LENGTH: usize = 12;

#[derive(Clone)]
struct SecurityConfig {
  app_pin_hash: Option<String>,
  vault_password_hash: Option<String>,
  vault_salt: Option<String>,
  auto_lock_timeout_seconds: i64,
}

pub fn get_security_status(conn: &Connection, state: &AppState) -> Result<SecurityStatus, String> {
  build_status(conn, state)
}

pub fn record_activity(conn: &Connection, state: &AppState) -> Result<SecurityStatus, String> {
  let now = now_unix_timestamp();
  let mut runtime = lock_runtime(state)?;
  runtime.last_activity_at = now;
  drop(runtime);
  build_status(conn, state)
}

pub fn lock_app(conn: &Connection, state: &AppState) -> Result<SecurityStatus, String> {
  let config = load_security_config(conn)?;
  let mut runtime = lock_runtime(state)?;
  if config.app_pin_hash.is_some() {
    runtime.app_locked = true;
  }
  if config.vault_password_hash.is_some() {
    runtime.vault_locked = true;
    runtime.vault_key = None;
  }
  drop(runtime);
  build_status(conn, state)
}

pub fn unlock_app(conn: &Connection, state: &AppState, pin: &str) -> Result<SecurityStatus, String> {
  let config = load_security_config(conn)?;
  let stored_hash = config
    .app_pin_hash
    .as_deref()
    .ok_or_else(|| String::from("Set an app PIN before using app lock"))?;

  {
    let runtime = lock_runtime(state)?;
    if let Some(seconds) = cooldown_remaining(runtime.app_lockout_until, now_unix_timestamp()) {
      return Err(format!("Too many incorrect PIN attempts. Try again in {seconds} seconds."));
    }
  }

  if !verify_secret(pin, stored_hash)? {
    let mut runtime = lock_runtime(state)?;
    register_app_failed_attempt(&mut runtime);
    return Err(build_cooldown_error("Incorrect PIN", runtime.app_lockout_until));
  }

  let mut runtime = lock_runtime(state)?;
  runtime.app_locked = false;
  runtime.app_failed_attempts = 0;
  runtime.app_lockout_until = None;
  runtime.last_activity_at = now_unix_timestamp();
  drop(runtime);
  build_status(conn, state)
}

pub fn set_app_pin(
  conn: &Connection,
  state: &AppState,
  payload: SetAppPinPayload,
) -> Result<SecurityStatus, String> {
  validate_pin(&payload.new_pin)?;

  let config = load_security_config(conn)?;
  if let Some(existing_hash) = config.app_pin_hash.as_deref() {
    let current_pin = payload
      .current_pin
      .as_deref()
      .ok_or_else(|| String::from("Current app PIN is required"))?;

    if !verify_secret(current_pin, existing_hash)? {
      return Err(String::from("Current app PIN is incorrect"));
    }
  }

  let hash = hash_secret(&payload.new_pin);
  conn
    .execute(
      "UPDATE settings SET app_pin_hash = ?, updated_at = datetime('now') WHERE id = 1",
      [hash],
    )
    .map_err(|error| format!("Unable to save app PIN: {error}"))?;

  let mut runtime = lock_runtime(state)?;
  runtime.app_locked = false;
  runtime.app_failed_attempts = 0;
  runtime.app_lockout_until = None;
  runtime.last_activity_at = now_unix_timestamp();
  drop(runtime);
  build_status(conn, state)
}

pub fn lock_vault(conn: &Connection, state: &AppState) -> Result<SecurityStatus, String> {
  let config = load_security_config(conn)?;
  let mut runtime = lock_runtime(state)?;
  if config.vault_password_hash.is_some() {
    runtime.vault_locked = true;
    runtime.vault_key = None;
  }
  drop(runtime);
  build_status(conn, state)
}

pub fn unlock_vault(conn: &Connection, state: &AppState, password: &str) -> Result<SecurityStatus, String> {
  let config = load_security_config(conn)?;
  let stored_hash = config
    .vault_password_hash
    .as_deref()
    .ok_or_else(|| String::from("Set a vault password before unlocking the vault"))?;
  let salt = load_vault_salt(&config)?;

  {
    let runtime = lock_runtime(state)?;
    if runtime.app_locked {
      return Err(String::from("Unlock the app before unlocking the vault"));
    }
    if let Some(seconds) = cooldown_remaining(runtime.vault_lockout_until, now_unix_timestamp()) {
      return Err(format!(
        "Too many incorrect vault password attempts. Try again in {seconds} seconds."
      ));
    }
  }

  let key = derive_key(password, &salt);
  if !verify_derived_hash(&key, stored_hash)? {
    let mut runtime = lock_runtime(state)?;
    register_vault_failed_attempt(&mut runtime);
    return Err(build_cooldown_error(
      "Incorrect vault password",
      runtime.vault_lockout_until,
    ));
  }

  let mut runtime = lock_runtime(state)?;
  runtime.vault_locked = false;
  runtime.vault_key = Some(key);
  runtime.vault_failed_attempts = 0;
  runtime.vault_lockout_until = None;
  runtime.last_activity_at = now_unix_timestamp();
  drop(runtime);
  build_status(conn, state)
}

pub fn set_vault_password(
  conn: &Connection,
  state: &AppState,
  payload: SetVaultPasswordPayload,
) -> Result<SecurityStatus, String> {
  validate_password(&payload.new_password)?;

  let config = load_security_config(conn)?;
  let old_key = if let Some(existing_hash) = config.vault_password_hash.as_deref() {
    let current_password = payload
      .current_password
      .as_deref()
      .ok_or_else(|| String::from("Current vault password is required"))?;
    let existing_salt = load_vault_salt(&config)?;
    let current_key = derive_key(current_password, &existing_salt);

    if !verify_derived_hash(&current_key, existing_hash)? {
      return Err(String::from("Current vault password is incorrect"));
    }

    Some(current_key)
  } else {
    None
  };

  let new_salt: [u8; 16] = random();
  let new_key = derive_key(&payload.new_password, &new_salt);
  let new_hash = encode_hash(&new_salt, &new_key);
  let salt_hex = hex::encode(new_salt);

  reencrypt_vault_files(conn, state, old_key.as_ref(), &new_key)?;

  conn
    .execute(
      "UPDATE settings
       SET vault_password_hash = ?, vault_salt = ?, updated_at = datetime('now')
       WHERE id = 1",
      params![new_hash, salt_hex],
    )
    .map_err(|error| format!("Unable to save vault password: {error}"))?;

  let mut runtime = lock_runtime(state)?;
  runtime.vault_locked = false;
  runtime.vault_key = Some(new_key);
  runtime.vault_failed_attempts = 0;
  runtime.vault_lockout_until = None;
  runtime.last_activity_at = now_unix_timestamp();
  drop(runtime);
  build_status(conn, state)
}

pub fn set_auto_lock_timeout(
  conn: &Connection,
  state: &AppState,
  payload: SetAutoLockTimeoutPayload,
) -> Result<SecurityStatus, String> {
  if payload.timeout_seconds < 0 {
    return Err(String::from("Auto-lock timeout must be zero or greater"));
  }

  conn
    .execute(
      "UPDATE settings SET auto_lock_timeout = ?, updated_at = datetime('now') WHERE id = 1",
      [payload.timeout_seconds],
    )
    .map_err(|error| format!("Unable to save auto-lock timeout: {error}"))?;

  build_status(conn, state)
}

pub fn encrypt_vault_bytes(state: &AppState, plaintext: &[u8]) -> Result<Vec<u8>, String> {
  let runtime = lock_runtime(state)?;
  if runtime.vault_locked {
    return Err(String::from("Unlock the vault before storing documents"));
  }
  let key = runtime
    .vault_key
    .ok_or_else(|| String::from("Set and unlock the vault password before storing documents"))?;
  drop(runtime);
  encrypt_bytes_with_key(plaintext, &key)
}

pub fn decrypt_vault_bytes(state: &AppState, ciphertext: &[u8]) -> Result<Vec<u8>, String> {
  let runtime = lock_runtime(state)?;
  if runtime.vault_locked {
    return Err(String::from("Unlock the vault before opening documents"));
  }
  let key = runtime
    .vault_key
    .ok_or_else(|| String::from("Set and unlock the vault password before opening documents"))?;
  drop(runtime);
  decrypt_bytes_with_key(ciphertext, &key)
}

pub fn encrypt_backup_bytes(password: &str, plaintext: &[u8]) -> Result<Vec<u8>, String> {
  validate_password(password)?;
  let salt: [u8; 16] = random();
  let key = derive_key(password, &salt);
  let cipher = Aes256Gcm::new_from_slice(&key).map_err(|_| String::from("Invalid encryption key"))?;
  let nonce_bytes: [u8; NONCE_LENGTH] = random();
  let nonce = Nonce::from_slice(&nonce_bytes);
  let ciphertext = cipher
    .encrypt(nonce, plaintext)
    .map_err(|_| String::from("Unable to encrypt backup archive"))?;

  let mut encoded = Vec::with_capacity(BACKUP_MAGIC.len() + salt.len() + NONCE_LENGTH + ciphertext.len());
  encoded.extend_from_slice(BACKUP_MAGIC);
  encoded.extend_from_slice(&salt);
  encoded.extend_from_slice(&nonce_bytes);
  encoded.extend_from_slice(&ciphertext);
  Ok(encoded)
}

pub fn decrypt_backup_bytes(password: &str, ciphertext: &[u8]) -> Result<Vec<u8>, String> {
  validate_password(password)?;
  if ciphertext.len() <= BACKUP_MAGIC.len() + 16 + NONCE_LENGTH || &ciphertext[..BACKUP_MAGIC.len()] != BACKUP_MAGIC {
    return Err(String::from("Encrypted backup format is invalid"));
  }

  let salt = &ciphertext[BACKUP_MAGIC.len()..BACKUP_MAGIC.len() + 16];
  let key = derive_key(password, salt);
  decrypt_bytes_with_magic(
    ciphertext,
    &key,
    BACKUP_MAGIC,
    16,
    "Unable to decrypt encrypted backup. The password may be incorrect.",
  )
}

fn build_status(conn: &Connection, state: &AppState) -> Result<SecurityStatus, String> {
  let config = load_security_config(conn)?;
  let now = now_unix_timestamp();
  let mut runtime = lock_runtime(state)?;
  apply_auto_lock(&config, &mut runtime, now);
  Ok(SecurityStatus {
    has_app_pin: config.app_pin_hash.is_some(),
    has_vault_password: config.vault_password_hash.is_some(),
    is_app_locked: config.app_pin_hash.is_some() && runtime.app_locked,
    is_vault_locked: config.vault_password_hash.is_some() && runtime.vault_locked,
    auto_lock_timeout_seconds: config.auto_lock_timeout_seconds.max(0),
    app_cooldown_remaining_seconds: cooldown_remaining(runtime.app_lockout_until, now).unwrap_or(0),
    vault_cooldown_remaining_seconds: cooldown_remaining(runtime.vault_lockout_until, now).unwrap_or(0),
    app_failed_attempts: runtime.app_failed_attempts,
    vault_failed_attempts: runtime.vault_failed_attempts,
  })
}

fn reencrypt_vault_files(
  conn: &Connection,
  _state: &AppState,
  old_key: Option<&[u8; 32]>,
  new_key: &[u8; 32],
) -> Result<(), String> {
  for document in load_documents(conn)? {
    let Some(file_path) = document.file_path else {
      continue;
    };

    let path = Path::new(&file_path);
    if !path.exists() {
      continue;
    }

    let current = fs::read(path).map_err(|error| format!("Unable to read vault file {}: {error}", path.display()))?;
    let plaintext = decrypt_bytes_for_migration(&current, old_key)?;
    let encrypted = encrypt_bytes_with_key(&plaintext, new_key)?;
    fs::write(path, encrypted).map_err(|error| format!("Unable to re-encrypt vault file {}: {error}", path.display()))?;
  }

  Ok(())
}

fn decrypt_bytes_for_migration(bytes: &[u8], key: Option<&[u8; 32]>) -> Result<Vec<u8>, String> {
  if !is_encrypted_file(bytes) {
    return Ok(bytes.to_vec());
  }

  let key = key.ok_or_else(|| String::from("Current vault password is required to migrate encrypted files"))?;
  decrypt_bytes_with_key(bytes, key)
}

fn encrypt_bytes_with_key(plaintext: &[u8], key: &[u8; 32]) -> Result<Vec<u8>, String> {
  encrypt_bytes_with_magic(plaintext, key, FILE_MAGIC, "Unable to encrypt vault document")
}

fn encrypt_bytes_with_magic(
  plaintext: &[u8],
  key: &[u8; 32],
  magic: &[u8; 4],
  error_message: &str,
) -> Result<Vec<u8>, String> {
  let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| String::from("Invalid encryption key"))?;
  let nonce_bytes: [u8; NONCE_LENGTH] = random();
  let nonce = Nonce::from_slice(&nonce_bytes);
  let ciphertext = cipher
    .encrypt(nonce, plaintext)
    .map_err(|_| String::from(error_message))?;

  let mut encoded = Vec::with_capacity(magic.len() + NONCE_LENGTH + ciphertext.len());
  encoded.extend_from_slice(magic);
  encoded.extend_from_slice(&nonce_bytes);
  encoded.extend_from_slice(&ciphertext);
  Ok(encoded)
}

fn decrypt_bytes_with_key(ciphertext: &[u8], key: &[u8; 32]) -> Result<Vec<u8>, String> {
  if !is_encrypted_file(ciphertext) {
    return Err(String::from("Vault file is not encrypted with the current format"));
  }

  decrypt_bytes_with_magic(
    ciphertext,
    key,
    FILE_MAGIC,
    0,
    "Unable to decrypt vault document. The vault password may be incorrect.",
  )
}

fn decrypt_bytes_with_magic(
  ciphertext: &[u8],
  key: &[u8; 32],
  magic: &[u8; 4],
  salt_length: usize,
  error_message: &str,
) -> Result<Vec<u8>, String> {
  let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| String::from("Invalid encryption key"))?;
  let nonce_start = magic.len() + salt_length;
  let nonce_end = nonce_start + NONCE_LENGTH;
  let nonce = Nonce::from_slice(&ciphertext[nonce_start..nonce_end]);
  cipher
    .decrypt(nonce, &ciphertext[nonce_end..])
    .map_err(|_| String::from(error_message))
}

fn is_encrypted_file(bytes: &[u8]) -> bool {
  bytes.len() > FILE_MAGIC.len() + NONCE_LENGTH && &bytes[..FILE_MAGIC.len()] == FILE_MAGIC
}

fn load_security_config(conn: &Connection) -> Result<SecurityConfig, String> {
  conn
    .query_row(
      "SELECT app_pin_hash, vault_password_hash, vault_salt, auto_lock_timeout FROM settings WHERE id = 1",
      [],
      |row| {
        Ok(SecurityConfig {
          app_pin_hash: row.get(0)?,
          vault_password_hash: row.get(1)?,
          vault_salt: row.get(2)?,
          auto_lock_timeout_seconds: row.get::<_, Option<i64>>(3)?.unwrap_or(600),
        })
      },
    )
    .map_err(|error| format!("Unable to load security settings: {error}"))
}

fn load_vault_salt(config: &SecurityConfig) -> Result<Vec<u8>, String> {
  if let Some(salt) = config.vault_salt.as_deref() {
    return decode_hex(salt);
  }

  if let Some(hash) = config.vault_password_hash.as_deref() {
    let (_, salt, _) = parse_hash(hash)?;
    return Ok(salt);
  }

  Err(String::from("Vault password salt is missing"))
}

fn apply_auto_lock(config: &SecurityConfig, runtime: &mut super::storage::RuntimeSecurityState, now: i64) {
  if config.auto_lock_timeout_seconds <= 0 {
    return;
  }

  let has_lock_target =
    (config.app_pin_hash.is_some() && !runtime.app_locked) || (config.vault_password_hash.is_some() && !runtime.vault_locked);
  if !has_lock_target {
    return;
  }

  if now - runtime.last_activity_at < config.auto_lock_timeout_seconds {
    return;
  }

  if config.app_pin_hash.is_some() {
    runtime.app_locked = true;
  }
  if config.vault_password_hash.is_some() {
    runtime.vault_locked = true;
    runtime.vault_key = None;
  }
}

fn lock_runtime(
  state: &AppState,
) -> Result<std::sync::MutexGuard<'_, super::storage::RuntimeSecurityState>, String> {
  state
    .security
    .lock()
    .map_err(|_| String::from("Unable to access security runtime"))
}

fn register_failed_attempt(attempts: &mut u32, lockout_until: &mut Option<i64>) {
  *attempts += 1;
  let now = now_unix_timestamp();
  let cooldown_seconds = match *attempts {
    0..=4 => 0,
    5 => 30,
    6 => 60,
    7 => 120,
    _ => 300,
  };

  if cooldown_seconds > 0 {
    *lockout_until = Some(now + cooldown_seconds);
  }
}

fn register_app_failed_attempt(runtime: &mut super::storage::RuntimeSecurityState) {
  register_failed_attempt(&mut runtime.app_failed_attempts, &mut runtime.app_lockout_until);
}

fn register_vault_failed_attempt(runtime: &mut super::storage::RuntimeSecurityState) {
  register_failed_attempt(&mut runtime.vault_failed_attempts, &mut runtime.vault_lockout_until);
}

fn cooldown_remaining(lockout_until: Option<i64>, now: i64) -> Option<i64> {
  lockout_until.and_then(|value| {
    let remaining = value - now;
    if remaining > 0 { Some(remaining) } else { None }
  })
}

fn build_cooldown_error(prefix: &str, lockout_until: Option<i64>) -> String {
  let now = now_unix_timestamp();
  match cooldown_remaining(lockout_until, now) {
    Some(seconds) => format!("{prefix}. Try again in {seconds} seconds."),
    None => prefix.to_string(),
  }
}

fn validate_pin(pin: &str) -> Result<(), String> {
  let trimmed = pin.trim();
  if trimmed.len() < PIN_MIN_LENGTH || trimmed.len() > PIN_MAX_LENGTH {
    return Err(format!("PIN must be between {PIN_MIN_LENGTH} and {PIN_MAX_LENGTH} digits"));
  }
  if !trimmed.chars().all(|character| character.is_ascii_digit()) {
    return Err(String::from("PIN must contain only digits"));
  }
  Ok(())
}

fn validate_password(password: &str) -> Result<(), String> {
  if password.trim().len() < PASSWORD_MIN_LENGTH {
    return Err(format!(
      "Vault password must be at least {PASSWORD_MIN_LENGTH} characters long"
    ));
  }
  Ok(())
}

fn hash_secret(secret: &str) -> String {
  let salt: [u8; 16] = random();
  let derived = derive_key(secret, &salt);
  encode_hash(&salt, &derived)
}

fn derive_key(password: &str, salt: &[u8]) -> [u8; 32] {
  pbkdf2_hmac_array::<Sha256, 32>(password.as_bytes(), salt, PBKDF2_ITERATIONS)
}

fn verify_secret(secret: &str, encoded_hash: &str) -> Result<bool, String> {
  let (iterations, salt, expected) = parse_hash(encoded_hash)?;
  let derived = pbkdf2_hmac_array::<Sha256, 32>(secret.as_bytes(), &salt, iterations);
  Ok(derived == expected)
}

fn verify_derived_hash(derived_key: &[u8; 32], encoded_hash: &str) -> Result<bool, String> {
  let (_, _, expected) = parse_hash(encoded_hash)?;
  Ok(*derived_key == expected)
}

fn encode_hash(salt: &[u8], derived: &[u8; 32]) -> String {
  format!(
    "{HASH_ALGORITHM}${PBKDF2_ITERATIONS}${}${}",
    hex::encode(salt),
    hex::encode(derived)
  )
}

fn parse_hash(encoded_hash: &str) -> Result<(u32, Vec<u8>, [u8; 32]), String> {
  let parts: Vec<&str> = encoded_hash.split('$').collect();
  if parts.len() != 4 || parts[0] != HASH_ALGORITHM {
    return Err(String::from("Stored hash format is invalid"));
  }

  let iterations = parts[1]
    .parse::<u32>()
    .map_err(|error: ParseIntError| format!("Stored hash iteration count is invalid: {error}"))?;
  let salt = decode_hex(parts[2])?;
  let derived_bytes = decode_hex(parts[3])?;
  let derived: [u8; 32] = derived_bytes
    .try_into()
    .map_err(|_| String::from("Stored hash length is invalid"))?;
  Ok((iterations, salt, derived))
}

fn decode_hex(value: &str) -> Result<Vec<u8>, String> {
  hex::decode(value).map_err(|error| format!("Invalid hex value: {error}"))
}
