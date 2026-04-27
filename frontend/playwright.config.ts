import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");

/** Porta dedicada ao E2E para não colidir com `npm run dev` na 8080. */
const PORT = 5174;
const baseURL = `http://127.0.0.1:${PORT}`;

/** Só no GitHub Actions é obrigatório arrancar servidores novos; com `CI=1` no IDE reutiliza portas já abertas. */
const reuseExistingServer = process.env.GITHUB_ACTIONS !== "true";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run api:dev",
      cwd: repoRoot,
      url: "http://127.0.0.1:3001/api/health",
      reuseExistingServer,
      timeout: 120_000,
    },
    {
      command: `npm run dev -- --port ${PORT} --host 127.0.0.1`,
      cwd: __dirname,
      url: baseURL,
      reuseExistingServer,
      timeout: 120_000,
    },
  ],
});
