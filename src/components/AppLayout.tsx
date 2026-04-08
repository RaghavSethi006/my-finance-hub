import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Bell, Search } from "lucide-react";
import { useFinOS } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const alerts = useFinOS((s) => s.alerts);
  const settings = useFinOS((s) => s.settings);
  const unreadCount = alerts.filter((a) => !a.read).length;

  const openCommandPalette = () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b px-4 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="text-muted-foreground" />
            </div>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="hidden sm:flex gap-2 text-muted-foreground h-8 px-3" onClick={openCommandPalette}>
                    <Search className="h-3.5 w-3.5" />
                    <span className="text-xs">Search...</span>
                    <kbd className="ml-2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                      ⌘K
                    </kbd>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Command Palette</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="relative p-2 rounded-lg hover:bg-secondary transition-colors">
                    <Bell className="h-4 w-4 text-muted-foreground" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground animate-pulse-glow">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{unreadCount} unread alerts</TooltipContent>
              </Tooltip>
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center cursor-pointer hover:bg-primary/20 transition-colors">
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
