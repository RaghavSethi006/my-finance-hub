import { Account, Transaction, Category, Budget, Asset, VaultDocument, Alert, Loan, JournalEntry, RecurringTemplate } from './types';

export const sampleAccounts: Account[] = [
  { id: 'acc-1', name: 'Main Checking', type: 'bank', balance: 12450.80, currency: 'USD', color: 'hsl(220 70% 50%)', icon: 'building-2', createdAt: '2024-01-01', bankName: 'Chase Bank', accountNumber: '****4521', ifscCode: 'CHASUS33', branchName: 'Downtown Manhattan', nominees: ['Jane Doe'], loginUrl: 'https://chase.com', notes: 'Primary checking account', isActive: true },
  { id: 'acc-2', name: 'Cash Wallet', type: 'cash', balance: 340.00, currency: 'USD', color: 'hsl(152 60% 40%)', icon: 'wallet', createdAt: '2024-01-01', notes: 'Physical cash on hand', isActive: true },
  { id: 'acc-3', name: 'Visa Credit Card', type: 'credit_card', balance: -2180.50, currency: 'USD', color: 'hsl(0 72% 51%)', icon: 'credit-card', createdAt: '2024-01-01', bankName: 'Visa / Chase', accountNumber: '****7892', notes: 'Rewards credit card — 2% cashback', isActive: true },
  { id: 'acc-4', name: 'Investment Account', type: 'investment', balance: 45200.00, currency: 'USD', color: 'hsl(280 65% 55%)', icon: 'trending-up', createdAt: '2024-01-01', bankName: 'Fidelity', accountNumber: '****3310', nominees: ['Jane Doe', 'John Doe Sr.'], notes: 'Brokerage account for stocks & ETFs', isActive: true },
  { id: 'acc-5', name: 'CAD Savings', type: 'bank', balance: 8750.00, currency: 'CAD', color: 'hsl(350 65% 55%)', icon: 'piggy-bank', createdAt: '2024-06-01', bankName: 'RBC Royal Bank', accountNumber: '****6784', branchName: 'Toronto Downtown', nominees: ['Jane Doe'], isActive: true },
  { id: 'acc-6', name: 'EUR Travel Fund', type: 'bank', balance: 3200.00, currency: 'EUR', color: 'hsl(38 92% 50%)', icon: 'plane', createdAt: '2024-08-01', bankName: 'N26', accountNumber: '****9021', notes: 'Travel expenses fund', isActive: true },
  { id: 'acc-7', name: 'Crypto Wallet', type: 'crypto', balance: 15800.00, currency: 'USD', color: 'hsl(45 93% 47%)', icon: 'bitcoin', createdAt: '2023-03-10', bankName: 'Coinbase', notes: 'Cold storage hardware wallet linked', isActive: true },
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
  { id: 'cat-13', name: 'Insurance', type: 'expense', color: 'hsl(200 70% 50%)', icon: 'shield' },
  { id: 'cat-14', name: 'Loan EMI', type: 'expense', color: 'hsl(0 50% 50%)', icon: 'landmark' },
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
  { id: 'tx-11', amount: 250, type: 'expense', categoryId: 'cat-13', accountId: 'acc-1', date: d(8), note: 'Health insurance premium', paymentMethod: 'netbanking', currency: 'USD', taxTag: 'personal', isDeductible: true, isRecurring: true },
  { id: 'tx-12', amount: 1450, type: 'expense', categoryId: 'cat-14', accountId: 'acc-1', date: d(3), note: 'Home loan EMI', paymentMethod: 'netbanking', currency: 'USD', taxTag: 'personal', isDeductible: true, isRecurring: true },
  { id: 'tx-13', amount: 75, type: 'expense', categoryId: 'cat-5', accountId: 'acc-3', date: d(6), note: 'Pharmacy', paymentMethod: 'card', currency: 'USD', taxTag: 'personal', isDeductible: false, isRecurring: false },
  { id: 'tx-14', amount: 320, type: 'expense', categoryId: 'cat-11', accountId: 'acc-1', date: d(10), note: 'Online course - AWS', paymentMethod: 'card', currency: 'USD', taxTag: 'business', isDeductible: true, isRecurring: false },
  { id: 'tx-15', amount: 1200, type: 'income', categoryId: 'cat-9', accountId: 'acc-1', date: d(12), note: 'Logo design freelance', paymentMethod: 'netbanking', currency: 'USD', taxTag: 'business', isDeductible: false, isRecurring: false },
  { id: 'tx-16', amount: 42.00, type: 'expense', categoryId: 'cat-12', accountId: 'acc-3', date: d(2), note: 'GitHub Pro + Figma', paymentMethod: 'card', currency: 'USD', taxTag: 'business', isDeductible: true, isRecurring: true },
  { id: 'tx-17', amount: 180, type: 'expense', categoryId: 'cat-1', accountId: 'acc-5', date: d(4), note: 'Dinner at restaurant', paymentMethod: 'card', currency: 'CAD', taxTag: 'personal', isDeductible: false, isRecurring: false },
  { id: 'tx-18', amount: 95, type: 'expense', categoryId: 'cat-3', accountId: 'acc-6', date: d(5), note: 'Train ticket Paris', paymentMethod: 'card', currency: 'EUR', taxTag: 'personal', isDeductible: false, isRecurring: false },
];

