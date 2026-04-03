import { Account, Transaction, Category, Budget, Asset, VaultDocument, Alert } from './types';

export const sampleAccounts: Account[] = [
  { id: 'acc-1', name: 'Main Checking', type: 'bank', balance: 12450.80, currency: 'USD', color: 'hsl(220 70% 50%)', icon: 'building-2', createdAt: '2024-01-01' },
  { id: 'acc-2', name: 'Cash Wallet', type: 'cash', balance: 340.00, currency: 'USD', color: 'hsl(152 60% 40%)', icon: 'wallet', createdAt: '2024-01-01' },
  { id: 'acc-3', name: 'Visa Credit Card', type: 'credit_card', balance: -2180.50, currency: 'USD', color: 'hsl(0 72% 51%)', icon: 'credit-card', createdAt: '2024-01-01' },
  { id: 'acc-4', name: 'Investment Account', type: 'investment', balance: 45200.00, currency: 'USD', color: 'hsl(280 65% 55%)', icon: 'trending-up', createdAt: '2024-01-01' },
  { id: 'acc-5', name: 'CAD Savings', type: 'bank', balance: 8750.00, currency: 'CAD', color: 'hsl(350 65% 55%)', icon: 'piggy-bank', createdAt: '2024-06-01' },
];

export const sampleCategories: Category[] = [
  { id: 'cat-1', name: 'Food & Dining', type: 'expense', color: 'hsl(38 92% 50%)', icon: 'utensils' },
  { id: 'cat-2', name: 'Rent', type: 'expense', color: 'hsl(220 70% 50%)', icon: 'home' },
  { id: 'cat-3', name: 'Transport', type: 'expense', color: 'hsl(190 80% 42%)', icon: 'car' },
  { id: 'cat-4', name: 'Entertainment', type: 'expense', color: 'hsl(280 65% 55%)', icon: 'gamepad-2' },
  { id: 'cat-5', name: 'Health', type: 'expense', color: 'hsl(0 72% 51%)', icon: 'heart-pulse' },
  { id: 'cat-6', name: 'Shopping', type: 'expense', color: 'hsl(350 65% 55%)', icon: 'shopping-bag' },
  { id: 'cat-7', name: 'Utilities', type: 'expense', color: 'hsl(45 93% 47%)', icon: 'zap' },
  { id: 'cat-8', name: 'Salary', type: 'income', color: 'hsl(152 60% 40%)', icon: 'banknote' },
  { id: 'cat-9', name: 'Freelance', type: 'income', color: 'hsl(210 100% 52%)', icon: 'laptop' },
  { id: 'cat-10', name: 'Investment Returns', type: 'income', color: 'hsl(280 65% 55%)', icon: 'trending-up' },
  { id: 'cat-11', name: 'Education', type: 'expense', color: 'hsl(220 70% 50%)', icon: 'graduation-cap' },
  { id: 'cat-12', name: 'Subscriptions', type: 'expense', color: 'hsl(170 60% 45%)', icon: 'repeat' },
];

const today = new Date();
const dayMs = 86400000;
const d = (daysAgo: number) => new Date(today.getTime() - daysAgo * dayMs).toISOString().split('T')[0];

