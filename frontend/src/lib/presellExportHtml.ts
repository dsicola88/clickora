import { buildExportDocumentTitle } from "@/lib/publicPresellDocumentTitle";
import { resolveApiUrl } from "@/lib/apiOrigin";
import { resolveVideoEmbedSrc } from "@/lib/youtubeEmbed";
import type { Presell } from "@/types/api";
import {
  getInteractiveGateKind,
  getPresellGateKind,
  isDiscountPresellType,
  isGhostPresellType,
  isVideoPresellType,
  isVslOnlyPresellType,
  type InteractivePresellGateKind,
} from "@/lib/presellTypeMeta";
import {
  getPresellUiStrings,
  htmlLangForLocale,
  isRtlLocale,
  normalizePresellLocale,
} from "@/lib/presellUiStrings";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/\n/g, "&#10;");
}

function looksLikeSectionHeading(block: string): boolean {
  const t = block.trim();
  if (/^#{2,3}\s/.test(t)) return true;
  if (t.includes("\n")) return false;
  if (t.endsWith(".") || t.endsWith("!") || t.endsWith("?")) return false;
  if (t.length < 28 || t.length > 130) return false;
  const words = t.split(/\s+/).filter(Boolean).length;
  return words >= 4 && words <= 14;
}

function isEmbedPlayerVideoUrl(url: string): boolean {
  const u = url.toLowerCase();
  if (/\.(mp4|webm|ogg)(\?|#|$)/i.test(u)) return false;
  return (
    /youtube\.com|youtu\.be|youtube-nocookie/.test(u) ||
    /vimeo\.com|player\.vimeo/.test(u) ||
    /wistia\.|wi\.st|fast\.wistia/.test(u) ||
    /loom\.com\/embed/.test(u) ||
    /dailymotion\.com|dai\.ly/.test(u) ||
    /cloudflarestream|videodelivery\.net/.test(u) ||
    /brightcove|jwplatform/.test(u)
  );
}

/** URL de clique com rastreamento (medium html_export). */
function buildPresellTrackClickUrl(apiBase: string, pageId: string, affiliateLink: string): string {
  const toUrl = affiliateLink.trim();
  const clickUrl = resolveApiUrl(apiBase, `/track/r/${pageId}`);
  clickUrl.searchParams.set("to", toUrl);
  clickUrl.searchParams.set("source", "direct");
  clickUrl.searchParams.set("medium", "html_export");
  clickUrl.searchParams.set("campaign", "");
  clickUrl.searchParams.set("referrer", "");
  return clickUrl.toString();
}

function blockToHtml(block: string): string {
  const t = block.trim();
  if (looksLikeSectionHeading(t)) {
    const clean = escapeHtml(t.replace(/^#{2,3}\s*/, ""));
    return `<h3 class="pe-h3">${clean}</h3>`;
  }
  return `<p class="pe-p">${escapeHtml(t).replace(/\n/g, "<br>")}</p>`;
}

/** Estilos alinhados a PublicPresell + PresellCta (gradient-primary / hero VSL). */
const EXPORT_STYLES = `
.pe-root.pe-presell-export{font-family:'Plus Jakarta Sans',system-ui,-apple-system,sans-serif;line-height:1.6;color:#0f172a;background:#fafafa;margin:0;padding:0;box-sizing:border-box;}
.pe-root.pe-presell-export *,.pe-root.pe-presell-export *::before,.pe-root.pe-presell-export *::after{box-sizing:border-box;}
.pe-minh{min-height:100vh;padding-bottom:3rem;}
.pe-cta-wrap{display:flex;width:100%;justify-content:center;padding-left:.5rem;padding-right:.5rem;}
.pe-cta{display:inline-flex;max-width:min(100%,22rem);width:100%;min-height:3.25rem;align-items:center;justify-content:center;gap:.65rem;border-radius:1rem;padding:.875rem 2.5rem;text-align:center;font-size:clamp(.95rem,2.5vw,1.25rem);font-weight:800;line-height:1.25;letter-spacing:-.02em;text-decoration:none;transition:transform .2s,filter .2s;box-shadow:0 10px 40px -10px rgba(20,184,166,.55),inset 0 0 0 1px rgba(255,255,255,.12);border:2px solid rgba(20,184,166,.2);}
.pe-cta--light{background:linear-gradient(135deg,hsl(172,66%,38%),hsl(28,92%,48%));color:#fff;}
.pe-cta--light:hover{filter:brightness(1.08);transform:translateY(-2px);}
.pe-cta--dark{background:linear-gradient(to right,#fbbf24,#f97316,#f43f5e);color:#fff;border-color:rgba(255,255,255,.3);box-shadow:0 12px 44px -10px rgba(251,146,60,.55),inset 0 0 0 1px rgba(255,255,255,.2);}
.pe-cta--dark:hover{filter:brightness(1.06);transform:translateY(-2px);}
.pe-cta--disabled{opacity:.58;pointer-events:none;filter:grayscale(.3);cursor:not-allowed;transform:none!important;}
.pe-cta svg{flex-shrink:0;width:1.25rem;height:1.25rem;opacity:.95;}
.pe-hero-vsl{background:linear-gradient(180deg,#020617 0%,#0f172a 45%,#f8fafc 100%);color:#f8fafc;border-bottom:1px solid rgba(255,255,255,.08);}
.pe-hero-light{background:linear-gradient(180deg,#ede9fe 0%,#faf5ff 50%,#ffffff 100%);color:#0f172a;border-bottom:1px solid rgba(0,0,0,.06);}
.pe-hero-inner{max-width:min(100%,72rem);margin:0 auto;padding:2rem .75rem 2.5rem;text-align:center;}
@media(min-width:640px){.pe-hero-inner{padding:2.5rem 1rem 3.5rem;}}
.pe-h1{font-size:clamp(1.5rem,4vw,2.65rem);font-weight:800;line-height:1.12;margin:0 0 .75rem;letter-spacing:-.02em;}
.pe-h1--vsl{color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.2);}
.pe-sub{font-size:clamp(1rem,2.5vw,1.25rem);font-weight:500;line-height:1.375;margin:0 0 1.25rem;}
.pe-sub--vsl{color:#e2e8f0;}
.pe-img-card{max-width:42rem;margin:0 auto 1.25rem;padding:1rem;background:rgba(255,255,255,.6);border-radius:1rem;border:1px solid rgba(0,0,0,.08);}
.pe-img-card img{width:100%;max-height:min(420px,55vh);object-fit:contain;border-radius:.5rem;display:block;}
.pe-video{position:relative;width:100%;max-width:min(1200px,96vw);margin:1rem auto;aspect-ratio:16/9;background:#000;border-radius:.75rem;overflow:hidden;border:1px solid rgba(255,255,255,.1);box-shadow:0 20px 50px -15px rgba(0,0,0,.4);}
.pe-video--inline{max-width:48rem;margin-top:1rem;border:1px solid rgba(0,0,0,.1);}
.pe-video iframe,.pe-video video{position:absolute;inset:0;width:100%;height:100%;border:0;}
.pe-vsl-fb{position:relative;width:100%;max-width:min(1200px,96vw);margin:0 auto;aspect-ratio:16/9;border-radius:.5rem;overflow:hidden;box-shadow:0 20px 50px -15px rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.1);background:#000;}
.pe-vsl-slide{position:absolute;inset:0;transition:opacity 1.2s ease-in-out;}
.pe-vsl-slide.is-on{opacity:1;z-index:1;}
.pe-vsl-slide.is-off{opacity:0;z-index:0;}
.pe-vsl-slide img{width:100%;height:100%;object-fit:cover;}
.pe-vsl-grad{position:absolute;inset:0;z-index:2;background:linear-gradient(to top,rgba(0,0,0,.9),rgba(0,0,0,.45),rgba(0,0,0,.3));pointer-events:none;}
.pe-vsl-content{position:absolute;inset:0;z-index:3;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:2rem 1.25rem;}
.pe-vsl-badge{display:inline-flex;align-items:center;gap:.5rem;border-radius:9999px;background:rgba(255,255,255,.15);padding:.25rem .75rem;font-size:.7rem;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:rgba(255,255,255,.95);margin-bottom:.75rem;}
.pe-vsl-content h2{font-size:clamp(1.15rem,3vw,1.75rem);font-weight:800;color:#fff;line-height:1.2;max-width:42rem;margin:0;text-shadow:0 2px 8px rgba(0,0,0,.4);}
.pe-vsl-content .pe-vsl-sub{margin-top:.75rem;font-size:clamp(.875rem,2vw,1rem);color:rgba(255,255,255,.92);max-width:36rem;line-height:1.5;}
.pe-vsl-content .pe-vsl-ex{margin-top:1rem;font-size:.8rem;color:rgba(255,255,255,.8);max-width:32rem;line-height:1.6;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden;}
.pe-gallery{max-width:64rem;margin:0 auto;padding:2.5rem 1rem;display:grid;grid-template-columns:1fr;gap:1rem;}
@media(min-width:640px){.pe-gallery{grid-template-columns:1fr 1fr;}}
.pe-gallery > div{border-radius:.75rem;overflow:hidden;border:1px solid rgba(0,0,0,.08);background:rgba(245,245,245,.5);box-shadow:0 1px 3px rgba(0,0,0,.06);}
.pe-gallery img{width:100%;max-height:20rem;object-fit:cover;display:block;}
.pe-letter{max-width:48rem;margin:0 auto;padding:2rem 1rem;}
.pe-letter-box{border-radius:1rem;border:1px solid rgba(0,0,0,.1);background:rgba(255,255,255,.55);padding:2rem 1.25rem;}
@media(min-width:768px){.pe-letter-box{padding:2.5rem 2.5rem;}}
.pe-h3{font-size:clamp(1.15rem,2.5vw,1.5rem);font-weight:700;margin:1.25rem 0 .75rem;padding-bottom:.5rem;border-bottom:1px solid rgba(0,0,0,.08);color:#0f172a;}
.pe-p{font-size:1.02rem;line-height:1.75;margin:0 0 1rem;color:#334155;}
.pe-mid-wrap{margin:1.5rem 0;border-radius:1rem;border:1px solid rgba(0,0,0,.1);background:linear-gradient(180deg,#f4f4f5,#fafafa);padding:1.75rem;text-align:center;box-shadow:inset 0 2px 12px rgba(0,0,0,.04);}
.pe-mid-wrap p{font-size:.95rem;font-weight:500;color:#0f172ae6;margin:0 0 .75rem;line-height:1.6;}
.pe-footer-sec{max-width:48rem;margin:0 auto;padding:1.5rem .75rem 3rem;}
.pe-footer-box{border-radius:1rem;border:1px solid rgba(0,0,0,.1);background:rgba(255,255,255,.5);backdrop-filter:blur(2px);padding:2rem 1.25rem;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.05);}
.pe-footnote{font-size:.8rem;color:#64748b;margin:.75rem auto 0;max-width:28rem;line-height:1.6;}
.pe-gate-box{width:100%;max-width:32rem;margin:0 auto 1.5rem;padding:1.25rem;border-radius:.75rem;border:1px solid rgba(0,0,0,.1);background:rgba(255,255,255,.8);text-align:left;box-shadow:0 1px 2px rgba(0,0,0,.04);}
.pe-gate-box > p:first-child{font-size:.875rem;font-weight:600;margin:0 0 1rem;}
.pe-gate-box label{display:block;font-size:.875rem;margin-bottom:.35rem;}
.pe-gate-box input[type="number"],.pe-gate-box select{width:100%;max-width:200px;padding:.5rem .65rem;border-radius:.375rem;border:1px solid #e2e8f0;font:inherit;}
.pe-gate-box .pe-radio-row{display:flex;align-items:center;gap:.5rem;margin:.35rem 0;}
.pe-gate-box .pe-hint{font-size:.75rem;color:#64748b;margin-top:.35rem;}
.pe-cookie-overlay{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:1rem;}
.pe-cookie-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(2px);border:0;cursor:pointer;}
.pe-cookie-card{position:relative;z-index:10;max-width:28rem;width:100%;border-radius:1rem;border:1px solid rgba(0,0,0,.1);background:#fff;padding:1.5rem;box-shadow:0 25px 50px -12px rgba(0,0,0,.25);}
.pe-cookie-card h2{font-size:1.25rem;font-weight:700;margin:0 0 1rem;}
.pe-cookie-card p{font-size:.875rem;line-height:1.6;color:#64748b;margin:0 0 .75rem;}
.pe-cookie-actions{display:flex;flex-direction:column-reverse;gap:.75rem;margin-top:1.5rem;}
@media(min-width:640px){.pe-cookie-actions{flex-direction:row;}}
.pe-cookie-actions button{flex:1;padding:.65rem 1rem;border-radius:.5rem;font-weight:600;cursor:pointer;font:inherit;}
.pe-cookie-close{background:#fff;border:1px solid #e2e8f0;}
.pe-cookie-allow{background:#059669;color:#fff;border:0;}
.pe-discount-bar{position:fixed;top:0;left:0;right:0;z-index:60;background:#e91e8c;color:#fff;text-align:center;padding:.65rem .75rem;box-shadow:0 4px 12px rgba(0,0,0,.12);}
.pe-discount-bar .pe-timer{font-size:1.5rem;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-.02em;}
.pe-discount-bar p{font-size:.75rem;opacity:.95;max-width:32rem;margin:.35rem auto 0;line-height:1.35;}
.pe-discount-offset{padding-top:5.25rem;}
.pe-discount-modal-wrap{position:fixed;inset:0;z-index:55;display:flex;align-items:center;justify-content:center;padding:1rem;background:rgba(0,0,0,.55);backdrop-filter:blur(2px);}
.pe-discount-modal-wrap .pe-modal-bg-btn{position:absolute;inset:0;border:0;background:transparent;cursor:pointer;}
.pe-discount-card{position:relative;z-index:10;width:100%;max-width:28rem;border-radius:1rem;background:#eceff1;border:1px solid rgba(255,255,255,.4);padding:2rem 1.5rem;box-shadow:0 25px 50px -12px rgba(0,0,0,.25);}
.pe-discount-card .pe-close-x{position:absolute;top:.75rem;right:.75rem;width:2rem;height:2rem;border-radius:9999px;border:0;background:transparent;cursor:pointer;color:#64748b;font-size:1.25rem;line-height:1;}
.pe-discount-card h2{font-size:clamp(1.25rem,3vw,1.65rem);font-weight:800;text-align:center;margin:0 0 1rem;color:#0f172a;}
.pe-discount-card .pe-soc{font-size:.875rem;text-align:center;color:#0f172a;margin:0 0 .5rem;line-height:1.5;}
.pe-discount-rating{text-align:center;margin:.5rem 0;}
.pe-discount-rating .pe-num{font-size:1.875rem;font-weight:700;}
.pe-discount-rating .pe-stars{color:#ffc107;font-size:1.75rem;letter-spacing:2px;}
`;

const ARROW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`;

function ctaHtml(href: string, label: string, surface: "light" | "dark", opts: { disabled?: boolean }): string {
  const cls = `pe-cta pe-cta--${surface}${opts.disabled ? " pe-cta--disabled" : ""}`;
  const h = opts.disabled ? "#" : escapeAttr(href);
  return `<div class="pe-cta-wrap"><a class="${cls}" href="${h}" rel="noopener noreferrer">${escapeHtml(label)}${ARROW_SVG}</a></div>`;
}

function presentationLabel(language: string): string {
  return getPresellUiStrings(language).presentationLabel;
}

function cookieTexts(language: string) {
  const L = getPresellUiStrings(language);
  return {
    title: L.cookieTitle,
    body: L.cookieBody,
    policy: L.cookiePolicy,
    close: L.cookieClose,
    allow: L.cookieAllow,
    footer: L.cookieFooter,
  };
}

function gateTexts(language: string) {
  const L = getPresellUiStrings(language);
  return {
    before: L.beforeContinue,
    age: L.ageLabel,
    ageHint: (min: number) => L.ageInvalid.replace("{min}", String(min)),
    sex: L.sexLabel,
    m: L.sexM,
    f: L.sexF,
    o: L.sexO,
    group: L.groupLabel,
    country: L.countryLabel,
    captcha: L.captchaLabel,
    model: L.modelLabel,
  };
}

const AGE_GROUPS = ["18–24", "25–34", "35–44", "45–54", "55+"];
const COUNTRIES: { code: string; name: string }[] = [
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
function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function buildInteractiveGateHtml(
  kind: InteractivePresellGateKind,
  language: string,
  settings: Record<string, unknown>,
): string {
  const L = gateTexts(language);
  const minAge = num(settings.minAge, 18);
  const parts: string[] = [`<div class="pe-gate-box"><p>${escapeHtml(L.before)}</p>`];

  if (kind === "age") {
    parts.push(
      `<label for="pe-gate-age">${escapeHtml(L.age)}</label>`,
      `<input type="number" id="pe-gate-age" inputmode="numeric" min="${minAge}" max="120" placeholder="18+" />`,
      `<p class="pe-hint">${escapeHtml(L.ageHint(minAge))}</p>`,
    );
  } else if (kind === "sex") {
    parts.push(`<span class="label-like">${escapeHtml(L.sex)}</span>`);
    for (const [val, lab] of [
      ["m", L.m],
      ["f", L.f],
      ["o", L.o],
    ] as const) {
      parts.push(
        `<div class="pe-radio-row"><input type="radio" name="pe-sex" id="pe-sex-${val}" value="${val}" /> <label for="pe-sex-${val}">${escapeHtml(lab)}</label></div>`,
      );
    }
  } else if (kind === "age_group_m" || kind === "age_group_f") {
    parts.push(`<label for="pe-gate-group">${escapeHtml(L.group)}</label>`);
    parts.push(`<select id="pe-gate-group"><option value="">—</option>${AGE_GROUPS.map((g) => `<option value="${escapeAttr(g)}">${escapeHtml(g)}</option>`).join("")}</select>`);
  } else if (kind === "country") {
    parts.push(`<label for="pe-gate-country">${escapeHtml(L.country)}</label>`);
    parts.push(
      `<select id="pe-gate-country"><option value="">—</option>${COUNTRIES.map((c) => `<option value="${escapeAttr(c.code)}">${escapeHtml(c.name)}</option>`).join("")}</select>`,
    );
  } else if (kind === "captcha") {
    parts.push(
      `<div class="pe-radio-row"><input type="checkbox" id="pe-gate-human" /> <label for="pe-gate-human">${escapeHtml(L.captcha)}</label></div>`,
    );
  } else if (kind === "models") {
    const U = getPresellUiStrings(language);
    const modelOpts = [
      { id: "a", label: U.modelA },
      { id: "b", label: U.modelB },
      { id: "c", label: U.modelC },
    ];
    parts.push(`<label for="pe-gate-model">${escapeHtml(L.model)}</label>`);
    parts.push(
      `<select id="pe-gate-model"><option value="">—</option>${modelOpts.map((m) => `<option value="${escapeAttr(m.id)}">${escapeHtml(m.label)}</option>`).join("")}</select>`,
    );
  }

  parts.push(`</div>`);
  return parts.join("");
}

function buildCookieModalHtml(language: string, policyUrl: string, href: string): string {
  const L = cookieTexts(language);
  const policyLink = policyUrl.trim()
    ? `<a href="${escapeAttr(policyUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:.5rem;font-size:.875rem;font-weight:600;color:#0d9488;">${escapeHtml(L.policy)}</a>`
    : "";
  return `<div class="pe-cookie-overlay" id="pe-cookie-overlay">
<button type="button" class="pe-cookie-backdrop" id="pe-cookie-backdrop" aria-label="${escapeAttr(L.close)}"></button>
<div class="pe-cookie-card">
<h2>${escapeHtml(L.title)}</h2>
<p>${escapeHtml(L.body)}</p>
${policyLink}
<div class="pe-cookie-actions">
<button type="button" class="pe-cookie-close" id="pe-cookie-close">${escapeHtml(L.close)}</button>
<button type="button" class="pe-cookie-allow" id="pe-cookie-allow">${escapeHtml(L.allow)}</button>
</div>
<p style="text-align:center;font-size:.75rem;color:#64748b;margin-top:1rem;">${escapeHtml(L.footer)}</p>
</div>
</div>
<script>
(function(){
var go=${JSON.stringify(href)};
function g(){if(go)location.href=go;}
var o=document.getElementById("pe-cookie-overlay");
var b=document.getElementById("pe-cookie-backdrop");
var c=document.getElementById("pe-cookie-close");
var a=document.getElementById("pe-cookie-allow");
if(b)b.addEventListener("click",g);
if(c)c.addEventListener("click",g);
if(a)a.addEventListener("click",g);
})();
</script>`;
}

function buildVslFallbackHtml(
  images: string[],
  title: string,
  subtitle: string,
  excerpt: string,
  language: string,
): string {
  const slides = images.length > 0 ? images : [""];
  const badge = presentationLabel(language);
  const slideHtml = slides
    .map((src, i) => {
      const inner = src
        ? `<img src="${escapeAttr(src)}" alt="" loading="${i === 0 ? "eager" : "lazy"}" />`
        : `<div style="width:100%;height:100%;background:linear-gradient(to bottom right,#4c1d95,#6d28d9,#7c3aed);"></div>`;
      return `<div class="pe-vsl-slide ${i === 0 ? "is-on" : "is-off"}" data-pe-slide="${i}">${inner}</div>`;
    })
    .join("");
  const playSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>`;
  return `<div class="pe-vsl-fb" id="pe-vsl-fb">${slideHtml}<div class="pe-vsl-grad"></div><div class="pe-vsl-content">
<div class="pe-vsl-badge">${playSvg} ${escapeHtml(badge)}</div>
<h2>${escapeHtml(title)}</h2>
${subtitle ? `<p class="pe-vsl-sub">${escapeHtml(subtitle)}</p>` : ""}
${excerpt ? `<p class="pe-vsl-ex">${escapeHtml(excerpt)}</p>` : ""}
</div></div>
${slides.length > 1 ? `<script>(function(){var root=document.getElementById("pe-vsl-fb");if(!root)return;var slides=root.querySelectorAll(".pe-vsl-slide");var n=slides.length;var i=0;setInterval(function(){slides[i].classList.remove("is-on");slides[i].classList.add("is-off");i=(i+1)%n;slides[i].classList.remove("is-off");slides[i].classList.add("is-on");},6000);})();</script>` : ""}`;
}

function buildDiscountModalHtml(
  language: string,
  headline: string,
  socialProof: string,
  ratingValue: string,
  ratingStars: number,
  ctaText: string,
  href: string,
): string {
  const stars = Math.min(5, Math.max(1, Math.round(ratingStars || 5)));
  const starStr = "★".repeat(stars);
  return `<div class="pe-discount-modal-wrap" id="pe-discount-modal">
<button type="button" class="pe-modal-bg-btn" id="pe-discount-bg" aria-label="Continue"></button>
<div class="pe-discount-card">
<a href="${escapeAttr(href)}" class="pe-close-x" aria-label="Fechar" style="display:flex;align-items:center;justify-content:center;text-decoration:none;">×</a>
<h2>${escapeHtml(headline)}</h2>
<p class="pe-soc">${escapeHtml(socialProof)}</p>
<div class="pe-discount-rating"><div class="pe-num">${escapeHtml(ratingValue)}</div><div class="pe-stars" aria-hidden="true">${escapeHtml(starStr)}</div></div>
<div style="margin-top:.5rem;">${ctaHtml(href, ctaText, "light", {})}</div>
</div>
</div>
<script>
(function(){
var h=${JSON.stringify(href)};
var bg=document.getElementById("pe-discount-bg");
if(bg)bg.addEventListener("click",function(){if(h)location.href=h;});
})();</script>`;
}

function buildDiscountBarHtml(initialSeconds: number, language: string): string {
  const mm = Math.floor(Math.max(0, initialSeconds) / 60);
  const ss = Math.max(0, initialSeconds) % 60;
  const label = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  const urg = getPresellUiStrings(language).discountUrgency;
  return `<div class="pe-discount-bar"><div class="pe-timer" id="pe-discount-timer">${escapeHtml(label)}</div><p>${escapeHtml(urg)}</p></div>
<script>
(function(){
var el=document.getElementById("pe-discount-timer");
var s=${Math.max(0, Math.floor(initialSeconds))};
function tick(){if(s<=0)return;s--;var m=Math.floor(s/60);var r=s%60;el.textContent=String(m).padStart(2,"0")+":"+String(r).padStart(2,"0");}
setInterval(tick,1000);
})();</script>`;
}

function buildGateScript(kind: InteractivePresellGateKind | null, settings: Record<string, unknown>, href: string): string {
  if (!kind) return "";
  const minAge = num(settings.minAge, 18);
  const hJs = JSON.stringify(href);
  const setCtas = `function peSetCtas(ok){var r=document.querySelector("[data-pe-presell-root]");if(!r)return;r.querySelectorAll("a.pe-cta").forEach(function(a){a.href=ok?${hJs}:"#";a.classList.toggle("pe-cta--disabled",!ok);});}`;
  const body = (() => {
    switch (kind) {
      case "age":
        return `${setCtas}var i=document.getElementById("pe-gate-age");function u(){var v=parseInt(i&&i.value,10);var ok=Number.isFinite(v)&&v>=${minAge};peSetCtas(ok);}if(i){i.addEventListener("input",u);u();}`;
      case "sex":
        return `${setCtas}function u(){var c=document.querySelector('input[name="pe-sex"]:checked');var ok=c&&c.value;peSetCtas(!!ok);}document.querySelectorAll('input[name="pe-sex"]').forEach(function(r){r.addEventListener("change",u);});u();`;
      case "age_group_m":
      case "age_group_f":
        return `${setCtas}var s=document.getElementById("pe-gate-group");function u(){var ok=s&&s.value;peSetCtas(!!ok);}if(s){s.addEventListener("change",u);u();}`;
      case "country":
        return `${setCtas}var s=document.getElementById("pe-gate-country");function u(){var ok=s&&s.value;peSetCtas(!!ok);}if(s){s.addEventListener("change",u);u();}`;
      case "captcha":
        return `${setCtas}var c=document.getElementById("pe-gate-human");function u(){var ok=c&&c.checked;peSetCtas(!!ok);}if(c){c.addEventListener("change",u);u();}`;
      case "models":
        return `${setCtas}var s=document.getElementById("pe-gate-model");function u(){var ok=s&&s.value;peSetCtas(!!ok);}if(s){s.addEventListener("change",u);u();}`;
      default:
        return "";
    }
  })();
  if (!body) return "";
  return `<script>(function(){${body}})();</script>`;
}

export type PresellExportFormat = "document" | "elementor";

export type PresellExportOptions = {
  apiBase: string;
  publicPageUrl: string;
  /** `elementor` = &lt;style&gt; + fragment + scripts (colar no widget HTML). `document` = página completa. */
  format?: PresellExportFormat;
};

/**
 * HTML alinhado à página pública (`PublicPresell`): layout, CTA, desconto, VSL fallback, cookies, gates.
 */
export function buildPresellStandaloneHtml(page: Presell, opts: PresellExportOptions): string {
  const format: PresellExportFormat = opts.format ?? "elementor";
  const content = (page.content || {}) as Record<string, unknown>;
  const settings = (page.settings || {}) as Record<string, unknown>;
  const affiliateLink = (content.affiliateLink as string) || "#";
  const href = buildPresellTrackClickUrl(opts.apiBase, page.id, affiliateLink);

  const title = (content.title as string) || page.title;
  const subtitle = (content.subtitle as string) || "";
  const salesText = (content.salesText as string) || "";
  const ctaText = (content.ctaText as string) || "Quero Aproveitar Agora";
  const productImages = Array.isArray(content.productImages)
    ? (content.productImages as string[]).filter((u) => typeof u === "string" && u.length > 0)
    : [];

  const cookiePolicyUrl = typeof settings.cookiePolicyUrl === "string" ? settings.cookiePolicyUrl : "";
  const customCss = typeof settings.customCss === "string" ? settings.customCss.trim() : "";
  const headerCode = typeof settings.headerCode === "string" ? settings.headerCode.trim() : "";
  const bodyCode = typeof settings.bodyCode === "string" ? settings.bodyCode.trim() : "";
  const footerCode = typeof settings.footerCode === "string" ? settings.footerCode.trim() : "";

  const heroImage = productImages[0];
  const galleryImages = productImages.slice(1, 10);
  const textBlocks = salesText
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  const vslExcerpt = (() => {
    const first = textBlocks[0] || "";
    if (!first) return "";
    return first.length > 300 ? `${first.slice(0, 297)}…` : first;
  })();

  const videoEmbedSrc = page.video_url ? resolveVideoEmbedSrc(page.video_url) : "";
  const showVideo = isVideoPresellType(page.type) && !!page.video_url;
  const showVslFallback = isVideoPresellType(page.type) && !page.video_url;
  const hideHeroImageForVslFallback = showVslFallback;
  const isVslLayout = isVideoPresellType(page.type);
  const showSalesLetterSection = textBlocks.length > 0 && !isVslOnlyPresellType(page.type);

  const isDiscount = isDiscountPresellType(page.type);
  const discountHeadline = (content.discountHeadline as string) || title;
  const socialProofLineRaw = typeof content.socialProofLine === "string" ? content.socialProofLine : "";
  const socialProofDisplay = socialProofLineRaw.trim()
    ? socialProofLineRaw
    : getPresellUiStrings(page.language).discountSocial;
  const ratingValue = typeof content.ratingValue === "string" ? content.ratingValue : "4.9";
  const ratingStars = typeof content.ratingStars === "number" ? content.ratingStars : 5;
  const urgencyTimerSeconds =
    typeof content.urgencyTimerSeconds === "number" ? content.urgencyTimerSeconds : 649;

  const gateKind = getPresellGateKind(page.type);
  const interactiveKind = getInteractiveGateKind(page.type);
  const isGhost = isGhostPresellType(page.type);

  const gateForCta = interactiveKind;
  const firstHeroCtaDisabled = !!gateForCta;

  const heroClass = isVslLayout ? "pe-hero-vsl" : "pe-hero-light";

  const heroInner: string[] = [];

  if (interactiveKind) {
    heroInner.push(buildInteractiveGateHtml(interactiveKind, page.language, settings));
  }

  if (heroImage && !hideHeroImageForVslFallback) {
    heroInner.push(`<div class="pe-img-card"><img src="${escapeAttr(heroImage)}" alt="" loading="eager" decoding="async" /></div>`);
  }

  heroInner.push(`<h1 class="pe-h1 ${isVslLayout ? "pe-h1--vsl" : ""}">${escapeHtml(title)}</h1>`);
  if (subtitle) {
    heroInner.push(`<p class="pe-sub ${isVslLayout ? "pe-sub--vsl" : ""}">${escapeHtml(subtitle)}</p>`);
  }

  if (isVslLayout) {
    if (showVideo && videoEmbedSrc) {
      heroInner.push(`<div class="pe-video">`);
      if (isEmbedPlayerVideoUrl(videoEmbedSrc)) {
        heroInner.push(
          `<iframe title="Vídeo" src="${escapeAttr(videoEmbedSrc)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin"></iframe>`,
        );
      } else {
        heroInner.push(
          `<video title="Vídeo" src="${escapeAttr(videoEmbedSrc)}" controls playsinline preload="metadata"></video>`,
        );
      }
      heroInner.push(`</div>`);
    } else if (showVslFallback) {
      heroInner.push(buildVslFallbackHtml(productImages, title, subtitle, vslExcerpt, page.language));
    }
    heroInner.push(ctaHtml(href, ctaText, "dark", { disabled: firstHeroCtaDisabled }));
  } else {
    heroInner.push(ctaHtml(href, ctaText, "light", { disabled: firstHeroCtaDisabled }));
    if (showVideo && videoEmbedSrc) {
      heroInner.push(`<div class="pe-video pe-video--inline">`);
      if (isEmbedPlayerVideoUrl(videoEmbedSrc)) {
        heroInner.push(
          `<iframe title="Vídeo" src="${escapeAttr(videoEmbedSrc)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin"></iframe>`,
        );
      } else {
        heroInner.push(
          `<video title="Vídeo" src="${escapeAttr(videoEmbedSrc)}" controls playsinline preload="metadata"></video>`,
        );
      }
      heroInner.push(`</div>`);
    }
  }

  const heroSection = `<section class="${heroClass}"><div class="pe-hero-inner">${heroInner.join("\n")}</div></section>`;

  let gallerySection = "";
  if (galleryImages.length > 0 && !showVslFallback) {
    gallerySection = `<section class="pe-gallery">${galleryImages.map((src) => `<div><img src="${escapeAttr(src)}" alt="" loading="lazy" decoding="async" /></div>`).join("")}</section>`;
  }

  let salesSection = "";
  if (showSalesLetterSection) {
    const mid = Math.max(4, Math.min(Math.floor(textBlocks.length / 2), 12));
    const first = textBlocks.slice(0, mid);
    const rest = textBlocks.slice(mid);
    const letterParts: string[] = [`<section class="pe-letter"><div class="pe-letter-box">`];
    for (const b of first) letterParts.push(blockToHtml(b));
    if (rest.length > 0) {
      letterParts.push(
        `<div class="pe-mid-wrap"><p>${escapeHtml(getPresellUiStrings(page.language).midCta)}</p>${ctaHtml(href, ctaText, "light", { disabled: !!gateForCta })}</div>`,
      );
      for (const b of rest) letterParts.push(blockToHtml(b));
    }
    letterParts.push(`</div></section>`);
    salesSection = letterParts.join("\n");
  }

  const footerSection = `<section class="pe-footer-sec"><div class="pe-footer-box">${ctaHtml(href, ctaText, "light", { disabled: !!gateForCta })}<p class="pe-footnote">${escapeHtml(getPresellUiStrings(page.language).footerNote)}</p></div></section>`;

  let core = "";
  if (gateKind === "cookies") {
    core += buildCookieModalHtml(page.language, cookiePolicyUrl, href);
  }

  core += heroSection + gallerySection + salesSection + footerSection;

  if (isDiscount) {
    core =
      buildDiscountBarHtml(urgencyTimerSeconds, page.language) +
      `<div class="pe-discount-offset">` +
      core +
      `</div>` +
      buildDiscountModalHtml(
        page.language,
        discountHeadline,
        socialProofDisplay,
        ratingValue,
        ratingStars,
        ctaText,
        href,
      );
  }

  const gateScript = buildGateScript(gateForCta, settings, href);
  const ghostScript = isGhost
    ? `<script>(function(){var u=${JSON.stringify(href)};var d=0;function go(){if(d)return;d=1;if(u)location.href=u;}["mousemove","touchstart","touchmove","scroll","wheel","pointermove"].forEach(function(ev){window.addEventListener(ev,go,{passive:true});});})();</script>`
    : "";

  const inner =
    `<!-- Presell Clickora — mesmo layout que a página pública. Link: ${escapeHtml(opts.publicPageUrl)} -->
<div class="pe-root pe-presell-export pe-minh" data-pe-presell-root="true">` +
    core +
    gateScript +
    ghostScript +
    `</div>`;

  const fontLink = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,600;0,700;0,800;1,400&display=swap" rel="stylesheet">`;

  const styleBlock = `<style>${EXPORT_STYLES}${customCss ? `\n/* CSS personalizado */\n${customCss}` : ""}</style>`;

  if (format === "elementor") {
    return `${fontLink}
${styleBlock}
${headerCode ? `${headerCode}\n` : ""}
${bodyCode ? `<div data-presell-inject="body-start" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">${bodyCode}</div>\n` : ""}
${inner}
${footerCode ? `${footerCode}\n` : ""}`;
  }

  const loc = normalizePresellLocale(page.language);
  const htmlLang = htmlLangForLocale(loc);
  const htmlDir = isRtlLocale(loc) ? "rtl" : "ltr";

  return `<!DOCTYPE html>
<html lang="${escapeAttr(htmlLang)}" dir="${escapeAttr(htmlDir)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Clickora Presell Export">
<title>${escapeHtml(buildExportDocumentTitle(page, opts.publicPageUrl))}</title>
${fontLink}
${styleBlock}
${headerCode ? headerCode : ""}
</head>
<body class="pe-export-body" style="margin:0;">
${bodyCode ? `<div data-presell-inject="body-start">${bodyCode}</div>` : ""}
${inner}
${footerCode ? footerCode : ""}
</body>
</html>`;
}
