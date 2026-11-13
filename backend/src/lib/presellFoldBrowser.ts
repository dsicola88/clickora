/**
 * Renderiza a página com Chromium para landings que montam o hero em JavaScript
 * (shell HTML + bundle — o fetch simples não vê a primeira dobra real).
 * Captura espelho HTML (head + body) para iframe de alta fidelidade à página original.
 */
import { looksLikeNonProductImportBody } from "./presellAffiliateHop";
import { startPresellImportProxy } from "./presellImportProxy";
import { vetImportUrl } from "./presellImportSsrf";

const DEFAULT_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const GOTO_MS = 28_000;
const HYDRATE_MS = 6_500;

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

export type BrowserRenderStatus = "rendered" | "disabled" | "unavailable" | "failed" | "empty";

export type RenderedPageBundle = {
  html: string;
  mirrorParts: { baseHref: string; headSnip: string; bodyInner: string } | null;
  /** Porque o espelho existe ou não. Não significa cópia fiel da página. */
  browser: BrowserRenderStatus;
  browserDetail?: string;
  /** URL final após redirects (ex.: Knownwalk → melaramax.com). */
  finalUrl?: string;
};

const MAX_IMPORT_BROWSERS = 1;
let activeImportBrowsers = 0;

export function tryAcquireImportBrowser(): boolean {
  if (activeImportBrowsers >= MAX_IMPORT_BROWSERS) return false;
  activeImportBrowsers += 1;
  return true;
}

export function releaseImportBrowser(): void {
  activeImportBrowsers = Math.max(0, activeImportBrowsers - 1);
}

/** O browser não contorna o proxy. `<-loopback>` impede o Chromium de ligar direto a localhost. */
export function importChromiumProxy(port: number): { server: string; bypass: string } {
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("Proxy de importação indisponível. A navegação foi bloqueada.");
  }
  return { server: `http://127.0.0.1:${port}`, bypass: "<-loopback>" };
}

export function browserStatusFromLaunchError(message: string): "unavailable" | "failed" {
  if (/Executable doesn't exist|Please run the following command|browserType\.launch/i.test(message)) {
    return "unavailable";
  }
  return "failed";
}

function emptyRenderedBundle(browser: BrowserRenderStatus, browserDetail?: string): RenderedPageBundle {
  return { html: "", mirrorParts: null, browser, ...(browserDetail ? { browserDetail } : {}) };
}

function bundleLooksBlocked(html: string): boolean {
  if (!html || html.length < 200) return true;
  if (looksLikeNonProductImportBody(html)) return true;
  const title = html.match(/<title[^>]*>([^<]*)/i)?.[1] || "";
  return /520|just a moment|checking the site|attention required/i.test(title);
}

/**
 * HTML após JS + recorte do head (CSS/fonts) e body para espelho no iframe da presell.
 * Promove imagens lazy e espera hidratação para aproximar o visual da página original.
 * Se o proxy SSRF receber Cloudflare 520 (comum em Knownwalk→sales page), tenta 1× sem proxy
 * mantendo `vetImportUrl` em cada request.
 */
