import { expect, test } from "@playwright/test";

const PAGE_ID = "33333333-3333-4333-8333-333333333333";
const HEADLINE = "E2E Builder — título editado";

test.describe("presell builder — página pública", () => {
  test("renderiza documento do editor, cookies no idioma da página e CTA rastreável", async ({ page }) => {
    const body = {
      id: PAGE_ID,
      title: "Tea",
      slug: "e2e-builder",
      type: "builder",
      category: "sem",
      language: "pt-BR",
      status: "published",
      clicks: 0,
      impressions: 0,
      conversions: 0,
      settings: {
        businessName: "Operador E2E",
        contactEmail: "e2e@clickora.test",
      },
      tracking: {},
      footer_branding: false,
      created_at: "2026-10-15T00:00:00.000Z",
      updated_at: "2026-10-15T00:00:00.000Z",
      content: {
        affiliateLink: "https://en.wikipedia.org/wiki/Tea",
        pageDocument: {
          id: "page_e2e",
          name: "Tea",
          sections: [
            {
              id: "sec1",
              layout: "boxed",
              contentWidth: 860,
              columnGap: { desktop: 16 },
              styles: { padding: { desktop: { top: 28, right: 20, bottom: 48, left: 20, unit: "px" } } },
              columns: [
                {
                  id: "col1",
                  widthPercent: { desktop: 100 },
                  styles: {},
                  widgets: [
                    {
                      id: "w_img",
                      type: "image",
                      content: {
                        src: "https://upload.wikimedia.org/wikipedia/commons/d/d3/Longjing_tea_steeping_in_gaiwan.jpg",
                        alt: "Tea",
                      },
                      styles: { align: { desktop: "center" } },
                    },
                    {
                      id: "w_h1",
                      type: "heading",
                      content: { text: HEADLINE, tag: "h1" },
                      styles: {},
                    },
                    {
                      id: "w_txt",
                      type: "text",
                      content: {
                        html:
                          "<p>Conteúdo informativo independente. Não somos o fabricante. Podemos receber comissão por indicação.</p>",
                      },
                      styles: {},
                    },
                    {
                      id: "w_btn",
                      type: "button",
                      content: {
                        text: "Continuar para a página oficial da oferta",
                        href: "https://en.wikipedia.org/wiki/Tea",
                        target: "_self",
                      },
                      styles: { align: { desktop: "center" } },
                    },
                    {
                      id: "w_cookie",
                      type: "cookieBanner",
                      content: { variant: "modal", followLanguage: true },
                      styles: {},
                    },
                  ],
                },
              ],
            },
          ],
          settings: { background: "#ffffff", maxContentWidth: 860 },
          updatedAt: Date.now(),
        },
      },
    };

    await page.route("**/public/presells/**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }),
    );
    await page.route("**/track/**", (route) => route.fulfill({ status: 204, body: "" }));

    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto(`/p/${PAGE_ID}?gclid=e2e-gclid&sub1=kw-e2e`);
    await expect(page.getByRole("heading", { level: 1, name: HEADLINE })).toBeVisible();
    await expect(page.getByText(/Valorizamos a sua privacidade/i)).toBeVisible();
    await page.getByRole("button", { name: /Aceitar tudo/i }).click();
    await expect(page.getByText(/Valorizamos a sua privacidade/i)).toHaveCount(0);

    const cta = page.getByRole("link", { name: /Continuar para a página oficial/i }).first();
    await expect(cta).toBeVisible();
    const href = decodeURIComponent((await cta.getAttribute("href")) || "");
    expect(href).toContain("gclid=e2e-gclid");
    expect(href).toContain("/track/");
    expect(errors).toEqual([]);
  });
});
