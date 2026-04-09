import { useMemo, useState } from "react";
import { AlertTriangle, Calculator, FileText, Lightbulb, Tag } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFinOS } from "@/lib/store";
import { formatCurrency } from "@/lib/currency";
import type { Transaction } from "@/lib/types";

const TAX_SLABS = [
  { min: 0, max: 300000, rate: 0 },
  { min: 300001, max: 600000, rate: 5 },
  { min: 600001, max: 900000, rate: 10 },
  { min: 900001, max: 1200000, rate: 15 },
  { min: 1200001, max: 1500000, rate: 20 },
  { min: 1500001, max: Number.POSITIVE_INFINITY, rate: 30 },
] as const;

function getFinancialYearStart(date: Date): number {
  return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
}

function formatFinancialYear(fyStart: number): string {
  return `FY ${fyStart}-${String((fyStart + 1) % 100).padStart(2, "0")}`;
}

function isInFinancialYear(date: string, fyStart: number): boolean {
  const transactionDate = new Date(`${date}T00:00:00`);
  const start = new Date(fyStart, 3, 1);
  const end = new Date(fyStart + 1, 2, 31, 23, 59, 59, 999);
  return transactionDate >= start && transactionDate <= end;
}

function buildFinancialYearOptions(transactions: Transaction[]): number[] {
  const years = new Set<number>([getFinancialYearStart(new Date())]);
  transactions.forEach((transaction) => {
    years.add(getFinancialYearStart(new Date(`${transaction.date}T00:00:00`)));
  });

  return [...years].sort((left, right) => right - left).slice(0, 5);
}

