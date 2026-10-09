import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { after, describe, it } from "node:test";
import {
  browserStatusFromLaunchError,
  fetchRenderedPageBundle,
  releaseImportBrowser,
  tryAcquireImportBrowser,
} from "./presellFoldBrowser";
import { openVettedSocket, startPresellImportProxy } from "./presellImportProxy";
import { assertExternalProductUrl, isBlockedIpAddress, vetImportUrl } from "./presellImportSsrf";
import { safeImportFetch, type ImportExchange, type ImportRequest } from "./presellSafeFetch";

const PUBLIC = "1.1.1.1";
const ALSO_PUBLIC = "8.8.8.8";

function resolveMap(map: Record<string, string[]>) {
  return async (hostname: string) => {
    if (!(hostname in map)) throw new Error(`DNS simulado sem ${hostname}`);
    return map[hostname]!;
  };
}

function exchange(partial: Partial<ImportExchange> & Pick<ImportExchange, "status">): ImportExchange {
  return {
    headers: {},
    remoteAddress: PUBLIC,
    body: Buffer.from("<html><body>ok</body></html>"),
    ...partial,
  };
}

describe("endereços especiais", () => {
  const blocked = [
    "0.0.0.0",
    "10.1.2.3",
    "100.64.0.1",
    "100.100.100.200",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.4",
    "192.168.1.8",
    "192.0.2.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "255.255.255.255",
    "::1",
    "fe80::1",
    "fd00::1",
    "fc00::1",
    "2001:db8::1",
    "::ffff:127.0.0.1",
    "::ffff:169.254.169.254",
    "64:ff9b::7f00:1",
    "2002:7f00:1::",
  ];
  for (const ip of blocked) {
    it(`bloqueia ${ip}`, () => {
      assert.equal(isBlockedIpAddress(ip), true);
    });
  }

  it("aceita IPv4 e IPv6 públicos", () => {
    assert.equal(isBlockedIpAddress("1.1.1.1"), false);
    assert.equal(isBlockedIpAddress("8.8.8.8"), false);
    assert.equal(isBlockedIpAddress("2001:4860:4860::8888"), false);
  });
});

describe("URL de importação", () => {
  const blockedUrls = [
    "http://127.0.0.1/",
    "http://[::1]/",
    "http://169.254.169.254/latest/meta-data",
    "http://metadata.google.internal/",
    "http://2130706433/",
    "http://0177.0.0.1/",
    "http://0x7f000001/",
    "http://example.com:22/",
    "http://example.com:3306/",
    "http://user:pass@example.com/",
    "file:///etc/passwd",
    "gopher://example.com/",
    "http://db.internal/",
  ];
  for (const url of blockedUrls) {
    it(`recusa ${url}`, () => {
      assert.throws(() => assertExternalProductUrl(url));
    });
  }

  it("aceita https na porta 443", () => {
    assert.equal(assertExternalProductUrl("https://example.com/produto").hostname, "example.com");
  });
});

