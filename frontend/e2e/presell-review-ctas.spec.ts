import { expect, test, type Page, type Route } from "@playwright/test";

const PAGE_ID = "c7e11e11-1111-4111-8111-111111111111";
const HOP = "https://www.buygoods.com/secure/checkout?item=visivra-e2e";

function reviewBody() {
  return {
    id: PAGE_ID,
    title: "Visivra review e2e",
    slug: "visivra-review-e2e",
    type: "review",
    category: "health",
    language: "en",
    status: "published",
    clicks: 0,
    impressions: 0,
    conversions: 0,
    settings: {
      businessName: "Independent review",
      cookiePolicyUrl: "/privacidade",
      privacyPolicyUrl: "/privacidade",
      termsUrl: "/termos",
    },
    tracking: {},
    footer_branding: false,
    created_at: "2026-10-16T00:00:00.000Z",
    updated_at: "2026-10-16T00:00:00.000Z",
    content: {
      title: "Visivra",
      productName: "Visivra",
      ctaText: "Order Now",
      affiliateLink: HOP,
      generationNiche: "white",
      sourceUrl: "https://www.visivra.today/",
      importMirrorSrcDoc: `<!doctype html><html><head><style>body{font-family:system-ui;margin:0}a,button{margin:8px}</style></head><body>
<nav><a href="https://www.visivra.today/">Home</a><a class="btn" href="#order">ORDER NOW</a></nav>
<h1>Visivra Review</h1>
<p>Independent analysis of the formula.</p>
<a href="https://www.buygoods.com/secure/checkout?item=1">BUY NOW</a>
<button class="elementor-button">Get VISIVRA from official site</button>
<div id="order">
  <a class="btn" href="#">Starter Package</a>
  <a href="https://www.buygoods.com/secure/checkout?item=2">Best Value</a>
</div>
<footer>
  <a href="/privacy">Privacy Policy</a>
  <a href="/disclaimer">Disclaimer</a>
  <a href="/refund">Refund</a>
  <a href="https://buygoods.com"><img alt="buygoods" src="https://cdn.buygoods.com/logo.png"></a>
</footer>
</body></html>`,
    },
  };
}

async function install(page: Page) {
  const fulfill = (route: Route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(reviewBody()) });
  await page.route("**/public/presells/**", fulfill);
  await page.route("**/api/public/presells/**", fulfill);
  await page.route("**/track/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>tracked</title><h1>Tracked offer</h1>",
    }),
  );
}

test.describe("Review / análise — CTAs reais com hoplink", () => {
  test("todos os botões de oferta no HTML público levam /track/r/", async ({ page }) => {
    await install(page);
    await page.goto(`/p/${PAGE_ID}?gclid=review-real-gclid&utm_source=google_ads`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByText(/Visivra Review/i).first()).toBeVisible({ timeout: 20_000 });

    const report = await page.evaluate(() => {
      const ctaRe =
        /order\s*now|buy\s*now|get visivra|starter package|best value|official site/i;
      const softRe = /privacy|disclaimer|refund|^home$/i;
      const nodes: Element[] = [];
      const walk = (root: Document | ShadowRoot) => {
        root.querySelectorAll("a, button").forEach((el) => nodes.push(el));
        root.querySelectorAll("*").forEach((el) => {
          if (el.shadowRoot) walk(el.shadowRoot);
        });
      };
      walk(document);
      const all = nodes.map((el) => {
        const tag = el.tagName.toLowerCase();
        const text = (el.textContent || "").replace(/\s+/g, " ").trim();
        const href = el.getAttribute("href") || "";
        const offer = el.getAttribute("data-clickora-offer") === "1";
        return { tag, text, href, offer };
      });
      const ctas = all.filter((n) => ctaRe.test(n.text) && !softRe.test(n.text));
      const legal = all.filter((n) => /privacy|disclaimer|refund/i.test(n.text));
      return { ctas, legal, all };
    });

    expect(report.ctas.length, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(4);

    for (const cta of report.ctas) {
      expect(cta.href, `CTA sem link: ${cta.text}`).toMatch(/\/track\/r\//);
      expect(cta.href, `CTA sem hoplink na query: ${cta.text}`).toMatch(/buygoods|to=/i);
      expect(cta.href).toContain("review-real-gclid");
    }

    for (const link of report.legal) {
      if (/privacy|disclaimer|refund/i.test(link.text)) {
        expect(link.href, `legal virou oferta: ${link.text}`).not.toMatch(/\/track\/r\//);
      }
    }

    const orderNow = page.locator("a").filter({ hasText: /^ORDER NOW$/i }).first();
    await expect(orderNow).toHaveAttribute("href", /\/track\/r\//);
    await orderNow.click();
    await expect(page.getByRole("heading", { name: /Tracked offer/i })).toBeVisible({
      timeout: 10_000,
    });
  });
});