export const sampleBudgets: Budget[] = [
  { id: 'bud-1', categoryId: 'cat-1', amount: 500, currency: 'USD', spent: 380, alertThreshold: 80, period: 'monthly' },
  { id: 'bud-2', categoryId: 'cat-3', amount: 300, currency: 'USD', spent: 270, alertThreshold: 80, period: 'monthly' },
  { id: 'bud-3', categoryId: 'cat-4', amount: 200, currency: 'USD', spent: 65, alertThreshold: 80, period: 'monthly' },
  { id: 'bud-4', categoryId: 'cat-6', amount: 400, currency: 'USD', spent: 290, alertThreshold: 80, period: 'monthly' },
  { id: 'bud-5', categoryId: 'cat-7', amount: 250, currency: 'USD', spent: 150, alertThreshold: 80, period: 'monthly' },
];

export const sampleRecurringTemplates: RecurringTemplate[] = [
  { id: 'rt-1', amount: 7500, type: 'income', categoryId: 'cat-8', accountId: 'acc-1', note: 'Monthly salary', paymentMethod: 'netbanking', currency: 'USD', taxTag: 'personal', isDeductible: false, frequency: 'monthly', nextDate: d(-29), isPaused: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  { id: 'rt-2', amount: 1800, type: 'expense', categoryId: 'cat-2', accountId: 'acc-1', note: 'Monthly rent', paymentMethod: 'netbanking', currency: 'USD', taxTag: 'personal', isDeductible: false, frequency: 'monthly', nextDate: d(-27), isPaused: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  { id: 'rt-3', amount: 65, type: 'expense', categoryId: 'cat-4', accountId: 'acc-3', note: 'Netflix + Spotify', paymentMethod: 'card', currency: 'USD', taxTag: 'personal', isDeductible: false, frequency: 'monthly', nextDate: d(-12), isPaused: false, createdAt: '2024-02-01', updatedAt: '2024-02-01' },
  { id: 'rt-4', amount: 42, type: 'expense', categoryId: 'cat-12', accountId: 'acc-3', note: 'GitHub Pro + Figma', paymentMethod: 'card', currency: 'USD', taxTag: 'business', isDeductible: true, frequency: 'monthly', nextDate: d(-10), isPaused: false, createdAt: '2024-03-01', updatedAt: '2024-03-01' },
];

export const sampleAssets: Asset[] = [
  { id: 'ast-1', name: 'Apple Inc.', type: 'stock', ticker: 'AAPL', exchange: 'NASDAQ', quantity: 15, buyPrice: 142.50, currentPrice: 178.72, currency: 'USD', purchaseDate: '2023-06-15' },
  { id: 'ast-2', name: 'Tesla Inc.', type: 'stock', ticker: 'TSLA', exchange: 'NASDAQ', quantity: 8, buyPrice: 185.00, currentPrice: 248.42, currency: 'USD', purchaseDate: '2023-09-20' },
  { id: 'ast-7', name: 'Microsoft Corp.', type: 'stock', ticker: 'MSFT', exchange: 'NASDAQ', quantity: 10, buyPrice: 310.00, currentPrice: 415.80, currency: 'USD', purchaseDate: '2023-02-10' },
  { id: 'ast-8', name: 'Amazon.com', type: 'stock', ticker: 'AMZN', exchange: 'NASDAQ', quantity: 12, buyPrice: 128.00, currentPrice: 185.60, currency: 'USD', purchaseDate: '2023-11-05' },
  { id: 'ast-13', name: 'NVIDIA Corp.', type: 'stock', ticker: 'NVDA', exchange: 'NASDAQ', quantity: 5, buyPrice: 450.00, currentPrice: 875.30, currency: 'USD', purchaseDate: '2024-01-15' },
  { id: 'ast-9', name: 'Vanguard S&P 500 ETF', type: 'mutual_fund', ticker: 'VOO', exchange: 'NYSE', quantity: 20, buyPrice: 380.00, currentPrice: 485.20, currency: 'USD', purchaseDate: '2022-06-01', fundHouse: 'Vanguard', nav: 485.20, sipAmount: 500 },
  { id: 'ast-10', name: 'Fidelity Growth Fund', type: 'mutual_fund', ticker: 'FDGRX', exchange: 'NASDAQ', quantity: 45, buyPrice: 165.00, currentPrice: 198.40, currency: 'USD', purchaseDate: '2023-01-15', fundHouse: 'Fidelity', nav: 198.40, sipAmount: 300 },
  { id: 'ast-14', name: 'iShares Bond ETF', type: 'mutual_fund', ticker: 'AGG', exchange: 'NYSE', quantity: 30, buyPrice: 98.50, currentPrice: 102.30, currency: 'USD', purchaseDate: '2023-04-01', fundHouse: 'BlackRock', nav: 102.30 },
  { id: 'ast-3', name: 'Bitcoin', type: 'crypto', ticker: 'BTC', quantity: 0.25, buyPrice: 27500, currentPrice: 84350, currency: 'USD', purchaseDate: '2023-03-10' },
  { id: 'ast-4', name: 'Ethereum', type: 'crypto', ticker: 'ETH', quantity: 3.5, buyPrice: 1650, currentPrice: 1870, currency: 'USD', purchaseDate: '2023-04-01' },
  { id: 'ast-11', name: 'Solana', type: 'crypto', ticker: 'SOL', quantity: 50, buyPrice: 22.50, currentPrice: 142.80, currency: 'USD', purchaseDate: '2023-07-01' },
  { id: 'ast-12', name: 'Cardano', type: 'crypto', ticker: 'ADA', quantity: 5000, buyPrice: 0.28, currentPrice: 0.45, currency: 'USD', purchaseDate: '2023-05-15' },
  { id: 'ast-5', name: 'Downtown Apartment', type: 'real_estate', quantity: 1, buyPrice: 285000, currentPrice: 312000, currency: 'USD', purchaseDate: '2021-08-15' },
  { id: 'ast-6', name: 'Gold (10g bars)', type: 'gold', quantity: 5, buyPrice: 580, currentPrice: 720, currency: 'USD', purchaseDate: '2022-12-01' },
  { id: 'ast-15', name: 'Honda Civic 2022', type: 'vehicle', quantity: 1, buyPrice: 28500, currentPrice: 22000, currency: 'USD', purchaseDate: '2022-03-10', notes: 'Depreciating asset' },
];

export const sampleLoans: Loan[] = [
  { id: 'loan-1', name: 'Home Mortgage', lender: 'Chase Bank', type: 'home', principalAmount: 250000, outstandingAmount: 218500, interestRate: 6.5, emi: 1450, tenure: 360, startDate: '2021-08-15', endDate: '2051-08-15', currency: 'USD', status: 'active', linkedAccountId: 'acc-1' },
  { id: 'loan-2', name: 'Car Loan', lender: 'Capital One', type: 'car', principalAmount: 22000, outstandingAmount: 14200, interestRate: 4.9, emi: 420, tenure: 60, startDate: '2022-03-10', endDate: '2027-03-10', currency: 'USD', status: 'active', linkedAccountId: 'acc-1' },
  { id: 'loan-3', name: 'Student Loan', lender: 'SoFi', type: 'education', principalAmount: 35000, outstandingAmount: 8500, interestRate: 3.5, emi: 380, tenure: 120, startDate: '2018-09-01', endDate: '2028-09-01', currency: 'USD', status: 'active' },
  { id: 'loan-4', name: 'Credit Card Balance', lender: 'Visa', type: 'credit_card', principalAmount: 2180.50, outstandingAmount: 2180.50, interestRate: 19.99, emi: 0, tenure: 0, startDate: '2025-03-01', endDate: '2025-12-31', currency: 'USD', status: 'active', linkedAccountId: 'acc-3' },
];

export const sampleJournalEntries: JournalEntry[] = [
  { id: 'je-1', date: d(1), description: 'Monthly salary received', entries: [{ accountName: 'Main Checking', accountType: 'asset', debit: 7500, credit: 0 }, { accountName: 'Salary Income', accountType: 'income', debit: 0, credit: 7500 }], transactionId: 'tx-1' },
  { id: 'je-2', date: d(0), description: 'Lunch at Chipotle', entries: [{ accountName: 'Food & Dining', accountType: 'expense', debit: 45.50, credit: 0 }, { accountName: 'Visa Credit Card', accountType: 'liability', debit: 0, credit: 45.50 }], transactionId: 'tx-2' },
  { id: 'je-3', date: d(2), description: 'April rent payment', entries: [{ accountName: 'Rent', accountType: 'expense', debit: 1800, credit: 0 }, { accountName: 'Main Checking', accountType: 'asset', debit: 0, credit: 1800 }], transactionId: 'tx-3' },
  { id: 'je-4', date: d(0), description: 'Uber rides - weekly', entries: [{ accountName: 'Transport', accountType: 'expense', debit: 120, credit: 0 }, { accountName: 'Cash Wallet', accountType: 'asset', debit: 0, credit: 120 }], transactionId: 'tx-4' },
  { id: 'je-5', date: d(3), description: 'Freelance web project income', entries: [{ accountName: 'Main Checking', accountType: 'asset', debit: 2200, credit: 0 }, { accountName: 'Freelance Income', accountType: 'income', debit: 0, credit: 2200 }], transactionId: 'tx-5' },
  { id: 'je-6', date: d(1), description: 'Netflix + Spotify subscription', entries: [{ accountName: 'Entertainment', accountType: 'expense', debit: 65, credit: 0 }, { accountName: 'Visa Credit Card', accountType: 'liability', debit: 0, credit: 65 }], transactionId: 'tx-6' },
  { id: 'je-7', date: d(3), description: 'Home loan EMI payment', entries: [{ accountName: 'Loan EMI', accountType: 'expense', debit: 1450, credit: 0 }, { accountName: 'Main Checking', accountType: 'asset', debit: 0, credit: 1450 }], transactionId: 'tx-12' },
  { id: 'je-8', date: d(7), description: 'Dividend payment received', entries: [{ accountName: 'Investment Account', accountType: 'asset', debit: 500, credit: 0 }, { accountName: 'Investment Returns', accountType: 'income', debit: 0, credit: 500 }], transactionId: 'tx-10' },
  { id: 'je-9', date: d(12), description: 'Logo design freelance income', entries: [{ accountName: 'Main Checking', accountType: 'asset', debit: 1200, credit: 0 }, { accountName: 'Freelance Income', accountType: 'income', debit: 0, credit: 1200 }], transactionId: 'tx-15' },
  { id: 'je-10', date: d(10), description: 'AWS online course purchase', entries: [{ accountName: 'Education', accountType: 'expense', debit: 320, credit: 0 }, { accountName: 'Main Checking', accountType: 'asset', debit: 0, credit: 320 }], transactionId: 'tx-14' },
];

export const sampleDocuments: VaultDocument[] = [
  { id: 'doc-1', name: 'Bank Statement Mar 2025', category: 'banking', fileType: 'pdf', size: 245000, tags: ['statement', 'monthly'], createdAt: '2025-03-15', updatedAt: '2025-03-15' },
  { id: 'doc-2', name: 'Tax Return FY2024', category: 'tax', fileType: 'pdf', size: 1200000, tags: ['itr', 'annual'], createdAt: '2025-01-10', updatedAt: '2025-01-10' },
  { id: 'doc-3', name: 'Apartment Deed', category: 'legal', fileType: 'pdf', size: 3500000, tags: ['property', 'deed'], linkedEntityId: 'ast-5', linkedEntityType: 'asset', createdAt: '2021-08-15', updatedAt: '2021-08-15' },
  { id: 'doc-4', name: 'Health Insurance Policy', category: 'personal', fileType: 'pdf', size: 890000, tags: ['insurance', 'health'], createdAt: '2025-01-01', updatedAt: '2025-01-01' },
  { id: 'doc-5', name: 'W-2 Form 2024', category: 'tax', fileType: 'pdf', size: 156000, tags: ['w2', 'income'], createdAt: '2025-02-01', updatedAt: '2025-02-01' },
  { id: 'doc-6', name: 'Car Loan Agreement', category: 'legal', fileType: 'pdf', size: 420000, tags: ['loan', 'auto'], linkedEntityId: 'ast-15', linkedEntityType: 'asset', createdAt: '2022-03-10', updatedAt: '2022-03-10' },
  { id: 'doc-7', name: 'Mortgage Agreement', category: 'legal', fileType: 'pdf', size: 1850000, tags: ['mortgage', 'home'], linkedEntityId: 'ast-5', linkedEntityType: 'asset', createdAt: '2021-08-15', updatedAt: '2021-08-15' },
];

export const sampleAlerts: Alert[] = [
  { id: 'al-1', type: 'budget', title: 'Transport budget at 90%', message: 'You\'ve spent $270 of your $300 transport budget', severity: 'warning', module: 'finance', actionLabel: 'View Budget', actionRoute: '/finance/budgets', timestamp: new Date().toISOString(), read: false },
  { id: 'al-2', type: 'milestone', title: 'Net worth milestone!', message: 'Your net worth grew 8.2% this month', severity: 'success', module: 'ledger', timestamp: new Date().toISOString(), read: false },
  { id: 'al-3', type: 'tax_opportunity', title: 'Potential tax deduction', message: '3 business expenses not tagged as deductible ($485)', severity: 'info', module: 'tax', actionLabel: 'Review', actionRoute: '/tax', timestamp: new Date().toISOString(), read: false },
  { id: 'al-4', type: 'asset_gap', title: 'Missing documentation', message: 'Your Tesla stock has no linked documents', severity: 'info', module: 'vault', actionLabel: 'Upload', actionRoute: '/vault', timestamp: new Date().toISOString(), read: true },
  { id: 'al-5', type: 'low_balance', title: 'Low cash balance', message: 'Cash Wallet balance is below $500', severity: 'warning', module: 'finance', timestamp: new Date().toISOString(), read: false },
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

export const portfolioHistory = [
  { month: 'Oct', value: 38200, invested: 34500 },
  { month: 'Nov', value: 41500, invested: 35800 },
  { month: 'Dec', value: 39800, invested: 36200 },
  { month: 'Jan', value: 44200, invested: 37500 },
  { month: 'Feb', value: 48900, invested: 38200 },
  { month: 'Mar', value: 52400, invested: 39000 },
];
