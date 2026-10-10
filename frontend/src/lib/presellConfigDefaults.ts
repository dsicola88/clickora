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
};
