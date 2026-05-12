use std::{
  fs,
  io::{Cursor, Read, Write},
  path::Path,
};

use log::{debug, error, info, warn};
use rusqlite::Connection;
use tauri::State;
use zip::{write::FileOptions, CompressionMethod, ZipWriter};

use super::{
  models::{
    AppSnapshot,
    DesktopPaths,
    ExportEncryptedBackupPayload,
    ImportEncryptedBackupPayload,
    ImportVaultDocumentPayload,
    SecurityStatus,
    SetAppPinPayload,
    SetAutoLockTimeoutPayload,
    SetVaultPasswordPayload,
    UnlockAppPayload,
    UnlockVaultPayload,
    VaultDocument,
  },
  security,
  snapshot::{load_snapshot, replace_snapshot},
  storage::{open_connection, AppState},
  vault,
};

#[tauri::command]
pub fn load_app_state(state: State<'_, AppState>) -> Result<AppSnapshot, String> {
  debug!("load_app_state requested");
  let conn = open_connection(&state)?;
  match load_snapshot(&conn) {
    Ok(snapshot) => {
      info!("load_app_state succeeded {}", summarize_snapshot(&snapshot));
      Ok(snapshot)
    }
    Err(err) => {
      error!("load_app_state failed: {err}");
      Err(err)
    }
  }
}

#[tauri::command]
pub fn replace_app_state(snapshot: AppSnapshot, state: State<'_, AppState>) -> Result<(), String> {
  info!("replace_app_state requested {}", summarize_snapshot(&snapshot));
  let mut conn = open_connection(&state)?;
  match replace_snapshot(&mut conn, &snapshot) {
    Ok(()) => {
      info!("replace_app_state succeeded {}", summarize_snapshot(&snapshot));
      Ok(())
    }
    Err(err) => {
      error!("replace_app_state failed: {err}");
      Err(err)
    }
  }
}

#[tauri::command]
pub fn import_vault_document(payload: ImportVaultDocumentPayload, state: State<'_, AppState>) -> Result<VaultDocument, String> {
  info!(
    "import_vault_document requested id={} name={} category={} size={}",
    payload.id, payload.name, payload.category, payload.size
  );
  let document = match vault::import_vault_document(payload, &state) {
    Ok(document) => document,
    Err(err) => {
      error!("import_vault_document failed before transaction: {err}");
      return Err(err);
    }
  };
  let mut conn = open_connection(&state)?;
  let transaction = conn
    .transaction()
    .map_err(|error| format!("Unable to begin vault document transaction: {error}"))?;
  vault::insert_documents(&transaction, std::slice::from_ref(&document))?;
  transaction
    .commit()
    .map_err(|error| format!("Unable to commit vault document transaction: {error}"))?;
  info!("import_vault_document succeeded id={} filePath={:?}", document.id, document.file_path);
  Ok(document)
}

#[tauri::command]
pub fn delete_vault_document(document_id: String, state: State<'_, AppState>) -> Result<(), String> {
  info!("delete_vault_document requested id={document_id}");
  let conn: Connection = open_connection(&state)?;
  match vault::delete_vault_document(&conn, &document_id) {
    Ok(()) => {
      info!("delete_vault_document succeeded id={document_id}");
      Ok(())
    }
    Err(err) => {
      error!("delete_vault_document failed id={document_id}: {err}");
      Err(err)
    }
  }
}

#[tauri::command]
pub fn read_vault_document(document_id: String, state: State<'_, AppState>) -> Result<Vec<u8>, String> {
  debug!("read_vault_document requested id={document_id}");
  let conn: Connection = open_connection(&state)?;
  match vault::read_vault_document(&conn, &state, &document_id) {
    Ok(bytes) => {
      debug!("read_vault_document succeeded id={} bytes={}", document_id, bytes.len());
      Ok(bytes)
    }
    Err(err) => {
      error!("read_vault_document failed id={document_id}: {err}");
      Err(err)
    }
  }
}

