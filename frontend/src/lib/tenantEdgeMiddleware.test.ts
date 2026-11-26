import { describe, expect, it } from "vitest";
import middleware, { classifyTenantPath } from "../../middleware.js";

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
    ["/l/c2e3caf4-de15-48bd-aeca-3f69b07a0358", "pass"],
    ["/assets/index-abc.js", "pass"],
    ["/favicon.ico", "pass"],
    ["/landing/hero-default.png", "pass"],
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

  it("não altera o site principal", () => {
    expect(run("www.dclickora.com", "/")).toBeUndefined();
    expect(run("www.dclickora.com", "/auth")).toBeUndefined();
    expect(run("www.dclickora.com", "/p/c2e3caf4-de15-48bd-aeca-3f69b07a0358")).toBeUndefined();
    expect(run("clickora-git-main.vercel.app", "/presells")).toBeUndefined();
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
