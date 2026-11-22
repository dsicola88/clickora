import assert from "node:assert/strict";
import { resolveCustomDomainSslState } from "./customDomainSslState";

/** Contrato: probe HTTPS true deve marcar https_ready mesmo sem API Vercel. */
const ready = resolveCustomDomainSslState({
  status: "verified",
  vercelDomainRegistered: true,
  live: { httpsReachable: true, vercelVerified: false, vercelMisconfigured: false },
});
assert.equal(ready.ssl_state, "https_ready");
assert.equal(ready.https_ready, true);

const provisioning = resolveCustomDomainSslState({
  status: "verified",
  vercelDomainRegistered: true,
  live: { httpsReachable: false, vercelVerified: false, vercelMisconfigured: false },
});
assert.equal(provisioning.ssl_state, "ssl_provisioning");

console.log("customDomainLiveSsl.test.ts: ok");