#[tauri::command]
pub fn get_desktop_paths(state: State<'_, AppState>) -> Result<DesktopPaths, String> {
  let paths = DesktopPaths {
    data_dir: state.data_dir.to_string_lossy().to_string(),
    db_path: state.db_path.to_string_lossy().to_string(),
    vault_dir: state.vault_dir.to_string_lossy().to_string(),
  };
  debug!("get_desktop_paths {}", paths.data_dir);
  Ok(paths)
}

#[tauri::command]
pub fn get_security_status(state: State<'_, AppState>) -> Result<SecurityStatus, String> {
  let conn = open_connection(&state)?;
  match security::get_security_status(&conn, &state) {
    Ok(status) => {
      debug!(
        "get_security_status appLocked={} vaultLocked={} hasPin={} hasVaultPassword={}",
        status.is_app_locked, status.is_vault_locked, status.has_app_pin, status.has_vault_password
      );
      Ok(status)
    }
    Err(err) => {
      error!("get_security_status failed: {err}");
      Err(err)
    }
  }
}

#[tauri::command]
pub fn record_security_activity(state: State<'_, AppState>) -> Result<SecurityStatus, String> {
  let conn = open_connection(&state)?;
  match security::record_activity(&conn, &state) {
    Ok(status) => {
      debug!("record_security_activity succeeded");
      Ok(status)
    }
    Err(err) => {
      error!("record_security_activity failed: {err}");
      Err(err)
    }
  }
}

#[tauri::command]
pub fn lock_app(state: State<'_, AppState>) -> Result<SecurityStatus, String> {
  info!("lock_app requested");
  let conn = open_connection(&state)?;
  match security::lock_app(&conn, &state) {
    Ok(status) => {
      info!("lock_app succeeded");
      Ok(status)
    }
    Err(err) => {
      error!("lock_app failed: {err}");
      Err(err)
    }
  }
}

#[tauri::command]
pub fn unlock_app(payload: UnlockAppPayload, state: State<'_, AppState>) -> Result<SecurityStatus, String> {
  info!("unlock_app requested");
  let conn = open_connection(&state)?;
  match security::unlock_app(&conn, &state, &payload.pin) {
    Ok(status) => {
      info!("unlock_app succeeded");
      Ok(status)
    }
    Err(err) => {
      warn!("unlock_app failed: {err}");
      Err(err)
    }
  }
}

#[tauri::command]
pub fn set_app_pin(payload: SetAppPinPayload, state: State<'_, AppState>) -> Result<SecurityStatus, String> {
  info!("set_app_pin requested mode={}", if payload.current_pin.is_some() { "change" } else { "create" });
  let conn = open_connection(&state)?;
  match security::set_app_pin(&conn, &state, payload) {
    Ok(status) => {
      info!("set_app_pin succeeded");
      Ok(status)
    }
    Err(err) => {
      warn!("set_app_pin failed: {err}");
      Err(err)
    }
  }
}

#[tauri::command]
pub fn lock_vault(state: State<'_, AppState>) -> Result<SecurityStatus, String> {
  info!("lock_vault requested");
  let conn = open_connection(&state)?;
  match security::lock_vault(&conn, &state) {
    Ok(status) => {
      info!("lock_vault succeeded");
      Ok(status)
    }
    Err(err) => {
      error!("lock_vault failed: {err}");
      Err(err)
    }
  }
}

#[tauri::command]
pub fn unlock_vault(payload: UnlockVaultPayload, state: State<'_, AppState>) -> Result<SecurityStatus, String> {
  info!("unlock_vault requested");
  let conn = open_connection(&state)?;
  match security::unlock_vault(&conn, &state, &payload.password) {
    Ok(status) => {
      info!("unlock_vault succeeded");
      Ok(status)
    }
    Err(err) => {
      warn!("unlock_vault failed: {err}");
      Err(err)
    }
  }
}

#[tauri::command]
pub fn set_vault_password(
  payload: SetVaultPasswordPayload,
  state: State<'_, AppState>,
) -> Result<SecurityStatus, String> {
  info!(
    "set_vault_password requested mode={}",
    if payload.current_password.is_some() { "change" } else { "create" }
  );
  let conn = open_connection(&state)?;
  match security::set_vault_password(&conn, &state, payload) {
    Ok(status) => {
      info!("set_vault_password succeeded");
      Ok(status)
    }
    Err(err) => {
      warn!("set_vault_password failed: {err}");
      Err(err)
    }
  }
}

