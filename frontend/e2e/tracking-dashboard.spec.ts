import { test, expect } from "@playwright/test";

/**
 * GET /api/analytics/dashboard — requer API + PostgreSQL (seed).
 * Playwright inicia o backend via webServer em playwright.config.ts.
 * /tracking/dashboard redirecciona para /resultados (P&L enterprise).
 */
test.describe("tracking dashboard / P&L", () => {
  test("utilizador seed vê o P&L sem erro 503", async ({ page }) => {
    test.setTimeout(120_000);
    // Garante API pronta (Railway remoto no .env local pode demorar a 1.º pedido).
    await expect
      .poll(async () => {
        const r = await page.request.get("http://127.0.0.1:3001/api/health");
        return r.status();
      }, { timeout: 60_000 })
      .toBe(200);

    await page.goto("/auth");
    await page.getByLabel("E-mail").fill("danielclickora@gmail.com");
    await page.getByLabel("Senha").fill("Dpa211088@");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL((url) => !url.pathname.includes("/auth"), { timeout: 45_000 });

    await page.goto("/tracking/dashboard");
    await expect(page).toHaveURL(/\/resultados\/?$/, { timeout: 15_000 });
    await expect(page.getByText(/A carregar resultados/i)).toHaveCount(0, { timeout: 90_000 });
    await expect(page.getByRole("heading", { name: /^Resultados$/ })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Receita|Cliques|Keywords|Braços|Visitantes/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
