import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Account, Transaction, Category, Budget, Asset, VaultDocument, Alert, UserSettings } from './types';
import { sampleAccounts, sampleTransactions, sampleCategories, sampleBudgets, sampleAssets, sampleDocuments, sampleAlerts } from './sample-data';

interface FinOSState {
  settings: UserSettings;
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  assets: Asset[];
  documents: VaultDocument[];
  alerts: Alert[];
  isVaultLocked: boolean;

  // Computed
  totalBalance: () => number;
  netWorth: () => number;
  totalPortfolioValue: () => number;
  totalPortfolioCost: () => number;
  monthlyIncome: () => number;
  monthlyExpenses: () => number;

  // Actions
  updateSettings: (s: Partial<UserSettings>) => void;
  markAlertRead: (id: string) => void;
  toggleVaultLock: () => void;
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
      documents: sampleDocuments,
      alerts: sampleAlerts,
      isVaultLocked: true,

      totalBalance: () => get().accounts.reduce((sum, a) => sum + a.balance, 0),
      netWorth: () => {
        const accBal = get().accounts.reduce((sum, a) => sum + a.balance, 0);
        const assetVal = get().assets.reduce((sum, a) => sum + a.currentPrice * a.quantity, 0);
        return accBal + assetVal;
      },
      totalPortfolioValue: () => get().assets.reduce((sum, a) => sum + a.currentPrice * a.quantity, 0),
      totalPortfolioCost: () => get().assets.reduce((sum, a) => sum + a.buyPrice * a.quantity, 0),
      monthlyIncome: () => get().transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      monthlyExpenses: () => get().transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),

      updateSettings: (s) => set(state => ({ settings: { ...state.settings, ...s } })),
      markAlertRead: (id) => set(state => ({ alerts: state.alerts.map(a => a.id === id ? { ...a, read: true } : a) })),
      toggleVaultLock: () => set(state => ({ isVaultLocked: !state.isVaultLocked })),
    }),
    { name: 'finos-store' }
  )
);
