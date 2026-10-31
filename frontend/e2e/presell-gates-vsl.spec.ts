/**
 * H8 — Gates demográficos / cookies / fantasma / VSL (browser, API pública mockada).
 * Cada teste usa PAGE_ID único (workers em paralelo).
 */
import { expect, test, type Page, type Route } from "@playwright/test";

const HOP = "https://example.com/offer-gates-h8";
const YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

function basePage(pageId: string, overrides: Record<string, unknown>) {
  return {
    id: pageId,
    title: "H8 gates audit",
    slug: `h8-gates-${pageId.slice(0, 8)}`,
    type: "review",
    category: "health",
    language: "pt",
    status: "published",
    clicks: 0,
    impressions: 0,
    conversions: 0,
    video_url: null as string | null,
    settings: {
      businessName: "Analista Independente Lda",
      contactEmail: "ops@example.com",
      cookiePolicyUrl: "/privacidade",
      privacyPolicyUrl: "/privacidade",
      termsUrl: "/termos",
      affiliateDisclosure: "Links de afiliado podem aplicar-se.",
      minAge: 18,
    },
    tracking: { offerUrl: HOP },
    footer_branding: false,
    created_at: "2026-10-31T00:00:00.000Z",
    updated_at: "2026-10-31T00:00:00.000Z",
    content: {
      title: "Produto H8",
      productName: "Produto H8",
      subtitle: "Análise",
      salesText:
        "Conteúdo descritivo para a auditoria de gates. Não prometemos resultados. Confirme preço no site oficial.",
      ctaText: "Ver oferta",
      affiliateLink: HOP,
      images: ["https://upload.wikimedia.org/wikipedia/commons/d/d3/Longjing_tea_steeping_in_gaiwan.jpg"],
    },
    ...overrides,
  };
}

async function mockPresell(page: Page, body: ReturnType<typeof basePage>) {
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

test.describe("H8 — gates + VSL browser", () => {
  test.describe.configure({ mode: "serial" });

  test("cookies: modal visível e Aceitar fecha o sheet", async ({ page }) => {
    const id = "b8e11e11-1111-4111-8111-111111111101";
    await mockPresell(
      page,
      basePage(id, {
        type: "cookies",
        language: "pt-BR",
        settings: {
          businessName: "Analista Independente Lda",
          contactEmail: "ops@example.com",
          cookiePolicyUrl: "/privacidade",
          privacyPolicyUrl: "/privacidade",
          termsUrl: "/termos",
          affiliateDisclosure: "Links de afiliado podem aplicar-se.",
          minAge: "18",
          cookieRedirectToOffer: true,
        },
        content: {
          title: "Produto H8",
          productName: "Produto H8",
          subtitle: "Análise",
          salesText: "Conteúdo descritivo para a auditoria de gates.",
          ctaText: "Ver oferta",
          affiliateLink: HOP,
          generationNiche: "white",
          images: ["https://upload.wikimedia.org/wikipedia/commons/d/d3/Longjing_tea_steeping_in_gaiwan.jpg"],
        },
      }),
    );
    await page.goto(`/p/${id}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(600);
    const typeOnPage = await page.evaluate(async () => {
      const r = await fetch(`/api/public/presells/b8e11e11-1111-4111-8111-111111111101`);
      const j = await r.json();
      return j?.type ?? null;
    });
    expect(typeOnPage).toBe("cookies");
    await expect(page.getByTestId("presell-cookie-card")).toBeVisible({ timeout: 20_000 });
    const allow = page.getByTestId("presell-cookie-allow-offer").or(
      page.getByRole("link", { name: /^(allow|permitir|accept all|aceitar tudo|aceitar)$/i }),
    );
    await allow.first().click();
    await expect(page.getByTestId("presell-cookie-sheet")).toBeHidden({ timeout: 10_000 });
  });

  test("idade: formulário gate e idade válida", async ({ page }) => {
    const id = "b8e11e11-1111-4111-8111-111111111102";
    await mockPresell(page, basePage(id, { type: "idade" }));
    await page.goto(`/p/${id}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("#gate-age")).toBeVisible({ timeout: 20_000 });
    await page.locator("#gate-age").fill("25");
    await expect(page.locator("#gate-age")).toHaveValue("25");
    await expect(page.getByRole("link", { name: /ver oferta/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test("sexo: opções de género visíveis", async ({ page }) => {
    const id = "b8e11e11-1111-4111-8111-111111111103";
    await mockPresell(page, basePage(id, { type: "sexo" }));
    await page.goto(`/p/${id}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("#sx-m")).toBeVisible({ timeout: 20_000 });
    await page.locator("#sx-m").click({ force: true });
  });

  test("fantasma: CTA track + listeners de gesto activos", async ({ page }) => {
    const id = "b8e11e11-1111-4111-8111-111111111104";
    await mockPresell(
      page,
      basePage(id, {
        type: "fantasma",
        content: {
          title: "Fantasma H8",
          productName: "Fantasma H8",
          subtitle: "",
          salesText: "Página fantasma.",
          ctaText: "Ir",
          affiliateLink: HOP,
          generationNiche: "black",
          images: ["https://upload.wikimedia.org/wikipedia/commons/d/d3/Longjing_tea_steeping_in_gaiwan.jpg"],
        },
      }),
    );
    // Interceptar hop absoluto da API de track (assign do fantasma / clique CTA)
    await page.route("http://127.0.0.1:3011/api/track/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><title>tracked</title><h1>Tracked offer</h1>",
      }),
    );
    await page.goto(`/p/${id}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/Redirect|fantasma|gesto/i).first()).toBeVisible({ timeout: 20_000 });
    const cta = page.locator('a[href*="track/r"]').first();
    await expect(cta).toHaveAttribute("href", /track\/r/);
    await cta.click();
    await expect(page.getByText(/Tracked offer/i)).toBeVisible({ timeout: 15_000 });
  });

  test("vsl: player de vídeo presente", async ({ page }) => {
    const id = "b8e11e11-1111-4111-8111-111111111105";
    await mockPresell(
      page,
      basePage(id, {
        type: "vsl",
        video_url: YT,
        content: {
          title: "VSL H8",
          productName: "VSL H8",
          subtitle: "Vídeo",
          salesText: "Demonstração VSL para auditoria. Sem promessas médicas.",
          ctaText: "Ver oferta",
          affiliateLink: HOP,
          images: ["https://upload.wikimedia.org/wikipedia/commons/d/d3/Longjing_tea_steeping_in_gaiwan.jpg"],
        },
      }),
    );
    await page.goto(`/p/${id}`, { waitUntil: "domcontentloaded" });
    const player = page.locator("iframe[src*='youtube'], iframe[src*='youtu'], video");
    await expect(player.first()).toBeVisible({ timeout: 20_000 });
  });
});
