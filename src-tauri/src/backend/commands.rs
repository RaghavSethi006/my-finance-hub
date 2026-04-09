use log::{debug, error, info, warn};
use rusqlite::Connection;
use tauri::State;

use super::{
  models::{
    AppSnapshot,
    DesktopPaths,
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
