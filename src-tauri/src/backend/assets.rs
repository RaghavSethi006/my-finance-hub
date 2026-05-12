use rusqlite::{params, Connection, Transaction};

use super::models::{Asset, AssetValueLog, Loan};

pub fn load_assets(conn: &Connection) -> Result<Vec<Asset>, String> {
  let mut assets_stmt = conn
    .prepare(
      "SELECT id, name, type, ticker, exchange, quantity, buy_price, current_price, currency, purchase_date, notes, fund_house, nav, sip_amount, annual_depreciation_rate, useful_life_years, salvage_value
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
        value_logs: None,
        annual_depreciation_rate: row.get(14)?,
        useful_life_years: row.get(15)?,
        salvage_value: row.get(16)?,
      })
    })
    .map_err(|error| format!("Unable to load assets: {error}"))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|error| format!("Unable to collect assets: {error}"))?;

  assets
    .into_iter()
    .map(|mut asset| {
      let value_logs = load_asset_value_logs(conn, &asset.id)?;
      if !value_logs.is_empty() {
        asset.value_logs = Some(value_logs);
      }
      Ok(asset)
    })
    .collect::<Result<Vec<_>, String>>()
}

pub fn insert_assets(transaction: &Transaction<'_>, assets: &[Asset]) -> Result<(), String> {
  for asset in assets {
    transaction
      .execute(
        "INSERT INTO assets (id, name, type, ticker, exchange, quantity, buy_price, current_price, currency, purchase_date, notes, fund_house, nav, sip_amount, annual_depreciation_rate, useful_life_years, salvage_value)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
          asset.sip_amount,
          asset.annual_depreciation_rate,
          asset.useful_life_years,
          asset.salvage_value
        ],
      )
      .map_err(|error| format!("Unable to store asset {}: {error}", asset.id))?;

    if let Some(value_logs) = &asset.value_logs {
      for value_log in value_logs {
        transaction
          .execute(
            "INSERT INTO asset_price_history (asset_id, price, date, source, note, external_id)
             VALUES (?, ?, ?, ?, ?, ?)",
            params![
              asset.id,
              value_log.price,
              value_log.date,
              value_log.source,
              value_log.note,
              value_log.id
            ],
          )
          .map_err(|error| format!("Unable to store asset price history for {}: {error}", asset.id))?;
      }
    }
  }
  Ok(())
}

pub fn load_loans(conn: &Connection) -> Result<Vec<Loan>, String> {
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

  Ok(loans)
}

pub fn insert_loans(transaction: &Transaction<'_>, loans: &[Loan]) -> Result<(), String> {
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

fn load_asset_value_logs(conn: &Connection, asset_id: &str) -> Result<Vec<AssetValueLog>, String> {
  let mut stmt = conn
    .prepare(
      "SELECT id, external_id, date, price, note, source
       FROM asset_price_history
       WHERE asset_id = ?
       ORDER BY date ASC, id ASC",
    )
    .map_err(|error| format!("Unable to prepare asset price history query: {error}"))?;

  let rows = stmt
    .query_map([asset_id], |row| {
      let row_id: i64 = row.get(0)?;
      let external_id: Option<String> = row.get(1)?;
      let date: String = row.get(2)?;
      Ok(AssetValueLog {
        id: external_id.unwrap_or_else(|| format!("{asset_id}-{date}-{row_id}")),
        date,
        price: row.get(3)?,
        note: row.get(4)?,
        source: row.get::<_, Option<String>>(5)?.unwrap_or_else(|| String::from("system")),
      })
    })
    .map_err(|error| format!("Unable to query asset price history for {asset_id}: {error}"))?;

  rows
    .collect::<Result<Vec<_>, _>>()
    .map_err(|error| format!("Unable to collect asset price history for {asset_id}: {error}"))
}
