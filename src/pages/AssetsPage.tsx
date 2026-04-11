import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { buildPortfolioHistory } from "@/lib/analytics";
import { parseAssetCsv } from "@/lib/asset-import";
import { formatCurrency, formatPercent } from "@/lib/currency";
import { useFinOS } from "@/lib/store";
import { Asset, AssetType, Currency, CURRENCY_CONFIG, VaultDocument } from "@/lib/types";
import {
  BarChart3,
  Bitcoin,
  Briefcase,
  Building2,
  Car,
  CreditCard,
  Edit2,
  FileText,
  Gem,
  GraduationCap,
  Landmark,
  LineChart as LineIcon,
  PieChart as PieIcon,
  Plus,
  TrendingDown,
  TrendingUp,
  Trash2,
  Upload,
  Wallet,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";

const ASSET_COLORS = [
  "hsl(220, 70%, 50%)",
  "hsl(152, 60%, 40%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 65%, 55%)",
  "hsl(350, 65%, 55%)",
  "hsl(190, 80%, 42%)",
  "hsl(320, 60%, 50%)",
  "hsl(160, 70%, 35%)",
];

const typeIcons: Record<string, React.ReactNode> = {
  stock: <BarChart3 className="h-4 w-4" />,
  mutual_fund: <LineIcon className="h-4 w-4" />,
  crypto: <Bitcoin className="h-4 w-4" />,
  real_estate: <Building2 className="h-4 w-4" />,
  gold: <Gem className="h-4 w-4" />,
  vehicle: <Car className="h-4 w-4" />,
  other: <Wallet className="h-4 w-4" />,
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

const assetTypeLabels: Record<AssetType, string> = {
  stock: "Stock",
  mutual_fund: "Mutual Fund",
  crypto: "Crypto",
  real_estate: "Real Estate",
  vehicle: "Vehicle",
  gold: "Gold",
  other: "Other",
};

const initialAssetForm = {
  name: "",
  type: "stock" as AssetType,
  ticker: "",
  exchange: "",
  quantity: "",
  buyPrice: "",
  currentPrice: "",
  currency: "USD" as Currency,
  purchaseDate: new Date().toISOString().split("T")[0],
  fundHouse: "",
  sipAmount: "",
  notes: "",
};

function generateId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function AssetsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { assets, loans, documents, settings, addAsset, importAssets, updateAsset, deleteAsset } = useFinOS();
  const portfolioHistory = buildPortfolioHistory(assets);
  const totalValue = useFinOS((state) => state.totalPortfolioValue());
  const totalCost = useFinOS((state) => state.totalPortfolioCost());
  const totalLoanOutstanding = useFinOS((state) => state.totalLoanOutstanding());

  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [assetDetailOpen, setAssetDetailOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [deleteAssetId, setDeleteAssetId] = useState<string | null>(null);
  const [assetForm, setAssetForm] = useState(initialAssetForm);
  const [activeTab, setActiveTab] = useState<string>(() => searchParams.get("tab") || "overview");
  const csvImportRef = useRef<HTMLInputElement>(null);

  const totalPL = totalValue - totalCost;
  const plPercent = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;

  const stocks = assets.filter((asset) => asset.type === "stock");
  const mutualFunds = assets.filter((asset) => asset.type === "mutual_fund");
  const cryptos = assets.filter((asset) => asset.type === "crypto");
  const physicalAssets = assets.filter((asset) => ["real_estate", "vehicle", "gold", "other"].includes(asset.type));

  const assetDocumentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    documents.forEach((document) => {
      if (document.linkedEntityType === "asset" && document.linkedEntityId) {
        counts[document.linkedEntityId] = (counts[document.linkedEntityId] || 0) + 1;
      }
    });
    return counts;
  }, [documents]);

  const selectedAssetDocuments = useMemo(
    () =>
      selectedAsset
        ? documents.filter((document) => document.linkedEntityType === "asset" && document.linkedEntityId === selectedAsset.id)
        : [],
    [documents, selectedAsset]
  );

  const allocation = useMemo(() => {
    const groups: Record<string, number> = {};
    assets.forEach((asset) => {
      const label =
        asset.type === "stock"
          ? "Stocks"
          : asset.type === "mutual_fund"
            ? "Mutual Funds"
            : asset.type === "crypto"
              ? "Crypto"
              : asset.type === "real_estate"
                ? "Real Estate"
                : asset.type === "gold"
                  ? "Gold"
                  : asset.type === "vehicle"
                    ? "Vehicles"
                    : "Other";
      groups[label] = (groups[label] || 0) + asset.currentPrice * asset.quantity;
    });
    return Object.entries(groups).map(([name, value]) => ({ name, value }));
  }, [assets]);

  const stocksValue = stocks.reduce((sum, asset) => sum + asset.currentPrice * asset.quantity, 0);
  const stocksCost = stocks.reduce((sum, asset) => sum + asset.buyPrice * asset.quantity, 0);
  const mutualFundsValue = mutualFunds.reduce((sum, asset) => sum + asset.currentPrice * asset.quantity, 0);
  const mutualFundsCost = mutualFunds.reduce((sum, asset) => sum + asset.buyPrice * asset.quantity, 0);
  const cryptoValue = cryptos.reduce((sum, asset) => sum + asset.currentPrice * asset.quantity, 0);
  const cryptoCost = cryptos.reduce((sum, asset) => sum + asset.buyPrice * asset.quantity, 0);
  const physicalValue = physicalAssets.reduce((sum, asset) => sum + asset.currentPrice * asset.quantity, 0);
  const physicalCost = physicalAssets.reduce((sum, asset) => sum + asset.buyPrice * asset.quantity, 0);
  const totalEmi = loans.filter((loan) => loan.status === "active").reduce((sum, loan) => sum + loan.emi, 0);

  const openAddAsset = () => {
    setEditingAsset(null);
    setAssetForm({
      ...initialAssetForm,
      currency: settings.defaultCurrency,
      purchaseDate: new Date().toISOString().split("T")[0],
    });
    setAssetModalOpen(true);
  };

  const openEditAsset = (asset: Asset) => {
    setEditingAsset(asset);
    setAssetForm({
      name: asset.name,
      type: asset.type,
      ticker: asset.ticker ?? "",
      exchange: asset.exchange ?? "",
      quantity: asset.quantity.toString(),
      buyPrice: asset.buyPrice.toString(),
      currentPrice: asset.currentPrice.toString(),
      currency: asset.currency,
      purchaseDate: asset.purchaseDate,
      fundHouse: asset.fundHouse ?? "",
      sipAmount: asset.sipAmount?.toString() ?? "",
      notes: asset.notes ?? "",
    });
    setAssetModalOpen(true);
  };

  const openAssetDetails = (asset: Asset) => {
    setSelectedAsset(asset);
    setAssetDetailOpen(true);
  };

  const openDeleteAsset = (assetId: string) => {
    setDeleteAssetId(assetId);
    setDeleteConfirmOpen(true);
  };

  useEffect(() => {
    const nextTab = searchParams.get("tab") || "overview";
    if (nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
  }, [activeTab, searchParams]);

  useEffect(() => {
    const action = searchParams.get("action");
    if (!action) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("action");
    setSearchParams(nextParams, { replace: true });

    if (action === "add-asset") {
      openAddAsset();
      return;
    }

    if (action === "import-csv") {
      csvImportRef.current?.click();
    }
  }, [searchParams, setSearchParams]);

  const handleSaveAsset = () => {
    const quantity = parseFloat(assetForm.quantity);
    const buyPrice = parseFloat(assetForm.buyPrice);
    const currentPrice = parseFloat(assetForm.currentPrice);
    const sipAmount = assetForm.sipAmount ? parseFloat(assetForm.sipAmount) : undefined;

    if (!assetForm.name.trim()) {
      toast.error("Asset name is required");
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(buyPrice) || buyPrice < 0 || !Number.isFinite(currentPrice) || currentPrice < 0) {
      toast.error("Enter valid quantity and pricing details");
      return;
    }

    const payload: Asset = {
      id: editingAsset?.id ?? generateId("asset"),
      name: assetForm.name.trim(),
      type: assetForm.type,
      ticker: assetForm.ticker.trim() || undefined,
      exchange: assetForm.exchange.trim() || undefined,
      quantity,
      buyPrice,
      currentPrice,
      currency: assetForm.currency,
      purchaseDate: assetForm.purchaseDate,
      notes: assetForm.notes.trim() || undefined,
      fundHouse: assetForm.type === "mutual_fund" ? assetForm.fundHouse.trim() || undefined : undefined,
      nav: assetForm.type === "mutual_fund" ? currentPrice : undefined,
      sipAmount: assetForm.type === "mutual_fund" && Number.isFinite(sipAmount) ? sipAmount : undefined,
    };

    if (editingAsset) {
      updateAsset(editingAsset.id, payload);
      if (selectedAsset?.id === editingAsset.id) {
        setSelectedAsset(payload);
      }
      toast.success("Asset updated");
    } else {
      addAsset(payload);
      toast.success("Asset added");
    }

    setAssetModalOpen(false);
  };

  const handleDeleteAsset = () => {
    if (!deleteAssetId) return;

    deleteAsset(deleteAssetId);
    if (selectedAsset?.id === deleteAssetId) {
      setSelectedAsset(null);
      setAssetDetailOpen(false);
    }
    toast.success("Asset deleted");
    setDeleteConfirmOpen(false);
    setDeleteAssetId(null);
  };

  const handleImportCsv = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const csvText = typeof loadEvent.target?.result === "string" ? loadEvent.target.result : "";
      const result = parseAssetCsv(csvText, settings.defaultCurrency);

      if (result.assets.length === 0) {
        toast.error(result.errors[0] ?? "No valid asset rows were found in the CSV file");
        return;
      }

      const importedAssets: Asset[] = result.assets.map((asset, index) => ({
        ...asset,
        id: generateId(`asset-import-${index}`),
      }));

      importAssets(importedAssets);

      if (result.errors.length > 0) {
        toast.warning(`Imported ${result.assets.length} assets. Skipped ${result.errors.length} row${result.errors.length === 1 ? "" : "s"}.`);
      } else {
        toast.success(`Imported ${result.assets.length} asset${result.assets.length === 1 ? "" : "s"} from CSV`);
      }
    };

    reader.onerror = () => {
      toast.error("Unable to read the selected CSV file");
    };

    reader.readAsText(file);
    event.target.value = "";
  };

  const renderAssetRow = (asset: Asset) => {
    const value = asset.currentPrice * asset.quantity;
    const cost = asset.buyPrice * asset.quantity;
    const profitLoss = value - cost;
    const profitLossPercent = cost > 0 ? (profitLoss / cost) * 100 : 0;
    const linkedDocCount = assetDocumentCounts[asset.id] || 0;

    return (
      <TableRow key={asset.id} className="cursor-pointer hover:bg-secondary/30" onClick={() => openAssetDetails(asset)}>
        <TableCell>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
              {typeIcons[asset.type] || <BarChart3 className="h-4 w-4" />}
            </div>
            <div>
              <p className="text-sm font-medium">{asset.name}</p>
              <p className="text-xs text-muted-foreground">
                {asset.ticker ? asset.ticker : assetTypeLabels[asset.type]}
                {asset.exchange ? ` / ${asset.exchange}` : ""}
                {linkedDocCount > 0 ? ` · ${linkedDocCount} doc${linkedDocCount === 1 ? "" : "s"}` : ""}
              </p>
            </div>
          </div>
        </TableCell>
        <TableCell className="text-right font-mono text-sm">
          {asset.quantity}
          {asset.type === "crypto" ? "" : " units"}
        </TableCell>
        <TableCell className="text-right font-mono text-sm">{formatCurrency(asset.buyPrice, asset.currency)}</TableCell>
        <TableCell className="text-right font-mono text-sm">{formatCurrency(asset.currentPrice, asset.currency)}</TableCell>
        <TableCell className="text-right font-mono text-sm">{formatCurrency(cost, asset.currency)}</TableCell>
        <TableCell className="text-right font-mono text-sm font-medium">{formatCurrency(value, asset.currency)}</TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1">
            {profitLoss >= 0 ? <TrendingUp className="h-3 w-3 text-profit" /> : <TrendingDown className="h-3 w-3 text-loss" />}
            <span className={`text-sm font-mono font-medium ${profitLoss >= 0 ? "text-profit" : "text-loss"}`}>
              {formatPercent(profitLossPercent)}
            </span>
          </div>
          <span className={`text-xs font-mono ${profitLoss >= 0 ? "text-profit" : "text-loss"}`}>{formatCurrency(profitLoss, asset.currency)}</span>
        </TableCell>
      </TableRow>
    );
  };

  const renderSectionSummary = (value: number, cost: number) => {
    const profitLoss = value - cost;
    const percentage = cost > 0 ? (profitLoss / cost) * 100 : 0;
    return (
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pb-3 pt-4">
            <span className="text-xs text-muted-foreground">Current Value</span>
            <p className="mt-0.5 text-lg font-bold font-mono">{formatCurrency(value, settings.defaultCurrency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pb-3 pt-4">
            <span className="text-xs text-muted-foreground">Invested</span>
            <p className="mt-0.5 text-lg font-bold font-mono">{formatCurrency(cost, settings.defaultCurrency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pb-3 pt-4">
            <span className="text-xs text-muted-foreground">P&amp;L</span>
            <p className={`mt-0.5 text-lg font-bold font-mono ${profitLoss >= 0 ? "text-profit" : "text-loss"}`}>
              {formatCurrency(profitLoss, settings.defaultCurrency)}
            </p>
            <Badge className={`text-xs ${profitLoss >= 0 ? "bg-profit-muted text-profit" : "bg-loss-muted text-loss"}`}>{formatPercent(percentage)}</Badge>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <input ref={csvImportRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportCsv} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Assets & Investments</h1>
          <p className="text-sm text-muted-foreground">Complete portfolio: investments, assets, and liabilities</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => csvImportRef.current?.click()}>
            <Upload className="h-4 w-4" /> Import CSV
          </Button>
          <Button className="gap-2" onClick={openAddAsset}>
            <Plus className="h-4 w-4" /> Add Asset
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value);
          const nextParams = new URLSearchParams(searchParams);
          if (value === "overview") {
            nextParams.delete("tab");
          } else {
            nextParams.set("tab", value);
          }
          setSearchParams(nextParams, { replace: true });
        }}
      >
        <TabsList className="grid w-full grid-cols-6 lg:inline-flex lg:w-auto">
          <TabsTrigger value="overview" className="gap-1.5"><PieIcon className="hidden h-3.5 w-3.5 sm:block" /> Overview</TabsTrigger>
          <TabsTrigger value="stocks" className="gap-1.5"><BarChart3 className="hidden h-3.5 w-3.5 sm:block" /> Stocks</TabsTrigger>
          <TabsTrigger value="mutual-funds" className="gap-1.5"><LineIcon className="hidden h-3.5 w-3.5 sm:block" /> Mutual Funds</TabsTrigger>
          <TabsTrigger value="crypto" className="gap-1.5"><Bitcoin className="hidden h-3.5 w-3.5 sm:block" /> Crypto</TabsTrigger>
          <TabsTrigger value="physical" className="gap-1.5"><Building2 className="hidden h-3.5 w-3.5 sm:block" /> Physical</TabsTrigger>
          <TabsTrigger value="loans" className="gap-1.5"><Landmark className="hidden h-3.5 w-3.5 sm:block" /> Loans</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-5">
                <span className="text-xs text-muted-foreground">Total Value</span>
                <p className="mt-1 text-xl font-bold font-mono">{formatCurrency(totalValue + physicalValue, settings.defaultCurrency)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <span className="text-xs text-muted-foreground">Total Invested</span>
                <p className="mt-1 text-xl font-bold font-mono">{formatCurrency(totalCost + physicalCost, settings.defaultCurrency)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <span className="text-xs text-muted-foreground">Total P&amp;L</span>
                <p className={`mt-1 text-xl font-bold font-mono ${totalPL + (physicalValue - physicalCost) >= 0 ? "text-profit" : "text-loss"}`}>
                  {formatCurrency(totalPL + (physicalValue - physicalCost), settings.defaultCurrency)}
                </p>
                <Badge className={`mt-1 text-xs ${totalPL >= 0 ? "bg-profit-muted text-profit" : "bg-loss-muted text-loss"}`}>{formatPercent(plPercent)}</Badge>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <span className="text-xs text-muted-foreground">Total Loans</span>
                <p className="mt-1 text-xl font-bold font-mono text-loss">{formatCurrency(totalLoanOutstanding, settings.defaultCurrency)}</p>
                <span className="text-xs text-muted-foreground">EMI: {formatCurrency(totalEmi, settings.defaultCurrency)}/mo</span>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Asset Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={allocation} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                        {allocation.map((_, index) => (
                          <Cell key={index} fill={ASSET_COLORS[index % ASSET_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [formatCurrency(value, settings.defaultCurrency), ""]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 space-y-1.5">
                  {allocation.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ASSET_COLORS[index % ASSET_COLORS.length] }} />
                        <span className="text-muted-foreground">{item.name}</span>
                      </div>
                      <span className="font-mono">
                        {totalValue + physicalValue > 0 ? ((item.value / (totalValue + physicalValue)) * 100).toFixed(1) : "0.0"}%
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

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
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                        formatter={(value: number) => [formatCurrency(value, settings.defaultCurrency), ""]}
                      />
                      <Area type="monotone" dataKey="value" stroke="hsl(220, 70%, 50%)" fill="url(#portVal)" strokeWidth={2} name="Value" />
                      <Area type="monotone" dataKey="invested" stroke="hsl(152, 60%, 40%)" fill="url(#portInv)" strokeWidth={2} name="Invested" strokeDasharray="5 5" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Stocks", value: stocksValue, cost: stocksCost, icon: <BarChart3 className="h-4 w-4" />, count: stocks.length },
              { label: "Mutual Funds", value: mutualFundsValue, cost: mutualFundsCost, icon: <LineIcon className="h-4 w-4" />, count: mutualFunds.length },
              { label: "Crypto", value: cryptoValue, cost: cryptoCost, icon: <Bitcoin className="h-4 w-4" />, count: cryptos.length },
              { label: "Physical", value: physicalValue, cost: physicalCost, icon: <Building2 className="h-4 w-4" />, count: physicalAssets.length },
            ].map((group) => {
              const profitLoss = group.value - group.cost;
              const percentage = group.cost > 0 ? (profitLoss / group.cost) * 100 : 0;
              return (
                <Card key={group.label}>
                  <CardContent className="pt-5">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-muted-foreground">{group.icon}</div>
                        <div>
                          <span className="text-sm font-medium">{group.label}</span>
                          <p className="text-xs text-muted-foreground">{group.count} holdings</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-lg font-bold font-mono">{formatCurrency(group.value, settings.defaultCurrency)}</p>
                    <div className="mt-1 flex items-center gap-1">
                      {profitLoss >= 0 ? <TrendingUp className="h-3 w-3 text-profit" /> : <TrendingDown className="h-3 w-3 text-loss" />}
                      <span className={`text-xs font-mono ${profitLoss >= 0 ? "text-profit" : "text-loss"}`}>
                        {formatPercent(percentage)} ({formatCurrency(profitLoss, settings.defaultCurrency)})
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="stocks" className="mt-4 space-y-4">
          {renderSectionSummary(stocksValue, stocksCost)}
          <AssetTable title="Stock Holdings" assets={stocks} emptyLabel="No stocks yet" renderAssetRow={renderAssetRow} />
        </TabsContent>

        <TabsContent value="mutual-funds" className="mt-4 space-y-4">
          {renderSectionSummary(mutualFundsValue, mutualFundsCost)}
          <AssetTable title="Mutual Fund Holdings" assets={mutualFunds} emptyLabel="No mutual funds yet" renderAssetRow={renderAssetRow} />
        </TabsContent>

        <TabsContent value="crypto" className="mt-4 space-y-4">
          {renderSectionSummary(cryptoValue, cryptoCost)}
          <AssetTable title="Crypto Holdings" assets={cryptos} emptyLabel="No crypto assets yet" renderAssetRow={renderAssetRow} />
        </TabsContent>

        <TabsContent value="physical" className="mt-4 space-y-4">
          {renderSectionSummary(physicalValue, physicalCost)}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {physicalAssets.map((asset) => {
              const value = asset.currentPrice * asset.quantity;
              const cost = asset.buyPrice * asset.quantity;
              const profitLoss = value - cost;
              const percentage = cost > 0 ? (profitLoss / cost) * 100 : 0;
              const isDepreciating = profitLoss < 0;
              const linkedDocCount = assetDocumentCounts[asset.id] || 0;
              return (
                <Card key={asset.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => openAssetDetails(asset)}>
                  <CardContent className="pt-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                        {typeIcons[asset.type] || <BarChart3 className="h-4 w-4" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{asset.name}</p>
                          <div className="flex items-center gap-1">
                            {linkedDocCount > 0 && <Badge variant="outline" className="text-[10px]">{linkedDocCount} docs</Badge>}
                            <Badge variant="secondary" className="text-[10px] capitalize">{asset.type.replace("_", " ")}</Badge>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                          <div>
                            <span className="text-xs text-muted-foreground">Purchase Price</span>
                            <p className="text-sm font-mono">{formatCurrency(cost, asset.currency)}</p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Current Value</span>
                            <p className="text-sm font-mono font-medium">{formatCurrency(value, asset.currency)}</p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">{isDepreciating ? "Depreciation" : "Appreciation"}</span>
                            <p className={`text-sm font-mono ${profitLoss >= 0 ? "text-profit" : "text-loss"}`}>
                              {formatCurrency(profitLoss, asset.currency)} ({formatPercent(percentage)})
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Purchased</span>
                            <p className="text-sm">{asset.purchaseDate}</p>
                          </div>
                        </div>
                        {asset.notes && <p className="mt-2 text-xs italic text-muted-foreground">{asset.notes}</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {physicalAssets.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="flex min-h-[180px] items-center justify-center text-sm text-muted-foreground">No physical assets yet</CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="loans" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-5">
                <span className="text-xs text-muted-foreground">Total Outstanding</span>
                <p className="mt-1 text-xl font-bold font-mono text-loss">{formatCurrency(totalLoanOutstanding, settings.defaultCurrency)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <span className="text-xs text-muted-foreground">Monthly EMI</span>
                <p className="mt-1 text-xl font-bold font-mono">{formatCurrency(totalEmi, settings.defaultCurrency)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <span className="text-xs text-muted-foreground">Active Loans</span>
                <p className="mt-1 text-xl font-bold font-mono">{loans.filter((loan) => loan.status === "active").length}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Loan Details</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {loans.map((loan) => {
                  const paid = loan.principalAmount - loan.outstandingAmount;
                  const paidPercentage = loan.principalAmount > 0 ? (paid / loan.principalAmount) * 100 : 0;
                  return (
                    <div key={loan.id} className="px-4 py-4 transition-colors hover:bg-secondary/30">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                          {loanIcons[loan.type] || <Landmark className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">{loan.name}</p>
                              <p className="text-xs text-muted-foreground">{loan.lender} / {loan.interestRate}% APR</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-mono font-bold text-loss">{formatCurrency(loan.outstandingAmount, loan.currency)}</p>
                              {loan.emi > 0 && <p className="text-xs text-muted-foreground">EMI: {formatCurrency(loan.emi, loan.currency)}/mo</p>}
                            </div>
                          </div>
                          <div className="mt-3">
                            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                              <span>{formatCurrency(paid, loan.currency)} paid</span>
                              <span>{paidPercentage.toFixed(0)}% complete</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-secondary">
                              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${paidPercentage}%` }} />
                            </div>
                            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
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

      <Dialog open={assetModalOpen} onOpenChange={setAssetModalOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAsset ? "Edit Asset" : "Add Asset"}</DialogTitle>
            <DialogDescription>Capture the details you want FinOS to track for this holding.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <Label className="text-xs">Asset Name *</Label>
                <Input value={assetForm.name} onChange={(event) => setAssetForm((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Apple Inc." />
              </div>
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={assetForm.type} onValueChange={(value) => setAssetForm((current) => ({ ...current, type: value as AssetType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(assetTypeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <Label className="text-xs">Ticker</Label>
                <Input value={assetForm.ticker} onChange={(event) => setAssetForm((current) => ({ ...current, ticker: event.target.value.toUpperCase() }))} placeholder="AAPL" />
              </div>
              <div>
                <Label className="text-xs">Exchange</Label>
                <Input value={assetForm.exchange} onChange={(event) => setAssetForm((current) => ({ ...current, exchange: event.target.value.toUpperCase() }))} placeholder="NASDAQ" />
              </div>
              <div>
                <Label className="text-xs">Purchase Date</Label>
                <Input type="date" value={assetForm.purchaseDate} onChange={(event) => setAssetForm((current) => ({ ...current, purchaseDate: event.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div>
                <Label className="text-xs">Quantity *</Label>
                <Input type="number" step="0.0001" value={assetForm.quantity} onChange={(event) => setAssetForm((current) => ({ ...current, quantity: event.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Avg Buy *</Label>
                <Input type="number" step="0.01" value={assetForm.buyPrice} onChange={(event) => setAssetForm((current) => ({ ...current, buyPrice: event.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Current Price *</Label>
                <Input type="number" step="0.01" value={assetForm.currentPrice} onChange={(event) => setAssetForm((current) => ({ ...current, currentPrice: event.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Currency</Label>
                <Select value={assetForm.currency} onValueChange={(value) => setAssetForm((current) => ({ ...current, currency: value as Currency }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CURRENCY_CONFIG) as Currency[]).map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {CURRENCY_CONFIG[currency].symbol} {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {assetForm.type === "mutual_fund" && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <Label className="text-xs">Fund House</Label>
                  <Input value={assetForm.fundHouse} onChange={(event) => setAssetForm((current) => ({ ...current, fundHouse: event.target.value }))} placeholder="Vanguard" />
                </div>
                <div>
                  <Label className="text-xs">Monthly SIP</Label>
                  <Input type="number" step="0.01" value={assetForm.sipAmount} onChange={(event) => setAssetForm((current) => ({ ...current, sipAmount: event.target.value }))} placeholder="Optional" />
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea value={assetForm.notes} onChange={(event) => setAssetForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Why you're tracking this asset, depreciation assumptions, linked docs, etc." />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssetModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveAsset}>{editingAsset ? "Update" : "Add"} Asset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assetDetailOpen} onOpenChange={setAssetDetailOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedAsset && typeIcons[selectedAsset.type]}
              {selectedAsset?.name}
            </DialogTitle>
            <DialogDescription>{selectedAsset ? assetTypeLabels[selectedAsset.type] : "Asset details"}</DialogDescription>
          </DialogHeader>

          {selectedAsset && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-3xl font-bold font-mono">{formatCurrency(selectedAsset.currentPrice * selectedAsset.quantity, selectedAsset.currency)}</p>
                <Badge variant="outline" className="mt-1">{selectedAsset.currency}</Badge>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground">Quantity</span>
                  <p className="font-mono">{selectedAsset.quantity}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Current Price</span>
                  <p className="font-mono">{formatCurrency(selectedAsset.currentPrice, selectedAsset.currency)}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Avg Buy</span>
                  <p className="font-mono">{formatCurrency(selectedAsset.buyPrice, selectedAsset.currency)}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Purchase Date</span>
                  <p>{selectedAsset.purchaseDate}</p>
                </div>
                {selectedAsset.ticker && (
                  <div>
                    <span className="text-xs text-muted-foreground">Ticker</span>
                    <p className="font-mono">{selectedAsset.ticker}</p>
                  </div>
                )}
                {selectedAsset.exchange && (
                  <div>
                    <span className="text-xs text-muted-foreground">Exchange</span>
                    <p>{selectedAsset.exchange}</p>
                  </div>
                )}
                {selectedAsset.fundHouse && (
                  <div>
                    <span className="text-xs text-muted-foreground">Fund House</span>
                    <p>{selectedAsset.fundHouse}</p>
                  </div>
                )}
                {selectedAsset.sipAmount && (
                  <div>
                    <span className="text-xs text-muted-foreground">Monthly SIP</span>
                    <p className="font-mono">{formatCurrency(selectedAsset.sipAmount, selectedAsset.currency)}</p>
                  </div>
                )}
              </div>

              {selectedAsset.notes && (
                <>
                  <Separator />
                  <div>
                    <span className="text-xs text-muted-foreground">Notes</span>
                    <p className="mt-1 text-sm">{selectedAsset.notes}</p>
                  </div>
                </>
              )}

              {selectedAssetDocuments.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <FileText className="h-3.5 w-3.5" />
                      Linked Documents
                    </div>
                    <div className="space-y-2">
                      {selectedAssetDocuments.map((document) => (
                        <LinkedAssetDocumentRow key={document.id} document={document} />
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-1"
                  onClick={() => {
                    setAssetDetailOpen(false);
                    openEditAsset(selectedAsset);
                  }}
                >
                  <Edit2 className="h-3 w-3" /> Edit
                </Button>
                <Button
                  variant="destructive"
                  className="gap-1"
                  onClick={() => {
                    setAssetDetailOpen(false);
                    openDeleteAsset(selectedAsset.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Asset?</DialogTitle>
            <DialogDescription>This removes the asset from your portfolio history in FinOS. This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteAsset}>Delete Asset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AssetTable({
  title,
  assets,
  emptyLabel,
  renderAssetRow,
}: {
  title: string;
  assets: Asset[];
  emptyLabel: string;
  renderAssetRow: (asset: Asset) => React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {assets.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Avg Buy</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">Invested</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">P&amp;L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{assets.map(renderAssetRow)}</TableBody>
          </Table>
        ) : (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">{emptyLabel}</div>
        )}
      </CardContent>
    </Card>
  );
}

function LinkedAssetDocumentRow({ document }: { document: VaultDocument }) {
  return (
    <div className="rounded-lg border bg-secondary/20 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{document.name}</p>
          <p className="text-xs text-muted-foreground">
            {document.fileType.toUpperCase()} · {document.category}
          </p>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {document.updatedAt.slice(0, 10)}
        </Badge>
      </div>
    </div>
  );
}
