import { useFinOS } from "@/lib/store";
import { formatCurrency, formatPercent } from "@/lib/currency";
import { monthlySpendingData, netWorthHistory } from "@/lib/sample-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
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
  LineChart,
  Line,
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
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
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
  const netWorth = useFinOS((s) => s.netWorth());
  const portfolioValue = useFinOS((s) => s.totalPortfolioValue());
  const portfolioCost = useFinOS((s) => s.totalPortfolioCost());
  const monthlyIncome = useFinOS((s) => s.monthlyIncome());
  const monthlyExpenses = useFinOS((s) => s.monthlyExpenses());

  const portfolioPL = portfolioValue - portfolioCost;
  const portfolioPLPercent = portfolioCost > 0 ? (portfolioPL / portfolioCost) * 100 : 0;
  const monthlySavings = monthlyIncome - monthlyExpenses;
  const savingsRate = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;
  const unreadAlerts = alerts.filter((a) => !a.read);

  // Asset allocation for pie chart
  const assetAllocation = assets.reduce((acc, a) => {
    const label = a.type === 'stock' ? 'Stocks' : a.type === 'crypto' ? 'Crypto' : a.type === 'real_estate' ? 'Real Estate' : a.type === 'gold' ? 'Gold' : 'Other';
    const existing = acc.find((x) => x.name === label);
    const val = a.currentPrice * a.quantity;
    if (existing) existing.value += val;
    else acc.push({ name: label, value: val });
    return acc;
  }, [] as { name: string; value: number }[]);

  const budgetOnTrack = budgets.filter((b) => (b.spent / b.amount) * 100 < b.alertThreshold).length;

  // Recent transactions
  const recentTx = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Greeting */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight">
          {getGreeting()}, {settings.name}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Here's your financial overview for today
        </p>
      </div>

      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
          subtitle={`${formatCurrency(monthlyIncome, settings.defaultCurrency)} in · ${formatCurrency(monthlyExpenses, settings.defaultCurrency)} out`}
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Spending Trend */}
        <Card className="lg:col-span-2 animate-fade-in" style={{ animationDelay: '200ms' }}>
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
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                  />
                  <Area type="monotone" dataKey="income" stroke="hsl(152, 60%, 40%)" fill="url(#incomeGrad)" strokeWidth={2} name="Income" />
                  <Area type="monotone" dataKey="expenses" stroke="hsl(0, 72%, 51%)" fill="url(#expenseGrad)" strokeWidth={2} name="Expenses" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Asset Allocation */}
        <Card className="animate-fade-in" style={{ animationDelay: '300ms' }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Asset Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={assetAllocation}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {assetAllocation.map((_, index) => (
                      <Cell key={index} fill={ASSET_COLORS[index % ASSET_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, '']} />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5 mt-2">
              {assetAllocation.map((item, i) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ASSET_COLORS[i] }} />
                    <span className="text-muted-foreground">{item.name}</span>
                  </div>
                  <span className="font-mono font-medium">{formatCurrency(item.value, settings.defaultCurrency)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Transactions */}
        <Card className="lg:col-span-2 animate-fade-in" style={{ animationDelay: '400ms' }}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Recent Transactions</CardTitle>
              <span className="text-xs text-primary cursor-pointer hover:underline">View all →</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {recentTx.map((tx) => {
              const cat = categories.find((c) => c.id === tx.categoryId);
              const isIncome = tx.type === "income";
              return (
                <div key={tx.id} className="flex items-center justify-between py-2.5 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${isIncome ? 'bg-profit-muted' : 'bg-secondary'}`}>
                      {isIncome ? (
                        <ArrowUpRight className="h-4 w-4 text-profit" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{tx.note}</p>
                      <p className="text-xs text-muted-foreground">{cat?.name} · {tx.date}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-mono font-semibold ${isIncome ? 'text-profit' : ''}`}>
                    {isIncome ? '+' : '-'}{formatCurrency(tx.amount, tx.currency)}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Alerts & Insights */}
        <Card className="animate-fade-in" style={{ animationDelay: '500ms' }}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Alerts & Insights</CardTitle>
              {unreadAlerts.length > 0 && (
                <Badge variant="secondary" className="text-xs">{unreadAlerts.length} new</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.slice(0, 5).map((alert) => (
              <div key={alert.id} className={`flex gap-3 p-2.5 rounded-lg ${!alert.read ? 'bg-secondary/50' : ''}`}>
                <div className="shrink-0 mt-0.5">
                  {alert.severity === 'warning' && <AlertTriangle className="h-4 w-4 text-warning-color" />}
                  {alert.severity === 'success' && <CheckCircle2 className="h-4 w-4 text-profit" />}
                  {alert.severity === 'info' && <Info className="h-4 w-4 text-primary" />}
                  {alert.severity === 'error' && <AlertTriangle className="h-4 w-4 text-loss" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{alert.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Budget + Module Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Budget Summary */}
        <Card className="animate-fade-in" style={{ animationDelay: '600ms' }}>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-3">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Budgets</span>
            </div>
            <p className="text-lg font-bold">{budgetOnTrack} of {budgets.length} on track</p>
            <div className="mt-3 space-y-2">
              {budgets.slice(0, 3).map((b) => {
                const cat = categories.find((c) => c.id === b.categoryId);
                const pct = (b.spent / b.amount) * 100;
                return (
                  <div key={b.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{cat?.name}</span>
                      <span className="font-mono">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-loss' : pct >= 70 ? 'bg-warning' : 'bg-profit'}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Accounts */}
        <Card className="animate-fade-in" style={{ animationDelay: '650ms' }}>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-3">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Accounts</span>
            </div>
            <p className="text-lg font-bold">{accounts.length} accounts</p>
            <div className="mt-3 space-y-2">
              {accounts.slice(0, 3).map((a) => (
                <div key={a.id} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground truncate">{a.name}</span>
                  <span className={`font-mono font-medium ${a.balance < 0 ? 'text-loss' : ''}`}>
                    {formatCurrency(a.balance, a.currency)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Vault */}
        <Card className="animate-fade-in" style={{ animationDelay: '700ms' }}>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Vault</span>
            </div>
            <p className="text-lg font-bold">{documents.length} documents</p>
            <p className="text-xs text-muted-foreground mt-1">Encrypted & secure</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {['banking', 'tax', 'legal', 'personal'].map((cat) => {
                const count = documents.filter((d) => d.category === cat).length;
                if (count === 0) return null;
                return (
                  <Badge key={cat} variant="secondary" className="text-[10px] capitalize">{cat} ({count})</Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recurring */}
        <Card className="animate-fade-in" style={{ animationDelay: '750ms' }}>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Recurring</span>
            </div>
            <p className="text-lg font-bold">{transactions.filter((t) => t.isRecurring).length} active</p>
            <p className="text-xs text-muted-foreground mt-1">Auto-tracked monthly</p>
            <div className="mt-3 space-y-1.5">
              {transactions.filter((t) => t.isRecurring).slice(0, 2).map((t) => (
                <div key={t.id} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground truncate">{t.note}</span>
                  <span className="font-mono">{formatCurrency(t.amount, t.currency)}</span>
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
  title, value, change, changeType, icon, subtitle, delay,
}: {
  title: string; value: string; change: string; changeType: 'positive' | 'negative' | 'warning' | 'neutral';
  icon: React.ReactNode; subtitle: string; delay: number;
}) {
  const changeColor = changeType === 'positive' ? 'text-profit bg-profit-muted' : changeType === 'negative' ? 'text-loss bg-loss-muted' : changeType === 'warning' ? 'text-warning-color bg-warning-muted' : 'text-muted-foreground bg-secondary';

  return (
    <Card className="animate-fade-in" style={{ animationDelay: `${delay * 100}ms` }}>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground font-medium">{title}</span>
          <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">
            {icon}
          </div>
        </div>
        <p className="text-2xl font-bold font-mono tracking-tight">{value}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${changeColor}`}>{change}</span>
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        </div>
      </CardContent>
    </Card>
  );
}
