use std::{fs, path::PathBuf};

use chrono::Utc;
use rusqlite::{params, Connection, Transaction};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

const SCHEMA_SQL: &str = include_str!("../../data/schema.sql");

#[derive(Clone)]
pub struct AppState {
  pub db_path: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserSettings {
  pub name: String,
  pub default_currency: String,
  pub theme: String,
  pub date_format: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
  pub id: String,
  pub name: String,
  #[serde(rename = "type")]
  pub account_type: String,
  pub balance: f64,
  pub currency: String,
  pub color: String,
  pub icon: String,
  pub created_at: String,
  pub bank_name: Option<String>,
  pub account_number: Option<String>,
  pub ifsc_code: Option<String>,
  pub branch_name: Option<String>,
  pub nominees: Option<Vec<String>>,
  pub login_url: Option<String>,
  pub notes: Option<String>,
  pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
  pub id: String,
  pub name: String,
  #[serde(rename = "type")]
  pub category_type: String,
  pub color: String,
  pub icon: String,
  pub parent_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionRecord {
  pub id: String,
  pub amount: f64,
  #[serde(rename = "type")]
  pub transaction_type: String,
  pub category_id: String,
  pub account_id: String,
  pub to_account_id: Option<String>,
  pub date: String,
  pub note: String,
  pub payment_method: String,
  pub currency: String,
  pub tax_tag: String,
  pub is_deductible: bool,
  pub is_recurring: bool,
  pub recurring_template_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Budget {
  pub id: String,
  pub category_id: String,
  pub amount: f64,
  pub currency: String,
  pub spent: f64,
  pub alert_threshold: f64,
  pub period: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Asset {
  pub id: String,
  pub name: String,
  #[serde(rename = "type")]
  pub asset_type: String,
  pub ticker: Option<String>,
  pub exchange: Option<String>,
  pub quantity: f64,
  pub buy_price: f64,
  pub current_price: f64,
  pub currency: String,
  pub purchase_date: String,
  pub notes: Option<String>,
  pub fund_house: Option<String>,
  pub nav: Option<f64>,
  pub sip_amount: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Loan {
  pub id: String,
  pub name: String,
  pub lender: String,
  #[serde(rename = "type")]
  pub loan_type: String,
  pub principal_amount: f64,
  pub outstanding_amount: f64,
  pub interest_rate: f64,
  pub emi: f64,
  pub tenure: i64,
  pub start_date: String,
  pub end_date: String,
  pub currency: String,
  pub status: String,
  pub linked_account_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JournalEntryLine {
  pub account_name: String,
  pub account_type: String,
  pub debit: f64,
  pub credit: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JournalEntry {
  pub id: String,
  pub date: String,
  pub description: String,
  pub entries: Vec<JournalEntryLine>,
  pub transaction_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultDocument {
  pub id: String,
  pub name: String,
  pub category: String,
  pub file_type: String,
  pub size: i64,
  pub tags: Vec<String>,
  pub linked_entity_id: Option<String>,
  pub linked_entity_type: Option<String>,
  pub created_at: String,
  pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Alert {
  pub id: String,
  #[serde(rename = "type")]
  pub alert_type: String,
  pub title: String,
  pub message: String,
  pub severity: String,
  pub module: String,
  pub action_label: Option<String>,
  pub action_route: Option<String>,
  pub timestamp: String,
  pub read: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSnapshot {
  pub settings: UserSettings,
  pub accounts: Vec<Account>,
  pub transactions: Vec<TransactionRecord>,
  pub categories: Vec<Category>,
  pub budgets: Vec<Budget>,
  pub assets: Vec<Asset>,
  pub loans: Vec<Loan>,
  pub journal_entries: Vec<JournalEntry>,
  pub documents: Vec<VaultDocument>,
  pub alerts: Vec<Alert>,
}

pub fn initialize_app_state(app: &AppHandle) -> Result<AppState, String> {
  let app_dir = app
    .path()
    .app_data_dir()
    .map_err(|error| format!("Unable to resolve app data directory: {error}"))?;

  fs::create_dir_all(&app_dir).map_err(|error| format!("Unable to create app data directory: {error}"))?;
  fs::create_dir_all(app_dir.join("vault")).map_err(|error| format!("Unable to create vault directory: {error}"))?;

  let db_path = app_dir.join("finance.db");
  let state = AppState { db_path };
  ensure_schema(&state)?;
  Ok(state)
}

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

fn open_connection(state: &AppState) -> Result<Connection, String> {
  ensure_schema(state)?;
  let conn = Connection::open(&state.db_path).map_err(|error| format!("Unable to open database: {error}"))?;
  conn
    .execute_batch("PRAGMA foreign_keys = ON;")
    .map_err(|error| format!("Unable to enable foreign keys: {error}"))?;
  Ok(conn)
}

fn ensure_schema(state: &AppState) -> Result<(), String> {
  let conn = Connection::open(&state.db_path).map_err(|error| format!("Unable to create database file: {error}"))?;
  conn
    .execute_batch("PRAGMA foreign_keys = ON;")
    .map_err(|error| format!("Unable to enable foreign keys: {error}"))?;
  conn
    .execute_batch(SCHEMA_SQL)
    .map_err(|error| format!("Unable to initialize schema: {error}"))?;
  Ok(())
}

fn load_snapshot(conn: &Connection) -> Result<AppSnapshot, String> {
  let settings = conn
    .query_row(
      "SELECT name, default_currency, theme, date_format FROM settings WHERE id = 1",
      [],
      |row| {
        Ok(UserSettings {
          name: row.get(0)?,
          default_currency: row.get(1)?,
          theme: row.get(2)?,
          date_format: row.get(3)?,
        })
      },
    )
    .map_err(|error| format!("Unable to load settings: {error}"))?;

  let mut accounts_stmt = conn
    .prepare(
      "SELECT id, name, type, balance, currency, color, icon, created_at, bank_name, account_number, ifsc_code, branch_name, login_url, notes, is_active
       FROM accounts
       ORDER BY created_at ASC, name ASC",
    )
    .map_err(|error| format!("Unable to prepare accounts query: {error}"))?;

  let accounts = accounts_stmt
    .query_map([], |row| {
      Ok(Account {
        id: row.get(0)?,
        name: row.get(1)?,
        account_type: row.get(2)?,
        balance: row.get(3)?,
        currency: row.get(4)?,
        color: row.get(5)?,
        icon: row.get(6)?,
        created_at: row.get(7)?,
        bank_name: row.get(8)?,
        account_number: row.get(9)?,
        ifsc_code: row.get(10)?,
        branch_name: row.get(11)?,
        nominees: None,
        login_url: row.get(12)?,
        notes: row.get(13)?,
        is_active: row.get::<_, i64>(14)? != 0,
      })
    })
    .map_err(|error| format!("Unable to load accounts: {error}"))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|error| format!("Unable to collect accounts: {error}"))?;

  let accounts = accounts
    .into_iter()
    .map(|mut account| {
      let nominees = load_nominees(conn, &account.id)?;
      if !nominees.is_empty() {
        account.nominees = Some(nominees);
      }
      Ok(account)
    })
    .collect::<Result<Vec<_>, String>>()?;

  let mut categories_stmt = conn
    .prepare("SELECT id, name, type, color, icon, parent_id FROM categories ORDER BY sort_order ASC, name ASC")
    .map_err(|error| format!("Unable to prepare categories query: {error}"))?;

  let categories = categories_stmt
    .query_map([], |row| {
      Ok(Category {
        id: row.get(0)?,
        name: row.get(1)?,
        category_type: row.get(2)?,
        color: row.get(3)?,
        icon: row.get(4)?,
        parent_id: row.get(5)?,
      })
    })
    .map_err(|error| format!("Unable to load categories: {error}"))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|error| format!("Unable to collect categories: {error}"))?;

  let mut transactions_stmt = conn
    .prepare(
      "SELECT id, amount, type, category_id, account_id, to_account_id, date, note, payment_method, currency, tax_tag, is_deductible, is_recurring, recurring_template_id
       FROM transactions
       ORDER BY date DESC, created_at DESC",
    )
    .map_err(|error| format!("Unable to prepare transactions query: {error}"))?;

  let transactions = transactions_stmt
    .query_map([], |row| {
      Ok(TransactionRecord {
        id: row.get(0)?,
        amount: row.get(1)?,
        transaction_type: row.get(2)?,
        category_id: row.get(3)?,
        account_id: row.get(4)?,
        to_account_id: row.get(5)?,
        date: row.get(6)?,
        note: row.get(7)?,
        payment_method: row.get(8)?,
        currency: row.get(9)?,
        tax_tag: row.get(10)?,
        is_deductible: row.get::<_, i64>(11)? != 0,
        is_recurring: row.get::<_, i64>(12)? != 0,
        recurring_template_id: row.get(13)?,
      })
    })
    .map_err(|error| format!("Unable to load transactions: {error}"))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|error| format!("Unable to collect transactions: {error}"))?;

  let mut budgets_stmt = conn
    .prepare("SELECT id, category_id, amount, currency, spent, alert_threshold, period FROM budgets ORDER BY created_at ASC")
    .map_err(|error| format!("Unable to prepare budgets query: {error}"))?;

  let budgets = budgets_stmt
    .query_map([], |row| {
      Ok(Budget {
        id: row.get(0)?,
        category_id: row.get(1)?,
        amount: row.get(2)?,
        currency: row.get(3)?,
        spent: row.get(4)?,
        alert_threshold: row.get(5)?,
        period: row.get(6)?,
      })
    })
    .map_err(|error| format!("Unable to load budgets: {error}"))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|error| format!("Unable to collect budgets: {error}"))?;

  let mut assets_stmt = conn
    .prepare(
      "SELECT id, name, type, ticker, exchange, quantity, buy_price, current_price, currency, purchase_date, notes, fund_house, nav, sip_amount
       FROM assets
       ORDER BY purchase_date ASC, name ASC",
    )
    .map_err(|error| format!("Unable to prepare assets query: {error}"))?;

  let assets = assets_stmt
    .query_map([], |row| {
      Ok(Asset {
        id: row.get(0)?,
        name: row.get(1)?,
        asset_type: row.get(2)?,
        ticker: row.get(3)?,
        exchange: row.get(4)?,
        quantity: row.get(5)?,
        buy_price: row.get(6)?,
        current_price: row.get(7)?,
        currency: row.get(8)?,
        purchase_date: row.get(9)?,
        notes: row.get(10)?,
        fund_house: row.get(11)?,
        nav: row.get(12)?,
        sip_amount: row.get(13)?,
      })
    })
    .map_err(|error| format!("Unable to load assets: {error}"))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|error| format!("Unable to collect assets: {error}"))?;

  let mut loans_stmt = conn
    .prepare(
      "SELECT id, name, lender, type, principal_amount, outstanding_amount, interest_rate, emi, tenure, start_date, end_date, currency, status, linked_account_id
       FROM loans
       ORDER BY start_date ASC, name ASC",
    )
    .map_err(|error| format!("Unable to prepare loans query: {error}"))?;

  let loans = loans_stmt
    .query_map([], |row| {
      Ok(Loan {
        id: row.get(0)?,
        name: row.get(1)?,
        lender: row.get(2)?,
        loan_type: row.get(3)?,
        principal_amount: row.get(4)?,
        outstanding_amount: row.get(5)?,
        interest_rate: row.get(6)?,
        emi: row.get(7)?,
        tenure: row.get(8)?,
        start_date: row.get(9)?,
        end_date: row.get(10)?,
        currency: row.get(11)?,
        status: row.get(12)?,
        linked_account_id: row.get(13)?,
      })
    })
    .map_err(|error| format!("Unable to load loans: {error}"))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|error| format!("Unable to collect loans: {error}"))?;

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

  let journal_entries = journal_entries
    .into_iter()
    .map(|mut entry| {
      entry.entries = load_journal_lines(conn, &entry.id)?;
      Ok(entry)
    })
    .collect::<Result<Vec<_>, String>>()?;

  let mut docs_stmt = conn
    .prepare(
      "SELECT id, name, category, file_type, file_size, linked_entity_id, linked_entity_type, created_at, updated_at
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
        tags: vec![],
        linked_entity_id: row.get(5)?,
        linked_entity_type: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
      })
    })
    .map_err(|error| format!("Unable to load vault documents: {error}"))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|error| format!("Unable to collect vault documents: {error}"))?;

