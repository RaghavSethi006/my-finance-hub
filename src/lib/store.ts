import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Account,
  AccountType,
  Alert,
  Asset,
  Budget,
  Category,
  DesktopSnapshot,
  JournalEntry,
  JournalEntryLine,
  Loan,
  Transaction,
  UserSettings,
  VaultDocument,
} from './types';
import {
  sampleAccounts,
  sampleAlerts,
  sampleAssets,
  sampleBudgets,
  sampleCategories,
  sampleDocuments,
  sampleJournalEntries,
  sampleLoans,
  sampleTransactions,
} from './sample-data';
import { isTauriDesktop, loadDesktopState, replaceDesktopState } from './desktop';

type SerializableFinOSState = DesktopSnapshot & {
  isVaultLocked: boolean;
};

interface FinOSState extends SerializableFinOSState {
  isDesktop: boolean;
  isHydrating: boolean;
  isHydrated: boolean;

  totalBalance: () => number;
  netWorth: () => number;
  totalPortfolioValue: () => number;
  totalPortfolioCost: () => number;
  totalLoanOutstanding: () => number;
  monthlyIncome: () => number;
  monthlyExpenses: () => number;

  hydrateDesktop: () => Promise<void>;
  updateSettings: (s: Partial<UserSettings>) => void;
  markAlertRead: (id: string) => void;
  toggleVaultLock: () => void;
  addTransaction: (tx: Transaction) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  clearTransactions: () => void;
  addAccount: (acc: Account) => void;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  deleteAccount: (id: string) => void;
  addAsset: (a: Asset) => void;
  updateAsset: (id: string, updates: Partial<Asset>) => void;
  deleteAsset: (id: string) => void;
  addBudget: (b: Budget) => void;
  updateBudget: (id: string, updates: Partial<Budget>) => void;
  deleteBudget: (id: string) => void;
  addCategory: (c: Category) => void;
  exportAllData: () => string;
  importAllData: (json: string) => boolean;
  clearAllData: () => void;
}

const defaultSettings: UserSettings = {
  name: 'User',
  defaultCurrency: 'USD',
  theme: 'dark',
  dateFormat: 'MM/dd/yyyy',
};

const initialData = (): SerializableFinOSState => ({
  settings: defaultSettings,
  accounts: sampleAccounts,
  transactions: sampleTransactions,
  categories: sampleCategories,
  budgets: recalculateBudgets(sampleTransactions, sampleBudgets),
  assets: sampleAssets,
  loans: sampleLoans,
  journalEntries: sampleJournalEntries,
  documents: sampleDocuments,
  alerts: sampleAlerts,
  isVaultLocked: true,
});

