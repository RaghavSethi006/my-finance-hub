export type Currency = 'USD' | 'CAD' | 'INR' | 'GBP' | 'EUR' | 'JPY' | 'CNY' | 'AED' | 'KWD';

export const CURRENCY_CONFIG: Record<Currency, { symbol: string; name: string; locale: string }> = {
  USD: { symbol: '$', name: 'US Dollar', locale: 'en-US' },
  CAD: { symbol: 'C$', name: 'Canadian Dollar', locale: 'en-CA' },
  INR: { symbol: '\u20B9', name: 'Indian Rupee', locale: 'en-IN' },
  GBP: { symbol: '\u00A3', name: 'British Pound', locale: 'en-GB' },
  EUR: { symbol: '\u20AC', name: 'Euro', locale: 'de-DE' },
  JPY: { symbol: '\u00A5', name: 'Japanese Yen', locale: 'ja-JP' },
  CNY: { symbol: '\u00A5', name: 'Chinese Yuan', locale: 'zh-CN' },
  AED: { symbol: '\u062F.\u0625', name: 'UAE Dirham', locale: 'ar-AE' },
  KWD: { symbol: '\u062F.\u0643', name: 'Kuwaiti Dinar', locale: 'ar-KW' },
};

export type AccountType = 'cash' | 'bank' | 'credit_card' | 'investment' | 'crypto';
export type TransactionType = 'income' | 'expense' | 'transfer';
export type PaymentMethod = 'cash' | 'card' | 'upi' | 'netbanking' | 'crypto';
export type AssetType = 'stock' | 'mutual_fund' | 'crypto' | 'real_estate' | 'vehicle' | 'gold' | 'other';
export type DocumentCategory = 'banking' | 'tax' | 'legal' | 'personal' | 'other';
export type TaxTag = 'business' | 'personal' | 'untagged';
export type LoanStatus = 'active' | 'paid_off' | 'defaulted';
export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: Currency;
  color: string;
  icon: string;
  createdAt: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  branchName?: string;
  nominees?: string[];
  loginUrl?: string;
  notes?: string;
  isActive: boolean;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon: string;
  parentId?: string;
}

export interface Transaction {
  id: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  accountId: string;
  toAccountId?: string;
  date: string;
  note: string;
  paymentMethod: PaymentMethod;
  currency: Currency;
  taxTag: TaxTag;
  isDeductible: boolean;
  isRecurring: boolean;
  recurringTemplateId?: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  amount: number;
  currency: Currency;
  spent: number;
  alertThreshold: number;
  period: 'monthly';
}

export interface RecurringTemplate {
  id: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  accountId: string;
  toAccountId?: string;
  note: string;
  paymentMethod: PaymentMethod;
  currency: Currency;
  taxTag: TaxTag;
  isDeductible: boolean;
  frequency: RecurringFrequency;
  nextDate: string;
  isPaused: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AssetValueLog {
  id: string;
  date: string;
  timestamp?: string;
  price: number;
  note?: string;
  source: 'manual' | 'import' | 'system';
}

export interface AssetPriceSyncUpdate {
  assetId: string;
  price: number;
  note?: string;
  syncedAt: string;
}

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  ticker?: string;
  exchange?: string;
  quantity: number;
  buyPrice: number;
  currentPrice: number;
  currency: Currency;
  purchaseDate: string;
  notes?: string;
  fundHouse?: string;
  nav?: number;
  sipAmount?: number;
  valueLogs?: AssetValueLog[];
  annualDepreciationRate?: number;
  usefulLifeYears?: number;
  salvageValue?: number;
}

export interface Loan {
  id: string;
  name: string;
  lender: string;
  type: 'home' | 'car' | 'personal' | 'education' | 'business' | 'credit_card' | 'other';
  principalAmount: number;
  outstandingAmount: number;
  interestRate: number;
  emi: number;
  tenure: number;
  startDate: string;
  endDate: string;
  currency: Currency;
  status: LoanStatus;
  linkedAccountId?: string;
}

export interface JournalEntryLine {
  accountName: string;
  accountType: 'asset' | 'liability' | 'income' | 'expense' | 'equity';
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: string;
  date: string;
  description: string;
  entries: JournalEntryLine[];
  transactionId?: string;
}

export interface VaultDocument {
  id: string;
  name: string;
  category: DocumentCategory;
  fileType: string;
  size: number;
  filePath?: string;
  tags: string[];
  linkedEntityId?: string;
  linkedEntityType?: 'transaction' | 'account' | 'asset';
  createdAt: string;
  updatedAt: string;
}

export interface Alert {
  id: string;
  type: 'budget' | 'spending_spike' | 'low_balance' | 'tax_opportunity' | 'milestone' | 'asset_gap' | 'overdue_recurring';
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'success' | 'error';
  module: 'finance' | 'ledger' | 'assets' | 'vault' | 'tax';
  actionLabel?: string;
  actionRoute?: string;
  timestamp: string;
  read: boolean;
}

export interface UserSettings {
  name: string;
  defaultCurrency: Currency;
  theme: 'light' | 'dark' | 'system';
  dateFormat: string;
}

export interface DesktopSnapshot {
  settings: UserSettings;
  accounts: Account[];
  transactions: Transaction[];
  recurringTemplates: RecurringTemplate[];
  categories: Category[];
  budgets: Budget[];
  assets: Asset[];
  loans: Loan[];
  journalEntries: JournalEntry[];
  documents: VaultDocument[];
  alerts: Alert[];
}

export interface DesktopPaths {
  dataDir: string;
  dbPath: string;
  vaultDir: string;
}

export interface DesktopSecurityStatus {
  hasAppPin: boolean;
  hasVaultPassword: boolean;
  isAppLocked: boolean;
  isVaultLocked: boolean;
  autoLockTimeoutSeconds: number;
  appCooldownRemainingSeconds: number;
  vaultCooldownRemainingSeconds: number;
  appFailedAttempts: number;
  vaultFailedAttempts: number;
}