export const sampleTransactions: Transaction[] = [
  { id: 'tx-1', amount: 7500, type: 'income', categoryId: 'cat-8', accountId: 'acc-1', date: d(1), note: 'Monthly salary', paymentMethod: 'netbanking', currency: 'USD', taxTag: 'personal', isDeductible: false, isRecurring: true },
  { id: 'tx-2', amount: 45.50, type: 'expense', categoryId: 'cat-1', accountId: 'acc-3', date: d(0), note: 'Lunch at Chipotle', paymentMethod: 'card', currency: 'USD', taxTag: 'personal', isDeductible: false, isRecurring: false },
  { id: 'tx-3', amount: 1800, type: 'expense', categoryId: 'cat-2', accountId: 'acc-1', date: d(2), note: 'April rent', paymentMethod: 'netbanking', currency: 'USD', taxTag: 'personal', isDeductible: false, isRecurring: true },
  { id: 'tx-4', amount: 120, type: 'expense', categoryId: 'cat-3', accountId: 'acc-2', date: d(0), note: 'Uber rides this week', paymentMethod: 'cash', currency: 'USD', taxTag: 'untagged', isDeductible: false, isRecurring: false },
  { id: 'tx-5', amount: 2200, type: 'income', categoryId: 'cat-9', accountId: 'acc-1', date: d(3), note: 'Freelance web project', paymentMethod: 'netbanking', currency: 'USD', taxTag: 'business', isDeductible: false, isRecurring: false },
  { id: 'tx-6', amount: 65, type: 'expense', categoryId: 'cat-4', accountId: 'acc-3', date: d(1), note: 'Netflix + Spotify', paymentMethod: 'card', currency: 'USD', taxTag: 'personal', isDeductible: false, isRecurring: true },
  { id: 'tx-7', amount: 89.99, type: 'expense', categoryId: 'cat-6', accountId: 'acc-3', date: d(4), note: 'Amazon order', paymentMethod: 'card', currency: 'USD', taxTag: 'untagged', isDeductible: false, isRecurring: false },
  { id: 'tx-8', amount: 150, type: 'expense', categoryId: 'cat-7', accountId: 'acc-1', date: d(5), note: 'Electric bill', paymentMethod: 'netbanking', currency: 'USD', taxTag: 'personal', isDeductible: false, isRecurring: true },
  { id: 'tx-9', amount: 35, type: 'expense', categoryId: 'cat-1', accountId: 'acc-2', date: d(1), note: 'Groceries', paymentMethod: 'cash', currency: 'USD', taxTag: 'personal', isDeductible: false, isRecurring: false },
  { id: 'tx-10', amount: 500, type: 'income', categoryId: 'cat-10', accountId: 'acc-4', date: d(7), note: 'Dividend payment', paymentMethod: 'netbanking', currency: 'USD', taxTag: 'personal', isDeductible: false, isRecurring: false },
];

export const sampleBudgets: Budget[] = [
  { id: 'bud-1', categoryId: 'cat-1', amount: 500, currency: 'USD', spent: 380, alertThreshold: 80, period: 'monthly' },
  { id: 'bud-2', categoryId: 'cat-3', amount: 300, currency: 'USD', spent: 270, alertThreshold: 80, period: 'monthly' },
  { id: 'bud-3', categoryId: 'cat-4', amount: 200, currency: 'USD', spent: 65, alertThreshold: 80, period: 'monthly' },
  { id: 'bud-4', categoryId: 'cat-6', amount: 400, currency: 'USD', spent: 290, alertThreshold: 80, period: 'monthly' },
  { id: 'bud-5', categoryId: 'cat-7', amount: 250, currency: 'USD', spent: 150, alertThreshold: 80, period: 'monthly' },
];

export const sampleAssets: Asset[] = [
  { id: 'ast-1', name: 'Apple Inc.', type: 'stock', ticker: 'AAPL', exchange: 'NASDAQ', quantity: 15, buyPrice: 142.50, currentPrice: 178.72, currency: 'USD', purchaseDate: '2023-06-15' },
  { id: 'ast-2', name: 'Tesla Inc.', type: 'stock', ticker: 'TSLA', exchange: 'NASDAQ', quantity: 8, buyPrice: 185.00, currentPrice: 248.42, currency: 'USD', purchaseDate: '2023-09-20' },
  { id: 'ast-3', name: 'Bitcoin', type: 'crypto', ticker: 'BTC', quantity: 0.25, buyPrice: 27500, currentPrice: 84350, currency: 'USD', purchaseDate: '2023-03-10' },
  { id: 'ast-4', name: 'Ethereum', type: 'crypto', ticker: 'ETH', quantity: 3.5, buyPrice: 1650, currentPrice: 1870, currency: 'USD', purchaseDate: '2023-04-01' },
  { id: 'ast-5', name: 'Downtown Apartment', type: 'real_estate', quantity: 1, buyPrice: 285000, currentPrice: 312000, currency: 'USD', purchaseDate: '2021-08-15' },
  { id: 'ast-6', name: 'Gold (10g bars)', type: 'gold', quantity: 5, buyPrice: 580, currentPrice: 720, currency: 'USD', purchaseDate: '2022-12-01' },
];

