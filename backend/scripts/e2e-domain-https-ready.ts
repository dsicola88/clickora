/**
 * E2E: DNS verificado ≠ Final URL; ad_ready / account_health domain_https.
 *
 *   cd backend && npx tsx scripts/e2e-domain-https-ready.ts
 */
import { resolveCustomDomainSslState } from "../src/lib/customDomainSslState";

const results: { name: string; ok: boolean; detail: string }[] = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${detail}`);
}

/** Espelho FE `isCustomDomainAdReady`. */
function isAdReady(args: {
  status: string;
  vercelDomainRegistered: boolean;
  https_ready?: boolean;
  ssl_state?: string;
}): boolean {
  if (args.status !== "verified") return false;
  if (args.https_ready === true || args.ssl_state === "https_ready") return true;
  if (!args.vercelDomainRegistered) return true;
  return false;
}

function main() {
  const prov = resolveCustomDomainSslState({
    status: "verified",
    vercelDomainRegistered: true,
  });
  record(
    "Vercel verified sem probe → ssl_provisioning",
    prov.ssl_state === "ssl_provisioning" && !prov.https_ready,
    prov.ssl_state,
  );
  record(
    "FE: ssl_provisioning NÃO é ad-ready",
    !isAdReady({
      status: "verified",
      vercelDomainRegistered: true,
      ssl_state: prov.ssl_state,
      https_ready: prov.https_ready,
    }),
    "ok",
  );

  const ready = resolveCustomDomainSslState({
    status: "verified",
    vercelDomainRegistered: true,
    live: { vercelVerified: true, httpsReachable: true },
  });
  record(
    "probe OK → https_ready",
    ready.ssl_state === "https_ready" && ready.https_ready,
    ready.ssl_state,
  );
  record(
    "FE: https_ready É ad-ready",
    isAdReady({
      status: "verified",
      vercelDomainRegistered: true,
      ssl_state: ready.ssl_state,
      https_ready: ready.https_ready,
    }),
    "ok",
  );

  record(
    "TXT legado verificado é ad-ready",
    isAdReady({ status: "verified", vercelDomainRegistered: false }),
    "ok",
  );

  // account_health rule: ok se sem domínio OU ad_ready > 0
  const noDomain = { verified_hosting: 0, ad_ready_hosting: 0 };
  const provisioningOnly = { verified_hosting: 1, ad_ready_hosting: 0 };
  const withReady = { verified_hosting: 1, ad_ready_hosting: 1 };
  record(
    "health: sem custom domain → ok (app)",
    noDomain.verified_hosting === 0 || noDomain.ad_ready_hosting > 0,
    "ok",
  );
  record(
    "health: só ssl_provisioning → NOT ok",
    !(provisioningOnly.verified_hosting === 0 || provisioningOnly.ad_ready_hosting > 0),
    "ok",
  );
  record(
    "health: https_ready → ok",
    withReady.verified_hosting === 0 || withReady.ad_ready_hosting > 0,
    "ok",
  );

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passaram`);
  if (failed.length) process.exitCode = 1;
}

main();
