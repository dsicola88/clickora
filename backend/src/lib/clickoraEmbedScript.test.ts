import assert from "node:assert/strict";
import { describe, it } from "node:test";
import vm from "node:vm";
import { CLICKORA_EMBED_JS } from "./clickoraEmbedScript";

const PID = "11111111-1111-4111-8111-111111111111";

function run(opts: { href: string; cookie?: string; attrs?: Record<string, string>; scriptSrc?: string }) {
  const calls: Array<{ url: string; init: { body: string } }> = [];
  const url = new URL(opts.href);
  const script = {
    src: opts.scriptSrc ?? "https://api.example.com/api/track/v2/trk.min.js",
    getAttribute: (k: string) => opts.attrs?.[k] ?? null,
  };
  const ctx = {
    URL,
    URLSearchParams,
    location: { href: url.href, pathname: url.pathname, search: url.search },
    document: {
      currentScript: script,
      cookie: opts.cookie ?? "",
      referrer: "https://www.google.com/",
      getElementsByTagName: () => [script],
    },
    fetch: (u: string, init: { body: string }) => {
      calls.push({ url: u, init });
    },
  };
  vm.runInNewContext(CLICKORA_EMBED_JS, ctx);
  return calls;
}

describe("trk.min.js (embed)", () => {
  it("não expõe o nome da plataforma no script servido", () => {
    assert.doesNotMatch(CLICKORA_EMBED_JS, /dclickora\.com|powered by/i);
  });

  it("alias legado clickora.min.js continua a resolver a API base", () => {
    const calls = run({
      href: `https://offer.tenant.com/p/${PID}`,
      scriptSrc: "https://api.example.com/api/track/v2/clickora.min.js",
    });
    assert.equal(calls[0]!.url, "https://api.example.com/api/track/event");
  });

  it("é legível (não minificado numa linha) e sem padrões de injeção", () => {
    assert.ok(CLICKORA_EMBED_JS.split("\n").length > 40);
    assert.doesNotMatch(CLICKORA_EMBED_JS, /\beval\(|new Function|atob\(|fromCharCode|document\.write|location\.(href\s*=|replace|assign)|window\.open/);
    assert.doesNotMatch(CLICKORA_EMBED_JS, /document\.cookie\s*=/);
  });

  it("envia 1 pageview com gclid/UTMs/_fbp/_ttp para /track/event", () => {
    const calls = run({
      href: `https://offer.tenant.com/p/${PID}?gclid=G1&utm_source=google&utm_campaign=c1&foo=bar`,
      cookie: "a=1; _fbp=fb.1.123; _ttp=tt%2Fx",
      attrs: { "data-id": "u1" },
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, "https://api.example.com/api/track/event");
    const body = JSON.parse(calls[0]!.init.body);
    assert.equal(body.presell_id, PID);
    assert.equal(body.event_type, "pageview");
    assert.equal(body.referrer, "https://www.google.com/");
    assert.equal(body.metadata.gclid, "G1");
    assert.equal(body.metadata.utm_source, "google");
    assert.equal(body.metadata.utm_campaign, "c1");
    assert.equal(body.metadata.foo, undefined);
    assert.equal(body.metadata.fbp, "fb.1.123");
    assert.equal(body.metadata.ttp, "tt/x");
    assert.equal(body.metadata.clickora_user_id, "u1");
    assert.match(body.metadata.landing_url, /gclid=G1/);
  });

  it("data-presell-id e data-api-base têm prioridade; sem presell não envia", () => {
    const calls = run({
      href: "https://site.example/landing",
      attrs: { "data-presell-id": PID, "data-api-base": "https://t.example/api" },
    });
    assert.equal(calls[0]!.url, "https://t.example/api/track/event");
    assert.equal(JSON.parse(calls[0]!.init.body).presell_id, PID);
    assert.equal(run({ href: "https://site.example/landing" }).length, 0);
  });
});
