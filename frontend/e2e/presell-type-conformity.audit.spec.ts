/**
 * Auditoria ponta a ponta: cada tipo × nicho, snapshot visual + asserts de conformidade.
 * Ordem: WHITE primeiro, depois BLACK.
 */
import { expect, test, type Page, type Route } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PAGE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SNAP_DIR = path.join(__dirname, "../test-results/presell-type-audit");

const WHITE_TYPES = ["cookies", "tsl", "dtc", "review", "desconto", "vsl", "vsl_tsl"] as const;
const BLACK_TYPES = [
  "cookies",
  "fantasma",
  "tsl",
  "dtc",
  "review",
  "desconto",
  "vsl",
  "vsl_tsl",
  "sexo",
  "idade",
  "idade_sexo",
  "idade_pais",
  "sexo_pais",
  "grupo_homem",
  "grupo_mulher",
  "pais",
  "captcha",
  "modelos",
] as const;

type Niche = "white" | "black";

function mirrorSrcDoc() {
  return `<!doctype html><html><head><style>body{font-family:system-ui;margin:0;padding:24px}h1{font-size:28px}</style></head><body>
  <h1>Official StopWatt storefront</h1>
  <img src="${PNG}" alt="StopWatt" width="400" height="400">
  <p>Clean power for appliances. Confirm price and shipping on checkout.</p>
  <a href="https://offer.example/buy">Buy now</a>
  </body></html>`;
}

function buildPresell(type: string, niche: Niche) {
  const isVideo = type === "vsl" || type === "vsl_tsl";
  return {
    id: PAGE_ID,
    title: `Audit ${niche} ${type}`,
    slug: `audit-${niche}-${type}`,
    type,
    category: "home",
    language: "pt-BR",
    status: "published",
    clicks: 0,
    impressions: 0,
    conversions: 0,
    video_url: isVideo ? "https://www.youtube.com/watch?v=dQw4w9WgXcQ" : undefined,
    settings: {
      businessName: niche === "black" ? "Operador Audit Lda" : "StopWatt Brand",
      contactEmail: niche === "black" ? "afiliado@example.com" : "brand@example.com",
      cookiePolicyUrl: "/privacidade",
      privacyPolicyUrl: "/privacidade",
      termsUrl: "/termos",
      affiliateDisclosure:
        "Divulgação: esta página pode conter links de afiliado. Se comprar através deles, posso receber uma comissão.",
      minAge: "18",
      ...(type === "desconto"
        ? { discountPercent: 30, urgencyTimerSeconds: 600, socialProof: "12 pessoas viram" }
        : {}),
    },
    tracking: {},
    footer_branding: false,
    created_at: "2026-10-15T00:00:00.000Z",
    updated_at: "2026-10-15T00:00:00.000Z",
    content: {
      title: "StopWatt",
      subtitle: "Corrente estável para equipamentos.",
      salesText:
        niche === "white"
          ? "O aparelho fica entre a tomada e o equipamento.\n\nConfirme preço e envio no site oficial."
          : "Cura milagrosa garantida sem link",
      ctaText: "Ver oferta oficial",
      productName: "StopWatt",
      affiliateLink: "https://offer.example/buy",
      productImages: [PNG],
      generationNiche: niche,
      ...(niche === "white" ? { importMirrorSrcDoc: mirrorSrcDoc() } : {}),
    },
  };
}

async function install(page: Page, body: ReturnType<typeof buildPresell>) {
  const fulfill = (route: Route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  await page.route("**/public/presells/**", fulfill);
  await page.route("**/api/public/presells/**", fulfill);
  await page.route("**/track/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>tracked</title><h1>Tracked offer</h1>",
    }),
  );
}

