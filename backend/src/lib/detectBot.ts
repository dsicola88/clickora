/**
 * Heurística por User-Agent — não substitui serviços anti-fraude dedicados.
 * Ordem: crawlers conhecidos → padrões genéricos (evita falsos positivos em browsers).
 */
export type BotDetection = { isBot: false } | { isBot: true; label: string };

const NAMED: { test: RegExp; label: string }[] = [
  { test: /googlebot|google-inspectiontool|adsbot-google|mediapartners-google/i, label: "Google" },
  { test: /bingbot|msnbot|adidxbot|bingpreview/i, label: "Microsoft/Bing" },
  { test: /facebookexternalhit|facebot|meta-externalagent/i, label: "Meta" },
  { test: /linkedinbot/i, label: "LinkedIn" },
  { test: /twitterbot|x\.com\/bot/i, label: "Twitter/X" },
  { test: /slackbot|discordbot|telegrambot/i, label: "Chat" },
  { test: /ahrefsbot|semrushbot|dotbot|petalbot|bytespider/i, label: "SEO/crawler" },
  { test: /headless|phantomjs|selenium|puppeteer|playwright|webdriver/i, label: "Automação" },
  { test: /lighthouse|pagespeed|gtmetrix|pingdom/i, label: "Performance" },
  { test: /curl\/|wget\/|python-requests|axios\/|go-http|java\//i, label: "HTTP client" },
];

export function detectBot(userAgent: string | undefined | null): BotDetection {
  const ua = (userAgent || "").trim();
  if (ua.length === 0) return { isBot: true, label: "Sem User-Agent" };

  for (const { test, label } of NAMED) {
    if (test.test(ua)) return { isBot: true, label };
  }

  const lower = ua.toLowerCase();
  if (/\b(bot|crawler|spider|scraper)\b/i.test(lower)) {
    return { isBot: true, label: "Bot (genérico)" };
  }

  return { isBot: false };
}
