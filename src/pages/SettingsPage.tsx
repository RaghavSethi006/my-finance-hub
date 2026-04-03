import { Card, CardContent } from "@/components/ui/card";
import { useFinOS } from "@/lib/store";
import { CURRENCY_CONFIG, Currency } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings as SettingsIcon, User, Shield, Database, AlertTriangle } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  const { settings, updateSettings } = useFinOS();

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
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Data</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm">Export JSON</Button>
            <Button variant="outline" size="sm">Export CSV</Button>
            <Button variant="outline" size="sm">Import Backup</Button>
          </div>
          <p className="text-xs text-muted-foreground">All data stored locally in your browser</p>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/30">
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-loss" />
            <span className="font-medium text-loss">Danger Zone</span>
          </div>
          <Button variant="destructive" size="sm">Clear All Transactions</Button>
          <Button variant="destructive" size="sm" className="ml-2">Full Reset</Button>
        </CardContent>
      </Card>
    </div>
  );
}