  let documents = documents
    .into_iter()
    .map(|mut document| {
      document.tags = load_document_tags(conn, &document.id)?;
      Ok(document)
    })
    .collect::<Result<Vec<_>, String>>()?;

  let mut alerts_stmt = conn
    .prepare(
      "SELECT id, type, title, message, severity, module, action_label, action_route, is_read, created_at
       FROM alerts
       ORDER BY created_at DESC",
    )
    .map_err(|error| format!("Unable to prepare alerts query: {error}"))?;

  let alerts = alerts_stmt
    .query_map([], |row| {
      Ok(Alert {
        id: row.get(0)?,
        alert_type: row.get(1)?,
        title: row.get(2)?,
        message: row.get(3)?,
        severity: row.get(4)?,
        module: row.get(5)?,
        action_label: row.get(6)?,
        action_route: row.get(7)?,
        read: row.get::<_, i64>(8)? != 0,
        timestamp: row.get(9)?,
      })
    })
    .map_err(|error| format!("Unable to load alerts: {error}"))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|error| format!("Unable to collect alerts: {error}"))?;

  Ok(AppSnapshot {
    settings,
    accounts,
    transactions,
    categories,
    budgets,
    assets,
    loans,
    journal_entries,
    documents,
    alerts,
  })
}

fn replace_snapshot(conn: &mut Connection, snapshot: &AppSnapshot) -> Result<(), String> {
  let transaction = conn
    .transaction()
    .map_err(|error| format!("Unable to begin database transaction: {error}"))?;

  clear_existing_data(&transaction)?;
  insert_settings(&transaction, &snapshot.settings)?;
  insert_categories(&transaction, &snapshot.categories)?;
  insert_accounts(&transaction, &snapshot.accounts)?;
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
      DELETE FROM account_nominees;
      DELETE FROM accounts;
      DELETE FROM categories;
      DELETE FROM settings;
      ",
    )
    .map_err(|error| format!("Unable to clear existing data: {error}"))?;

  Ok(())
}

