import assert from "node:assert/strict";
import test from "node:test";
import { detectFunnelStepFromPayload } from "./funnelStepEvent";

test("funnel_step explícito", () => {
  assert.equal(detectFunnelStepFromPayload({ funnel_step: "checkout" }), "checkout");
  assert.equal(detectFunnelStepFromPayload({ funnel_step: "lander" }), "lander");
});

test("venda aprovada não é funil", () => {
  assert.equal(detectFunnelStepFromPayload({ status: "approved" }), null);
  assert.equal(detectFunnelStepFromPayload({ billing_status: "completed", amount: "10" }), null);
});

test("eventos tipo SmartAdv Checkout", () => {
  assert.equal(detectFunnelStepFromPayload({ event: "Checkout" }), "checkout");
  assert.equal(detectFunnelStepFromPayload({ event_name: "initiate_checkout" }), "checkout");
});
