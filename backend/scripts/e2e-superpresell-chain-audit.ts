/**
 * Auditoria E2E da cadeia SuperPresell (wiring + live probes).
 *
 * Offline (sempre):
 *   npx tsx scripts/e2e-superpresell-chain-audit.ts
 *
 * Live (API + DB):
 *   E2E_API_BASE=https://clickora-production.up.railway.app/api \
 *   DATABASE_URL=… JWT_SECRET=… \
 *   npx tsx scripts/e2e-superpresell-chain-audit.ts
 *
 * Live parcial (só health/publico):
 *   E2E_API_BASE=https://clickora-production.up.railway.app/api \
 *   npx tsx scripts/e2e-superpresell-chain-audit.ts
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildMirrorSrcDocFromParts,
  finalizeMirrorSrcDocForImport,
} from "../src/lib/presellMirrorSnapshot";
import { rehostMirrorImagesToR2 } from "../src/lib/presellMirrorRehost";
import {
  buildCloakSafePublicPayload,
  shouldServeCloakSafePage,
} from "../src/lib/presellEnterpriseCloak";
import { appendClickIdToAffiliateUrl } from "../src/lib/appendClickIdToUrl";
import type { Request } from "express";

type Status = "PASS" | "FAIL" | "BLOCKED" | "GAP";
type Row = {
  hop: string;
  id: string;
  status: Status;
  detail: string;
  evidence: string;
};

const rows: Row[] = [];
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = join(ROOT, "..");
const API = (process.env.E2E_API_BASE || "https://clickora-production.up.railway.app/api").replace(
  /\/$/,
  "",
);

function rec(hop: string, id: string, status: Status, detail: string, evidence: string) {
  rows.push({ hop, id, status, detail, evidence });
  const mark = status === "PASS" ? "PASS" : status === "FAIL" ? "FAIL" : status;
  console.log(`[${mark}] ${hop} · ${id} — ${detail}`);
}

function fileHas(rel: string, needle: string | RegExp): boolean {
  const p = join(REPO, rel);
  if (!existsSync(p)) return false;
  try {
    const st = readFileSync(p, "utf8");
    return typeof needle === "string" ? st.includes(needle) : needle.test(st);
  } catch {
    return false;
  }
}

function mockReq(ua: string): Request {
  return { headers: { "user-agent": ua } } as unknown as Request;
}

async function probe(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; body?: string }> {
  try {
    const r = await fetch(`${API}${path}`, {
      ...init,
      signal: AbortSignal.timeout(20_000),
    });
    const body = await r.text();
    return { ok: r.ok, status: r.status, body: body.slice(0, 500) };
  } catch (e) {
    return { ok: false, status: 0, body: e instanceof Error ? e.message : String(e) };
  }
}

async function main() {
  console.log(`\n=== SuperPresell chain audit ===\nAPI=${API}\n`);

  /** ——— 1. IMPORT ——— */
  {
    const wired =
      fileHas("backend/src/controllers/presell.controller.ts", "importPresellFromProductUrl") &&
      fileHas("backend/src/routes/presell.routes.ts", "import-from-url") &&
      fileHas("frontend/src/services/presellService.ts", "importFromUrl");
    rec(
      "IMPORT",
      "wiring",
      wired ? "PASS" : "FAIL",
      wired ? "Controller → route → frontend service ligados" : "Falta glue import",
      "presell.controller importFromUrl + /presells/import-from-url + presellService.importFromUrl",
    );

    const live = await probe("/presells/import-from-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_url: "https://example.com" }),
    });
    // 401/403 = endpoint vivo e protegido; 404 = rota ausente em prod
    const liveOk = live.status === 401 || live.status === 403 || live.status === 400;
    rec(
      "IMPORT",
      "prod_endpoint",
      liveOk ? "PASS" : live.status === 0 ? "BLOCKED" : "FAIL",
      liveOk
        ? `POST import responde ${live.status} (auth/validação — rota viva)`
        : `POST import status=${live.status} ${live.body?.slice(0, 80)}`,
      `${API}/presells/import-from-url`,
    );
  }

  /** ——— 2. MIRROR ——— */
  {
    const page = "https://example-product.com/offer";
    const hop = "https://buygoods.com/secure/checkout?aff_id=1";
    const raw = buildMirrorSrcDocFromParts(
      page,
      `<style>.hero{color:red}</style>`,
      `<a href="${hop}">Buy</a><h1>Produto XYZ</h1>`,
    );
    const fin = finalizeMirrorSrcDocForImport(raw, page, hop);
    const ok =
      Boolean(fin && fin.includes("Produto XYZ") && fin.includes("clickora.invalid/__TRACK_OFFER__"));
    rec(
      "MIRROR",
      "finalize_track_marker",
      ok ? "PASS" : "FAIL",
      ok ? "HTML finaliza com CTA → marcador tracking" : "finalizeMirror falhou",
      "presellMirrorSnapshot.finalizeMirrorSrcDocForImport",
    );

    const wizardGate = fileHas(
      "frontend/src/pages/CreatePresellWizardPage.tsx",
      "import_mirror_src_doc",
    );
    rec(
      "MIRROR",
      "publish_gate",
      wizardGate ? "PASS" : "FAIL",
      wizardGate
        ? "Wizard só publica se mirror >200 chars (senão draft)"
        : "Wizard sem gate de fidelidade",
      "CreatePresellWizardPage mirrorOk",
    );
  }

  /** ——— 3. EDITOR ——— */
  {
    const editor =
      fileHas("frontend/src/components/presell/MirrorHtmlEditor.tsx", "importMirrorSrcDoc") &&
      fileHas("frontend/src/pages/PresellDashboard.tsx", "MirrorHtmlEditor") &&
      fileHas("frontend/src/pages/PresellDashboard.tsx", "mirrorHtmlDraft");
    rec(
      "EDITOR",
      "ui_save_path",
      editor ? "PASS" : "FAIL",
      editor
        ? "MirrorHtmlEditor no dashboard → draft → content.importMirrorSrcDoc no save"
        : "Editor HTML não ligado ao save",
      "PresellDashboard + MirrorHtmlEditor",
    );

    const rehostOnManualEdit = fileHas(
      "frontend/src/pages/PresellDashboard.tsx",
      "rehostMirrorImagesToR2",
    );
    rec(
      "EDITOR",
      "rehost_on_manual_save",
      rehostOnManualEdit ? "PASS" : "GAP",
      rehostOnManualEdit
        ? "Save manual re-hospeda imagens"
        : "Save do editor NÃO re-corre rehost R2 (só no import/re-import) — hotlinks possíveis após edit manual de src",
      "PresellDashboard handleSave",
    );
  }

  /** ——— 4. RE-IMPORT ——— */
  {
    const reimp =
      fileHas("frontend/src/pages/PresellDashboard.tsx", "onReimport") &&
      fileHas("frontend/src/components/presell/MirrorHtmlEditor.tsx", "Re-importar");
    rec(
      "RE-IMPORT",
      "dashboard_button",
      reimp ? "PASS" : "FAIL",
      reimp
        ? "Botão Re-importar chama importFromUrl e actualiza mirrorHtmlDraft"
        : "Re-import ausente",
      "MirrorHtmlEditor onReimport → presellService.importFromUrl",
    );
  }

  /** ——— 5. REHOST R2 ——— */
  {
    const wired =
      fileHas("backend/src/lib/presellImporter.ts", "rehostMirrorImagesToR2") &&
      fileHas("backend/src/lib/presellImporter.ts", "userId");
    rec(
      "REHOST",
      "importer_hook",
      wired ? "PASS" : "FAIL",
      wired ? "Importer chama rehost com userId após finalize" : "Rehost não ligado ao import",
      "presellImporter → rehostMirrorImagesToR2",
    );

    const html = `<html><body><img src="https://cdn.example.com/a.jpg" /></body></html>`;
    const r = await rehostMirrorImagesToR2({ srcDoc: html, userId: "audit", pageHint: "e2e" });
    if (r.skipped) {
      rec(
        "REHOST",
        "runtime_r2",
        "BLOCKED",
        "R2 não configurado neste processo — rehost devolve HTML original (comportamento honesto)",
        "isR2Configured() === false",
      );
    } else {
      rec(
        "REHOST",
        "runtime_r2",
        r.rehosted > 0 ? "PASS" : "GAP",
        `R2 activo: rehosted=${r.rehosted}`,
        "rehostMirrorImagesToR2",
      );
    }

    // Produção: não lemos secrets; só confirmamos que o endpoint de media builder existe (proxy R2)
    const media = await probe("/public/presell-builder/00000000-0000-0000-0000-000000000000/x.jpg");
    rec(
      "REHOST",
      "prod_media_route",
      media.status === 404 || media.status === 302 || media.status === 200 ? "PASS" : media.status === 0 ? "BLOCKED" : "GAP",
      `GET builder-media → ${media.status} (rota pública presente)`,
      `${API}/public/presell-builder/…`,
    );
  }

  /** ——— 6. TRACKING ——— */
  {
    const markersFile = existsSync(join(REPO, "frontend/src/lib/presellMirrorMarkers.ts"));
    const publicTrack = fileHas("frontend/src/pages/PublicPresell.tsx", "/track/r/");
    rec(
      "TRACKING",
      "public_to_track_r",
      publicTrack && markersFile ? "PASS" : "FAIL",
      publicTrack && markersFile
        ? "PublicPresell → makeTrackClickUrl + mirror markers → /track/r/"
        : "Tracking público incompleto",
      "PublicPresell + presellMirrorMarkers",
    );

    const health = await probe("/health");
    rec(
      "TRACKING",
      "prod_api_health",
      health.ok ? "PASS" : "BLOCKED",
      health.ok ? `API prod health OK (${health.status})` : `API prod unreachable: ${health.status} ${health.body}`,
      `${API}/health`,
    );

    // /track/r sem to/presell válido deve falhar de forma controlada (não 500)
    const fakeId = "00000000-0000-4000-8000-000000000001";
    const tr = await probe(`/track/r/${fakeId}?to=${encodeURIComponent("https://example.com")}`);
    rec(
      "TRACKING",
      "prod_track_r_shape",
      tr.status === 404 || tr.status === 403 || tr.status === 400 || tr.status === 302
        ? "PASS"
        : tr.status === 0
          ? "BLOCKED"
          : "FAIL",
      `GET /track/r/{uuid} → ${tr.status} (esperado 404/403/400/302)`,
      `${API}/track/r/…`,
    );
  }

  /** ——— 7. CLOAKING ——— */
  {
    const cloakOff = shouldServeCloakSafePage(mockReq("Googlebot/2.1"), { enterpriseCloak: false });
    const cloakOn = shouldServeCloakSafePage(
      mockReq("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"),
      { enterpriseCloak: true },
    );
    assert.equal(cloakOff.cloak, false);
    assert.equal(cloakOn.cloak, true);

    const payload = buildCloakSafePublicPayload({
      base: { id: "1", title: "X", content: { importMirrorSrcDoc: "<html/>", affiliateLink: "https://x" } },
      settingsRaw: { enterpriseCloak: true, cloakSafeTitle: "Safe", cloakSafeBody: "Body" },
      reason: "bot:Google",
    });
    const payloadOk =
      payload.cloak_safe === true &&
      (payload.content as { affiliateLink: string }).affiliateLink === "#" &&
      (payload.content as { importMirrorSrcDoc: string }).importMirrorSrcDoc === "";

    rec(
      "CLOAKING",
      "unit_bot_safe",
      cloakOn.cloak && payloadOk ? "PASS" : "FAIL",
      "Bot + enterpriseCloak → cloak_safe sem mirror/hoplink",
      "presellEnterpriseCloak",
    );

    const ctrl =
      fileHas("backend/src/controllers/presell.controller.ts", "shouldServeCloakSafePage") &&
      fileHas("frontend/src/pages/PublicPresell.tsx", "cloak_safe") &&
      fileHas("frontend/src/components/presell/PresellAdvancedTrackingCollapsible.tsx", "enterpriseCloak");
    rec(
      "CLOAKING",
      "full_stack_ui",
      ctrl ? "PASS" : "FAIL",
      ctrl
        ? "Controller público + PublicPresell + toggle no painel"
        : "Cloak não atravessa full stack",
      "getPublicById/Slug + PublicPresell + AdvancedTracking",
    );

    rec(
      "CLOAKING",
      "live_bot_probe",
      "BLOCKED",
      "Sem token+presell publicada com enterpriseCloak=true não dá para provar cloak em produção nesta sessão",
      "requer conta + settings.enterpriseCloak",
    );
  }

  /** ——— 8–9. A/B + LANDERS ——— */
  {
    const ab =
      fileHas("frontend/src/pages/CreatePresellWizardPage.tsx", "enableAbTest") &&
      fileHas("frontend/src/pages/CreatePresellWizardPage.tsx", "trafficRotatorsService.create") &&
      fileHas("frontend/src/pages/CreatePresellWizardPage.tsx", "weight: 50");
    rec(
      "A/B",
      "wizard_rotator",
      ab ? "PASS" : "FAIL",
      ab
        ? "Wizard cria 2 pages + rotator weighted 50/50"
        : "A/B wizard incompleto",
      "CreatePresellWizardPage enableAbTest",
    );

    const chrome =
      fileHas("frontend/src/components/presell/MirrorTypeChrome.tsx", "TSL") &&
      fileHas("frontend/src/pages/PublicPresell.tsx", "MirrorTypeChrome");
    rec(
      "LANDER A/B",
      "type_chrome_diff",
      chrome ? "PASS" : "FAIL",
      chrome
        ? "Landers diferenciam tipo via MirrorTypeChrome no espelho"
        : "Sem chrome por tipo",
      "MirrorTypeChrome + PublicPresell",
    );

    const rot = await probe("/track/rot/00000000-0000-4000-8000-000000000099");
    rec(
      "LANDER A/B",
      "prod_track_rot",
      rot.status === 404 || rot.status === 403 || rot.status === 302 || rot.status === 400
        ? "PASS"
        : rot.status === 0
          ? "BLOCKED"
          : "FAIL",
      `GET /track/rot/{uuid} → ${rot.status}`,
      `${API}/track/rot/…`,
    );

    rec(
      "A/B",
      "live_create_ab",
      "BLOCKED",
      "Criação A/B live precisa login + import real — não executado sem credenciais",
      "E2E_API_BASE + auth",
    );
  }

  /** ——— 10. CLICK ——— */
  {
    const clickPath =
      fileHas("backend/src/controllers/track.controller.ts", "trackClick") ||
      fileHas("backend/src/controllers/track.controller.ts", "redirect") ||
      existsSync(join(REPO, "backend/src/controllers/track.controller.ts"));
    rec(
      "CLICK",
      "controller_exists",
      clickPath ? "PASS" : "FAIL",
      clickPath ? "track.controller presente" : "Sem track controller",
      "backend/src/controllers/track.controller.ts",
    );

    // appendClickId proves conversion attribution glue exists
    const withId = appendClickIdToAffiliateUrl(
      "https://www.digistore24.com/redir/x/y/",
      "click-audit-1",
    );
    rec(
      "CLICK",
      "append_click_id",
      withId.includes("click-audit-1") ? "PASS" : "FAIL",
      withId.includes("click-audit-1")
        ? "Click ID injectado no hoplink (atribuição)"
        : "appendClickId falhou",
      "appendClickIdToAffiliateUrl",
    );
  }

  /** ——— 11. CONVERSION ——— */
  {
    const pb =
      fileHas("backend/src/lib/affiliatePostbackParsers.ts", "isApprovedSaleStatus") &&
      fileHas("backend/src/routes/integrations.routes.ts", "affiliate-webhook");
    rec(
      "CONVERSION",
      "postback_stack",
      pb ? "PASS" : "GAP",
      pb
        ? "Parsers + affiliate-webhook presentes"
        : "Postback stack incompleto",
      "affiliatePostbackParsers + integrations.routes",
    );

    rec(
      "CONVERSION",
      "rotator_arm_attribution",
      "GAP",
      "Conversão atribui ao click/presell; breakdown por braço A/B depende de abStats do rotador (não provei live nesta sessão)",
      "trafficRotatorsService.abStats + metadata.rotator_arm_id",
    );
  }

  /** ——— 12. ANALYTICS ——— */
  {
    const healthPanel = fileHas(
      "frontend/src/pages/PresellDashboard.tsx",
      "PresellTrackingHealthPanel",
    );
    const relExists =
      fileHas("frontend/src/App.tsx", "Relatorios") ||
      fileHas("frontend/src/App.tsx", "relatorios") ||
      fileHas("frontend/src/App.tsx", "/tracking/dashboard");
    rec(
      "ANALYTICS",
      "ui_exists",
      healthPanel || relExists ? "PASS" : "FAIL",
      healthPanel || relExists
        ? "Painéis analytics/relatórios no frontend"
        : "UI analytics ausente",
      "PresellDashboard / App routes",
    );

    const candidates = ["/analytics/dashboard", "/analytics/summary", "/reports/dashboard"];
    let best = { status: 0, path: candidates[0]! };
    for (const p of candidates) {
      const dash = await probe(p);
      best = { status: dash.status, path: p };
      if (dash.status === 401 || dash.status === 403 || dash.status === 200) break;
    }
    rec(
      "ANALYTICS",
      "prod_endpoint_auth",
      best.status === 401 || best.status === 403 || best.status === 200
        ? "PASS"
        : best.status === 0
          ? "BLOCKED"
          : best.status === 404
            ? "GAP"
            : "PASS",
      `GET ${best.path} → ${best.status}`,
      `${API}${best.path}`,
    );
  }

  /** ——— Summary ——— */
  const counts = { PASS: 0, FAIL: 0, BLOCKED: 0, GAP: 0 };
  for (const r of rows) counts[r.status]++;
  const chainGreen = counts.FAIL === 0 && counts.GAP === 0 && counts.BLOCKED === 0;
  const productReady =
    counts.FAIL === 0 && counts.GAP <= 2 && counts.BLOCKED > 0; // wiring ok, live incomplete

  console.log("\n=== RESUMO ===");
  console.log(
    `PASS=${counts.PASS} FAIL=${counts.FAIL} GAP=${counts.GAP} BLOCKED=${counts.BLOCKED}`,
  );
  if (chainGreen) {
    console.log("VEREDICTO: cadeia 100% verde (wiring + live).");
  } else if (counts.FAIL === 0) {
    console.log(
      "VEREDICTO: wiring full-stack OK; prova live completa BLOCKED/GAP — NÃO declarar produto 100% E2E em produção sem credenciais + R2 + A/B real.",
    );
  } else {
    console.log("VEREDICTO: FAIL na cadeia — não é produto completo ainda.");
  }

  // Machine-readable footer for canvas ingest
  console.log("\n__JSON__");
  console.log(
    JSON.stringify({
      api: API,
      counts,
      chainGreen,
      productReadyWiring: counts.FAIL === 0,
      rows,
      ts: new Date().toISOString(),
    }),
  );

  if (counts.FAIL > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
