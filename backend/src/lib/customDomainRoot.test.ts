import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decideRootPresell,
  isEligibleRootPresell,
  presellBelongsToDomain,
  type RootDomain,
  type RootPage,
} from "./customDomainRoot";

const domain = (over: Partial<RootDomain> = {}): RootDomain => ({
  id: "d1",
  userId: "u1",
  isDefault: false,
  rootPresellId: null,
  purpose: "both",
  ...over,
});
const page = (over: Partial<RootPage> = {}): RootPage => ({
  id: "p1",
  userId: "u1",
  customDomainId: "d1",
  status: "published",
  ...over,
});

describe("raiz do domínio personalizado — sem modo automático", () => {
  it("domínio novo (sem escolha) → página neutra, mesmo com presells publicadas e recentes", async () => {
    let loads = 0;
    const out = await decideRootPresell(domain(), async () => {
      loads += 1;
      return page();
    });
    assert.deepEqual(out, { kind: "neutral", reason: "not_selected" });
    assert.equal(loads, 0, "sem escolha manual nunca se vai buscar presell nenhuma");
  });

  it("com escolha explícita e válida → devolve essa presell (renderizada na própria raiz)", async () => {
    const out = await decideRootPresell(domain({ rootPresellId: "p1" }), async (id) => page({ id }));
    assert.equal(out.kind, "page");
    if (out.kind === "page") assert.equal(out.page.id, "p1");
  });

  it("escolha despublicada/rascunho → neutra (não cai noutra presell)", async () => {
    const out = await decideRootPresell(domain({ rootPresellId: "p1" }), async () => page({ status: "draft" }));
    assert.deepEqual(out, { kind: "neutral", reason: "selection_unavailable" });
  });

  it("escolha apagada → neutra", async () => {
    const out = await decideRootPresell(domain({ rootPresellId: "p1" }), async () => null);
    assert.deepEqual(out, { kind: "neutral", reason: "selection_unavailable" });
  });

  it("escolha de outro assinante → neutra (isolamento multi-tenant)", async () => {
    const otherUser = await decideRootPresell(domain({ rootPresellId: "p1" }), async () => page({ userId: "u2" }));
    assert.equal(otherUser.kind, "neutral");
  });

  it("presell escolhida que mudou de domínio (troca/failover) continua na raiz", async () => {
    const moved = await decideRootPresell(domain({ rootPresellId: "p1" }), async () =>
      page({ customDomainId: "d2" }),
    );
    assert.equal(moved.kind, "page");
  });

  it("domínio só de tracking nunca serve lander", async () => {
    const out = await decideRootPresell(domain({ purpose: "tracking", rootPresellId: "p1" }), async () => page());
    assert.deepEqual(out, { kind: "tracking" });
  });
});

describe("presellBelongsToDomain / isEligibleRootPresell", () => {
  it("presell antiga sem domínio só conta para o domínio padrão", () => {
    const legacy = page({ customDomainId: null });
    assert.equal(presellBelongsToDomain(legacy, domain({ isDefault: true })), true);
    assert.equal(presellBelongsToDomain(legacy, domain({ isDefault: false })), false);
  });

  it("nunca entre assinantes", () => {
    assert.equal(presellBelongsToDomain(page({ userId: "u2" }), domain()), false);
    assert.equal(presellBelongsToDomain(page({ userId: "u2", customDomainId: null }), domain({ isDefault: true })), false);
  });

  it("elegível exige publicada", () => {
    assert.equal(isEligibleRootPresell(page(), domain()), true);
    assert.equal(isEligibleRootPresell(page({ status: "paused" }), domain()), false);
  });
});
