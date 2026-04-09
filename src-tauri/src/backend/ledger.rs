use rusqlite::{params, Connection, Transaction};

use super::{
  models::{JournalEntry, JournalEntryLine},
  storage::now_timestamp,
};

pub fn load_journal_entries(conn: &Connection) -> Result<Vec<JournalEntry>, String> {
  let mut journal_stmt = conn
    .prepare(
      "SELECT id, date, description, transaction_id
       FROM journal_entries
       ORDER BY date DESC, created_at DESC",
    )
    .map_err(|error| format!("Unable to prepare journal query: {error}"))?;

  let journal_entries = journal_stmt
    .query_map([], |row| {
      Ok(JournalEntry {
        id: row.get(0)?,
        date: row.get(1)?,
        description: row.get(2)?,
        entries: vec![],
        transaction_id: row.get(3)?,
      })
    })
    .map_err(|error| format!("Unable to load journal entries: {error}"))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|error| format!("Unable to collect journal entries: {error}"))?;

  journal_entries
    .into_iter()
    .map(|mut entry| {
      entry.entries = load_journal_lines(conn, &entry.id)?;
      Ok(entry)
    })
    .collect::<Result<Vec<_>, String>>()
}

pub fn insert_journal_entries(transaction: &Transaction<'_>, journal_entries: &[JournalEntry]) -> Result<(), String> {
  for entry in journal_entries {
    transaction
      .execute(
        "INSERT INTO journal_entries (id, date, description, transaction_id, created_at) VALUES (?, ?, ?, ?, ?)",
        params![entry.id, entry.date, entry.description, entry.transaction_id, now_timestamp()],
      )
      .map_err(|error| format!("Unable to store journal entry {}: {error}", entry.id))?;

    for (index, line) in entry.entries.iter().enumerate() {
      transaction
        .execute(
          "INSERT INTO journal_entry_lines (journal_entry_id, account_name, account_type, debit, credit, sort_order)
           VALUES (?, ?, ?, ?, ?, ?)",
          params![entry.id, line.account_name, line.account_type, line.debit, line.credit, index as i64],
        )
        .map_err(|error| format!("Unable to store journal entry line for {}: {error}", entry.id))?;
    }
  }
  Ok(())
}

fn load_journal_lines(conn: &Connection, journal_entry_id: &str) -> Result<Vec<JournalEntryLine>, String> {
  let mut stmt = conn
    .prepare(
      "SELECT account_name, account_type, debit, credit
       FROM journal_entry_lines
       WHERE journal_entry_id = ?
       ORDER BY sort_order ASC, id ASC",
    )
    .map_err(|error| format!("Unable to prepare journal entry lines query: {error}"))?;

  let lines = stmt
    .query_map([journal_entry_id], |row| {
      Ok(JournalEntryLine {
        account_name: row.get(0)?,
        account_type: row.get(1)?,
        debit: row.get(2)?,
        credit: row.get(3)?,
      })
    })
    .map_err(|error| format!("Unable to query journal lines for {journal_entry_id}: {error}"))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|error| format!("Unable to collect journal lines for {journal_entry_id}: {error}"))?;

  Ok(lines)
}
