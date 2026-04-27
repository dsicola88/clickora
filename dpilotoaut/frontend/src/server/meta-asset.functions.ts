import { createServerFn } from "@tanstack/react-start";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { z } from "zod";

import { requireSession } from "@/integrations/auth/auth-middleware";
import { canWriteProject } from "@backend/permissions";

const uploadRoot = () =>
  path.join(
    process.env.UPLOAD_DIR ?? path.join(process.cwd(), "data", "uploads"),
    "meta-creative-assets",
  );

export const uploadMetaCreativeAsset = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) {
      throw new Error("FormData esperado.");
    }
    const projectId = data.get("projectId")?.toString();
    const file = data.get("file");
    if (!projectId || !file || !(file instanceof File)) {
      throw new Error("projectId ou arquivo inválido.");
    }
    return { projectId, file };
  })
  .handler(async ({ data, context }) => {
    if (!(await canWriteProject(data.projectId, context.userId))) {
      throw new Error("Sem permissão para enviar assets neste projeto.");
    }

    const root = uploadRoot();
    const origName = data.file.name || "upload";
    const ext = origName.split(".").pop()?.toLowerCase() ?? "bin";
    const rel = `${data.projectId}/${crypto.randomUUID()}.${ext}`;
    const dest = path.join(root, rel);
    await mkdir(path.dirname(dest), { recursive: true });
    const buf = Buffer.from(await data.file.arrayBuffer());
    await writeFile(dest, buf);

    const previewUrl = `/hooks/meta-asset-file?key=${encodeURIComponent(rel)}`;
    return { path: rel, previewUrl };
  });

const deleteInput = z.object({ path: z.string().min(3).max(500) });

export const deleteMetaCreativeAsset = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .inputValidator((input: unknown) => deleteInput.parse(input))
  .handler(async ({ data, context }) => {
    const key = data.path;
    if (key.includes("..")) throw new Error("Caminho inválido.");
    const projectId = key.split("/")[0];
    if (!projectId) throw new Error("Caminho inválido.");
    if (!(await canWriteProject(projectId, context.userId))) {
      throw new Error("Sem permissão.");
    }
    const root = path.resolve(uploadRoot());
    const full = path.resolve(root, key);
    if (!full.startsWith(root)) throw new Error("Caminho inválido.");
    await unlink(full).catch(() => {});
    return { ok: true as const };
  });
