use std::{fs, path::PathBuf};

use rusqlite::{params, Connection, OptionalExtension, Transaction};

use super::{
  models::{ImportVaultDocumentPayload, VaultDocument},
  storage::AppState,
};

pub fn import_vault_document(payload: ImportVaultDocumentPayload, state: &AppState) -> Result<VaultDocument, String> {
  let extension = payload.file_type.trim().trim_start_matches('.').to_lowercase();
  let file_name = if extension.is_empty() {
    payload.id.clone()
  } else {
    format!("{}.{}", payload.id, extension)
  };
  let file_path = state.vault_dir.join(file_name);

  fs::write(&file_path, &payload.bytes).map_err(|error| format!("Unable to store vault file: {error}"))?;

  Ok(VaultDocument {
    id: payload.id,
    name: payload.name,
    category: payload.category,
    file_type: payload.file_type,
    size: payload.size,
    file_path: Some(file_path.to_string_lossy().to_string()),
    tags: payload.tags,
    linked_entity_id: payload.linked_entity_id,
    linked_entity_type: payload.linked_entity_type,
    created_at: payload.created_at,
    updated_at: payload.updated_at,
  })
}

pub fn delete_vault_document(conn: &Connection, document_id: &str) -> Result<(), String> {
  let file_path: Option<String> = conn
    .query_row(
      "SELECT file_path FROM vault_documents WHERE id = ?",
      [document_id],
      |row| row.get(0),
    )
    .optional()
    .map_err(|error| format!("Unable to lookup vault document: {error}"))?;

  conn
    .execute("DELETE FROM vault_documents WHERE id = ?", [document_id])
    .map_err(|error| format!("Unable to delete vault document metadata: {error}"))?;

  if let Some(file_path) = file_path {
    let path = PathBuf::from(file_path);
    if path.exists() {
      fs::remove_file(path).map_err(|error| format!("Unable to delete vault file: {error}"))?;
    }
  }

  Ok(())
}

pub fn read_vault_document(conn: &Connection, document_id: &str) -> Result<Vec<u8>, String> {
  let file_path: String = conn
    .query_row(
      "SELECT file_path FROM vault_documents WHERE id = ?",
      [document_id],
      |row| row.get(0),
    )
    .map_err(|error| format!("Unable to lookup vault document: {error}"))?;

  fs::read(&file_path).map_err(|error| format!("Unable to read vault file: {error}"))
}

pub fn load_documents(conn: &Connection) -> Result<Vec<VaultDocument>, String> {
  let mut docs_stmt = conn
    .prepare(
      "SELECT id, name, category, file_type, file_size, file_path, linked_entity_id, linked_entity_type, created_at, updated_at
       FROM vault_documents
       ORDER BY created_at DESC",
    )
    .map_err(|error| format!("Unable to prepare vault documents query: {error}"))?;

  let documents = docs_stmt
    .query_map([], |row| {
      Ok(VaultDocument {
        id: row.get(0)?,
        name: row.get(1)?,
        category: row.get(2)?,
        file_type: row.get(3)?,
        size: row.get(4)?,
        file_path: row.get(5)?,
        tags: vec![],
        linked_entity_id: row.get(6)?,
        linked_entity_type: row.get(7)?,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
      })
    })
    .map_err(|error| format!("Unable to load vault documents: {error}"))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|error| format!("Unable to collect vault documents: {error}"))?;

  documents
    .into_iter()
    .map(|mut document| {
      document.tags = load_document_tags(conn, &document.id)?;
      Ok(document)
    })
    .collect::<Result<Vec<_>, String>>()
}

pub fn insert_documents(transaction: &Transaction<'_>, documents: &[VaultDocument]) -> Result<(), String> {
  for document in documents {
    transaction
      .execute(
        "INSERT INTO vault_documents (id, name, category, file_type, file_size, file_path, linked_entity_id, linked_entity_type, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![
          document.id,
          document.name,
          document.category,
          document.file_type,
          document.size,
          document.file_path,
          document.linked_entity_id,
          document.linked_entity_type,
          document.created_at,
          document.updated_at
        ],
      )
      .map_err(|error| format!("Unable to store document {}: {error}", document.id))?;

    for tag in &document.tags {
      transaction
        .execute(
          "INSERT INTO document_tags (document_id, tag) VALUES (?, ?)",
          params![document.id, tag],
        )
        .map_err(|error| format!("Unable to store tag for document {}: {error}", document.id))?;
    }
  }
  Ok(())
}

fn load_document_tags(conn: &Connection, document_id: &str) -> Result<Vec<String>, String> {
  let mut stmt = conn
    .prepare("SELECT tag FROM document_tags WHERE document_id = ? ORDER BY tag ASC")
    .map_err(|error| format!("Unable to prepare document tags query: {error}"))?;

  let tags = stmt
    .query_map([document_id], |row| row.get(0))
    .map_err(|error| format!("Unable to query tags for document {document_id}: {error}"))?
    .collect::<Result<Vec<String>, _>>()
    .map_err(|error| format!("Unable to collect tags for document {document_id}: {error}"))?;

  Ok(tags)
}