#[tauri::command]
pub fn set_auto_lock_timeout(
  payload: SetAutoLockTimeoutPayload,
  state: State<'_, AppState>,
) -> Result<SecurityStatus, String> {
  info!("set_auto_lock_timeout requested timeoutSeconds={}", payload.timeout_seconds);
  let conn = open_connection(&state)?;
  match security::set_auto_lock_timeout(&conn, &state, payload) {
    Ok(status) => {
      info!("set_auto_lock_timeout succeeded timeoutSeconds={}", status.auto_lock_timeout_seconds);
      Ok(status)
    }
    Err(err) => {
      warn!("set_auto_lock_timeout failed: {err}");
      Err(err)
    }
  }
}

#[tauri::command]
pub fn log_frontend_event(level: String, action: String, details: Option<String>) -> Result<(), String> {
  let message = match details {
    Some(details) if !details.is_empty() => format!("{action} | {details}"),
    _ => action,
  };

  match level.as_str() {
    "debug" => debug!("frontend: {message}"),
    "warn" => warn!("frontend: {message}"),
    "error" => error!("frontend: {message}"),
    _ => info!("frontend: {message}"),
  }

  Ok(())
}

#[tauri::command]
pub fn export_encrypted_backup(
  payload: ExportEncryptedBackupPayload,
  state: State<'_, AppState>,
) -> Result<Vec<u8>, String> {
  info!("export_encrypted_backup requested");
  let conn = open_connection(&state)?;
  let snapshot = load_snapshot(&conn)?;
  let archive = build_backup_archive(&conn, &state, snapshot)?;
  let encrypted = security::encrypt_backup_bytes(&payload.password, &archive)?;
  info!("export_encrypted_backup succeeded bytes={}", encrypted.len());
  Ok(encrypted)
}

#[tauri::command]
pub fn import_encrypted_backup(
  payload: ImportEncryptedBackupPayload,
  state: State<'_, AppState>,
) -> Result<AppSnapshot, String> {
  info!("import_encrypted_backup requested bytes={}", payload.bytes.len());
  let archive = security::decrypt_backup_bytes(&payload.password, &payload.bytes)?;
  let snapshot = restore_backup_archive(&state, &archive)?;
  let mut conn = open_connection(&state)?;
  replace_snapshot(&mut conn, &snapshot)?;
  info!("import_encrypted_backup succeeded {}", summarize_snapshot(&snapshot));
  Ok(snapshot)
}

fn summarize_snapshot(snapshot: &AppSnapshot) -> String {
  format!(
    "accounts={} transactions={} recurring={} assets={} loans={} documents={} alerts={}",
    snapshot.accounts.len(),
    snapshot.transactions.len(),
    snapshot.recurring_templates.len(),
    snapshot.assets.len(),
    snapshot.loans.len(),
    snapshot.documents.len(),
    snapshot.alerts.len()
  )
}

fn build_backup_archive(conn: &Connection, state: &AppState, snapshot: AppSnapshot) -> Result<Vec<u8>, String> {
  let cursor = Cursor::new(Vec::<u8>::new());
  let mut zip = ZipWriter::new(cursor);
  let options = FileOptions::default().compression_method(CompressionMethod::Deflated);

  let sanitized_snapshot = sanitize_snapshot_for_backup(snapshot);
  let snapshot_json = serde_json::to_vec_pretty(&sanitized_snapshot)
    .map_err(|error| format!("Unable to serialize backup snapshot: {error}"))?;
  let manifest_json = serde_json::to_vec_pretty(&serde_json::json!({
    "format": "finos-encrypted-backup",
    "version": 1,
    "exportedAt": chrono::Utc::now().to_rfc3339(),
    "documentCount": sanitized_snapshot.documents.len(),
  }))
  .map_err(|error| format!("Unable to serialize backup manifest: {error}"))?;

  zip
    .start_file("manifest.json", options)
    .map_err(|error| format!("Unable to start backup manifest: {error}"))?;
  zip
    .write_all(&manifest_json)
    .map_err(|error| format!("Unable to write backup manifest: {error}"))?;

  zip
    .start_file("snapshot.json", options)
    .map_err(|error| format!("Unable to start backup snapshot: {error}"))?;
  zip
    .write_all(&snapshot_json)
    .map_err(|error| format!("Unable to write backup snapshot: {error}"))?;

  for document in &sanitized_snapshot.documents {
    let extension = document.file_type.to_lowercase();
    let bytes = vault::read_vault_document(conn, state, &document.id)
      .map_err(|error| format!("Unable to include document {} in encrypted backup: {error}", document.name))?;
    let entry_name = format!("vault/{}.{}", document.id, extension);
    zip
      .start_file(entry_name, options)
      .map_err(|error| format!("Unable to start backup file for {}: {error}", document.name))?;
    zip
      .write_all(&bytes)
      .map_err(|error| format!("Unable to write backup file for {}: {error}", document.name))?;
  }

  zip
    .finish()
    .map_err(|error| format!("Unable to finish encrypted backup archive: {error}"))
    .map(|cursor| cursor.into_inner())
}

