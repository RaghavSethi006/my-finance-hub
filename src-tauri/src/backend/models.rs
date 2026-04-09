use serde::{Deserialize, Serialize};

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
pub struct RecurringTemplate {
  pub id: String,
  pub amount: f64,
  #[serde(rename = "type")]
  pub template_type: String,
  pub category_id: String,
  pub account_id: String,
  pub to_account_id: Option<String>,
  pub note: String,
  pub payment_method: String,
  pub currency: String,
  pub tax_tag: String,
  pub is_deductible: bool,
  pub frequency: String,
  pub next_date: String,
  pub is_paused: bool,
  pub created_at: String,
  pub updated_at: String,
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
  pub file_path: Option<String>,
  pub tags: Vec<String>,
  pub linked_entity_id: Option<String>,
  pub linked_entity_type: Option<String>,
  pub created_at: String,
  pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportVaultDocumentPayload {
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
  pub bytes: Vec<u8>,
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
pub struct DesktopPaths {
  pub data_dir: String,
  pub db_path: String,
  pub vault_dir: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSnapshot {
  pub settings: UserSettings,
  pub accounts: Vec<Account>,
  pub transactions: Vec<TransactionRecord>,
  pub recurring_templates: Vec<RecurringTemplate>,
  pub categories: Vec<Category>,
  pub budgets: Vec<Budget>,
  pub assets: Vec<Asset>,
  pub loans: Vec<Loan>,
  pub journal_entries: Vec<JournalEntry>,
  pub documents: Vec<VaultDocument>,
  pub alerts: Vec<Alert>,
}
