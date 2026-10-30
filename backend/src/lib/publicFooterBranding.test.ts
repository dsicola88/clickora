import assert from "node:assert/strict";
import { resolvePublicFooterBranding } from "./publicFooterBranding";

assert.equal(
  resolvePublicFooterBranding({ planHasBranding: true, hidePoweredBy: true }),
  true,
  "free sempre mostra",
);
assert.equal(
  resolvePublicFooterBranding({ planHasBranding: true, hidePoweredBy: false }),
  true,
  "free ignora toggle",
);
assert.equal(
  resolvePublicFooterBranding({ planHasBranding: false, hidePoweredBy: true }),
  false,
  "Pro + ocultar",
);
assert.equal(
  resolvePublicFooterBranding({ planHasBranding: false, hidePoweredBy: false }),
  true,
  "Pro + mostrar crédito",
);
assert.equal(
  resolvePublicFooterBranding({ planHasBranding: false, hidePoweredBy: null }),
  false,
  "Pro sem row → omitir",
);
assert.equal(
  resolvePublicFooterBranding({ planHasBranding: undefined, hidePoweredBy: undefined }),
  true,
  "sem plano → default free",
);

console.log("publicFooterBranding.test.ts: ok");
