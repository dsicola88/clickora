/**
 * Verifica, com Playwright, que uma landing pública não provoca scroll horizontal
 * a uma viewport estreita (padrão 320px de largura).
 *
 * Requisitos: servidor a ouvir (ex. `npm run dev`) e base de dados acessível com
 * a landing do slug publicada.
 *
 * Variáveis de ambiente (opcionais):
 *   LANDING_SMOKE_BASE   — URL base, sem path final. Ex: http://127.0.0.1:8080
 *   LANDING_SMOKE_SLUG   — slug (default: vendas, alinhado ao seed)
 *   LANDING_SMOKE_WIDTH  — largura do viewport (default: 320)
 *   LANDING_SMOKE_TIMEOUT — ms para navegação (default: 120000)
 */
import { chromium } from "playwright";

const base = (process.env.LANDING_SMOKE_BASE ?? "http://127.0.0.1:8080").replace(/\/$/, "");
const slug = process.env.LANDING_SMOKE_SLUG ?? "vendas";
const width = Math.max(200, Math.min(800, Number(process.env.LANDING_SMOKE_WIDTH ?? 320) || 320));
const navTimeout = Math.max(5000, Number(process.env.LANDING_SMOKE_TIMEOUT ?? 120000) || 120000);
const url = `${base}/l/${encodeURIComponent(slug)}`;

const WIDE_PX = width + 12;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  let lastErr;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: navTimeout });
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  if (lastErr) throw lastErr;

  await page.waitForSelector(".lp-page", { timeout: 30_000 });
  await new Promise((r) => setTimeout(r, 800));

  const metrics = await page.evaluate((maxW) => {
    const d = document.documentElement;
    const b = document.body;
    const lp = document.querySelector(".lp-page");
    const wide = [];
    document.querySelectorAll("body *").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > maxW) {
        const id = el.id ? `#${el.id}` : "";
        const cls = el.className && typeof el.className === "string" ? el.className.slice(0, 100) : "";
        wide.push({ tag: el.tagName, id, class: cls, w: Math.round(r.width) });
      }
    });
    return {
      dClient: d.clientWidth,
      dScroll: d.scrollWidth,
      bScroll: b ? b.scrollWidth : null,
      lp: lp ? { client: lp.clientWidth, scroll: lp.scrollWidth } : null,
      wide: wide.slice(0, 25),
    };
  }, WIDE_PX);

  const scroll = Math.ceil(metrics.dScroll);
  const client = metrics.dClient;
  const overflow =
    scroll > client ||
    (metrics.bScroll != null && Math.ceil(metrics.bScroll) > client) ||
    (metrics.lp && Math.ceil(metrics.lp.scroll) > client);

  if (overflow) {
    console.error(`[landing-viewport-smoke] FALHOU: overflow horizontal a ${width}px em ${url}`);
    console.error(JSON.stringify(metrics, null, 2));
    process.exitCode = 1;
  } else if (metrics.wide.length) {
    console.error(`[landing-viewport-smoke] FALHOU: elementos com largura > ${WIDE_PX}px a ${width}px em ${url}`);
    console.error(JSON.stringify(metrics.wide, null, 2));
    process.exitCode = 1;
  } else {
    console.log(
      `[landing-viewport-smoke] OK — ${width}px, scrollWidth=${metrics.dScroll}, clientWidth=${metrics.dClient} — ${url}`,
    );
  }
} catch (e) {
  console.error(`[landing-viewport-smoke] FALHOU: ${e?.message || e}`);
  console.error(
    "Confirme que o servidor (ex. npm run dev) e a base de dados estão acessíveis e que a landing está publicada.",
  );
  process.exitCode = 1;
} finally {
  await browser.close();
}

process.exit(process.exitCode ?? 0);
