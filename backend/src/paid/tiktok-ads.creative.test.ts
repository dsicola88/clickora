import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parsePaidAssetRelPath } from "./paid-asset-file";
import {
  buildTikTokAdCreative,
  extractTikTokCreativeSource,
  hasTikTokCreativeSource,
  sanitizeTikTokAdText,
  tiktokCallToActionFromObjective,
} from "./tiktok-ads.creative";

const PROJECT = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

describe("extractTikTokCreativeSource", () => {
  it("lê o vídeo carregado, o destino e o primeiro hook do plano", () => {
    const src = extractTikTokCreativeSource({
      video_asset_path: `${PROJECT}/abc123.mp4`,
      landing_url: "https://exemplo.pt/oferta",
      plan: { hooks: { texts: ["  Ganha atenção no feed  ", "outro"], tone: "directo" } },
    });
    assert.equal(src.assetPath, `${PROJECT}/abc123.mp4`);
    assert.equal(src.landingUrl, "https://exemplo.pt/oferta");
    assert.equal(src.adText, "Ganha atenção no feed");
    assert.equal(src.videoId, null);
  });

  it("aceita ids já existentes e destinos alternativos do payload", () => {
    const src = extractTikTokCreativeSource({
      video_id: "v-1",
      image_ids: ["i-1", "i-2"],
      landing_page_url: "https://exemplo.pt/",
      call_to_action: "SHOP_NOW",
      identity_id: "id-9",
    });
    assert.equal(src.videoId, "v-1");
    assert.deepEqual(src.imageIds, ["i-1", "i-2"]);
    assert.equal(src.landingUrl, "https://exemplo.pt/");
    assert.equal(src.callToAction, "SHOP_NOW");
    assert.equal(src.identityId, "id-9");
  });
});

describe("hasTikTokCreativeSource", () => {
  it("sem material o anúncio não é tentado", () => {
    assert.equal(hasTikTokCreativeSource(extractTikTokCreativeSource({})), false);
    assert.equal(hasTikTokCreativeSource(extractTikTokCreativeSource(undefined)), false);
  });

  it("um ficheiro carregado basta para criar o anúncio", () => {
    const src = extractTikTokCreativeSource({ video_asset_path: `${PROJECT}/abc123.mp4` });
    assert.equal(hasTikTokCreativeSource(src), true);
  });
});

describe("tiktokCallToActionFromObjective", () => {
  it("mapeia objectivos remotos para CTAs válidos", () => {
    assert.equal(tiktokCallToActionFromObjective("TRAFFIC"), "LEARN_MORE");
    assert.equal(tiktokCallToActionFromObjective("VIDEO_VIEWS"), "WATCH_NOW");
    assert.equal(tiktokCallToActionFromObjective("LEAD_GENERATION"), "SIGN_UP");
    assert.equal(tiktokCallToActionFromObjective("CONVERSIONS"), "SHOP_NOW");
    assert.equal(tiktokCallToActionFromObjective("APP_INSTALL"), "DOWNLOAD_NOW");
    assert.equal(tiktokCallToActionFromObjective("RF_REACH"), "LEARN_MORE");
  });
});

describe("sanitizeTikTokAdText", () => {
  it("linha única, sem chavetas e no limite de 100 caracteres", () => {
    assert.equal(sanitizeTikTokAdText("Linha 1\nLinha {2}"), "Linha 1 Linha 2");
    assert.equal(sanitizeTikTokAdText("a".repeat(140)).length, 100);
  });
});

describe("buildTikTokAdCreative", () => {
  const base = {
    adName: "Campanha — Ad",
    identityId: "identity-1",
    imageIds: ["cover-1"],
    adText: "Experimenta hoje",
    callToAction: "LEARN_MORE",
    landingPageUrl: "https://exemplo.pt/",
    displayName: "Clickora",
  };

  it("SINGLE_VIDEO com capa quando há vídeo", () => {
    const c = buildTikTokAdCreative({ ...base, videoId: "video-1" });
    assert.equal(c.ad_format, "SINGLE_VIDEO");
    assert.equal(c.video_id, "video-1");
    assert.deepEqual(c.image_ids, ["cover-1"]);
    assert.equal(c.identity_type, "CUSTOMIZED_USER");
    assert.equal(c.operation_status, "ENABLE");
  });

  it("SINGLE_IMAGE quando só existe imagem", () => {
    const c = buildTikTokAdCreative({ ...base, videoId: null });
    assert.equal(c.ad_format, "SINGLE_IMAGE");
    assert.equal(c.video_id, undefined);
    assert.deepEqual(c.image_ids, ["cover-1"]);
  });
});

describe("parsePaidAssetRelPath", () => {
  it("aceita o formato devolvido pelo upload", () => {
    const p = parsePaidAssetRelPath(`${PROJECT}/a1b2c3.mp4`);
    assert.equal(p?.projectId, PROJECT);
    assert.equal(p?.kind, "video");
    assert.equal(p?.mime, "video/mp4");
  });

  it("recusa travessia de directórios e extensões fora da whitelist", () => {
    assert.equal(parsePaidAssetRelPath(`${PROJECT}/../../etc/passwd`), null);
    assert.equal(parsePaidAssetRelPath(`${PROJECT}/script.sh`), null);
    assert.equal(parsePaidAssetRelPath("abc/foto.png"), null);
    assert.equal(parsePaidAssetRelPath(null), null);
  });
});
