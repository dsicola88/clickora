import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv, mergeConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

const frontendRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(frontendRoot, "..");

export default defineConfig(({ mode }) => {
  // Tudo o que está em .env / .env.local na raiz (DATABASE_URL, AUTH_SECRET, etc.),
  // no processo Node — não depende de `process.cwd` ao correr o dev server.
  for (const [key, value] of Object.entries(loadEnv(mode, repoRoot, ""))) {
    if (value === "") continue;
    process.env[key] = value;
  }

  const loaded = loadEnv(mode, repoRoot, "VITE_");
  const envDefine = Object.fromEntries(
    Object.entries(loaded).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
  );

  /** Iframe dentro do app Clickora (/tracking/dpilot). Sobrescrever em produção com DPILOTO_FRAME_ANCESTORS (lista separada por espaços). */
  const frameAncestors =
    process.env.DPILOTO_FRAME_ANCESTORS?.trim() ||
    [
      "'self'",
      "https://www.dclickora.com",
      "https://dclickora.com",
      "http://localhost:8080",
      "http://127.0.0.1:8080",
      "http://localhost:5174",
      "http://127.0.0.1:5174",
    ].join(" ");

  return mergeConfig(
    {
      root: frontendRoot,
      define: envDefine,
      resolve: {
        alias: {
          "@": path.join(frontendRoot, "src"),
          "@backend": path.join(repoRoot, "backend", "src"),
          "@clickora/paid": path.join(repoRoot, "..", "backend", "src", "paid"),
        },
        dedupe: [
          "react",
          "react-dom",
          "react/jsx-runtime",
          "react/jsx-dev-runtime",
          "@tanstack/react-query",
          "@tanstack/query-core",
        ],
      },
      // Prisma: com `browser` nas condições, o Vite pode resolver a entrada
      // `index-browser.js` (sem delegados de modelo) → `prisma.landingPage` fica
      // `undefined` e ocorre «Cannot read properties of undefined (reading 'findFirst')».
      ssr: {
        resolve: {
          conditions: ["node", "import", "module", "default", "browser"],
        },
      },
      plugins: [
        tailwindcss(),
        tsConfigPaths({ projects: [path.join(repoRoot, "tsconfig.json")] }),
        ...tanstackStart(),
        nitro({
          // Vercel (CI define VERCEL=1) gera .vercel/output; noutros ambientes, servidor Node (Railway, Fly…).
          preset: process.env.VERCEL ? "vercel" : "node-server",
          routeRules: {
            "/**": {
              headers: {
                "Content-Security-Policy": `frame-ancestors ${frameAncestors}`,
              },
            },
          },
        }),
        viteReact(),
      ],
      // O `root` é `frontend/`; os pacotes reais vivem em `../node_modules` (Nitro, TanStack, …).
      // Sem isto, o Module Runner do Vite dev recusa ficheiros fora de `frontend/` e o Nitro falha
      // com ERR_LOAD_URL em dev-entry.mjs / server entry.
      server: { host: "::", port: 8080, fs: { allow: [repoRoot] } },
    },
    {},
  );
});
