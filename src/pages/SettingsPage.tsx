import { Card, CardContent } from "@/components/ui/card";
import { useFinOS } from "@/lib/store";
import { CURRENCY_CONFIG, Currency } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Shield, Database, AlertTriangle, Download, Upload, FileArchive, Lock, KeyRound } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { exportEncryptedBackup, getDesktopPaths, isTauriDesktop } from "@/lib/desktop";
import type { DesktopPaths } from "@/lib/types";
import { useSearchParams } from "react-router-dom";

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    settings,
    securityStatus,
    lockApp,
    setAppPin,
    setVaultPassword,
    setAutoLockTimeout,
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
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [vaultDialogOpen, setVaultDialogOpen] = useState(false);
  const [backupDialogOpen, setBackupDialogOpen] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [currentVaultPassword, setCurrentVaultPassword] = useState('');
  const [newVaultPassword, setNewVaultPassword] = useState('');
  const [confirmVaultPassword, setConfirmVaultPassword] = useState('');
  const [isSavingSecurity, setIsSavingSecurity] = useState(false);
  const [backupPassword, setBackupPassword] = useState('');
  const [confirmBackupPassword, setConfirmBackupPassword] = useState('');
  const [isExportingBackup, setIsExportingBackup] = useState(false);
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

  useEffect(() => {
    const action = searchParams.get('action');
    if (!action) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('action');
    setSearchParams(nextParams, { replace: true });

    if (action === 'app-pin') {
      setPinDialogOpen(true);
      return;
    }

    if (action === 'vault-password') {
      setVaultDialogOpen(true);
      return;
    }

    if (action === 'encrypted-backup') {
      setBackupDialogOpen(true);
    }
  }, [searchParams, setSearchParams]);

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

  const handleSaveAppPin = async () => {
    if (!newPin.trim()) {
      toast.error('Enter a new app PIN');
      return;
    }
    if (newPin !== confirmPin) {
      toast.error('App PIN entries do not match');
      return;
    }

    setIsSavingSecurity(true);
    try {
      await setAppPin(securityStatus.hasAppPin ? currentPin : undefined, newPin);
      toast.success(securityStatus.hasAppPin ? 'App PIN updated' : 'App PIN set');
      setPinDialogOpen(false);
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Failed to save app PIN');
    } finally {
      setIsSavingSecurity(false);
    }
  };

  const handleSaveVaultPassword = async () => {
    if (!newVaultPassword.trim()) {
      toast.error('Enter a new vault password');
      return;
    }
    if (newVaultPassword !== confirmVaultPassword) {
      toast.error('Vault password entries do not match');
      return;
    }

    setIsSavingSecurity(true);
    try {
      await setVaultPassword(securityStatus.hasVaultPassword ? currentVaultPassword : undefined, newVaultPassword);
      toast.success(securityStatus.hasVaultPassword ? 'Vault password updated and files re-encrypted' : 'Vault password set');
      setVaultDialogOpen(false);
      setCurrentVaultPassword('');
      setNewVaultPassword('');
      setConfirmVaultPassword('');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Failed to save vault password');
    } finally {
      setIsSavingSecurity(false);
    }
  };

  const handleAutoLockChange = async (value: string) => {
    try {
      await setAutoLockTimeout(Number(value));
      toast.success('Auto-lock timeout updated');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Failed to update auto-lock timeout');
    }
  };

  const handleExportEncryptedBackup = async () => {
    if (!backupPassword.trim()) {
      toast.error('Enter a password for the encrypted backup');
      return;
    }
    if (backupPassword.trim().length < 8) {
      toast.error('Backup password must be at least 8 characters long');
      return;
    }
    if (backupPassword !== confirmBackupPassword) {
      toast.error('Backup password entries do not match');
      return;
    }

    setIsExportingBackup(true);
    try {
      const encryptedBytes = await exportEncryptedBackup(backupPassword);
      const blob = new Blob([Uint8Array.from(encryptedBytes)], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `finos-encrypted-backup-${new Date().toISOString().split('T')[0]}.zip.enc`;
      anchor.click();
      URL.revokeObjectURL(url);

      toast.success('Encrypted backup exported');
      setBackupDialogOpen(false);
      setBackupPassword('');
      setConfirmBackupPassword('');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Failed to export encrypted backup');
    } finally {
      setIsExportingBackup(false);
    }
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
          {isTauriDesktop() ? (
            <>
              <div className="grid gap-3 rounded-lg bg-secondary/40 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">App lock</span>
                  <span className="font-medium text-foreground">
                    {securityStatus.hasAppPin ? (securityStatus.isAppLocked ? 'Locked' : 'Enabled') : 'Not set'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Vault encryption</span>
                  <span className="font-medium text-foreground">
                    {securityStatus.hasVaultPassword
                      ? securityStatus.isVaultLocked
                        ? 'Locked'
                        : 'Unlocked'
                      : 'Not set'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Auto-lock</span>
                  <Select
                    value={String(securityStatus.autoLockTimeoutSeconds)}
                    onValueChange={(value) => void handleAutoLockChange(value)}
                  >
                    <SelectTrigger className="h-8 w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Disabled</SelectItem>
                      <SelectItem value="60">1 minute</SelectItem>
                      <SelectItem value="300">5 minutes</SelectItem>
                      <SelectItem value="600">10 minutes</SelectItem>
                      <SelectItem value="900">15 minutes</SelectItem>
                      <SelectItem value="1800">30 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setPinDialogOpen(true)}>
                <Lock className="h-4 w-4" />
                {securityStatus.hasAppPin ? 'Change App PIN' : 'Set App PIN'}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => setVaultDialogOpen(true)}
              >
                <KeyRound className="h-4 w-4" />
                {securityStatus.hasVaultPassword ? 'Change Vault Password' : 'Set Vault Password'}
              </Button>
              {securityStatus.hasAppPin && !securityStatus.isAppLocked && (
                <Button variant="outline" className="w-full justify-start" onClick={() => void lockApp()}>
                  Lock App Now
                </Button>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Advanced security is available in the Tauri desktop app, including app PIN, vault encryption, and auto-lock.
            </p>
          )}
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
              {isTauriDesktop() && (
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setBackupDialogOpen(true)}>
                  <Lock className="h-3.5 w-3.5" /> Export Encrypted Backup
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              JSON includes all data. CSV exports separate files for accounts, transactions, assets and loans.
              {isTauriDesktop() ? ' Encrypted backup bundles snapshot data and vault documents into one password-protected archive.' : ''}
            </p>
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
      <Dialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{securityStatus.hasAppPin ? 'Change App PIN' : 'Set App PIN'}</DialogTitle>
            <DialogDescription>
              Use a 4 to 8 digit PIN to lock the app when it auto-locks or when you lock it manually.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {securityStatus.hasAppPin && (
              <Input
                type="password"
                inputMode="numeric"
                placeholder="Current PIN"
                value={currentPin}
                onChange={(event) => setCurrentPin(event.target.value)}
              />
            )}
            <Input
              type="password"
              inputMode="numeric"
              placeholder="New PIN"
              value={newPin}
              onChange={(event) => setNewPin(event.target.value)}
            />
            <Input
              type="password"
              inputMode="numeric"
              placeholder="Confirm new PIN"
              value={confirmPin}
              onChange={(event) => setConfirmPin(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPinDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleSaveAppPin()} disabled={isSavingSecurity}>
              {isSavingSecurity ? 'Saving...' : securityStatus.hasAppPin ? 'Update PIN' : 'Set PIN'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={vaultDialogOpen} onOpenChange={setVaultDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{securityStatus.hasVaultPassword ? 'Change Vault Password' : 'Set Vault Password'}</DialogTitle>
            <DialogDescription>
              The vault password controls AES-256 encryption for documents stored on disk.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {securityStatus.hasVaultPassword && (
              <Input
                type="password"
                placeholder="Current vault password"
                value={currentVaultPassword}
                onChange={(event) => setCurrentVaultPassword(event.target.value)}
              />
            )}
            <Input
              type="password"
              placeholder="New vault password"
              value={newVaultPassword}
              onChange={(event) => setNewVaultPassword(event.target.value)}
            />
            <Input
              type="password"
              placeholder="Confirm new vault password"
              value={confirmVaultPassword}
              onChange={(event) => setConfirmVaultPassword(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVaultDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleSaveVaultPassword()} disabled={isSavingSecurity}>
              {isSavingSecurity ? 'Saving...' : securityStatus.hasVaultPassword ? 'Update Password' : 'Set Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={backupDialogOpen} onOpenChange={setBackupDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Export Encrypted Backup</DialogTitle>
            <DialogDescription>
              Create a password-protected archive that includes your app snapshot and vault documents for secure offline backup.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="password"
              placeholder="Backup password"
              value={backupPassword}
              onChange={(event) => setBackupPassword(event.target.value)}
            />
            <Input
              type="password"
              placeholder="Confirm backup password"
              value={confirmBackupPassword}
              onChange={(event) => setConfirmBackupPassword(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Keep this password safe. It will be required to decrypt the exported archive later.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBackupDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleExportEncryptedBackup()} disabled={isExportingBackup}>
              {isExportingBackup ? 'Exporting...' : 'Export Backup'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
