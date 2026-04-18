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
  bodyCode: "",
  footerCode: "",
  customCss: "",
};
