import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildStickyRotatorSetCookie, isSecureRequest } from "./stickyRotatorCookie";

const base = { name: "clk_rs_abc", value: "arm-1", maxAgeSeconds: 2592000 };

describe("sticky rotator cookie", () => {
  it("HTTPS: HttpOnly + Secure + SameSite=Lax + Path + Max-Age", () => {
    const c = buildStickyRotatorSetCookie({ ...base, secure: true });
    assert.equal(c, "clk_rs_abc=arm-1; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax; Secure");
  });

  it("HTTP (dev local): sem Secure para não quebrar localhost, mantém HttpOnly", () => {
    const c = buildStickyRotatorSetCookie({ ...base, secure: false });
    assert.ok(c.includes("HttpOnly"));
    assert.ok(!c.includes("Secure"));
  });

  it("codifica o valor e nunca aceita Max-Age negativo", () => {
    const c = buildStickyRotatorSetCookie({ name: "n", value: "a b;c", maxAgeSeconds: -5, secure: true });
    assert.ok(c.startsWith("n=a%20b%3Bc;"));
    assert.ok(c.includes("Max-Age=0"));
  });

  it("isSecureRequest: req.secure ou x-forwarded-proto https (1.º valor)", () => {
    const mk = (secure: boolean | undefined, xfp?: string) => ({
      secure,
      get: (n: string) => (n.toLowerCase() === "x-forwarded-proto" ? xfp : undefined),
    });
    assert.equal(isSecureRequest(mk(true)), true);
    assert.equal(isSecureRequest(mk(false, "https")), true);
    assert.equal(isSecureRequest(mk(false, "https, http")), true);
    assert.equal(isSecureRequest(mk(false, "http")), false);
    assert.equal(isSecureRequest(mk(undefined)), false);
  });
});
