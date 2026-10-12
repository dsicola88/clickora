import { execSync } from "node:child_process";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

function currentRelease(): string {
  const fromEnv = process.env.VITE_APP_RELEASE?.trim() || process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  if (fromEnv) return fromEnv.slice(0, 12);
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "dev";
  }
}

/** O mesmo identificador vai no bundle e em /version.json. Um deploy novo faz o aviso aparecer. */
function appReleasePlugin(release: string): Plugin {
  const body = JSON.stringify({ release });
  return {
    name: "app-release",
    config() {
      return {
        define: {
          "import.meta.env.VITE_APP_RELEASE": JSON.stringify(release),
        },
      };
    },
    configureServer(server) {
      server.middlewares.use("/version.json", (_req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        res.end(body);
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "version.json", source: body });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), appReleasePlugin(currentRelease())],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
