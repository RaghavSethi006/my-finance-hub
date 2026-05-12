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
import { MarketRangePreset, buildAssetValueSeries, buildPortfolioMarketSeries, calculateAssetDepreciation } from "@/lib/analytics";
import { parseAssetCsv } from "@/lib/asset-import";
import { formatCurrency, formatPercent } from "@/lib/currency";
import { syncMarketPrices } from "@/lib/market-data";
import { useFinOS } from "@/lib/store";
import { Asset, AssetType, AssetValueLog, Currency, CURRENCY_CONFIG, VaultDocument } from "@/lib/types";
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
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Trash2,
  Upload,
  Wallet,
} from "lucide-react";
import { Area, AreaChart, Bar, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";

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

const PHYSICAL_ASSET_TYPES: AssetType[] = ["real_estate", "vehicle", "gold", "other"];
const MARKET_RANGES: Array<{ value: MarketRangePreset; label: string }> = [
  { value: "live", label: "Live" },
  { value: "1h", label: "1H" },
  { value: "1d", label: "1D" },
  { value: "1w", label: "1W" },
  { value: "1m", label: "1M" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "All" },
  { value: "custom", label: "Custom" },
];

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
  annualDepreciationRate: "",
  usefulLifeYears: "",
  salvageValue: "",
  notes: "",
};

