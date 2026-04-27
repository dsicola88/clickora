/**
 * Formatação de preços do bloco «Preços» da landing (ISO 4217).
 * Mapa aproximado: moeda → locale de formatação.
 */
const CURRENCY_TO_LOCALE: Record<string, string> = {
  BRL: "pt-BR",
  EUR: "pt-PT",
  USD: "en-US",
  GBP: "en-GB",
  CHF: "de-CH",
  JPY: "ja-JP",
  CNY: "zh-CN",
  MXN: "es-MX",
  ARS: "es-AR",
  CLP: "es-CL",
  COP: "es-CO",
  PEN: "es-PE",
  UYU: "es-UY",
  PLN: "pl-PL",
  NOK: "nb-NO",
  SEK: "sv-SE",
  DKK: "da-DK",
  CAD: "en-CA",
  AUD: "en-AU",
  NZD: "en-NZ",
  ZAR: "en-ZA",
  INR: "en-IN",
  KRW: "ko-KR",
  SGD: "en-SG",
  HUF: "hu-HU",
  CZK: "cs-CZ",
  RON: "ro-RO",
  BGN: "bg-BG",
  HRK: "hr-HR",
  TRY: "tr-TR",
  ILS: "he-IL",
  AED: "ar-AE",
  SAR: "ar-SA",
  TWD: "zh-TW",
  HKD: "zh-HK",
  MOP: "zh-MO",
  PHP: "en-PH",
  THB: "th-TH",
  VND: "vi-VN",
  IDR: "id-ID",
  MYR: "ms-MY",
};

export const LANDING_CURRENCY_CHOICES: Array<{ value: string; label: string }> = [
  { value: "BRL", label: "BRL — Real" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "USD", label: "USD — Dólar (US)" },
  { value: "GBP", label: "GBP — Libra" },
  { value: "CHF", label: "CHF — Franco suíço" },
  { value: "PLN", label: "PLN — Zlóty" },
  { value: "NOK", label: "NOK — Coroa norueguesa" },
  { value: "SEK", label: "SEK — Coroa sueca" },
  { value: "DKK", label: "DKK — Coroa dinamarquesa" },
  { value: "MXN", label: "MXN — Peso mexicano" },
  { value: "ARS", label: "ARS — Peso argentino" },
  { value: "CLP", label: "CLP — Peso chileno" },
  { value: "COP", label: "COP — Peso colombiano" },
  { value: "PEN", label: "PEN — Sol peruano" },
  { value: "CAD", label: "CAD — Dólar canadense" },
  { value: "AUD", label: "AUD — Dólar australiano" },
  { value: "JPY", label: "JPY — Iene" },
];

export function normalizeCurrencyCode(input: string | undefined | null): string {
  const c = String(input ?? "BRL")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  if (c.length === 3) return c;
  return "BRL";
}

export function formatLandingCurrency(amount: number, currencyCode: string | undefined | null): string {
  const cur = normalizeCurrencyCode(currencyCode);
  const loc = CURRENCY_TO_LOCALE[cur] ?? "en-US";
  try {
    return new Intl.NumberFormat(loc, { style: "currency", currency: cur }).format(amount);
  } catch {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  }
}
