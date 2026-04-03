import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useFinOS } from "@/lib/store";
import { formatCurrency, formatPercent } from "@/lib/currency";
import { TrendingUp, TrendingDown, Plus, Bitcoin, Building2, Gem, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const ASSET_COLORS = ["hsl(220, 70%, 50%)", "hsl(152, 60%, 40%)", "hsl(38, 92%, 50%)", "hsl(280, 65%, 55%)", "hsl(350, 65%, 55%)", "hsl(190, 80%, 42%)"];
const typeIcons: Record<string, React.ReactNode> = {
  stock: <BarChart3 className="h-4 w-4" />,
  crypto: <Bitcoin className="h-4 w-4" />,
  real_estate: <Building2 className="h-4 w-4" />,
  gold: <Gem className="h-4 w-4" />,
};

export default function AssetsPage() {
  const { assets, settings } = useFinOS();
  const totalValue = useFinOS(s => s.totalPortfolioValue());
  const totalCost = useFinOS(s => s.totalPortfolioCost());
  const totalPL = totalValue - totalCost;
  const plPercent = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;

  const allocation = assets.reduce((acc, a) => {
    const label = a.type === 'stock' ? 'Stocks' : a.type === 'crypto' ? 'Crypto' : a.type === 'real_estate' ? 'Real Estate' : a.type === 'gold' ? 'Gold' : 'Other';
    const existing = acc.find(x => x.name === label);
    const val = a.currentPrice * a.quantity;
    if (existing) existing.value += val; else acc.push({ name: label, value: val });
    return acc;
  }, [] as { name: string; value: number }[]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Assets & Investments</h1>
          <p className="text-sm text-muted-foreground">Stocks, crypto, real estate & more</p>
        </div>
        <Button className="gap-2"><Plus className="h-4 w-4" /> Add Asset</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <span className="text-sm text-muted-foreground">Total Value</span>
            <p className="text-2xl font-bold font-mono mt-1">{formatCurrency(totalValue, settings.defaultCurrency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <span className="text-sm text-muted-foreground">Total Invested</span>
            <p className="text-2xl font-bold font-mono mt-1">{formatCurrency(totalCost, settings.defaultCurrency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <span className="text-sm text-muted-foreground">Total P&L</span>
            <p className={`text-2xl font-bold font-mono mt-1 ${totalPL >= 0 ? 'text-profit' : 'text-loss'}`}>
              {formatCurrency(totalPL, settings.defaultCurrency)}
            </p>
            <Badge className={`text-xs mt-1 ${totalPL >= 0 ? 'bg-profit-muted text-profit' : 'bg-loss-muted text-loss'}`}>
              {formatPercent(plPercent)}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Allocation Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={allocation} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {allocation.map((_, i) => <Cell key={i} fill={ASSET_COLORS[i % ASSET_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, '']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5 mt-2">
              {allocation.map((item, i) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ASSET_COLORS[i] }} />
                    <span className="text-muted-foreground">{item.name}</span>
                  </div>
                  <span className="font-mono">{((item.value / totalValue) * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Asset Table */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">All Assets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {assets.map(a => {
                const val = a.currentPrice * a.quantity;
                const cost = a.buyPrice * a.quantity;
                const pl = val - cost;
                const plPct = cost > 0 ? (pl / cost) * 100 : 0;
                return (
                  <div key={a.id} className="flex items-center justify-between py-3 border-b last:border-0 hover:bg-secondary/30 transition-colors cursor-pointer rounded px-2">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">
                        {typeIcons[a.type] || <BarChart3 className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{a.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.ticker && `${a.ticker} · `}{a.quantity} units · {formatCurrency(a.buyPrice, a.currency)} avg
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono font-medium">{formatCurrency(val, a.currency)}</p>
                      <div className="flex items-center gap-1 justify-end">
                        {pl >= 0 ? <TrendingUp className="h-3 w-3 text-profit" /> : <TrendingDown className="h-3 w-3 text-loss" />}
                        <span className={`text-xs font-mono ${pl >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {formatPercent(plPct)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