function cloneData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getCurrentMonthPrefix(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function accountLedgerType(accountType: AccountType): JournalEntryLine['accountType'] {
  return accountType === 'credit_card' ? 'liability' : 'asset';
}

function findCategoryName(categories: Category[], categoryId: string): string {
  return categories.find((category) => category.id === categoryId)?.name ?? 'Uncategorized';
}

function applyTransactionImpact(accounts: Account[], transaction: Transaction, direction: 1 | -1): Account[] {
  const amount = transaction.amount * direction;

  return accounts.map((account) => {
    if (account.id === transaction.accountId) {
      if (transaction.type === 'income') {
        return { ...account, balance: account.balance + amount };
      }

      if (transaction.type === 'expense') {
        return { ...account, balance: account.balance - amount };
      }

      if (transaction.type === 'transfer') {
        return { ...account, balance: account.balance - amount };
      }
    }

    if (transaction.type === 'transfer' && transaction.toAccountId && account.id === transaction.toAccountId) {
      return { ...account, balance: account.balance + amount };
    }

    return account;
  });
}

function buildJournalEntry(transaction: Transaction, accounts: Account[], categories: Category[]): JournalEntry {
  const account = accounts.find((item) => item.id === transaction.accountId);
  const targetAccount = transaction.toAccountId ? accounts.find((item) => item.id === transaction.toAccountId) : undefined;
  const categoryName = findCategoryName(categories, transaction.categoryId);
  const sourceType = account ? accountLedgerType(account.type) : 'asset';
  const targetType = targetAccount ? accountLedgerType(targetAccount.type) : 'asset';

  const entries: JournalEntryLine[] = [];

  if (transaction.type === 'income') {
    entries.push(
      { accountName: account?.name ?? 'Account', accountType: sourceType, debit: transaction.amount, credit: 0 },
      { accountName: categoryName, accountType: 'income', debit: 0, credit: transaction.amount }
    );
  } else if (transaction.type === 'expense') {
    entries.push(
      { accountName: categoryName, accountType: 'expense', debit: transaction.amount, credit: 0 },
      { accountName: account?.name ?? 'Account', accountType: sourceType, debit: 0, credit: transaction.amount }
    );
  } else {
    entries.push(
      { accountName: targetAccount?.name ?? 'Destination Account', accountType: targetType, debit: transaction.amount, credit: 0 },
      { accountName: account?.name ?? 'Source Account', accountType: sourceType, debit: 0, credit: transaction.amount }
    );
  }

  return {
    id: `je-${transaction.id}`,
    date: transaction.date,
    description: transaction.note,
    entries,
    transactionId: transaction.id,
  };
}

function recalculateBudgets(transactions: Transaction[], budgets: Budget[]): Budget[] {
  const monthPrefix = getCurrentMonthPrefix();
  return budgets.map((budget) => ({
    ...budget,
    spent: transactions
      .filter(
        (transaction) =>
          transaction.type === 'expense' &&
          transaction.categoryId === budget.categoryId &&
          transaction.date.startsWith(monthPrefix)
      )
      .reduce((sum, transaction) => sum + transaction.amount, 0),
  }));
}

function normalizeData(data: DesktopSnapshot): SerializableFinOSState {
  const categories = data.categories.length > 0 ? data.categories : cloneData(sampleCategories);
  const budgets = recalculateBudgets(data.transactions, data.budgets);
  const journalEntries =
    data.journalEntries.length > 0
      ? data.journalEntries
      : data.transactions.map((transaction) => buildJournalEntry(transaction, data.accounts, categories));

  return {
    ...data,
    categories,
    budgets,
    journalEntries,
    isVaultLocked: true,
  };
}

function snapshotFromState(state: FinOSState): DesktopSnapshot {
  return {
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
  };
}

function hasDesktopData(snapshot: DesktopSnapshot): boolean {
  return (
    snapshot.accounts.length > 0 ||
    snapshot.transactions.length > 0 ||
    snapshot.assets.length > 0 ||
    snapshot.loans.length > 0 ||
    snapshot.documents.length > 0 ||
    snapshot.alerts.length > 0 ||
    snapshot.budgets.length > 0
  );
}

export const useFinOS = create<FinOSState>()(
  persist(
    (set, get) => {
      const syncToDesktop = () => {
        if (!get().isDesktop || !get().isHydrated || get().isHydrating) {
          return;
        }

        void replaceDesktopState(snapshotFromState(get())).catch((error) => {
          console.error('Failed to sync FinOS state to desktop backend', error);
        });
      };

      return {
        ...cloneData(initialData()),
        isDesktop: false,
        isHydrating: false,
        isHydrated: false,

        totalBalance: () => get().accounts.reduce((sum, account) => sum + account.balance, 0),
        netWorth: () => {
          const accountBalance = get().accounts.reduce((sum, account) => sum + account.balance, 0);
          const assetValue = get().assets.reduce((sum, asset) => sum + asset.currentPrice * asset.quantity, 0);
          const loanBalance = get()
            .loans.filter((loan) => loan.status === 'active')
            .reduce((sum, loan) => sum + loan.outstandingAmount, 0);
          return accountBalance + assetValue - loanBalance;
        },
        totalPortfolioValue: () => get().assets.reduce((sum, asset) => sum + asset.currentPrice * asset.quantity, 0),
        totalPortfolioCost: () => get().assets.reduce((sum, asset) => sum + asset.buyPrice * asset.quantity, 0),
        totalLoanOutstanding: () =>
          get()
            .loans.filter((loan) => loan.status === 'active')
            .reduce((sum, loan) => sum + loan.outstandingAmount, 0),
        monthlyIncome: () =>
          get()
            .transactions.filter(
              (transaction) => transaction.type === 'income' && transaction.date.startsWith(getCurrentMonthPrefix())
            )
            .reduce((sum, transaction) => sum + transaction.amount, 0),
        monthlyExpenses: () =>
          get()
            .transactions.filter(
              (transaction) => transaction.type === 'expense' && transaction.date.startsWith(getCurrentMonthPrefix())
            )
            .reduce((sum, transaction) => sum + transaction.amount, 0),

        hydrateDesktop: async () => {
          if (get().isHydrated || get().isHydrating) {
            return;
          }

          const desktop = isTauriDesktop();
          set({ isDesktop: desktop, isHydrating: true });

          if (!desktop) {
            set({ isHydrated: true, isHydrating: false });
            return;
          }

          try {
            const desktopSnapshot = await loadDesktopState();
            if (hasDesktopData(desktopSnapshot)) {
              set({
                ...normalizeData(desktopSnapshot),
                isDesktop: true,
                isHydrated: true,
                isHydrating: false,
              });
            } else {
              await replaceDesktopState(snapshotFromState(get()));
              set({ isDesktop: true, isHydrated: true, isHydrating: false });
            }
          } catch (error) {
            console.error('Failed to hydrate FinOS from desktop backend', error);
            set({ isDesktop: true, isHydrated: true, isHydrating: false });
          }
        },

        updateSettings: (settings) => {
          set((state) => ({ settings: { ...state.settings, ...settings } }));
          syncToDesktop();
        },

        markAlertRead: (id) => {
          set((state) => ({
            alerts: state.alerts.map((alert) => (alert.id === id ? { ...alert, read: true } : alert)),
          }));
          syncToDesktop();
        },

        toggleVaultLock: () => {
          set((state) => ({ isVaultLocked: !state.isVaultLocked }));
        },

        addTransaction: (transaction) => {
          set((state) => {
            const accounts = applyTransactionImpact(state.accounts, transaction, 1);
            const transactions = [transaction, ...state.transactions];
            return {
              accounts,
              transactions,
              budgets: recalculateBudgets(transactions, state.budgets),
              journalEntries: [buildJournalEntry(transaction, accounts, state.categories), ...state.journalEntries],
            };
          });
          syncToDesktop();
        },

        updateTransaction: (id, updates) => {
          set((state) => {
            const existing = state.transactions.find((transaction) => transaction.id === id);
            if (!existing) {
              return {};
            }

            const merged = { ...existing, ...updates };
            const revertedAccounts = applyTransactionImpact(state.accounts, existing, -1);
            const accounts = applyTransactionImpact(revertedAccounts, merged, 1);
            const transactions = state.transactions.map((transaction) => (transaction.id === id ? merged : transaction));

            return {
              accounts,
              transactions,
              budgets: recalculateBudgets(transactions, state.budgets),
              journalEntries: [
                buildJournalEntry(merged, accounts, state.categories),
                ...state.journalEntries.filter((entry) => entry.transactionId !== id),
              ].sort((left, right) => right.date.localeCompare(left.date)),
            };
          });
          syncToDesktop();
        },

        deleteTransaction: (id) => {
          set((state) => {
            const existing = state.transactions.find((transaction) => transaction.id === id);
            if (!existing) {
              return {};
            }

            const accounts = applyTransactionImpact(state.accounts, existing, -1);
            const transactions = state.transactions.filter((transaction) => transaction.id !== id);
            return {
              accounts,
              transactions,
              budgets: recalculateBudgets(transactions, state.budgets),
              journalEntries: state.journalEntries.filter((entry) => entry.transactionId !== id),
            };
          });
          syncToDesktop();
        },

        clearTransactions: () => {
          set((state) => ({
            transactions: [],
            budgets: state.budgets.map((budget) => ({ ...budget, spent: 0 })),
            journalEntries: state.journalEntries.filter((entry) => !entry.transactionId),
          }));
          syncToDesktop();
        },

        addAccount: (account) => {
          set((state) => ({ accounts: [...state.accounts, account] }));
          syncToDesktop();
        },

        updateAccount: (id, updates) => {
          set((state) => ({
            accounts: state.accounts.map((account) => (account.id === id ? { ...account, ...updates } : account)),
          }));
          syncToDesktop();
        },

        deleteAccount: (id) => {
          set((state) => {
            const transactions = state.transactions.filter(
              (transaction) => transaction.accountId !== id && transaction.toAccountId !== id
            );
            return {
              accounts: state.accounts.filter((account) => account.id !== id),
              transactions,
              budgets: recalculateBudgets(transactions, state.budgets),
              journalEntries: state.journalEntries.filter((entry) => {
                const transaction = state.transactions.find((item) => item.id === entry.transactionId);
                return !transaction || (transaction.accountId !== id && transaction.toAccountId !== id);
              }),
              loans: state.loans.map((loan) => (loan.linkedAccountId === id ? { ...loan, linkedAccountId: undefined } : loan)),
            };
          });
          syncToDesktop();
        },

        addAsset: (asset) => {
          set((state) => ({ assets: [...state.assets, asset] }));
          syncToDesktop();
        },

        updateAsset: (id, updates) => {
          set((state) => ({
            assets: state.assets.map((asset) => (asset.id === id ? { ...asset, ...updates } : asset)),
          }));
          syncToDesktop();
        },

        deleteAsset: (id) => {
          set((state) => ({ assets: state.assets.filter((asset) => asset.id !== id) }));
          syncToDesktop();
        },

        addBudget: (budget) => {
          set((state) => ({ budgets: recalculateBudgets(state.transactions, [...state.budgets, budget]) }));
          syncToDesktop();
        },

        updateBudget: (id, updates) => {
          set((state) => ({
            budgets: recalculateBudgets(
              state.transactions,
              state.budgets.map((budget) => (budget.id === id ? { ...budget, ...updates } : budget))
            ),
          }));
          syncToDesktop();
        },

        deleteBudget: (id) => {
          set((state) => ({ budgets: state.budgets.filter((budget) => budget.id !== id) }));
          syncToDesktop();
        },

        addCategory: (category) => {
          set((state) => ({ categories: [...state.categories, category] }));
          syncToDesktop();
        },

        exportAllData: () => JSON.stringify(snapshotFromState(get()), null, 2),

        importAllData: (json) => {
          try {
            const data = JSON.parse(json) as DesktopSnapshot & { version?: string };
            const normalized = normalizeData({
              settings: data.settings ?? defaultSettings,
              accounts: data.accounts ?? [],
              transactions: data.transactions ?? [],
              categories: data.categories ?? cloneData(sampleCategories),
              budgets: data.budgets ?? [],
              assets: data.assets ?? [],
              loans: data.loans ?? [],
              journalEntries: data.journalEntries ?? [],
              documents: data.documents ?? [],
              alerts: data.alerts ?? [],
            });

            set(normalized);
            syncToDesktop();
            return true;
          } catch {
            return false;
          }
        },

        clearAllData: () => {
          const reset = initialData();
          set({
            ...cloneData(reset),
            accounts: [],
            transactions: [],
            budgets: recalculateBudgets([], reset.budgets),
            assets: [],
            loans: [],
            journalEntries: [],
            documents: [],
            alerts: [],
          });
          syncToDesktop();
        },
      };
    },
    {
      name: 'finos-store',
      partialize: (state) => ({
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
        isVaultLocked: state.isVaultLocked,
      }),
    }
  )
);
