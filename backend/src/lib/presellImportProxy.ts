import http from "node:http";
import net from "node:net";
import {
  PresellImportBlockedError,
  isBlockedIpAddress,
  resolveImportAddresses,
  vetImportUrl,
} from "./presellImportSsrf";

const MAX_PROXY_SOCKETS = 24;
const SOCKET_TIMEOUT_MS = 15_000;

export type ImportSocketFactory = (address: string, port: number) => Promise<net.Socket>;

function sameIp(left: string, right: string): boolean {
  const normalize = (ip: string) => ip.toLowerCase().replace(/^::ffff:/, "");
  return normalize(left) === normalize(right);
}

export function connectPinnedSocket(address: string, port: number): Promise<net.Socket> {
  if (isBlockedIpAddress(address)) return Promise.reject(new PresellImportBlockedError());
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: address, port, family: address.includes(":") ? 6 : 4 });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new PresellImportBlockedError("Timeout ao ligar ao destino da importação."));
    }, SOCKET_TIMEOUT_MS);
    socket.once("connect", () => {
      clearTimeout(timer);
      const remote = socket.remoteAddress || "";
      if (!remote || isBlockedIpAddress(remote) || !sameIp(remote, address)) {
        socket.destroy();
        reject(new PresellImportBlockedError());
        return;
      }
      resolve(socket);
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

export async function openVettedSocket(args: {
  rawUrl: string;
  resolve?: (hostname: string) => Promise<string[]>;
  openSocket?: ImportSocketFactory;
}): Promise<{ url: URL; socket: net.Socket }> {
  const vetted = await vetImportUrl(args.rawUrl, args.resolve ?? resolveImportAddresses);
  const openSocket = args.openSocket ?? connectPinnedSocket;
  const pinned = vetted.addresses.find((item) => net.isIP(item) === 4) || vetted.addresses[0]!;
  const socket = await openSocket(pinned, vetted.url.port ? Number(vetted.url.port) : vetted.url.protocol === "https:" ? 443 : 80);
  const remote = socket.remoteAddress || vetted.addresses[0]!;
  if (isBlockedIpAddress(remote)) {
    socket.destroy();
    throw new PresellImportBlockedError();
  }
  return { url: vetted.url, socket };
}

export async function startPresellImportProxy(deps?: {
  resolve?: (hostname: string) => Promise<string[]>;
  openSocket?: ImportSocketFactory;
}): Promise<{ port: number; close: () => Promise<void> }> {
  let openSockets = 0;
  const server = http.createServer();

  const refuse = (socket: net.Socket) => {
    if (socket.writable) socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    else socket.destroy();
  };

  const accept = async (rawUrl: string, client: net.Socket, head: Buffer, tunnel: boolean) => {
    if (openSockets >= MAX_PROXY_SOCKETS) {
      refuse(client);
      return;
    }
    openSockets += 1;
    try {
      const { socket } = await openVettedSocket({
        rawUrl,
        resolve: deps?.resolve,
        openSocket: deps?.openSocket,
      });
      socket.setTimeout(SOCKET_TIMEOUT_MS, () => socket.destroy());
      client.setTimeout(SOCKET_TIMEOUT_MS, () => client.destroy());
      if (tunnel) client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length) socket.write(head);
      socket.pipe(client);
      client.pipe(socket);
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        openSockets = Math.max(0, openSockets - 1);
        socket.destroy();
        client.destroy();
      };
      socket.on("close", done);
      client.on("close", done);
      socket.on("error", done);
      client.on("error", done);
    } catch {
      openSockets = Math.max(0, openSockets - 1);
      refuse(client);
    }
  };

  server.on("connect", (req, client, head) => {
    const socket = client as net.Socket;
    const target = req.url || "";
    const [host, portText] = target.split(":");
    const port = Number(portText || "443");
    if (!host) {
      refuse(socket);
      return;
    }
    void accept(`https://${host}:${port}/`, socket, head, true);
  });

  server.on("request", (req, res) => {
    let target: URL;
    try {
      target = new URL(req.url || "");
    } catch {
      res.writeHead(403);
      res.end();
      return;
    }
    void openVettedSocket({
      rawUrl: target.href,
      resolve: deps?.resolve,
      openSocket: deps?.openSocket,
    })
      .then(({ socket }) => {
        openSockets += 1;
        const path = `${target.pathname}${target.search}`;
        socket.write(
          `GET ${path} HTTP/1.1\r\nHost: ${target.host}\r\nConnection: close\r\n\r\n`,
        );
        socket.pipe(res.socket!);
        res.socket?.pipe(socket);
        socket.on("close", () => {
          openSockets = Math.max(0, openSockets - 1);
        });
      })
      .catch(() => {
        res.writeHead(403);
        res.end();
      });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Proxy de importação sem porta.");
  }
  return {
    port: address.port,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
      }),
  };
}
