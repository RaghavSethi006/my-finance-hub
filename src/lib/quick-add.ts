import type { Account, Category, Currency, PaymentMethod, RecurringFrequency, TaxTag, TransactionType } from "./types";

type QuickAddAccount = Pick<Account, "id" | "name" | "bankName">;
type QuickAddCategory = Pick<Category, "id" | "name" | "type">;

export interface ParsedQuickAddTransaction {
  amount: number | null;
  type: TransactionType;
  currency: Currency;
  date: string;
  note: string;
  paymentMethod: PaymentMethod;
  taxTag: TaxTag;
  isDeductible: boolean;
  isRecurring: boolean;
  frequency: RecurringFrequency;
  accountId?: string;
  toAccountId?: string;
  categoryId?: string;
  warnings: string[];
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Food & Dining": ["food", "dining", "grocery", "groceries", "restaurant", "lunch", "dinner", "coffee", "cafe", "meal"],
  Rent: ["rent", "lease"],
  Transport: ["uber", "lyft", "taxi", "cab", "train", "metro", "fuel", "gas", "parking", "flight", "bus"],
  Entertainment: ["netflix", "spotify", "movie", "game", "concert", "entertainment"],
  Health: ["health", "medical", "doctor", "pharmacy", "hospital", "medicine", "clinic"],
  Shopping: ["shopping", "amazon", "order", "mall", "purchase"],
  Utilities: ["utility", "electric", "electricity", "internet", "wifi", "water", "phone", "bill"],
  Salary: ["salary", "payroll", "paycheck", "bonus"],
  Freelance: ["freelance", "client", "invoice", "project", "contract"],
  "Investment Returns": ["dividend", "interest", "investment", "return", "capital gain"],
  Education: ["education", "course", "tuition", "book", "school", "training"],
  Subscriptions: ["subscription", "recurring", "membership", "plan", "monthly"],
  Insurance: ["insurance", "premium"],
  "Loan EMI": ["emi", "loan"],
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDateFromText(input: string, today: Date) {
  const lower = input.toLowerCase();
  if (lower.includes("yesterday")) {
    const date = new Date(today);
    date.setDate(date.getDate() - 1);
    return isoDate(date);
  }
  if (lower.includes("today")) {
    return isoDate(today);
  }

  const explicitDate = input.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (explicitDate) {
    const [, year, month, day] = explicitDate;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return isoDate(today);
}

function parseCurrencyFromText(input: string, fallback: Currency): Currency {
  const upper = input.toUpperCase();
  if (input.includes("₹") || upper.includes(" INR")) return "INR";
  if (input.includes("£") || upper.includes(" GBP")) return "GBP";
  if (input.includes("€") || upper.includes(" EUR")) return "EUR";
  if (upper.includes(" CAD") || upper.includes(" C$")) return "CAD";
  if (upper.includes(" AED")) return "AED";
  if (upper.includes(" KWD")) return "KWD";
  if (upper.includes(" JPY")) return "JPY";
  if (upper.includes(" CNY")) return "CNY";
  if (input.includes("$") || upper.includes(" USD")) return "USD";
  return fallback;
}

function parseAmountFromText(input: string) {
  const amountMatch = input.match(/(?:[$₹£€]|(?:\bUSD\b|\bCAD\b|\bINR\b|\bGBP\b|\bEUR\b|\bJPY\b|\bCNY\b|\bAED\b|\bKWD\b)\s*)?(\d+(?:\.\d{1,2})?)/i);
  return amountMatch ? parseFloat(amountMatch[1]) : null;
}

function inferType(input: string): TransactionType {
  const lower = input.toLowerCase();
  if (/\btransfer\b|\bmove\b|\bmoved\b|\bsent\b/.test(lower) && /\bto\b/.test(lower)) {
    return "transfer";
  }
  if (/\bsalary\b|\bpaid me\b|\breceived\b|\bgot paid\b|\bearned\b|\bincome\b|\brefund\b|\bdividend\b|\bbonus\b/.test(lower)) {
    return "income";
  }
  return "expense";
}

function inferPaymentMethod(input: string): PaymentMethod {
  const lower = input.toLowerCase();
  if (lower.includes("upi")) return "upi";
  if (lower.includes("netbanking") || lower.includes("bank transfer")) return "netbanking";
  if (lower.includes("cash")) return "cash";
  if (lower.includes("crypto") || lower.includes("btc") || lower.includes("eth")) return "crypto";
  return "card";
}

function inferFrequency(input: string): { isRecurring: boolean; frequency: RecurringFrequency } {
  const lower = input.toLowerCase();
  if (/\bdaily\b|\bevery day\b/.test(lower)) return { isRecurring: true, frequency: "daily" };
  if (/\bweekly\b|\bevery week\b/.test(lower)) return { isRecurring: true, frequency: "weekly" };
  if (/\byearly\b|\bannual\b|\bannually\b|\bevery year\b/.test(lower)) return { isRecurring: true, frequency: "yearly" };
  if (/\bmonthly\b|\bevery month\b|\brecurring\b|\bsubscription\b/.test(lower)) {
    return { isRecurring: true, frequency: "monthly" };
  }
  return { isRecurring: false, frequency: "monthly" };
}

function inferTaxTag(input: string): TaxTag {
  const lower = input.toLowerCase();
  if (/\bbusiness\b|\bclient\b|\boffice\b|\bcompany\b|\bwork\b/.test(lower)) return "business";
  if (/\bpersonal\b|\bfamily\b|\bhome\b/.test(lower)) return "personal";
  return "untagged";
}

function scoreAccountMatch(haystack: string, account: QuickAddAccount) {
  const candidates = [account.name, account.bankName].filter(Boolean).map((value) => normalize(value as string));
  return candidates.reduce((best, candidate) => {
    if (!candidate) return best;
    return haystack.includes(candidate) ? Math.max(best, candidate.length) : best;
  }, 0);
}

function findAccountMatch(text: string, accounts: QuickAddAccount[], excludeId?: string) {
  const haystack = normalize(text);
  return accounts
    .filter((account) => account.id !== excludeId)
    .map((account) => ({ account, score: scoreAccountMatch(haystack, account) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)[0]?.account;
}

function findAccountAfterKeyword(keyword: "from" | "to", input: string, accounts: QuickAddAccount[], excludeId?: string) {
  const lower = input.toLowerCase();
  const marker = `${keyword} `;
  const startIndex = lower.indexOf(marker);
  if (startIndex === -1) {
    return undefined;
  }

  const tail = input.slice(startIndex + marker.length);
  const segment = tail.split(/\b(on|for|every|monthly|weekly|daily|yearly|yesterday|today)\b/i)[0];
  return findAccountMatch(segment, accounts, excludeId);
}

function findCategoryMatch(input: string, type: Category["type"], categories: QuickAddCategory[]) {
  const haystack = normalize(input);

  const directMatch = categories
    .filter((category) => category.type === type)
    .map((category) => ({ category, key: normalize(category.name) }))
    .find((entry) => haystack.includes(entry.key));
  if (directMatch) {
    return directMatch.category;
  }

  const keywordMatch = categories
    .filter((category) => category.type === type)
    .find((category) => (CATEGORY_KEYWORDS[category.name] ?? []).some((keyword) => haystack.includes(keyword)));
  return keywordMatch;
}

export function parseNaturalLanguageTransaction({
  accounts,
  categories,
  defaultCurrency,
  input,
  today = new Date(),
}: {
  accounts: QuickAddAccount[];
  categories: QuickAddCategory[];
  defaultCurrency: Currency;
  input: string;
  today?: Date;
}): ParsedQuickAddTransaction {
  const trimmed = input.trim();
  const type = inferType(trimmed);
  const { isRecurring, frequency } = inferFrequency(trimmed);
  const warnings: string[] = [];

  const amount = parseAmountFromText(trimmed);
  if (!amount || amount <= 0) {
    warnings.push("Add an amount so FinOS knows what to record.");
  }

  const accountId =
    type === "transfer"
      ? findAccountAfterKeyword("from", trimmed, accounts)?.id
      : findAccountMatch(trimmed, accounts)?.id;
  if (!accountId) {
    warnings.push("No matching account was found in the text.");
  }

  const toAccountId =
    type === "transfer"
      ? findAccountAfterKeyword("to", trimmed, accounts, accountId)?.id
      : undefined;
  if (type === "transfer" && !toAccountId) {
    warnings.push("Transfers need a destination account.");
  }

  const categoryId =
    type === "transfer"
      ? undefined
      : findCategoryMatch(trimmed, type === "income" ? "income" : "expense", categories)?.id;
  if (type !== "transfer" && !categoryId) {
    warnings.push("No matching category was found, so review before saving.");
  }

  return {
    amount,
    type,
    currency: parseCurrencyFromText(trimmed, defaultCurrency),
    date: parseDateFromText(trimmed, today),
    note: trimmed,
    paymentMethod: inferPaymentMethod(trimmed),
    taxTag: inferTaxTag(trimmed),
    isDeductible: /\bdeductible\b|\bwrite off\b|\bwriteoff\b/.test(trimmed.toLowerCase()),
    isRecurring,
    frequency,
    accountId,
    toAccountId,
    categoryId,
    warnings,
  };
}
