import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFinOS } from "@/lib/store";
import { formatCurrency, formatPercent } from "@/lib/currency";
import { portfolioHistory } from "@/lib/sample-data";
import { TrendingUp, TrendingDown, Plus, Bitcoin, Building2, Gem, BarChart3, Landmark, Car, PieChart as PieIcon, LineChart as LineIcon, Wallet, CreditCard, GraduationCap, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { useMemo } from "react";
import { Separator } from "@/components/ui/separator";

const ASSET_COLORS = ["hsl(220, 70%, 50%)", "hsl(152, 60%, 40%)", "hsl(38, 92%, 50%)", "hsl(280, 65%, 55%)", "hsl(350, 65%, 55%)", "hsl(190, 80%, 42%)", "hsl(320, 60%, 50%)", "hsl(160, 70%, 35%)"];
const typeIcons: Record<string, React.ReactNode> = {
  stock: <BarChart3 className="h-4 w-4" />,
  mutual_fund: <LineIcon className="h-4 w-4" />,
  crypto: <Bitcoin className="h-4 w-4" />,
  real_estate: <Building2 className="h-4 w-4" />,
  gold: <Gem className="h-4 w-4" />,
  vehicle: <Car className="h-4 w-4" />,
};
const loanIcons: Record<string, React.ReactNode> = {
  home: <Building2 className="h-4 w-4" />,
  car: <Car className="h-4 w-4" />,
  education: <GraduationCap className="h-4 w-4" />,
  personal: <Wallet className="h-4 w-4" />,
  business: <Briefcase className="h-4 w-4" />,
  credit_card: <CreditCard className="h-4 w-4" />,
  other: <Landmark className="h-4 w-4" />,
};

export default function AssetsPage() {
  const { assets, loans, settings } = useFinOS();
  const totalValue = useFinOS(s => s.totalPortfolioValue());
  const totalCost = useFinOS(s => s.totalPortfolioCost());
  const totalLoanOutstanding = useFinOS(s => s.totalLoanOutstanding());
  const totalPL = totalValue - totalCost;
  const plPercent = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;

  const stocks = assets.filter(a => a.type === 'stock');
  const mutualFunds = assets.filter(a => a.type === 'mutual_fund');
  const cryptos = assets.filter(a => a.type === 'crypto');
  const physicalAssets = assets.filter(a => ['real_estate', 'vehicle', 'gold', 'other'].includes(a.type));

  const allocation = useMemo(() => {
    const groups: Record<string, number> = {};
    assets.forEach(a => {
      const label = a.type === 'stock' ? 'Stocks' : a.type === 'mutual_fund' ? 'Mutual Funds' : a.type === 'crypto' ? 'Crypto' : a.type === 'real_estate' ? 'Real Estate' : a.type === 'gold' ? 'Gold' : a.type === 'vehicle' ? 'Vehicles' : 'Other';
      groups[label] = (groups[label] || 0) + a.currentPrice * a.quantity;
    });
    return Object.entries(groups).map(([name, value]) => ({ name, value }));
  }, [assets]);

  const stocksValue = stocks.reduce((s, a) => s + a.currentPrice * a.quantity, 0);
  const stocksCost = stocks.reduce((s, a) => s + a.buyPrice * a.quantity, 0);
  const mfValue = mutualFunds.reduce((s, a) => s + a.currentPrice * a.quantity, 0);
  const mfCost = mutualFunds.reduce((s, a) => s + a.buyPrice * a.quantity, 0);
  const cryptoValue = cryptos.reduce((s, a) => s + a.currentPrice * a.quantity, 0);
  const cryptoCost = cryptos.reduce((s, a) => s + a.buyPrice * a.quantity, 0);
  const physicalValue = physicalAssets.reduce((s, a) => s + a.currentPrice * a.quantity, 0);
  const physicalCost = physicalAssets.reduce((s, a) => s + a.buyPrice * a.quantity, 0);

  const totalEMI = loans.filter(l => l.status === 'active').reduce((s, l) => s + l.emi, 0);

  const renderAssetRow = (a: typeof assets[0]) => {
    const val = a.currentPrice * a.quantity;
    const cost = a.buyPrice * a.quantity;
    const pl = val - cost;
    const plPct = cost > 0 ? (pl / cost) * 100 : 0;
    return (
      <TableRow key={a.id} className="cursor-pointer hover:bg-secondary/30">
        <TableCell>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">
              {typeIcons[a.type] || <BarChart3 className="h-4 w-4" />}
            </div>
            <div>
              <p className="text-sm font-medium">{a.name}</p>
              <p className="text-xs text-muted-foreground">{a.ticker && `${a.ticker}`}{a.exchange ? ` · ${a.exchange}` : ''}</p>
            </div>
          </div>
        </TableCell>
        <TableCell className="text-right font-mono text-sm">{a.quantity}{a.type === 'crypto' ? '' : ' units'}</TableCell>
        <TableCell className="text-right font-mono text-sm">{formatCurrency(a.buyPrice, a.currency)}</TableCell>
        <TableCell className="text-right font-mono text-sm">{formatCurrency(a.currentPrice, a.currency)}</TableCell>
        <TableCell className="text-right font-mono text-sm">{formatCurrency(cost, a.currency)}</TableCell>
        <TableCell className="text-right font-mono text-sm font-medium">{formatCurrency(val, a.currency)}</TableCell>
        <TableCell className="text-right">
          <div className="flex items-center gap-1 justify-end">
            {pl >= 0 ? <TrendingUp className="h-3 w-3 text-profit" /> : <TrendingDown className="h-3 w-3 text-loss" />}
            <span className={`text-sm font-mono font-medium ${pl >= 0 ? 'text-profit' : 'text-loss'}`}>{formatPercent(plPct)}</span>
          </div>
          <span className={`text-xs font-mono ${pl >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(pl, a.currency)}</span>
        </TableCell>
      </TableRow>
    );
  };

  const renderSectionSummary = (label: string, value: number, cost: number) => {
    const pl = value - cost;
    const pct = cost > 0 ? (pl / cost) * 100 : 0;
    return (
      <div className="grid grid-cols-3 gap-4 mb-4">
        <Card><CardContent className="pt-4 pb-3">
          <span className="text-xs text-muted-foreground">Current Value</span>
          <p className="text-lg font-bold font-mono mt-0.5">{formatCurrency(value, settings.defaultCurrency)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <span className="text-xs text-muted-foreground">Invested</span>
          <p className="text-lg font-bold font-mono mt-0.5">{formatCurrency(cost, settings.defaultCurrency)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <span className="text-xs text-muted-foreground">P&L</span>
          <p className={`text-lg font-bold font-mono mt-0.5 ${pl >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(pl, settings.defaultCurrency)}</p>
          <Badge className={`text-xs ${pl >= 0 ? 'bg-profit-muted text-profit' : 'bg-loss-muted text-loss'}`}>{formatPercent(pct)}</Badge>
        </CardContent></Card>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Assets & Investments</h1>
          <p className="text-sm text-muted-foreground">Complete portfolio: investments, assets, and liabilities</p>
        </div>
        <Button className="gap-2"><Plus className="h-4 w-4" /> Add Asset</Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-flex">
          <TabsTrigger value="overview" className="gap-1.5"><PieIcon className="h-3.5 w-3.5 hidden sm:block" /> Overview</TabsTrigger>
          <TabsTrigger value="stocks" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5 hidden sm:block" /> Stocks</TabsTrigger>
          <TabsTrigger value="mutual-funds" className="gap-1.5"><LineIcon className="h-3.5 w-3.5 hidden sm:block" /> Mutual Funds</TabsTrigger>
          <TabsTrigger value="crypto" className="gap-1.5"><Bitcoin className="h-3.5 w-3.5 hidden sm:block" /> Crypto</TabsTrigger>
          <TabsTrigger value="physical" className="gap-1.5"><Building2 className="h-3.5 w-3.5 hidden sm:block" /> Physical</TabsTrigger>
          <TabsTrigger value="loans" className="gap-1.5"><Landmark className="h-3.5 w-3.5 hidden sm:block" /> Loans</TabsTrigger>
        </TabsList>

        {/* === OVERVIEW === */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-5">
                <span className="text-xs text-muted-foreground">Total Value</span>
                <p className="text-xl font-bold font-mono mt-1">{formatCurrency(totalValue + physicalValue, settings.defaultCurrency)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <span className="text-xs text-muted-foreground">Total Invested</span>
                <p className="text-xl font-bold font-mono mt-1">{formatCurrency(totalCost + physicalCost, settings.defaultCurrency)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <span className="text-xs text-muted-foreground">Total P&L</span>
                <p className={`text-xl font-bold font-mono mt-1 ${totalPL + (physicalValue - physicalCost) >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {formatCurrency(totalPL + (physicalValue - physicalCost), settings.defaultCurrency)}
                </p>
                <Badge className={`text-xs mt-1 ${totalPL >= 0 ? 'bg-profit-muted text-profit' : 'bg-loss-muted text-loss'}`}>
                  {formatPercent(plPercent)}
                </Badge>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <span className="text-xs text-muted-foreground">Total Loans</span>
                <p className="text-xl font-bold font-mono mt-1 text-loss">{formatCurrency(totalLoanOutstanding, settings.defaultCurrency)}</p>
                <span className="text-xs text-muted-foreground">EMI: {formatCurrency(totalEMI, settings.defaultCurrency)}/mo</span>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Allocation Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Asset Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={allocation} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                        {allocation.map((_, i) => <Cell key={i} fill={ASSET_COLORS[i % ASSET_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => [formatCurrency(v, settings.defaultCurrency), '']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5 mt-2">
                  {allocation.map((item, i) => (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ASSET_COLORS[i % ASSET_COLORS.length] }} />
                        <span className="text-muted-foreground">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{((item.value / (totalValue + physicalValue)) * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Portfolio Growth */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Portfolio Growth</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={portfolioHistory}>
                      <defs>
                        <linearGradient id="portVal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(220, 70%, 50%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(220, 70%, 50%)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="portInv" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(152, 60%, 40%)" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="hsl(152, 60%, 40%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} formatter={(v: number) => [formatCurrency(v, settings.defaultCurrency), '']} />
                      <Area type="monotone" dataKey="value" stroke="hsl(220, 70%, 50%)" fill="url(#portVal)" strokeWidth={2} name="Value" />
                      <Area type="monotone" dataKey="invested" stroke="hsl(152, 60%, 40%)" fill="url(#portInv)" strokeWidth={2} name="Invested" strokeDasharray="5 5" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Category Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Stocks', value: stocksValue, cost: stocksCost, icon: <BarChart3 className="h-4 w-4" />, count: stocks.length },
              { label: 'Mutual Funds', value: mfValue, cost: mfCost, icon: <LineIcon className="h-4 w-4" />, count: mutualFunds.length },
              { label: 'Crypto', value: cryptoValue, cost: cryptoCost, icon: <Bitcoin className="h-4 w-4" />, count: cryptos.length },
              { label: 'Physical', value: physicalValue, cost: physicalCost, icon: <Building2 className="h-4 w-4" />, count: physicalAssets.length },
            ].map(cat => {
              const pl = cat.value - cat.cost;
              const pct = cat.cost > 0 ? (pl / cat.cost) * 100 : 0;
              return (
                <Card key={cat.label}>
                  <CardContent className="pt-5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">{cat.icon}</div>
                        <div>
                          <span className="text-sm font-medium">{cat.label}</span>
                          <p className="text-xs text-muted-foreground">{cat.count} holdings</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-lg font-bold font-mono">{formatCurrency(cat.value, settings.defaultCurrency)}</p>
                    <div className="flex items-center gap-1 mt-1">
                      {pl >= 0 ? <TrendingUp className="h-3 w-3 text-profit" /> : <TrendingDown className="h-3 w-3 text-loss" />}
                      <span className={`text-xs font-mono ${pl >= 0 ? 'text-profit' : 'text-loss'}`}>{formatPercent(pct)} ({formatCurrency(pl, settings.defaultCurrency)})</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* === STOCKS === */}
        <TabsContent value="stocks" className="mt-4 space-y-4">
          {renderSectionSummary('Stocks', stocksValue, stocksCost)}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Stock Holdings</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Stock</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Avg Buy</TableHead>
                    <TableHead className="text-right">Current</TableHead>
                    <TableHead className="text-right">Invested</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">P&L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>{stocks.map(renderAssetRow)}</TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === MUTUAL FUNDS === */}
        <TabsContent value="mutual-funds" className="mt-4 space-y-4">
          {renderSectionSummary('Mutual Funds', mfValue, mfCost)}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Mutual Fund Holdings</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fund</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                    <TableHead className="text-right">Avg NAV</TableHead>
                    <TableHead className="text-right">Current NAV</TableHead>
                    <TableHead className="text-right">Invested</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">P&L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mutualFunds.map(a => {
                    const val = a.currentPrice * a.quantity;
                    const cost = a.buyPrice * a.quantity;
                    const pl = val - cost;
                    const plPct = cost > 0 ? (pl / cost) * 100 : 0;
                    return (
                      <TableRow key={a.id} className="cursor-pointer hover:bg-secondary/30">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">
                              <LineIcon className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{a.name}</p>
                              <p className="text-xs text-muted-foreground">{a.fundHouse}{a.sipAmount ? ` · SIP ${formatCurrency(a.sipAmount, a.currency)}/mo` : ''}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{a.quantity}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{formatCurrency(a.buyPrice, a.currency)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{formatCurrency(a.currentPrice, a.currency)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{formatCurrency(cost, a.currency)}</TableCell>
                        <TableCell className="text-right font-mono text-sm font-medium">{formatCurrency(val, a.currency)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-1 justify-end">
                            {pl >= 0 ? <TrendingUp className="h-3 w-3 text-profit" /> : <TrendingDown className="h-3 w-3 text-loss" />}
                            <span className={`text-sm font-mono font-medium ${pl >= 0 ? 'text-profit' : 'text-loss'}`}>{formatPercent(plPct)}</span>
                          </div>
                          <span className={`text-xs font-mono ${pl >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(pl, a.currency)}</span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === CRYPTO === */}
        <TabsContent value="crypto" className="mt-4 space-y-4">
          {renderSectionSummary('Crypto', cryptoValue, cryptoCost)}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Crypto Holdings</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Coin</TableHead>
                    <TableHead className="text-right">Holdings</TableHead>
                    <TableHead className="text-right">Avg Buy</TableHead>
                    <TableHead className="text-right">Current</TableHead>
                    <TableHead className="text-right">Invested</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">P&L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>{cryptos.map(renderAssetRow)}</TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === PHYSICAL ASSETS === */}
        <TabsContent value="physical" className="mt-4 space-y-4">
          {renderSectionSummary('Physical Assets', physicalValue, physicalCost)}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {physicalAssets.map(a => {
              const val = a.currentPrice * a.quantity;
              const cost = a.buyPrice * a.quantity;
              const pl = val - cost;
              const plPct = cost > 0 ? (pl / cost) * 100 : 0;
              const isDepreciating = pl < 0;
              return (
                <Card key={a.id} className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="pt-5">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">
                        {typeIcons[a.type] || <BarChart3 className="h-4 w-4" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{a.name}</p>
                          <Badge variant="secondary" className="text-[10px] capitalize">{a.type.replace('_', ' ')}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3">
                          <div>
                            <span className="text-xs text-muted-foreground">Purchase Price</span>
                            <p className="text-sm font-mono">{formatCurrency(cost, a.currency)}</p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Current Value</span>
                            <p className="text-sm font-mono font-medium">{formatCurrency(val, a.currency)}</p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">{isDepreciating ? 'Depreciation' : 'Appreciation'}</span>
                            <p className={`text-sm font-mono ${pl >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(pl, a.currency)} ({formatPercent(plPct)})</p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Purchased</span>
                            <p className="text-sm">{a.purchaseDate}</p>
                          </div>
                        </div>
                        {a.notes && <p className="text-xs text-muted-foreground mt-2 italic">{a.notes}</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* === LOANS === */}
        <TabsContent value="loans" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-5">
                <span className="text-xs text-muted-foreground">Total Outstanding</span>
                <p className="text-xl font-bold font-mono mt-1 text-loss">{formatCurrency(totalLoanOutstanding, settings.defaultCurrency)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <span className="text-xs text-muted-foreground">Monthly EMI</span>
                <p className="text-xl font-bold font-mono mt-1">{formatCurrency(totalEMI, settings.defaultCurrency)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <span className="text-xs text-muted-foreground">Active Loans</span>
                <p className="text-xl font-bold font-mono mt-1">{loans.filter(l => l.status === 'active').length}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Loan Details</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {loans.map(loan => {
                  const paid = loan.principalAmount - loan.outstandingAmount;
                  const paidPct = (paid / loan.principalAmount) * 100;
                  return (
                    <div key={loan.id} className="px-4 py-4 hover:bg-secondary/30 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground shrink-0">
                          {loanIcons[loan.type] || <Landmark className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">{loan.name}</p>
                              <p className="text-xs text-muted-foreground">{loan.lender} · {loan.interestRate}% APR</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-mono font-bold text-loss">{formatCurrency(loan.outstandingAmount, loan.currency)}</p>
                              {loan.emi > 0 && <p className="text-xs text-muted-foreground">EMI: {formatCurrency(loan.emi, loan.currency)}/mo</p>}
                            </div>
                          </div>
                          <div className="mt-3">
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                              <span>{formatCurrency(paid, loan.currency)} paid</span>
                              <span>{paidPct.toFixed(0)}% complete</span>
                            </div>
                            <div className="h-2 rounded-full bg-secondary overflow-hidden">
                              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${paidPct}%` }} />
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                              <span>Start: {loan.startDate}</span>
                              <span>End: {loan.endDate}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
