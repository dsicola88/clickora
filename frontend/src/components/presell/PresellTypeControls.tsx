import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { InteractivePresellGateKind } from "@/lib/presellTypeMeta";
import { getPresellUiStrings } from "@/lib/presellUiStrings";
import { stripTrailingCookiePolicyLabel } from "@/page-builder/cookieBannerCopy";
import { CookiePolicyInlineSheet } from "@/components/presell/CookiePolicyInlineSheet";
import {
  readCookieConsentChoice,
  writeCookieConsentChoice,
} from "@/page-builder/cookieConsentStorage";
import { mergeLandingAdParamsIntoTrackHref } from "@/lib/presellTrackAdParams";
import {
  cookieBannerReserveHeight,
  getPresellCookieStyle,
  presellCookieStyleCssVars,
  type PresellCookieLayout,
  type PresellCookieStyleId,
} from "@/lib/presellCookieBannerStyles";

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
  { code: "AU", name: "Australia" },
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
 * Resolve o destino de «Aceitar» quando `cookieRedirectToOffer` está activo (opt-in).
 * Só o clique intencional em Aceitar navega, por link nativo para /track/r/.
 * Fechar (dismiss) nunca navega — a página e os CTAs ficam acessíveis.
 */
export function cookieConsentNavigation(
  action: "allow" | "dismiss",
  redirectHref: string,
  fallbackHref?: string,
): { kind: "assign"; url: string } | { kind: "stay" } {
  if (action === "dismiss") return { kind: "stay" };
  const a = redirectHref.trim();
  const b = (fallbackHref || "").trim();
  const url = a && a !== "#" ? a : b && b !== "#" ? b : "";
  if (!url) return { kind: "stay" };
  return { kind: "assign", url };
}

/**
 * `settings.cookieRedirectToOffer` — opt-in explícito por presell (por defeito desligado).
 * Páginas sem a chave só gravam o consentimento.
 */
export function isCookieRedirectToOfferEnabled(
  settings: Record<string, unknown> | null | undefined,
): boolean {
  const v = settings?.cookieRedirectToOffer ?? settings?.cookie_redirect_to_offer;
  return v === true || v === 1 || v === "true" || v === "1";
}

/** Classes de layout por tipo de banner (cores vêm sempre de variáveis CSS dos tokens). */
const COOKIE_LAYOUT_CLASSES: Record<
  PresellCookieLayout,
  { wrapper: string; card: string; inner: string; actions: string }
> = {
  bar: {
    wrapper: "pointer-events-none fixed inset-x-0 bottom-0 z-[520]",
    card: "pointer-events-auto relative z-10 w-full border-t px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6",
    inner: "mx-auto flex w-full max-w-5xl flex-col gap-3 md:flex-row md:items-center md:gap-8",
    actions: "flex flex-col-reverse gap-2 sm:flex-row md:w-80 md:shrink-0",
  },
  corner: {
    wrapper:
      "pointer-events-none fixed inset-x-0 bottom-0 z-[520] sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[24rem]",
    card: "pointer-events-auto relative z-10 w-full rounded-t-2xl border border-b-0 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-2xl sm:border-b sm:p-5",
    inner: "flex w-full flex-col gap-3",
    actions: "flex flex-col-reverse gap-2 sm:flex-row",
  },
  floating: {
    wrapper:
      "pointer-events-none fixed inset-x-0 bottom-0 z-[520] flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
    card: "pointer-events-auto relative z-10 w-full max-w-lg rounded-2xl border px-4 py-3.5 sm:px-5",
    inner: "flex w-full flex-col gap-3",
    actions: "flex flex-col-reverse gap-2 sm:flex-row",
  },
};

function setStyleProp(style: CSSStyleDeclaration, prop: string, value: string) {
  if (value) style.setProperty(prop, value);
  else style.removeProperty(prop);
}

/**
 * Enquanto o banner está aberto, reserva espaço no fim da página (padding no body + scroll-padding)
 * para o último CTA nunca ficar tapado (WCAG 2.4.11). Restaura ao fechar/desmontar.
 */
