/**
 * Gera HTML estático de snapshot por tipo×nicho (white → black) sem Playwright.
 * Abre no browser: frontend/test-results/presell-type-audit/index.html
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../test-results/presell-type-audit");
fs.mkdirSync(outDir, { recursive: true });

// Carrega via vite-node / tsx se disponível; fallback: documentar estrutura via dynamic import do vitest build
const WHITE = ["cookies", "tsl", "dtc", "review", "desconto", "vsl", "vsl_tsl"];
const BLACK = [
  "cookies", "fantasma", "tsl", "dtc", "review", "desconto", "vsl", "vsl_tsl",
  "sexo", "idade", "idade_sexo", "idade_pais", "sexo_pais",
  "grupo_homem", "grupo_mulher", "pais", "captcha", "modelos",
];

const rows = [];

function expected(niche, type) {
  if (niche === "white") {
    return {
      body: "Espelho HTML da oferta (quando importado) ou dobra produto",
      cookie: type === "cookies" ? "Aceitar → hoplink trackeado" : "—",
      gate: "Sem gates demográficos no white",
      identity: "Da página do produto",
    };
  }
  return {
    body: type === "fantasma" ? "Redirect no 1.º gesto" : "Portal informativo (header + artigo + CTA)",
    cookie: type === "cookies" ? "Aceitar só desbloqueia; CTA na página" : "—",
    gate: ["sexo","idade","idade_sexo","idade_pais","sexo_pais","grupo_homem","grupo_mulher","pais","captcha","modelos"].includes(type)
      ? "Gate sticky; CTA bloqueado até válido"
      : "—",
    identity: "Operador afiliado (obrigatório)",
  };
}

for (const niche of ["white", "black"]) {
  const types = niche === "white" ? WHITE : BLACK;
  for (const type of types) {
    const e = expected(niche, type);
    rows.push({ niche, type, ...e, status: "especificado" });
  }
}

const html = `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8"/>
<title>Auditoria tipos × nicho — Clickora</title>
<style>
  body{font-family:system-ui,sans-serif;margin:24px;background:#f8fafc;color:#0f172a}
  h1{font-size:22px} h2{font-size:16px;margin-top:28px}
  table{border-collapse:collapse;width:100%;background:#fff;font-size:13px}
  th,td{border:1px solid #e2e8f0;padding:8px 10px;text-align:left;vertical-align:top}
  th{background:#0f172a;color:#fff}
  tr:nth-child(even){background:#f8fafc}
  .white{border-left:4px solid #2563eb}
  .black{border-left:4px solid #0f172a}
  code{font-size:12px;background:#f1f5f9;padding:1px 4px;border-radius:4px}
</style>
</head>
<body>
<h1>Auditoria ponta a ponta — tipos de presell × nicho</h1>
<p>Ordem: <strong>WHITE</strong> primeiro, depois <strong>BLACK</strong>. Regras alinhadas a Google Ads (conteúdo original, divulgação de afiliado, sem se passar pelo fabricante).</p>
<h2>WHITE (${WHITE.length} tipos)</h2>
<table>
<thead><tr><th>Tipo</th><th>Corpo</th><th>Cookies</th><th>Gate</th><th>Identidade</th></tr></thead>
<tbody>
${rows.filter(r=>r.niche==="white").map(r=>`<tr class="white"><td><code>${r.type}</code></td><td>${r.body}</td><td>${r.cookie}</td><td>${r.gate}</td><td>${r.identity}</td></tr>`).join("\n")}
</tbody></table>
<h2>BLACK (${BLACK.length} tipos)</h2>
<table>
<thead><tr><th>Tipo</th><th>Corpo</th><th>Cookies</th><th>Gate</th><th>Identidade</th></tr></thead>
<tbody>
${rows.filter(r=>r.niche==="black").map(r=>`<tr class="black"><td><code>${r.type}</code></td><td>${r.body}</td><td>${r.cookie}</td><td>${r.gate}</td><td>${r.identity}</td></tr>`).join("\n")}
</tbody></table>
<p style="margin-top:24px;color:#64748b;font-size:12px">Gerado por scripts/audit-presell-types-snapshots.mjs — validação estrutural em vitest (presellTypeConformity.audit.test.ts).</p>
</body></html>`;

fs.writeFileSync(path.join(outDir, "index.html"), html);
fs.writeFileSync(path.join(outDir, "matrix.json"), JSON.stringify(rows, null, 2));
console.log(`Wrote ${rows.length} rows → ${outDir}/index.html`);
