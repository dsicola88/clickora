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
   * sub1–sub3 são sempre considerados; aqui só se acrescentam nomes (ex.: clickid, var1, txid).
   */
  offerQueryForwardAllowlist: "",
};
