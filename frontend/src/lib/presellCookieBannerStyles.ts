/**
 * Estilos do banner de cookies do tipo «cookies» (presell pública + export estático).
 *
 * Regras de desenho (UK ICO 2026, Google Ads «destination experience», WCAG 2.2):
 * - Sempre banner não bloqueante: sem fundo escurecido, sem scroll lock, sem modal central.
 * - Aceitar e Fechar (= só essenciais) com o MESMO tamanho, peso e preenchimento.
 * - Contraste de texto ≥ 4.5:1 em todos os estilos (validado em teste).
 * - Barra/cartão adaptam-se a «bottom sheet» em ecrãs estreitos.
 * - Enquanto aberto, o banner reserva espaço no fim da página (o último CTA fica alcançável).
 *
 * `settings.cookieBannerStyle` guarda o id; sem valor válido usa `classicBar`.
 */

export type PresellCookieStyleId =
  | "classicBar"
  | "minimalGreen"
  | "darkBar"
  | "glassBar"
  | "cornerCard"
  | "floatingCard";

/** bar = largura total; corner = canto inferior direito; floating = cartão central em baixo. */
export type PresellCookieLayout = "bar" | "corner" | "floating";

export interface PresellCookieStyleTokens {
  id: PresellCookieStyleId;
  layout: PresellCookieLayout;
  surface: string;
  surfaceBorder: string;
  shadow: string;
  /** Desfocagem do fundo em px (0 = sem). Só `glassBar`. */
  blurPx: number;
  title: string;
  body: string;
  muted: string;
  link: string;
  allowBg: string;
  allowText: string;
  allowHover: string;
  closeBg: string;
  closeText: string;
  closeHover: string;
}

export const DEFAULT_PRESELL_COOKIE_STYLE: PresellCookieStyleId = "classicBar";

/** Ordem de apresentação no seletor (recomendado primeiro). */
export const PRESELL_COOKIE_STYLE_ORDER: PresellCookieStyleId[] = [
  "classicBar",
  "minimalGreen",
  "darkBar",
  "glassBar",
  "cornerCard",
  "floatingCard",
];

const STYLES: Record<PresellCookieStyleId, PresellCookieStyleTokens> = {
  classicBar: {
    id: "classicBar",
    layout: "bar",
    surface: "#ffffff",
    surfaceBorder: "#e2e8f0",
    shadow: "0 -10px 36px -14px rgba(15,23,42,0.4)",
    blurPx: 0,
    title: "#0f172a",
    body: "#475569",
    muted: "#64748b",
    link: "#1d4ed8",
    allowBg: "#0f172a",
    allowText: "#ffffff",
    allowHover: "#1e293b",
    closeBg: "#475569",
    closeText: "#ffffff",
    closeHover: "#334155",
  },
  minimalGreen: {
    id: "minimalGreen",
    layout: "bar",
    surface: "#ffffff",
    surfaceBorder: "#d1fae5",
    shadow: "0 -10px 36px -14px rgba(6,78,59,0.35)",
    blurPx: 0,
    title: "#064e3b",
    body: "#475569",
    muted: "#64748b",
    link: "#047857",
    allowBg: "#047857",
    allowText: "#ffffff",
    allowHover: "#065f46",
    closeBg: "#475569",
    closeText: "#ffffff",
    closeHover: "#334155",
  },
  darkBar: {
    id: "darkBar",
    layout: "bar",
    surface: "#0f172a",
    surfaceBorder: "#1e293b",
    shadow: "0 -10px 36px -14px rgba(0,0,0,0.6)",
    blurPx: 0,
    title: "#f8fafc",
    body: "#cbd5e1",
    muted: "#94a3b8",
    link: "#93c5fd",
    allowBg: "#f8fafc",
    allowText: "#0f172a",
    allowHover: "#ffffff",
    closeBg: "#cbd5e1",
    closeText: "#0f172a",
    closeHover: "#e2e8f0",
  },
  glassBar: {
    id: "glassBar",
    layout: "bar",
    surface: "rgba(255,255,255,0.88)",
    surfaceBorder: "rgba(15,23,42,0.08)",
    shadow: "0 -8px 30px -12px rgba(15,23,42,0.35)",
    blurPx: 14,
    title: "#0f172a",
    body: "#334155",
    muted: "#475569",
    link: "#1d4ed8",
    allowBg: "#0f172a",
    allowText: "#ffffff",
    allowHover: "#1e293b",
    closeBg: "#475569",
    closeText: "#ffffff",
    closeHover: "#334155",
  },
  cornerCard: {
    id: "cornerCard",
    layout: "corner",
    surface: "#ffffff",
    surfaceBorder: "#e2e8f0",
    shadow: "0 18px 50px -12px rgba(15,23,42,0.35)",
    blurPx: 0,
    title: "#0f172a",
    body: "#475569",
    muted: "#64748b",
    link: "#1d4ed8",
    allowBg: "#1d4ed8",
    allowText: "#ffffff",
    allowHover: "#1e40af",
    closeBg: "#475569",
    closeText: "#ffffff",
    closeHover: "#334155",
  },
  floatingCard: {
    id: "floatingCard",
    layout: "floating",
    surface: "#ffffff",
    surfaceBorder: "#e2e8f0",
    shadow: "0 12px 40px -12px rgba(15,23,42,0.35)",
    blurPx: 0,
    title: "#0f172a",
    body: "#475569",
    muted: "#64748b",
    link: "#1d4ed8",
    allowBg: "#0f172a",
    allowText: "#ffffff",
    allowHover: "#1e293b",
    closeBg: "#475569",
    closeText: "#ffffff",
    closeHover: "#334155",
  },
};

