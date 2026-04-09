import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Account, Transaction, Category, Budget, Asset, VaultDocument, Alert, UserSettings, Loan, JournalEntry } from './types';
import { sampleAccounts, sampleTransactions, sampleCategories, sampleBudgets, sampleAssets, sampleDocuments, sampleAlerts, sampleLoans, sampleJournalEntries } from './sample-data';

interface FinOSState {
  settings: UserSettings;
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  assets: Asset[];
  loans: Loan[];
  journalEntries: JournalEntry[];
  documents: VaultDocument[];
  alerts: Alert[];
  isVaultLocked: boolean;

  // Computed
  totalBalance: () => number;
  netWorth: () => number;
  totalPortfolioValue: () => number;
  totalPortfolioCost: () => number;
  totalLoanOutstanding: () => number;
  monthlyIncome: () => number;
  monthlyExpenses: () => number;

  // Actions — Settings
  updateSettings: (s: Partial<UserSettings>) => void;
  markAlertRead: (id: string) => void;
  toggleVaultLock: () => void;

  // Actions — Transactions CRUD
  addTransaction: (tx: Transaction) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;

  // Actions — Accounts CRUD
  addAccount: (acc: Account) => void;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  deleteAccount: (id: string) => void;

  // Actions — Assets CRUD
  addAsset: (a: Asset) => void;
  updateAsset: (id: string, updates: Partial<Asset>) => void;
  deleteAsset: (id: string) => void;

  // Actions — Budgets CRUD
  addBudget: (b: Budget) => void;
  updateBudget: (id: string, updates: Partial<Budget>) => void;
  deleteBudget: (id: string) => void;

  // Actions — Categories
  addCategory: (c: Category) => void;

  // Actions — Data management
  exportAllData: () => string;
  importAllData: (json: string) => boolean;
  clearAllData: () => void;
}

export const useFinOS = create<FinOSState>()(
  persist(
    (set, get) => ({
      settings: { name: 'User', defaultCurrency: 'USD', theme: 'dark', dateFormat: 'MM/dd/yyyy' },
      accounts: sampleAccounts,
      transactions: sampleTransactions,
      categories: sampleCategories,
      budgets: sampleBudgets,
      assets: sampleAssets,
      loans: sampleLoans,
      journalEntries: sampleJournalEntries,
      documents: sampleDocuments,
      alerts: sampleAlerts,
      isVaultLocked: true,

      totalBalance: () => get().accounts.reduce((sum, a) => sum + a.balance, 0),
      netWorth: () => {
        const accBal = get().accounts.reduce((sum, a) => sum + a.balance, 0);
        const assetVal = get().assets.reduce((sum, a) => sum + a.currentPrice * a.quantity, 0);
        const loanBal = get().loans.filter(l => l.status === 'active').reduce((sum, l) => sum + l.outstandingAmount, 0);
        return accBal + assetVal - loanBal;
      },
      totalPortfolioValue: () => get().assets.reduce((sum, a) => sum + a.currentPrice * a.quantity, 0),
      totalPortfolioCost: () => get().assets.reduce((sum, a) => sum + a.buyPrice * a.quantity, 0),
      totalLoanOutstanding: () => get().loans.filter(l => l.status === 'active').reduce((sum, l) => sum + l.outstandingAmount, 0),
      monthlyIncome: () => get().transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      monthlyExpenses: () => get().transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),

      updateSettings: (s) => set(state => ({ settings: { ...state.settings, ...s } })),
      markAlertRead: (id) => set(state => ({ alerts: state.alerts.map(a => a.id === id ? { ...a, read: true } : a) })),
      toggleVaultLock: () => set(state => ({ isVaultLocked: !state.isVaultLocked })),

      // Transaction CRUD
      addTransaction: (tx) => set(state => ({ transactions: [tx, ...state.transactions] })),
      updateTransaction: (id, updates) => set(state => ({
        transactions: state.transactions.map(t => t.id === id ? { ...t, ...updates } : t),
      })),
      deleteTransaction: (id) => set(state => ({
        transactions: state.transactions.filter(t => t.id !== id),
      })),

      // Account CRUD
      addAccount: (acc) => set(state => ({ accounts: [...state.accounts, acc] })),
      updateAccount: (id, updates) => set(state => ({
        accounts: state.accounts.map(a => a.id === id ? { ...a, ...updates } : a),
      })),
      deleteAccount: (id) => set(state => ({
        accounts: state.accounts.filter(a => a.id !== id),
      })),

      // Asset CRUD
      addAsset: (a) => set(state => ({ assets: [...state.assets, a] })),
      updateAsset: (id, updates) => set(state => ({
        assets: state.assets.map(a => a.id === id ? { ...a, ...updates } : a),
      })),
      deleteAsset: (id) => set(state => ({
        assets: state.assets.filter(a => a.id !== id),
      })),

      // Budget CRUD
      addBudget: (b) => set(state => ({ budgets: [...state.budgets, b] })),
      updateBudget: (id, updates) => set(state => ({
        budgets: state.budgets.map(b => b.id === id ? { ...b, ...updates } : b),
      })),
      deleteBudget: (id) => set(state => ({
        budgets: state.budgets.filter(b => b.id !== id),
      })),

      // Category
      addCategory: (c) => set(state => ({ categories: [...state.categories, c] })),

      // Data management
      exportAllData: () => {
        const state = get();
        return JSON.stringify({
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          settings: state.settings,
          accounts: state.accounts,
          transactions: state.transactions,
          categories: state.categories,
          budgets: state.budgets,
          assets: state.assets,
          loans: state.loans,
          journalEntries: state.journalEntries,
          documents: state.documents,
          alerts: state.alerts,
        }, null, 2);
      },
      importAllData: (json) => {
        try {
          const data = JSON.parse(json);
          if (!data.version) return false;
          set({
            settings: data.settings || get().settings,
            accounts: data.accounts || [],
            transactions: data.transactions || [],
            categories: data.categories || [],
            budgets: data.budgets || [],
            assets: data.assets || [],
            loans: data.loans || [],
            journalEntries: data.journalEntries || [],
            documents: data.documents || [],
            alerts: data.alerts || [],
          });
          return true;
        } catch {
          return false;
        }
      },
      clearAllData: () => set({
        accounts: [],
        transactions: [],
        categories: [],
        budgets: [],
        assets: [],
        loans: [],
        journalEntries: [],
        documents: [],
        alerts: [],
      }),
    }),
    { name: 'finos-store' }
  )
);
