import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Request, Response } from "express";
import { callerIsBillingOwner, freePlanSwitchBlock, plansController } from "./plans.controller";

function req(user: Record<string, unknown>, body: unknown = {}): Request {
  return { user, body } as unknown as Request;
}

function fakeRes() {
  const out: { status?: number; body?: { code?: string } } = {};
  const res = {
    status(code: number) {
      out.status = code;
      return res;
    },
    json(body: { code?: string }) {
      out.body = body;
      return res;
    },
  } as unknown as Response;
  return { res, out };
}

describe("plans: só o dono da faturação", () => {
  it("callerIsBillingOwner", () => {
    assert.equal(callerIsBillingOwner(req({ userId: "u1" })), true);
    assert.equal(callerIsBillingOwner(req({ userId: "u1", tenantUserId: "u1" })), true);
    assert.equal(callerIsBillingOwner(req({ userId: "viewer", tenantUserId: "owner" })), false);
  });

  it("viewer não cancela nem subscreve o plano do dono (403 antes da BD)", async () => {
    const viewer = { userId: "viewer", tenantUserId: "owner", workspaceRole: "viewer" };
    const c = fakeRes();
    await plansController.cancel(req(viewer), c.res);
    assert.equal(c.out.status, 403);
    assert.equal(c.out.body?.code, "BILLING_OWNER_ONLY");

    const s = fakeRes();
    await plansController.subscribe(req(viewer, { plan_id: "plan_free" }), s.res);
    assert.equal(s.out.status, 403);
    assert.equal(s.out.body?.code, "BILLING_OWNER_ONLY");
  });
});

describe("freePlanSwitchBlock", () => {
  const plan = (type: string, priceCents: number) => ({ type, priceCents, name: "X" });

  it("suspensa → 403", () => {
    assert.equal(freePlanSwitchBlock({ status: "suspended", plan: plan("free_trial", 0) })?.status, 403);
    assert.equal(freePlanSwitchBlock({ status: "suspended", plan: plan("annual", 9900) })?.status, 403);
  });

  it("pago activo → 409; cancelado/expirado/sem assinatura → permitido", () => {
    assert.equal(freePlanSwitchBlock({ status: "active", plan: plan("monthly", 4900) })?.status, 409);
    assert.equal(freePlanSwitchBlock({ status: "canceled", plan: plan("monthly", 4900) }), null);
    assert.equal(freePlanSwitchBlock({ status: "expired", plan: plan("annual", 9900) }), null);
    assert.equal(freePlanSwitchBlock(null), null);
  });
});
