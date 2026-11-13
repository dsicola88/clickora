import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLICKORA_MIRROR_TRACK_MARKER,
  buildMirrorPartsFromStaticHtml,
  finalizeMirrorSrcDocForImport,
  mirrorUrlShouldUseTrackMarker,
  sanitizeMirrorSrcDocFromEditor,
  tryExtractUrlFromInlineHandler,
} from "./presellMirrorSnapshot";

describe("mirrorUrlShouldUseTrackMarker", () => {
  const hosts = new Set(["lander.example"]);

  it("buygoods checkout uses marker even when hoplink host differs", () => {
    assert.equal(
      mirrorUrlShouldUseTrackMarker(new URL("https://www.buygoods.com/secure/checkout.html?vid=tsl"), hosts),
      true,
    );
  });

  it("does not rewrite unrelated external articles", () => {
    assert.equal(mirrorUrlShouldUseTrackMarker(new URL("https://www.ncbi.nlm.nih.gov/books/"), hosts), false);
  });

  it("rewrites same host as import page / affiliate set", () => {
    assert.equal(
      mirrorUrlShouldUseTrackMarker(new URL("https://lander.example/other-page"), hosts),
      true,
    );
  });

  it("skips image assets", () => {
    assert.equal(
      mirrorUrlShouldUseTrackMarker(new URL("https://cdn.example.com/img/bottle.png"), hosts),
      false,
    );
  });
});

describe("tryExtractUrlFromInlineHandler", () => {
  it("quoted location.href", () => {
    assert.equal(
      tryExtractUrlFromInlineHandler(`void(location.href='https://hop.example/o?id=1')`),
      "https://hop.example/o?id=1",
    );
  });

  it("double-quoted window.location", () => {
    assert.equal(
      tryExtractUrlFromInlineHandler(`window.location = "https://offer.test/buy"`),
      "https://offer.test/buy",
    );
  });

  it("window.open", () => {
    assert.equal(tryExtractUrlFromInlineHandler(`window.open('https://x.example/y')`), "https://x.example/y");
  });

  it("location.assign", () => {
    assert.equal(tryExtractUrlFromInlineHandler(`location.assign("https://z.example")`), "https://z.example");
  });

  it("rejects javascript:", () => {
    assert.equal(tryExtractUrlFromInlineHandler(`location.href='javascript:void(0)'`), null);
  });

  it("empty or useless", () => {
    assert.equal(tryExtractUrlFromInlineHandler(""), null);
    assert.equal(tryExtractUrlFromInlineHandler("return false"), null);
  });
});

describe("sanitizeMirrorSrcDocFromEditor", () => {
  it("remove contenteditable e mantém marcador de track no CTA", () => {
    const html = `<!DOCTYPE html><html><head></head><body>
<h1 contenteditable="true" class="editable-element">Title</h1>
<p contenteditable="true" class="editable-element">Body copy</p>
<a href="https://www.buygoods.com/secure/checkout.html?x=1">Buy Now</a>
</body></html>`;
    const out = sanitizeMirrorSrcDocFromEditor(
      html,
      "https://offer.example/land",
      "https://www.buygoods.com/secure/checkout.html?x=1",
    );
    assert.ok(out);
    assert.ok(!out!.includes("contenteditable"));
    assert.ok(!out!.includes("editable-element"));
    assert.ok(out!.includes(CLICKORA_MIRROR_TRACK_MARKER));
    assert.match(out!, /Title/);
  });
});

