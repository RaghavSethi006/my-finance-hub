import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useFinOS } from "@/lib/store";
import { formatCurrency } from "@/lib/currency";
import { Calculator, FileText, Lightbulb, TrendingUp, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const TAX_SLABS = [
  { min: 0, max: 300000, rate: 0 },
  { min: 300001, max: 600000, rate: 5 },
  { min: 600001, max: 900000, rate: 10 },
  { min: 900001, max: 1200000, rate: 15 },
  { min: 1200001, max: 1500000, rate: 20 },
  { min: 1500001, max: Infinity, rate: 30 },
];

export default function TaxPage() {
  const { transactions, settings, categories } = useFinOS();
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const annualizedIncome = totalIncome * 12;
  const standardDeduction = 75000;
  const businessExpenses = transactions.filter(t => t.taxTag === 'business' && t.isDeductible).reduce((s, t) => s + t.amount, 0);
  const taxableIncome = Math.max(0, annualizedIncome - standardDeduction - businessExpenses);

  // Calculate tax
  let remainingIncome = taxableIncome;
  const slabBreakdown = TAX_SLABS.map(slab => {
    const slabWidth = slab.max === Infinity ? remainingIncome : Math.min(slab.max - slab.min + 1, remainingIncome);
    const incomeInSlab = Math.max(0, Math.min(slabWidth, remainingIncome));
    remainingIncome -= incomeInSlab;
    return { ...slab, incomeInSlab, tax: incomeInSlab * slab.rate / 100 };
  });
  const totalTax = slabBreakdown.reduce((s, sl) => s + sl.tax, 0);
  const effectiveRate = taxableIncome > 0 ? (totalTax / taxableIncome) * 100 : 0;

  const untagged = transactions.filter(t => t.taxTag === 'untagged').length;
  const tagged = transactions.length - untagged;

  // Potential deductions
  const potentialDeductions = transactions
    .filter(t => t.taxTag === 'business' && !t.isDeductible)
    .reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tax Assistant</h1>
          <p className="text-sm text-muted-foreground">FY 2024-25 · New Regime</p>
        </div>
        <Button className="gap-2"><FileText className="h-4 w-4" /> Export PDF Report</Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <span className="text-sm text-muted-foreground">Gross Income (Ann.)</span>
            <p className="text-xl font-bold font-mono mt-1">{formatCurrency(annualizedIncome, settings.defaultCurrency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <span className="text-sm text-muted-foreground">Deductions</span>
            <p className="text-xl font-bold font-mono mt-1 text-profit">{formatCurrency(standardDeduction + businessExpenses, settings.defaultCurrency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <span className="text-sm text-muted-foreground">Taxable Income</span>
            <p className="text-xl font-bold font-mono mt-1">{formatCurrency(taxableIncome, settings.defaultCurrency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <span className="text-sm text-muted-foreground">Estimated Tax</span>
            <p className="text-xl font-bold font-mono mt-1 text-loss">{formatCurrency(totalTax, settings.defaultCurrency)}</p>
            <Badge variant="secondary" className="text-xs mt-1">{effectiveRate.toFixed(1)}% effective</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tax Slab Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Tax Slab Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="grid grid-cols-4 text-xs font-medium text-muted-foreground border-b pb-2">
                <span>Slab</span><span>Rate</span><span>Income</span><span>Tax</span>
              </div>
              {slabBreakdown.filter(s => s.incomeInSlab > 0).map((s, i) => (
                <div key={i} className="grid grid-cols-4 text-sm py-1.5 border-b last:border-0">
                  <span className="text-muted-foreground text-xs">
                    {s.max === Infinity ? `>${formatCurrency(s.min, settings.defaultCurrency)}` : `${formatCurrency(s.min, settings.defaultCurrency)} – ${formatCurrency(s.max, settings.defaultCurrency)}`}
                  </span>
                  <span className="font-mono">{s.rate}%</span>
                  <span className="font-mono">{formatCurrency(s.incomeInSlab, settings.defaultCurrency)}</span>
                  <span className="font-mono">{formatCurrency(s.tax, settings.defaultCurrency)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tax Tagging Progress + Suggestions */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Tagging Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-bold">{tagged} / {transactions.length} tagged</p>
              <div className="h-2 rounded-full bg-secondary overflow-hidden mt-2">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(tagged / transactions.length) * 100}%` }} />
              </div>
              {untagged > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  <AlertTriangle className="h-3 w-3 inline mr-1" />
                  {untagged} transactions still need tagging
                </p>
              )}
            </CardContent>
          </Card>

          {potentialDeductions > 0 && (
            <Card className="border-primary/20">
              <CardContent className="pt-5">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-warning-muted flex items-center justify-center">
                    <Lightbulb className="h-4 w-4 text-warning-color" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Potential Deductions</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatCurrency(potentialDeductions, settings.defaultCurrency)} in business expenses not yet marked as deductible
                    </p>
                    <Button variant="outline" size="sm" className="mt-2">Review & Tag</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
