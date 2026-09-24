/**
 * Auditoria pro-ready: parsers, mirror fidelity, soft-cap semantics, Automizer exports.
 * Corre sem API (unitário). Para E2E atribuição: scripts/e2e-conversion-attribution-audit.ts
 *
 *   npx tsx scripts/e2e-pro-ready-audit.ts
 */
import assert from "node:assert/strict";
import {
  isApprovedSaleStatus,
  isNegativeSaleEvent,
  isPendingSaleStatus,
  extractSaleStatusFromPayload,
} from "../src/lib/affiliatePostbackParsers";
import {
  finalizeMirrorSrcDocForImport,
  buildMirrorSrcDocFromParts,
  MIRROR_RESPONSIVE_STYLE_IN_HEAD,
  mirrorUrlShouldUseTrackMarker,
  tryExtractUrlFromInlineHandler,
} from "../src/lib/presellMirrorSnapshot";
import { assessClickQuality, detectBot } from "../src/lib/detectBot";

type Row = { id: string; ok: boolean; detail: string };
const rows: Row[] = [];

function check(id: string, ok: boolean, detail: string) {
  rows.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

async function main() {
  /** 1. Postback lifecycle */
  {
    check(
      "pending_status",
      isPendingSaleStatus("pending") && isPendingSaleStatus("on_hold") && !isPendingSaleStatus("approved"),
      "pending/hold reconhecidos",
    );
    const refundFlat = {
      billing_status: "completed",
      transaction_type: "refund",
    };
    check(
      "refund_negative",
      isNegativeSaleEvent(refundFlat) && isApprovedSaleStatus(extractSaleStatusFromPayload(refundFlat)),
      "refund não cria venda nova (isNegative)",
    );
  }

  /** 2. Mirror fidelity — CSS/layout preservados, CTAs reescritos */
  {
    const page = "https://example-product.com/offer";
    const hop = "https://buygoods.com/secure/checkout?aff_id=1";
    const head = `<style>.hero{background:#111;color:#fff;font-size:48px}.pack{width:400px}</style>
<link rel="stylesheet" href="https://example-product.com/theme.css">`;
    const body = `
<section class="hero"><h1>Produto Original XYZ</h1>
<img src="/images/pack.png" width="400" height="400" alt="pack">
<button type="button" onclick="location.href='${hop}'">Buy Now</button>
<a href="${hop}">Checkout</a>
<p class="copy">Texto longo da sales page com tipografia própria.</p>
</section>`;
    const raw = buildMirrorSrcDocFromParts(page, head, body);
    const fin = finalizeMirrorSrcDocForImport(raw, page, hop);
    assert.ok(fin && fin.length > 200, "finalize devolve HTML");
    check("mirror_keeps_css", Boolean(fin!.includes(".hero{background:#111")), "CSS .hero preservado");
    check("mirror_keeps_heading", Boolean(fin!.includes("Produto Original XYZ")), "headline original");
    check("mirror_keeps_img", Boolean(fin!.includes("pack.png")), "imagem do pack");
    check(
      "mirror_rewrites_buygoods",
      Boolean(fin!.includes("clickora.invalid/__TRACK_OFFER__")),
      "CTA BuyGoods → marcador tracking",
    );
    check(
      "mirror_soft_responsive",
      MIRROR_RESPONSIVE_STYLE_IN_HEAD.includes("img,video{max-width:100%") &&
        !MIRROR_RESPONSIVE_STYLE_IN_HEAD.includes("overflow-wrap:anywhere") &&
        !MIRROR_RESPONSIVE_STYLE_IN_HEAD.includes("box-sizing:border-box"),
      "CSS responsive mínimo (não destrói layout)",
    );
    check("mirror_capacity", fin!.length < 1_400_000, `tamanho ${fin!.length} chars (limite 1.4M)`);
  }

  /** 3. Anti-fraude */
  {
    check("bot_empty_ua", detectBot("").isBot === true, "UA vazio = bot");
    check("bot_chrome", detectBot("Mozilla/5.0 Chrome/120").isBot === false, "Chrome não é bot");
    const q = assessClickQuality({
      userAgent: "Mozilla/5.0",
      headers: { "cf-ipcountry": "T1", via: "1.1 proxy" },
    });
    check("fraud_tor_proxy", q.is_proxy_suspect && q.fraud_score >= 50, `score=${q.fraud_score}`);
  }

  /** 4. Tracking marker helpers */
  {
    const u = new URL("https://buygoods.com/secure/checkout?aff_id=9");
    check(
      "marker_buygoods",
      mirrorUrlShouldUseTrackMarker(u, new Set()),
      "checkout BuyGoods usa marcador",
    );
    check(
      "onclick_extract",
      tryExtractUrlFromInlineHandler("location.href='https://x.com/buy'") === "https://x.com/buy",
      "onclick → URL",
    );
  }

  /** 5. Módulos affiliateOps */
  {
    try {
      await import("../src/modules/affiliateOps/costSync.service");
      await import("../src/modules/affiliateOps/keywordAutomizer.service");
      await import("../src/modules/affiliateOps/keepAlive");
      check("affiliate_ops_modules", true, "costSync + automizer + keepAlive");
    } catch (e) {
      check("affiliate_ops_modules", false, e instanceof Error ? e.message : String(e));
    }
  }

  /** 6. Google Ads retraction/restatement */
  {
    try {
      const g = await import("../src/modules/googleAds/googleAds.service");
      check(
        "google_retraction_restatement",
        typeof g.retractConversionFromGoogleAds === "function" &&
          typeof g.restateConversionToGoogleAds === "function",
        "RETRACTION + RESTATEMENT exportados",
      );
    } catch (e) {
      check("google_retraction_restatement", false, e instanceof Error ? e.message : String(e));
    }
  }

  const failed = rows.filter((r) => !r.ok);
  console.log("\n---");
  console.log(`Total ${rows.length} | PASS ${rows.length - failed.length} | FAIL ${failed.length}`);
  if (failed.length) {
    for (const f of failed) console.error(`  ✗ ${f.id}: ${f.detail}`);
    process.exit(1);
  }
  console.log("PRO-READY AUDIT OK");
}

void main();
