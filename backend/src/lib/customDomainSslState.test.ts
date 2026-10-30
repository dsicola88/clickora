import assert from "node:assert/strict";
import { resolveCustomDomainSslState } from "./customDomainSslState";

assert.deepEqual(
  resolveCustomDomainSslState({ status: "pending", vercelDomainRegistered: true }),
  { ssl_state: "pending_dns", https_ready: false },
);
assert.deepEqual(
  resolveCustomDomainSslState({ status: "verified", vercelDomainRegistered: false }),
  { ssl_state: "dns_verified", https_ready: false },
);
assert.deepEqual(
  resolveCustomDomainSslState({
    status: "verified",
    vercelDomainRegistered: true,
    live: { vercelMisconfigured: true },
  }),
  { ssl_state: "misconfigured", https_ready: false },
);
assert.deepEqual(
  resolveCustomDomainSslState({
    status: "verified",
    vercelDomainRegistered: true,
    live: { vercelVerified: true, httpsReachable: true },
  }),
  { ssl_state: "https_ready", https_ready: true },
);
assert.deepEqual(
  resolveCustomDomainSslState({
    status: "verified",
    vercelDomainRegistered: true,
    live: { vercelVerified: true, httpsReachable: false },
  }),
  { ssl_state: "ssl_provisioning", https_ready: false },
);
assert.deepEqual(
  resolveCustomDomainSslState({ status: "verified", vercelDomainRegistered: true }),
  { ssl_state: "ssl_provisioning", https_ready: false },
);

console.log("customDomainSslState.test.ts: ok");
