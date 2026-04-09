import { Card, CardContent } from "@/components/ui/card";
import { useFinOS } from "@/lib/store";
import { CURRENCY_CONFIG, Currency } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings as SettingsIcon, User, Shield, Database, AlertTriangle, Download, Upload, FileArchive, Check } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getDesktopPaths, isTauriDesktop } from "@/lib/desktop";
import type { DesktopPaths } from "@/lib/types";

export default function SettingsPage() {
  const {
    settings,
    updateSettings,
    exportAllData,
    importAllData,
    clearAllData,
    clearTransactions,
    transactions,
    accounts,
    assets,
    loans,
    documents,
  } = useFinOS();
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetText, setResetText] = useState('');
  const [clearTxConfirm, setClearTxConfirm] = useState(false);
  const [desktopPaths, setDesktopPaths] = useState<DesktopPaths | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isTauriDesktop()) {
      return;
    }

    void getDesktopPaths()
      .then(setDesktopPaths)
      .catch((error) => {
        console.error('Unable to load desktop paths', error);
      });
  }, []);

  const handleExportJSON = () => {
    const json = exportAllData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finos-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Data exported as JSON');
  };

  const handleExportCSV = () => {
    const csvFiles: { name: string; data: string }[] = [];

    // Transactions CSV
    const txHeaders = 'ID,Date,Type,Amount,Currency,Category,Account,Note,Payment Method,Tax Tag,Deductible,Recurring\n';
    const txRows = transactions.map(t => `${t.id},${t.date},${t.type},${t.amount},${t.currency},${t.categoryId},${t.accountId},"${t.note}",${t.paymentMethod},${t.taxTag},${t.isDeductible},${t.isRecurring}`).join('\n');
    csvFiles.push({ name: 'transactions.csv', data: txHeaders + txRows });

    // Accounts CSV
    const accHeaders = 'ID,Name,Type,Balance,Currency,Bank,Account Number,Branch,IFSC,Nominees,Notes,Since\n';
    const accRows = accounts.map(a => `${a.id},"${a.name}",${a.type},${a.balance},${a.currency},"${a.bankName || ''}","${a.accountNumber || ''}","${a.branchName || ''}","${a.ifscCode || ''}","${(a.nominees || []).join('; ')}","${a.notes || ''}",${a.createdAt}`).join('\n');
    csvFiles.push({ name: 'accounts.csv', data: accHeaders + accRows });

    // Assets CSV
    const assetHeaders = 'ID,Name,Type,Ticker,Exchange,Qty,Buy Price,Current Price,Currency,Purchase Date,Notes\n';
    const assetRows = assets.map(a => `${a.id},"${a.name}",${a.type},${a.ticker || ''},${a.exchange || ''},${a.quantity},${a.buyPrice},${a.currentPrice},${a.currency},${a.purchaseDate},"${a.notes || ''}"`).join('\n');
    csvFiles.push({ name: 'assets.csv', data: assetHeaders + assetRows });

    // Loans CSV
    const loanHeaders = 'ID,Name,Lender,Type,Principal,Outstanding,Rate,EMI,Tenure,Start,End,Currency,Status\n';
    const loanRows = loans.map(l => `${l.id},"${l.name}","${l.lender}",${l.type},${l.principalAmount},${l.outstandingAmount},${l.interestRate},${l.emi},${l.tenure},${l.startDate},${l.endDate},${l.currency},${l.status}`).join('\n');
    csvFiles.push({ name: 'loans.csv', data: loanHeaders + loanRows });

    csvFiles.forEach(file => {
      const blob = new Blob([file.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finos-${file.name}`;
      a.click();
      URL.revokeObjectURL(url);
    });

    toast.success(`Exported ${csvFiles.length} CSV files`);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const json = ev.target?.result as string;
      const success = importAllData(json);
      if (success) {
        toast.success('Data imported successfully');
      } else {
        toast.error('Invalid backup file');
      }
    };
    reader.readAsText(file);
    if (importRef.current) importRef.current.value = '';
  };

  const handleFullReset = () => {
    if (resetText !== 'DELETE') return;
    clearAllData();
    toast.success('All data cleared');
    setResetConfirm(false);
    setResetText('');
  };

  const handleClearTransactions = () => {
    clearTransactions();
    toast.success('All transactions cleared');
    setClearTxConfirm(false);
  };

  const storageInfo = (new Blob([exportAllData()]).size / 1024).toFixed(1);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your preferences</p>
      </div>

      {/* General */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">General</span>
          </div>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="name">Display Name</Label>
              <Input id="name" value={settings.name} onChange={e => updateSettings({ name: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Default Currency</Label>
              <Select value={settings.defaultCurrency} onValueChange={v => updateSettings({ defaultCurrency: v as Currency })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(CURRENCY_CONFIG) as Currency[]).map(c => (
                    <SelectItem key={c} value={c}>{CURRENCY_CONFIG[c].symbol} {c} — {CURRENCY_CONFIG[c].name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Theme</Label>
              <Select value={settings.theme} onValueChange={v => updateSettings({ theme: v as 'light' | 'dark' | 'system' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Security</span>
          </div>
          <Button variant="outline" className="w-full justify-start">Change App PIN</Button>
          <Button variant="outline" className="w-full justify-start">Change Vault Password</Button>
        </CardContent>
      </Card>

      {/* Data */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Data & Backup</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            <div className="p-3 rounded-lg bg-secondary/50">
              <p className="text-lg font-bold">{transactions.length}</p>
              <p className="text-xs text-muted-foreground">Transactions</p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50">
              <p className="text-lg font-bold">{accounts.length}</p>
              <p className="text-xs text-muted-foreground">Accounts</p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50">
              <p className="text-lg font-bold">{assets.length}</p>
              <p className="text-xs text-muted-foreground">Assets</p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50">
              <p className="text-lg font-bold">{storageInfo} KB</p>
              <p className="text-xs text-muted-foreground">Storage Used</p>
            </div>
          </div>

          <Separator />

          <div>
            <p className="text-sm font-medium mb-2">Export</p>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" className="gap-2" onClick={handleExportJSON}>
                <Download className="h-3.5 w-3.5" /> Export JSON Backup
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleExportCSV}>
                <FileArchive className="h-3.5 w-3.5" /> Export CSV Files
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">JSON includes all data. CSV exports separate files for accounts, transactions, assets & loans.</p>
          </div>

          <Separator />

          <div>
            <p className="text-sm font-medium mb-2">Import</p>
            <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
            <Button variant="outline" size="sm" className="gap-2" onClick={() => importRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> Import JSON Backup
            </Button>
            <p className="text-xs text-muted-foreground mt-1">Import a previously exported JSON backup to restore all data.</p>
          </div>

          {desktopPaths && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium">Desktop Storage Paths</p>
                <div className="rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground space-y-2">
                  <div>
                    <span className="font-medium text-foreground">Data folder</span>
                    <p className="break-all">{desktopPaths.dataDir}</p>
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Database</span>
                    <p className="break-all">{desktopPaths.dbPath}</p>
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Vault</span>
                    <p className="break-all">{desktopPaths.vaultDir}</p>
                  </div>
                </div>
              </div>
            </>
          )}

          <p className="text-xs text-muted-foreground">
            {isTauriDesktop() ? 'All desktop data is stored locally in the app folder data directory.' : 'All data is stored locally in your browser.'}
          </p>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/30">
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-loss" />
            <span className="font-medium text-loss">Danger Zone</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="destructive" size="sm" onClick={() => setClearTxConfirm(true)}>Clear All Transactions</Button>
            <Button variant="destructive" size="sm" onClick={() => setResetConfirm(true)}>Full Reset</Button>
          </div>
        </CardContent>
      </Card>

      {/* Clear Transactions Confirm */}
      <Dialog open={clearTxConfirm} onOpenChange={setClearTxConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Clear All Transactions?</DialogTitle>
            <DialogDescription>This will permanently delete all {transactions.length} transactions. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearTxConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleClearTransactions}>Clear Transactions</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full Reset Confirm */}
      <Dialog open={resetConfirm} onOpenChange={setResetConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Full Reset</DialogTitle>
            <DialogDescription>This will delete ALL data — accounts, transactions, assets, loans, documents, and alerts. Type DELETE to confirm.</DialogDescription>
          </DialogHeader>
          <Input placeholder="Type DELETE to confirm" value={resetText} onChange={e => setResetText(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetConfirm(false); setResetText(''); }}>Cancel</Button>
            <Button variant="destructive" disabled={resetText !== 'DELETE'} onClick={handleFullReset}>Reset Everything</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
