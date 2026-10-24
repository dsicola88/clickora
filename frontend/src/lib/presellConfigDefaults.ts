/** Definições opcionais da presell (painel) — alinhadas com `settings` na API. */
export type PresellConfigSettings = Record<string, string | boolean>;

export const DEFAULT_PRESELL_CONFIG_SETTINGS: PresellConfigSettings = {
  exitPopup: false,
  countdownTimer: false,
  socialProof: false,
  googleTrackingCode: "",
  googleConversionEvent: "",
  fbPixelId: "",
  fbTrackName: "",
  fbConversionApi: "disabled",
  /** Pixel TikTok Ads (só ID numérico / alfanumérico do Events Manager). */
  tiktokPixelId: "",
  /** Microsoft Advertising UET tag ID (só dígitos). */
  bingUetTagId: "",
  /**
   * Como instalar pixels de anúncios nesta presell:
   * - auto: IDs Meta / TikTok / Bing / Google → a app gera o script
   * - manual: colas o &lt;script&gt; completo (Events Manager, Google Ads, Bing, …)
   */
  adPixelsMode: "auto",
  headerCode: "",
  /** Snippet opcional (Google Ads / gtag / rede) — injeta no &lt;head&gt; da página publicada antes do restante código. */
  conversionTrackingScript: "",
  bodyCode: "",
  footerCode: "",
  customCss: "",
  /** Minutos para a barra de contagem regressiva (opcional presell). */
  countdownDurationMinutes: "15",
  /**
   * Parâmetros extra da URL da presell a copiar para o hoplink (vírgula ou espaço).
   * sub1 e sub2 são sempre considerados; sub3 fica livre para o clique da rede. Aqui só se acrescentam nomes (ex.: clickid, var1, txid).
   */
  offerQueryForwardAllowlist: "",
  /**
   * Página segura para os países em cloakGeoDeny.
   * IP, bot, proxy e rajada seguem as regras da conta e usam o mesmo texto.
   * Um browser normal fora dessas regras vê a presell completa.
   */
  enterpriseCloak: false,
  cloakSafeTitle: "",
  cloakSafeBody: "",
  /** ISO country codes separados por vírgula (ex.: CN,RU) — esses países vêem a safe page. */
  cloakGeoDeny: "",
  /** Conformidade publicitária — identidade e privacidade (não inventar dados). */
  businessName: "",
  contactEmail: "",
  privacyPolicyUrl: "",
  cookiePolicyUrl: "",
  affiliateDisclosure: "",
  /**
   * Tipo cookies: Aceitar/Fechar no modal → oferta rastreada (`/track/r/`).
   * false / ausente = só desbloqueia a review (comportamento das páginas antigas).
   */
  cookieRedirectToOffer: false,
};

/**
 * Hidrata `settings` da API → estado do painel sem perder campos (cloak, pixels, docs).
 * Sempre parte dos defaults para páginas antigas sem as chaves novas.
 */
export function hydratePresellConfigSettings(
  raw: Record<string, unknown> | null | undefined,
): PresellConfigSettings {
  const s = raw && typeof raw === "object" ? raw : {};
  const modeRaw = String(s.adPixelsMode ?? "auto").trim().toLowerCase();
  return {
    ...DEFAULT_PRESELL_CONFIG_SETTINGS,
    exitPopup: Boolean(s.exitPopup),
    countdownTimer: Boolean(s.countdownTimer),
    socialProof: Boolean(s.socialProof),
    googleTrackingCode: String(s.googleTrackingCode ?? ""),
    googleConversionEvent: String(s.googleConversionEvent ?? ""),
    fbPixelId: String(s.fbPixelId ?? ""),
    fbTrackName: String(s.fbTrackName ?? ""),
    fbConversionApi: String(s.fbConversionApi ?? "disabled"),
    tiktokPixelId: String(s.tiktokPixelId ?? ""),
    bingUetTagId: String(s.bingUetTagId ?? ""),
    adPixelsMode: modeRaw === "manual" ? "manual" : "auto",
    headerCode: String(s.headerCode ?? ""),
    conversionTrackingScript: String(s.conversionTrackingScript ?? ""),
    bodyCode: String(s.bodyCode ?? ""),
    footerCode: String(s.footerCode ?? ""),
    customCss: String(s.customCss ?? ""),
    countdownDurationMinutes: String(s.countdownDurationMinutes ?? "15"),
    offerQueryForwardAllowlist: String(s.offerQueryForwardAllowlist ?? ""),
    enterpriseCloak: Boolean(s.enterpriseCloak),
    cloakSafeTitle: String(s.cloakSafeTitle ?? ""),
    cloakSafeBody: String(s.cloakSafeBody ?? ""),
    cloakGeoDeny: String(s.cloakGeoDeny ?? ""),
    businessName: String(s.businessName ?? ""),
    contactEmail: String(s.contactEmail ?? ""),
    privacyPolicyUrl: String(s.privacyPolicyUrl ?? ""),
    cookiePolicyUrl: String(s.cookiePolicyUrl ?? ""),
    affiliateDisclosure: String(s.affiliateDisclosure ?? ""),
    cookieRedirectToOffer: Boolean(s.cookieRedirectToOffer),
    ...(typeof s.operatorDocument === "string" && s.operatorDocument.trim()
      ? { operatorDocument: s.operatorDocument }
      : {}),
  };
}
