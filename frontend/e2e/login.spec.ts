import { test, expect } from "@playwright/test";

/**
 * Requer API em http://127.0.0.1:3001 (mesmo que `npm run dev` no backend) e seed aplicado.
 * Credenciais alinhadas com backend/prisma/seed.ts (CI usa CI_SEED_PASSWORD).
 */
/** Em GitHub Actions o seed usa CI_SEED_PASSWORD; localmente mantém a password de desenvolvimento. */
const E2E_PASSWORD =
  process.env.CI_SEED_PASSWORD ||
  process.env.E2E_PASSWORD ||
  process.env.LOAD_TEST_PASSWORD ||
  "Dpa211088@";

test.describe("login e-mail/senha", () => {
  test("utilizador seed entra e sai de /auth", async ({ page }) => {
    await page.goto("/auth");
    // i18n (en default no Chromium de teste): ids #email/#password são estáveis.
    await page.locator("#email").fill("danielclickora@gmail.com");
    await page.locator("#password").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: /^(Entrar|Continue|Sign in)$/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/auth"), { timeout: 20_000 });
    expect(page.url()).not.toContain("/auth");
  });
});