fn sanitize_snapshot_for_backup(mut snapshot: AppSnapshot) -> AppSnapshot {
  for document in &mut snapshot.documents {
    document.file_path = None;
  }
  snapshot
}

fn restore_backup_archive(state: &AppState, archive: &[u8]) -> Result<AppSnapshot, String> {
  let reader = Cursor::new(archive);
  let mut zip = zip::ZipArchive::new(reader).map_err(|error| format!("Unable to open encrypted backup archive: {error}"))?;
  let mut snapshot_json = Vec::new();
  zip
    .by_name("snapshot.json")
    .map_err(|error| format!("Encrypted backup snapshot is missing: {error}"))?
    .read_to_end(&mut snapshot_json)
    .map_err(|error| format!("Unable to read encrypted backup snapshot: {error}"))?;

  let mut snapshot: AppSnapshot =
    serde_json::from_slice(&snapshot_json).map_err(|error| format!("Unable to parse encrypted backup snapshot: {error}"))?;
  let mut restored_documents = Vec::with_capacity(snapshot.documents.len());

  for document in &mut snapshot.documents {
    let extension = document.file_type.to_lowercase();
    let entry_name = format!("vault/{}.{}", document.id, extension);
    let mut file = zip
      .by_name(&entry_name)
      .map_err(|error| format!("Encrypted backup is missing vault file for {}: {error}", document.name))?;
    let mut bytes = Vec::new();
    file
      .read_to_end(&mut bytes)
      .map_err(|error| format!("Unable to read vault file for {}: {error}", document.name))?;
    restored_documents.push((document.id.clone(), extension, bytes));
  }

  clear_directory(&state.vault_dir)?;

  for document in &mut snapshot.documents {
    let (document_id, extension, bytes) = restored_documents
      .iter()
      .find(|(document_id, _, _)| document_id == &document.id)
      .ok_or_else(|| format!("Restored file payload is missing for {}", document.name))?;
    let path = state.vault_dir.join(format!("{document_id}.{extension}"));
    fs::write(&path, bytes).map_err(|error| format!("Unable to restore vault file for {}: {error}", document.name))?;
    document.file_path = Some(path.to_string_lossy().to_string());
  }

  Ok(snapshot)
}

fn clear_directory(path: &Path) -> Result<(), String> {
  if !path.exists() {
    fs::create_dir_all(path).map_err(|error| format!("Unable to create backup restore directory: {error}"))?;
    return Ok(());
  }

  for entry in fs::read_dir(path).map_err(|error| format!("Unable to inspect backup restore directory: {error}"))? {
    let entry = entry.map_err(|error| format!("Unable to inspect backup restore entry: {error}"))?;
    let entry_path = entry.path();
    if entry_path.is_dir() {
      fs::remove_dir_all(&entry_path)
        .map_err(|error| format!("Unable to remove backup restore directory {}: {error}", entry_path.display()))?;
    } else {
      fs::remove_file(&entry_path)
        .map_err(|error| format!("Unable to remove backup restore file {}: {error}", entry_path.display()))?;
    }
  }

  Ok(())
}
