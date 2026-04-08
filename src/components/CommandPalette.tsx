import { useEffect, useState, useCallback } from "react";
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
  LayoutDashboard,
  Wallet,
  BookOpen,
  TrendingUp,
  Shield,
  Calculator,
  Settings,
  Plus,
  Search,
  Lock,
  FileText,
  BarChart3,
  Bitcoin,
  Landmark,
} from "lucide-react";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const go = useCallback(
    (path: string) => {
      setOpen(false);
      navigate(path);
    },
    [navigate]
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => go("/")}><LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard</CommandItem>
          <CommandItem onSelect={() => go("/finance")}><Wallet className="mr-2 h-4 w-4" /> Finance Tracker</CommandItem>
          <CommandItem onSelect={() => go("/ledger")}><BookOpen className="mr-2 h-4 w-4" /> Accounting Ledger</CommandItem>
          <CommandItem onSelect={() => go("/assets")}><TrendingUp className="mr-2 h-4 w-4" /> Assets & Investments</CommandItem>
          <CommandItem onSelect={() => go("/vault")}><Shield className="mr-2 h-4 w-4" /> Secure Vault</CommandItem>
          <CommandItem onSelect={() => go("/tax")}><Calculator className="mr-2 h-4 w-4" /> Tax Assistant</CommandItem>
          <CommandItem onSelect={() => go("/settings")}><Settings className="mr-2 h-4 w-4" /> Settings</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => go("/finance")}><Plus className="mr-2 h-4 w-4" /> Add Transaction</CommandItem>
          <CommandItem onSelect={() => go("/assets")}><Plus className="mr-2 h-4 w-4" /> Add Asset</CommandItem>
          <CommandItem onSelect={() => go("/vault")}><FileText className="mr-2 h-4 w-4" /> Upload Document</CommandItem>
          <CommandItem onSelect={() => go("/tax")}><FileText className="mr-2 h-4 w-4" /> Export Tax Report</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Investments">
          <CommandItem onSelect={() => go("/assets?tab=stocks")}><BarChart3 className="mr-2 h-4 w-4" /> View Stocks</CommandItem>
          <CommandItem onSelect={() => go("/assets?tab=crypto")}><Bitcoin className="mr-2 h-4 w-4" /> View Crypto</CommandItem>
          <CommandItem onSelect={() => go("/assets?tab=loans")}><Landmark className="mr-2 h-4 w-4" /> View Loans</CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
