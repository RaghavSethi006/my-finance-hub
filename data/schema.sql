-- =============================================
-- FinOS Database Schema
-- SQLite / Tauri backend
-- Version: 1.0.0
-- =============================================

-- App settings (single row)
CREATE TABLE IF NOT EXISTS settings (
    id            INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    name          TEXT    NOT NULL DEFAULT 'User',
    default_currency TEXT NOT NULL DEFAULT 'USD',
    theme         TEXT    NOT NULL DEFAULT 'dark' CHECK (theme IN ('light', 'dark', 'system')),
    date_format   TEXT    NOT NULL DEFAULT 'MM/dd/yyyy',
    app_pin_hash  TEXT,              -- PBKDF2 hash of app lock PIN
    vault_password_hash TEXT,        -- PBKDF2 hash of vault master password
    vault_salt    TEXT,              -- 16-byte hex salt for vault key derivation
    auto_lock_timeout INTEGER DEFAULT 600,  -- seconds
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Financial accounts
CREATE TABLE IF NOT EXISTS accounts (
    id              TEXT    PRIMARY KEY,
    name            TEXT    NOT NULL,
    type            TEXT    NOT NULL CHECK (type IN ('cash', 'bank', 'credit_card', 'investment', 'crypto')),
    balance         REAL    NOT NULL DEFAULT 0,
    currency        TEXT    NOT NULL DEFAULT 'USD',
    color           TEXT    NOT NULL DEFAULT '#3b82f6',
    icon            TEXT    NOT NULL DEFAULT 'wallet',
    bank_name       TEXT,
    account_number  TEXT,             -- masked: ****1234
    ifsc_code       TEXT,
    branch_name     TEXT,
    login_url       TEXT,
    notes           TEXT,
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Account nominees (many-to-one)
CREATE TABLE IF NOT EXISTS account_nominees (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id  TEXT    NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name        TEXT    NOT NULL,
    relationship TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_nominees_account ON account_nominees(account_id);

-- Transaction categories
CREATE TABLE IF NOT EXISTS categories (
    id        TEXT    PRIMARY KEY,
    name      TEXT    NOT NULL,
    type      TEXT    NOT NULL CHECK (type IN ('income', 'expense')),
    color     TEXT    NOT NULL DEFAULT '#6b7280',
    icon      TEXT    NOT NULL DEFAULT 'tag',
    parent_id TEXT    REFERENCES categories(id) ON DELETE SET NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT   NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(type);

-- Financial transactions
CREATE TABLE IF NOT EXISTS transactions (
    id                    TEXT    PRIMARY KEY,
    amount                REAL    NOT NULL,
    type                  TEXT    NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
    category_id           TEXT    NOT NULL REFERENCES categories(id),
    account_id            TEXT    NOT NULL REFERENCES accounts(id),
    to_account_id         TEXT    REFERENCES accounts(id),
    date                  TEXT    NOT NULL,
    note                  TEXT    NOT NULL DEFAULT '',
    payment_method        TEXT    NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'upi', 'netbanking', 'crypto')),
    currency              TEXT    NOT NULL DEFAULT 'USD',
    tax_tag               TEXT    NOT NULL DEFAULT 'untagged' CHECK (tax_tag IN ('business', 'personal', 'untagged')),
    is_deductible         INTEGER NOT NULL DEFAULT 0,
    is_recurring          INTEGER NOT NULL DEFAULT 0,
    recurring_template_id TEXT    REFERENCES recurring_templates(id) ON DELETE SET NULL,
    created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);

-- Recurring transaction templates
CREATE TABLE IF NOT EXISTS recurring_templates (
    id              TEXT    PRIMARY KEY,
    amount          REAL    NOT NULL,
    type            TEXT    NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
    category_id     TEXT    NOT NULL REFERENCES categories(id),
    account_id      TEXT    NOT NULL REFERENCES accounts(id),
    to_account_id   TEXT    REFERENCES accounts(id),
    note            TEXT    NOT NULL DEFAULT '',
    payment_method  TEXT    NOT NULL DEFAULT 'cash',
    currency        TEXT    NOT NULL DEFAULT 'USD',
    tax_tag         TEXT    NOT NULL DEFAULT 'untagged',
    is_deductible   INTEGER NOT NULL DEFAULT 0,
    frequency       TEXT    NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
    next_date       TEXT    NOT NULL,
    is_paused       INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Monthly budgets
CREATE TABLE IF NOT EXISTS budgets (
    id              TEXT    PRIMARY KEY,
    category_id     TEXT    NOT NULL REFERENCES categories(id),
    amount          REAL    NOT NULL,
    currency        TEXT    NOT NULL DEFAULT 'USD',
    spent           REAL    NOT NULL DEFAULT 0,
    alert_threshold REAL    NOT NULL DEFAULT 80,  -- percentage
    period          TEXT    NOT NULL DEFAULT 'monthly',
    month           TEXT,   -- e.g., '2025-04' for monthly tracking
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_budgets_category ON budgets(category_id);

-- Assets & investments
CREATE TABLE IF NOT EXISTS assets (
    id              TEXT    PRIMARY KEY,
    name            TEXT    NOT NULL,
    type            TEXT    NOT NULL CHECK (type IN ('stock', 'mutual_fund', 'crypto', 'real_estate', 'vehicle', 'gold', 'other')),
    ticker          TEXT,
    exchange        TEXT,
    quantity        REAL    NOT NULL DEFAULT 0,
    buy_price       REAL    NOT NULL DEFAULT 0,
    current_price   REAL    NOT NULL DEFAULT 0,
    currency        TEXT    NOT NULL DEFAULT 'USD',
    purchase_date   TEXT    NOT NULL,
    notes           TEXT,
    -- Mutual fund specific
    fund_house      TEXT,
    nav             REAL,
    sip_amount      REAL,
    annual_depreciation_rate REAL,
    useful_life_years REAL,
    salvage_value   REAL,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);

-- Asset price history (for mini charts)
CREATE TABLE IF NOT EXISTS asset_price_history (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id  TEXT    NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    price     REAL    NOT NULL,
    date      TEXT    NOT NULL,
    source    TEXT,
    note      TEXT,
    external_id TEXT,
    UNIQUE(asset_id, date)
);

CREATE INDEX IF NOT EXISTS idx_price_history_asset ON asset_price_history(asset_id, date);

-- Loans & liabilities
CREATE TABLE IF NOT EXISTS loans (
    id                  TEXT    PRIMARY KEY,
    name                TEXT    NOT NULL,
    lender              TEXT    NOT NULL,
    type                TEXT    NOT NULL CHECK (type IN ('home', 'car', 'personal', 'education', 'business', 'credit_card', 'other')),
    principal_amount    REAL    NOT NULL,
    outstanding_amount  REAL    NOT NULL,
    interest_rate       REAL    NOT NULL,
    emi                 REAL    NOT NULL DEFAULT 0,
    tenure              INTEGER NOT NULL DEFAULT 0,  -- months
    start_date          TEXT    NOT NULL,
    end_date            TEXT    NOT NULL,
    currency            TEXT    NOT NULL DEFAULT 'USD',
    status              TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paid_off', 'defaulted')),
    linked_account_id   TEXT    REFERENCES accounts(id) ON DELETE SET NULL,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Double-entry journal entries
CREATE TABLE IF NOT EXISTS journal_entries (
    id              TEXT    PRIMARY KEY,
    date            TEXT    NOT NULL,
    description     TEXT    NOT NULL DEFAULT '',
    transaction_id  TEXT    REFERENCES transactions(id) ON DELETE SET NULL,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(date DESC);

-- Journal entry line items (debit/credit)
CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    journal_entry_id TEXT   NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_name    TEXT    NOT NULL,
    account_type    TEXT    NOT NULL CHECK (account_type IN ('asset', 'liability', 'income', 'expense', 'equity')),
    debit           REAL    NOT NULL DEFAULT 0,
    credit          REAL    NOT NULL DEFAULT 0,
    sort_order      INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_entry_lines(journal_entry_id);

-- Secure vault document metadata (file content stored as encrypted blobs on disk)
CREATE TABLE IF NOT EXISTS vault_documents (
    id                  TEXT    PRIMARY KEY,
    name                TEXT    NOT NULL,
    category            TEXT    NOT NULL DEFAULT 'other' CHECK (category IN ('banking', 'tax', 'legal', 'personal', 'other')),
    file_type           TEXT    NOT NULL,
    file_size           INTEGER NOT NULL DEFAULT 0,
    file_path           TEXT,   -- path to encrypted blob on disk (UUID-named)
    linked_entity_id    TEXT,
    linked_entity_type  TEXT    CHECK (linked_entity_type IN ('transaction', 'account', 'asset')),
    created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Document tags (many-to-many)
CREATE TABLE IF NOT EXISTS document_tags (
    document_id TEXT NOT NULL REFERENCES vault_documents(id) ON DELETE CASCADE,
    tag         TEXT NOT NULL,
    PRIMARY KEY (document_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_doc_tags_doc ON document_tags(document_id);

-- Alerts & notifications
CREATE TABLE IF NOT EXISTS alerts (
    id           TEXT    PRIMARY KEY,
    type         TEXT    NOT NULL,
    title        TEXT    NOT NULL,
    message      TEXT    NOT NULL DEFAULT '',
    severity     TEXT    NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'success', 'error')),
    module       TEXT    NOT NULL DEFAULT 'finance',
    action_label TEXT,
    action_route TEXT,
    is_read      INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_alerts_read ON alerts(is_read);

-- =============================================
-- Views for common queries
-- =============================================

-- Account balance summary
CREATE VIEW IF NOT EXISTS v_account_summary AS
SELECT
    a.id,
    a.name,
    a.type,
    a.currency,
    a.balance,
    a.bank_name,
    a.is_active,
    COUNT(t.id) AS transaction_count,
    MAX(t.date) AS last_transaction_date
FROM accounts a
LEFT JOIN transactions t ON t.account_id = a.id
GROUP BY a.id;

-- Monthly spending summary
CREATE VIEW IF NOT EXISTS v_monthly_spending AS
SELECT
    strftime('%Y-%m', t.date) AS month,
    t.type,
    c.name AS category_name,
    SUM(t.amount) AS total_amount,
    COUNT(t.id) AS transaction_count
FROM transactions t
JOIN categories c ON c.id = t.category_id
GROUP BY month, t.type, c.name
ORDER BY month DESC;

-- Net worth components
CREATE VIEW IF NOT EXISTS v_net_worth AS
SELECT
    (SELECT COALESCE(SUM(balance), 0) FROM accounts WHERE is_active = 1) AS account_balance,
    (SELECT COALESCE(SUM(current_price * quantity), 0) FROM assets) AS asset_value,
    (SELECT COALESCE(SUM(outstanding_amount), 0) FROM loans WHERE status = 'active') AS loan_outstanding,
    (SELECT COALESCE(SUM(balance), 0) FROM accounts WHERE is_active = 1)
        + (SELECT COALESCE(SUM(current_price * quantity), 0) FROM assets)
        - (SELECT COALESCE(SUM(outstanding_amount), 0) FROM loans WHERE status = 'active') AS net_worth;

-- Trial balance
CREATE VIEW IF NOT EXISTS v_trial_balance AS
SELECT
    jl.account_name,
    jl.account_type,
    SUM(jl.debit) AS total_debit,
    SUM(jl.credit) AS total_credit,
    SUM(jl.debit) - SUM(jl.credit) AS net_balance
FROM journal_entry_lines jl
JOIN journal_entries je ON je.id = jl.journal_entry_id
GROUP BY jl.account_name, jl.account_type;

-- =============================================
-- Triggers
-- =============================================

-- Auto-update updated_at on accounts
CREATE TRIGGER IF NOT EXISTS trg_accounts_updated
AFTER UPDATE ON accounts
BEGIN
    UPDATE accounts SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Auto-update updated_at on transactions
CREATE TRIGGER IF NOT EXISTS trg_transactions_updated
AFTER UPDATE ON transactions
BEGIN
    UPDATE transactions SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Auto-update updated_at on assets
CREATE TRIGGER IF NOT EXISTS trg_assets_updated
AFTER UPDATE ON assets
BEGIN
    UPDATE assets SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Auto-update updated_at on loans
CREATE TRIGGER IF NOT EXISTS trg_loans_updated
AFTER UPDATE ON loans
BEGIN
    UPDATE loans SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- =============================================
-- Seed default categories
-- =============================================
INSERT OR IGNORE INTO categories (id, name, type, color, icon, sort_order) VALUES
    ('cat-1', 'Food & Dining', 'expense', '#f59e0b', 'utensils', 1),
    ('cat-2', 'Rent', 'expense', '#3b82f6', 'home', 2),
    ('cat-3', 'Transport', 'expense', '#06b6d4', 'car', 3),
    ('cat-4', 'Entertainment', 'expense', '#8b5cf6', 'gamepad-2', 4),
    ('cat-5', 'Health', 'expense', '#ef4444', 'heart-pulse', 5),
    ('cat-6', 'Shopping', 'expense', '#ec4899', 'shopping-bag', 6),
    ('cat-7', 'Utilities', 'expense', '#eab308', 'zap', 7),
    ('cat-8', 'Salary', 'income', '#22c55e', 'banknote', 8),
    ('cat-9', 'Freelance', 'income', '#3b82f6', 'laptop', 9),
    ('cat-10', 'Investment Returns', 'income', '#8b5cf6', 'trending-up', 10),
    ('cat-11', 'Education', 'expense', '#3b82f6', 'graduation-cap', 11),
    ('cat-12', 'Subscriptions', 'expense', '#14b8a6', 'repeat', 12),
    ('cat-13', 'Insurance', 'expense', '#0ea5e9', 'shield', 13),
    ('cat-14', 'Loan EMI', 'expense', '#ef4444', 'landmark', 14);

-- Initialize settings row
INSERT OR IGNORE INTO settings (id) VALUES (1);
