import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { startPublicPresellPrefetchFromLocation } from "./publicPresellEarlyPrefetch";

describe("publicPresellEarlyPrefetch route param", () => {
  const origLocation = window.location;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(window, "location", { value: origLocation, writable: true });
  });

  function mockPath(pathname: string, hostname: string) {
    Object.defineProperty(window, "location", {
      value: { ...origLocation, pathname, hostname },
      writable: true,
    });
  }

  it("inicia prefetch em path bare no tenant", () => {
    mockPath("/kerassentials", "offer.tenant.com");
    startPublicPresellPrefetchFromLocation();
    expect(fetch).toHaveBeenCalled();
    const url = String((fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]);
    expect(url).toContain("/public/presells/slug/kerassentials");
    expect(url).toContain("visitor_host=offer.tenant.com");
  });

  it("ignora path reservado no tenant", () => {
    mockPath("/auth", "offer.tenant.com");
    startPublicPresellPrefetchFromLocation();
    expect(fetch).not.toHaveBeenCalled();
  });
});