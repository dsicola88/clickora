import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rewriteLocalPresellDestination } from "./rewriteLocalPresellDestination";

describe("rewriteLocalPresellDestination", () => {
  it("reescreve localhost /l/ para o domínio público do pedido", () => {
    const out = rewriteLocalPresellDestination(
      "http://localhost:8080/l/14098546-9230-488c-83f0-ea23bb7db265?x=1",
      "https://honestverdictguide.online",
    );
    assert.equal(
      out,
      "https://honestverdictguide.online/l/14098546-9230-488c-83f0-ea23bb7db265?x=1",
    );
  });

  it("não altera URLs já públicas", () => {
    const url = "https://honestverdictguide.online/p/abc";
    assert.equal(rewriteLocalPresellDestination(url, "https://other.example"), url);
  });

  it("ignora localhost que não é lander /p|/l", () => {
    const url = "http://localhost:8080/inicio";
    assert.equal(rewriteLocalPresellDestination(url, "https://honestverdictguide.online"), url);
  });
});
