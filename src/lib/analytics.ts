import type { Account, Asset, Loan, Transaction } from './types';

type MonthPoint = {
  month: string;
};

function monthLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short' });
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function buildMonthRange(months: number): { key: string; label: string; end: Date }[] {
  const current = new Date();
  return Array.from({ length: months }, (_, index) => {
    const date = new Date(current.getFullYear(), current.getMonth() - (months - index - 1), 1);
    return {
      key: monthKey(date),
      label: monthLabel(date),
      end: endOfMonth(date),
    };
  });
}

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

export function buildMonthlyIncomeExpenseSeries(transactions: Transaction[], months = 6) {
  const monthsRange = buildMonthRange(months);
  return monthsRange.map(({ key, label }) => {
    const monthTransactions = transactions.filter((transaction) => transaction.date.startsWith(key));
    return {
      month: label,
      income: monthTransactions
        .filter((transaction) => transaction.type === 'income')
        .reduce((sum, transaction) => sum + transaction.amount, 0),
      expenses: monthTransactions
        .filter((transaction) => transaction.type === 'expense')
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    };
  });
}

export function buildNetWorthHistory(
  accounts: Account[],
  assets: Asset[],
  loans: Loan[],
  transactions: Transaction[],
  months = 6
) {
  const monthsRange = buildMonthRange(months);
  const currentAccountBalance = accounts.reduce((sum, account) => sum + account.balance, 0);

  return monthsRange.map(({ label, end }) => {
    const laterTransactions = transactions.filter((transaction) => parseDate(transaction.date).getTime() > end.getTime());
    const accountBalanceAtMonthEnd = laterTransactions.reduce((sum, transaction) => {
      if (transaction.type === 'income') {
        return sum - transaction.amount;
      }
      if (transaction.type === 'expense') {
        return sum + transaction.amount;
      }
      return sum;
    }, currentAccountBalance);

    const assetValue = assets
      .filter((asset) => parseDate(asset.purchaseDate).getTime() <= end.getTime())
      .reduce((sum, asset) => sum + asset.currentPrice * asset.quantity, 0);

    const liabilities = loans
      .filter((loan) => parseDate(loan.startDate).getTime() <= end.getTime() && loan.status === 'active')
      .reduce((sum, loan) => sum + loan.outstandingAmount, 0);

    return {
      month: label,
      assets: accountBalanceAtMonthEnd + assetValue,
      liabilities,
      netWorth: accountBalanceAtMonthEnd + assetValue - liabilities,
    };
  });
}

export function buildPortfolioHistory(assets: Asset[], months = 6) {
  const monthsRange = buildMonthRange(months);
  return monthsRange.map(({ label, end }) => {
    const activeAssets = assets.filter((asset) => parseDate(asset.purchaseDate).getTime() <= end.getTime());
    return {
      month: label,
      value: activeAssets.reduce((sum, asset) => sum + asset.currentPrice * asset.quantity, 0),
      invested: activeAssets.reduce((sum, asset) => sum + asset.buyPrice * asset.quantity, 0),
    };
  });
}
