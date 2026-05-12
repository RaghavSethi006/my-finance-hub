import { useMemo } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Bell, Search } from "lucide-react";
import { buildSmartInsights, resolveDashboardRange } from "@/lib/analytics";
import { useFinOS } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getCommandPaletteShortcutLabel, requestCommandPaletteOpen } from "@/lib/command-palette";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const accounts = useFinOS((s) => s.accounts);
  const assets = useFinOS((s) => s.assets);
  const budgets = useFinOS((s) => s.budgets);
  const categories = useFinOS((s) => s.categories);
  const documents = useFinOS((s) => s.documents);
  const loans = useFinOS((s) => s.loans);
  const recurringTemplates = useFinOS((s) => s.recurringTemplates);
  const settings = useFinOS((s) => s.settings);
  const transactions = useFinOS((s) => s.transactions);
  const unreadCount = useMemo(
    () =>
      buildSmartInsights({
        accounts,
        assets,
        budgets,
        categories,
        defaultCurrency: settings.defaultCurrency,
        documents,
        loans,
        range: resolveDashboardRange({ preset: "this_month" }, transactions),
        recurringTemplates,
        transactions,
      }).length,
    [accounts, assets, budgets, categories, documents, loans, recurringTemplates, settings.defaultCurrency, transactions]
  );
  const shortcutLabel = getCommandPaletteShortcutLabel();

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-card/50 px-4 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="text-muted-foreground" />
            </div>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="hidden h-8 gap-2 px-3 text-muted-foreground sm:flex"
                    onClick={requestCommandPaletteOpen}
                  >
                    <Search className="h-3.5 w-3.5" />
                    <span className="text-xs">Search...</span>
                    <kbd className="pointer-events-none ml-2 inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                      {shortcutLabel}
                    </kbd>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Command Palette</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="relative rounded-lg p-2 transition-colors hover:bg-secondary">
                    <Bell className="h-4 w-4 text-muted-foreground" />
                    {unreadCount > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground animate-pulse-glow">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{unreadCount} active alerts</TooltipContent>
              </Tooltip>
              <div className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-primary/10 transition-colors hover:bg-primary/20">
                <span className="text-xs font-semibold text-primary">{settings.name.charAt(0).toUpperCase()}</span>
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
