import { createFileRoute } from "@tanstack/react-router";
import { readFile } from "fs/promises";
import path from "path";

import { SESSION_COOKIE } from "@backend/auth/constants";
import { parseCookies, verifySessionToken } from "@backend/auth/token";
import { canAccessProject } from "@backend/permissions";

const mimeByExt: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
  mov: "video/quicktime",
};

function uploadRoot() {
  return path.resolve(
    process.env.UPLOAD_DIR ?? path.join(process.cwd(), "data", "uploads"),
    "meta-creative-assets",
  );
}

export const Route = createFileRoute("/hooks/meta-asset-file")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const key = url.searchParams.get("key");
        if (!key || key.includes("..")) {
          return new Response("Bad request", { status: 400 });
        }

        const cookies = parseCookies(request.headers.get("cookie"));
        const token = cookies[SESSION_COOKIE];
        if (!token) return new Response("Unauthorized", { status: 401 });

        let userId: string;
        try {
          const t = await verifySessionToken(token);
          userId = t.sub;
        } catch {
          return new Response("Unauthorized", { status: 401 });
        }

        const projectId = key.split("/")[0];
        if (!projectId) return new Response("Bad request", { status: 400 });
        if (!(await canAccessProject(projectId, userId))) {
          return new Response("Forbidden", { status: 403 });
        }

        const root = uploadRoot();
        const full = path.resolve(root, key);
        if (!full.startsWith(path.resolve(root))) {
          return new Response("Bad request", { status: 400 });
        }

        try {
          const body = await readFile(full);
          const ext = key.split(".").pop()?.toLowerCase() ?? "";
          const ct = mimeByExt[ext] ?? "application/octet-stream";
          return new Response(body, {
            headers: {
              "Content-Type": ct,
              "Cache-Control": "private, max-age=3600",
            },
          });
        } catch {
          return new Response("Not found", { status: 404 });
        }
      },
    },
  },
});
