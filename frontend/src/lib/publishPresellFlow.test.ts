import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/services/presellService", () => ({
  presellService: {
    update: vi.fn(),
  },
}));

vi.mock("@/lib/presellCtaBake", () => ({
  bakeMirrorOfferHrefsForPresell: (html: string, id: string) =>
    html.replace(/https:\/\/mwebkivo\.com\/[^"']+/g, `/api/track/r/${id}`),
}));

import { bakeAndMaybePublishPresell } from "@/lib/publishPresellFlow";
import { presellService } from "@/services/presellService";

describe("bakeAndMaybePublishPresell", () => {
  beforeEach(() => {
    vi.mocked(presellService.update).mockReset();
  });

  it("publica quando bake remove hoplinks e update devolve published", async () => {
    vi.mocked(presellService.update).mockResolvedValue({
      data: {
        id: "p1",
        status: "published",
        custom_domain_id: null,
        content: {},
      } as never,
      error: null,
    });

    const result = await bakeAndMaybePublishPresell({
      page: {
        id: "p1",
        status: "draft",
        custom_domain_id: null,
        content: {},
      } as never,
      content: {
        affiliateLink: "https://mwebkivo.com/1/",
        importMirrorSrcDoc: '<a href="https://mwebkivo.com/1/">Buy</a>',
      },
      affiliateLink: "https://mwebkivo.com/1/",
      wantPublished: true,
      publicUrl: "https://app.example/p/x",
    });

    expect(result.published).toBe(true);
    expect(result.block).toBeNull();
    expect(presellService.update).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ status: "published" }),
    );
  });

  it("não tenta publish sem hoplink", async () => {
    vi.mocked(presellService.update).mockResolvedValue({
      data: { id: "p1", status: "draft", custom_domain_id: null, content: {} } as never,
      error: null,
    });

    const result = await bakeAndMaybePublishPresell({
      page: { id: "p1", status: "draft", custom_domain_id: null, content: {} } as never,
      content: { affiliateLink: "", importMirrorSrcDoc: "" },
      affiliateLink: "",
      wantPublished: true,
    });

    expect(result.published).toBe(false);
    expect(result.block?.id).toBe("offer");
    expect(presellService.update).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ status: "draft" }),
    );
  });
});
