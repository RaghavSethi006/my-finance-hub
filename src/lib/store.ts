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
  RecurringTemplate,
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
  sampleRecurringTemplates,
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
  addRecurringTemplate: (template: RecurringTemplate) => void;
  updateRecurringTemplate: (id: string, updates: Partial<RecurringTemplate>) => void;
  deleteRecurringTemplate: (id: string) => void;
  processDueRecurring: () => number;
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
  updateCategory: (id: string, updates: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  addDocument: (document: VaultDocument) => void;
  updateDocument: (id: string, updates: Partial<VaultDocument>) => void;
  deleteDocument: (id: string) => void;
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
  recurringTemplates: sampleRecurringTemplates,
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

function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function advanceRecurringDate(date: string, frequency: RecurringTemplate['frequency']): string {
  const next = new Date(`${date}T00:00:00`);

  if (frequency === 'daily') {
    next.setDate(next.getDate() + 1);
  } else if (frequency === 'weekly') {
    next.setDate(next.getDate() + 7);
  } else if (frequency === 'monthly') {
    next.setMonth(next.getMonth() + 1);
  } else {
    next.setFullYear(next.getFullYear() + 1);
  }

  return isoDate(next);
}

function buildRecurringTransaction(template: RecurringTemplate, date: string, index: number): Transaction {
  return {
    id: `${template.id}-${date}-${index}`,
    amount: template.amount,
    type: template.type,
    categoryId: template.categoryId,
    accountId: template.accountId,
    toAccountId: template.toAccountId,
    date,
    note: template.note,
    paymentMethod: template.paymentMethod,
    currency: template.currency,
    taxTag: template.taxTag,
    isDeductible: template.isDeductible,
    isRecurring: true,
    recurringTemplateId: template.id,
  };
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

function processDueRecurringTemplates(data: SerializableFinOSState): { state: SerializableFinOSState; generatedCount: number } {
  const today = isoDate(new Date());
  let generatedCount = 0;
  let accounts = [...data.accounts];
  let transactions = [...data.transactions];
  let journalEntries = [...data.journalEntries];

  const recurringTemplates = data.recurringTemplates.map((template) => {
    if (template.isPaused) {
      return template;
    }

    let nextDate = template.nextDate;
    let iteration = 0;

    while (nextDate <= today) {
      const alreadyGenerated = transactions.some(
        (transaction) => transaction.recurringTemplateId === template.id && transaction.date === nextDate
      );

      if (!alreadyGenerated) {
        const recurringTransaction = buildRecurringTransaction(template, nextDate, iteration);
        accounts = applyTransactionImpact(accounts, recurringTransaction, 1);
        transactions = [recurringTransaction, ...transactions];
        journalEntries = [buildJournalEntry(recurringTransaction, accounts, data.categories), ...journalEntries];
        generatedCount += 1;
      }

      nextDate = advanceRecurringDate(nextDate, template.frequency);
      iteration += 1;
    }

    return nextDate === template.nextDate
      ? template
      : { ...template, nextDate, updatedAt: new Date().toISOString() };
  });

  return {
    generatedCount,
    state: {
      ...data,
      accounts,
      transactions: [...transactions].sort((left, right) => right.date.localeCompare(left.date)),
      recurringTemplates,
      budgets: recalculateBudgets(transactions, data.budgets),
      journalEntries: [...journalEntries].sort((left, right) => right.date.localeCompare(left.date)),
    },
  };
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
    recurringTemplates: data.recurringTemplates ?? [],
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
    recurringTemplates: state.recurringTemplates,
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
    snapshot.recurringTemplates.length > 0 ||
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
              const normalized = normalizeData(desktopSnapshot);
              const processed = processDueRecurringTemplates(normalized);
              set({
                ...processed.state,
                isDesktop: true,
                isHydrated: true,
                isHydrating: false,
              });
              if (processed.generatedCount > 0) {
                await replaceDesktopState(snapshotFromState({ ...get(), ...processed.state } as FinOSState));
              }
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

        addRecurringTemplate: (template) => {
          set((state) => ({
            recurringTemplates: [...state.recurringTemplates, template].sort((left, right) =>
              left.nextDate.localeCompare(right.nextDate)
            ),
          }));
          syncToDesktop();
        },

        updateRecurringTemplate: (id, updates) => {
          set((state) => ({
            recurringTemplates: state.recurringTemplates
              .map((template) => (template.id === id ? { ...template, ...updates } : template))
              .sort((left, right) => left.nextDate.localeCompare(right.nextDate)),
          }));
          syncToDesktop();
        },

        deleteRecurringTemplate: (id) => {
          set((state) => ({
            recurringTemplates: state.recurringTemplates.filter((template) => template.id !== id),
            transactions: state.transactions.map((transaction) =>
              transaction.recurringTemplateId === id
                ? { ...transaction, recurringTemplateId: undefined, isRecurring: false }
                : transaction
            ),
          }));
          syncToDesktop();
        },

        processDueRecurring: () => {
          const processed = processDueRecurringTemplates(get());
          if (processed.generatedCount > 0) {
            set(processed.state);
            syncToDesktop();
          }
          return processed.generatedCount;
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

        updateCategory: (id, updates) => {
          set((state) => ({
            categories: state.categories.map((category) => (category.id === id ? { ...category, ...updates } : category)),
          }));
          syncToDesktop();
        },

        deleteCategory: (id) => {
          set((state) => ({
            categories: state.categories.filter((category) => category.id !== id),
          }));
          syncToDesktop();
        },

        addDocument: (document) => {
          set((state) => ({ documents: [document, ...state.documents] }));
          syncToDesktop();
        },

        updateDocument: (id, updates) => {
          set((state) => ({
            documents: state.documents.map((document) => (document.id === id ? { ...document, ...updates } : document)),
          }));
          syncToDesktop();
        },

        deleteDocument: (id) => {
          set((state) => ({ documents: state.documents.filter((document) => document.id !== id) }));
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
              recurringTemplates: data.recurringTemplates ?? [],
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
            recurringTemplates: [],
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
        recurringTemplates: state.recurringTemplates,
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
