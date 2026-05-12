import { useMemo, useState } from "react";
import { useFinOS } from "@/lib/store";
import { formatCurrency, formatPercent } from "@/lib/currency";
import {
  buildSmartInsights,
  buildExpenseCategorySeries,
  buildIncomeExpenseSeries,
  buildTimeframeAssetAllocation,
  DashboardRangePreset,
  DashboardRangeSelection,
  filterTransactionsByRange,
  resolveDashboardRange,
  summarizeTransactions,
} from "@/lib/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TrendingUp,
  Wallet,
  PieChart,
  Calculator,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  CheckCircle2,
  Info,
  Clock,
  FileText,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getRangeDescription(start: string, end: string) {
  if (start === end) {
    return start;
  }
  return `${start} to ${end}`;
}

function getDayCount(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  return Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1);
}

const ASSET_COLORS = [
  "hsl(220, 70%, 50%)",
  "hsl(152, 60%, 40%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 65%, 55%)",
  "hsl(350, 65%, 55%)",
  "hsl(190, 80%, 42%)",
];

const RANGE_OPTIONS: Array<{ value: DashboardRangePreset; label: string }> = [
  { value: "this_week", label: "This week" },
  { value: "this_month", label: "This month" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "this_year", label: "This year" },
  { value: "all_time", label: "All time" },
  { value: "custom", label: "Custom" },
];

