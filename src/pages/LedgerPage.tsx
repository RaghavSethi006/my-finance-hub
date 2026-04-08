import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useFinOS } from "@/lib/store";
import { formatCurrency, formatPercent } from "@/lib/currency";
import { netWorthHistory } from "@/lib/sample-data";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { ArrowUp, ArrowDown, TrendingUp, BookOpen, Scale, FileText, ChevronDown, ChevronRight, Search, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

export default function LedgerPage() {
  const { settings, transactions, categories, accounts, journalEntries, loans } = useFinOS();
  const netWorth = useFinOS((s) => s.netWorth());
  const totalLoanOutstanding = useFinOS((s) => s.totalLoanOutstanding());

  const [journalSearch, setJournalSearch] = useState('');
  const [expandedJE, setExpandedJE] = useState<Set<string>>(new Set());
  const [period, setPeriod] = useState('this-month');

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const netProfit = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

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

  // Trial balance
  const trialBalance = useMemo(() => {
    const balances: Record<string, { accountType: string; debit: number; credit: number }> = {};
    journalEntries.forEach(je => {
      je.entries.forEach(e => {
        if (!balances[e.accountName]) balances[e.accountName] = { accountType: e.accountType, debit: 0, credit: 0 };
        balances[e.accountName].debit += e.debit;
        balances[e.accountName].credit += e.credit;
      });
    });
    return Object.entries(balances).map(([name, data]) => ({ name, ...data, net: data.debit - data.credit }));
  }, [journalEntries]);

  const totalDebits = trialBalance.reduce((s, t) => s + t.debit, 0);
  const totalCredits = trialBalance.reduce((s, t) => s + t.credit, 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

  // Balance sheet
  const liquidAssets = accounts.filter(a => a.type === 'bank' || a.type === 'cash').reduce((s, a) => s + Math.max(a.balance, 0), 0);
  const investmentAssets = accounts.filter(a => a.type === 'investment').reduce((s, a) => s + a.balance, 0);
  const portfolioValue = useFinOS(s => s.totalPortfolioValue());
  const physicalAssets = useFinOS(s => s.assets).filter(a => a.type === 'real_estate' || a.type === 'vehicle' || a.type === 'gold').reduce((s, a) => s + a.currentPrice * a.quantity, 0);
  const totalAssets = liquidAssets + investmentAssets + portfolioValue + physicalAssets;
  const creditCardLiability = Math.abs(accounts.filter(a => a.type === 'credit_card').reduce((s, a) => s + Math.min(a.balance, 0), 0));

  const filteredJournals = journalEntries.filter(je =>
    je.description.toLowerCase().includes(journalSearch.toLowerCase())
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const toggleJE = (id: string) => {
    setExpandedJE(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Expense bar chart data
  const expenseChartData = Object.entries(expenseByCategory)
    .sort(([, a], [, b]) => b - a)
    .map(([name, amount]) => ({ name: name.length > 12 ? name.slice(0, 12) + '…' : name, amount }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Accounting Ledger</h1>
          <p className="text-sm text-muted-foreground">Double-entry ledger, statements & net worth</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="this-month">This Month</SelectItem>
              <SelectItem value="last-month">Last Month</SelectItem>
              <SelectItem value="this-quarter">This Quarter</SelectItem>
              <SelectItem value="this-year">This Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-2"><Download className="h-3.5 w-3.5" /> Export</Button>
        </div>
      </div>

      <Tabs defaultValue="journal">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-flex">
          <TabsTrigger value="journal" className="gap-1.5"><BookOpen className="h-3.5 w-3.5 hidden sm:block" /> Journal</TabsTrigger>
          <TabsTrigger value="trial-balance" className="gap-1.5"><Scale className="h-3.5 w-3.5 hidden sm:block" /> Trial Balance</TabsTrigger>
          <TabsTrigger value="income-statement" className="gap-1.5"><FileText className="h-3.5 w-3.5 hidden sm:block" /> Income</TabsTrigger>
          <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
          <TabsTrigger value="net-worth">Net Worth</TabsTrigger>
        </TabsList>

        {/* === JOURNAL ENTRIES === */}
        <TabsContent value="journal" className="mt-4 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search journal entries..." className="pl-9" value={journalSearch} onChange={e => setJournalSearch(e.target.value)} />
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {filteredJournals.map(je => {
                  const isExpanded = expandedJE.has(je.id);
                  const totalDebit = je.entries.reduce((s, e) => s + e.debit, 0);
                  return (
                    <div key={je.id}>
                      <div
                        className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors cursor-pointer"
                        onClick={() => toggleJE(je.id)}
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{je.description}</span>
                            <Badge variant="outline" className="text-[10px] font-mono">{je.id}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{je.date} · {je.entries.length} entries</p>
                        </div>
                        <span className="text-sm font-mono font-medium">{formatCurrency(totalDebit, settings.defaultCurrency)}</span>
                      </div>
                      {isExpanded && (
                        <div className="bg-secondary/20 px-8 py-3 border-t">
                          <Table>
                            <TableHeader>
                              <TableRow className="hover:bg-transparent">
                                <TableHead className="h-8 text-xs">Account</TableHead>
                                <TableHead className="h-8 text-xs">Type</TableHead>
                                <TableHead className="h-8 text-xs text-right">Debit</TableHead>
                                <TableHead className="h-8 text-xs text-right">Credit</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {je.entries.map((entry, i) => (
                                <TableRow key={i} className="hover:bg-transparent">
                                  <TableCell className="py-1.5 text-sm">{entry.credit > 0 ? <span className="ml-4">{entry.accountName}</span> : entry.accountName}</TableCell>
                                  <TableCell className="py-1.5"><Badge variant="secondary" className="text-[10px] capitalize">{entry.accountType}</Badge></TableCell>
                                  <TableCell className="py-1.5 text-right font-mono text-sm">{entry.debit > 0 ? formatCurrency(entry.debit, settings.defaultCurrency) : ''}</TableCell>
                                  <TableCell className="py-1.5 text-right font-mono text-sm">{entry.credit > 0 ? formatCurrency(entry.credit, settings.defaultCurrency) : ''}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="text-xs text-muted-foreground text-center">
            Showing {filteredJournals.length} of {journalEntries.length} journal entries
          </div>
        </TabsContent>

        {/* === TRIAL BALANCE === */}
        <TabsContent value="trial-balance" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-muted-foreground">Trial Balance</CardTitle>
                <Badge variant={isBalanced ? 'default' : 'destructive'} className="text-xs">
                  {isBalanced ? '✓ Balanced' : '✗ Imbalanced'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trialBalance.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell className="font-medium text-sm">{row.name}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-[10px] capitalize">{row.accountType}</Badge></TableCell>
                      <TableCell className="text-right font-mono text-sm">{row.debit > 0 ? formatCurrency(row.debit, settings.defaultCurrency) : '—'}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{row.credit > 0 ? formatCurrency(row.credit, settings.defaultCurrency) : '—'}</TableCell>
                      <TableCell className={`text-right font-mono text-sm font-medium ${row.net > 0 ? 'text-profit' : row.net < 0 ? 'text-loss' : ''}`}>
                        {formatCurrency(row.net, settings.defaultCurrency)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold border-t-2">
                    <TableCell colSpan={2}>Total</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(totalDebits, settings.defaultCurrency)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(totalCredits, settings.defaultCurrency)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(totalDebits - totalCredits, settings.defaultCurrency)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === INCOME STATEMENT === */}
        <TabsContent value="income-statement" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowUp className="h-4 w-4 text-profit" />
                  <span className="text-xs text-muted-foreground">Total Income</span>
                </div>
                <p className="text-xl font-bold font-mono text-profit">{formatCurrency(totalIncome, settings.defaultCurrency)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowDown className="h-4 w-4 text-loss" />
                  <span className="text-xs text-muted-foreground">Total Expenses</span>
                </div>
                <p className="text-xl font-bold font-mono text-loss">{formatCurrency(totalExpenses, settings.defaultCurrency)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Net Profit</span>
                </div>
                <p className={`text-xl font-bold font-mono ${netProfit >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(netProfit, settings.defaultCurrency)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <span className="text-xs text-muted-foreground">Savings Rate</span>
                <p className="text-xl font-bold font-mono mt-2">{savingsRate.toFixed(1)}%</p>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden mt-2">
                  <div className={`h-full rounded-full ${savingsRate > 30 ? 'bg-profit' : savingsRate > 15 ? 'bg-warning' : 'bg-loss'}`} style={{ width: `${Math.min(savingsRate, 100)}%` }} />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <ArrowUp className="h-3.5 w-3.5 text-profit" /> Income by Source
                </CardTitle>
              </CardHeader>
              <CardContent>
                {Object.entries(incomeByCategory).sort(([, a], [, b]) => b - a).map(([name, amount]) => {
                  const pct = totalIncome > 0 ? (amount / totalIncome) * 100 : 0;
                  return (
                    <div key={name} className="py-2 border-b last:border-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm">{name}</span>
                        <span className="text-sm font-mono font-medium text-profit">{formatCurrency(amount, settings.defaultCurrency)}</span>
                      </div>
                      <div className="h-1 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-profit/50" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                <Separator className="my-3" />
                <div className="flex justify-between font-medium text-sm">
                  <span>Total Income</span>
                  <span className="font-mono text-profit">{formatCurrency(totalIncome, settings.defaultCurrency)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <ArrowDown className="h-3.5 w-3.5 text-loss" /> Expenses by Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                {Object.entries(expenseByCategory).sort(([, a], [, b]) => b - a).map(([name, amount]) => {
                  const pct = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;
                  return (
                    <div key={name} className="py-2 border-b last:border-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm">{name}</span>
                        <span className="text-sm font-mono font-medium">{formatCurrency(amount, settings.defaultCurrency)}</span>
                      </div>
                      <div className="h-1 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-loss/40" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                <Separator className="my-3" />
                <div className="flex justify-between font-medium text-sm">
                  <span>Total Expenses</span>
                  <span className="font-mono text-loss">{formatCurrency(totalExpenses, settings.defaultCurrency)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Expense Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={expenseChartData} layout="vertical" margin={{ left: 0, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `$${(v / 1000).toFixed(v >= 1000 ? 1 : 0)}${v >= 1000 ? 'K' : ''}`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={90} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} formatter={(v: number) => [formatCurrency(v, settings.defaultCurrency), 'Amount']} />
                      <Bar dataKey="amount" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* === BALANCE SHEET === */}
        <TabsContent value="balance-sheet" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-profit/20">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Assets</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-bold font-mono text-profit">{formatCurrency(totalAssets, settings.defaultCurrency)}</p>
              </CardContent>
            </Card>
            <Card className="border-loss/20">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Liabilities</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-bold font-mono text-loss">{formatCurrency(creditCardLiability + totalLoanOutstanding, settings.defaultCurrency)}</p>
              </CardContent>
            </Card>
            <Card className="border-primary/20">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Net Worth</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-bold font-mono">{formatCurrency(netWorth, settings.defaultCurrency)}</p>
                <Badge className="text-xs mt-1 bg-profit-muted text-profit">+6.0% this month</Badge>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Assets Breakdown */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5 text-profit" /> Assets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium text-sm">Liquid Assets (Cash + Bank)</TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatCurrency(liquidAssets, settings.defaultCurrency)}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{totalAssets > 0 ? ((liquidAssets / totalAssets) * 100).toFixed(1) : 0}%</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-sm">Investment Accounts</TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatCurrency(investmentAssets, settings.defaultCurrency)}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{totalAssets > 0 ? ((investmentAssets / totalAssets) * 100).toFixed(1) : 0}%</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-sm">Portfolio (Stocks, MF, Crypto)</TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatCurrency(portfolioValue, settings.defaultCurrency)}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{totalAssets > 0 ? ((portfolioValue / totalAssets) * 100).toFixed(1) : 0}%</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-sm">Physical Assets</TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatCurrency(physicalAssets, settings.defaultCurrency)}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{totalAssets > 0 ? ((physicalAssets / totalAssets) * 100).toFixed(1) : 0}%</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                <Separator className="my-2" />
                <div className="flex justify-between px-4 py-2 font-bold text-sm">
                  <span>Total Assets</span>
                  <span className="font-mono text-profit">{formatCurrency(totalAssets, settings.defaultCurrency)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Liabilities Breakdown */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <ArrowDown className="h-3.5 w-3.5 text-loss" /> Liabilities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium text-sm">Credit Card Balance</TableCell>
                      <TableCell className="text-right font-mono text-sm text-loss">{formatCurrency(creditCardLiability, settings.defaultCurrency)}</TableCell>
                    </TableRow>
                    {loans.filter(l => l.status === 'active').map(loan => (
                      <TableRow key={loan.id}>
                        <TableCell className="text-sm">
                          <div>
                            <span className="font-medium">{loan.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">{loan.interestRate}% APR</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-loss">{formatCurrency(loan.outstandingAmount, loan.currency)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Separator className="my-2" />
                <div className="flex justify-between px-4 py-2 font-bold text-sm">
                  <span>Total Liabilities</span>
                  <span className="font-mono text-loss">{formatCurrency(creditCardLiability + totalLoanOutstanding, settings.defaultCurrency)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* === NET WORTH === */}
        <TabsContent value="net-worth" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-5">
                <span className="text-xs text-muted-foreground">Liquid</span>
                <p className="text-lg font-bold font-mono mt-1">{formatCurrency(liquidAssets, settings.defaultCurrency)}</p>
                <span className="text-xs text-muted-foreground">{totalAssets > 0 ? ((liquidAssets / totalAssets) * 100).toFixed(0) : 0}% of total</span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <span className="text-xs text-muted-foreground">Investments</span>
                <p className="text-lg font-bold font-mono mt-1">{formatCurrency(portfolioValue + investmentAssets, settings.defaultCurrency)}</p>
                <span className="text-xs text-muted-foreground">{totalAssets > 0 ? (((portfolioValue + investmentAssets) / totalAssets) * 100).toFixed(0) : 0}% of total</span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <span className="text-xs text-muted-foreground">Physical</span>
                <p className="text-lg font-bold font-mono mt-1">{formatCurrency(physicalAssets, settings.defaultCurrency)}</p>
                <span className="text-xs text-muted-foreground">{totalAssets > 0 ? ((physicalAssets / totalAssets) * 100).toFixed(0) : 0}% of total</span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <span className="text-xs text-muted-foreground">Liabilities</span>
                <p className="text-lg font-bold font-mono mt-1 text-loss">{formatCurrency(creditCardLiability + totalLoanOutstanding, settings.defaultCurrency)}</p>
                <span className="text-xs text-muted-foreground">Debt-to-asset {totalAssets > 0 ? (((creditCardLiability + totalLoanOutstanding) / totalAssets) * 100).toFixed(1) : 0}%</span>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Net Worth Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={netWorthHistory}>
                    <defs>
                      <linearGradient id="nwAssets" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(152, 60%, 40%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(152, 60%, 40%)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="nwLiab" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="nwNet" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(220, 70%, 50%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(220, 70%, 50%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} formatter={(v: number) => [formatCurrency(v, settings.defaultCurrency), '']} />
                    <Area type="monotone" dataKey="assets" stroke="hsl(152, 60%, 40%)" fill="url(#nwAssets)" strokeWidth={2} name="Assets" />
                    <Area type="monotone" dataKey="liabilities" stroke="hsl(0, 72%, 51%)" fill="url(#nwLiab)" strokeWidth={2} name="Liabilities" />
                    <Area type="monotone" dataKey="netWorth" stroke="hsl(220, 70%, 50%)" fill="url(#nwNet)" strokeWidth={2} name="Net Worth" />
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
