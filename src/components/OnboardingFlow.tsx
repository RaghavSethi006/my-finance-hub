import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CURRENCY_CONFIG, Currency } from "@/lib/types";
import { useFinOS } from "@/lib/store";
import { ArrowRight, Briefcase, ChevronLeft, Database, ShieldCheck, Sparkles, WandSparkles } from "lucide-react";

type StarterMode = "sample" | "clean";

export function OnboardingFlow() {
  const onboardingCompleted = useFinOS((state) => state.onboardingCompleted);
  const settings = useFinOS((state) => state.settings);
  const completeOnboarding = useFinOS((state) => state.completeOnboarding);

  const [step, setStep] = useState<1 | 2>(1);
  const [starterMode, setStarterMode] = useState<StarterMode>("sample");
  const [name, setName] = useState(settings.name === "User" ? "" : settings.name);
  const [currency, setCurrency] = useState<Currency>(settings.defaultCurrency);

  const starterModeDescription = useMemo(() => {
    if (starterMode === "sample") {
      return {
        title: "Demo workspace",
        bullets: [
          "Loads example accounts, transactions, assets, and documents so you can explore the system immediately.",
          "Great for learning the app before replacing the demo data with your own records.",
          "You can clear the demo workspace later from Settings whenever you are ready.",
        ],
      };
    }

    return {
      title: "Clean workspace",
      bullets: [
        "Starts with your profile and default categories, but without demo financial records.",
        "Best if you want to begin adding real accounts, transactions, and documents right away.",
        "Keeps the app focused on your own data from the very first session.",
      ],
    };
  }, [starterMode]);

  if (onboardingCompleted) {
    return null;
  }

  const handleFinish = () => {
    completeOnboarding({
      name: name.trim() || settings.name,
      defaultCurrency: currency,
      starterMode,
    });
  };

  return (
    <div className="fixed inset-0 z-40 overflow-auto bg-background/95 px-4 py-8 backdrop-blur-sm">
      <div className="mx-auto flex min-h-full max-w-5xl items-center justify-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="overflow-hidden border-primary/20 shadow-2xl">
            <CardContent className="space-y-6 p-8">
              <div className="space-y-3">
                <Badge variant="secondary" className="gap-1.5 px-3 py-1 text-xs">
                  <Sparkles className="h-3.5 w-3.5" />
                  First Launch Setup
                </Badge>
                <div className="space-y-2">
                  <h1 className="text-3xl font-semibold tracking-tight">Welcome to FinOS</h1>
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                    Let&apos;s turn this into your actual financial desktop. We&apos;ll choose how your workspace
                    starts, set your identity, and get you into the app with a cleaner first-run experience.
                  </p>
                </div>
              </div>

              {step === 1 ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <button
                      type="button"
                      className={`rounded-2xl border p-5 text-left transition-all ${
                        starterMode === "sample"
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-primary/40 hover:bg-secondary/40"
                      }`}
                      onClick={() => setStarterMode("sample")}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <WandSparkles className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-base font-semibold">Use Demo Workspace</p>
                          <p className="text-xs text-muted-foreground">Best for exploration and quick product tours</p>
                        </div>
                      </div>
                      <p className="mt-4 text-sm leading-6 text-muted-foreground">
                        Start with example finance, asset, tax, and vault data so the app feels alive immediately.
                      </p>
                    </button>

                    <button
                      type="button"
                      className={`rounded-2xl border p-5 text-left transition-all ${
                        starterMode === "clean"
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-primary/40 hover:bg-secondary/40"
                      }`}
                      onClick={() => setStarterMode("clean")}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Briefcase className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-base font-semibold">Start Clean</p>
                          <p className="text-xs text-muted-foreground">Best for real data entry from day one</p>
                        </div>
                      </div>
                      <p className="mt-4 text-sm leading-6 text-muted-foreground">
                        Open with an empty workspace and keep only the foundation you need to begin adding your own data.
                      </p>
                    </button>
                  </div>

                  <div className="rounded-2xl border bg-secondary/25 p-5">
                    <p className="text-sm font-medium">{starterModeDescription.title}</p>
                    <div className="mt-3 space-y-2">
                      {starterModeDescription.bullets.map((bullet) => (
                        <p key={bullet} className="text-sm leading-6 text-muted-foreground">
                          {bullet}
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button className="gap-2" onClick={() => setStep(2)}>
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="onboarding-name">Display Name</Label>
                      <Input
                        id="onboarding-name"
                        placeholder="How should FinOS address you?"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Default Currency</Label>
                      <Select value={currency} onValueChange={(value) => setCurrency(value as Currency)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(CURRENCY_CONFIG) as Currency[]).map((item) => (
                            <SelectItem key={item} value={item}>
                              {CURRENCY_CONFIG[item].symbol} {item} - {CURRENCY_CONFIG[item].name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-secondary/25 p-5">
                    <p className="text-sm font-medium">Workspace Summary</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-xl border bg-background/80 p-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Database className="h-3.5 w-3.5" />
                          Starter Mode
                        </div>
                        <p className="mt-2 text-sm font-medium">
                          {starterMode === "sample" ? "Demo workspace" : "Clean workspace"}
                        </p>
                      </div>
                      <div className="rounded-xl border bg-background/80 p-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Sparkles className="h-3.5 w-3.5" />
                          Profile
                        </div>
                        <p className="mt-2 text-sm font-medium">{name.trim() || settings.name}</p>
                      </div>
                      <div className="rounded-xl border bg-background/80 p-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Default Currency
                        </div>
                        <p className="mt-2 text-sm font-medium">
                          {CURRENCY_CONFIG[currency].symbol} {currency}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Button variant="ghost" className="gap-2" onClick={() => setStep(1)}>
                      <ChevronLeft className="h-4 w-4" />
                      Back
                    </Button>
                    <Button className="gap-2" onClick={handleFinish}>
                      Launch Workspace
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-primary/10 bg-card/90 shadow-xl">
            <CardContent className="space-y-5 p-8">
              <div className="space-y-2">
                <p className="text-sm font-medium">What happens next</p>
                <p className="text-sm leading-6 text-muted-foreground">
                  FinOS will save this setup locally, keep the workspace consistent across reloads, and let you refine
                  security from Settings whenever you&apos;re ready.
                </p>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl border bg-secondary/20 p-4">
                  <p className="text-sm font-medium">1. Security</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Set an app PIN and vault password from Settings to lock the workspace and encrypt sensitive files.
                  </p>
                </div>
                <div className="rounded-xl border bg-secondary/20 p-4">
                  <p className="text-sm font-medium">2. Finance</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add your bank accounts, recurring transactions, and budgets so the dashboard becomes personal.
                  </p>
                </div>
                <div className="rounded-xl border bg-secondary/20 p-4">
                  <p className="text-sm font-medium">3. Vault</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Upload statements, tax forms, and legal documents, then link them directly to accounts or assets.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
