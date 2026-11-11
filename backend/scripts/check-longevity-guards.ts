/**
 * Guards de longevidade (sem mutar dados):
 * - ficheiros fonte demasiado grandes (aviso / falha opcional)
 * - presença de lista tenant ↔ schema (via teste unitário)
 *
 *   npx tsx scripts/check-longevity-guards.ts
 *   LONGEVITY_FAIL_ON_LARGE_FILES=1 npx tsx scripts/check-longevity-guards.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WARN_LINES = 1_200;
const FAIL_LINES = 6_000;

const SCAN_DIRS = [
  path.join(root, "backend/src"),
  path.join(root, "frontend/src"),
];

type Hit = { file: string; lines: number };

/** Catálogos i18n crescem por natureza — não contam como “god file” de lógica. */
function shouldSkip(relOrAbs: string): boolean {
  const n = relOrAbs.replace(/\\/g, "/");
  return (
    n.includes("/node_modules/") ||
    n.includes("/dist/") ||
    n.includes("/i18n/messages/") ||
    n.includes("/i18n/legacy/")
  );
}

function walk(dir: string, out: string[]): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (shouldSkip(full + "/")) continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts") && !shouldSkip(full)) {
      out.push(full);
    }
  }
}

const files: string[] = [];
for (const d of SCAN_DIRS) walk(d, files);

const hits: Hit[] = [];
for (const file of files) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).length;
  if (lines >= WARN_LINES) {
    hits.push({ file: path.relative(root, file), lines });
  }
}
hits.sort((a, b) => b.lines - a.lines);

console.log(`Longevity guard: ${files.length} ficheiros TS/TSX; limiar aviso ${WARN_LINES} linhas.`);
if (hits.length === 0) {
  console.log("OK — nenhum ficheiro acima do limiar.");
  process.exit(0);
}

console.log(`\nFicheiros grandes (${hits.length}) — preferir extrair módulos/services antes de crescer mais:\n`);
for (const h of hits.slice(0, 40)) {
  const tag = h.lines >= FAIL_LINES ? "FAIL" : "WARN";
  console.log(`  [${tag}] ${h.lines.toString().padStart(5)}  ${h.file}`);
}
if (hits.length > 40) console.log(`  … +${hits.length - 40} mais`);

const hard = hits.filter((h) => h.lines >= FAIL_LINES);
const failOnWarn = process.env.LONGEVITY_FAIL_ON_LARGE_FILES === "1";
if (hard.length > 0) {
  console.error(`\nERRO: ${hard.length} ficheiro(s) ≥ ${FAIL_LINES} linhas — partir antes de expandir.`);
  process.exit(1);
}
if (failOnWarn) {
  console.error("\nERRO: LONGEVITY_FAIL_ON_LARGE_FILES=1 e há avisos.");
  process.exit(1);
}

console.log("\nOK (avisos apenas) — CI soft gate.");
process.exit(0);
