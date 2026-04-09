use rusqlite::{params, Connection, Transaction};

use super::{
  models::{Account, Budget, Category, RecurringTemplate, TransactionRecord},
  storage::bool_to_int,
};

pub fn load_accounts(conn: &Connection) -> Result<Vec<Account>, String> {
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

  accounts
    .into_iter()
    .map(|mut account| {
      let nominees = load_nominees(conn, &account.id)?;
      if !nominees.is_empty() {
        account.nominees = Some(nominees);
      }
      Ok(account)
    })
    .collect::<Result<Vec<_>, String>>()
}

pub fn insert_accounts(transaction: &Transaction<'_>, accounts: &[Account]) -> Result<(), String> {
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

pub fn load_categories(conn: &Connection) -> Result<Vec<Category>, String> {
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

  Ok(categories)
}

pub fn insert_categories(transaction: &Transaction<'_>, categories: &[Category]) -> Result<(), String> {
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

pub fn load_transactions(conn: &Connection) -> Result<Vec<TransactionRecord>, String> {
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

  Ok(transactions)
}

pub fn insert_transactions(transaction: &Transaction<'_>, transactions: &[TransactionRecord]) -> Result<(), String> {
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

pub fn load_recurring_templates(conn: &Connection) -> Result<Vec<RecurringTemplate>, String> {
  let mut recurring_stmt = conn
    .prepare(
      "SELECT id, amount, type, category_id, account_id, to_account_id, note, payment_method, currency, tax_tag, is_deductible, frequency, next_date, is_paused, created_at, updated_at
       FROM recurring_templates
       ORDER BY next_date ASC, created_at ASC",
    )
    .map_err(|error| format!("Unable to prepare recurring templates query: {error}"))?;

  let recurring_templates = recurring_stmt
    .query_map([], |row| {
      Ok(RecurringTemplate {
        id: row.get(0)?,
        amount: row.get(1)?,
        template_type: row.get(2)?,
        category_id: row.get(3)?,
        account_id: row.get(4)?,
        to_account_id: row.get(5)?,
        note: row.get(6)?,
        payment_method: row.get(7)?,
        currency: row.get(8)?,
        tax_tag: row.get(9)?,
        is_deductible: row.get::<_, i64>(10)? != 0,
        frequency: row.get(11)?,
        next_date: row.get(12)?,
        is_paused: row.get::<_, i64>(13)? != 0,
        created_at: row.get(14)?,
        updated_at: row.get(15)?,
      })
    })
    .map_err(|error| format!("Unable to load recurring templates: {error}"))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|error| format!("Unable to collect recurring templates: {error}"))?;

  Ok(recurring_templates)
}

pub fn insert_recurring_templates(transaction: &Transaction<'_>, recurring_templates: &[RecurringTemplate]) -> Result<(), String> {
  for template in recurring_templates {
    transaction
      .execute(
        "INSERT INTO recurring_templates (id, amount, type, category_id, account_id, to_account_id, note, payment_method, currency, tax_tag, is_deductible, frequency, next_date, is_paused, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![
          template.id,
          template.amount,
          template.template_type,
          template.category_id,
          template.account_id,
          template.to_account_id,
          template.note,
          template.payment_method,
          template.currency,
          template.tax_tag,
          bool_to_int(template.is_deductible),
          template.frequency,
          template.next_date,
          bool_to_int(template.is_paused),
          template.created_at,
          template.updated_at
        ],
      )
      .map_err(|error| format!("Unable to store recurring template {}: {error}", template.id))?;
  }
  Ok(())
}

pub fn load_budgets(conn: &Connection) -> Result<Vec<Budget>, String> {
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

  Ok(budgets)
}

pub fn insert_budgets(transaction: &Transaction<'_>, budgets: &[Budget]) -> Result<(), String> {
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
