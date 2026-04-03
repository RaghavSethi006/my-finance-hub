import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFinOS } from "@/lib/store";
import { formatCurrency } from "@/lib/currency";
import { netWorthHistory } from "@/lib/sample-data";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ArrowUp, ArrowDown, TrendingUp, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function LedgerPage() {
  const { settings, transactions, categories } = useFinOS();
  const netWorth = useFinOS((s) => s.netWorth());

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const netProfit = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

  // Group expenses by category
  const expenseByCategory = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      const cat = categories.find(c => c.id === t.categoryId);
      const name = cat?.name || 'Other';
      acc[name] = (acc[name] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

  const incomeByCategory = transactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => {
      const cat = categories.find(c => c.id === t.categoryId);
      const name = cat?.name || 'Other';
      acc[name] = (acc[name] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Accounting Ledger</h1>
        <p className="text-sm text-muted-foreground">Double-entry ledger, statements & net worth</p>
      </div>

      <Tabs defaultValue="income-statement">
        <TabsList>
          <TabsTrigger value="income-statement">Income Statement</TabsTrigger>
          <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
          <TabsTrigger value="net-worth">Net Worth</TabsTrigger>
        </TabsList>

        <TabsContent value="income-statement" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowUp className="h-4 w-4 text-profit" />
                  <span className="text-sm text-muted-foreground">Total Income</span>
                </div>
                <p className="text-2xl font-bold font-mono text-profit">{formatCurrency(totalIncome, settings.defaultCurrency)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowDown className="h-4 w-4 text-loss" />
                  <span className="text-sm text-muted-foreground">Total Expenses</span>
                </div>
                <p className="text-2xl font-bold font-mono text-loss">{formatCurrency(totalExpenses, settings.defaultCurrency)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Net Profit</span>
                </div>
                <p className={`text-2xl font-bold font-mono ${netProfit >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(netProfit, settings.defaultCurrency)}</p>
                <Badge variant="secondary" className="text-xs mt-1">{savingsRate.toFixed(0)}% savings rate</Badge>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Income by Category</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(incomeByCategory).sort(([,a],[,b]) => b - a).map(([name, amount]) => (
                  <div key={name} className="flex items-center justify-between py-1.5">
                    <span className="text-sm">{name}</span>
                    <span className="text-sm font-mono font-medium text-profit">{formatCurrency(amount, settings.defaultCurrency)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Expenses by Category</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(expenseByCategory).sort(([,a],[,b]) => b - a).map(([name, amount]) => (
                  <div key={name} className="flex items-center justify-between py-1.5">
                    <span className="text-sm">{name}</span>
                    <span className="text-sm font-mono font-medium">{formatCurrency(amount, settings.defaultCurrency)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="balance-sheet" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Assets</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-bold font-mono text-profit">{formatCurrency(62400, settings.defaultCurrency)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Liabilities</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-bold font-mono text-loss">{formatCurrency(2180, settings.defaultCurrency)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Net Worth</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-bold font-mono">{formatCurrency(netWorth, settings.defaultCurrency)}</p>
                <Badge className="text-xs mt-1 bg-profit-muted text-profit">+6.0% this month</Badge>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="net-worth" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Net Worth Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={netWorthHistory}>
                    <defs>
                      <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(220, 70%, 50%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(220, 70%, 50%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="netWorth" stroke="hsl(220, 70%, 50%)" fill="url(#nwGrad)" strokeWidth={2} name="Net Worth" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