function downloadTaxReport(fileName: string, contents: string): void {
  const blob = new Blob([contents], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export default function TaxPage() {
  const { transactions, settings, categories, updateTransaction } = useFinOS();
  const fyOptions = useMemo(() => buildFinancialYearOptions(transactions), [transactions]);
  const [selectedFy, setSelectedFy] = useState<string>(() => String(fyOptions[0] ?? getFinancialYearStart(new Date())));

  const scopedTransactions = useMemo(
    () => transactions.filter((transaction) => isInFinancialYear(transaction.date, Number(selectedFy))),
    [selectedFy, transactions]
  );

  const totalIncome = scopedTransactions
    .filter((transaction) => transaction.type === "income")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const deductibleBusinessExpenses = scopedTransactions
    .filter((transaction) => transaction.taxTag === "business" && transaction.isDeductible)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const standardDeduction = 75000;
  const taxableIncome = Math.max(0, totalIncome - standardDeduction - deductibleBusinessExpenses);

  let remainingIncome = taxableIncome;
  const slabBreakdown = TAX_SLABS.map((slab) => {
    const slabLimit = slab.max === Number.POSITIVE_INFINITY ? remainingIncome : Math.max(0, slab.max - slab.min + 1);
    const incomeInSlab = Math.max(0, Math.min(remainingIncome, slabLimit));
    remainingIncome -= incomeInSlab;
    return { ...slab, incomeInSlab, tax: (incomeInSlab * slab.rate) / 100 };
  });

  const totalTax = slabBreakdown.reduce((sum, slab) => sum + slab.tax, 0);
  const effectiveRate = taxableIncome > 0 ? (totalTax / taxableIncome) * 100 : 0;
  const taggedTransactions = scopedTransactions.filter((transaction) => transaction.taxTag !== "untagged").length;
  const untaggedTransactions = scopedTransactions.filter((transaction) => transaction.taxTag === "untagged");
  const deductionSuggestions = scopedTransactions
    .filter((transaction) => transaction.taxTag === "business" && !transaction.isDeductible)
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 6);

  const exportSummary = () => {
    const report = [
      `FinOS Tax Summary`,
      `Period: ${formatFinancialYear(Number(selectedFy))}`,
      `Gross income: ${formatCurrency(totalIncome, settings.defaultCurrency)}`,
      `Standard deduction: ${formatCurrency(standardDeduction, settings.defaultCurrency)}`,
      `Deductible business expenses: ${formatCurrency(deductibleBusinessExpenses, settings.defaultCurrency)}`,
      `Taxable income: ${formatCurrency(taxableIncome, settings.defaultCurrency)}`,
      `Estimated tax: ${formatCurrency(totalTax, settings.defaultCurrency)}`,
      `Effective rate: ${effectiveRate.toFixed(2)}%`,
    ].join("\n");

    downloadTaxReport(`finos-tax-summary-${selectedFy}.txt`, report);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tax Assistant</h1>
          <p className="text-sm text-muted-foreground">Financial-year tax summary, tagging, and deduction review.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="min-w-[180px]">
            <span className="mb-1 block text-xs text-muted-foreground">Financial Year</span>
            <Select value={selectedFy} onValueChange={setSelectedFy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fyOptions.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {formatFinancialYear(year)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button className="gap-2" onClick={exportSummary}>
            <FileText className="h-4 w-4" />
            Export Summary
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <span className="text-sm text-muted-foreground">Gross Income</span>
            <p className="mt-1 text-xl font-bold font-mono">{formatCurrency(totalIncome, settings.defaultCurrency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <span className="text-sm text-muted-foreground">Deductions Applied</span>
            <p className="mt-1 text-xl font-bold font-mono text-profit">
              {formatCurrency(standardDeduction + deductibleBusinessExpenses, settings.defaultCurrency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <span className="text-sm text-muted-foreground">Taxable Income</span>
            <p className="mt-1 text-xl font-bold font-mono">{formatCurrency(taxableIncome, settings.defaultCurrency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <span className="text-sm text-muted-foreground">Estimated Tax</span>
            <p className="mt-1 text-xl font-bold font-mono text-loss">{formatCurrency(totalTax, settings.defaultCurrency)}</p>
            <Badge variant="secondary" className="mt-1 text-xs">
              {effectiveRate.toFixed(1)}% effective
            </Badge>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="h-4 w-4" />
              Tax Slab Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-4 border-b pb-2 text-xs font-medium text-muted-foreground">
              <span>Slab</span>
              <span>Rate</span>
              <span>Income</span>
              <span>Tax</span>
            </div>
            {slabBreakdown.filter((slab) => slab.incomeInSlab > 0).map((slab) => (
              <div key={`${slab.min}-${slab.max}`} className="grid grid-cols-4 border-b py-2 text-sm last:border-0">
                <span className="text-xs text-muted-foreground">
                  {slab.max === Number.POSITIVE_INFINITY
                    ? `Above ${formatCurrency(slab.min, settings.defaultCurrency)}`
                    : `${formatCurrency(slab.min, settings.defaultCurrency)} - ${formatCurrency(slab.max, settings.defaultCurrency)}`}
                </span>
                <span className="font-mono">{slab.rate}%</span>
                <span className="font-mono">{formatCurrency(slab.incomeInSlab, settings.defaultCurrency)}</span>
                <span className="font-mono">{formatCurrency(slab.tax, settings.defaultCurrency)}</span>
              </div>
            ))}
            {slabBreakdown.every((slab) => slab.incomeInSlab === 0) && (
              <p className="py-6 text-sm text-muted-foreground">No taxable income recorded for this financial year yet.</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Tag className="h-4 w-4" />
                Tagging Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-bold">
                {taggedTransactions} / {scopedTransactions.length} tagged
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${scopedTransactions.length === 0 ? 0 : (taggedTransactions / scopedTransactions.length) * 100}%` }}
                />
              </div>
              {untaggedTransactions.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  <AlertTriangle className="mr-1 inline h-3 w-3" />
                  {untaggedTransactions.length} transactions still need a tax tag
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Lightbulb className="h-4 w-4" />
                Deduction Opportunities
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {deductionSuggestions.length === 0 && (
                <p className="text-sm text-muted-foreground">No unreviewed business deductions found for this period.</p>
              )}
              {deductionSuggestions.map((transaction) => (
                <div key={transaction.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{transaction.note}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {categories.find((category) => category.id === transaction.categoryId)?.name ?? "Uncategorized"} · {transaction.date}
                      </p>
                    </div>
                    <span className="font-mono text-sm">{formatCurrency(transaction.amount, transaction.currency)}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => updateTransaction(transaction.id, { isDeductible: true, taxTag: "business" })}
                  >
                    Mark Deductible
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Transactions Needing Tax Tags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {untaggedTransactions.length === 0 && (
            <p className="text-sm text-muted-foreground">Everything in this financial year already has a tax tag.</p>
          )}
          {untaggedTransactions.slice(0, 8).map((transaction) => (
            <div key={transaction.id} className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium">{transaction.note}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {transaction.date} · {categories.find((category) => category.id === transaction.categoryId)?.name ?? "Uncategorized"} · {formatCurrency(transaction.amount, transaction.currency)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => updateTransaction(transaction.id, { taxTag: "personal" })}>
                  Mark Personal
                </Button>
                <Button size="sm" onClick={() => updateTransaction(transaction.id, { taxTag: "business" })}>
                  Mark Business
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
