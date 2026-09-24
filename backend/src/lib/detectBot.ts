/**
 * Qualidade do clique: bots (UA) + sinais de VPN/proxy/datacenter.
 * Não substitui anti-fraude dedicado; reduz tráfego inválido óbvio.
 */
export type BotDetection = { isBot: false } | { isBot: true; label: string };

export type ClickQuality = {
  is_bot: boolean;
  bot_label?: string;
  /** 0–100; ≥70 = suspeito forte. */
  fraud_score: number;
  fraud_flags: string[];
  is_proxy_suspect: boolean;
};

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

function header(reqHeaders: Record<string, string | string[] | undefined>, name: string): string {
  const v = reqHeaders[name] ?? reqHeaders[name.toLowerCase()];
  if (Array.isArray(v)) return (v[0] || "").trim();
  return (v || "").trim();
}

/**
 * Sinais de proxy/VPN/datacenter a partir de headers CDN + UA.
 * Cloudflare: CF-IPCountry=XX / CF-Connecting-IP; proxies conhecidos via Via / Forwarded.
 */
export function assessClickQuality(input: {
  userAgent?: string | null;
  headers?: Record<string, string | string[] | undefined>;
  ip?: string | null;
}): ClickQuality {
  const bot = detectBot(input.userAgent);
  const flags: string[] = [];
  let score = 0;

  if (bot.isBot) {
    flags.push(`bot:${bot.label}`);
    score += 80;
  }

  const h = input.headers || {};
  const via = header(h, "via");
  const forwarded = header(h, "forwarded") || header(h, "x-forwarded-for");
  const cfCountry = header(h, "cf-ipcountry");
  const cfThreat = header(h, "cf-threat-score");
  const xReal = header(h, "x-real-ip");

  if (via && /proxy|squid|cloud|vpn/i.test(via)) {
    flags.push("via_proxy");
    score += 25;
  }
  if (forwarded.split(",").length >= 3) {
    flags.push("multi_hop_forwarded");
    score += 15;
  }
  if (cfCountry === "XX" || cfCountry === "T1") {
    flags.push("cf_tor_or_unknown");
    score += 35;
  }
  const threat = Number(cfThreat);
  if (Number.isFinite(threat) && threat >= 10) {
    flags.push(`cf_threat_${threat}`);
    score += Math.min(40, Math.round(threat));
  }

  const ua = (input.userAgent || "").trim();
  if (ua.length > 0 && ua.length < 20) {
    flags.push("ua_too_short");
    score += 20;
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ua)) {
    flags.push("ua_is_ip");
    score += 40;
  }

  /** Datacenter ASN heurística leve via hostname reverse não disponível — IP privado + headers. */
  const ip = (input.ip || xReal || "").trim();
  if (
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.64\.)/.test(ip) &&
    !/localhost|127\.0\.0\.1/.test(ip)
  ) {
    flags.push("private_ip_edge");
    score += 10;
  }

  score = Math.min(100, score);
  const is_proxy_suspect = flags.some((f) =>
    /proxy|tor|threat|multi_hop|vpn/i.test(f),
  );

  return {
    is_bot: bot.isBot,
    bot_label: bot.isBot ? bot.label : undefined,
    fraud_score: score,
    fraud_flags: flags,
    is_proxy_suspect: is_proxy_suspect || score >= 70,
  };
}
