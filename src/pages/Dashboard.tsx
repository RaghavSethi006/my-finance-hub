import { useFinOS } from "@/lib/store";
import { formatCurrency, formatPercent } from "@/lib/currency";
import { buildMonthlyIncomeExpenseSeries } from "@/lib/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
} from "recharts";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const ASSET_COLORS = [
  "hsl(220, 70%, 50%)",
  "hsl(152, 60%, 40%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 65%, 55%)",
  "hsl(350, 65%, 55%)",
  "hsl(190, 80%, 42%)",
];

export default function Dashboard() {
  const { settings, accounts, transactions, assets, budgets, alerts, documents, categories } = useFinOS();
  const netWorth = useFinOS((state) => state.netWorth());
  const portfolioValue = useFinOS((state) => state.totalPortfolioValue());
  const portfolioCost = useFinOS((state) => state.totalPortfolioCost());
  const monthlyIncome = useFinOS((state) => state.monthlyIncome());
  const monthlyExpenses = useFinOS((state) => state.monthlyExpenses());

  const monthlySpendingData = buildMonthlyIncomeExpenseSeries(transactions);
  const portfolioPL = portfolioValue - portfolioCost;
  const portfolioPLPercent = portfolioCost > 0 ? (portfolioPL / portfolioCost) * 100 : 0;
  const monthlySavings = monthlyIncome - monthlyExpenses;
  const savingsRate = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;
  const unreadAlerts = alerts.filter((alert) => !alert.read);

  const assetAllocation = assets.reduce((accumulator, asset) => {
    const label =
      asset.type === "stock"
        ? "Stocks"
        : asset.type === "crypto"
          ? "Crypto"
          : asset.type === "real_estate"
            ? "Real Estate"
            : asset.type === "gold"
              ? "Gold"
              : "Other";
    const existing = accumulator.find((entry) => entry.name === label);
    const value = asset.currentPrice * asset.quantity;
    if (existing) {
      existing.value += value;
    } else {
      accumulator.push({ name: label, value });
    }
    return accumulator;
  }, [] as { name: string; value: number }[]);

  const budgetOnTrack = budgets.filter((budget) => budget.amount > 0 && (budget.spent / budget.amount) * 100 < budget.alertThreshold).length;
  const recentTransactions = [...transactions]
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
    .slice(0, 5);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight">
          {getGreeting()}, {settings.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Here&apos;s your financial overview for today</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Net Worth"
          value={formatCurrency(netWorth, settings.defaultCurrency)}
          change="+8.2%"
          changeType="positive"
          icon={<TrendingUp className="h-4 w-4" />}
          subtitle="vs last month"
          delay={0}
        />
        <SummaryCard
          title="This Month"
          value={formatCurrency(monthlySavings, settings.defaultCurrency)}
          change={`${savingsRate.toFixed(0)}% saved`}
          changeType={savingsRate > 20 ? "positive" : "warning"}
          icon={<Wallet className="h-4 w-4" />}
          subtitle={`${formatCurrency(monthlyIncome, settings.defaultCurrency)} in / ${formatCurrency(monthlyExpenses, settings.defaultCurrency)} out`}
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
          value={formatCurrency(monthlyIncome * 12 * 0.22, settings.defaultCurrency)}
          change="FY 2024-25"
          changeType="neutral"
          icon={<Calculator className="h-4 w-4" />}
          subtitle="Based on current income"
          delay={3}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="animate-fade-in lg:col-span-2" style={{ animationDelay: "200ms" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Income vs Expenses (6 months)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlySpendingData}>
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
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Asset Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie data={assetAllocation} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {assetAllocation.map((_, index) => (
                      <Cell key={index} fill={ASSET_COLORS[index % ASSET_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, ""]} />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-1.5">
              {assetAllocation.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ASSET_COLORS[index] }} />
                    <span className="text-muted-foreground">{item.name}</span>
                  </div>
                  <span className="font-mono font-medium">{formatCurrency(item.value, settings.defaultCurrency)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="animate-fade-in lg:col-span-2" style={{ animationDelay: "400ms" }}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Recent Transactions</CardTitle>
              <span className="cursor-pointer text-xs text-primary hover:underline">View all -&gt;</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {recentTransactions.map((transaction) => {
              const category = categories.find((item) => item.id === transaction.categoryId);
              const isIncome = transaction.type === "income";
              return (
                <div key={transaction.id} className="flex items-center justify-between border-b py-2.5 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isIncome ? "bg-profit-muted" : "bg-secondary"}`}>
                      {isIncome ? <ArrowUpRight className="h-4 w-4 text-profit" /> : <ArrowDownRight className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{transaction.note}</p>
                      <p className="text-xs text-muted-foreground">{category?.name} / {transaction.date}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-mono font-semibold ${isIncome ? "text-profit" : ""}`}>
                    {isIncome ? "+" : "-"}
                    {formatCurrency(transaction.amount, transaction.currency)}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: "500ms" }}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Alerts & Insights</CardTitle>
              {unreadAlerts.length > 0 && <Badge variant="secondary" className="text-xs">{unreadAlerts.length} new</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.slice(0, 5).map((alert) => (
              <div key={alert.id} className={`flex gap-3 rounded-lg p-2.5 ${!alert.read ? "bg-secondary/50" : ""}`}>
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
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
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
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Accounts</span>
            </div>
            <p className="text-lg font-bold">{accounts.length} accounts</p>
            <div className="mt-3 space-y-2">
              {accounts.slice(0, 3).map((account) => (
                <div key={account.id} className="flex items-center justify-between text-xs">
                  <span className="truncate text-muted-foreground">{account.name}</span>
                  <span className={`font-mono font-medium ${account.balance < 0 ? "text-loss" : ""}`}>
                    {formatCurrency(account.balance, account.currency)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: "700ms" }}>
          <CardContent className="pt-5">
            <div className="mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Vault</span>
            </div>
            <p className="text-lg font-bold">{documents.length} documents</p>
            <p className="mt-1 text-xs text-muted-foreground">Encrypted and secure</p>
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

        <Card className="animate-fade-in" style={{ animationDelay: "750ms" }}>
          <CardContent className="pt-5">
            <div className="mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Recurring</span>
            </div>
            <p className="text-lg font-bold">{transactions.filter((transaction) => transaction.isRecurring).length} active</p>
            <p className="mt-1 text-xs text-muted-foreground">Auto-tracked monthly</p>
            <div className="mt-3 space-y-1.5">
              {transactions.filter((transaction) => transaction.isRecurring).slice(0, 2).map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between text-xs">
                  <span className="truncate text-muted-foreground">{transaction.note}</span>
                  <span className="font-mono">{formatCurrency(transaction.amount, transaction.currency)}</span>
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
