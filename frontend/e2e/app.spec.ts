import { test, expect } from "@playwright/test";

test.describe("autenticação e rotas públicas", () => {
  test("página /auth exibe login", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByRole("heading", { name: "Entrar na sua conta" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeVisible();
  });

  test("visitante em / vê planos e pode ir ao login", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL((url) => new URL(url).pathname === "/", { timeout: 15_000 });
    // API pode ainda estar a aquecer — não falhar no ecrã de erro transitório.
    await expect(page.getByRole("heading", { level: 1 }).or(page.getByText(/Erro ao carregar planos/i))).toBeVisible({
      timeout: 20_000,
    });
    if (await page.getByText(/Erro ao carregar planos/i).isVisible().catch(() => false)) {
      await page.getByRole("button", { name: /Tentar novamente/i }).click();
    }
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 25_000 });
    await page.getByRole("link", { name: "Entrar", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "Entrar na sua conta" })).toBeVisible();
  });
});
