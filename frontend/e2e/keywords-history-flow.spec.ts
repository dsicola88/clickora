import { test, expect } from "@playwright/test";

async function loginSeed(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/auth");
  await page.getByLabel("E-mail").fill("danielclickora@gmail.com");
  await page.getByLabel("Senha").fill("Dpa211088@");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes("/auth"), { timeout: 25_000 });
}

const PASTED_PAGE_TEXT =
  "Official product page. Buy online with discount today. Money back guarantee. Free shipping. Order now.";

async function generateMinimalCampaign(page: import("@playwright/test").Page, productName: string) {
  await page.getByLabel("Nome do produto").fill(productName);
  await page.getByLabel(/Link oficial do produto/i).fill("https://example.com/offer");
  await page.getByLabel(/URL final do anúncio/i).fill("https://example.com/presell");
  await page.getByRole("button", { name: /Gerar campanha|Regenerar campanha/i }).click();

  const pageText = page.locator("#kw-page-text");
  const copyTab = page.getByRole("tab", { name: "Copy vencedora" });
  await Promise.race([
    pageText.waitFor({ state: "visible", timeout: 60_000 }),
    copyTab.waitFor({ state: "visible", timeout: 120_000 }),
  ]).catch(() => null);

  if (await pageText.isVisible()) {
    await pageText.fill(PASTED_PAGE_TEXT);
    const generateResponse = page.waitForResponse(
      (r) => r.url().includes("/api/keyword-researches/generate") && r.request().method() === "POST",
      { timeout: 120_000 },
    );
    await page.getByRole("button", { name: /Gerar campanha|Regenerar campanha/i }).click();
    const response = await generateResponse;
    expect(response.ok(), `generate failed: ${await response.text()}`).toBeTruthy();
  }

  await expect(copyTab).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: productName, exact: true })).toBeVisible();
}

test.describe("Pesquisa e anúncios — várias campanhas e histórico", () => {
  test.beforeAll(async ({ request }) => {
    const health = await request.get("http://127.0.0.1:3001/api/health", { timeout: 15_000 }).catch(() => null);
    if (!health?.ok()) {
      test.skip(true, "API local indisponível.");
    }
  });

  test("cria duas campanhas, apaga uma e limpa o histórico", async ({ page }) => {
    test.setTimeout(240_000);
    await loginSeed(page);
    await page.goto("/palavras-chave");
    await expect(page.getByRole("heading", { name: "Pesquisa e anúncios" })).toBeVisible({ timeout: 20_000 });

    const clearAll = page.getByRole("button", { name: "Limpar tudo" });
    if (await clearAll.isVisible().catch(() => false)) {
      await clearAll.click();
      await page.getByRole("button", { name: "Apagar tudo" }).click();
      await expect(page.locator("aside").getByText("Ainda não existem pesquisas.")).toBeVisible({ timeout: 15_000 });
    }

    const productA = `E2E Alpha ${Date.now().toString(36)}`;
    const productB = `E2E Beta ${Date.now().toString(36)}`;

    await generateMinimalCampaign(page, productA);
    await page.getByRole("button", { name: "Nova campanha" }).click();
    await expect(page.getByLabel("Nome do produto")).toHaveValue("");
    await generateMinimalCampaign(page, productB);

    await expect(page.locator("aside").getByText(productA, { exact: true })).toBeVisible();
    await expect(page.locator("aside").getByText(productB, { exact: true })).toBeVisible();

    await page.getByRole("button", { name: `Apagar pesquisa ${productA}` }).click();
    await expect(page.locator("aside").getByText(productA, { exact: true })).toHaveCount(0, { timeout: 15_000 });

    await page.getByRole("button", { name: "Limpar tudo" }).click();
    await page.getByRole("button", { name: "Apagar tudo" }).click();
    await expect(page.locator("aside").getByText("Ainda não existem pesquisas.")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel("Nome do produto")).toBeVisible();
  });
});
