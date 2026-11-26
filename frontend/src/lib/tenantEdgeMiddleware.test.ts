import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import middleware, { classifyMainHostPath, classifyTenantPath } from "../../middleware.js";

function run(host: string, path: string): Response | undefined {
  return middleware(new Request(`https://${host}${path}`, { headers: { host } })) as Response | undefined;
}

describe("classifyTenantPath", () => {
  it.each([
    ["/", "shell"],
    ["/index.html", "shell"],
    ["/p/c2e3caf4-de15-48bd-aeca-3f69b07a0358", "shell"],
    ["/vissia-f2x6", "shell"],
    ["/vissia-f2x6/", "shell"],
    ["/termos", "shell"],
    ["/aviso-cookies", "shell"],
    ["/api/track/r/abc", "pass"],
    ["/l/c2e3caf4-de15-48bd-aeca-3f69b07a0358", "lite"],
    ["/assets/index-abc.js", "pass"],
    ["/tenant-shell.html", "pass"],
    ["/favicon.ico", "not_found"],
    ["/manifest.webmanifest", "not_found"],
    ["/sw-push.js", "not_found"],
    ["/brand-dclickora.png", "not_found"],
    ["/landing/hero-default.png", "not_found"],
    ["/wp-login.php", "not_found"],
    ["/.env", "not_found"],
    ["/xmlrpc.php", "not_found"],
    ["/qa/qualquer.html", "not_found"],
    ["/p/abc.php", "not_found"],
    ["/auth", "panel"],
    ["/login", "panel"],
    ["/admin", "panel"],
    ["/presells", "panel"],
    ["/admin/users", "panel"],
    ["/integracoes/postback", "panel"],
    ["/tracking/dpilot/x", "panel"],
    ["/sitemap.xml", "not_found"],
    ["/p/abc/extra", "not_found"],
    ["/wp-admin/install", "not_found"],
    ["/foo/bar", "not_found"],
  ])("%s → %s", (path, kind) => {
    expect(classifyTenantPath(path).kind).toBe(kind);
  });
});

