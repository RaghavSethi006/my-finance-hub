import { formatCurrency } from './currency';
import type { Account, Asset, AssetValueLog, Category, Loan, RecurringTemplate, Transaction, VaultDocument } from './types';

export type DashboardRangePreset = 'this_week' | 'this_month' | 'this_year' | 'last_30_days' | 'all_time' | 'custom';
export type MarketRangePreset = 'live' | '1h' | '1d' | '1w' | '1m' | '1y' | 'all' | 'custom';

export interface MarketRangeSelection {
  preset: MarketRangePreset;
  customStart?: string;
  customEnd?: string;
}

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

export interface SmartInsight {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'success' | 'error';
  module: 'finance' | 'ledger' | 'assets' | 'vault' | 'tax';
  actionRoute?: string;
}

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function parseLogDateTime(log: Pick<AssetValueLog, 'date' | 'timestamp'>): Date {
  const parsed = new Date(log.timestamp ?? `${log.date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? parseDate(log.date) : parsed;
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

function assetTypeLabel(asset: Asset): string {
  if (asset.type === 'stock') return 'Stocks';
  if (asset.type === 'mutual_fund') return 'Mutual Funds';
  if (asset.type === 'crypto') return 'Crypto';
  if (asset.type === 'real_estate') return 'Real Estate';
  if (asset.type === 'gold') return 'Gold';
  if (asset.type === 'vehicle') return 'Vehicles';
  return 'Other';
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

function formatMarketTime(date: Date, range: MarketRangePreset): string {
  if (range === 'live' || range === '1h' || range === '1d') {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  if (range === '1w' || range === '1m') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function resolveMarketRange(selection: MarketRangeSelection, logs: Array<Pick<AssetValueLog, 'date' | 'timestamp'>>, now = new Date()) {
  const end = selection.preset === 'custom' && selection.customEnd ? endOfDay(parseDate(selection.customEnd)) : now;
  let start: Date | undefined;

  if (selection.preset === 'live') start = new Date(end.getTime() - 15 * 60 * 1000);
  if (selection.preset === '1h') start = new Date(end.getTime() - 60 * 60 * 1000);
  if (selection.preset === '1d') start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  if (selection.preset === '1w') start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (selection.preset === '1m') start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (selection.preset === '1y') start = new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000);
  if (selection.preset === 'custom') start = selection.customStart ? startOfDay(parseDate(selection.customStart)) : undefined;

  if (!start) {
    const firstLog = [...logs].sort((left, right) => parseLogDateTime(left).getTime() - parseLogDateTime(right).getTime())[0];
    start = firstLog ? parseLogDateTime(firstLog) : startOfDay(end);
  }

  return { start, end };
}

function getAssetLogs(asset: Asset): AssetValueLog[] {
  return asset.valueLogs && asset.valueLogs.length > 0
    ? asset.valueLogs
    : [
        {
          id: `${asset.id}-current`,
          date: asset.purchaseDate,
          price: asset.currentPrice,
          note: 'Current value snapshot',
          source: 'system',
        },
      ];
}

export function buildAssetValueSeries(asset: Asset, selection: MarketRangeSelection = { preset: 'all' }) {
  const logs = getAssetLogs(asset);
  const range = resolveMarketRange(selection, logs);
  const valueLogs = [...logs]
    .filter((log) => {
      const timestamp = parseLogDateTime(log).getTime();
      return timestamp >= range.start.getTime() && timestamp <= range.end.getTime();
    })
    .sort((left, right) => parseLogDateTime(left).getTime() - parseLogDateTime(right).getTime())
    .map((log) => ({
      date: log.date,
      timestamp: log.timestamp ?? `${log.date}T00:00:00`,
      label: formatMarketTime(parseLogDateTime(log), selection.preset),
      price: log.price,
      totalValue: log.price * asset.quantity,
      note: log.note,
      source: log.source,
    }));

  if (valueLogs.length > 0) {
    return valueLogs;
  }

  return [
    {
      date: asset.purchaseDate,
      timestamp: `${asset.purchaseDate}T00:00:00`,
      label: formatMarketTime(parseDate(asset.purchaseDate), selection.preset),
      price: asset.currentPrice,
      totalValue: asset.currentPrice * asset.quantity,
      note: 'Current value snapshot',
      source: 'system' as const,
    },
  ];
}

export function buildPortfolioMarketSeries(assets: Asset[], selection: MarketRangeSelection) {
  const allLogs = assets.flatMap((asset) => getAssetLogs(asset));
  const range = resolveMarketRange(selection, allLogs);
  const timestamps = new Set<number>([range.start.getTime(), range.end.getTime()]);

  assets.forEach((asset) => {
    getAssetLogs(asset).forEach((log) => {
      const timestamp = parseLogDateTime(log).getTime();
      if (timestamp >= range.start.getTime() && timestamp <= range.end.getTime()) {
        timestamps.add(timestamp);
      }
    });
  });

  return [...timestamps]
    .sort((left, right) => left - right)
    .map((timestamp) => {
      const date = new Date(timestamp);
      let value = 0;
      let invested = 0;
      let updates = 0;

      assets.forEach((asset) => {
        const logs = getAssetLogs(asset).sort((left, right) => parseLogDateTime(left).getTime() - parseLogDateTime(right).getTime());
        const activeLogs = logs.filter((log) => parseLogDateTime(log).getTime() <= timestamp);
        const latestLog = activeLogs[activeLogs.length - 1] ?? logs[0];
        value += (latestLog?.price ?? asset.currentPrice) * asset.quantity;
        invested += asset.buyPrice * asset.quantity;
        updates += logs.filter((log) => parseLogDateTime(log).getTime() === timestamp).length;
      });

      return {
        timestamp: date.toISOString(),
        label: formatMarketTime(date, selection.preset),
        value,
        invested,
        updates,
      };
    });
}

export function calculateAssetDepreciation(asset: Asset, asOf = new Date()) {
  const isPhysical = ['real_estate', 'vehicle', 'gold', 'other'].includes(asset.type);
  if (!isPhysical) {
    return null;
  }

  const salvageValue = asset.salvageValue ?? 0;
  const usefulLifeYears = asset.usefulLifeYears ?? 0;
  const purchaseDate = parseDate(asset.purchaseDate);
  const elapsedYears = Math.max(0, (asOf.getTime() - purchaseDate.getTime()) / (365.25 * 86400000));
  const annualRate = asset.annualDepreciationRate ?? (usefulLifeYears > 0 ? ((asset.buyPrice - salvageValue) / asset.buyPrice) * (100 / usefulLifeYears) : 0);

  const annualDepreciation = usefulLifeYears > 0
    ? Math.max(0, (asset.buyPrice - salvageValue) / usefulLifeYears)
    : (asset.buyPrice * annualRate) / 100;
  const accumulatedDepreciation = Math.min(
    Math.max(0, asset.buyPrice - salvageValue),
    annualDepreciation * elapsedYears
  );
  const bookValue = Math.max(salvageValue, asset.buyPrice - accumulatedDepreciation);
  const marketDelta = asset.currentPrice - bookValue;
  const progressPercent =
    asset.buyPrice > salvageValue ? (accumulatedDepreciation / Math.max(1, asset.buyPrice - salvageValue)) * 100 : 0;

  return {
    annualRate,
    annualDepreciation,
    monthlyDepreciation: annualDepreciation / 12,
    accumulatedDepreciation,
    bookValue,
    marketDelta,
    salvageValue,
    usefulLifeYears,
    progressPercent: Math.min(100, progressPercent),
  };
}

export function buildTimeframeAssetAllocation(assets: Asset[], range: ResolvedDateRange) {
  const scopedAssets = assets.filter((asset) => asset.purchaseDate >= range.start && asset.purchaseDate <= range.end);
  const useScopedPurchases = range.label !== 'All time';
  const allocationSource = useScopedPurchases ? scopedAssets : assets;

  const data = allocationSource.reduce((accumulator, asset) => {
    const name = assetTypeLabel(asset);
    const existing = accumulator.find((entry) => entry.name === name);
    const value = useScopedPurchases ? asset.buyPrice * asset.quantity : asset.currentPrice * asset.quantity;

    if (existing) {
      existing.value += value;
    } else {
      accumulator.push({ name, value });
    }

    return accumulator;
  }, [] as Array<{ name: string; value: number }>);

  return {
    data,
    title: useScopedPurchases ? `Capital Allocated (${range.label})` : 'Asset Allocation',
    subtitle: useScopedPurchases
      ? scopedAssets.length > 0
        ? `Based on assets added between ${range.start} and ${range.end}.`
        : `No assets were added between ${range.start} and ${range.end}.`
      : 'Current holdings grouped by asset type.',
    emptyLabel: useScopedPurchases
      ? 'No asset purchases were recorded in this range yet.'
      : 'No assets recorded yet.',
  };
}

export function buildSmartInsights({
  accounts,
  assets,
  budgets,
  categories,
  defaultCurrency,
  documents,
  loans,
  range,
  recurringTemplates,
  transactions,
}: {
  accounts: Account[];
  assets: Asset[];
  budgets: { amount: number; spent: number; alertThreshold: number; categoryId: string }[];
  categories: Category[];
  defaultCurrency: string;
  documents: VaultDocument[];
  loans: Loan[];
  range: ResolvedDateRange;
  recurringTemplates: RecurringTemplate[];
  transactions: Transaction[];
}): SmartInsight[] {
  const insights: SmartInsight[] = [];
  const rangeTransactions = filterTransactionsByRange(transactions, range);
  const rangeSummary = summarizeTransactions(rangeTransactions);
  const liquidAccounts = accounts.filter((account) => account.type === 'bank' || account.type === 'cash');
  const lowBalanceFloor = Math.max(250, rangeSummary.expenses * 0.15);
  const lowBalanceAccounts = liquidAccounts.filter((account) => account.balance <= lowBalanceFloor);

  if (lowBalanceAccounts.length > 0) {
    const account = lowBalanceAccounts[0];
    insights.push({
      id: `low-balance-${account.id}`,
      title: 'Low balance warning',
      message:
        lowBalanceAccounts.length === 1
          ? `${account.name} is down to ${formatCurrency(account.balance, account.currency)}.`
          : `${lowBalanceAccounts.length} liquid accounts are near your low-balance threshold.`,
      severity: 'warning',
      module: 'finance',
      actionRoute: '/finance',
    });
  }

  const stressedBudgets = budgets
    .map((budget) => ({
      ...budget,
      percentage: budget.amount > 0 ? (budget.spent / budget.amount) * 100 : 0,
      name: categories.find((category) => category.id === budget.categoryId)?.name ?? 'Budget',
    }))
    .filter((budget) => budget.percentage >= budget.alertThreshold)
    .sort((left, right) => right.percentage - left.percentage);

  if (stressedBudgets.length > 0) {
    const budget = stressedBudgets[0];
    insights.push({
      id: `budget-${budget.categoryId}`,
      title: budget.percentage >= 100 ? 'Budget exceeded' : 'Budget nearly exhausted',
      message: `${budget.name} is at ${budget.percentage.toFixed(0)}% of plan this month.`,
      severity: budget.percentage >= 100 ? 'error' : 'warning',
      module: 'finance',
      actionRoute: '/finance',
    });
  }

  const deductibleCandidates = rangeTransactions.filter(
    (transaction) => transaction.taxTag === 'business' && !transaction.isDeductible
  );
  if (deductibleCandidates.length > 0) {
    const total = deductibleCandidates.reduce((sum, transaction) => sum + transaction.amount, 0);
    insights.push({
      id: 'tax-opportunity',
      title: 'Tax opportunity detected',
      message: `${deductibleCandidates.length} business transaction${deductibleCandidates.length === 1 ? '' : 's'} worth ${formatCurrency(total, defaultCurrency)} still need deduction review.`,
      severity: 'info',
      module: 'tax',
      actionRoute: '/tax',
    });
  }

  const unlinkedTaxDocuments = documents.filter(
    (document) => document.category === 'tax' && (!document.linkedEntityId || !document.linkedEntityType)
  );
  if (unlinkedTaxDocuments.length > 0) {
    insights.push({
      id: 'unlinked-tax-docs',
      title: 'Tax documents need linking',
      message: `${unlinkedTaxDocuments.length} tax document${unlinkedTaxDocuments.length === 1 ? '' : 's'} are still unlinked to a transaction, account, or asset.`,
      severity: 'info',
      module: 'tax',
      actionRoute: '/vault',
    });
  }

  const documentedAssetIds = new Set(
    documents
      .filter((document) => document.linkedEntityType === 'asset' && document.linkedEntityId)
      .map((document) => document.linkedEntityId as string)
  );
  const undocumentedAssets = assets.filter((asset) => !documentedAssetIds.has(asset.id));
  if (undocumentedAssets.length > 0) {
    insights.push({
      id: 'asset-doc-gap',
      title: 'Asset documentation gap',
      message: `${undocumentedAssets.length} asset${undocumentedAssets.length === 1 ? '' : 's'} do not have supporting documents in the vault.`,
      severity: 'warning',
      module: 'vault',
      actionRoute: '/assets',
    });
  }

  const today = new Date().toISOString().split('T')[0];
  const overdueRecurring = recurringTemplates.filter((template) => !template.isPaused && template.nextDate < today);
  if (overdueRecurring.length > 0) {
    insights.push({
      id: 'overdue-recurring',
      title: 'Recurring items are overdue',
      message: `${overdueRecurring.length} recurring template${overdueRecurring.length === 1 ? '' : 's'} should have fired before today.`,
      severity: 'warning',
      module: 'finance',
      actionRoute: '/finance',
    });
  }

  const assetValue = assets.reduce((sum, asset) => sum + asset.currentPrice * asset.quantity, 0);
  const cashValue = accounts.reduce((sum, account) => sum + account.balance, 0);
  const liabilityValue = loans
    .filter((loan) => loan.status === 'active')
    .reduce((sum, loan) => sum + loan.outstandingAmount, 0);
  const netWorth = cashValue + assetValue - liabilityValue;
  const milestone = Math.floor(netWorth / 25000) * 25000;

  if (milestone >= 25000) {
    insights.push({
      id: 'net-worth-milestone',
      title: 'Net worth milestone',
      message: `You are currently above the ${formatCurrency(milestone, defaultCurrency)} net-worth mark.`,
      severity: 'success',
      module: 'ledger',
      actionRoute: '/ledger',
    });
  }

  return insights.slice(0, 6);
}
