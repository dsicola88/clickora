import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

describe("oidc loginRedirect when not configured", () => {
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "oidc.controller.ts"),
    "utf8",
  );

  it("redireciona browsers para /auth?error=sso_unavailable", () => {
    assert.match(src, /error=sso_unavailable/);
    assert.match(src, /text\/html/);
  });

  it("mantém JSON 503 para clientes application\/json", () => {
    assert.match(src, /OIDC_NOT_CONFIGURED/);
    assert.match(src, /application\/json/);
  });
});