export const sampleDocuments: VaultDocument[] = [
  { id: 'doc-1', name: 'Bank Statement Mar 2025', category: 'banking', fileType: 'pdf', size: 245000, tags: ['statement', 'monthly'], createdAt: '2025-03-15', updatedAt: '2025-03-15' },
  { id: 'doc-2', name: 'Tax Return FY2024', category: 'tax', fileType: 'pdf', size: 1200000, tags: ['itr', 'annual'], createdAt: '2025-01-10', updatedAt: '2025-01-10' },
  { id: 'doc-3', name: 'Apartment Deed', category: 'legal', fileType: 'pdf', size: 3500000, tags: ['property', 'deed'], linkedEntityId: 'ast-5', linkedEntityType: 'asset', createdAt: '2021-08-15', updatedAt: '2021-08-15' },
  { id: 'doc-4', name: 'Health Insurance Policy', category: 'personal', fileType: 'pdf', size: 890000, tags: ['insurance', 'health'], createdAt: '2025-01-01', updatedAt: '2025-01-01' },
  { id: 'doc-5', name: 'W-2 Form 2024', category: 'tax', fileType: 'pdf', size: 156000, tags: ['w2', 'income'], createdAt: '2025-02-01', updatedAt: '2025-02-01' },
];

export const sampleAlerts: Alert[] = [
  { id: 'al-1', type: 'budget', title: 'Transport budget at 90%', message: 'You\'ve spent $270 of your $300 transport budget', severity: 'warning', module: 'finance', actionLabel: 'View Budget', actionRoute: '/finance/budgets', timestamp: new Date().toISOString(), read: false },
  { id: 'al-2', type: 'milestone', title: 'Net worth milestone!', message: 'Your net worth grew 8.2% this month', severity: 'success', module: 'ledger', timestamp: new Date().toISOString(), read: false },
  { id: 'al-3', type: 'tax_opportunity', title: 'Potential tax deduction', message: '3 business expenses not tagged as deductible ($485)', severity: 'info', module: 'tax', actionLabel: 'Review', actionRoute: '/tax', timestamp: new Date().toISOString(), read: false },
  { id: 'al-4', type: 'asset_gap', title: 'Missing documentation', message: 'Your Tesla stock has no linked documents', severity: 'info', module: 'vault', actionLabel: 'Upload', actionRoute: '/vault', timestamp: new Date().toISOString(), read: true },
];

export const monthlySpendingData = [
  { month: 'Oct', income: 7500, expenses: 4200 },
  { month: 'Nov', income: 9700, expenses: 5100 },
  { month: 'Dec', income: 8200, expenses: 6800 },
  { month: 'Jan', income: 7500, expenses: 4500 },
  { month: 'Feb', income: 10200, expenses: 4800 },
  { month: 'Mar', income: 9700, expenses: 5200 },
];

export const netWorthHistory = [
  { month: 'Oct', assets: 52000, liabilities: 3200, netWorth: 48800 },
  { month: 'Nov', assets: 54500, liabilities: 2800, netWorth: 51700 },
  { month: 'Dec', assets: 53200, liabilities: 4100, netWorth: 49100 },
  { month: 'Jan', assets: 56800, liabilities: 2900, netWorth: 53900 },
  { month: 'Feb', assets: 59200, liabilities: 2400, netWorth: 56800 },
  { month: 'Mar', assets: 62400, liabilities: 2180, netWorth: 60220 },
];
