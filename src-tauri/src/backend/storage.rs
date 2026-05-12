use std::{
  env,
  fs,
  path::{Path, PathBuf},
  sync::{Arc, Mutex},
};

use chrono::Utc;
use rusqlite::{Connection, OptionalExtension};
use tauri::{AppHandle, Manager};

pub const SCHEMA_SQL: &str = include_str!("../../../data/schema.sql");

#[derive(Clone)]
pub struct AppState {
  pub data_dir: PathBuf,
  pub db_path: PathBuf,
  pub vault_dir: PathBuf,
  pub security: Arc<Mutex<RuntimeSecurityState>>,
}

#[derive(Debug, Default)]
pub struct RuntimeSecurityState {
  pub app_locked: bool,
  pub vault_locked: bool,
  pub last_activity_at: i64,
  pub app_failed_attempts: u32,
  pub vault_failed_attempts: u32,
  pub app_lockout_until: Option<i64>,
  pub vault_lockout_until: Option<i64>,
  pub vault_key: Option<[u8; 32]>,
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
    security: Arc::new(Mutex::new(RuntimeSecurityState::default())),
  };

  ensure_schema(&state)?;
  initialize_runtime_security(&state)?;
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
  ensure_runtime_schema(&conn)?;
  Ok(())
}

pub fn bool_to_int(value: bool) -> i64 {
  if value { 1 } else { 0 }
}

pub fn now_timestamp() -> String {
  Utc::now().to_rfc3339()
}

pub fn now_unix_timestamp() -> i64 {
  Utc::now().timestamp()
}

fn resolve_data_dir(_app: &AppHandle) -> Result<PathBuf, String> {
  if cfg!(debug_assertions) {
    let src_tauri_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let project_root = src_tauri_dir
      .parent()
      .ok_or_else(|| String::from("Unable to resolve project root for development data"))?;
    return Ok(project_root.join("data"));
  }

  let exe_path = env::current_exe().map_err(|error| format!("Unable to resolve current executable: {error}"))?;
  let exe_dir = exe_path
    .parent()
    .ok_or_else(|| String::from("Unable to resolve executable directory"))?;
  Ok(exe_dir.join("data"))
}

fn migrate_legacy_data(app: &AppHandle, data_dir: &Path) -> Result<(), String> {
  let legacy_app_dir = app
    .path()
    .app_data_dir()
    .map_err(|error| format!("Unable to resolve legacy app data directory: {error}"))?;

  let mut legacy_dirs = Vec::new();
  if legacy_app_dir != data_dir {
    legacy_dirs.push(legacy_app_dir);
  }

  let src_tauri_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
  if let Some(project_root) = src_tauri_dir.parent() {
    let legacy_project_dir = project_root.join("app-data");
    if legacy_project_dir != data_dir {
      legacy_dirs.push(legacy_project_dir);
    }
  }

  let new_db = data_dir.join("finance.db");
  let new_vault = data_dir.join("vault");

  for legacy_dir in legacy_dirs {
    if !legacy_dir.exists() {
      continue;
    }

    let legacy_db = legacy_dir.join("finance.db");
    if legacy_db.exists() && !new_db.exists() {
      fs::copy(&legacy_db, &new_db).map_err(|error| format!("Unable to migrate legacy database: {error}"))?;
    }

    let legacy_vault = legacy_dir.join("vault");
    if legacy_vault.exists() && !new_vault.exists() {
      copy_directory(&legacy_vault, &new_vault)?;
    }
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

fn initialize_runtime_security(state: &AppState) -> Result<(), String> {
  let conn = Connection::open(&state.db_path).map_err(|error| format!("Unable to open database: {error}"))?;
  let row = conn
    .query_row(
      "SELECT app_pin_hash, vault_password_hash FROM settings WHERE id = 1",
      [],
      |record| {
        Ok((
          record.get::<_, Option<String>>(0)?,
          record.get::<_, Option<String>>(1)?,
        ))
      },
    )
    .optional()
    .map_err(|error| format!("Unable to load security settings: {error}"))?;

  let (app_pin_hash, vault_password_hash) = row.unwrap_or((None, None));
  let mut security = state
    .security
    .lock()
    .map_err(|_| String::from("Unable to initialize security runtime"))?;
  security.app_locked = app_pin_hash.is_some();
  security.vault_locked = vault_password_hash.is_some();
  security.last_activity_at = now_unix_timestamp();
  security.vault_key = None;
  Ok(())
}

fn ensure_runtime_schema(conn: &Connection) -> Result<(), String> {
  ensure_column(conn, "assets", "annual_depreciation_rate", "ALTER TABLE assets ADD COLUMN annual_depreciation_rate REAL")?;
  ensure_column(conn, "assets", "useful_life_years", "ALTER TABLE assets ADD COLUMN useful_life_years REAL")?;
  ensure_column(conn, "assets", "salvage_value", "ALTER TABLE assets ADD COLUMN salvage_value REAL")?;
  ensure_column(conn, "asset_price_history", "source", "ALTER TABLE asset_price_history ADD COLUMN source TEXT")?;
  ensure_column(conn, "asset_price_history", "note", "ALTER TABLE asset_price_history ADD COLUMN note TEXT")?;
  ensure_column(conn, "asset_price_history", "external_id", "ALTER TABLE asset_price_history ADD COLUMN external_id TEXT")?;
  Ok(())
}

fn ensure_column(conn: &Connection, table: &str, column: &str, statement: &str) -> Result<(), String> {
  let mut stmt = conn
    .prepare(&format!("PRAGMA table_info({table})"))
    .map_err(|error| format!("Unable to inspect {table} columns: {error}"))?;
  let existing = stmt
    .query_map([], |row| row.get::<_, String>(1))
    .map_err(|error| format!("Unable to query {table} columns: {error}"))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|error| format!("Unable to collect {table} columns: {error}"))?;

  if existing.iter().any(|name| name == column) {
    return Ok(());
  }

  conn
    .execute(statement, [])
    .map_err(|error| format!("Unable to migrate {table}.{column}: {error}"))?;
  Ok(())
}
