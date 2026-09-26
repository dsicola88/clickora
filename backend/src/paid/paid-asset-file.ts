/**
 * Leitura dos criativos carregados pelos assistentes (Meta/TikTok).
 * Os uploads guardam `uploads/paid-*-assets/<projectId>/<hex>.<ext>` e devolvem o caminho
 * relativo `<projectId>/<hex>.<ext>` no payload do plano — ver `lib/paidMetaAssetUpload.ts`.
 */
import fs from "fs";
import path from "path";

export type PaidAssetKind = "image" | "video";

const EXT_INFO: Record<string, { mime: string; kind: PaidAssetKind }> = {
  jpg: { mime: "image/jpeg", kind: "image" },
  jpeg: { mime: "image/jpeg", kind: "image" },
  png: { mime: "image/png", kind: "image" },
  webp: { mime: "image/webp", kind: "image" },
  mp4: { mime: "video/mp4", kind: "video" },
  mov: { mime: "video/quicktime", kind: "video" },
};

const REL_PATH =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/([a-z0-9_-]{1,64})\.([a-z0-9]{3,4})$/i;

export type ParsedPaidAssetPath = {
  projectId: string;
  fileName: string;
  mime: string;
  kind: PaidAssetKind;
};

/** Valida o formato `<projectId>/<ficheiro>.<ext>`; recusa travessia de directórios e extensões fora da whitelist. */
export function parsePaidAssetRelPath(relPath: unknown): ParsedPaidAssetPath | null {
  if (typeof relPath !== "string") return null;
  const m = REL_PATH.exec(relPath.trim().replace(/^\/+/, ""));
  if (!m) return null;
  const projectId = m[1]!;
  const base = m[2]!;
  const ext = m[3]!.toLowerCase();
  const info = EXT_INFO[ext];
  if (!info) return null;
  return { projectId, fileName: `${base}.${ext}`, mime: info.mime, kind: info.kind };
}

export type PaidAssetFile = ParsedPaidAssetPath & { absPath: string; bytes: Buffer };

/** Lê o ficheiro do disco quando o caminho pertence ao projecto e existe; `null` caso contrário. */
export function readPaidAssetFile(
  root: string,
  projectId: string,
  relPath: unknown,
): PaidAssetFile | null {
  const parsed = parsePaidAssetRelPath(relPath);
  if (!parsed || parsed.projectId !== projectId) return null;
  const dir = path.join(root, parsed.projectId);
  const absPath = path.join(dir, parsed.fileName);
  if (!absPath.startsWith(`${dir}${path.sep}`)) return null;
  if (!fs.existsSync(absPath)) return null;
  return { ...parsed, absPath, bytes: fs.readFileSync(absPath) };
}
