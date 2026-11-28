import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { invalidPasswordBody } from "./auth.controller";

const here = dirname(fileURLToPath(import.meta.url));

describe("senha errada numa sessão válida não é 401", () => {
  it("corpo com code INVALID_PASSWORD", () => {
    assert.deepEqual(invalidPasswordBody("Senha incorreta."), {
      error: "Senha incorreta.",
      code: "INVALID_PASSWORD",
    });
  });

  it("change-password, delete-account e MFA disable respondem 400", () => {
    const auth = readFileSync(join(here, "auth.controller.ts"), "utf8");
    const mfa = readFileSync(join(here, "mfa.controller.ts"), "utf8");
    assert.match(auth, /status\(400\)\.json\(invalidPasswordBody\("Senha atual incorreta"\)\)/);
    assert.match(auth, /status\(400\)\.json\(invalidPasswordBody\("Senha incorreta\."\)\)/);
    assert.match(mfa, /status\(400\)\.json\(invalidPasswordBody\("Senha incorrecta\."\)\)/);
    assert.doesNotMatch(auth, /status\(401\)\.json\(\{ error: "Senha/);
    assert.doesNotMatch(mfa, /status\(401\)\.json\(\{ error: "Senha/);
  });
});