function useReserveBottomSpace(
  ref: RefObject<HTMLElement | null>,
  layout: PresellCookieLayout,
  enabled: boolean,
) {
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el || typeof document === "undefined") return;
    const body = document.body;
    const root = document.documentElement;
    const prevPad = body.style.getPropertyValue("padding-bottom");
    const prevScroll = root.style.getPropertyValue("scroll-padding-bottom");
    const apply = () => {
      const r = el.getBoundingClientRect();
      const h = cookieBannerReserveHeight({
        layout,
        cardWidth: r.width,
        cardHeight: r.height,
        viewportWidth: window.innerWidth,
      });
      setStyleProp(body.style, "padding-bottom", h > 0 ? `${h}px` : prevPad);
      setStyleProp(root.style, "scroll-padding-bottom", h > 0 ? `${h}px` : prevScroll);
    };
    apply();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(apply) : null;
    ro?.observe(el);
    window.addEventListener("resize", apply);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", apply);
      setStyleProp(body.style, "padding-bottom", prevPad);
      setStyleProp(root.style, "scroll-padding-bottom", prevScroll);
    };
  }, [ref, layout, enabled]);
}

/**
 * Consentimento compacto (barra/cartão inferior): não tapa a oferta nem bloqueia scroll/CTAs.
 * Aceitar = cookies não essenciais (+ redirect opcional para /track/r/, só por clique).
 * Fechar = só essenciais; página e CTAs continuam. Aceitar e Fechar têm o mesmo destaque.
 * `styleId` (settings.cookieBannerStyle) escolhe a predefinição visual; inválido → classicBar.
 */
