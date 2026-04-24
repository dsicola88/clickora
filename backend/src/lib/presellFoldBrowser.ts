/**
 * Renderiza a página com Chromium para landings que montam o hero em JavaScript
 * (shell HTML + bundle — o fetch simples não vê a primeira dobra real).
 */

const DEFAULT_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const GOTO_MS = 22_000;
const HYDRATE_MS = 3_500;

/** Cabeçalho Accept-Language alinhado ao idioma escolhido na criação da presell. */
export function acceptLanguageForPresellImport(language: string | undefined): string {
  const raw = (language || "pt-BR").trim().toLowerCase();
  if (raw.startsWith("pt")) return "pt-BR,pt;q=0.9,en-US;q=0.7,en;q=0.6";
  if (raw.startsWith("es")) return "es-ES,es;q=0.9,en-US;q=0.7,en;q=0.6";
  if (raw.startsWith("fr")) return "fr-FR,fr;q=0.9,en-US;q=0.7,en;q=0.6";
  if (raw.startsWith("de")) return "de-DE,de;q=0.9,en-US;q=0.7,en;q=0.6";
  if (raw.startsWith("it")) return "it-IT,it;q=0.9,en-US;q=0.7,en;q=0.6";
  return "en-US,en;q=0.9";
}

/**
 * Devolve o HTML após execução de JS (primeira dobra visível no viewport típico desktop).
 * Falha em silêncio (null) se Playwright não estiver instalado, estiver desativado, ou o site bloquear.
 */
export async function fetchHtmlAfterJsRender(
  pageUrl: string,
  acceptLanguage: string,
): Promise<string | null> {
  if (process.env.PRESELL_DISABLE_PLAYWRIGHT === "1") return null;

  let chromium: typeof import("playwright").chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return null;
  }

  let browser: import("playwright").Browser | undefined;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    const context = await browser.newContext({
      viewport: { width: 1365, height: 900 },
      userAgent: DEFAULT_UA,
      locale: acceptLanguage.split(",")[0]?.trim() || "en-US",
    });
    await context.setExtraHTTPHeaders({
      "Accept-Language": acceptLanguage,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    });
    const page = await context.newPage();
    await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: GOTO_MS });
    try {
      await page.waitForSelector("h1", { timeout: 4_000 });
    } catch {
      /* headline pode estar só em div */
    }
    await new Promise((r) => setTimeout(r, HYDRATE_MS));
    try {
      const vp = page.viewportSize();
      await page.mouse.move(Math.max(40, (vp?.width ?? 900) / 2), Math.max(40, (vp?.height ?? 700) / 2));
      await page.mouse.wheel(0, 520);
      await new Promise((r) => setTimeout(r, 700));
      await page.mouse.wheel(0, -520);
      await new Promise((r) => setTimeout(r, 250));
    } catch {
      /* ignore */
    }
    return await page.content();
  } catch {
    return null;
  } finally {
    await browser?.close().catch(() => {});
  }
}