describe("finalizeMirrorSrcDocForImport (onclick → href)", () => {
  it("turns button with location.href onclick into track link", () => {
    const html = `<!DOCTYPE html><html><head></head><body>
<button type="button" class="cta" onclick="location.href='https://offer.example/buy?x=1'">Buy</button>
</body></html>`;
    const out = finalizeMirrorSrcDocForImport(
      html,
      "https://offer.example/land",
      "https://offer.example/buy?x=1",
    );
    assert.ok(out);
    assert.ok(out!.includes(CLICKORA_MIRROR_TRACK_MARKER));
    assert.ok(out!.includes(">Buy<") || out!.includes(">Buy</a>"));
    assert.ok(!out!.toLowerCase().includes("onclick"));
  });

  it("rewrites buygoods anchor when affiliate link is another domain", () => {
    const html = `<!DOCTYPE html><html><head></head><body>
<a href="https://www.buygoods.com/secure/checkout.html?aff_id=190743&vid1=tsl">Buy Now</a>
</body></html>`;
    const out = finalizeMirrorSrcDocForImport(
      html,
      "https://vendorsite.example/presell",
      "https://my.rotator.example/track?id=1",
    );
    assert.ok(out);
    assert.ok(out!.includes(CLICKORA_MIRROR_TRACK_MARKER));
  });

  it("promove o srcset grande para src e mantém o srcset", () => {
    const html = `<!DOCTYPE html><html><head></head><body>
<img src="https://cdn.example/pack_300x300.jpg" srcset="https://cdn.example/pack_300x300.jpg 300w, https://cdn.example/pack_1400x.jpg 1400w" alt="Pack" />
</body></html>`;
    const out = finalizeMirrorSrcDocForImport(html, "https://offer.example/land", "https://offer.example/buy");
    assert.ok(out);
    assert.match(out!, /src="https:\/\/cdn\.example\/pack_1400x\.jpg"/);
    assert.match(out!, /srcset=/);
  });

  it("promove Tailwind bg-[url(...)] relativo para background-image inline absoluto", () => {
    const html = `<!DOCTYPE html><html><head></head><body>
<section class="hero md:tw-bg-[url('./assets/images/header-bg-v4.jpg')] tw-bg-cover">
<h1>Offer</h1>
</section>
</body></html>`;
    const out = finalizeMirrorSrcDocForImport(
      html,
      "https://melaramax.com/land",
      "https://hop.example/buy",
    );
    assert.ok(out);
    assert.match(
      out!,
      /background-image:\s*url\(https:\/\/melaramax\.com\/assets\/images\/header-bg-v4\.jpg\)/,
    );
    // Classe original mantém-se (CSS compilado); inline garante 1ª dobra mesmo se o CSS falhar.
    assert.match(out!, /md:tw-bg-\[url\('\.\/assets\/images\/header-bg-v4\.jpg'\)\]/);
  });

  it("promove data-src lazy para src", () => {
    const html = `<!DOCTYPE html><html><head></head><body>
<img src="data:image/svg+xml,%3Csvg/%3E" data-src="/img/product.jpg" alt="P" />
</body></html>`;
    const out = finalizeMirrorSrcDocForImport(
      html,
      "https://shop.example/",
      "https://shop.example/buy",
    );
    assert.ok(out);
    assert.match(out!, /src="https:\/\/shop\.example\/img\/product\.jpg"/);
  });

  it("absolutiza url() em <style> e injeta background no .hero", () => {
    const html = `<!DOCTYPE html><html><head>
<style>
.hero { --header-bg: url('assets/images/header-bg-mobile-v4.jpg'); background-image: var(--header-bg); }
@media (min-width: 768px) { .hero { --header-bg: url('./assets/images/header-bg-v4.jpg'); } }
</style>
</head><body>
<section class="hero"><h1>Offer</h1></section>
</body></html>`;
    const out = finalizeMirrorSrcDocForImport(
      html,
      "https://melaramax.com/",
      "https://hop.example/buy",
    );
    assert.ok(out);
    assert.match(out!, /url\(https:\/\/melaramax\.com\/assets\/images\/header-bg/);
    assert.match(out!, /style="[^"]*background-image:url\(https:\/\/melaramax\.com\/assets\/images\/header-bg/);
  });

  it("absolutiza assets relativos para sobreviver à neutralização do <base>", () => {
    const html = `<!DOCTYPE html><html><head>
<base href="https://melaramax.com/">
<link rel="stylesheet" href="./assets/css/theme.css">
</head><body>
<img src="./assets/images/pack.png" alt="Pack" />
<img src="data:image/svg+xml,%3Csvg/%3E" data-src="./assets/images/logo.svg" alt="L" />
</body></html>`;
    const out = finalizeMirrorSrcDocForImport(
      html,
      "https://melaramax.com/",
      "https://hop.example/buy",
    );
    assert.ok(out);
    // Simula bake do cliente
    const baked = out!.replace(/<base\b[^>]*>/gi, '<base href="./">');
    assert.match(baked, /src="https:\/\/melaramax\.com\/assets\/images\/pack\.png"/);
    assert.match(baked, /src="https:\/\/melaramax\.com\/assets\/images\/logo\.svg"/);
    assert.match(baked, /href="https:\/\/melaramax\.com\/assets\/css\/theme\.css"/);
    assert.doesNotMatch(baked, /src="\.\/assets\//);
  });
});

describe("buildMirrorPartsFromStaticHtml", () => {
  it("extrai head CSS e body para espelho sem Playwright", () => {
    const pad = "x".repeat(700);
    const html = `<!DOCTYPE html><html><head>
<link rel="stylesheet" href="/app.css">
<style>.hero{color:red}</style>
<script>alert(1)</script>
</head><body>
<h1>Visivra Offer</h1>
<p>Long enough copy for the static mirror fallback path to accept this document. ${pad}</p>
<a class="btn" href="/buy">Order Now</a>
<script>evil()</script>
</body></html>`;
    const parts = buildMirrorPartsFromStaticHtml(html, "https://tryvisivra.com/pv-v2");
    assert.ok(parts);
    assert.match(parts!.baseHref, /tryvisivra\.com/);
    assert.match(parts!.headSnip, /app\.css/);
    assert.match(parts!.headSnip, /\.hero\{color:red\}/);
    assert.doesNotMatch(parts!.headSnip, /<script/i);
    assert.match(parts!.bodyInner, /Visivra Offer/);
    assert.match(parts!.bodyInner, /Order Now/);
    assert.doesNotMatch(parts!.bodyInner, /<script/i);
  });
});
