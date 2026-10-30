/**
 * Hash/compare de passwords fora do event loop principal.
 * Preferência: bcrypt nativo (libuv threadpool) — mesmo cost 12, sem bloquear o loop.
 * Fallback: worker_threads + bcryptjs se o módulo nativo não carregar.
 * Limita concorrência a min(4, CPUs) para não saturar a máquina sob login storms.
 */
import { cpus } from "node:os";
import { Worker } from "node:worker_threads";

const BCRYPT_ROUNDS = 12;
const POOL_SIZE = Math.max(1, Math.min(4, cpus()?.length || 2));

type NativeBcrypt = {
  compare: (password: string, hash: string) => Promise<boolean>;
  hash: (password: string, rounds: number) => Promise<string>;
};

let native: NativeBcrypt | null = null;
let nativeTried = false;

function loadNative(): NativeBcrypt | null {
  if (nativeTried) return native;
  nativeTried = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("bcrypt") as NativeBcrypt;
    if (typeof mod.compare === "function" && typeof mod.hash === "function") {
      native = mod;
      return native;
    }
  } catch {
    native = null;
  }
  return native;
}

type JobBody =
  | { op: "compare"; password: string; hash: string }
  | { op: "hash"; password: string; rounds: number };

type Job = JobBody & { id: number };

type JobResult =
  | { id: number; ok: boolean }
  | { id: number; hash: string }
  | { id: number; error: string };

type Pending = {
  resolve: (v: boolean | string) => void;
  reject: (e: Error) => void;
  op: "compare" | "hash";
};

const pending = new Map<number, Pending>();
let nextId = 1;
let workers: Worker[] = [];
let nextWorker = 0;
let workerBroken = false;
let initTried = false;

async function fallbackCompare(password: string, hash: string): Promise<boolean> {
  const bcrypt = await import("bcryptjs");
  return bcrypt.compare(password, hash);
}

async function fallbackHash(password: string, rounds: number): Promise<string> {
  const bcrypt = await import("bcryptjs");
  return bcrypt.hash(password, rounds);
}

function workerSource(): string {
  return `
const { parentPort } = require('worker_threads');
const bcrypt = require('bcryptjs');
parentPort.on('message', async (msg) => {
  try {
    if (msg.op === 'compare') {
      const ok = await bcrypt.compare(msg.password, msg.hash);
      parentPort.postMessage({ id: msg.id, ok: Boolean(ok) });
    } else if (msg.op === 'hash') {
      const hash = await bcrypt.hash(msg.password, msg.rounds);
      parentPort.postMessage({ id: msg.id, hash });
    }
  } catch (e) {
    parentPort.postMessage({ id: msg.id, error: e && e.message ? String(e.message) : 'bcrypt_worker_error' });
  }
});
`;
}

function onWorkerMessage(msg: JobResult): void {
  const p = pending.get(msg.id);
  if (!p) return;
  pending.delete(msg.id);
  if ("error" in msg && msg.error) {
    p.reject(new Error(msg.error));
    return;
  }
  if (p.op === "compare" && "ok" in msg) p.resolve(Boolean(msg.ok));
  else if (p.op === "hash" && "hash" in msg) p.resolve(msg.hash);
  else p.reject(new Error("bcrypt_worker_bad_result"));
}

function failAllPending(err: Error): void {
  for (const [, p] of pending) p.reject(err);
  pending.clear();
}

function ensurePool(): Worker[] {
  if (workerBroken) return [];
  if (workers.length > 0) return workers;
  if (initTried) return [];
  initTried = true;
  try {
    const created: Worker[] = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const w = new Worker(workerSource(), { eval: true });
      w.on("message", onWorkerMessage);
      w.on("error", (err) => {
        console.warn("[passwordCrypto] worker error:", err.message);
        workerBroken = true;
        workers = [];
        failAllPending(err);
      });
      w.on("exit", (code) => {
        if (code !== 0) {
          console.warn("[passwordCrypto] worker exit", code);
          workerBroken = true;
        }
        workers = workers.filter((x) => x !== w);
      });
      created.push(w);
    }
    workers = created;
    return workers;
  } catch (e) {
    console.warn(
      "[passwordCrypto] worker indisponível, fallback in-process:",
      e instanceof Error ? e.message : e,
    );
    workerBroken = true;
    return [];
  }
}

let inFlight = 0;
const waitQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (inFlight < POOL_SIZE) {
    inFlight += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    waitQueue.push(() => {
      inFlight += 1;
      resolve();
    });
  });
}

function releaseSlot(): void {
  inFlight = Math.max(0, inFlight - 1);
  const next = waitQueue.shift();
  if (next) next();
}

function runJob(job: JobBody): Promise<boolean | string> {
  return new Promise((resolve, reject) => {
    const pool = ensurePool();
    if (pool.length === 0) {
      reject(new Error("no_worker"));
      return;
    }
    const id = nextId++;
    pending.set(id, { resolve, reject, op: job.op });
    const w = pool[nextWorker % pool.length]!;
    nextWorker += 1;
    const msg: Job = { ...job, id };
    w.postMessage(msg);
  });
}

export function passwordCryptoPoolSize(): number {
  return POOL_SIZE;
}

export function passwordBcryptRounds(): number {
  return BCRYPT_ROUNDS;
}

export function passwordCryptoBackend(): "native" | "workers" | "inprocess" {
  if (loadNative()) return "native";
  if (!workerBroken && (workers.length > 0 || !initTried)) return "workers";
  return "inprocess";
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  await acquireSlot();
  try {
    const n = loadNative();
    if (n) return Boolean(await n.compare(password, passwordHash));
    try {
      const r = await runJob({ op: "compare", password, hash: passwordHash });
      return Boolean(r);
    } catch {
      return fallbackCompare(password, passwordHash);
    }
  } finally {
    releaseSlot();
  }
}

export async function hashPassword(password: string, rounds: number = BCRYPT_ROUNDS): Promise<string> {
  const r = rounds > 0 ? rounds : BCRYPT_ROUNDS;
  await acquireSlot();
  try {
    const n = loadNative();
    if (n) return String(await n.hash(password, r));
    try {
      const out = await runJob({ op: "hash", password, rounds: r });
      return String(out);
    } catch {
      return fallbackHash(password, r);
    }
  } finally {
    releaseSlot();
  }
}
