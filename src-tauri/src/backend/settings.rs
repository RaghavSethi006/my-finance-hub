use rusqlite::{params, Connection, Transaction};

use super::{models::{Alert, UserSettings}, storage::bool_to_int};

pub fn load_settings(conn: &Connection) -> Result<UserSettings, String> {
  conn
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
    .map_err(|error| format!("Unable to load settings: {error}"))
}

pub fn insert_settings(transaction: &Transaction<'_>, settings: &UserSettings) -> Result<(), String> {
  transaction
    .execute(
      "INSERT INTO settings (id, name, default_currency, theme, date_format)
       VALUES (1, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         default_currency = excluded.default_currency,
         theme = excluded.theme,
         date_format = excluded.date_format,
         updated_at = datetime('now')",
      params![settings.name, settings.default_currency, settings.theme, settings.date_format],
    )
    .map_err(|error| format!("Unable to store settings: {error}"))?;
  Ok(())
}

pub fn load_alerts(conn: &Connection) -> Result<Vec<Alert>, String> {
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

  Ok(alerts)
}

pub fn insert_alerts(transaction: &Transaction<'_>, alerts: &[Alert]) -> Result<(), String> {
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
