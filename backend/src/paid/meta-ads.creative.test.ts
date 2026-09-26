import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  buildMetaObjectStorySpec,
  isValidMetaPageId,
  resolveMetaPageId,
} from "./meta-ads.creative";

describe("resolveMetaPageId", () => {
  const prevPromoted = process.env.META_PROMOTED_PAGE_ID;
  const prevPage = process.env.META_PAGE_ID;

  beforeEach(() => {
    delete process.env.META_PROMOTED_PAGE_ID;
    delete process.env.META_PAGE_ID;
  });

  afterEach(() => {
    if (prevPromoted === undefined) delete process.env.META_PROMOTED_PAGE_ID;
    else process.env.META_PROMOTED_PAGE_ID = prevPromoted;
    if (prevPage === undefined) delete process.env.META_PAGE_ID;
    else process.env.META_PAGE_ID = prevPage;
  });

  it("a escolha do pedido tem prioridade sobre a ligação e o ambiente", () => {
    process.env.META_PROMOTED_PAGE_ID = "333333";
    assert.equal(resolveMetaPageId({ payload: " 111111 ", connection: "222222" }), "111111");
  });

  it("usa a Página guardada na ligação quando o pedido não a traz", () => {
    process.env.META_PAGE_ID = "333333";
    assert.equal(resolveMetaPageId({ connection: "222222" }), "222222");
  });

  it("cai para o ambiente e devolve null sem nenhuma fonte", () => {
    process.env.META_PAGE_ID = "333333";
    assert.equal(resolveMetaPageId({ payload: null, connection: null }), "333333");
    delete process.env.META_PAGE_ID;
    assert.equal(resolveMetaPageId({ payload: "", connection: "" }), null);
  });
});

describe("isValidMetaPageId", () => {
  it("apenas ids numéricos do Graph", () => {
    assert.equal(isValidMetaPageId("102938475610293"), true);
    assert.equal(isValidMetaPageId("minha-pagina"), false);
    assert.equal(isValidMetaPageId("123"), false);
  });
});

describe("buildMetaObjectStorySpec", () => {
  const base = {
    pageId: "102938475610293",
    message: "Texto principal",
    headline: "Título",
    description: "Descrição",
    link: "https://exemplo.pt/oferta",
    ctaType: "LEARN_MORE",
  };

  it("link_data simples sem criativo carregado", () => {
    const spec = buildMetaObjectStorySpec({ ...base, asset: null }) as {
      page_id: string;
      link_data: Record<string, unknown>;
    };
    assert.equal(spec.page_id, base.pageId);
    assert.equal(spec.link_data.link, base.link);
    assert.equal(spec.link_data.image_hash, undefined);
  });

  it("link_data com image_hash quando há imagem", () => {
    const spec = buildMetaObjectStorySpec({
      ...base,
      asset: { kind: "image", imageHash: "hash-1" },
    }) as { link_data: Record<string, unknown> };
    assert.equal(spec.link_data.image_hash, "hash-1");
  });

  it("video_data com miniatura e CTA com destino", () => {
    const spec = buildMetaObjectStorySpec({
      ...base,
      asset: { kind: "video", videoId: "v-1", thumbnailUrl: "https://cdn/t.jpg" },
    }) as { video_data: Record<string, unknown> };
    assert.equal(spec.video_data.video_id, "v-1");
    assert.equal(spec.video_data.image_url, "https://cdn/t.jpg");
    assert.deepEqual(spec.video_data.call_to_action, {
      type: "LEARN_MORE",
      value: { link: base.link },
    });
  });

  it("vídeo ainda sem miniatura publica como ligação em vez de falhar", () => {
    const spec = buildMetaObjectStorySpec({
      ...base,
      asset: { kind: "video", videoId: "v-1", thumbnailUrl: null },
    }) as { link_data?: Record<string, unknown>; video_data?: unknown };
    assert.equal(spec.video_data, undefined);
    assert.equal(spec.link_data?.link, base.link);
  });
});
