import { test, expect } from "@playwright/test";

async function loginSeed(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/auth");
  await page.getByLabel("E-mail").fill("danielclickora@gmail.com");
  await page.getByLabel("Senha").fill("Dpa211088@");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  try {
    await page.waitForURL((url) => !url.pathname.includes("/auth"), { timeout: 25_000 });
  } catch {
    const hint = await page.getByText(/inválid|erro|incorret|não foi possível/i).first().textContent().catch(() => null);
    throw new Error(
      hint?.trim() ||
        "Login local falhou — ligue o PostgreSQL (Railway/local), `npm run api:db:migrate:deploy` e `npm run api:db:seed`.",
    );
  }
}

/**
 * Fluxo real: login → Pesquisa e anúncios → gerar campanha mínima → aba Copy vencedora.
 * Requer API + PostgreSQL (seed). Snapshots em e2e/keywords-magazine-studio.spec.ts-snapshots/
 */
test.describe("Pesquisa e anúncios — estúdio MAG", () => {
  test.beforeAll(async ({ request }) => {
    const health = await request.get("http://127.0.0.1:3001/api/health", { timeout: 15_000 }).catch(() => null);
    if (!health?.ok()) {
      test.skip(true, "API local indisponível — o Playwright precisa de `npm run api:dev` com DATABASE_URL acessível.");
    }
  });

  test("copy vencedora com títulos numerados e contagem", async ({ page }) => {
    test.setTimeout(180_000);
    await loginSeed(page);
    await page.goto("/palavras-chave");
    await expect(page.getByRole("heading", { name: "Pesquisa e anúncios" })).toBeVisible({ timeout: 20_000 });

    const recentPv = page.getByRole("button", { name: /PV V2/i }).first();
    if (await recentPv.isVisible().catch(() => false)) {
      await recentPv.click();
      await expect(page.getByRole("tab", { name: "Copy vencedora" })).toBeVisible({ timeout: 30_000 });
    } else {
      const pastedPageText =
        "GlucoTrust official website. Buy GlucoTrust with discount today. You save on bottles. " +
        "180 day money back guarantee. Free US shipping. Order online now.";
      await page.getByLabel("Nome do produto").fill("GlucoTrust");
      await page.getByLabel(/Link oficial do produto/i).fill("https://example.com/glucotrust");
      await page.getByLabel(/URL final do anúncio/i).fill("https://example.com/presell");
      await page.getByRole("button", { name: /Gerar campanha|Regenerar campanha/i }).click();
      await expect(page.locator("#kw-page-text")).toBeVisible({ timeout: 45_000 });
      await page.locator("#kw-page-text").fill(pastedPageText);
      const generateResponse = page.waitForResponse(
        (r) => r.url().includes("/api/keyword-researches/generate") && r.request().method() === "POST",
        { timeout: 120_000 },
      );
      await page.getByRole("button", { name: /Gerar campanha|Regenerar campanha/i }).click();
      const response = await generateResponse;
      if (!response.ok()) {
        const body = await response.text();
        throw new Error(`Geração falhou (${response.status()}): ${body.slice(0, 800)}`);
      }
      await expect(page.getByRole("tab", { name: "Copy vencedora" })).toBeVisible({ timeout: 30_000 });
    }

    await page.getByRole("tab", { name: "Copy vencedora" }).click();
    await expect(page.getByText("Títulos", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Copiar pacote completo/i })).toBeVisible();
    await expect(page.getByText(/\d+\/30/).first()).toBeVisible();

    await expect(page).toHaveScreenshot("keywords-copy-vencedora.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });
});