describe("DNS simulado e redirecionamentos", () => {
  it("recusa o destino quando qualquer endereço resolvido é privado", async () => {
    let requested = false;
    const request: ImportRequest = async () => {
      requested = true;
      return exchange({ status: 200 });
    };
    await assert.rejects(() =>
      safeImportFetch({
        url: "https://rebind.test/page",
        timeoutMs: 1000,
        resolve: resolveMap({ "rebind.test": [PUBLIC, "10.0.0.1"] }),
        request,
      }),
    );
    assert.equal(requested, false);
  });

  it("não segue um redirecionamento para metadados", async () => {
    const calls: string[] = [];
    const request: ImportRequest = async ({ url }) => {
      calls.push(url.hostname);
      return exchange({
        status: 302,
        headers: { location: "http://169.254.169.254/latest/meta-data" },
        body: Buffer.alloc(0),
      });
    };
    await assert.rejects(() =>
      safeImportFetch({
        url: "https://public.test/start",
        timeoutMs: 1000,
        resolve: resolveMap({ "public.test": [PUBLIC] }),
        request,
      }),
    );
    assert.deepEqual(calls, ["public.test"]);
  });

  it("recusa a ligação se o IP remoto não é o IP vetado", async () => {
    const request: ImportRequest = async () => exchange({ status: 200, remoteAddress: "127.0.0.1" });
    await assert.rejects(() =>
      safeImportFetch({
        url: "https://public.test/",
        timeoutMs: 1000,
        resolve: resolveMap({ "public.test": [PUBLIC] }),
        request,
      }),
    );
  });

  it("limita redirecionamentos e bytes", async () => {
    let hops = 0;
    const request: ImportRequest = async () => {
      hops += 1;
      return exchange({
        status: 302,
        headers: { location: "https://public.test/next" },
        body: Buffer.alloc(0),
      });
    };
    await assert.rejects(
      () =>
        safeImportFetch({
          url: "https://public.test/start",
          timeoutMs: 1000,
          maxRedirects: 5,
          resolve: resolveMap({ "public.test": [PUBLIC] }),
          request,
        }),
      /redirecionamentos/,
    );
    assert.equal(hops, 6);

    const huge: ImportRequest = async () => {
      throw new (await import("./presellImportSsrf")).PresellImportBlockedError(
        "A página excede o tamanho máximo permitido na importação.",
      );
    };
    await assert.rejects(
      () =>
        safeImportFetch({
          url: "https://public.test/",
          timeoutMs: 1000,
          resolve: resolveMap({ "public.test": [PUBLIC] }),
          request: huge,
        }),
      /tamanho máximo/,
    );
  });

  it("expira quando o pedido simulado não termina", async () => {
    const request: ImportRequest = ({ signal }) =>
      new Promise((_, reject) => {
        signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    await assert.rejects(
      () =>
        safeImportFetch({
          url: "https://public.test/",
          timeoutMs: 40,
          resolve: resolveMap({ "public.test": [PUBLIC] }),
          request,
        }),
      /Timeout/,
    );
  });

  it("aceita um salto entre dois endereços públicos simulados", async () => {
    const request: ImportRequest = async ({ url, addresses }) => {
      if (url.hostname === "public.test") {
        return exchange({
          status: 302,
          headers: { location: "https://also.public.test/item" },
          body: Buffer.alloc(0),
        });
      }
      assert.deepEqual(addresses, [ALSO_PUBLIC]);
      return exchange({ status: 200, remoteAddress: ALSO_PUBLIC, body: Buffer.from("pagina") });
    };
    const result = await safeImportFetch({
      url: "https://public.test/start",
      timeoutMs: 1000,
      resolve: resolveMap({ "public.test": [PUBLIC], "also.public.test": [ALSO_PUBLIC] }),
      request,
    });
    assert.equal(result.url, "https://also.public.test/item");
    assert.equal(result.body.toString(), "pagina");
  });

  it("não abre socket quando o DNS simulado inclui loopback", async () => {
    let opened = false;
    await assert.rejects(() =>
      openVettedSocket({
        rawUrl: "https://rebind.test/",
        resolve: resolveMap({ "rebind.test": [PUBLIC, "::1"] }),
        openSocket: async () => {
          opened = true;
          throw new Error("não devia ligar");
        },
      }),
    );
    assert.equal(opened, false);
  });

  it("rejeita o peer privado mesmo depois de um DNS público", async () => {
    const socket = new net.Socket();
    Object.defineProperty(socket, "remoteAddress", { value: "10.0.0.1" });
    await assert.rejects(() =>
      openVettedSocket({
        rawUrl: "https://public.test/",
        resolve: resolveMap({ "public.test": [PUBLIC] }),
        openSocket: async (address) => {
          assert.equal(address, PUBLIC);
          return socket;
        },
      }),
    );
  });
});

describe("proxy local com DNS simulado", () => {
  const closers: Array<() => Promise<void>> = [];
  after(async () => {
    await Promise.all(closers.map((close) => close()));
  });

  it("responde 403 sem abrir socket para um nome de metadados", async () => {
    let opened = false;
    const proxy = await startPresellImportProxy({
      resolve: async () => {
        throw new Error("não devia resolver");
      },
      openSocket: async () => {
        opened = true;
        throw new Error("não devia ligar");
      },
    });
    closers.push(proxy.close);
    const status = await new Promise<number>((resolve, reject) => {
      const req = http.request(
        {
          host: "127.0.0.1",
          port: proxy.port,
          method: "GET",
          path: "http://metadata.google.internal/computeMetadata/v1/",
        },
        (res) => {
          res.resume();
          resolve(res.statusCode || 0);
        },
      );
      req.on("error", reject);
      req.end();
    });
    assert.equal(status, 403);
    assert.equal(opened, false);
  });
});

describe("browser", () => {
  it("identifica executável em falta, timeout e fecho", () => {
    assert.equal(browserStatusFromLaunchError("Executable doesn't exist"), "unavailable");
    assert.equal(browserStatusFromLaunchError("page.goto: Timeout 28000ms exceeded"), "failed");
    assert.equal(browserStatusFromLaunchError("Target page, context or browser has been closed"), "failed");
  });

  it("não ocupa o limite de browsers quando o Playwright está desligado", async () => {
    const previous = process.env.PRESELL_DISABLE_PLAYWRIGHT;
    process.env.PRESELL_DISABLE_PLAYWRIGHT = "1";
    try {
      const bundle = await fetchRenderedPageBundle("https://example.com/", "en");
      assert.equal(bundle.browser, "disabled");
      assert.equal(tryAcquireImportBrowser(), true);
      assert.equal(tryAcquireImportBrowser(), false);
    } finally {
      releaseImportBrowser();
      if (previous === undefined) delete process.env.PRESELL_DISABLE_PLAYWRIGHT;
      else process.env.PRESELL_DISABLE_PLAYWRIGHT = previous;
    }
  });

  it("vetImportUrl simulado não consulta a rede", async () => {
    await assert.rejects(() => vetImportUrl("https://rebind.test/", async () => ["127.0.0.1"]));
  });
});
