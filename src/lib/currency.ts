import { Currency, CURRENCY_CONFIG } from './types';

export function formatCurrency(amount: number, currency: Currency = 'USD'): string {
  const config = CURRENCY_CONFIG[currency];
  const absAmount = Math.abs(amount);
  
  // Compact formatting for large numbers
  if (absAmount >= 10000000) {
    return `${amount < 0 ? '-' : ''}${config.symbol}${(absAmount / 1000000).toFixed(1)}M`;
  }
  if (absAmount >= 100000) {
    return `${amount < 0 ? '-' : ''}${config.symbol}${(absAmount / 1000).toFixed(0)}K`;
  }
  
  try {
    return new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: currency === 'JPY' ? 0 : 2,
      maximumFractionDigits: currency === 'JPY' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${config.symbol}${amount.toFixed(2)}`;
  }
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

export function formatCompactNumber(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}
