/**
 * Tipo «cookies» — todas as predefinições do banner funcionam ponta a ponta (API pública mockada):
 * visível, equal prominence (Aceitar = Fechar), não bloqueia a página, CTA alcançável,
 * Fechar nunca navega, escolha persiste, opt-in leva a /track/r/ com os parâmetros de anúncio.
 * Mercados-alvo: EUA, Canadá, Austrália, Reino Unido (en).
 *
 * COOKIE_SHOTS=/dir grava capturas desktop/mobile de cada estilo (revisão visual manual).
 */
import { expect, test, type Page, type Route } from "@playwright/test";

const HOP = "https://example.com/offer-cookie-styles";
const STYLES = ["classicBar", "minimalGreen", "darkBar", "glassBar", "cornerCard", "floatingCard"] as const;
const LAYOUT: Record<(typeof STYLES)[number], "bar" | "corner" | "floating"> = {
  classicBar: "bar",
  minimalGreen: "bar",
  darkBar: "bar",
  glassBar: "bar",
  cornerCard: "corner",
  floatingCard: "floating",
};
const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
} as const;

function pageBody(id: string, style: string, redirect: boolean) {
  return {
    id,
    title: "Cookie styles",
    slug: `cookie-styles-${style}`,
    type: "cookies",
    category: "health",
    language: "en",
    status: "published",
    clicks: 0,
    impressions: 0,
    conversions: 0,
    video_url: null,
    settings: {
      businessName: "Independent Reviewer LLC",
      contactEmail: "ops@example.com",
      cookiePolicyUrl: "/privacy",
      privacyPolicyUrl: "/privacy",
      termsUrl: "/terms",
      affiliateDisclosure: "Affiliate links may apply.",
      minAge: "18",
      cookieBannerStyle: style,
      ...(redirect ? { cookieRedirectToOffer: true } : {}),
    },
    tracking: { offerUrl: HOP },
    footer_branding: false,
    created_at: "2026-11-26T00:00:00.000Z",
    updated_at: "2026-11-26T00:00:00.000Z",
    content: {
      title: "Cookie Styles Product",
      productName: "Cookie Styles Product",
      subtitle: "Independent review",
      salesText:
        "Descriptive content for the cookie banner audit. No promises of results. Check price on the official site. ".repeat(
          12,
        ),
      ctaText: "See offer",
      affiliateLink: HOP,
      generationNiche: "white",
      images: [],
    },
  };
}

