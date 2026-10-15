import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { InteractivePresellGateKind } from "@/lib/presellTypeMeta";
import { getPresellUiStrings } from "@/lib/presellUiStrings";

export type GatePayload = {
  params: Record<string, string>;
  ctaEnabled: boolean;
};

const AGE_GROUPS = ["18–24", "25–34", "35–44", "45–54", "55+"];

const COUNTRIES = [
  { code: "BR", name: "Brasil" },
  { code: "PT", name: "Portugal" },
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "ES", name: "España" },
  { code: "MX", name: "México" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Deutschland" },
  { code: "IT", name: "Italia" },
  { code: "OTHER", name: "Outro / Other" },
];

function modelRows(L: ReturnType<typeof getPresellUiStrings>): { id: string; label: string }[] {
  return [
    { id: "a", label: L.modelA },
    { id: "b", label: L.modelB },
    { id: "c", label: L.modelC },
  ];
}

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Resolve destino da oferta (ex.: Continuar para a oferta).
 * O consentimento em si não navega — só os botões do modal são interativos.
 */
export function cookieConsentNavigation(
  _action: "allow" | "dismiss",
  redirectHref: string,
  fallbackHref?: string,
): { kind: "assign"; url: string } | { kind: "stay" } {
  const a = redirectHref.trim();
  const b = (fallbackHref || "").trim();
  const url = a && a !== "#" ? a : b && b !== "#" ? b : "";
  if (!url) return { kind: "stay" };
  return { kind: "assign", url };
}

/**
 * Consentimento de cookies: página bloqueada (só botões do cartão clicáveis).
 * Aceitar libera a presell; o fundo não navega nem fecha o modal.
 */
