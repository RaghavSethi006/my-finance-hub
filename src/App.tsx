import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { CommandPalette } from "@/components/CommandPalette";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import Dashboard from "./pages/Dashboard";
import FinancePage from "./pages/FinancePage";
import LedgerPage from "./pages/LedgerPage";
import AssetsPage from "./pages/AssetsPage";
import VaultPage from "./pages/VaultPage";
import TaxPage from "./pages/TaxPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useFinOS } from "./lib/store";
import { isTauriDesktop } from "./lib/desktop";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Lock } from "lucide-react";

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
  const isSecurityReady = useFinOS((state) => state.isSecurityReady);
  const onboardingCompleted = useFinOS((state) => state.onboardingCompleted);
  const refreshSecurityStatus = useFinOS((state) => state.refreshSecurityStatus);
  const recordSecurityActivity = useFinOS((state) => state.recordSecurityActivity);

  useEffect(() => {
    void hydrateDesktop();
  }, [hydrateDesktop]);

  useEffect(() => {
    if (!isTauriDesktop() || !isHydrated) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshSecurityStatus().catch((error) => {
        console.error("Failed to refresh desktop security status", error);
      });
    }, 10000);

    return () => window.clearInterval(interval);
  }, [isHydrated, refreshSecurityStatus]);

  useEffect(() => {
    if (!isTauriDesktop() || !isHydrated) {
      return;
    }

    let lastSentAt = 0;
    const ping = () => {
      const now = Date.now();
      if (now - lastSentAt < 15000) {
        return;
      }
      lastSentAt = now;
      void recordSecurityActivity();
    };

    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "focus"];
    events.forEach((eventName) => window.addEventListener(eventName, ping, { passive: true }));
    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, ping));
    };
  }, [isHydrated, recordSecurityActivity]);

  if (!isHydrated || !isSecurityReady) {
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
      {onboardingCompleted && <CommandPalette />}
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
      <OnboardingFlow />
      <DesktopLockScreen />
    </Router>
  );
}

function DesktopLockScreen() {
  const securityStatus = useFinOS((state) => state.securityStatus);
  const unlockApp = useFinOS((state) => state.unlockApp);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!securityStatus.isAppLocked) {
      setPin("");
      setError("");
      return;
    }

    const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [securityStatus.isAppLocked]);

  if (!securityStatus.hasAppPin || !securityStatus.isAppLocked) {
    return null;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await unlockApp(pin);
      setPin("");
    } catch (unlockError) {
      const message = unlockError instanceof Error ? unlockError.message : "Unable to unlock the app";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 px-4 backdrop-blur-sm">
      <Card className="w-full max-w-md border-primary/20 shadow-2xl">
        <CardContent className="space-y-5 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold">App Locked</h2>
            <p className="text-sm text-muted-foreground">
              Enter your app PIN to reopen your financial workspace.
            </p>
          </div>

          <form className="space-y-3" onSubmit={handleSubmit}>
            <Input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              placeholder="Enter app PIN"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
            />
            {securityStatus.appCooldownRemainingSeconds > 0 && (
              <p className="text-xs text-amber-600">
                Too many attempts. Try again in {securityStatus.appCooldownRemainingSeconds}s.
              </p>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button className="w-full" disabled={isSubmitting || pin.trim().length === 0}>
              {isSubmitting ? "Unlocking..." : "Unlock App"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
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