async function mock(page: Page, body: ReturnType<typeof pageBody>) {
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

let seq = 0;
function uid(): string {
  seq += 1;
  return `c00c1e00-0000-4000-8000-${String(Date.now() % 1e8).padStart(8, "0")}${String(seq).padStart(4, "0")}`;
}

test.setTimeout(90_000);

for (const vpName of Object.keys(VIEWPORTS) as (keyof typeof VIEWPORTS)[]) {
  test.describe(`cookies — predefinições (${vpName})`, () => {
    test.use({ viewport: VIEWPORTS[vpName] });

    for (const style of STYLES) {
      test(`${style}: banner correcto, Aceitar = Fechar, página livre, Fechar persiste`, async ({ page }) => {
        const id = uid();
        await mock(page, pageBody(id, style, false));
        await page.goto(`/p/${id}`, { waitUntil: "domcontentloaded" });
        const sheet = page.getByTestId("presell-cookie-sheet");
        await expect(sheet).toBeVisible({ timeout: 20_000 });
        await expect(sheet).toHaveAttribute("data-cookie-style", style);
        const card = page.getByTestId("presell-cookie-card");
        const vp = VIEWPORTS[vpName];

        // Geometria do layout.
        const box = (await card.boundingBox())!;
        expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);
        expect(box.x).toBeGreaterThanOrEqual(-1);
        expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
        const layout = LAYOUT[style];
        if (layout === "bar" || vpName === "mobile") {
          if (layout !== "floating") expect(box.width).toBeGreaterThanOrEqual(vp.width - 2);
        }
        if (layout === "corner" && vpName === "desktop") {
          expect(box.width).toBeLessThanOrEqual(400);
          expect(box.x + box.width).toBeGreaterThanOrEqual(vp.width - 24);
        }
        if (layout === "floating" && vpName === "desktop") {
          expect(box.width).toBeLessThanOrEqual(520);
          expect(Math.abs(box.x + box.width / 2 - vp.width / 2)).toBeLessThanOrEqual(2);
        }
        // Cabe no viewport mesmo em mobile: nunca ocupa mais de 60% do ecrã.
        expect(box.height).toBeLessThanOrEqual(vp.height * 0.6);

        // Equal prominence (ICO): mesmo tamanho nos dois botões.
        const a = (await page.getByTestId("presell-cookie-allow").boundingBox())!;
        const c = (await page.getByTestId("presell-cookie-close").boundingBox())!;
        expect(Math.abs(a.height - c.height)).toBeLessThanOrEqual(1);
        expect(a.height).toBeGreaterThanOrEqual(44);
        if (vpName === "desktop" || layout !== "bar") {
          expect(Math.abs(a.width - c.width)).toBeLessThanOrEqual(1);
        }
        // Sem backdrop: o wrapper não captura cliques fora do cartão.
        expect(await sheet.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");
        expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe("hidden");

        // Espaço reservado no fim da página (último conteúdo nunca tapado).
        const reserved = await page.evaluate(() => parseFloat(getComputedStyle(document.body).paddingBottom) || 0);
        if (layout === "corner" && vpName === "desktop") expect(reserved).toBe(0);
        else expect(reserved).toBeGreaterThanOrEqual(box.height - 1);

        if (process.env.COOKIE_SHOTS) {
          await page.screenshot({ path: `${process.env.COOKIE_SHOTS}/${style}-${vpName}.png` });
        }

        // A página continua a fazer scroll com o banner aberto.
        const y0 = await page.evaluate(() => window.scrollY);
        await page.mouse.wheel(0, 600);
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(y0);

        // Fechar = só essenciais, nunca navega, esconde o banner e liberta o espaço.
        await page.getByTestId("presell-cookie-close").click();
        await expect(sheet).toBeHidden();
        expect(new URL(page.url()).pathname).toBe(`/p/${id}`);
        await expect
          .poll(() => page.evaluate(() => parseFloat(getComputedStyle(document.body).paddingBottom) || 0))
          .toBe(0);
        expect(await page.evaluate(() => localStorage.getItem("clickora-cookie-banner:choice"))).toBe("essential");

        // Escolha persiste após reload.
        await page.goto(`/p/${id}`, { waitUntil: "domcontentloaded" });
        await expect(page.getByText("Cookie Styles Product").first()).toBeVisible({ timeout: 20_000 });
        await expect(page.getByTestId("presell-cookie-sheet")).toBeHidden();
      });

      test(`${style}: Aceitar sem opt-in grava consentimento e fica na página`, async ({ page }) => {
        const id = uid();
        await mock(page, pageBody(id, style, false));
        await page.goto(`/p/${id}`, { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId("presell-cookie-sheet")).toBeVisible({ timeout: 20_000 });
        expect(await page.getByTestId("presell-cookie-allow-offer").count()).toBe(0);
        await page.getByTestId("presell-cookie-allow").click();
        await expect(page.getByTestId("presell-cookie-sheet")).toBeHidden();
        await page.waitForTimeout(400);
        expect(new URL(page.url()).pathname).toBe(`/p/${id}`);
        expect(await page.evaluate(() => localStorage.getItem("clickora-cookie-banner:choice"))).toBe("all");
      });

      test(`${style}: opt-in → Aceitar vai a /track/r/ preservando gclid; Fechar não navega`, async ({ page }) => {
        const id = uid();
        await mock(page, pageBody(id, style, true));
        await page.goto(`/p/${id}?gclid=TEST123&utm_source=google`, { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId("presell-cookie-sheet")).toBeVisible({ timeout: 20_000 });
        const allow = page.getByTestId("presell-cookie-allow-offer");
        await expect(allow).toBeVisible();
        await allow.click();
        await expect(page).toHaveURL(/\/track\/r\//, { timeout: 10_000 });
        expect(page.url()).toContain("gclid=TEST123");
      });

      test(`${style}: CTA da oferta alcançável com o banner aberto`, async ({ page }) => {
        const id = uid();
        await mock(page, pageBody(id, style, false));
        await page.goto(`/p/${id}`, { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId("presell-cookie-sheet")).toBeVisible({ timeout: 20_000 });
        const cta = page.getByRole("link", { name: /see offer/i }).last();
        await cta.scrollIntoViewIfNeeded();
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await expect(cta).toBeVisible();
        // O CTA no fundo da página não fica por baixo do banner.
        const ctaBox = (await cta.boundingBox())!;
        const bannerBox = (await page.getByTestId("presell-cookie-card").boundingBox())!;
        const overlapsHoriz = ctaBox.x < bannerBox.x + bannerBox.width && ctaBox.x + ctaBox.width > bannerBox.x;
        const overlapsVert = ctaBox.y + ctaBox.height > bannerBox.y && ctaBox.y < bannerBox.y + bannerBox.height;
        expect(overlapsHoriz && overlapsVert, "CTA coberto pelo banner").toBe(false);
        await cta.click();
        await expect(page).toHaveURL(/\/track\/r\//, { timeout: 10_000 });
      });
    }
  });
}