fn insert_settings(transaction: &Transaction<'_>, settings: &UserSettings) -> Result<(), String> {
  transaction
    .execute(
      "INSERT INTO settings (id, name, default_currency, theme, date_format) VALUES (1, ?, ?, ?, ?)",
      params![settings.name, settings.default_currency, settings.theme, settings.date_format],
    )
    .map_err(|error| format!("Unable to store settings: {error}"))?;
  Ok(())
}

fn insert_categories(transaction: &Transaction<'_>, categories: &[Category]) -> Result<(), String> {
  for (index, category) in categories.iter().enumerate() {
    transaction
      .execute(
        "INSERT INTO categories (id, name, type, color, icon, parent_id, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        params![
          category.id,
          category.name,
          category.category_type,
          category.color,
          category.icon,
          category.parent_id,
          index as i64
        ],
      )
      .map_err(|error| format!("Unable to store category {}: {error}", category.id))?;
  }
  Ok(())
}

fn insert_accounts(transaction: &Transaction<'_>, accounts: &[Account]) -> Result<(), String> {
  for account in accounts {
    transaction
      .execute(
        "INSERT INTO accounts (id, name, type, balance, currency, color, icon, bank_name, account_number, ifsc_code, branch_name, login_url, notes, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![
          account.id,
          account.name,
          account.account_type,
          account.balance,
          account.currency,
          account.color,
          account.icon,
          account.bank_name,
          account.account_number,
          account.ifsc_code,
          account.branch_name,
          account.login_url,
          account.notes,
          bool_to_int(account.is_active),
          account.created_at
        ],
      )
      .map_err(|error| format!("Unable to store account {}: {error}", account.id))?;

    if let Some(nominees) = &account.nominees {
      for nominee in nominees {
        transaction
          .execute(
            "INSERT INTO account_nominees (account_id, name) VALUES (?, ?)",
            params![account.id, nominee],
          )
          .map_err(|error| format!("Unable to store nominee for account {}: {error}", account.id))?;
      }
    }
  }
  Ok(())
}

