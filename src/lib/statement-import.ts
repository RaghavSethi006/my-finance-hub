import type { Category, PaymentMethod, TransactionType } from './types';

export interface ParsedStatementEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
  paymentMethod: PaymentMethod;
  raw: string;
}

export interface StatementImportResult {
  entries: ParsedStatementEntry[];
  warnings: string[];
}

type NormalizedRow = Record<string, string>;

const HEADER_ALIASES: Record<string, string> = {
  amount: 'amount',
  credit: 'credit',
  date: 'date',
  debit: 'debit',
  deposit: 'credit',
  description: 'description',
  details: 'description',
  memo: 'description',
  narration: 'description',
  note: 'description',
  particulars: 'description',
  posteddate: 'date',
  postingdate: 'date',
  reference: 'reference',
  remarks: 'description',
  transactionamount: 'amount',
  transactiondate: 'date',
  transactiondetails: 'description',
  type: 'type',
  value: 'amount',
  valuedate: 'date',
  withdrawal: 'debit',
};

const EXPENSE_KEYWORDS = ['amazon', 'atm', 'bill', 'debit', 'food', 'fuel', 'grocery', 'restaurant', 'uber', 'zelle'];
const INCOME_KEYWORDS = ['deposit', 'interest', 'payroll', 'refund', 'salary', 'transfer from', 'upi/cr', 'credit'];

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseDelimitedRows(text: string): string[][] {
  const delimiter = text.includes('\t') ? '\t' : text.includes(';') ? ';' : ',';
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

    if (character === delimiter && !inQuotes) {
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

function parseAmount(value: string): number | undefined {
  if (!value.trim()) {
    return undefined;
  }

  const normalized = value.replace(/[$,\s]/g, '').replace(/[()]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeDate(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parts = trimmed.split(/[/-]/);
  if (parts.length === 3) {
    const [first, second, third] = parts;
    if (first.length === 4) {
      return `${first}-${second.padStart(2, '0')}-${third.padStart(2, '0')}`;
    }

    const year = third.length === 2 ? `20${third}` : third;
    return `${year}-${first.padStart(2, '0')}-${second.padStart(2, '0')}`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString().split('T')[0];
}

function inferType(description: string, amount: number, explicit?: string): TransactionType {
  const normalizedType = explicit?.trim().toLowerCase();
  if (normalizedType?.includes('transfer')) {
    return amount < 0 ? 'expense' : 'income';
  }
  if (normalizedType?.includes('credit') || normalizedType?.includes('deposit')) {
    return 'income';
  }
  if (normalizedType?.includes('debit') || normalizedType?.includes('withdraw')) {
    return 'expense';
  }

  const normalizedDescription = description.toLowerCase();
  if (INCOME_KEYWORDS.some((keyword) => normalizedDescription.includes(keyword))) {
    return 'income';
  }
  if (normalizedDescription.includes('transfer from')) {
    return 'income';
  }
  if (normalizedDescription.includes('transfer to') || normalizedDescription.includes('xfer')) {
    return 'expense';
  }
  if (amount < 0) {
    return 'expense';
  }
  return 'expense';
}

function inferPaymentMethod(description: string): PaymentMethod {
  const normalized = description.toLowerCase();
  if (normalized.includes('upi')) {
    return 'upi';
  }
  if (normalized.includes('neft') || normalized.includes('imps') || normalized.includes('ach') || normalized.includes('wire')) {
    return 'netbanking';
  }
  if (normalized.includes('atm') || normalized.includes('cash')) {
    return 'cash';
  }
  if (normalized.includes('crypto') || normalized.includes('coinbase') || normalized.includes('binance')) {
    return 'crypto';
  }
  return 'card';
}

function toEntry(row: NormalizedRow, rowIndex: number): ParsedStatementEntry | undefined {
  const description = (row.description || row.reference || '').trim();
  const date = normalizeDate(row.date || '');
  const debit = parseAmount(row.debit || '');
  const credit = parseAmount(row.credit || '');
  const amountValue = parseAmount(row.amount || '');
  const amount = typeof credit === 'number' ? credit : typeof debit === 'number' ? debit : amountValue;

  if (!description || !date || typeof amount !== 'number') {
    return undefined;
  }

  const type = inferType(description, amount, row.type);
  const normalizedAmount =
    type === 'income'
      ? Math.abs(amount)
      : type === 'transfer'
        ? Math.abs(amount)
        : Math.abs(debit ?? (amountValue && amountValue < 0 ? amountValue : amount));

  return {
    id: `stmt-row-${rowIndex + 1}-${date}`,
    date,
    description,
    amount: normalizedAmount,
    type,
    paymentMethod: inferPaymentMethod(description),
    raw: Object.values(row).join(' | '),
  };
}

function parseCsvStatement(text: string): StatementImportResult | undefined {
  const rows = parseDelimitedRows(text);
  if (rows.length < 2) {
    return undefined;
  }

  const header = rows[0].map((value) => HEADER_ALIASES[normalizeHeader(value)] ?? '');
  if (!header.some((value) => value === 'date') || !header.some((value) => value === 'description')) {
    return undefined;
  }

  const warnings: string[] = [];
  const entries = rows.slice(1).flatMap((row, rowIndex) => {
    const normalizedRow = row.reduce<NormalizedRow>((current, value, index) => {
      const key = header[index];
      if (key) {
        current[key] = value;
      }
      return current;
    }, {});

    const entry = toEntry(normalizedRow, rowIndex);
    if (!entry) {
      warnings.push(`Skipped statement row ${rowIndex + 2} because the date, description, or amount could not be read.`);
      return [];
    }
    return [entry];
  });

  return { entries, warnings };
}

function parseStatementLine(line: string, rowIndex: number): ParsedStatementEntry | undefined {
  const trimmed = line.trim();
  if (!trimmed) {
    return undefined;
  }

  const match = trimmed.match(
    /^(?<date>\d{1,4}[/-]\d{1,2}[/-]\d{1,4})\s+(?<description>.+?)\s+(?<amount>-?[\d,]+(?:\.\d{1,2})?)\s*(?<kind>CR|DR|CREDIT|DEBIT)?$/i
  );

  if (!match?.groups) {
    return undefined;
  }

  const date = normalizeDate(match.groups.date);
  const amount = parseAmount(match.groups.amount);
  const description = match.groups.description.trim();
  if (!date || typeof amount !== 'number' || !description) {
    return undefined;
  }

  const typeHint = match.groups.kind?.toLowerCase();
  const type = inferType(description, amount, typeHint);

  return {
    id: `stmt-line-${rowIndex + 1}-${date}`,
    date,
    description,
    amount: Math.abs(amount),
    type,
    paymentMethod: inferPaymentMethod(description),
    raw: trimmed,
  };
}

export function parseStatementText(text: string): StatementImportResult {
  const csvResult = parseCsvStatement(text);
  if (csvResult) {
    return csvResult;
  }

  const lines = text.split(/\r?\n/);
  const warnings: string[] = [];
  const entries = lines.flatMap((line, rowIndex) => {
    const entry = parseStatementLine(line, rowIndex);
    if (!entry && line.trim()) {
      warnings.push(`Skipped line ${rowIndex + 1} because it did not match a recognizable statement format.`);
      return [];
    }
    return entry ? [entry] : [];
  });

  return { entries, warnings };
}

export function suggestCategoryId(
  description: string,
  type: TransactionType,
  categories: Category[],
): string | undefined {
  const normalized = description.toLowerCase();
  const matchingCategories = categories.filter((category) => category.type === (type === 'income' ? 'income' : 'expense'));

  const keywordMatches = matchingCategories.find((category) => {
    const name = category.name.toLowerCase();
    return normalized.includes(name) || EXPENSE_KEYWORDS.some((keyword) => normalized.includes(keyword) && name.includes(keyword));
  });

  return keywordMatches?.id ?? matchingCategories[0]?.id;
}
