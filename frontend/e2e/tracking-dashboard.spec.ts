import { test, expect } from "@playwright/test";

/**
 * GET /api/analytics/dashboard — requer API + PostgreSQL (seed).
 * Playwright inicia o backend via webServer em playwright.config.ts.
 */
test.describe("tracking dashboard", () => {
  test("utilizador seed vê o resumo sem erro 503", async ({ page }) => {
    await page.goto("/auth");
    await page.getByLabel("E-mail").fill("danielclickora@gmail.com");
    await page.getByLabel("Senha").fill("Dpa211088@");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL((url) => !url.pathname.includes("/auth"), { timeout: 25_000 });

    await page.goto("/tracking/dashboard");
    await expect(page.getByRole("heading", { name: /Bem-vindo/ })).toBeVisible({ timeout: 25_000 });
    await expect(page.getByRole("heading", { name: "Período", exact: true })).toBeVisible();
  });
});