describe("middleware", () => {
  it("serve o HTML neutro nas landers de assinante, sem mudar a URL do browser", () => {
    const res = run("wellformulas.store", "/vissia-f2x6?gclid=abc");
    expect(res?.headers.get("x-middleware-rewrite")).toBe("https://wellformulas.store/tenant-shell.html");
  });

  it("redireciona o painel SaaS do host de assinante para a dclickora", () => {
    const res = run("wellformulas.store", "/auth?next=/presells");
    expect(res?.status).toBe(308);
    expect(res?.headers.get("location")).toBe("https://www.dclickora.com/auth?next=/presells");
  });

  it("devolve 404 real a caminhos desconhecidos no host de assinante", () => {
    const res = run("wellformulas.store", "/pagina/que-nao-existe");
    expect(res?.status).toBe(404);
    expect(res?.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("não serve ficheiros de verificação Google fora do host dono", () => {
    expect(run("wellformulas.store", "/googleae3afd87ea0e96cd.html")?.status).toBe(404);
    expect(run("wellformulas.store", "/google3501df392bc0f6af.html")?.status).toBe(404);
    expect(run("www.dclickora.com", "/google3501df392bc0f6af.html")?.status).toBe(404);
    expect(run("www.dclickora.com", "/googleae3afd87ea0e96cd.html")).toBeUndefined();
    expect(run("truefindlab.blog", "/google3501df392bc0f6af.html")).toBeUndefined();
  });

  it("não altera o site principal (institucional, auth e painel) nem previews do painel", () => {
    expect(run("www.dclickora.com", "/")).toBeUndefined();
    expect(run("www.dclickora.com", "/auth")).toBeUndefined();
    expect(run("www.dclickora.com", "/presells")).toBeUndefined();
    expect(run("clickora-git-main.vercel.app", "/presells")).toBeUndefined();
    expect(run("clickora-git-main.vercel.app", "/")).toBeUndefined();
  });

  it("alias *.vercel.app do mesmo projeto segue a regra do domínio principal (sem presells públicas)", () => {
    const ID = "c2e3caf4-de15-48bd-aeca-3f69b07a0358";
    for (const host of ["clickora.vercel.app", "clickora-git-main-team.vercel.app"]) {
      expect(run(host, `/p/${ID}`)?.status).toBe(404);
      expect(run(host, `/l/${ID}`)?.status).toBe(404);
      expect(run(host, "/vissia-f2x6")?.status).toBe(404);
      expect(run(host, `/api/public/presells/id/${ID}`)?.status).toBe(404);
      expect(run(host, `/api/track/r/${ID}`)?.status).toBe(404);
    }
  });

  it("host de assinante: lixo com extensão dá 404 real (nunca o HTML de marketing da plataforma)", () => {
    for (const path of ["/wp-login.php", "/.env", "/xmlrpc.php", "/qualquer.php", "/x/y.html", "/favicon.ico"]) {
      const res = run("wellformulas.store", path);
      expect(res?.status, path).toBe(404);
      expect(res?.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    }
    expect(run("wellformulas.store", "/tenant-shell.html")).toBeUndefined();
  });

  it("host de assinante: marketing da plataforma (plans-landing) não é servido", () => {
    expect(run("wellformulas.store", "/api/public/plans-landing")?.status).toBe(404);
    expect(run("wellformulas.store", "/api/public/plans-landing/hero-image")?.status).toBe(404);
    expect(run("wellformulas.store", "/api/public/branding")).toBeUndefined();
    expect(run("www.dclickora.com", "/api/public/plans-landing")).toBeUndefined();
  });

  it("domínio principal: lixo com extensão dá 404 real, ficheiros reais continuam a servir", () => {
    for (const host of ["www.dclickora.com", "dclickora.com"]) {
      for (const path of ["/wp-login.php", "/.env", "/xmlrpc.php", "/qa/visivra.html", "/robots-tenant.txt", "/tenant-shell.html"]) {
        expect(run(host, path)?.status, `${host}${path}`).toBe(404);
      }
    }
    for (const path of ["/favicon.ico", "/manifest.webmanifest", "/sitemap.xml", "/landing/hero-default.png", "/sounds/caixa-registradora.wav"]) {
      expect(run("www.dclickora.com", path), path).toBeUndefined();
    }
  });

  it("ficheiros emitidos pelo build na raiz (vite.config emitFile) continuam servíveis no domínio principal", () => {
    const viteConfig = readFileSync(path.resolve(__dirname, "../../vite.config.ts"), "utf8");
    const emitted = [...viteConfig.matchAll(/fileName:\s*"([^"/]+)"/g)].map((m) => m[1]);
    expect(emitted).toContain("version.json");
    for (const name of emitted) {
      expect(classifyMainHostPath(`/${name}`).kind, name).toBe("pass");
    }
  });

  it("tudo o que existe em frontend/public continua servível no domínio principal (ou é intencionalmente bloqueado)", () => {
    const publicDir = path.resolve(__dirname, "../../public");
    const intentionallyBlocked = new Set(["qa", "robots-tenant.txt"]);
    const handledEarlier = /^google[0-9a-f]+\.html$/i; // verificação Search Console: tratado antes do guard
    for (const entry of readdirSync(publicDir, { withFileTypes: true })) {
      if (intentionallyBlocked.has(entry.name) || handledEarlier.test(entry.name)) continue;
      if (entry.isDirectory()) {
        const inner = readdirSync(path.join(publicDir, entry.name))[0];
        if (!inner) continue;
        expect(classifyMainHostPath(`/${entry.name}/${inner}`).kind, entry.name).toBe("pass");
      } else {
        expect(classifyMainHostPath(`/${entry.name}`).kind, entry.name).toBe("pass");
      }
    }
  });

  it("/l/<id> em domínio de assinante leva visitor_host do Host real e preserva gclid/UTMs", () => {
    const ID = "a521fe37-6ab9-4aa7-a9e2-3d5a056466fe";
    const rw = run("wellformulas.store", `/l/${ID}?gclid=abc&utm_source=google`)?.headers.get("x-middleware-rewrite");
    expect(rw).toBeTruthy();
    const u = new URL(rw as string);
    expect(u.host).toBe("wellformulas.store");
    expect(u.pathname).toBe(`/l/${ID}`);
    expect(u.searchParams.get("visitor_host")).toBe("wellformulas.store");
    expect(u.searchParams.get("gclid")).toBe("abc");
    expect(u.searchParams.get("utm_source")).toBe("google");

    const spoofed = run("wellformulas.store", `/l/${ID}?visitor_host=outro.com`)?.headers.get("x-middleware-rewrite");
    expect(new URL(spoofed as string).searchParams.get("visitor_host")).toBe("wellformulas.store");

    expect(run("wellformulas.store", `/l/${ID}?visitor_host=wellformulas.store`)).toBeUndefined();
    expect(run("www.dclickora.com", `/l/${ID}`)?.status).toBe(404);
  });

  it("resposta igual para qualquer User-Agent", () => {
    const ua = (agent: string) =>
      middleware(
        new Request("https://wellformulas.store/vissia-f2x6", {
          headers: { host: "wellformulas.store", "user-agent": agent },
        }),
      ) as Response | undefined;
    const human = ua("Mozilla/5.0 (Windows NT 10.0) Chrome/124.0");
    const bot = ua("AdsBot-Google (+http://www.google.com/adsbot.html)");
    expect(bot?.headers.get("x-middleware-rewrite")).toBe(human?.headers.get("x-middleware-rewrite"));
  });

  describe("domínio principal não serve presells públicas", () => {
    const ID = "c2e3caf4-de15-48bd-aeca-3f69b07a0358";
    const ADSBOT = "Mozilla/5.0 (compatible; AdsBot-Google; +http://www.google.com/adsbot.html)";
    const call = (host: string, path: string, headers: Record<string, string> = {}) =>
      middleware(new Request(`https://${host}${path}`, { headers: { host, ...headers } })) as Response | undefined;

    for (const host of ["www.dclickora.com", "dclickora.com"]) {
      it(`${host}: /l/<id> → 404 real e noindex (qualquer User-Agent)`, () => {
        for (const ua of ["Mozilla/5.0 Chrome/124", ADSBOT]) {
          const res = call(host, `/l/${ID}`, { "user-agent": ua });
          expect(res?.status).toBe(404);
          expect(res?.headers.get("x-robots-tag")).toBe("noindex, nofollow");
        }
      });

      it(`${host}: API pública da presell sem sessão → 404 sem cache (qualquer User-Agent)`, async () => {
        for (const path of [`/api/public/presells/id/${ID}`, `/api/public/presells/id/${ID}/html`, "/api/public/presells/slug/vissia-f2x6"]) {
          for (const ua of ["Mozilla/5.0 Chrome/124", ADSBOT]) {
            const res = call(host, path, { "user-agent": ua });
            expect(res?.status).toBe(404);
            expect(res?.headers.get("cache-control")).toBe("private, no-store");
            const body = (await res?.json()) as { code?: string };
            expect(body.code).toBe("PRESELL_NOT_PUBLIC_ON_MAIN_HOST");
          }
        }
      });

      it(`${host}: com sessão (Bearer) segue para o backend, que só serve o dono`, () => {
        expect(call(host, `/api/public/presells/id/${ID}`, { authorization: "Bearer abc.def.ghi" })).toBeUndefined();
      });
    }

    for (const host of ["www.dclickora.com", "dclickora.com"]) {
      it(`${host}: /p/<id>, /track/r e slugs → 404 real (AdsBot, Googlebot e humano)`, () => {
        const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
        for (const path of [
          `/p/${ID}`,
          `/p/${ID}?gclid=abc`,
          "/p/qualquer-id",
          "/l/qualquer-id",
          "/vissia-f2x6",
          "/blackvisi-pjwc/",
          "/track/r/abc",
          "/wp-admin/install",
        ]) {
          for (const ua of ["Mozilla/5.0 Chrome/124", ADSBOT, GOOGLEBOT]) {
            const res = call(host, path, { "user-agent": ua });
            expect(res?.status, `${path} (${ua})`).toBe(404);
            expect(res?.headers.get("x-robots-tag")).toBe("noindex, nofollow");
          }
        }
      });

      it(`${host}: saltos /api/track/r e /api/track/rot → 404 mesmo com sessão`, () => {
        for (const path of [`/api/track/r/${ID}`, `/api/track/r/${ID}/sub?to=https://x.test`, "/api/track/rot/abc"]) {
          expect(call(host, path)?.status).toBe(404);
          expect(call(host, path, { authorization: "Bearer abc.def.ghi" })?.status).toBe(404);
        }
      });

      it(`${host}: presell na raiz de domínio só com sessão`, () => {
        expect(call(host, "/api/public/custom-domain/root-presell")?.status).toBe(404);
      });
    }

    it("outras rotas públicas da API e o resto do site principal não são afetados", () => {
      expect(call("www.dclickora.com", "/api/public/branding")).toBeUndefined();
      expect(call("www.dclickora.com", "/api/public/presell-builder/u/f.png")).toBeUndefined();
      expect(call("www.dclickora.com", "/api/track/pixel/abc.gif")).toBeUndefined();
      expect(call("www.dclickora.com", "/api/track/postback/google-ads")).toBeUndefined();
      expect(call("www.dclickora.com", "/super-presell")).toBeUndefined();
      expect(call("www.dclickora.com", "/")).toBeUndefined();
      expect(call("www.dclickora.com", "/presells/preview/" + ID)).toBeUndefined();
      expect(call("www.dclickora.com", "/favicon.ico")).toBeUndefined();
      expect(call("www.dclickora.com", "/assets/index-abc.js")).toBeUndefined();
    });

    it("todas as rotas da SPA em App.tsx continuam acessíveis no domínio principal", () => {
      const appTsx = readFileSync(path.resolve(__dirname, "../App.tsx"), "utf8");
      const segments = new Set(
        [...appTsx.matchAll(/path(?::|=)\s*"\/([a-zA-Z0-9_-]+)/g)].map((m) => m[1].toLowerCase()),
      );
      segments.delete("p");
      segments.delete("l");
      expect(segments.size).toBeGreaterThan(20);
      for (const seg of segments) {
        expect(classifyMainHostPath(`/${seg}`).kind, seg).toBe("pass");
      }
    });

    it("domínios de assinante, previews e localhost mantêm o comportamento", () => {
      expect(call("wellformulas.store", `/l/${ID}`)?.headers.get("x-middleware-rewrite")).toContain(`/l/${ID}?visitor_host=wellformulas.store`);
      expect(call("wellformulas.store", `/api/public/presells/id/${ID}`)).toBeUndefined();
      expect(call("clickora-git-main.vercel.app", "/presells")).toBeUndefined();
      expect(call("localhost", `/api/public/presells/id/${ID}`)).toBeUndefined();
    });
  });

  it("robots.txt do domínio principal: só o site institucional, sem rotas internas", async () => {
    for (const host of ["www.dclickora.com", "dclickora.com"]) {
      const res = run(host, "/robots.txt");
      expect(res?.status).toBe(200);
      const body = (await res?.text()) ?? "";
      expect(body).toContain("User-agent: *");
      expect(body).toContain("Allow: /");
      expect(body).toContain("Sitemap: https://www.dclickora.com/sitemap.xml");
      expect(body).not.toMatch(/Disallow/i);
      for (const internal of ["/p/", "/l/", "/api", "/inicio", "/presells", "/settings", "/integracoes", "/tracking", "/rotadores", "/urls", "/admin"]) {
        expect(body).not.toContain(internal);
      }
    }
  });

  it("robots-marketing.txt estático é idêntico ao do middleware", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const file = readFileSync(resolve(__dirname, "../../public/robots-marketing.txt"), "utf8");
    const edge = (await run("www.dclickora.com", "/robots.txt")?.text()) ?? "";
    expect(file).toBe(edge);
  });

  it("robots.txt de assinante sem referência à plataforma", async () => {
    const body = await run("wellformulas.store", "/robots.txt")?.text();
    expect(body).toBe("User-agent: *\nDisallow: /\n");
  });
});
