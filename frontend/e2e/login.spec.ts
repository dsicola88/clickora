import { test, expect } from "@playwright/test";

/**
 * Requer API em http://127.0.0.1:3001 (mesmo que `npm run dev` no backend) e seed aplicado.
 * Credenciais alinhadas com backend/prisma/seed.ts
 */
test.describe("login e-mail/senha", () => {
  test("utilizador seed entra e sai de /auth", async ({ page }) => {
    await page.goto("/auth");
    // i18n (en default no Chromium de teste): ids #email/#password são estáveis.
    await page.locator("#email").fill("danielclickora@gmail.com");
    await page.locator("#password").fill("Dpa211088@");
    await page.getByRole("button", { name: /^(Entrar|Continue|Sign in)$/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/auth"), { timeout: 20_000 });
    expect(page.url()).not.toContain("/auth");
  });
});
