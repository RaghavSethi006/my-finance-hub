use rusqlite::Connection;
use tauri::State;

use super::{
  models::{AppSnapshot, DesktopPaths, ImportVaultDocumentPayload, VaultDocument},
  snapshot::{load_snapshot, replace_snapshot},
  storage::{open_connection, AppState},
  vault,
};

#[tauri::command]
pub fn load_app_state(state: State<'_, AppState>) -> Result<AppSnapshot, String> {
  let conn = open_connection(&state)?;
  load_snapshot(&conn)
}

#[tauri::command]
pub fn replace_app_state(snapshot: AppSnapshot, state: State<'_, AppState>) -> Result<(), String> {
  let mut conn = open_connection(&state)?;
  replace_snapshot(&mut conn, &snapshot)
}

#[tauri::command]
pub fn import_vault_document(payload: ImportVaultDocumentPayload, state: State<'_, AppState>) -> Result<VaultDocument, String> {
  let document = vault::import_vault_document(payload, &state)?;
  let mut conn = open_connection(&state)?;
  let transaction = conn
    .transaction()
    .map_err(|error| format!("Unable to begin vault document transaction: {error}"))?;
  vault::insert_documents(&transaction, std::slice::from_ref(&document))?;
  transaction
    .commit()
    .map_err(|error| format!("Unable to commit vault document transaction: {error}"))?;
  Ok(document)
}

#[tauri::command]
pub fn delete_vault_document(document_id: String, state: State<'_, AppState>) -> Result<(), String> {
  let conn: Connection = open_connection(&state)?;
  vault::delete_vault_document(&conn, &document_id)
}

#[tauri::command]
pub fn get_desktop_paths(state: State<'_, AppState>) -> Result<DesktopPaths, String> {
  Ok(DesktopPaths {
    data_dir: state.data_dir.to_string_lossy().to_string(),
    db_path: state.db_path.to_string_lossy().to_string(),
    vault_dir: state.vault_dir.to_string_lossy().to_string(),
  })
}