fn insert_transactions(transaction: &Transaction<'_>, transactions: &[TransactionRecord]) -> Result<(), String> {
  for record in transactions {
    transaction
      .execute(
        "INSERT INTO transactions (id, amount, type, category_id, account_id, to_account_id, date, note, payment_method, currency, tax_tag, is_deductible, is_recurring, recurring_template_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![
          record.id,
          record.amount,
          record.transaction_type,
          record.category_id,
          record.account_id,
          record.to_account_id,
          record.date,
          record.note,
          record.payment_method,
          record.currency,
          record.tax_tag,
          bool_to_int(record.is_deductible),
          bool_to_int(record.is_recurring),
          record.recurring_template_id
        ],
      )
      .map_err(|error| format!("Unable to store transaction {}: {error}", record.id))?;
  }
  Ok(())
}

fn insert_budgets(transaction: &Transaction<'_>, budgets: &[Budget]) -> Result<(), String> {
  for budget in budgets {
    transaction
      .execute(
        "INSERT INTO budgets (id, category_id, amount, currency, spent, alert_threshold, period)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
        params![
          budget.id,
          budget.category_id,
          budget.amount,
          budget.currency,
          budget.spent,
          budget.alert_threshold,
          budget.period
        ],
      )
      .map_err(|error| format!("Unable to store budget {}: {error}", budget.id))?;
  }
  Ok(())
}

