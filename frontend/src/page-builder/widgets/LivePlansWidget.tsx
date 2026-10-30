import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Check, Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { plansService } from "@/services/plansService";
import { mergeWithDefaultLabels } from "@/lib/planDisplayLabels";
import { plansLandingService } from "@/services/plansLandingService";
import { coerceLandingExtras } from "@/lib/plansLandingExtras";
import { cn } from "@/lib/utils";
import type { Plan } from "@/types/api";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCssWidgetContent } from "../style-utils";

export interface LivePlansContent {
  sectionLabel?: string;
  title?: string;
  subtitle?: string;
  showHeader?: boolean;
  accentColor?: string;
  cardBg?: string;
  textColor?: string;
  ctaBg?: string;
  ctaColor?: string;
}

function formatPrice(cents: number, locale: string, currencySymbol: string): string {
  if (cents <= 0) return "Grátis";
  const value = (cents / 100).toLocaleString(locale, {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${currencySymbol} ${value}`;
}

export function LivePlansWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const c = widget.content as Partial<LivePlansContent>;
  const showHeader = c.showHeader !== false;
  const sectionLabel = c.sectionLabel ?? "PLANOS";
  const title = c.title ?? "Escolha o plano certo";
  const subtitle =
    c.subtitle ?? "Preços e limites vêm da base de dados — edite-os no admin em Planos.";
  const accent = c.accentColor ?? "#e63946";
  const cardBg = c.cardBg ?? "#ffffff";
  const textColor = c.textColor ?? "#0f172a";
  const ctaBg = c.ctaBg ?? accent;
  const ctaColor = c.ctaColor ?? "#ffffff";

  const navigate = useNavigate();
  const { user, userPlan } = useAuth();

  const { data: plans = [], isLoading, isError } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await plansService.getAll();
      if (error) throw new Error(error);
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const { data: landing } = useQuery({
    queryKey: ["plans-landing-public"],
    queryFn: () => plansLandingService.getPublic(),
    staleTime: 60_000,
  });

  const lb = mergeWithDefaultLabels(landing?.plan_display_labels);
  const extras = coerceLandingExtras(landing?.landing_extras);
  const recommended = extras.recommended_plan_type?.trim() || null;
  const locale = lb.locale || "pt-BR";
  const currency = lb.price_symbol || "R$";

  const handleSelect = async (plan: Plan) => {
    if (user && plan.type === userPlan?.plan_type) {
      toast.info("Você já está neste plano.");
      return;
    }
    if (plan.price_cents > 0 && plan.checkout_url) {
      window.location.href = plan.checkout_url;
      return;
    }
    if (!user) {
      if (plan.price_cents === 0) {
        toast.info("Crie uma conta ou entre para ativar o plano grátis.");
        navigate("/auth");
        return;
      }
      toast.error("O checkout deste plano ainda não está ligado. Contacte o suporte.");
      return;
    }
    const { data, error } = await plansService.subscribe(plan.id);
    if (error) {
      toast.error(error);
      return;
    }
    if (data?.checkout_url) {
      window.location.href = data.checkout_url;
      return;
    }
    if (data?.checkout_mode === "unconfigured" && data.message) {
      toast.error(data.message);
      return;
    }
    toast.success("Plano atualizado com sucesso!");
  };

  return (
    <div id="planos" style={stylesToCssWidgetContent(widget.styles, device)}>
      <div className="mx-auto w-full max-w-6xl px-2 py-4 sm:px-4">
        {showHeader ? (
          <div className="mb-8 space-y-2 text-center">
            {sectionLabel ? (
              <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: accent }}>
                {sectionLabel}
              </p>
            ) : null}
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl" style={{ color: textColor }}>
              {title}
            </h2>
            {subtitle ? (
              <p className="mx-auto max-w-2xl text-sm leading-relaxed opacity-80" style={{ color: textColor }}>
                {subtitle}
              </p>
            ) : null}
          </div>
        ) : null}

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />A carregar planos…
          </div>
        ) : null}

        {isError ? (
          <p className="rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-4 text-center text-sm text-destructive">
            Não foi possível carregar os planos.
          </p>
        ) : null}

        {!isLoading && !isError && plans.length === 0 ? (
          <p className="rounded-lg border border-dashed border-muted-foreground/40 bg-muted/20 p-4 text-center text-sm text-muted-foreground">
            Sem planos na base de dados. Configure-os no admin → Planos.
          </p>
        ) : null}

        {!isLoading && plans.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => {
              const isRecommended = Boolean(recommended) && plan.type === recommended;
              const isCurrent = plan.type === userPlan?.plan_type;
              const featureLines = (plan.features ?? [])
                .map((f) => f.trim())
                .filter(Boolean)
                .slice(0, 12);
              const cta =
                plan.cta_label?.trim() ||
                (plan.price_cents <= 0 ? lb.cta_free || "Começar grátis" : lb.cta_upgrade || "Assinar");

              return (
                <div
                  key={plan.id}
                  className={cn(
                    "relative flex flex-col rounded-2xl border p-6 shadow-sm transition-transform hover:-translate-y-0.5",
                    isRecommended ? "scale-[1.01] shadow-lg" : "",
                  )}
                  style={{
                    background: cardBg,
                    color: textColor,
                    borderColor: isRecommended ? accent : "rgba(15,23,42,0.12)",
                    boxShadow: isRecommended ? `0 16px 40px -16px ${accent}66` : undefined,
                  }}
                >
                  {isRecommended ? (
                    <Badge
                      className="absolute -top-3 left-1/2 -translate-x-1/2 border-0 text-white"
                      style={{ backgroundColor: accent }}
                    >
                      {lb.badge_popular || "Mais popular"}
                    </Badge>
                  ) : null}
                  <div className="mb-4 flex items-start gap-3">
                    <div className="rounded-xl p-2" style={{ backgroundColor: `${accent}18`, color: accent }}>
                      <Star className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold">{plan.name}</h3>
                      {isCurrent ? (
                        <p className="mt-0.5 text-xs font-medium opacity-70">Plano atual</p>
                      ) : null}
                    </div>
                  </div>
                  <p className="mb-4 text-3xl font-extrabold tracking-tight">
                    {formatPrice(plan.price_cents, locale, currency)}
                    {plan.price_cents > 0 ? (
                      <span className="ml-1 text-sm font-medium opacity-60">
                        {plan.type === "annual" ? "/ano" : plan.type === "quarterly" ? "/trimestre" : "/mês"}
                      </span>
                    ) : null}
                  </p>
                  <ul className="mb-6 flex-1 space-y-2 text-sm">
                    {featureLines.map((line) => (
                      <li key={line} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accent }} />
                        <span className="leading-snug opacity-90">{line}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="mt-auto h-11 w-full border-0 font-semibold"
                    style={{ backgroundColor: ctaBg, color: ctaColor }}
                    onClick={() => void handleSelect(plan)}
                    disabled={isCurrent}
                  >
                    {isCurrent ? "Plano atual" : cta}
                  </Button>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
