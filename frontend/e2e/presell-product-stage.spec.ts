import { expect, test, type Page } from "@playwright/test";

const PAGE_ID = "11111111-1111-4111-8111-111111111111";
const PARENT_CLICK = "22222222-2222-4222-8222-222222222222";

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function presell(type: string, extra: Record<string, unknown> = {}) {
  return {
    id: PAGE_ID,
    title: "StopWatt",
    slug: "stopwatt-e2e",
    type,
    category: "home",
    language: "en",
    status: "published",
    clicks: 0,
    impressions: 0,
    conversions: 0,
    video_url: extra.video_url as string | undefined,
    settings: {},
    tracking: {},
    footer_branding: false,
    created_at: "2026-10-09T00:00:00.000Z",
    updated_at: "2026-10-09T00:00:00.000Z",
    content: {
      title: "Stop Wasting Money On Dirty Electricity",
      subtitle: "Keep appliances safe from unstable current.",
      salesText: "CHOOSE YOURS AND START SAVING NOW\n\nThe unit sits between the outlet and the appliance.",
      ctaText: "Order Now",
      productName: "STOPWATT",
      affiliateLink: "https://offer.example/buy",
      productImages: [
        "https://cdn.example/products/stopwatt_300x300.jpg",
        "https://cdn.example/products/stopwatt-side.jpg",
      ],
      storefrontHeroTint: type !== "vsl" && type !== "vsl_tsl",
      ...((extra.content as object) || {}),
    },
  };
}

async function installPresell(page: Page, body: ReturnType<typeof presell>, images: "ok" | "fail") {
  await page.route("**/public/presells/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }),
  );
  await page.route("**/track/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("https://cdn.example/**", (route) => {
    if (images === "fail") return route.abort();
    return route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from(PNG.split(",")[1], "base64") });
  });
}

