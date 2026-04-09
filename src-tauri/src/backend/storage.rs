use std::{
  env,
  fs,
  path::{Path, PathBuf},
};

use chrono::Utc;
use rusqlite::Connection;
use tauri::{AppHandle, Manager};

pub const SCHEMA_SQL: &str = include_str!("../../../data/schema.sql");

#[derive(Clone)]
pub struct AppState {
  pub data_dir: PathBuf,
  pub db_path: PathBuf,
  pub vault_dir: PathBuf,
}

pub fn initialize_app_state(app: &AppHandle) -> Result<AppState, String> {
  let data_dir = resolve_data_dir(app)?;
  fs::create_dir_all(&data_dir).map_err(|error| format!("Unable to create data directory: {error}"))?;

  migrate_legacy_data(app, &data_dir)?;

  let vault_dir = data_dir.join("vault");
  fs::create_dir_all(&vault_dir).map_err(|error| format!("Unable to create vault directory: {error}"))?;

  let db_path = data_dir.join("finance.db");
  let state = AppState {
    data_dir,
    db_path,
    vault_dir,
  };

  ensure_schema(&state)?;
  Ok(state)
}

pub fn open_connection(state: &AppState) -> Result<Connection, String> {
  ensure_schema(state)?;
  let conn = Connection::open(&state.db_path).map_err(|error| format!("Unable to open database: {error}"))?;
  conn
    .execute_batch("PRAGMA foreign_keys = ON;")
    .map_err(|error| format!("Unable to enable foreign keys: {error}"))?;
  Ok(conn)
}

pub fn ensure_schema(state: &AppState) -> Result<(), String> {
  let conn = Connection::open(&state.db_path).map_err(|error| format!("Unable to create database file: {error}"))?;
  conn
    .execute_batch("PRAGMA foreign_keys = ON;")
    .map_err(|error| format!("Unable to enable foreign keys: {error}"))?;
  conn
    .execute_batch(SCHEMA_SQL)
    .map_err(|error| format!("Unable to initialize schema: {error}"))?;
  Ok(())
}

pub fn bool_to_int(value: bool) -> i64 {
  if value { 1 } else { 0 }
}

pub fn now_timestamp() -> String {
  Utc::now().to_rfc3339()
}

fn resolve_data_dir(_app: &AppHandle) -> Result<PathBuf, String> {
  if cfg!(debug_assertions) {
    let src_tauri_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let project_root = src_tauri_dir
      .parent()
      .ok_or_else(|| String::from("Unable to resolve project root for development data"))?;
    return Ok(project_root.join("app-data"));
  }

  let exe_path = env::current_exe().map_err(|error| format!("Unable to resolve current executable: {error}"))?;
  let exe_dir = exe_path
    .parent()
    .ok_or_else(|| String::from("Unable to resolve executable directory"))?;
  Ok(exe_dir.join("data"))
}

fn migrate_legacy_data(app: &AppHandle, data_dir: &Path) -> Result<(), String> {
  let legacy_dir = app
    .path()
    .app_data_dir()
    .map_err(|error| format!("Unable to resolve legacy app data directory: {error}"))?;

  if legacy_dir == data_dir || !legacy_dir.exists() {
    return Ok(());
  }

  let legacy_db = legacy_dir.join("finance.db");
  let new_db = data_dir.join("finance.db");
  if legacy_db.exists() && !new_db.exists() {
    fs::copy(&legacy_db, &new_db).map_err(|error| format!("Unable to migrate legacy database: {error}"))?;
  }

  let legacy_vault = legacy_dir.join("vault");
  let new_vault = data_dir.join("vault");
  if legacy_vault.exists() && !new_vault.exists() {
    copy_directory(&legacy_vault, &new_vault)?;
  }

  Ok(())
}

fn copy_directory(source: &Path, destination: &Path) -> Result<(), String> {
  fs::create_dir_all(destination).map_err(|error| format!("Unable to create migrated directory: {error}"))?;

  for entry in fs::read_dir(source).map_err(|error| format!("Unable to read directory for migration: {error}"))? {
    let entry = entry.map_err(|error| format!("Unable to inspect migrated entry: {error}"))?;
    let source_path = entry.path();
    let destination_path = destination.join(entry.file_name());

    if source_path.is_dir() {
      copy_directory(&source_path, &destination_path)?;
    } else {
      fs::copy(&source_path, &destination_path)
        .map_err(|error| format!("Unable to copy migrated file {}: {error}", source_path.display()))?;
    }
  }

  Ok(())
}
