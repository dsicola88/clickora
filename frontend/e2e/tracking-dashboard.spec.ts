import { test, expect } from "@playwright/test";

/**
 * GET /api/analytics/dashboard — requer API + PostgreSQL (seed).
 * Playwright inicia o backend via webServer em playwright.config.ts.
 * /tracking/dashboard redirecciona para /resultados (P&L enterprise).
 */
test.describe("tracking dashboard / P&L", () => {
  test("utilizador seed vê o P&L sem erro 503", async ({ page }) => {
    await page.goto("/auth");
    await page.getByLabel("E-mail").fill("danielclickora@gmail.com");
    await page.getByLabel("Senha").fill("Dpa211088@");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL((url) => !url.pathname.includes("/auth"), { timeout: 25_000 });

    await page.goto("/tracking/dashboard");
    await expect(page).toHaveURL(/\/resultados\/?$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /^P&L$/ })).toBeVisible({ timeout: 25_000 });
    await expect(page.getByText(/Receita|Cliques|Keywords/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
