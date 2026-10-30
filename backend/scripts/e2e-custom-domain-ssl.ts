/**
 * E2E: estados SSL/go-live (resolver + map sintético).
 *
 *   cd backend && npx tsx scripts/e2e-custom-domain-ssl.ts
 */
import { resolveCustomDomainSslState, sslStateLabelPt } from "../src/lib/customDomainSslState";

const results: { name: string; ok: boolean; detail: string }[] = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${detail}`);
}

function main() {
  const pending = resolveCustomDomainSslState({ status: "pending", vercelDomainRegistered: true });
  record("pending → pending_dns", pending.ssl_state === "pending_dns" && !pending.https_ready, pending.ssl_state);

  const legacy = resolveCustomDomainSslState({ status: "verified", vercelDomainRegistered: false });
  record("verified sem Vercel → dns_verified", legacy.ssl_state === "dns_verified", legacy.ssl_state);

  const provisioning = resolveCustomDomainSslState({
    status: "verified",
    vercelDomainRegistered: true,
  });
  record(
    "verified+Vercel sem probe → ssl_provisioning",
    provisioning.ssl_state === "ssl_provisioning",
    provisioning.ssl_state,
  );

  const ready = resolveCustomDomainSslState({
    status: "verified",
    vercelDomainRegistered: true,
    live: { vercelVerified: true, vercelMisconfigured: false, httpsReachable: true },
  });
  record("probe OK → https_ready", ready.ssl_state === "https_ready" && ready.https_ready, ready.ssl_state);

  const bad = resolveCustomDomainSslState({
    status: "verified",
    vercelDomainRegistered: true,
    live: { vercelMisconfigured: true },
  });
  record("misconfigured", bad.ssl_state === "misconfigured", bad.ssl_state);

  record(
    "labels PT",
    sslStateLabelPt("https_ready") === "HTTPS pronto" &&
      sslStateLabelPt("ssl_provisioning") === "SSL a provisionar",
    "ok",
  );

  // Contrato FE types (campos que CustomDomainDto / badge leem)
  const apiShape = {
    ssl_state: ready.ssl_state,
    https_ready: ready.https_ready,
    ssl_label: sslStateLabelPt(ready.ssl_state),
  };
  record(
    "contrato API ssl_state/https_ready/ssl_label",
    apiShape.ssl_state === "https_ready" && apiShape.https_ready === true && !!apiShape.ssl_label,
    JSON.stringify(apiShape),
  );

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passaram`);
  if (failed.length) process.exitCode = 1;
}

main();
