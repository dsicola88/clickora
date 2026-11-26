import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getPublicPresellHost, getPublicPresellOrigin, isPlatformMainHostname } from "./publicPresellHost";
import { rewriteLocalPresellDestination } from "./rewriteLocalPresellDestination";

describe("publicPresellHost", () => {
  it("reconhece só dclickora.com / www (sem localhost nem *.vercel.app)", () => {
    assert.equal(isPlatformMainHostname("dclickora.com"), true);
    assert.equal(isPlatformMainHostname("WWW.DCLICKORA.COM:443"), true);
    assert.equal(isPlatformMainHostname("www.dclickora.com."), true);
    assert.equal(isPlatformMainHostname("oferta.cliente.com"), false);
    assert.equal(isPlatformMainHostname("localhost"), false);
    assert.equal(isPlatformMainHostname("x.vercel.app"), false);
    assert.equal(isPlatformMainHostname("evil-dclickora.com"), false);
    assert.equal(isPlatformMainHostname(null), false);
  });

  it("PUBLIC_PRESELL_HOST: normaliza e rejeita valores inválidos / host principal", () => {
    assert.equal(getPublicPresellHost({ PUBLIC_PRESELL_HOST: "Pages.Example.com" } as NodeJS.ProcessEnv), "pages.example.com");
    assert.equal(getPublicPresellHost({ PUBLIC_PRESELL_HOST: "https://pages.example.com/x" } as NodeJS.ProcessEnv), "pages.example.com");
    assert.equal(getPublicPresellOrigin({ PUBLIC_PRESELL_HOST: "pages.example.com" } as NodeJS.ProcessEnv), "https://pages.example.com");
    assert.equal(getPublicPresellHost({} as NodeJS.ProcessEnv), null);
    assert.equal(getPublicPresellHost({ PUBLIC_PRESELL_HOST: "localhost" } as NodeJS.ProcessEnv), null);
    assert.equal(getPublicPresellHost({ PUBLIC_PRESELL_HOST: "www.dclickora.com" } as NodeJS.ProcessEnv), null);
  });

  it("rewriteLocalPresellDestination nunca reescreve para o domínio principal", () => {
    const local = "http://localhost:8080/p/11111111-1111-4111-8111-111111111111";
    assert.equal(rewriteLocalPresellDestination(local, "https://www.dclickora.com"), local);
    assert.equal(
      rewriteLocalPresellDestination(local, "https://cliente.com"),
      "https://cliente.com/p/11111111-1111-4111-8111-111111111111",
    );
  });
});
