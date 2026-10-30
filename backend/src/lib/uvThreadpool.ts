/**
 * Define UV_THREADPOOL_SIZE antes de bcrypt/fs nativos usarem o pool.
 * Importar como primeira linha de server.ts.
 */
import { cpus } from "node:os";

if (!process.env.UV_THREADPOOL_SIZE) {
  const n = Math.max(4, Math.min(8, cpus()?.length || 4));
  process.env.UV_THREADPOOL_SIZE = String(n);
}
