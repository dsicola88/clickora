/**
 * Auditoria de conformidade (código local): bloqueio só manual + IP Vercel.
 * Não chama produção. Corre: node --import tsx scripts/e2e-audit-manual-block-conformity.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Request } from "express";
import { extractClientIp } from "../src/lib/clientIp";
import { datacenterClickPlace } from "../src/lib/ipNetworkClass";
import { rememberDatacenterBlacklist } from "../src/lib/rememberDatacenterBlacklist";
import { shouldServeCloakSafePage, countryOnCloakDenyList } from "../src/lib/presellEnterpriseCloak";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const results: { name: string; ok: boolean; detail: string }[] = [];

function rec(name: string, ok: boolean, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  ${detail}` : ""}`);
}

function fakeReq(headers: Record<string, string>, remote: string): Request {
  return {
    headers,
    socket: { remoteAddress: remote },
  } as unknown as Request;
}

function fileHas(rel: string, re: RegExp): boolean {
  const t = fs.readFileSync(path.join(root, rel), "utf8");
  return re.test(t);
}

function fileLacks(rel: string, re: RegExp): boolean {
  return !fileHas(rel, re);
}

async function main() {
  // --- Código: sem bloqueio automático de datacenter nos controllers ---
  rec(
    "presell.controller sem cloak datacenter",
    fileLacks("src/controllers/presell.controller.ts", /reason:\s*[\"']datacenter[\"']/) &&
      fileLacks("src/controllers/presell.controller.ts", /rememberDatacenterBlacklist/),
  );
  rec(
    "track.controller sem return seguro por place/datacenter",
    fileLacks("src/controllers/track.controller.ts", /datacenter sem oferta/) &&
      fileLacks("src/controllers/track.controller.ts", /rememberDatacenterBlacklist/),
  );
  rec(
    "rememberDatacenterBlacklist é no-op",
    (await rememberDatacenterBlacklist({
      userId: "00000000-0000-0000-0000-000000000001",
      ip: "15.240.70.222",
      network: "AWS",
      eligible: true,
      userAgent: "Mozilla/5.0",
    })).blacklisted === false,
  );
  rec(
    "datacenterClickPlace.auto_blacklist sempre false",
    datacenterClickPlace("152.233.29.1")?.auto_blacklist === false,
  );

  // --- IP Vercel → Railway ---
  const viaVercel = extractClientIp(
    fakeReq(
      {
        "x-vercel-forwarded-for": "63.124.68.69",
        "x-forwarded-for": "15.240.70.222",
      },
      "15.240.70.222",
    ),
  );
  rec("IP visitante US via header Vercel", viaVercel === "63.124.68.69", viaVercel);

  const direct = extractClientIp(
    fakeReq({ "x-client-ip": "1.2.3.4", "x-forwarded-for": "1.2.3.4" }, "203.0.113.50"),
  );
  rec("ligação directa não aceita spoof X-Client-IP", direct === "203.0.113.50", direct);

  // --- Cloak geo só com lista manual ---
  const geoOff = shouldServeCloakSafePage(fakeReq({ "user-agent": "Mozilla/5.0" }, "8.8.8.8"), {
    enterpriseCloak: true,
  });
  rec("cloak geo sem deny list → oferta", geoOff.cloak === false);

  assert.equal(countryOnCloakDenyList({ enterpriseCloak: true, cloakGeoDeny: "AO" }, "AO"), true);
  assert.equal(countryOnCloakDenyList({ enterpriseCloak: true, cloakGeoDeny: "AO" }, "US"), false);
  rec("cloak geo deny list manual AO/US", true);

  // --- UI copy ---
  const uiPath = path.join(root, "../frontend/src/pages/Blacklist.tsx");
  const ui = fs.readFileSync(uiPath, "utf8");
  rec("Blacklist UI: bloqueio só manual", /Bloqueio só manual/.test(ui));
  rec("Blacklist UI sem auto-blacklist AWS/CDN77", !/Auto-blacklist \(só evidência explícita\)/.test(ui));
  rec("Blacklist UI proxy opt-in (sem 'bloqueio de datacenter')", !/Complementa o bloqueio de datacenter/.test(ui));

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} conformidade`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