export function CookieConsentModal({
  language,
  policyUrl,
  redirectHref = "",
  fallbackHref = "",
  accepted,
  onAccept,
  onDismiss,
  /** Quando true (settings.cookieRedirectToOffer), Aceitar vai à oferta via /track/r/. */
  navigateOnAccept = false,
  styleId,
}: {
  language: string;
  policyUrl: string;
  redirectHref?: string;
  fallbackHref?: string;
  accepted: boolean;
  onAccept?: () => void;
  /** Fechar / só essenciais — nunca redireciona; CTAs da oferta continuam. */
  onDismiss?: () => void;
  navigateOnAccept?: boolean;
  styleId?: PresellCookieStyleId | string | null;
}) {
  const L = getPresellUiStrings(language);
  const cookieBody = stripTrailingCookiePolicyLabel(L.cookieBody, L.cookiePolicy);
  const [policyOpen, setPolicyOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const tokens = getPresellCookieStyle(styleId);
  const layoutClasses = COOKIE_LAYOUT_CLASSES[tokens.layout];
  useReserveBottomSpace(cardRef, tokens.layout, !accepted);
  const offerNav = navigateOnAccept
    ? cookieConsentNavigation("allow", redirectHref, fallbackHref)
    : ({ kind: "stay" } as const);
  if (accepted) return null;

  const dismiss = () => {
    writeCookieConsentChoice("clickora-cookie-banner", "essential");
    (onDismiss ?? onAccept)?.();
  };
  const acceptStay = () => {
    writeCookieConsentChoice("clickora-cookie-banner", "all");
    onAccept?.();
  };

  // Mesmo tamanho/borda/peso nos dois botões (equal prominence — ICO); só a cor varia por estilo.
  const btnBase =
    "inline-flex h-11 min-h-[44px] flex-1 cursor-pointer items-center justify-center rounded-xl border border-transparent px-3 text-sm font-semibold no-underline shadow-sm transition-colors";
  const allowClass = `${btnBase} [background-color:var(--ck-allow-bg)] [color:var(--ck-allow-text)] hover:[background-color:var(--ck-allow-hover)]`;
  const closeClass = `${btnBase} [background-color:var(--ck-close-bg)] [color:var(--ck-close-text)] hover:[background-color:var(--ck-close-hover)]`;
  const cssVars = presellCookieStyleCssVars(tokens) as CSSProperties;

  return (
    <>
      <div
        className={layoutClasses.wrapper}
        style={cssVars}
        role="dialog"
        aria-modal="false"
        aria-labelledby="cookie-policy-title"
        data-testid="presell-cookie-sheet"
        data-cookie-style={tokens.id}
        data-cookie-layout={tokens.layout}
      >
        {/* Banner não bloqueante: texto completo + Aceitar/Fechar sempre visíveis; sem backdrop nem scroll lock. */}
        <div
          ref={cardRef}
          data-testid="presell-cookie-card"
          className={`${layoutClasses.card} [background-color:var(--ck-surface)] [border-color:var(--ck-border)] [box-shadow:var(--ck-shadow)] [backdrop-filter:var(--ck-blur)] [-webkit-backdrop-filter:var(--ck-blur)] [color:var(--ck-title)]`}
        >
          <div className={layoutClasses.inner}>
            <div className="min-w-0 flex-1">
              <h2
                id="cookie-policy-title"
                className="text-sm font-bold tracking-tight [color:var(--ck-title)] sm:text-base"
              >
                {L.cookieTitle}
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed [color:var(--ck-body)] sm:text-sm">
                {cookieBody}{" "}
                <button
                  type="button"
                  className="cursor-pointer font-medium underline underline-offset-2 transition-opacity [color:var(--ck-link)] hover:opacity-80"
                  data-testid="presell-cookie-policy-open"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPolicyOpen(true);
                  }}
                >
                  {L.cookiePolicy}
                </button>
                .
              </p>
              <p className="mt-1.5 text-[11px] leading-snug [color:var(--ck-muted)] sm:text-xs">
                {L.cookieFooter}
              </p>
            </div>
            <div className={layoutClasses.actions}>
              {offerNav.kind === "assign" ? (
                <a
                  href={offerNav.url}
                  className={allowClass}
                  data-testid="presell-cookie-allow-offer"
                  onClick={(e) => {
                    // Gravar consentimento desmonta a barra; assign explícito evita cancelar a navegação.
                    e.preventDefault();
                    writeCookieConsentChoice("clickora-cookie-banner", "all");
                    onAccept?.();
                    const dest =
                      mergeLandingAdParamsIntoTrackHref(offerNav.url, window.location.search) ||
                      offerNav.url;
                    window.location.assign(dest);
                  }}
                >
                  {L.cookieAllow}
                </a>
              ) : (
                <button
                  type="button"
                  className={allowClass}
                  data-testid="presell-cookie-allow"
                  onClick={acceptStay}
                >
                  {L.cookieAllow}
                </button>
              )}
              <button
                type="button"
                className={closeClass}
                data-testid="presell-cookie-close"
                onClick={dismiss}
              >
                {L.cookieClose}
              </button>
            </div>
          </div>
        </div>
      </div>
      <CookiePolicyInlineSheet
        language={language}
        open={policyOpen}
        onClose={() => setPolicyOpen(false)}
        policyUrl={policyUrl}
      />
    </>
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

/** null = pendente; all = Aceitar; essential = Fechar (página/oferta OK, sem pixels de ads). */
export type CookieConsentChoice = null | "all" | "essential";

export function useCookieAcceptedState() {
  const [cookieConsent, setCookieConsent] = useState<CookieConsentChoice>(() =>
    typeof window !== "undefined" ? readCookieConsentChoice() : null,
  );
  const cookieAccepted = cookieConsent !== null;
  const setCookieAccepted = (v: boolean) => setCookieConsent(v ? "all" : null);
  return {
    cookieAccepted,
    setCookieAccepted,
    cookieConsent,
    setCookieConsent,
    marketingAllowed: cookieConsent === "all",
  };
}

/** Junta parâmetros do gate ao URL de afiliado sem sobrescrever query já no hoplink. */
export function mergeParamsIntoAffiliateUrl(affiliateLink: string, extra: Record<string, string>): string {
  if (!extra || Object.keys(extra).length === 0) return affiliateLink;
  try {
    const u = new URL(affiliateLink);
    for (const [k, v] of Object.entries(extra)) {
      if (!v || u.searchParams.has(k)) continue;
      u.searchParams.set(k, v);
    }
    return u.toString();
  } catch {
    return affiliateLink;
  }
}