export async function fetchRenderedPageBundle(
  pageUrl: string,
  acceptLanguage: string,
  opts?: { preferDirectNetwork?: boolean },
): Promise<RenderedPageBundle> {
  if (process.env.PRESELL_DISABLE_PLAYWRIGHT === "1") return emptyRenderedBundle("disabled");
  if (!tryAcquireImportBrowser()) {
    return emptyRenderedBundle(
      "failed",
      "Já há uma importação com browser em curso. Espere que termine e tente de novo.",
    );
  }

  let chromium: typeof import("playwright").chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    releaseImportBrowser();
    return emptyRenderedBundle("unavailable");
  }

  let browser: import("playwright").Browser | undefined;
  let proxy: { port: number; close: () => Promise<void> } | undefined;
  try {
    const channel = process.env.PRESELL_PLAYWRIGHT_CHANNEL?.trim();
    browser = await chromium.launch({
      headless: true,
      ...(channel ? { channel: channel as "chrome" } : {}),
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const capture = async (useProxy: boolean): Promise<RenderedPageBundle> => {
      let localProxy: { port: number; close: () => Promise<void> } | undefined;
      if (useProxy) {
        localProxy = await startPresellImportProxy();
        proxy = localProxy;
      }
      const context = await browser!.newContext({
        ...(useProxy && localProxy ? { proxy: importChromiumProxy(localProxy.port) } : {}),
        viewport: { width: 1440, height: 980 },
        userAgent: DEFAULT_UA,
        locale: acceptLanguage.split(",")[0]?.trim() || "en-US",
        deviceScaleFactor: 1,
      });
      try {
        await context.setExtraHTTPHeaders({
          "Accept-Language": acceptLanguage,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        });
        await context.route("**/*", async (route) => {
          try {
            await vetImportUrl(route.request().url());
          } catch {
            await route.abort();
            return;
          }
          await route.continue();
        });
        const page = await context.newPage();
        page.on("download", (download) => {
          void download.cancel();
        });
        await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: GOTO_MS });
        try {
          await page.waitForLoadState("networkidle", { timeout: 8_000 });
        } catch {
          /* SPAs com websocket nunca ficam idle */
        }
        try {
          await page.waitForSelector("h1, h2, [role='heading'], main, img", { timeout: 5_000 });
        } catch {
          /* headline pode estar só em div */
        }
        await new Promise((r) => setTimeout(r, HYDRATE_MS));

        await page.evaluate(`(() => {
      const promote = (el) => {
        const attrs = ["data-src", "data-lazy-src", "data-original", "data-lazy", "data-bg"];
        for (const a of attrs) {
          const v = el.getAttribute(a);
          if (!v || v.startsWith("data:")) continue;
          if (el.tagName === "IMG" && (!el.getAttribute("src") || /placeholder|blank|spacer|data:image\\/svg/i.test(el.getAttribute("src") || ""))) {
            el.setAttribute("src", v);
          }
          if (el.tagName === "SOURCE" && !el.getAttribute("srcset")) {
            el.setAttribute("srcset", v);
          }
        }
        const srcset = el.getAttribute("data-srcset");
        if (srcset && el.tagName === "IMG" && !el.getAttribute("srcset")) {
          el.setAttribute("srcset", srcset);
        }
        if (el.tagName === "IMG") {
          el.removeAttribute("loading");
          el.setAttribute("loading", "eager");
        }
      };
      document.querySelectorAll("img, source, [data-bg], [data-src]").forEach(promote);
    })()`);

        try {
          const vp = page.viewportSize();
          await page.mouse.move(Math.max(40, (vp?.width ?? 900) / 2), Math.max(40, (vp?.height ?? 700) / 2));
          for (const dy of [400, 800, 1200, 800, -2000]) {
            await page.mouse.wheel(0, dy);
            await new Promise((r) => setTimeout(r, 350));
          }
          await new Promise((r) => setTimeout(r, 600));
          await page.evaluate(`(() => {
        document.querySelectorAll("img[data-src], img[data-lazy-src]").forEach((el) => {
          const v = el.getAttribute("data-src") || el.getAttribute("data-lazy-src");
          if (v && !/^data:/.test(v)) el.setAttribute("src", v);
        });
      })()`);
        } catch {
          /* ignore */
        }

        const html = await page.content();
        const finalUrl = page.url();

        type MirrorEval = { baseHref: string; headSnip: string; bodyInner: string; ok: boolean };
        const mirrorParts = (await page.evaluate(`(() => {
      const MAX_HEAD = 480000;
      const MAX_BODY = 950000;
      const parts = [];
      document.head.querySelectorAll("meta[charset], meta[name='viewport'], meta[name='theme-color']").forEach((el) => {
        parts.push(el.outerHTML);
      });
      document.head.querySelectorAll("link, style").forEach((el) => {
        if (el.tagName === "LINK") {
          const rel = (el.getAttribute("rel") || "").toLowerCase();
          if (rel === "alternate" || rel === "canonical" || rel === "modulepreload" || rel === "prefetch" || rel === "dns-prefetch") return;
          const asAttr = (el.getAttribute("as") || "").toLowerCase();
          if (asAttr === "script") return;
          if (rel.includes("stylesheet")) {
            const href = el.href || "";
            let dumped = "";
            try {
              for (const sheet of document.styleSheets) {
                if (href && sheet.href === href) {
                  dumped = [...sheet.cssRules].map((r) => r.cssText).join("\\n");
                  break;
                }
              }
            } catch (_) {}
            if (dumped.length > 40) {
              parts.push("<style data-clickora-css=\\"1\\">" + dumped + "</style>");
              return;
            }
            parts.push(el.outerHTML);
            return;
          }
          if (rel === "preconnect" || rel === "preload" || rel.includes("icon") || !rel) {
            parts.push(el.outerHTML);
            return;
          }
          return;
        }
        parts.push(el.outerHTML);
      });
      while (parts.join("\\n").length > MAX_HEAD && parts.length > 0) {
        parts.pop();
      }
      let headSnip = parts.join("\\n");
      const raw = document.body && document.body.cloneNode(true);
      if (!raw || raw.nodeType !== 1) {
        return { baseHref: "", headSnip: "", bodyInner: "", ok: false };
      }
      const b = raw;
      b.querySelectorAll("script, object, embed").forEach((n) => n.remove());
      b.querySelectorAll("noscript").forEach((n) => n.remove());
      b.querySelectorAll("img[src]").forEach((img) => {
        try {
          const abs = new URL(img.getAttribute("src"), document.baseURI).href;
          if (/^https?:/i.test(abs)) img.setAttribute("src", abs);
        } catch (_) {}
      });
      b.querySelectorAll("source[srcset], img[srcset]").forEach((el) => {
        const ss = el.getAttribute("srcset");
        if (!ss) return;
        try {
          const rewritten = ss.split(",").map((part) => {
            const bits = part.trim().split(/\\s+/);
            const u = bits[0];
            const rest = bits.slice(1).join(" ");
            try {
              const abs = new URL(u, document.baseURI).href;
              return rest ? abs + " " + rest : abs;
            } catch (_) {
              return part.trim();
            }
          }).join(", ");
          el.setAttribute("srcset", rewritten);
        } catch (_) {}
      });
      const truncateBodyHtml = (html, max) => {
        if (html.length <= max) return html;
        const div = document.createElement("div");
        div.innerHTML = html;
        let guard = 0;
        while (div.innerHTML.length > max && div.lastChild && guard++ < 2000) {
          div.removeChild(div.lastChild);
        }
        const out = div.innerHTML;
        if (out.length > max) return html.slice(0, max);
        return out;
      };
      let bodyInner = b.innerHTML;
      if (bodyInner.length > MAX_BODY) bodyInner = truncateBodyHtml(bodyInner, MAX_BODY);
      const baseHref = document.baseURI || window.location.href.split("#")[0];
      return { baseHref, headSnip, bodyInner, ok: bodyInner.length > 200 };
    })()`)) as MirrorEval;

        const mirror =
          mirrorParts.ok && mirrorParts.baseHref && mirrorParts.bodyInner.length > 200
            ? {
                baseHref: mirrorParts.baseHref,
                headSnip: mirrorParts.headSnip,
                bodyInner: mirrorParts.bodyInner,
              }
            : null;

        return {
          html,
          mirrorParts: mirror,
          browser: mirror ? "rendered" : "empty",
          finalUrl,
        };
      } finally {
        await context.close().catch(() => {});
        if (localProxy) {
          await localProxy.close().catch(() => {});
          if (proxy === localProxy) proxy = undefined;
        }
      }
    };

    /** Knownwalk→CF: proxy SSRF costuma devolver 520; tentar directo primeiro quando pedido. */
    const order = opts?.preferDirectNetwork ? [false, true] : [true, false];
    let result = await capture(order[0]!);
    if (bundleLooksBlocked(result.html)) {
      result = await capture(order[1]!);
      if (!bundleLooksBlocked(result.html) && result.browser === "rendered") {
        result = {
          ...result,
          browserDetail: opts?.preferDirectNetwork
            ? "Captura directa (hop/CDN bloqueava via proxy SSRF)."
            : "Captura sem proxy SSRF (destino bloqueava Cloudflare via proxy).",
        };
      }
    }
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = browserStatusFromLaunchError(msg);
    const detail =
      status === "failed" && /closed|crash|Target page/i.test(msg)
        ? "O browser de importação encerrou antes de terminar a captura."
        : status === "failed" && /timeout/i.test(msg)
          ? "O browser esgotou o tempo de abertura da página."
          : undefined;
    return emptyRenderedBundle(status, detail);
  } finally {
    await browser?.close().catch(() => {});
    await proxy?.close().catch(() => {});
    releaseImportBrowser();
  }
}

/**
 * @deprecated Preferir `fetchRenderedPageBundle`; mantido para chamadas que só precisam do HTML.
 */
export async function fetchHtmlAfterJsRender(pageUrl: string, acceptLanguage: string): Promise<string | null> {
  const bundle = await fetchRenderedPageBundle(pageUrl, acceptLanguage);
  return bundle.html || null;
}
