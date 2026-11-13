import { describe, expect, it } from "vitest";
import type { User } from "@/types/api";
import { pathAllowsInactiveSubscription, userHasSubscriptionAccess } from "./subscriptionAccess";

function user(partial: Partial<User>): User {
  return {
    id: "1",
    name: "A",
    email: "a@b.c",
    plan: null,
    workspace_id: "w",
    role: "user",
    created_at: new Date().toISOString(),
    ...partial,
  };
}

describe("userHasSubscriptionAccess", () => {
  it("admins bypass", () => {
    expect(userHasSubscriptionAccess(user({ role: "admin", subscription_allowed: false }))).toBe(true);
    expect(userHasSubscriptionAccess(user({ role: "super_admin", subscription_allowed: false }))).toBe(
      true,
    );
  });

  it("respeita subscription_allowed", () => {
    expect(userHasSubscriptionAccess(user({ subscription_allowed: false }))).toBe(false);
    expect(userHasSubscriptionAccess(user({ subscription_allowed: true }))).toBe(true);
  });

  it("sem campo → não bloqueia (compat)", () => {
    expect(userHasSubscriptionAccess(user({}))).toBe(true);
  });
});

describe("pathAllowsInactiveSubscription", () => {
  it("conta, ajuda e admin", () => {
    expect(pathAllowsInactiveSubscription("/conta")).toBe(true);
    expect(pathAllowsInactiveSubscription("/ajuda/assistente")).toBe(true);
    expect(pathAllowsInactiveSubscription("/admin/users")).toBe(true);
    expect(pathAllowsInactiveSubscription("/presells")).toBe(false);
    expect(pathAllowsInactiveSubscription("/inicio")).toBe(false);
  });
});
