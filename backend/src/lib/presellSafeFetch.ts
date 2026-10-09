import http from "node:http";
import https from "node:https";
import type { LookupOptions } from "node:dns";
import {
  IMPORT_MAX_HTML_BYTES,
  IMPORT_MAX_REDIRECTS,
  PresellImportBlockedError,
  isBlockedIpAddress,
  vetImportUrl,
} from "./presellImportSsrf";

export type ImportExchange = {
  status: number;
  headers: http.IncomingHttpHeaders;
  remoteAddress: string;
  body: Buffer;
};

export type ImportRequest = (args: {
  url: URL;
  headers: Record<string, string>;
  addresses: string[];
  signal: AbortSignal;
  maxBytes: number;
}) => Promise<ImportExchange>;

export type SafeImportFetchResult = {
  url: string;
  status: number;
  body: Buffer;
  contentType: string;
};

function headerValue(headers: http.IncomingHttpHeaders, name: string): string {
  const value = headers[name];
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function sameIp(left: string, right: string): boolean {
  const normalize = (ip: string) => ip.toLowerCase().replace(/^::ffff:/, "");
  return normalize(left) === normalize(right);
}

export function nodeImportRequest(args: {
  url: URL;
  headers: Record<string, string>;
  addresses: string[];
  signal: AbortSignal;
  maxBytes: number;
}): Promise<ImportExchange> {
  const address = args.addresses[0];
  if (!address || isBlockedIpAddress(address)) {
    return Promise.reject(new PresellImportBlockedError());
  }
  const family = address.includes(":") ? 6 : 4;
  const lib = args.url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        protocol: args.url.protocol,
        hostname: args.url.hostname,
        port: args.url.port || (args.url.protocol === "https:" ? 443 : 80),
        path: `${args.url.pathname}${args.url.search}`,
        method: "GET",
        headers: { ...args.headers, host: args.url.host },
        servername: args.url.hostname,
        signal: args.signal,
        lookup: ((
          _hostname: string,
          options: LookupOptions,
          callback: (err: NodeJS.ErrnoException | null, address: string | Array<{ address: string; family: number }>, family?: number) => void,
        ) => {
          const entries = args.addresses.map((item) => ({
            address: item,
            family: item.includes(":") ? 6 : 4,
          }));
          const first = entries[0]!;
          if (typeof options === "function") {
            (options as (err: NodeJS.ErrnoException | null, address: string, family: number) => void)(
              null,
              first.address,
              first.family,
            );
            return;
          }
          if (options.all) {
            callback(null, entries);
            return;
          }
          callback(null, first.address, first.family);
        }) as never,
      },
      (res) => {
        const remoteAddress = res.socket?.remoteAddress || "";
        if (!remoteAddress || isBlockedIpAddress(remoteAddress) || !args.addresses.some((item) => sameIp(item, remoteAddress))) {
          res.destroy();
          reject(new PresellImportBlockedError());
          return;
        }
        const status = res.statusCode || 0;
        if (status >= 300 && status < 400) {
          res.resume();
          resolve({ status, headers: res.headers, remoteAddress, body: Buffer.alloc(0) });
          return;
        }
        const declared = Number(headerValue(res.headers, "content-length"));
        if (Number.isFinite(declared) && declared > args.maxBytes) {
          res.destroy();
          reject(new PresellImportBlockedError("A página excede o tamanho máximo permitido na importação."));
          return;
        }
        const chunks: Buffer[] = [];
        let total = 0;
        res.on("data", (chunk: Buffer) => {
          total += chunk.length;
          if (total > args.maxBytes) {
            res.destroy();
            reject(new PresellImportBlockedError("A página excede o tamanho máximo permitido na importação."));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          resolve({ status, headers: res.headers, remoteAddress, body: Buffer.concat(chunks) });
        });
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.end();
  });
}

export async function safeImportFetch(input: {
  url: string;
  headers?: Record<string, string>;
  timeoutMs: number;
  maxBytes?: number;
  maxRedirects?: number;
  resolve?: (hostname: string) => Promise<string[]>;
  request?: ImportRequest;
}): Promise<SafeImportFetchResult> {
  const maxBytes = input.maxBytes ?? IMPORT_MAX_HTML_BYTES;
  const maxRedirects = input.maxRedirects ?? IMPORT_MAX_REDIRECTS;
  const request = input.request ?? nodeImportRequest;
  const signal = AbortSignal.timeout(input.timeoutMs);
  let current = input.url;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const vetted = await vetImportUrl(current, input.resolve);
    let exchange: ImportExchange;
    try {
      exchange = await request({
        url: vetted.url,
        headers: input.headers ?? {},
        addresses: vetted.addresses,
        signal,
        maxBytes,
      });
    } catch (error) {
      if (error instanceof PresellImportBlockedError) throw error;
      const name = error instanceof Error ? error.name : "";
      const message = error instanceof Error ? error.message : String(error);
      if (name === "AbortError" || name === "TimeoutError" || /aborted|timeout/i.test(message)) {
        throw new PresellImportBlockedError(
          `Timeout ao ler a página do produto (${Math.round(input.timeoutMs / 1000)}s). Tente outro link ou confirme que o site responde rápido — pedidos lentos falham atrás do proxy.`,
        );
      }
      throw error;
    }
    if (isBlockedIpAddress(exchange.remoteAddress) || !vetted.addresses.some((item) => sameIp(item, exchange.remoteAddress))) {
      throw new PresellImportBlockedError();
    }
    if (exchange.status >= 300 && exchange.status < 400) {
      const location = headerValue(exchange.headers, "location");
      if (!location || hop === maxRedirects) {
        throw new PresellImportBlockedError("A página tem demasiados redirecionamentos.");
      }
      current = new URL(location, vetted.url).href;
      continue;
    }
    return {
      url: vetted.url.href,
      status: exchange.status,
      body: exchange.body,
      contentType: headerValue(exchange.headers, "content-type"),
    };
  }
  throw new PresellImportBlockedError("A página tem demasiados redirecionamentos.");
}
