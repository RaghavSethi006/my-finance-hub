import { useFinOS } from "@/lib/store";
import { formatCurrency } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowUpRight, ArrowDownRight, Wallet, Plus, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export default function FinancePage() {
  const { transactions, accounts, categories, budgets, settings } = useFinOS();
  const sortedTx = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Finance Tracker</h1>
          <p className="text-sm text-muted-foreground">Transactions, accounts, budgets & recurring</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Add Transaction
        </Button>
      </div>

      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="budgets">Budgets</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="mt-4 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search transactions..." className="pl-9" />
            </div>
            <Button variant="outline" size="icon"><Filter className="h-4 w-4" /></Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {sortedTx.map((tx) => {
                  const cat = categories.find((c) => c.id === tx.categoryId);
                  const acc = accounts.find((a) => a.id === tx.accountId);
                  const isIncome = tx.type === "income";
                  return (
                    <div key={tx.id} className="flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${isIncome ? 'bg-profit-muted' : 'bg-secondary'}`}>
                          {isIncome ? <ArrowUpRight className="h-4 w-4 text-profit" /> : <ArrowDownRight className="h-4 w-4 text-muted-foreground" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{tx.note}</p>
                          <p className="text-xs text-muted-foreground">{cat?.name} · {acc?.name} · {tx.date}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-mono font-semibold ${isIncome ? 'text-profit' : ''}`}>
                          {isIncome ? '+' : '-'}{formatCurrency(tx.amount, tx.currency)}
                        </span>
                        <div className="flex gap-1 mt-0.5 justify-end">
                          {tx.isRecurring && <Badge variant="secondary" className="text-[10px]">Recurring</Badge>}
                          {tx.taxTag !== 'untagged' && <Badge variant="outline" className="text-[10px] capitalize">{tx.taxTag}</Badge>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounts" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((acc) => (
              <Card key={acc.id} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="pt-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: acc.color }} />
                      <span className="text-sm font-medium">{acc.name}</span>
                    </div>
                    <Badge variant="secondary" className="text-[10px] capitalize">{acc.type.replace('_', ' ')}</Badge>
                  </div>
                  <p className={`text-xl font-bold font-mono ${acc.balance < 0 ? 'text-loss' : ''}`}>
                    {formatCurrency(acc.balance, acc.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{acc.currency}</p>
                </CardContent>
              </Card>
            ))}
            <Card className="border-dashed hover:border-primary/50 transition-colors cursor-pointer flex items-center justify-center min-h-[120px]">
              <div className="text-center text-muted-foreground">
                <Plus className="h-6 w-6 mx-auto mb-1" />
                <span className="text-sm">Add Account</span>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="budgets" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {budgets.map((b) => {
              const cat = categories.find((c) => c.id === b.categoryId);
              const pct = (b.spent / b.amount) * 100;
              const remaining = b.amount - b.spent;
              return (
                <Card key={b.id}>
                  <CardContent className="pt-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{cat?.name}</span>
                      <Badge variant={pct >= 90 ? 'destructive' : pct >= 70 ? 'secondary' : 'secondary'} className="text-xs">
                        {pct.toFixed(0)}%
                      </Badge>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden mb-2">
                      <div className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-loss' : pct >= 70 ? 'bg-warning' : 'bg-profit'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatCurrency(b.spent, b.currency)} spent</span>
                      <span>{formatCurrency(remaining, b.currency)} left</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
