import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  BellRing,
  Bitcoin,
  BookOpen,
  Calculator,
  FileKey,
  FileLock2,
  FileText,
  Landmark,
  LayoutDashboard,
  Lock,
  Plus,
  Search,
  Settings,
  Shield,
  TrendingUp,
  KeyRound,
  Wallet,
} from "lucide-react";
import { useFinOS } from "@/lib/store";
import { COMMAND_PALETTE_OPEN_EVENT } from "@/lib/command-palette";

function moduleRoute(module: "finance" | "ledger" | "assets" | "vault" | "tax") {
  if (module === "ledger") return "/ledger";
  if (module === "assets") return "/assets";
  if (module === "vault") return "/vault";
  if (module === "tax") return "/tax";
  return "/finance";
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const alerts = useFinOS((state) => state.alerts);
  const recentDocuments = useFinOS((state) => state.documents.slice(0, 3));
  const isDesktop = useFinOS((state) => state.isDesktop);
  const securityStatus = useFinOS((state) => state.securityStatus);
  const lockApp = useFinOS((state) => state.lockApp);
  const lockVault = useFinOS((state) => state.lockVault);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };

    const openPalette = () => setOpen(true);

    document.addEventListener("keydown", down);
    window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, openPalette);
    return () => {
      document.removeEventListener("keydown", down);
      window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, openPalette);
    };
  }, []);

  const go = useCallback(
    (path: string) => {
      setOpen(false);
      navigate(path);
    },
    [navigate]
  );

  const runAction = useCallback(async (action: () => Promise<void> | void) => {
    setOpen(false);
    await action();
  }, []);

  const actionableAlerts = useMemo(
    () => alerts.filter((alert) => !alert.read).slice(0, 4),
    [alerts]
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => go("/")}>
            <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
          </CommandItem>
          <CommandItem onSelect={() => go("/finance")}>
            <Wallet className="mr-2 h-4 w-4" /> Finance Tracker
          </CommandItem>
          <CommandItem onSelect={() => go("/ledger")}>
            <BookOpen className="mr-2 h-4 w-4" /> Accounting Ledger
          </CommandItem>
          <CommandItem onSelect={() => go("/assets")}>
            <TrendingUp className="mr-2 h-4 w-4" /> Assets & Investments
          </CommandItem>
          <CommandItem onSelect={() => go("/vault")}>
            <Shield className="mr-2 h-4 w-4" /> Secure Vault
          </CommandItem>
          <CommandItem onSelect={() => go("/tax")}>
            <Calculator className="mr-2 h-4 w-4" /> Tax Assistant
          </CommandItem>
          <CommandItem onSelect={() => go("/settings")}>
            <Settings className="mr-2 h-4 w-4" /> Settings
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => go("/finance?action=add-transaction")}>
            <Plus className="mr-2 h-4 w-4" /> Add Transaction
          </CommandItem>
          <CommandItem onSelect={() => go("/finance?action=add-account")}>
            <Plus className="mr-2 h-4 w-4" /> Add Account
          </CommandItem>
          <CommandItem onSelect={() => go("/assets?action=add-asset")}>
            <Plus className="mr-2 h-4 w-4" /> Add Asset
          </CommandItem>
          <CommandItem onSelect={() => go("/vault?action=upload")}>
            <FileText className="mr-2 h-4 w-4" /> Upload Document
          </CommandItem>
          <CommandItem onSelect={() => go("/settings?action=app-pin")}>
            <KeyRound className="mr-2 h-4 w-4" /> Change App PIN
          </CommandItem>
          <CommandItem onSelect={() => go("/settings?action=vault-password")}>
            <FileKey className="mr-2 h-4 w-4" /> Change Vault Password
          </CommandItem>
          {isDesktop && securityStatus.hasAppPin && !securityStatus.isAppLocked && (
            <CommandItem onSelect={() => void runAction(lockApp)}>
              <Lock className="mr-2 h-4 w-4" /> Lock App Now
            </CommandItem>
          )}
          {isDesktop && securityStatus.hasVaultPassword && !securityStatus.isVaultLocked && (
            <CommandItem onSelect={() => void runAction(lockVault)}>
              <FileLock2 className="mr-2 h-4 w-4" /> Lock Vault Now
            </CommandItem>
          )}
        </CommandGroup>

        {actionableAlerts.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Unread Alerts">
              {actionableAlerts.map((alert) => (
                <CommandItem
                  key={alert.id}
                  onSelect={() => go(alert.actionRoute || moduleRoute(alert.module))}
                >
                  <BellRing className="mr-2 h-4 w-4" />
                  {alert.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {recentDocuments.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Recent Vault Documents">
              {recentDocuments.map((document) => (
                <CommandItem key={document.id} onSelect={() => go("/vault")}>
                  <FileText className="mr-2 h-4 w-4" />
                  {document.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />

        <CommandGroup heading="Investments">
          <CommandItem onSelect={() => go("/assets?tab=stocks")}>
            <Search className="mr-2 h-4 w-4" /> View Stocks
          </CommandItem>
          <CommandItem onSelect={() => go("/assets?tab=crypto")}>
            <Bitcoin className="mr-2 h-4 w-4" /> View Crypto
          </CommandItem>
          <CommandItem onSelect={() => go("/assets?tab=loans")}>
            <Landmark className="mr-2 h-4 w-4" /> View Loans
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