export default function Dashboard() {
  const { settings, accounts, transactions, assets, budgets, documents, categories, recurringTemplates, loans } = useFinOS();
  const netWorth = useFinOS((state) => state.netWorth());
  const portfolioValue = useFinOS((state) => state.totalPortfolioValue());
  const portfolioCost = useFinOS((state) => state.totalPortfolioCost());

  const [rangeSelection, setRangeSelection] = useState<DashboardRangeSelection>({
    preset: "this_month",
  });
  const [spendingChartMode, setSpendingChartMode] = useState<"amount" | "share">("amount");

  const resolvedRange = useMemo(
    () => resolveDashboardRange(rangeSelection, transactions),
    [rangeSelection, transactions]
  );
  const rangeTransactions = useMemo(
    () => filterTransactionsByRange(transactions, resolvedRange),
    [transactions, resolvedRange]
  );
  const periodSummary = useMemo(() => summarizeTransactions(rangeTransactions), [rangeTransactions]);
  const incomeExpenseData = useMemo(
    () => buildIncomeExpenseSeries(rangeTransactions, resolvedRange),
    [rangeTransactions, resolvedRange]
  );
  const spendingCategoryData = useMemo(
    () => buildExpenseCategorySeries(rangeTransactions, categories, resolvedRange),
    [rangeTransactions, categories, resolvedRange]
  );
  const timeframeAssetAllocation = useMemo(
    () => buildTimeframeAssetAllocation(assets, resolvedRange),
    [assets, resolvedRange]
  );
  const smartAlerts = useMemo(
    () =>
      buildSmartInsights({
        accounts,
        assets,
        budgets,
        categories,
        defaultCurrency: settings.defaultCurrency,
        documents,
        loans,
        range: resolvedRange,
        recurringTemplates,
        transactions,
      }),
    [accounts, assets, budgets, categories, documents, loans, recurringTemplates, resolvedRange, settings.defaultCurrency, transactions]
  );

  const portfolioPL = portfolioValue - portfolioCost;
  const portfolioPLPercent = portfolioCost > 0 ? (portfolioPL / portfolioCost) * 100 : 0;
  const periodDayCount = getDayCount(resolvedRange.start, resolvedRange.end);
  const annualizedIncome = periodSummary.income * (365 / periodDayCount);
  const estimatedTax = annualizedIncome * 0.22;

  const budgetOnTrack = budgets.filter((budget) => budget.amount > 0 && (budget.spent / budget.amount) * 100 < budget.alertThreshold).length;
  const recentTransactions = [...rangeTransactions]
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
    .slice(0, 5);
  const spendingDistributionTotal = spendingCategoryData.distribution.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="animate-fade-in space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {getGreeting()}, {settings.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Choose the timeline you want the dashboard to summarize.</p>
        </div>

        <Card>
          <CardContent className="space-y-4 pt-5">
            <div className="flex flex-wrap gap-2">
              {RANGE_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  variant={rangeSelection.preset === option.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRangeSelection((selection) => ({ ...selection, preset: option.value }))}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            {rangeSelection.preset === "custom" && (
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Custom start</p>
                  <Input
                    type="date"
                    value={rangeSelection.customStart || ""}
                    onChange={(event) =>
                      setRangeSelection((selection) => ({ ...selection, customStart: event.target.value }))
                    }
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Custom end</p>
                  <Input
                    type="date"
                    value={rangeSelection.customEnd || ""}
                    onChange={(event) =>
                      setRangeSelection((selection) => ({ ...selection, customEnd: event.target.value }))
                    }
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() =>
                      setRangeSelection({
                        preset: "custom",
                        customStart: "",
                        customEnd: "",
                      })
                    }
                  >
                    Clear custom dates
                  </Button>
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">{resolvedRange.label}</Badge>
              <span>{getRangeDescription(resolvedRange.start, resolvedRange.end)}</span>
              <span>{rangeTransactions.length} transactions in range</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Net Worth"
          value={formatCurrency(netWorth, settings.defaultCurrency)}
          change="Current snapshot"
          changeType="neutral"
          icon={<TrendingUp className="h-4 w-4" />}
          subtitle="Across accounts, assets, and liabilities"
          delay={0}
        />
        <SummaryCard
          title={resolvedRange.label}
          value={formatCurrency(periodSummary.savings, settings.defaultCurrency)}
          change={periodSummary.income > 0 ? `${periodSummary.savingsRate.toFixed(0)}% saved` : "No income yet"}
          changeType={periodSummary.savings >= 0 ? "positive" : "warning"}
          icon={<Wallet className="h-4 w-4" />}
          subtitle={`${formatCurrency(periodSummary.income, settings.defaultCurrency)} in / ${formatCurrency(periodSummary.expenses, settings.defaultCurrency)} out`}
          delay={1}
        />
        <SummaryCard
          title="Portfolio"
          value={formatCurrency(portfolioValue, settings.defaultCurrency)}
          change={formatPercent(portfolioPLPercent)}
          changeType={portfolioPL >= 0 ? "positive" : "negative"}
          icon={<PieChart className="h-4 w-4" />}
          subtitle={`${formatCurrency(portfolioPL, settings.defaultCurrency)} P&L`}
          delay={2}
        />
        <SummaryCard
          title="Tax Estimate"
          value={formatCurrency(estimatedTax, settings.defaultCurrency)}
          change="Annualized"
          changeType="neutral"
          icon={<Calculator className="h-4 w-4" />}
          subtitle={`Projected from ${resolvedRange.label.toLowerCase()} income pace`}
          delay={3}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="animate-fade-in lg:col-span-2" style={{ animationDelay: "200ms" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Income vs Expenses ({resolvedRange.label})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={incomeExpenseData}>
                  <defs>
                    <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(152, 60%, 40%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(152, 60%, 40%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="period" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => formatCurrency(value, settings.defaultCurrency)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => [formatCurrency(value, settings.defaultCurrency), ""]}
                  />
                  <Area type="monotone" dataKey="income" stroke="hsl(152, 60%, 40%)" fill="url(#incomeGrad)" strokeWidth={2} name="Income" />
                  <Area type="monotone" dataKey="expenses" stroke="hsl(0, 72%, 51%)" fill="url(#expenseGrad)" strokeWidth={2} name="Expenses" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: "300ms" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{timeframeAssetAllocation.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[180px]">
              {timeframeAssetAllocation.data.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie data={timeframeAssetAllocation.data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {timeframeAssetAllocation.data.map((_, index) => (
                        <Cell key={index} fill={ASSET_COLORS[index % ASSET_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [formatCurrency(value, settings.defaultCurrency), ""]} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                  {timeframeAssetAllocation.emptyLabel}
                </div>
              )}
            </div>
            <div className="mt-2 space-y-1.5">
              {timeframeAssetAllocation.data.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ASSET_COLORS[index] }} />
                    <span className="text-muted-foreground">{item.name}</span>
                  </div>
                  <span className="font-mono font-medium">{formatCurrency(item.value, settings.defaultCurrency)}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{timeframeAssetAllocation.subtitle}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="animate-fade-in lg:col-span-2" style={{ animationDelay: "350ms" }}>
          <CardHeader className="space-y-3 pb-2">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Spending by Category ({resolvedRange.label})
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant={spendingChartMode === "amount" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSpendingChartMode("amount")}
                >
                  Amount
                </Button>
                <Button
                  variant={spendingChartMode === "share" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSpendingChartMode("share")}
                >
                  Share
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={spendingChartMode === "amount" ? spendingCategoryData.amountSeries : spendingCategoryData.shareSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} minTickGap={20} />
                  <YAxis
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) =>
                      spendingChartMode === "share" ? `${Number(value).toFixed(0)}%` : formatCurrency(value, settings.defaultCurrency)
                    }
                    domain={spendingChartMode === "share" ? [0, 100] : undefined}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value: number, name: string) => [
                      spendingChartMode === "share" ? `${value.toFixed(1)}%` : formatCurrency(value, settings.defaultCurrency),
                      spendingCategoryData.categories.find((category) => category.key === name)?.label || name,
                    ]}
                  />
                  <Legend />
                  {spendingCategoryData.categories.map((category) => (
                    <Bar
                      key={category.key}
                      dataKey={category.key}
                      stackId="spending"
                      fill={category.color}
                      radius={
                        category.key === spendingCategoryData.categories[spendingCategoryData.categories.length - 1]?.key
                          ? [4, 4, 0, 0]
                          : undefined
                      }
                      name={category.label}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Toggle between absolute spend and each period&apos;s category share. This chart now follows the selected dashboard timeframe.
            </p>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: "400ms" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Spending Distribution ({resolvedRange.label})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={spendingCategoryData.distribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {spendingCategoryData.distribution.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [formatCurrency(value, settings.defaultCurrency), "Spending"]} />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-1.5">
              {spendingCategoryData.distribution.length > 0 ? spendingCategoryData.distribution.map((item) => {
                const share = spendingDistributionTotal > 0 ? (item.value / spendingDistributionTotal) * 100 : 0;
                return (
                  <div key={item.key} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-muted-foreground">{item.name}</span>
                    </div>
                    <span className="font-mono font-medium">
                      {share.toFixed(0)}% / {formatCurrency(item.value, settings.defaultCurrency)}
                    </span>
                  </div>
                );
              }) : (
                <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
                  No expense activity in this range yet.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="animate-fade-in lg:col-span-2" style={{ animationDelay: "450ms" }}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Recent Transactions ({resolvedRange.label})</CardTitle>
              <span className="text-xs text-muted-foreground">{getRangeDescription(resolvedRange.start, resolvedRange.end)}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {recentTransactions.length > 0 ? recentTransactions.map((transaction) => {
              const category = categories.find((item) => item.id === transaction.categoryId);
              const isIncome = transaction.type === "income";
              const prefix = transaction.type === "transfer" ? "" : isIncome ? "+" : "-";
              return (
                <div key={transaction.id} className="flex items-center justify-between border-b py-2.5 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isIncome ? "bg-profit-muted" : "bg-secondary"}`}>
                      {isIncome ? <ArrowUpRight className="h-4 w-4 text-profit" /> : <ArrowDownRight className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{transaction.note}</p>
                      <p className="text-xs text-muted-foreground">{category?.name || "Uncategorized"} / {transaction.date}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-mono font-semibold ${isIncome ? "text-profit" : ""}`}>
                    {prefix}
                    {formatCurrency(transaction.amount, transaction.currency)}
                  </span>
                </div>
              );
            }) : (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No transactions in this range yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: "500ms" }}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Alerts & Insights</CardTitle>
              {smartAlerts.length > 0 && <Badge variant="secondary" className="text-xs">{smartAlerts.length} active</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {smartAlerts.map((alert) => (
              <div key={alert.id} className="flex gap-3 rounded-lg bg-secondary/50 p-2.5">
                <div className="mt-0.5 shrink-0">
                  {alert.severity === "warning" && <AlertTriangle className="h-4 w-4 text-warning-color" />}
                  {alert.severity === "success" && <CheckCircle2 className="h-4 w-4 text-profit" />}
                  {alert.severity === "info" && <Info className="h-4 w-4 text-primary" />}
                  {alert.severity === "error" && <AlertTriangle className="h-4 w-4 text-loss" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{alert.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{alert.message}</p>
                </div>
              </div>
            ))}
            {smartAlerts.length === 0 && (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No cross-module issues detected right now.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="animate-fade-in" style={{ animationDelay: "600ms" }}>
            <CardContent className="pt-5">
              <div className="mb-3 flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Budgets</span>
              </div>
              <p className="text-lg font-bold">
                {budgetOnTrack} of {budgets.length} on track
              </p>
              <div className="mt-3 space-y-2">
                {budgets.slice(0, 3).map((budget) => {
                  const category = categories.find((item) => item.id === budget.categoryId);
                  const percentage = budget.amount > 0 ? (budget.spent / budget.amount) * 100 : 0;
                  return (
                    <div key={budget.id}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-muted-foreground">{category?.name}</span>
                        <span className="font-mono">{percentage.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                        <div
                          className={`h-full rounded-full transition-all ${percentage >= 90 ? "bg-loss" : percentage >= 70 ? "bg-warning" : "bg-profit"}`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="animate-fade-in" style={{ animationDelay: "650ms" }}>
            <CardContent className="pt-5">
              <div className="mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Vault</span>
              </div>
              <p className="text-lg font-bold">{documents.length} documents</p>
              <p className="mt-1 text-xs text-muted-foreground">Encrypted and stored locally</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {["banking", "tax", "legal", "personal"].map((category) => {
                  const count = documents.filter((document) => document.category === category).length;
                  if (count === 0) return null;
                  return (
                    <Badge key={category} variant="secondary" className="text-[10px] capitalize">
                      {category} ({count})
                    </Badge>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="animate-fade-in" style={{ animationDelay: "700ms" }}>
            <CardContent className="pt-5">
              <div className="mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Recurring</span>
              </div>
              <p className="text-lg font-bold">{recurringTemplates.filter((template) => !template.isPaused).length} active</p>
              <p className="mt-1 text-xs text-muted-foreground">Desktop-scheduled templates</p>
              <div className="mt-3 space-y-1.5">
                {recurringTemplates.filter((template) => !template.isPaused).slice(0, 2).map((template) => (
                  <div key={template.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-muted-foreground">{template.note}</span>
                    <span className="shrink-0 font-mono">{formatCurrency(template.amount, template.currency)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  change,
  changeType,
  icon,
  subtitle,
  delay,
}: {
  title: string;
  value: string;
  change: string;
  changeType: "positive" | "negative" | "warning" | "neutral";
  icon: React.ReactNode;
  subtitle: string;
  delay: number;
}) {
  const changeColor =
    changeType === "positive"
      ? "text-profit bg-profit-muted"
      : changeType === "negative"
        ? "text-loss bg-loss-muted"
        : changeType === "warning"
          ? "text-warning-color bg-warning-muted"
          : "text-muted-foreground bg-secondary";

  return (
    <Card className="animate-fade-in" style={{ animationDelay: `${delay * 100}ms` }}>
      <CardContent className="pt-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-muted-foreground">{icon}</div>
        </div>
        <p className="font-mono text-2xl font-bold tracking-tight">{value}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${changeColor}`}>{change}</span>
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        </div>
      </CardContent>
    </Card>
  );
}