export function isPresellCookieStyleId(v: unknown): v is PresellCookieStyleId {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(STYLES, v);
}

export function getPresellCookieStyle(id: unknown): PresellCookieStyleTokens {
  return isPresellCookieStyleId(id) ? STYLES[id] : STYLES[DEFAULT_PRESELL_COOKIE_STYLE];
}

/** Lê o estilo de `settings` (aceita snake_case legado); inválido/ausente → classicBar. */
export function resolvePresellCookieStyleId(
  settings: Record<string, unknown> | null | undefined,
): PresellCookieStyleId {
  const raw = settings?.cookieBannerStyle ?? settings?.cookie_banner_style;
  return isPresellCookieStyleId(raw) ? raw : DEFAULT_PRESELL_COOKIE_STYLE;
}

/** Variáveis CSS usadas pelo banner React (cores vêm sempre dos tokens). */
export function presellCookieStyleCssVars(t: PresellCookieStyleTokens): Record<string, string> {
  return {
    "--ck-surface": t.surface,
    "--ck-border": t.surfaceBorder,
    "--ck-shadow": t.shadow,
    "--ck-blur": t.blurPx > 0 ? `blur(${t.blurPx}px)` : "none",
    "--ck-title": t.title,
    "--ck-body": t.body,
    "--ck-muted": t.muted,
    "--ck-link": t.link,
    "--ck-allow-bg": t.allowBg,
    "--ck-allow-text": t.allowText,
    "--ck-allow-hover": t.allowHover,
    "--ck-close-bg": t.closeBg,
    "--ck-close-text": t.closeText,
    "--ck-close-hover": t.closeHover,
  };
}

/**
 * CSS do export estático para o estilo escolhido (escopo `.pe-ck-<id>` no overlay).
 * Aceitar e Fechar partilham tamanho, borda e peso — destaque igual (ICO).
 */
export function buildExportCookieStyleCss(styleId: unknown): string {
  const t = getPresellCookieStyle(styleId);
  const s = `.pe-cookie-overlay.pe-ck-${t.id}`;
  const blur = t.blurPx > 0 ? `backdrop-filter:blur(${t.blurPx}px);-webkit-backdrop-filter:blur(${t.blurPx}px);` : "";
  const parts: string[] = [];
  parts.push(
    `${s} .pe-cookie-card{background:${t.surface};border-color:${t.surfaceBorder};box-shadow:${t.shadow};${blur}}`,
    `${s} .pe-cookie-card h2{color:${t.title};}`,
    `${s} .pe-cookie-card p{color:${t.body};}`,
    `${s} .pe-cookie-card .pe-cookie-foot{color:${t.muted};}`,
    `${s} .pe-cookie-policy-btn{color:${t.link};}`,
    `${s} .pe-cookie-allow{background:${t.allowBg};color:${t.allowText};border:1px solid transparent;}`,
    `${s} .pe-cookie-allow:hover{background:${t.allowHover};}`,
    `${s} .pe-cookie-close{background:${t.closeBg};color:${t.closeText};border:1px solid transparent;}`,
    `${s} .pe-cookie-close:hover{background:${t.closeHover};}`,
  );
  if (t.layout === "corner") {
    parts.push(
      `${s}{left:auto;right:1rem;bottom:1rem;width:min(24rem,calc(100vw - 2rem));}`,
      `${s} .pe-cookie-card{display:block;border:1px solid ${t.surfaceBorder};border-radius:1rem;padding:1.25rem;}`,
      `@media(max-width:639px){${s}{left:0;right:0;bottom:0;width:100%;}${s} .pe-cookie-card{border-radius:1rem 1rem 0 0;border-bottom:0;padding:1rem 1.25rem max(1rem,env(safe-area-inset-bottom));}}`,
    );
  } else if (t.layout === "floating") {
    parts.push(
      `${s}{display:flex;justify-content:center;padding:.75rem;}`,
      `${s} .pe-cookie-card{display:block;max-width:32rem;border:1px solid ${t.surfaceBorder};border-radius:1rem;padding:1rem 1.25rem;}`,
    );
  }
  return parts.join("\n");
}

/** Espaço a reservar no fim da página para o banner não tapar o último CTA. */
export function cookieBannerReserveHeight(args: {
  layout: PresellCookieLayout;
  cardWidth: number;
  cardHeight: number;
  viewportWidth: number;
}): number {
  const { layout, cardWidth, cardHeight, viewportWidth } = args;
  if (!(cardHeight > 0)) return 0;
  const fullWidth = cardWidth >= viewportWidth * 0.9;
  if (layout === "corner" && !fullWidth) return 0;
  return Math.ceil(cardHeight + (layout === "floating" ? 24 : 0));
}
