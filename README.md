# Aurum

> A local-first, privacy-first Private Wealth Operating System for your entire financial life.
> Built with React, Tauri, SQLite, and shadcn/ui.

---

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![Stack](https://img.shields.io/badge/stack-React%20%2B%20Tauri%20%2B%20SQLite-orange)
![License](https://img.shields.io/badge/license-CCO-green)

</div>

---

## What Is Aurum?

Aurum is a desktop application that gives you complete visibility and control over your financial life — without sending a single byte to the cloud. Everything runs locally on your machine. Your data stays yours.

It is not a simple expense tracker. Aurum is a full Private Wealth Operating System combining five modules into one unified interface:

- **Finance Tracker** — transactions, budgets, accounts, recurring payments
- **Accounting Engine** — double-entry ledger, income statements, balance sheets
- **Asset & Investment Tracker** — stocks, crypto, real estate, portfolio performance
- **Secure Document Vault** — AES-256 encrypted storage for all financial documents
- **Tax Assistant** — deduction tagging, tax estimates, accountant-ready PDF reports

All five modules share one SQLite database, one design system, and one unified dashboard.

---

## Why Local-First?

Every major finance app — Mint, YNAB, Personal Capital, Quicken — requires you to hand over your most sensitive data to a third party. Aurum takes the opposite approach.

- **No account required** — open the app and start using it
- **No internet required** — works completely offline
- **No subscriptions** — one install, yours forever
- **No ads, no tracking, no telemetry** — nothing leaves your device
- **Your data survives the company** — no risk of shutdown, acquisition, or data breach

---

## Modules

---

### 1. Finance Tracker

The foundation of Aurum. Track every rupee in and out across all your accounts.

#### Transactions
- Add income, expenses, and transfers between accounts
- Fields: amount, category, date, note, payment method (Cash / Card / UPI / Netbanking), account
- Edit and delete any transaction
- Transactions grouped by date with relative labels (Today, Yesterday, Mar 15)
- Quick-add bar via `Cmd+K` — type `"spent 450 on food today"` to log instantly

#### Accounts
- Multiple account types: Cash, Bank Account, Credit Card, Investment, Crypto
- Each account tracks its own balance and full transaction history
- Transfers between accounts update both balances atomically
- Color-coded account cards with balance share indicator
- Total balance across all accounts shown on the dashboard

#### Categories
- 15 default categories: Food & Dining, Rent, Transport, Entertainment, Health, Shopping, Utilities, Education, Travel, Professional Dev, Salary, Freelance, Business, Investment Returns, Other Income
- Create custom categories with name, color, and icon
- Subcategory support (e.g. Food → Groceries, Eating Out)

#### Budgets
- Set monthly spending limits per category
- Live progress bar — color shifts green → amber → red as you approach the limit
- Configurable alert threshold (default 80%)
- Budget summary card on the dashboard: "3 of 5 budgets on track"
- Days remaining in the current period shown per budget card

#### Alerts & Notifications
- Budget exceeded alerts via toast notification
- Unusual spending spike — flagged when a category exceeds 3× your daily average
- Low balance warning per account (configurable threshold)
- All alerts surfaced in the unified dashboard alerts feed

#### Recurring Transactions
- Mark any transaction as recurring: Daily / Weekly / Monthly
- Auto-created on app launch for any due recurring entries
- Toast confirmation: "3 recurring transactions added"
- Manage all recurring templates: view, pause, edit, delete
- Next due date shown per template

#### Search & Filters
- Full-text search across transaction notes
- Filter by: date range, category, account, type, payment method
- Sort by: date (default), amount, category
- All filters combinable and persistent within the session

---

### 2. Accounting Engine (Aurum Ledger)

Turns raw transaction data into real financial understanding. Built on double-entry accounting principles.

#### Double-Entry Ledger
- Every transaction internally creates two ledger entries (debit + credit)
- Account types follow standard accounting: Assets, Liabilities, Income, Expenses, Equity
- General ledger view: full list of every entry with debit/credit columns
- Live accounting check: total debits = total credits always verified
- Filter by account type, date range, or description
- Paginated — 50 entries per page

#### Income Statement
- Periods: This Month / Last Month / This Quarter / This Year / Custom range
- Shows all income by category, all expenses by category, and net profit/loss
- Collapsible income and expense sections
- Savings rate: `(net profit / total income) × 100`
- Color-coded: income green, expenses red
- One-click PDF export

#### Balance Sheet
- Point-in-time snapshot of what you own vs what you owe
- Assets: liquid (cash + bank), investments, physical assets
- Liabilities: credit card balances
- Net worth = total assets − total liabilities
- Month-over-month change badge below the net worth figure

#### Net Worth Tracker
- 12-month history — stacked area chart of assets vs liabilities over time
- Breakdown cards: Liquid / Investments / Physical Assets / Liabilities
- Each card shows amount and % of total
- Smart Y-axis: ₹45K, ₹2.5L, ₹1.2Cr

#### Tax Tagging
- Tag every transaction: Business or Personal
- Mark as deductible or non-deductible
- Auto-saves on change — no submit button needed
- Bulk select and tag multiple transactions at once
- Progress: "180 / 340 transactions tagged"
- Smart suggestions for categories like Professional Dev, Business Travel
- Filter to show only untagged transactions

---

### 3. Asset & Investment Tracker (Aurum Assets)

Track everything you own beyond cash. See your complete portfolio in one place.

#### Portfolio Dashboard
- Total portfolio value at current prices
- Total invested (cost basis)
- Overall profit/loss — absolute ₹ and percentage
- Asset allocation donut chart: Stocks / Crypto / Real Estate / Vehicles / Gold / Other
- Portfolio growth area chart over time
- All assets in a master table with P&L per row

#### Stocks & Mutual Funds
- Track by ticker, exchange (NSE / BSE / NASDAQ / NYSE), quantity, average buy price
- Manual price updates
- Columns: Ticker · Name · Qty · Avg Buy · Current · Invested · Value · P&L · P&L%
- P&L color-coded: green fill for profit, red fill for loss
- Click any row to open a full detail sheet
- CSV import: paste a Zerodha / Groww export to bulk-import your portfolio

#### Crypto
- Track by coin — top 20 supported (Bitcoin, Ethereum, and more)
- Live price refresh from CoinGecko (free, no API key)
- 24h change indicator per coin
- Auto-refresh on app focus

#### Physical Assets
- Types: Real Estate, Vehicle, Gold, Jewellery, Electronics, Other
- Manual current value updates
- Depreciation calculator: enter % per year, app suggests current value based on age
- Card grid layout with purchase price → current value and profit/depreciation
- Link vault documents directly to assets

#### Asset Detail Sheet
- Full asset info in a slide-in panel
- Mini price history chart from purchase date to today
- Log current value button for manual history tracking
- Linked vault documents shown and navigable
- Edit and delete controls

#### Net Worth Integration
- Asset values flow automatically into the Accounting Engine's balance sheet
- Portfolio summary exported and consumed by the unified dashboard
- All asset values included in top-level net worth calculation

---

### 4. Secure Document Vault (Aurum Vault)

An encrypted, organized, locally-stored cabinet for every important financial document.

#### Encryption
- **AES-256-GCM** encryption on every file before it touches disk
- Master password → key derived via **PBKDF2** (100,000 iterations, SHA-256)
- Encryption key in memory only — never written to disk or SQLite
- Random 16-byte salt on first setup — stored in config, not the key
- Random 12-byte IV per file — prepended to the encrypted blob
- All file I/O goes through Tauri's Rust backend — React never touches the filesystem
- Wrong password = files are mathematically inaccessible, not just hidden

#### Lock Screen
- Vault locked by default on every app launch
- First launch: create and confirm master password (min 8 characters)
- Returning: enter password → key derived → vault unlocked
- Wrong password: animated shake + error
- After 5 failed attempts: 30-second cooldown with live countdown
- Auto-lock after configurable idle timeout (default 10 minutes)

#### Document Storage
- Upload any file: PDF, JPG, PNG, DOCX, and more
- Files encrypted and saved to app data directory as UUID-named blobs
- Only metadata in SQLite (name, category, date, linked entity) — never file content
- Original filename preserved in metadata

#### Categories
- Banking — bank statements, passbooks, NEFT receipts
- Tax — ITR filings, Form 16, TDS certificates, AIS reports
- Legal — property papers, sale agreements, wills, power of attorney
- Personal — Aadhaar, PAN, passport, insurance policies
- Other

#### Document Views
- Grid view: card per document with file type icon, name, category badge, date
- List view: sortable table
- Toggle between views — preference saved between sessions
- Category filter tabs with document count badges

#### Smart Linking
- Attach any document to a transaction, account, or asset
- Linked entity shown on the document card and detail sheet
- Cross-navigation: click the link to jump directly to that item

#### Search
- Fuzzy search via Fuse.js across names, tags, categories
- Typo-tolerant: "hdfc statmnt" still finds "HDFC Statement March 2025"
- Instant results as you type

#### Document Detail Sheet
- Inline PDF preview without decrypting to disk
- Inline image preview for JPG/PNG
- Edit name, category, and tags inline
- Download: decrypts and saves to chosen location via system dialog
- Delete with confirmation — removes both the encrypted file and metadata

#### Security Settings
- Change master password: re-encrypts all vault files with the new key
- Progress bar during re-encryption
- Auto-lock timeout configuration
- Storage info: document count + total vault size
- Export encrypted backup: all blobs + metadata JSON in a zip
  Backup is only decryptable with your master password

---

### 5. Tax Assistant (Aurum Finance — Phase 2)

Understand your tax position and prepare for filing without a CA for the basics.

#### Tax Summary Dashboard
- Gross income across all sources for the selected financial year
- Standard deduction (₹75,000 new regime) applied automatically
- Total deductible business expenses from tagged transactions
- Estimated taxable income and tax amount
- Tax slab breakdown table: slab · rate · income in slab · tax from slab
- Financial year selector: FY 2024-25 / FY 2023-24 / FY 2022-23

#### Indian Tax Regime (FY 2024-25, New Regime)
| Income Slab | Tax Rate |
|---|---|
| ₹0 – ₹3,00,000 | 0% |
| ₹3,00,001 – ₹6,00,000 | 5% |
| ₹6,00,001 – ₹9,00,000 | 10% |
| ₹9,00,001 – ₹12,00,000 | 15% |
| ₹12,00,001 – ₹15,00,000 | 20% |
| Above ₹15,00,000 | 30% |

#### Smart Deduction Suggestions
- Rule-based engine scans transaction categories
- Flags: Professional Dev, Business Travel, Internet, Home Office, Courses, Software Subscriptions (if business-tagged)
- Inline suggestion on transaction rows
- One-click to tag as deductible from the suggestion

#### PDF Tax Report (3 pages)
- Page 1: Income summary by source
- Page 2: All deductible expenses itemized (date, description, category, amount)
- Page 3: Full tax calculation with slab breakdown and effective rate
- Footer disclaimer: "Estimate only. Consult a CA before filing."
- Saves via Tauri system dialog to user's chosen location

#### AI Insights Engine (Rule-Based, Fully Offline)
- Weekend spending pattern detection
- Category spike alerts (20%+ increase vs last month)
- Top expense summary
- Savings rate warning (below 20%)
- Unusual single expense detection (3× daily average)
- Subscription tracker: detects and totals recurring subscriptions
- Tax opportunity detection: business expenses not tagged as deductible

#### Forecast Engine
- Daily spending rate from current month data
- Projected total and savings by end of month
- "Safe to spend today" to stay on budget
- Mini comparison chart: actual vs projected

#### Natural Language Input
- Type in plain English: `"spent 450 on food today"` or `"received 80000 salary on 1st march"`
- Regex + keyword parser — no LLM, no API, works offline
- Parsed preview before confirmation
- Graceful fallback with example prompts if parsing fails
- Input history of last 10 entries

---

### 6. Unified Private Wealth OS (main)

The integrated app combining all five modules into one experience.

#### Unified Dashboard
- Time-aware greeting: "Good morning / afternoon / evening, [name]"
- Four top-level cards: Net Worth · This Month · Portfolio · Tax Estimate
- Spending trend chart: 6 months of income vs expenses (Recharts LineChart)
- Asset allocation donut (Recharts PieChart)
- Unified alerts feed from all five modules
- Recent transactions: last 5 across all accounts

#### Cross-Module Intelligence
The OS surfaces insights that no single module could generate alone:
- **Tax opportunity**: business expenses not tagged as deductible → nudge with amount
- **Asset documentation gap**: assets with no linked vault documents → nudge to vault
- **Budget warning**: any budget over its alert threshold → navigate to budgets
- **Net worth milestone**: net worth grew 5%+ this month → success alert
- **Unlinked tax documents**: vault tax docs not linked to any transaction
- **Overdue recurring**: recurring templates past their next_date
- Every alert has a one-click action navigating to the right screen

#### Global Command Palette (`Cmd+K`)
One shortcut to do anything:
- Quick Add: Add Expense · Add Income · Add Asset · Upload Document
- Navigate: jump to any page instantly by name
- Search: transactions and documents with results inline
- Actions: Lock App · Lock Vault · Export Tax Report · Refresh Crypto Prices
- Fuzzy matching across all groups as you type

#### App Lock (PIN)
- 4-6 digit PIN set on first launch
- PIN stored as PBKDF2 hash — never plaintext
- Lock screen on every cold launch
- Auto-lock after configurable idle timeout
- Separate from vault master password — two independent security layers
- 5 failed attempts → 60-second lockout with countdown

#### Onboarding (First Launch)
1. Welcome
2. Name + base currency
3. App PIN setup
4. Vault master password setup
5. Add first account (optional)
6. Dashboard tour

#### Settings
- **General**: name, base currency, date format, theme (light / dark / system)
- **Security**: change PIN, change vault password, auto-lock timeout
- **Data**: export JSON, export CSV per table, import from JSON backup, storage info
- **Danger zone**: clear transactions, full reset with type-to-confirm

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 18 + TypeScript |
| Desktop Shell | Tauri v2 (Rust) |
| Database | SQLite via `tauri-plugin-sql` |
| UI Components | shadcn/ui |
| Styling | Tailwind CSS |
| State Management | Zustand |
| Charts | Recharts |
| Forms | React Hook Form + Zod |
| Encryption | Web Crypto API (AES-256-GCM + PBKDF2) |
| Fuzzy Search | Fuse.js |
| PDF Generation | @react-pdf/renderer |
| Date Utilities | date-fns |
| CSV Parsing | PapaParse |
| Live Prices | CoinGecko API (free, no key) |
| Icons | lucide-react |

---

## Architecture

### Monorepo Branch Structure

```
Aurum/
├── main      ← Integrated Private Wealth OS
├── core      ← Shared DB, models, queries, utilities
├── finance   ← Finance Tracker + Tax Assistant
├── ledger    ← Accounting Engine
├── assets    ← Asset & Investment Tracker
└── vault     ← Secure Document Vault
```

Each branch is a standalone shippable app. The `main` branch integrates all five via PRs.

### Shared Data Layer

All apps share one SQLite database through a common `core/` package. Every model is defined once and imported everywhere — no schema drift between modules.

```
core/src/
├── db/       — async DB client (tauri-plugin-sql singleton)
├── models/   — TypeScript types: Account, Transaction, Category, Asset, Document, Budget
├── queries/  — async query functions for every model
└── utils/    — currency, dates, encryption, IDs, net worth calculations
```

### Database Schema

```
accounts             — cash, bank, credit card, investment, crypto
categories           — 15 defaults + custom, income and expense types
transactions         — every financial event with full metadata + tax tags
assets               — stocks, crypto, real estate, vehicles, gold
documents            — vault metadata only (never file content)
budgets              — per-category spending limits with alert thresholds
recurring_templates  — templates for auto-recurring transactions
```

### Why All Apps Share One DB

All Tauri apps use `"identifier": "com.aurum.app"` in `tauri.conf.json`. Tauri derives the app data directory from this identifier — same identifier across all apps means the same directory, and therefore the same `finance.db` file. Data entered in the Finance Tracker is immediately visible in the Ledger and Vice versa, with no sync required.

### Encryption Architecture

```
User password
     ↓  PBKDF2 (100,000 iterations, SHA-256, random 16-byte salt)
AES-256-GCM CryptoKey  ←  lives in memory only, never stored
     ↓
Per file: random 12-byte IV  →  AES-GCM encrypt(file buffer, key, iv)
     ↓
[IV 12 bytes][Encrypted blob]  →  saved as ~/.../vault/{uuid}
     ↓
Metadata (name, category, path, tags)  →  SQLite only
```

---

## Installation

### Prerequisites

- Node.js 20+
- Rust — install from [rustup.rs](https://rustup.rs)
- Tauri CLI: `cargo install tauri-cli`

### Run

```bash
git clone https://github.com/yourusername/Aurum.git
cd Aurum && git checkout main
cd apps/aurum
npm install
npm run tauri dev
```

### Build

```bash
npm run tauri build
# Installer output: apps/aurum/src-tauri/target/release/bundle/
```

### Running Individual Modules

```bash
git checkout finance && cd apps/finance-tracker && npm run tauri dev
git checkout ledger  && cd apps/ledger           && npm run tauri dev
git checkout assets  && cd apps/assets           && npm run tauri dev
git checkout vault   && cd apps/vault            && npm run tauri dev
```

All modules share the same database — data entered in one is visible in all.

---

## Data & Privacy

| What | Answer |
|---|---|
| Network requests | Zero (except optional CoinGecko crypto refresh) |
| Telemetry | None |
| Account required | No |
| Data location | Your machine only |
| Database path (macOS) | `~/Library/Application Support/com.aurum.app/` |
| Vault path (macOS) | `~/Library/Application Support/com.aurum.app/vault/` |
| Export | Full JSON or CSV export any time via Settings |

---

## Roadmap

- [ ] Multi-currency support with live exchange rates
- [ ] Financial goals tracker ("Save ₹1L in 3 months")
- [ ] Timeline view of spending (GitHub-style activity heatmap)
- [ ] Biometric lock (fingerprint / Face ID via Tauri plugin)
- [ ] Encrypted cloud backup (user-provided S3 / Google Drive key)
- [ ] Local LLM integration via Ollama for natural language queries across all data
- [ ] Import from Zerodha Console, Groww, CAMS for automatic portfolio sync
- [ ] GST tracking for freelancers and small businesses
- [ ] Mobile companion app (same SQLite schema, React Native)

---

## License

MIT — do whatever you want with it.