async function openPresell(page: Page, type: string, images: "ok" | "fail" = "ok") {
  await installPresell(
    page,
    presell(type, type === "vsl" || type === "vsl_tsl" ? { video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" } : {}),
    images,
  );
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await page.goto(
    `/p/${PAGE_ID}?gclid=test-gclid&sub1=kw-1&utm_source=google_ads&utm_medium=cpc&parent_click_id=${PARENT_CLICK}`,
  );
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  return errors;
}

test.describe("presell — produto visível com cookies", () => {
  test("imagem principal fica visível atrás do modal centrado de cookies", async ({ page }) => {
    const errors = await openPresell(page, "cookies");
    const hero = page.locator("[data-presell-hero='product']").first();
    await expect(hero).toBeVisible();
    const heroBox = await hero.boundingBox();
    const card = page.getByTestId("presell-cookie-card");
    await expect(card).toBeVisible();
    const cardBox = await card.boundingBox();
    const viewport = page.viewportSize();
    expect(heroBox).toBeTruthy();
    expect(cardBox).toBeTruthy();
    expect(viewport).toBeTruthy();
    expect(heroBox!.height).toBeGreaterThan(viewport!.height * 0.45);
    // Modal centrado: o cartão cobre a zona média do ecrã.
    expect(cardBox!.y).toBeGreaterThan(viewport!.height * 0.12);
    expect(cardBox!.y + cardBox!.height).toBeLessThan(viewport!.height * 0.95);

    const img = hero.locator("img");
    await expect(img).toHaveAttribute("src", /stopwatt_1400x\.jpg/);

    const cta = page.getByRole("link", { name: "Order Now" }).first();
    const href = await cta.getAttribute("href");
    expect(href).toBeTruthy();
    const decoded = decodeURIComponent(href!);
    expect(decoded).toContain("gclid=test-gclid");
    expect(decoded).toContain("sub1=kw-1");
    expect(decoded).toContain("parent_click_id=" + PARENT_CLICK);
    expect(decoded).toContain("https://offer.example/buy");
    expect(errors).toEqual([]);
  });

  test("imagem inacessível não é trocada por uma foto genérica", async ({ page }) => {
    await openPresell(page, "cookies", "fail");
    await expect(page.locator("[data-presell-hero='unavailable']").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("[data-presell-hero='product'] img")).toHaveCount(0);
  });

  for (const viewport of [
    { name: "desktop", width: 1280, height: 800 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "telemóvel", width: 390, height: 844 },
  ]) {
    test(`palco do produto em ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openPresell(page, "dtc");
      const hero = page.locator("[data-presell-hero='product']").first();
      await expect(hero).toBeVisible();
      const box = await hero.boundingBox();
      expect(box!.width).toBeGreaterThan(Math.min(520, viewport.width * 0.42));
      expect(box!.height).toBeGreaterThan(220);
    });
  }

  test("aceitar cookies libera a página sem redirecionar", async ({ page }) => {
    await openPresell(page, "cookies");
    await expect(page.getByTestId("presell-cookie-card")).toBeVisible();
    await page.getByRole("button", { name: "Accept All" }).click();
    await expect(page.getByTestId("presell-cookie-card")).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/p/${PAGE_ID}`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const cta = page.getByRole("link", { name: "Order Now" }).first();
    await expect(cta).toBeVisible();
  });

  test("clicar no fundo não fecha nem navega", async ({ page }) => {
    await openPresell(page, "cookies");
    await page.getByTestId("presell-cookie-backdrop").click({ position: { x: 12, y: 12 }, force: true });
    await expect(page.getByTestId("presell-cookie-card")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/p/${PAGE_ID}`));
  });

  test("o espelho importado permanece visível com o modal de cookies", async ({ page }) => {
    const mirror = `<!doctype html><html><body><h1>StopWatt official page</h1><img src="${PNG}" alt="StopWatt unit" width="800" height="800"><p>${"The unit sits between the outlet and the appliance. ".repeat(12)}</p></body></html>`;
    await installPresell(page, presell("cookies", { content: { importMirrorSrcDoc: mirror } }), "ok");
    await page.goto(`/p/${PAGE_ID}?gclid=test-gclid&sub1=kw-1&parent_click_id=${PARENT_CLICK}`);
    const frame = page.frameLocator("iframe").first();
    await expect(frame.getByRole("heading", { name: "StopWatt official page" })).toBeVisible();
    await expect(page.getByTestId("presell-cookie-card")).toBeVisible();
    await expect(page.locator("[data-presell-hero='product']")).toHaveCount(0);
    await page.getByRole("button", { name: "Accept All" }).click();
    await expect(page.getByTestId("presell-cookie-card")).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/p/${PAGE_ID}`));
  });

  test("fechar o desconto vai ao rastreio", async ({ page }) => {
    await openPresell(page, "desconto");
    await page.route("**/track/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><title>tracked</title><h1>Tracked offer</h1>",
      }),
    );
    await expect(page.getByTestId("presell-discount-sheet")).toBeVisible();
    await page.getByTestId("presell-discount-sheet").getByRole("button", { name: "Fechar", exact: true }).click();
    await expect(page).toHaveURL(/\/track\//);
  });

  test("clicar fora do desconto vai ao rastreio", async ({ page }) => {
    await openPresell(page, "desconto");
    await page.route("**/track/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><title>tracked</title><h1>Tracked offer</h1>",
      }),
    );
    await page.getByTestId("presell-discount-backdrop").click({ position: { x: 12, y: 12 } });
    await expect(page).toHaveURL(/\/track\//);
  });

  test("rascunho não publicado não mostra a landing", async ({ page }) => {
    await page.route("**/public/presells/**", (route) =>
      route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Esta página ainda não está publicada. No painel, altere o estado para «Publicada».",
          code: "PRESHELL_NOT_PUBLISHED",
        }),
      }),
    );
    await page.goto(`/p/${PAGE_ID}`);
    await expect(page.getByText(/ainda não está publicada/)).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("[data-presell-hero='product']")).toHaveCount(0);
  });

  for (const type of ["tsl", "dtc", "vsl", "vsl_tsl"] as const) {
    test(`formato ${type} renderiza título e CTA com tracking`, async ({ page }) => {
      await openPresell(page, type);
      await expect(page.getByRole("heading", { name: /Stop Wasting Money/ })).toBeVisible();
      const cta = page.getByRole("link", { name: "Order Now" }).first();
      await expect(cta).toBeVisible();
      const href = decodeURIComponent((await cta.getAttribute("href")) || "");
      expect(href).toContain("gclid=test-gclid");
      if (type === "vsl" || type === "vsl_tsl") {
        await expect(page.locator("iframe[title='Vídeo']").first()).toBeVisible();
        await expect(page.locator("[data-presell-hero-emphasis='support']").first()).toBeVisible();
      } else {
        await expect(page.locator("[data-presell-hero-emphasis='primary']").first()).toBeVisible();
      }
    });
  }
});
