import { test, expect } from "@playwright/test";

test.describe("autenticação e rotas públicas", () => {
  test("página /auth exibe login", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByRole("heading", { name: "Entrar na sua conta" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeVisible();
  });

  test("visitante em / vê vendas (funil) e pode ir ao login", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL("**/tracking/vendas", { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Funil de Conversões" })).toBeVisible();
    await page.getByRole("link", { name: "Entrar", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Entrar na sua conta" })).toBeVisible();
  });
});
