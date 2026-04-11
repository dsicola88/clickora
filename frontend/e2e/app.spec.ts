import { test, expect } from "@playwright/test";

test.describe("autenticação e rotas públicas", () => {
  test("página /auth exibe login", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByRole("heading", { name: "Entrar na sua conta" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeVisible();
  });

  test("visitante em / é redirecionado para /auth", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL("**/auth", { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Entrar na sua conta" })).toBeVisible();
  });
});