function generateId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function AssetsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { assets, loans, documents, settings, addAsset, addAssetValueLog, applyAssetPriceSync, importAssets, updateAsset, deleteAsset } = useFinOS();
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
  const [valueLogForm, setValueLogForm] = useState({
    date: new Date().toISOString().split("T")[0],
    price: "",
    note: "",
  });
  const [activeTab, setActiveTab] = useState<string>(() => searchParams.get("tab") || "overview");
  const [marketRange, setMarketRange] = useState<MarketRangePreset>("1m");
  const [marketCustomRange, setMarketCustomRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });
  const [isSyncingMarketPrices, setIsSyncingMarketPrices] = useState(false);
  const [lastMarketSyncAt, setLastMarketSyncAt] = useState<string | null>(null);
  const csvImportRef = useRef<HTMLInputElement>(null);
  const latestAssetsRef = useRef(assets);

  const totalPL = totalValue - totalCost;
  const plPercent = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;

  const stocks = assets.filter((asset) => asset.type === "stock");
  const mutualFunds = assets.filter((asset) => asset.type === "mutual_fund");
  const cryptos = assets.filter((asset) => asset.type === "crypto");
  const physicalAssets = assets.filter((asset) => PHYSICAL_ASSET_TYPES.includes(asset.type));

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

  const selectedAssetValueSeries = useMemo(
    () =>
      selectedAsset
        ? buildAssetValueSeries(selectedAsset, {
            preset: marketRange,
            customStart: marketCustomRange.start,
            customEnd: marketCustomRange.end,
          })
        : [],
    [marketCustomRange.end, marketCustomRange.start, marketRange, selectedAsset]
  );

  const selectedAssetDepreciation = useMemo(
    () => (selectedAsset ? calculateAssetDepreciation(selectedAsset) : null),
    [selectedAsset]
  );

  const selectedAssetLogTimeline = useMemo(
    () => [...selectedAssetValueSeries].sort((left, right) => right.timestamp.localeCompare(left.timestamp)),
    [selectedAssetValueSeries]
  );

  const marketSeries = useMemo(
    () =>
      buildPortfolioMarketSeries(assets, {
        preset: marketRange,
        customStart: marketCustomRange.start,
        customEnd: marketCustomRange.end,
      }),
    [assets, marketCustomRange.end, marketCustomRange.start, marketRange]
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
  const trackableAssetCount = assets.filter((asset) => ["stock", "mutual_fund", "crypto"].includes(asset.type) && asset.ticker).length;
  const marketStartValue = marketSeries[0]?.value ?? totalValue;
  const marketEndValue = marketSeries[marketSeries.length - 1]?.value ?? totalValue;
  const marketMove = marketEndValue - marketStartValue;
  const marketMovePercent = marketStartValue > 0 ? (marketMove / marketStartValue) * 100 : 0;
  const latestMarketPoint = marketSeries[marketSeries.length - 1];

  useEffect(() => {
    latestAssetsRef.current = assets;
  }, [assets]);

  const resetValueLogForm = (asset?: Asset) => {
    setValueLogForm({
      date: new Date().toISOString().split("T")[0],
      price: asset ? asset.currentPrice.toString() : "",
      note: "",
    });
  };

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
      annualDepreciationRate: asset.annualDepreciationRate?.toString() ?? "",
      usefulLifeYears: asset.usefulLifeYears?.toString() ?? "",
      salvageValue: asset.salvageValue?.toString() ?? "",
      notes: asset.notes ?? "",
    });
    setAssetModalOpen(true);
  };

  const openAssetDetails = (asset: Asset) => {
    setSelectedAsset(asset);
    resetValueLogForm(asset);
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
    if (!selectedAsset) {
      return;
    }

    const refreshedAsset = assets.find((asset) => asset.id === selectedAsset.id);
    if (!refreshedAsset) {
      setSelectedAsset(null);
      setAssetDetailOpen(false);
      return;
    }

    if (refreshedAsset !== selectedAsset) {
      setSelectedAsset(refreshedAsset);
    }
  }, [assets, selectedAsset]);

  useEffect(() => {
    const action = searchParams.get("action");
    if (!action) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("action");
    setSearchParams(nextParams, { replace: true });

    if (action === "add-asset") {
      setEditingAsset(null);
      setAssetForm({
        ...initialAssetForm,
        currency: settings.defaultCurrency,
        purchaseDate: new Date().toISOString().split("T")[0],
      });
      setAssetModalOpen(true);
      return;
    }

    if (action === "import-csv") {
      csvImportRef.current?.click();
    }
  }, [searchParams, setSearchParams, settings.defaultCurrency]);

  const handleRefreshMarketPrices = async (silent = false) => {
    if (isSyncingMarketPrices) {
      return;
    }

    setIsSyncingMarketPrices(true);
    try {
      const result = await syncMarketPrices(assets);
      if (result.updates.length > 0) {
        applyAssetPriceSync(result.updates);
        setLastMarketSyncAt(new Date().toISOString());
        if (!silent) {
          toast.success(`Synced ${result.updates.length} live market price${result.updates.length === 1 ? "" : "s"}`);
        }
      } else if (!silent) {
        toast.info(result.warnings[0] ?? "No live market prices could be synced for the current assets");
      }

      if (result.warnings.length > 0 && !silent) {
        toast.warning(result.warnings[0]);
      }
    } catch (error) {
      console.error(error);
      if (!silent) {
        toast.error(error instanceof Error ? error.message : "Failed to sync live market prices");
      }
    } finally {
      setIsSyncingMarketPrices(false);
    }
  };

  useEffect(() => {
    if (trackableAssetCount === 0) {
      return;
    }

    let lastFocusSync = 0;
    const silentRefresh = async () => {
      try {
        const result = await syncMarketPrices(latestAssetsRef.current);
        if (result.updates.length > 0) {
          applyAssetPriceSync(result.updates);
          setLastMarketSyncAt(new Date().toISOString());
        }
      } catch (error) {
        console.error(error);
      }
    };

    void silentRefresh();

    const refreshInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void silentRefresh();
      }
    }, 90 * 1000);

    const onFocus = () => {
      const now = Date.now();
      if (now - lastFocusSync < 5 * 60 * 1000) {
        return;
      }
      lastFocusSync = now;
      void silentRefresh();
    };

    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", onFocus);
    };
  }, [applyAssetPriceSync, trackableAssetCount]);

  const handleSaveAsset = () => {
    const quantity = parseFloat(assetForm.quantity);
    const buyPrice = parseFloat(assetForm.buyPrice);
    const currentPrice = parseFloat(assetForm.currentPrice);
    const sipAmount = assetForm.sipAmount ? parseFloat(assetForm.sipAmount) : undefined;
    const annualDepreciationRate = assetForm.annualDepreciationRate ? parseFloat(assetForm.annualDepreciationRate) : undefined;
    const usefulLifeYears = assetForm.usefulLifeYears ? parseFloat(assetForm.usefulLifeYears) : undefined;
    const salvageValue = assetForm.salvageValue ? parseFloat(assetForm.salvageValue) : undefined;
    const isPhysicalAsset = PHYSICAL_ASSET_TYPES.includes(assetForm.type);

    if (!assetForm.name.trim()) {
      toast.error("Asset name is required");
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(buyPrice) || buyPrice < 0 || !Number.isFinite(currentPrice) || currentPrice < 0) {
      toast.error("Enter valid quantity and pricing details");
      return;
    }

    if (
      isPhysicalAsset &&
      ((assetForm.annualDepreciationRate && (!Number.isFinite(annualDepreciationRate) || annualDepreciationRate < 0)) ||
        (assetForm.usefulLifeYears && (!Number.isFinite(usefulLifeYears) || usefulLifeYears <= 0)) ||
        (assetForm.salvageValue && (!Number.isFinite(salvageValue) || salvageValue < 0)))
    ) {
      toast.error("Enter valid depreciation settings for this physical asset");
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
      annualDepreciationRate: isPhysicalAsset && Number.isFinite(annualDepreciationRate) ? annualDepreciationRate : undefined,
      usefulLifeYears: isPhysicalAsset && Number.isFinite(usefulLifeYears) ? usefulLifeYears : undefined,
      salvageValue: isPhysicalAsset && Number.isFinite(salvageValue) ? salvageValue : undefined,
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

  const handleAddValueLog = () => {
    if (!selectedAsset) {
      return;
    }

    const price = parseFloat(valueLogForm.price);
    if (!valueLogForm.date) {
      toast.error("Choose the date for this valuation");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Enter a valid value for this log");
      return;
    }

    addAssetValueLog(selectedAsset.id, {
      date: valueLogForm.date,
      price,
      note: valueLogForm.note.trim() || undefined,
      source: "manual",
    });
    resetValueLogForm({
      ...selectedAsset,
      currentPrice: price,
    });
    toast.success("Asset value log added");
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

  const formatLogDate = (date: string, timestamp?: string) =>
    new Date(timestamp ?? `${date}T00:00:00`).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: timestamp ? "numeric" : undefined,
      minute: timestamp ? "2-digit" : undefined,
    });

  const renderMarketRangeControls = () => (
    <div className="flex flex-wrap items-center gap-1.5">
      {MARKET_RANGES.map((range) => (
        <Button
          key={range.value}
          type="button"
          variant={marketRange === range.value ? "default" : "outline"}
          size="sm"
          className="h-7 px-2.5 text-[11px] font-semibold"
          onClick={() => setMarketRange(range.value)}
        >
          {range.label}
        </Button>
      ))}
      {marketRange === "custom" && (
        <div className="flex items-center gap-2 pl-1">
          <Input
            type="date"
            value={marketCustomRange.start}
            className="h-7 w-[132px] text-xs"
            onChange={(event) => setMarketCustomRange((current) => ({ ...current, start: event.target.value }))}
          />
          <Input
            type="date"
            value={marketCustomRange.end}
            className="h-7 w-[132px] text-xs"
            onChange={(event) => setMarketCustomRange((current) => ({ ...current, end: event.target.value }))}
          />
        </div>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <input ref={csvImportRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportCsv} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Assets & Investments</h1>
          <p className="text-sm text-muted-foreground">Complete portfolio: investments, assets, and liabilities</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => void handleRefreshMarketPrices()}
            disabled={isSyncingMarketPrices || trackableAssetCount === 0}
          >
            <RefreshCw className={`h-4 w-4 ${isSyncingMarketPrices ? "animate-spin" : ""}`} />
            {isSyncingMarketPrices ? "Syncing..." : "Live Sync"}
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => csvImportRef.current?.click()}>
            <Upload className="h-4 w-4" /> Import CSV
          </Button>
          <Button className="gap-2" onClick={openAddAsset}>
            <Plus className="h-4 w-4" /> Add Asset
          </Button>
        </div>
      </div>

      {trackableAssetCount > 0 && (
        <p className="text-xs text-muted-foreground">
          Live sync covers {trackableAssetCount} asset{trackableAssetCount === 1 ? "" : "s"} with ticker symbols.
          {lastMarketSyncAt ? ` Last synced ${new Date(lastMarketSyncAt).toLocaleString()}.` : " Prices refresh on load, focus, and every 90 seconds while this page is visible."}
        </p>
      )}

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

            <Card className="overflow-hidden lg:col-span-2">
              <CardHeader className="border-b pb-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <LineIcon className="h-4 w-4 text-primary" />
                      Market Performance
                    </CardTitle>
                    <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-mono text-2xl font-bold">{formatCurrency(marketEndValue, settings.defaultCurrency)}</span>
                      <span className={`font-mono text-sm font-semibold ${marketMove >= 0 ? "text-profit" : "text-loss"}`}>
                        {marketMove >= 0 ? "+" : ""}
                        {formatCurrency(marketMove, settings.defaultCurrency)} ({formatPercent(marketMovePercent)})
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {latestMarketPoint ? `Latest plotted quote ${new Date(latestMarketPoint.timestamp).toLocaleString()}` : "Waiting for market data."}
                    </p>
                  </div>
                  {renderMarketRangeControls()}
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_180px]">
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={marketSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="marketValueFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={marketMove >= 0 ? "hsl(var(--profit))" : "hsl(var(--loss))"} stopOpacity={0.32} />
                            <stop offset="95%" stopColor={marketMove >= 0 ? "hsl(var(--profit))" : "hsl(var(--loss))"} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} minTickGap={18} />
                        <YAxis
                          yAxisId="value"
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          axisLine={false}
                          tickLine={false}
                          width={58}
                          tickFormatter={(value) => `${CURRENCY_CONFIG[settings.defaultCurrency].symbol}${(Number(value) / 1000).toFixed(0)}K`}
                        />
                        <YAxis yAxisId="activity" orientation="right" hide />
                        <Tooltip
                          contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                          labelFormatter={(_, payload) => (payload?.[0]?.payload?.timestamp ? new Date(payload[0].payload.timestamp).toLocaleString() : "")}
                          formatter={(value: number, name: string) =>
                            name === "Quote updates"
                              ? [`${value} update${value === 1 ? "" : "s"}`, name]
                              : [formatCurrency(value, settings.defaultCurrency), name]
                          }
                        />
                        <Bar yAxisId="activity" dataKey="updates" name="Quote updates" fill="hsl(var(--primary) / 0.18)" barSize={18} radius={[3, 3, 0, 0]} />
                        <Area yAxisId="value" type="monotone" dataKey="value" name="Market value" stroke={marketMove >= 0 ? "hsl(var(--profit))" : "hsl(var(--loss))"} strokeWidth={2.5} fill="url(#marketValueFill)" />
                        <Line yAxisId="value" type="monotone" dataKey="invested" name="Invested" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" dot={false} strokeWidth={1.5} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-3 gap-2 xl:grid-cols-1">
                    <div className="rounded-lg border bg-secondary/20 p-3">
                      <span className="text-[11px] text-muted-foreground">Range high</span>
                      <p className="mt-1 font-mono text-sm font-semibold">
                        {formatCurrency(Math.max(...marketSeries.map((point) => point.value), marketEndValue), settings.defaultCurrency)}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-secondary/20 p-3">
                      <span className="text-[11px] text-muted-foreground">Range low</span>
                      <p className="mt-1 font-mono text-sm font-semibold">
                        {formatCurrency(Math.min(...marketSeries.map((point) => point.value), marketEndValue), settings.defaultCurrency)}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-secondary/20 p-3">
                      <span className="text-[11px] text-muted-foreground">Quote events</span>
                      <p className="mt-1 font-mono text-sm font-semibold">
                        {marketSeries.reduce((sum, point) => sum + point.updates, 0)}
                      </p>
                    </div>
                  </div>
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
              const depreciation = calculateAssetDepreciation(asset);
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
                          {depreciation && (
                            <>
                              <div>
                                <span className="text-xs text-muted-foreground">Book Value</span>
                                <p className="text-sm font-mono">{formatCurrency(depreciation.bookValue * asset.quantity, asset.currency)}</p>
                              </div>
                              <div>
                                <span className="text-xs text-muted-foreground">Useful Life</span>
                                <p className="text-sm">
                                  {depreciation.usefulLifeYears > 0 ? `${depreciation.usefulLifeYears.toFixed(1)} yrs` : `${depreciation.annualRate.toFixed(1)}% / yr`}
                                </p>
                              </div>
                            </>
                          )}
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
            <DialogDescription>Capture the details you want Aurum to track for this holding.</DialogDescription>
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

            {PHYSICAL_ASSET_TYPES.includes(assetForm.type) && (
              <div className="space-y-3 rounded-xl border bg-secondary/20 p-4">
                <div>
                  <p className="text-sm font-medium">Depreciation Assumptions</p>
                  <p className="text-xs text-muted-foreground">Optional inputs for physical holdings so Aurum can estimate book value over time.</p>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <Label className="text-xs">Annual Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={assetForm.annualDepreciationRate}
                      onChange={(event) => setAssetForm((current) => ({ ...current, annualDepreciationRate: event.target.value }))}
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Useful Life (Years)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={assetForm.usefulLifeYears}
                      onChange={(event) => setAssetForm((current) => ({ ...current, usefulLifeYears: event.target.value }))}
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Salvage Value</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={assetForm.salvageValue}
                      onChange={(event) => setAssetForm((current) => ({ ...current, salvageValue: event.target.value }))}
                      placeholder="Optional"
                    />
                  </div>
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
        <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
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
                {selectedAssetDepreciation && (
                  <>
                    <div>
                      <span className="text-xs text-muted-foreground">Book Value</span>
                      <p className="font-mono">{formatCurrency(selectedAssetDepreciation.bookValue * selectedAsset.quantity, selectedAsset.currency)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Annual Depreciation</span>
                      <p className="font-mono">{formatCurrency(selectedAssetDepreciation.annualDepreciation * selectedAsset.quantity, selectedAsset.currency)}</p>
                    </div>
                  </>
                )}
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Value Timeline</p>
                    <p className="text-xs text-muted-foreground">Timestamped quote logs power the same market range selected above.</p>
                  </div>
                  {renderMarketRangeControls()}
                  <Badge variant="secondary" className="text-[10px]">
                    {selectedAssetLogTimeline.length} point{selectedAssetLogTimeline.length === 1 ? "" : "s"}
                  </Badge>
                </div>
                <div className="h-56 rounded-xl border bg-secondary/10 p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={selectedAssetValueSeries}>
                      <defs>
                        <linearGradient id="asset-history-fill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.32} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.16} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        fontSize={11}
                        tickFormatter={(value: number) => formatCurrency(value, selectedAsset.currency)}
                      />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value, selectedAsset.currency)}
                        labelFormatter={(_, payload) => (payload?.[0]?.payload?.date ? formatLogDate(payload[0].payload.date, payload[0].payload.timestamp) : "")}
                      />
                      <Area type="monotone" dataKey="totalValue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#asset-history-fill)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.1fr_0.9fr]">
                <Card className="border-dashed">
                  <CardContent className="space-y-3 pt-5">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Plus className="h-4 w-4 text-primary" />
                      Add Manual Value Log
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div>
                        <Label className="text-xs">Date</Label>
                        <Input
                          type="date"
                          value={valueLogForm.date}
                          onChange={(event) => setValueLogForm((current) => ({ ...current, date: event.target.value }))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Value Per Unit</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={valueLogForm.price}
                          onChange={(event) => setValueLogForm((current) => ({ ...current, price: event.target.value }))}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button className="w-full gap-2" onClick={handleAddValueLog}>
                          <Plus className="h-4 w-4" /> Save Log
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Note</Label>
                      <Input
                        value={valueLogForm.note}
                        onChange={(event) => setValueLogForm((current) => ({ ...current, note: event.target.value }))}
                        placeholder="Broker statement, appraisal, manual revaluation..."
                      />
                    </div>
                  </CardContent>
                </Card>

                {selectedAssetDepreciation && (
                  <Card className="border-dashed">
                    <CardContent className="space-y-3 pt-5">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        Depreciation View
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-xs text-muted-foreground">Book Value</span>
                          <p className="font-mono">{formatCurrency(selectedAssetDepreciation.bookValue * selectedAsset.quantity, selectedAsset.currency)}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Market Delta</span>
                          <p className={`font-mono ${selectedAssetDepreciation.marketDelta >= 0 ? "text-profit" : "text-loss"}`}>
                            {formatCurrency(selectedAssetDepreciation.marketDelta * selectedAsset.quantity, selectedAsset.currency)}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Monthly Depreciation</span>
                          <p className="font-mono">{formatCurrency(selectedAssetDepreciation.monthlyDepreciation * selectedAsset.quantity, selectedAsset.currency)}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Salvage Value</span>
                          <p className="font-mono">{formatCurrency(selectedAssetDepreciation.salvageValue * selectedAsset.quantity, selectedAsset.currency)}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Useful Life</span>
                          <p>{selectedAssetDepreciation.usefulLifeYears > 0 ? `${selectedAssetDepreciation.usefulLifeYears.toFixed(1)} years` : `${selectedAssetDepreciation.annualRate.toFixed(1)}% annually`}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Accumulated</span>
                          <p className="font-mono">{formatCurrency(selectedAssetDepreciation.accumulatedDepreciation * selectedAsset.quantity, selectedAsset.currency)}</p>
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span>Depreciation progress</span>
                          <span>{selectedAssetDepreciation.progressPercent.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-secondary">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${selectedAssetDepreciation.progressPercent}%` }} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
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
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <FileText className="h-3.5 w-3.5" />
                        Linked Documents
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          setAssetDetailOpen(false);
                          navigate(`/vault?action=upload&linkedType=asset&linkedId=${selectedAsset.id}`);
                        }}
                      >
                        <Upload className="h-3.5 w-3.5" /> Attach Document
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {selectedAssetDocuments.map((document) => (
                        <LinkedAssetDocumentRow key={document.id} document={document} />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {selectedAssetDocuments.length === 0 && (
                <>
                  <Separator />
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-start gap-3 pt-5 text-sm">
                      <div>
                        <p className="font-medium">No documents linked yet</p>
                        <p className="text-muted-foreground">Attach deeds, invoices, appraisals, or statements directly from this asset.</p>
                      </div>
                      <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() => {
                          setAssetDetailOpen(false);
                          navigate(`/vault?action=upload&linkedType=asset&linkedId=${selectedAsset.id}`);
                        }}
                      >
                        <Upload className="h-4 w-4" /> Upload Linked Document
                      </Button>
                    </CardContent>
                  </Card>
                </>
              )}

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <LineIcon className="h-3.5 w-3.5" />
                    Value Log Timeline
                  </div>
                  <Badge variant="outline" className="text-[10px]">Latest price drives current value</Badge>
                </div>
                <div className="space-y-2">
                  {selectedAssetLogTimeline.map((entry) => (
                    <AssetValueLogRow
                      key={`${entry.date}-${entry.source}-${entry.price}-${entry.note ?? ""}`}
                      entry={entry}
                      currency={selectedAsset.currency}
                      quantity={selectedAsset.quantity}
                      formatLogDate={formatLogDate}
                    />
                  ))}
                </div>
              </div>

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
            <DialogDescription>This removes the asset from your portfolio history in Aurum. This action cannot be undone.</DialogDescription>
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

function AssetValueLogRow({
  entry,
  currency,
  quantity,
  formatLogDate,
}: {
  entry: Pick<AssetValueLog, "date" | "timestamp" | "price" | "note" | "source">;
  currency: Currency;
  quantity: number;
  formatLogDate: (date: string, timestamp?: string) => string;
}) {
  const sourceLabel = entry.source === "manual" ? "Manual" : entry.source === "import" ? "Import" : "System";
  const totalValue = entry.price * quantity;

  return (
    <div className="rounded-lg border bg-secondary/10 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{formatLogDate(entry.date, "timestamp" in entry ? entry.timestamp : undefined)}</p>
            <Badge variant="outline" className="text-[10px]">{sourceLabel}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Per-unit value {formatCurrency(entry.price, currency)} / Total {formatCurrency(totalValue, currency)}
          </p>
          {entry.note && <p className="mt-1 text-xs italic text-muted-foreground">{entry.note}</p>}
        </div>
        <p className="text-sm font-mono font-medium">{formatCurrency(totalValue, currency)}</p>
      </div>
    </div>
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
