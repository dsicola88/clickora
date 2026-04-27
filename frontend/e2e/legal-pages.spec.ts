import { test, expect } from "@playwright/test";

test.describe("páginas legais públicas", () => {
  test("/privacidade mostra política", async ({ page }) => {
    await page.goto("/privacidade");
    await expect(page.getByRole("heading", { name: "Política de privacidade" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Início" })).toBeVisible();
  });

  test("/termos mostra termos", async ({ page }) => {
    await page.goto("/termos");
    await expect(page.getByRole("heading", { name: "Termos de utilização" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Início" })).toBeVisible();
  });
});
