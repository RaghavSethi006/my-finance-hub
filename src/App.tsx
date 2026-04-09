import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { CommandPalette } from "@/components/CommandPalette";
import Dashboard from "./pages/Dashboard";
import FinancePage from "./pages/FinancePage";
import LedgerPage from "./pages/LedgerPage";
import AssetsPage from "./pages/AssetsPage";
import VaultPage from "./pages/VaultPage";
import TaxPage from "./pages/TaxPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";
import { useEffect } from "react";
import { useFinOS } from "./lib/store";
import { isTauriDesktop } from "./lib/desktop";

const queryClient = new QueryClient();

function ThemeApplicator({ children }: { children: React.ReactNode }) {
  const theme = useFinOS((s) => s.settings.theme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    }
  }, [theme]);
  return <>{children}</>;
}

function AppBootstrap() {
  const hydrateDesktop = useFinOS((state) => state.hydrateDesktop);
  const isHydrated = useFinOS((state) => state.isHydrated);

  useEffect(() => {
    void hydrateDesktop();
  }, [hydrateDesktop]);

  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="space-y-2 text-center">
          <div className="mx-auto h-10 w-10 animate-pulse rounded-2xl bg-primary/20" />
          <p className="text-sm font-medium">Loading FinOS...</p>
          <p className="text-xs text-muted-foreground">Preparing your local financial workspace</p>
        </div>
      </div>
    );
  }

  const Router = isTauriDesktop() ? HashRouter : BrowserRouter;

  return (
    <Router>
      <CommandPalette />
      <AppLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/finance" element={<FinancePage />} />
          <Route path="/ledger" element={<LedgerPage />} />
          <Route path="/assets" element={<AssetsPage />} />
          <Route path="/vault" element={<VaultPage />} />
          <Route path="/tax" element={<TaxPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppLayout>
    </Router>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeApplicator>
        <Toaster />
        <Sonner />
        <AppBootstrap />
      </ThemeApplicator>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