fn insert_assets(transaction: &Transaction<'_>, assets: &[Asset]) -> Result<(), String> {
  for asset in assets {
    transaction
      .execute(
        "INSERT INTO assets (id, name, type, ticker, exchange, quantity, buy_price, current_price, currency, purchase_date, notes, fund_house, nav, sip_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![
          asset.id,
          asset.name,
          asset.asset_type,
          asset.ticker,
          asset.exchange,
          asset.quantity,
          asset.buy_price,
          asset.current_price,
          asset.currency,
          asset.purchase_date,
          asset.notes,
          asset.fund_house,
          asset.nav,
          asset.sip_amount
        ],
      )
      .map_err(|error| format!("Unable to store asset {}: {error}", asset.id))?;
  }
  Ok(())
}

fn insert_loans(transaction: &Transaction<'_>, loans: &[Loan]) -> Result<(), String> {
  for loan in loans {
    transaction
      .execute(
        "INSERT INTO loans (id, name, lender, type, principal_amount, outstanding_amount, interest_rate, emi, tenure, start_date, end_date, currency, status, linked_account_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![
          loan.id,
          loan.name,
          loan.lender,
          loan.loan_type,
          loan.principal_amount,
          loan.outstanding_amount,
          loan.interest_rate,
          loan.emi,
          loan.tenure,
          loan.start_date,
          loan.end_date,
          loan.currency,
          loan.status,
          loan.linked_account_id
        ],
      )
      .map_err(|error| format!("Unable to store loan {}: {error}", loan.id))?;
  }
  Ok(())
}

fn insert_journal_entries(transaction: &Transaction<'_>, journal_entries: &[JournalEntry]) -> Result<(), String> {
  for entry in journal_entries {
    transaction
      .execute(
        "INSERT INTO journal_entries (id, date, description, transaction_id, created_at) VALUES (?, ?, ?, ?, ?)",
        params![
          entry.id,
          entry.date,
          entry.description,
          entry.transaction_id,
          now_timestamp()
        ],
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

fn insert_documents(transaction: &Transaction<'_>, documents: &[VaultDocument]) -> Result<(), String> {
  for document in documents {
    transaction
      .execute(
        "INSERT INTO vault_documents (id, name, category, file_type, file_size, linked_entity_id, linked_entity_type, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![
          document.id,
          document.name,
          document.category,
          document.file_type,
          document.size,
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

fn insert_alerts(transaction: &Transaction<'_>, alerts: &[Alert]) -> Result<(), String> {
  for alert in alerts {
    transaction
      .execute(
        "INSERT INTO alerts (id, type, title, message, severity, module, action_label, action_route, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![
          alert.id,
          alert.alert_type,
          alert.title,
          alert.message,
          alert.severity,
          alert.module,
          alert.action_label,
          alert.action_route,
          bool_to_int(alert.read),
          alert.timestamp
        ],
      )
      .map_err(|error| format!("Unable to store alert {}: {error}", alert.id))?;
  }
  Ok(())
}

fn load_nominees(conn: &Connection, account_id: &str) -> Result<Vec<String>, String> {
  let mut stmt = conn
    .prepare("SELECT name FROM account_nominees WHERE account_id = ? ORDER BY id ASC")
    .map_err(|error| format!("Unable to prepare account nominees query: {error}"))?;

  let nominees = stmt
    .query_map([account_id], |row| row.get(0))
    .map_err(|error| format!("Unable to query nominees for account {account_id}: {error}"))?
    .collect::<Result<Vec<String>, _>>()
    .map_err(|error| format!("Unable to collect nominees for account {account_id}: {error}"))?;

  Ok(nominees)
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

fn bool_to_int(value: bool) -> i64 {
  if value {
    1
  } else {
    0
  }
}

fn now_timestamp() -> String {
  Utc::now().to_rfc3339()
}
