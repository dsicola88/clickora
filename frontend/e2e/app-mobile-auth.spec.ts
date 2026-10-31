/**
 * H9 — layout mobile autenticado (viewport estreito + rotas principais do app).
 * Usa Chromium do project config (sem channel webkit do device iPhone).
 * Requer API audit acessível via VITE (3011) e utilizador seed/audit.
 */
import { expect, test } from "@playwright/test";

const EMAIL = process.env.E2E_EMAIL || process.env.LOAD_TEST_EMAIL || "danielclickora1@gmail.com";
const PASSWORD = process.env.E2E_PASSWORD || process.env.LOAD_TEST_PASSWORD || "Dpa211088@";

test.describe("H9 — app autenticado mobile", () => {
  test.describe.configure({ mode: "serial" });

  test("login mobile e rotas principais sem overflow horizontal", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/auth", { waitUntil: "domcontentloaded" });
    await expect(page.getByLabel(/e-mail|email/i)).toBeVisible({ timeout: 20_000 });
    await page.getByLabel(/e-mail|email/i).fill(EMAIL);
    await page.getByLabel(/senha|password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /^entrar$/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/auth"), { timeout: 25_000 });

    const routes = ["/presells", "/presells/nova", "/tracking/rotadores", "/resultados", "/integracoes"];
    for (const path of routes) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(page.url()).not.toContain("/auth");
      // Esperar conteúdo real (não só shell/spinner)
      await expect
        .poll(async () => (await page.locator("body").innerText()).trim().length, { timeout: 25_000 })
        .toBeGreaterThan(40);
      await expect(page.locator("h1, h2, [role='heading'], nav, main").first()).toBeVisible({ timeout: 15_000 });
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
      });
      expect(overflow.scrollWidth, `${path} overflow`).toBeLessThanOrEqual(overflow.clientWidth + 8);
    }
  });
});
