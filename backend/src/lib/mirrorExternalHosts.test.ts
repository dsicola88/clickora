import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listUntrustedMirrorExternalHosts } from "./mirrorExternalHosts";
import { CLICKORA_MIRROR_TRACK_MARKER } from "./presellMirrorSnapshot";

const TRUSTED = ["offer.example", "www.source.example", null, undefined];
const wrap = (body: string) => `<!DOCTYPE html><html><head></head><body>${body}</body></html>`;

describe("listUntrustedMirrorExternalHosts (P4)", () => {
  it("ignora oferta, origem (e subdomínios), marcador de track, relativos e esquemas não-http", () => {
    const html = wrap(`
      <a href="https://offer.example/buy">a</a>
      <a href="https://shop.source.example/p">b</a>
      <a href="${CLICKORA_MIRROR_TRACK_MARKER}">c</a>
      <a href="/privacy">d</a><a href="#top">e</a>
      <a href="mailto:x@y.z">f</a><a href="tel:123">g</a><a href="javascript:void(0)">h</a>`);
    assert.deepEqual(listUntrustedMirrorExternalHosts(html, TRUSTED), { hosts: [], count: 0 });
  });

  it("ignora checkouts conhecidos e domínios comuns inofensivos", () => {
    const html = wrap(`
      <a href="https://www.buygoods.com/secure/checkout.html?aff_id=1">buy</a>
      <iframe src="https://www.youtube.com/embed/abc"></iframe>
      <a href="https://www.facebook.com/share">fb</a>
      <a href="https://www.fda.gov/x">fda</a>
      <a href="https://uni.example.edu/study">edu</a>`);
    assert.deepEqual(listUntrustedMirrorExternalHosts(html, TRUSTED).hosts, []);
  });

  it("lista domínios desconhecidos em links, formulários, iframes e //protocolo-relativo", () => {
    const html = wrap(`
      <a href="https://evil.example/landing">x</a>
      <a href="https://evil.example/other">y</a>
      <form action="https://collect.bad.test/submit"><input type="submit"></form>
      <iframe src="//ads.tracker.test/frame"></iframe>
      <button formaction="https://other.zone.test/go">go</button>`);
    const r = listUntrustedMirrorExternalHosts(html, TRUSTED);
    assert.deepEqual(r.hosts, ["ads.tracker.test", "collect.bad.test", "evil.example", "other.zone.test"]);
    assert.equal(r.count, 5);
  });

  it("não confunde sufixo parecido (notsource.example ≠ source.example)", () => {
    const html = wrap(`<a href="https://notsource.example/x">x</a>`);
    assert.deepEqual(listUntrustedMirrorExternalHosts(html, TRUSTED).hosts, ["notsource.example"]);
  });

  it("entrada vazia/curta ou inválida não rebenta", () => {
    assert.deepEqual(listUntrustedMirrorExternalHosts("", TRUSTED), { hosts: [], count: 0 });
    assert.deepEqual(listUntrustedMirrorExternalHosts("<a", TRUSTED), { hosts: [], count: 0 });
    assert.deepEqual(listUntrustedMirrorExternalHosts(wrap(`<a href="http://">x</a>`), TRUSTED).hosts, []);
  });
});
