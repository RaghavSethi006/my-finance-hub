import type { Account, Asset, Category, Loan, Transaction } from './types';

export type DashboardRangePreset = 'this_week' | 'this_month' | 'this_year' | 'last_30_days' | 'all_time' | 'custom';

export interface DashboardRangeSelection {
  preset: DashboardRangePreset;
  customStart?: string;
  customEnd?: string;
}

export interface ResolvedDateRange {
  start: string;
  end: string;
  label: string;
}

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short' });
}

function formatDay(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getStartOfWeek(date: Date): Date {
  const current = startOfDay(date);
  const dayOffset = (current.getDay() + 6) % 7;
  current.setDate(current.getDate() - dayOffset);
  return current;
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getYearStart(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function dayDifference(start: Date, end: Date): number {
  return Math.max(1, Math.round((endOfDay(end).getTime() - startOfDay(start).getTime()) / 86400000) + 1);
}

export function resolveDashboardRange(
  selection: DashboardRangeSelection,
  transactions: Transaction[],
  today = new Date()
): ResolvedDateRange {
  const current = startOfDay(today);
  const todayIso = isoDate(current);
  const earliestTransaction = [...transactions]
    .sort((left, right) => left.date.localeCompare(right.date))
    .find(Boolean);

  if (selection.preset === 'custom') {
    const start = selection.customStart || earliestTransaction?.date || todayIso;
    const end = selection.customEnd || todayIso;
    return {
      start: start <= end ? start : end,
      end: end >= start ? end : start,
      label: 'Custom range',
    };
  }

  if (selection.preset === 'this_week') {
    return {
      start: isoDate(getStartOfWeek(current)),
      end: todayIso,
      label: 'This week',
    };
  }

  if (selection.preset === 'this_month') {
    return {
      start: isoDate(getMonthStart(current)),
      end: todayIso,
      label: 'This month',
    };
  }

  if (selection.preset === 'this_year') {
    return {
      start: isoDate(getYearStart(current)),
      end: todayIso,
      label: 'This year',
    };
  }

  if (selection.preset === 'last_30_days') {
    return {
      start: isoDate(addDays(current, -29)),
      end: todayIso,
      label: 'Last 30 days',
    };
  }

  return {
    start: earliestTransaction?.date || todayIso,
    end: todayIso,
    label: 'All time',
  };
}

export function filterTransactionsByRange(transactions: Transaction[], range: ResolvedDateRange) {
  return transactions.filter((transaction) => transaction.date >= range.start && transaction.date <= range.end);
}

export function summarizeTransactions(transactions: Transaction[]) {
  const income = transactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const expenses = transactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const transfers = transactions
    .filter((transaction) => transaction.type === 'transfer')
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  return {
    income,
    expenses,
    transfers,
    savings: income - expenses,
    savingsRate: income > 0 ? ((income - expenses) / income) * 100 : 0,
  };
}

function buildBucketRange(range: ResolvedDateRange, transactions: Transaction[]) {
  const start = parseDate(range.start);
  const end = parseDate(range.end);
  const totalDays = dayDifference(start, end);

  if (totalDays <= 45) {
    const buckets = [];
    for (let cursor = startOfDay(start); cursor <= endOfDay(end); cursor = addDays(cursor, 1)) {
      buckets.push({
        key: isoDate(cursor),
        label: formatDay(cursor),
        start: startOfDay(cursor),
        end: endOfDay(cursor),
      });
    }
    return buckets;
  }

  if (totalDays <= 180) {
    const buckets = [];
    for (let cursor = getStartOfWeek(start); cursor <= endOfDay(end); cursor = addDays(cursor, 7)) {
      const bucketStart = startOfDay(cursor < start ? start : cursor);
      const bucketEndCandidate = addDays(cursor, 6);
      const bucketEnd = endOfDay(bucketEndCandidate > end ? end : bucketEndCandidate);
      buckets.push({
        key: isoDate(bucketStart),
        label: formatDay(bucketStart),
        start: bucketStart,
        end: bucketEnd,
      });
    }
    return buckets;
  }

  const buckets = [];
  for (let cursor = getMonthStart(start); cursor <= endOfDay(end); cursor = addMonths(cursor, 1)) {
    const bucketStart = cursor < start ? startOfDay(start) : startOfDay(cursor);
    const bucketEnd = endOfDay(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0));
    buckets.push({
      key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`,
      label: formatMonth(cursor),
      start: bucketStart,
      end: bucketEnd > end ? endOfDay(end) : bucketEnd,
    });
  }
  return buckets;
}

type CategorySeriesMeta = {
  id: string;
  key: string;
  label: string;
  color: string;
};

export function buildExpenseCategorySeries(
  transactions: Transaction[],
  categories: Category[],
  range: ResolvedDateRange,
  maxCategories = 5
) {
  const expenseTransactions = transactions.filter((transaction) => transaction.type === 'expense');
  const categoryTotals = expenseTransactions.reduce((accumulator, transaction) => {
    accumulator.set(
      transaction.categoryId,
      (accumulator.get(transaction.categoryId) ?? 0) + transaction.amount
    );
    return accumulator;
  }, new Map<string, number>());

  const sortedCategoryIds = [...categoryTotals.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([categoryId]) => categoryId);

  const topCategoryIds = sortedCategoryIds.slice(0, maxCategories);
  const categoryMeta: CategorySeriesMeta[] = topCategoryIds.map((categoryId, index) => {
    const category = categories.find((item) => item.id === categoryId);
    return {
      id: categoryId,
      key: categoryId,
      label: category?.name ?? `Category ${index + 1}`,
      color: category?.color ?? `hsl(${(index * 57) % 360} 70% 50%)`,
    };
  });

  const hasOther = sortedCategoryIds.length > topCategoryIds.length;
  if (hasOther) {
    categoryMeta.push({
      id: '__other__',
      key: '__other__',
      label: 'Other',
      color: 'hsl(220 8% 50%)',
    });
  }

  const buckets = buildBucketRange(range, expenseTransactions);
  const amountSeries = buckets.map((bucket) => {
    const bucketTransactions = expenseTransactions.filter((transaction) => {
      const date = parseDate(transaction.date).getTime();
      return date >= bucket.start.getTime() && date <= bucket.end.getTime();
    });

    const point: Record<string, number | string> = {
      period: bucket.label,
      total: bucketTransactions.reduce((sum, transaction) => sum + transaction.amount, 0),
    };

    for (const meta of categoryMeta) {
      point[meta.key] = 0;
    }

    for (const transaction of bucketTransactions) {
      const targetKey = topCategoryIds.includes(transaction.categoryId) ? transaction.categoryId : '__other__';
      if (point[targetKey] !== undefined) {
        point[targetKey] = Number(point[targetKey]) + transaction.amount;
      }
    }

    return point;
  });

  const shareSeries = amountSeries.map((point) => {
    const total = Number(point.total) || 0;
    const nextPoint: Record<string, number | string> = {
      period: point.period,
      total,
    };

    for (const meta of categoryMeta) {
      nextPoint[meta.key] = total > 0 ? (Number(point[meta.key]) / total) * 100 : 0;
    }

    return nextPoint;
  });

  const distribution = categoryMeta
    .map((meta) => ({
      key: meta.key,
      name: meta.label,
      value: expenseTransactions
        .filter((transaction) =>
          meta.key === '__other__' ? !topCategoryIds.includes(transaction.categoryId) : transaction.categoryId === meta.id
        )
        .reduce((sum, transaction) => sum + transaction.amount, 0),
      color: meta.color,
    }))
    .filter((entry) => entry.value > 0);

  return {
    categories: categoryMeta,
    amountSeries,
    shareSeries,
    distribution,
  };
}

export function buildIncomeExpenseSeries(transactions: Transaction[], range: ResolvedDateRange) {
  const buckets = buildBucketRange(range, transactions);
  return buckets.map((bucket) => {
    const bucketTransactions = transactions.filter((transaction) => {
      const date = parseDate(transaction.date).getTime();
      return date >= bucket.start.getTime() && date <= bucket.end.getTime();
    });

    return {
      period: bucket.label,
      income: bucketTransactions
        .filter((transaction) => transaction.type === 'income')
        .reduce((sum, transaction) => sum + transaction.amount, 0),
      expenses: bucketTransactions
        .filter((transaction) => transaction.type === 'expense')
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    };
  });
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
      label: formatMonth(date),
      end: endOfMonth(date),
    };
  });
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