async function open(page: Page, type: string, niche: Niche) {
  const body = buildPresell(type, niche);
  await install(page, body);
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await page.goto(`/p/${PAGE_ID}?gclid=audit-gclid&utm_source=google_ads`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(600);
  return { errors, body };
}

async function snap(page: Page, niche: Niche, type: string) {
  fs.mkdirSync(SNAP_DIR, { recursive: true });
  const file = path.join(SNAP_DIR, `${niche}__${type}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

function assertNoPageErrors(errors: string[]) {
  const serious = errors.filter(
    (e) => !/ResizeObserver|Non-Error promise rejection/i.test(e),
  );
  expect(serious, serious.join("\n")).toEqual([]);
}

test.describe("auditoria WHITE — todos os tipos", () => {
  test.describe.configure({ mode: "serial" });

  for (const type of WHITE_TYPES) {
    test(`white / ${type}`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      const { errors } = await open(page, type, "white");
      assertNoPageErrors(errors);
      await snap(page, "white", type);

      const root = page.locator("body");
      await expect(root).toBeVisible();

      if (type === "cookies") {
        const card = page.getByTestId("presell-cookie-card");
        await expect(card).toBeVisible();
        // White: Aceitar é link para oferta trackeada
        const allow = card.getByRole("link", {
          name: /^(allow|permitir|accept all|aceitar tudo|aceitar)$/i,
        });
        await expect(allow).toBeVisible();
        const href = await allow.getAttribute("href");
        expect(href || "").toMatch(/track|offer\.example/i);
      }

      if (type === "desconto") {
        // Faixa/overlay de desconto deve existir
        const hasDiscountUi =
          (await page.getByText(/desconto|%|oferta|urgência|pessoas/i).count()) > 0;
        expect(hasDiscountUi).toBe(true);
      }

      if (type === "tsl" || type === "dtc" || type === "review" || type === "vsl" || type === "vsl_tsl") {
        // Espelho white: conteúdo oficial visível
        await expect(page.getByText(/StopWatt|Official|storefront|oferta/i).first()).toBeVisible();
      }

      // Sem desalinhamento óbvio: sem overflow horizontal grave
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return {
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
        };
      });
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 24);
    });
  }
});

test.describe("auditoria BLACK — todos os tipos", () => {
  test.describe.configure({ mode: "serial" });

  for (const type of BLACK_TYPES) {
    test(`black / ${type}`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      const { errors } = await open(page, type, "black");
      assertNoPageErrors(errors);

      if (type === "fantasma") {
        await snap(page, "black", type);
        // Fantasma: página existe; redirect no gesto — não forçar navegação aqui
        await expect(page.locator("body")).toBeVisible();
        return;
      }

      await snap(page, "black", type);

      // Portal informativo: kicker / artigo / sem claims inventados
      const bodyText = (await page.locator("body").innerText()).toLowerCase();
      expect(bodyText).not.toContain("milagrosa");
      expect(bodyText).not.toContain("cura milagrosa");

      if (type === "cookies") {
        const card = page.getByTestId("presell-cookie-card");
        await expect(card).toBeVisible();
        // Black: Aceitar é botão (desbloqueia), não link para oferta
        const allowBtn = card.getByRole("button", {
          name: /^(allow|permitir|accept all|aceitar tudo|aceitar)$/i,
        });
        await expect(allowBtn).toBeVisible();
        await allowBtn.click();
        await expect(card).toBeHidden({ timeout: 5000 });
        await expect(page).toHaveURL(new RegExp(`/p/${PAGE_ID}`));
        // Após unlock, CTA da página existe
        await expect(page.getByRole("link", { name: /oferta|continuar|oficial|ver/i }).first()).toBeVisible();
      }

      const interactive = [
        "sexo",
        "idade",
        "idade_sexo",
        "idade_pais",
        "sexo_pais",
        "grupo_homem",
        "grupo_mulher",
        "pais",
        "captcha",
        "modelos",
      ];
      if (interactive.includes(type)) {
        // Gate sticky visível
        await expect(page.locator("section.sticky, [class*='sticky']").first()).toBeVisible();
        // CTAs de oferta bloqueados até preencher
        const locked = page.locator('[data-interaction-locked="1"]');
        await expect(locked).toBeVisible();
      }

      if (type !== "cookies") {
        // Portal header / artigo
        await expect(page.getByText(/portal informativo|stopwatt|avaliar|transparência/i).first()).toBeVisible();
      }

      // Rodapé afiliado / operador
      const footer = page.locator("footer");
      if ((await footer.count()) > 0) {
        const ft = (await footer.first().innerText()).toLowerCase();
        expect(ft.includes("afiliado") || ft.includes("operador") || ft.includes("comiss")).toBe(true);
      }

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
      });
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 24);
    });
  }
});
