export type Currency = 'USD' | 'CAD' | 'INR' | 'GBP' | 'EUR' | 'JPY' | 'CNY' | 'AED' | 'KWD';

export const CURRENCY_CONFIG: Record<Currency, { symbol: string; name: string; locale: string }> = {
  USD: { symbol: '$', name: 'US Dollar', locale: 'en-US' },
  CAD: { symbol: 'C$', name: 'Canadian Dollar', locale: 'en-CA' },
  INR: { symbol: '₹', name: 'Indian Rupee', locale: 'en-IN' },
  GBP: { symbol: '£', name: 'British Pound', locale: 'en-GB' },
  EUR: { symbol: '€', name: 'Euro', locale: 'de-DE' },
  JPY: { symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP' },
  CNY: { symbol: '¥', name: 'Chinese Yuan', locale: 'zh-CN' },
  AED: { symbol: 'د.إ', name: 'UAE Dirham', locale: 'ar-AE' },
  KWD: { symbol: 'د.ك', name: 'Kuwaiti Dinar', locale: 'ar-KW' },
};

export type AccountType = 'cash' | 'bank' | 'credit_card' | 'investment' | 'crypto';
export type TransactionType = 'income' | 'expense' | 'transfer';
export type PaymentMethod = 'cash' | 'card' | 'upi' | 'netbanking' | 'crypto';
export type AssetType = 'stock' | 'mutual_fund' | 'crypto' | 'real_estate' | 'vehicle' | 'gold' | 'other';
export type DocumentCategory = 'banking' | 'tax' | 'legal' | 'personal' | 'other';
export type TaxTag = 'business' | 'personal' | 'untagged';
export type LoanStatus = 'active' | 'paid_off' | 'defaulted';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: Currency;
  color: string;
  icon: string;
  createdAt: string;
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
  // Mutual fund specific
  fundHouse?: string;
  nav?: number;
  sipAmount?: number;
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
  tenure: number; // months
  startDate: string;
  endDate: string;
  currency: Currency;
  status: LoanStatus;
  linkedAccountId?: string;
}

export interface JournalEntry {
  id: string;
  date: string;
  description: string;
  entries: {
    accountName: string;
    accountType: 'asset' | 'liability' | 'income' | 'expense' | 'equity';
    debit: number;
    credit: number;
  }[];
  transactionId?: string;
}

export interface VaultDocument {
  id: string;
  name: string;
  category: DocumentCategory;
  fileType: string;
  size: number;
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
