use rusqlite::{Connection, Transaction};

use super::{
  assets::{insert_assets, insert_loans, load_assets, load_loans},
  finance::{
    insert_accounts, insert_budgets, insert_categories, insert_recurring_templates, insert_transactions, load_accounts,
    load_budgets, load_categories, load_recurring_templates, load_transactions,
  },
  ledger::{insert_journal_entries, load_journal_entries},
  models::AppSnapshot,
  settings::{insert_alerts, insert_settings, load_alerts, load_settings},
  vault::{insert_documents, load_documents},
};

pub fn load_snapshot(conn: &Connection) -> Result<AppSnapshot, String> {
  Ok(AppSnapshot {
    settings: load_settings(conn)?,
    accounts: load_accounts(conn)?,
    transactions: load_transactions(conn)?,
    recurring_templates: load_recurring_templates(conn)?,
    categories: load_categories(conn)?,
    budgets: load_budgets(conn)?,
    assets: load_assets(conn)?,
    loans: load_loans(conn)?,
    journal_entries: load_journal_entries(conn)?,
    documents: load_documents(conn)?,
    alerts: load_alerts(conn)?,
  })
}

pub fn replace_snapshot(conn: &mut Connection, snapshot: &AppSnapshot) -> Result<(), String> {
  let transaction = conn
    .transaction()
    .map_err(|error| format!("Unable to begin database transaction: {error}"))?;

  clear_existing_data(&transaction)?;
  insert_settings(&transaction, &snapshot.settings)?;
  insert_categories(&transaction, &snapshot.categories)?;
  insert_accounts(&transaction, &snapshot.accounts)?;
  insert_recurring_templates(&transaction, &snapshot.recurring_templates)?;
  insert_transactions(&transaction, &snapshot.transactions)?;
  insert_budgets(&transaction, &snapshot.budgets)?;
  insert_assets(&transaction, &snapshot.assets)?;
  insert_loans(&transaction, &snapshot.loans)?;
  insert_journal_entries(&transaction, &snapshot.journal_entries)?;
  insert_documents(&transaction, &snapshot.documents)?;
  insert_alerts(&transaction, &snapshot.alerts)?;

  transaction
    .commit()
    .map_err(|error| format!("Unable to commit database transaction: {error}"))?;

  Ok(())
}

fn clear_existing_data(transaction: &Transaction<'_>) -> Result<(), String> {
  transaction
    .execute_batch(
      "
      DELETE FROM document_tags;
      DELETE FROM vault_documents;
      DELETE FROM journal_entry_lines;
      DELETE FROM journal_entries;
      DELETE FROM alerts;
      DELETE FROM asset_price_history;
      DELETE FROM loans;
      DELETE FROM assets;
      DELETE FROM budgets;
      DELETE FROM transactions;
      DELETE FROM recurring_templates;
      DELETE FROM account_nominees;
      DELETE FROM accounts;
      DELETE FROM categories;
      DELETE FROM settings;
      ",
    )
    .map_err(|error| format!("Unable to clear existing data: {error}"))?;

  Ok(())
}
