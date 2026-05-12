import type { Asset, AssetType, Currency } from './types';

export type ImportedAssetDraft = Omit<Asset, 'id'>;

export type AssetImportResult = {
  assets: ImportedAssetDraft[];
  errors: string[];
  totalRows: number;
};

const HEADER_ALIASES: Record<string, keyof ImportedAssetDraft | 'skip'> = {
  asset: 'name',
  assetname: 'name',
  assettype: 'type',
  averagebuy: 'buyPrice',
  averagecost: 'buyPrice',
  avgbuy: 'buyPrice',
  avgcost: 'buyPrice',
  buy: 'buyPrice',
  buyprice: 'buyPrice',
  costbasis: 'buyPrice',
  costprice: 'buyPrice',
  current: 'currentPrice',
  currentprice: 'currentPrice',
  currency: 'currency',
  exchange: 'exchange',
  fundhouse: 'fundHouse',
  marketprice: 'currentPrice',
  monthlysip: 'sipAmount',
  name: 'name',
  nav: 'currentPrice',
  notes: 'notes',
  portfolio: 'skip',
  purchasedate: 'purchaseDate',
  price: 'currentPrice',
  qty: 'quantity',
  quantity: 'quantity',
  shares: 'quantity',
  sip: 'sipAmount',
  sipamount: 'sipAmount',
  symbol: 'ticker',
  ticker: 'ticker',
  type: 'type',
  units: 'quantity',
};

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let currentCell = '';
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        currentCell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === ',' && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
      continue;
    }

    if ((character === '\n' || character === '\r') && !inQuotes) {
      if (character === '\r' && nextCharacter === '\n') {
        index += 1;
      }
      currentRow.push(currentCell.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentCell = '';
      currentRow = [];
      continue;
    }

    currentCell += character;
  }

  currentRow.push(currentCell.trim());
  if (currentRow.some((cell) => cell.length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}

function parseNumber(value: string): number | undefined {
  if (!value.trim()) {
    return undefined;
  }

  const normalized = value.replace(/[$,\s]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeAssetType(value: string): AssetType {
  const normalized = normalizeHeader(value);
  if (normalized === 'stock' || normalized === 'stocks' || normalized === 'equity' || normalized === 'etf') {
    return 'stock';
  }
  if (normalized === 'mutualfund' || normalized === 'mutualfunds' || normalized === 'mf' || normalized === 'fund') {
    return 'mutual_fund';
  }
  if (normalized === 'crypto' || normalized === 'cryptocurrency' || normalized === 'coin' || normalized === 'token') {
    return 'crypto';
  }
  if (normalized === 'realestate' || normalized === 'property' || normalized === 'house') {
    return 'real_estate';
  }
  if (normalized === 'vehicle' || normalized === 'car' || normalized === 'auto') {
    return 'vehicle';
  }
  if (normalized === 'gold' || normalized === 'bullion') {
    return 'gold';
  }
  return 'other';
}

function normalizeCurrency(value: string, fallback: Currency): Currency {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'USD' || normalized === 'CAD' || normalized === 'INR' || normalized === 'GBP' || normalized === 'EUR' || normalized === 'JPY' || normalized === 'CNY' || normalized === 'AED' || normalized === 'KWD') {
    return normalized;
  }
  return fallback;
}

function normalizeDate(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString().split('T')[0];
}

export function parseAssetCsv(csvText: string, defaultCurrency: Currency): AssetImportResult {
  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    return {
      assets: [],
      errors: ['The CSV file is empty.'],
      totalRows: 0,
    };
  }

  const [headerRow, ...dataRows] = rows;
  const columnMap = headerRow.map((header) => HEADER_ALIASES[normalizeHeader(header)] ?? 'skip');
  const today = new Date().toISOString().split('T')[0];
  const assets: ImportedAssetDraft[] = [];
  const errors: string[] = [];

  dataRows.forEach((row, rowIndex) => {
    const values: Partial<ImportedAssetDraft> = {};

    row.forEach((cell, index) => {
      const mappedColumn = columnMap[index];
      if (!mappedColumn || mappedColumn === 'skip') {
        return;
      }

      if (mappedColumn === 'type') {
        values.type = normalizeAssetType(cell);
        return;
      }

      if (mappedColumn === 'currency') {
        values.currency = normalizeCurrency(cell, defaultCurrency);
        return;
      }

      if (mappedColumn === 'purchaseDate') {
        values.purchaseDate = normalizeDate(cell) ?? today;
        return;
      }

      if (mappedColumn === 'quantity' || mappedColumn === 'buyPrice' || mappedColumn === 'currentPrice' || mappedColumn === 'sipAmount') {
        const parsed = parseNumber(cell);
        if (typeof parsed !== 'undefined') {
          values[mappedColumn] = parsed as never;
        }
        return;
      }

      const trimmed = cell.trim();
      if (trimmed) {
        values[mappedColumn] = trimmed as never;
      }
    });

    const name = values.name?.trim() || values.ticker?.trim();
    const quantity = values.quantity;
    const buyPrice = values.buyPrice;
    const currentPrice = values.currentPrice ?? values.buyPrice;

    if (!name) {
      errors.push(`Row ${rowIndex + 2}: missing asset name or ticker.`);
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      errors.push(`Row ${rowIndex + 2}: quantity must be greater than zero.`);
      return;
    }

    if (!Number.isFinite(buyPrice) || buyPrice < 0) {
      errors.push(`Row ${rowIndex + 2}: buy price is invalid.`);
      return;
    }

    if (!Number.isFinite(currentPrice) || currentPrice < 0) {
      errors.push(`Row ${rowIndex + 2}: current price is invalid.`);
      return;
    }

    const type = values.type ?? (values.ticker ? 'stock' : 'other');

    assets.push({
      name,
      type,
      ticker: values.ticker?.trim() || undefined,
      exchange: values.exchange?.trim() || undefined,
      quantity,
      buyPrice,
      currentPrice,
      currency: values.currency ?? defaultCurrency,
      purchaseDate: values.purchaseDate ?? today,
      notes: values.notes?.trim() || undefined,
      fundHouse: type === 'mutual_fund' ? values.fundHouse?.trim() || undefined : undefined,
      nav: type === 'mutual_fund' ? currentPrice : undefined,
      sipAmount: type === 'mutual_fund' && Number.isFinite(values.sipAmount) ? values.sipAmount : undefined,
    });
  });

  return {
    assets,
    errors,
    totalRows: dataRows.length,
  };
}
