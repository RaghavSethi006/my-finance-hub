use rusqlite::{params, Connection, Transaction};

use super::models::{Asset, Loan};

pub fn load_assets(conn: &Connection) -> Result<Vec<Asset>, String> {
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

  Ok(assets)
}

pub fn insert_assets(transaction: &Transaction<'_>, assets: &[Asset]) -> Result<(), String> {
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