export function CookieConsentModal({
  language,
  policyUrl,
  redirectHref,
  fallbackHref,
  accepted,
  onAccept,
  navigateOnAccept = false,
}: {
  language: string;
  policyUrl: string;
  redirectHref: string;
  fallbackHref?: string;
  accepted: boolean;
  onAccept?: () => void;
  /** Tipo cookies: Accept All segue o hoplink rastreado. A política continua a ser a política. */
  navigateOnAccept?: boolean;
}) {
  const L = getPresellUiStrings(language);
  const offerDest = cookieConsentNavigation("allow", redirectHref, fallbackHref);
  const offerUrl = offerDest.kind === "assign" ? offerDest.url : "";
  useEffect(() => {
    if (accepted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [accepted]);
  if (accepted) return null;

  const accept = () => {
    if (navigateOnAccept && offerUrl) {
      window.location.assign(offerUrl);
      return;
    }
    onAccept?.();
  };
  const policyHref = policyUrl;

  return (
    <div
      className="fixed inset-0 z-[520] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-policy-title"
      data-testid="presell-cookie-sheet"
    >
      {/* Fundo inerte: bloqueia a página; não é botão nem navega. */}
      <div
        data-testid="presell-cookie-backdrop"
        className="absolute inset-0 bg-slate-950/30 backdrop-blur-[2px]"
        aria-hidden="true"
      />
      <div
        data-testid="presell-cookie-card"
        className="relative z-10 w-full max-w-[420px] rounded-2xl border border-white/20 bg-white px-6 py-7 text-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="cookie-policy-title" className="text-xl font-bold tracking-tight text-slate-950">
          {L.cookieTitle}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          {L.cookieBody}
          {policyHref ? (
            <>
              {" "}
              <a
                href={policyHref}
                target={navigateOnAccept ? undefined : "_blank"}
                rel={navigateOnAccept ? undefined : "noopener noreferrer"}
                className="font-medium text-blue-600 underline underline-offset-2 hover:text-blue-700"
                onClick={(e) => e.stopPropagation()}
              >
                {L.cookiePolicy}
              </a>
              .
            </>
          ) : null}
        </p>
        <div className="mt-6 flex gap-3">
          {navigateOnAccept && offerUrl ? (
            <a
              href={offerUrl}
              className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-emerald-500 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600"
            >
              {L.cookieAllow}
            </a>
          ) : (
            <Button
              type="button"
              className="h-12 flex-1 rounded-full border-0 bg-emerald-500 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600"
              onClick={accept}
            >
              {L.cookieAllow}
            </Button>
          )}
          {navigateOnAccept && offerUrl ? (
            <a
              href={offerUrl}
              className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {L.cookieClose}
            </a>
          ) : (
            <button
              type="button"
              className="h-12 flex-1 rounded-full border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={accept}
            >
              {L.cookieClose}
            </button>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">{L.cookieFooter}</p>
      </div>
    </div>
  );
}

/** Botão flutuante para reabrir o modal se o utilizador fechou sem aceitar. */
export function CookieSettingsChip({
  language,
  onClick,
}: {
  language: string;
  onClick: () => void;
}) {
  const L = getPresellUiStrings(language);
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-5 right-5 z-[515] rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-lg hover:bg-muted/80 transition-colors"
    >
      {L.cookieReopen}
    </button>
  );
}

export function PresellGateFields({
  gateKind,
  language,
  settings,
  onPayload,
}: {
  gateKind: InteractivePresellGateKind;
  language: string;
  settings: Record<string, unknown>;
  onPayload: (p: GatePayload) => void;
}) {
  const L = getPresellUiStrings(language);
  const minAge = num(settings.minAge, 18);
  const onPayloadRef = useRef(onPayload);
  onPayloadRef.current = onPayload;

  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [country, setCountry] = useState("");
  const [humanOk, setHumanOk] = useState(false);
  const [model, setModel] = useState("");

  useEffect(() => {
    const params: Record<string, string> = {};
    let ctaEnabled = true;

    switch (gateKind) {
      case "age": {
        const n = parseInt(age, 10);
        if (Number.isFinite(n) && n >= minAge) {
          params.co_age = String(n);
        }
        ctaEnabled = Number.isFinite(n) && n >= minAge;
        break;
      }
      case "sex":
        if (sex) params.co_sex = sex;
        ctaEnabled = !!sex;
        break;
      case "age_group_m":
      case "age_group_f":
        if (ageGroup) params.co_age_group = ageGroup;
        if (gateKind === "age_group_m") params.co_profile = "m";
        if (gateKind === "age_group_f") params.co_profile = "f";
        ctaEnabled = !!ageGroup;
        break;
      case "country":
        if (country) params.co_country = country;
        ctaEnabled = !!country;
        break;
      case "captcha":
        if (humanOk) params.co_verified = "1";
        ctaEnabled = humanOk;
        break;
      case "models":
        if (model) params.co_model = model;
        ctaEnabled = !!model;
        break;
      case "age_sex": {
        const n = parseInt(age, 10);
        const okAge = Number.isFinite(n) && n >= minAge;
        if (okAge) params.co_age = String(n);
        if (sex) params.co_sex = sex;
        ctaEnabled = okAge && !!sex;
        break;
      }
      case "age_country": {
        const n = parseInt(age, 10);
        const okAge = Number.isFinite(n) && n >= minAge;
        if (okAge) params.co_age = String(n);
        if (country) params.co_country = country;
        ctaEnabled = okAge && !!country;
        break;
      }
      case "sex_country":
        if (sex) params.co_sex = sex;
        if (country) params.co_country = country;
        ctaEnabled = !!sex && !!country;
        break;
      default:
        break;
    }

    onPayloadRef.current({ params, ctaEnabled });
  }, [gateKind, age, sex, ageGroup, country, humanOk, model, minAge]);

  return (
    <div className="w-full max-w-lg mx-auto rounded-xl border border-border/60 bg-card/80 p-5 text-left shadow-sm space-y-4 mb-6">
      <p className="text-sm font-semibold text-foreground">{L.beforeContinue}</p>

      {gateKind === "age" || gateKind === "age_sex" || gateKind === "age_country" ? (
        <div className="space-y-2">
          <Label htmlFor="gate-age">{L.ageLabel}</Label>
          <Input
            id="gate-age"
            type="number"
            inputMode="numeric"
            min={minAge}
            max={120}
            placeholder="18+"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="max-w-[200px]"
          />
          <p className="text-xs text-muted-foreground">{L.ageInvalid.replace("{min}", String(minAge))}</p>
        </div>
      ) : null}

      {gateKind === "sex" || gateKind === "age_sex" || gateKind === "sex_country" ? (
        <div className="space-y-3">
          <Label>{L.sexLabel}</Label>
          <RadioGroup value={sex} onValueChange={setSex} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="m" id="sx-m" />
              <Label htmlFor="sx-m" className="font-normal cursor-pointer">
                {L.sexM}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="f" id="sx-f" />
              <Label htmlFor="sx-f" className="font-normal cursor-pointer">
                {L.sexF}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="o" id="sx-o" />
              <Label htmlFor="sx-o" className="font-normal cursor-pointer">
                {L.sexO}
              </Label>
            </div>
          </RadioGroup>
        </div>
      ) : null}

      {gateKind === "age_group_m" || gateKind === "age_group_f" ? (
        <div className="space-y-2">
          <Label>{L.groupLabel}</Label>
          <Select value={ageGroup} onValueChange={setAgeGroup}>
            <SelectTrigger>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {AGE_GROUPS.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {gateKind === "country" || gateKind === "age_country" || gateKind === "sex_country" ? (
        <div className="space-y-2">
          <Label>{L.countryLabel}</Label>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {gateKind === "captcha" ? (
        <div className="flex items-center gap-2">
          <Checkbox id="human" checked={humanOk} onCheckedChange={(c) => setHumanOk(c === true)} />
          <Label htmlFor="human" className="font-normal cursor-pointer">
            {L.captchaLabel}
          </Label>
        </div>
      ) : null}

      {gateKind === "models" ? (
        <div className="space-y-2">
          <Label>{L.modelLabel}</Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {modelRows(L).map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  );
}

export function useCookieAcceptedState() {
  const [cookieAccepted, setCookieAccepted] = useState(false);
  return { cookieAccepted, setCookieAccepted };
}

/** Junta parâmetros do gate ao URL de afiliado (dinâmico). */
export function mergeParamsIntoAffiliateUrl(affiliateLink: string, extra: Record<string, string>): string {
  if (!extra || Object.keys(extra).length === 0) return affiliateLink;
  try {
    const u = new URL(affiliateLink);
    for (const [k, v] of Object.entries(extra)) {
      if (v) u.searchParams.set(k, v);
    }
    return u.toString();
  } catch {
    return affiliateLink;
  }
}
