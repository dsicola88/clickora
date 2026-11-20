/**
 * One-off generator: cmOps EN/PT catalog → fragment TS modules (en, pt, pt-BR, es).
 * Source: agent-extracted bilingual catalog (pages.dpilot.google.cm ops chrome).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const transcriptPath =
  "/Users/dpa/.cursor/projects/Users-dpa-Documents-Clickora/agent-transcripts/f0b4bff2-a438-46b2-a3ae-4599aacdf8b1/subagents/117189c1-dea5-441e-b3c7-8f2feac0ea18.jsonl";

const line = fs.readFileSync(transcriptPath, "utf8").split("\n")[11];
const outer = JSON.parse(line);
const text = outer.message.content.find((c) => c.type === "text").text;
const m = text.match(/```json\n([\s\S]*?)\n```/);
if (!m) throw new Error("JSON catalog block not found in transcript");
const raw = JSON.parse(m[1]);
const tree = raw["pages.dpilot.google.cm"];

function buildLocale(field) {
  function walk(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v === "object" && "en" in v && "pt" in v) {
        out[k] = v[field];
      } else if (v && typeof v === "object") {
        out[k] = walk(v);
      }
    }
    return out;
  }
  return walk(tree);
}

function ptToPtBR(s) {
  return s
    .replace(/\bProjecto\b/g, "Projeto")
    .replace(/\bprojecto\b/g, "projeto")
    .replace(/\bactualizar\b/gi, (x) => (x[0] === "A" ? "Atualizar" : "atualizar"))
    .replace(/\bactual\b/gi, (x) => (x[0] === "A" ? "Atual" : "atual"))
    .replace(/\bactivo\b/gi, (x) => (x[0] === "A" ? "Ativo" : "ativo"))
    .replace(/\bactivas\b/g, "ativas")
    .replace(/\bacções\b/g, "ações")
    .replace(/\bAcções\b/g, "Ações")
    .replace(/\bequipa\b/g, "equipe")
    .replace(/\bEquipa\b/g, "Equipe")
    .replace(/\bconsola\b/gi, (x) => (x[0] === "C" ? "Console" : "console"))
    .replace(/seleccion/gi, (x) => x.replace(/cc/, "c"))
    .replace(/\breactivar\b/gi, (x) => (x[0] === "R" ? "Reativar" : "reativar"))
    .replace(/\bdirecto\b/gi, (x) => (x[0] === "D" ? "Direto" : "direto"))
    .replace(/licitação/g, "lance")
    .replace(/\butilizador\b/g, "usuário")
    .replace(/\bUtilizador\b/g, "Usuário")
    .replace(/\befectiva\b/gi, (x) => (x[0] === "E" ? "Efetiva" : "efetiva"))
    .replace(/óptim/g, "otim");
}

/** Path → Spanish (curated for CM ops chrome). */
function buildEsMap() {
  const en = buildLocale("en");
  const paths = [];
  function collect(obj, prefix = "") {
    for (const [k, v] of Object.entries(obj)) {
      const p = prefix ? `${prefix}.${k}` : k;
      if (typeof v === "string") paths.push([p, v]);
      else collect(v, p);
    }
  }
  collect(en);
  const map = new Map();

  for (const [p, enStr] of paths) {
    map.set(p, esFromEn(enStr, p));
  }
  return map;
}

function esFromEn(en, pathKey) {
  const exact = ES_EXACT[pathKey];
  if (exact) return exact;

  let s = en;
  const sorted = [...ES_PHRASES].sort((a, b) => b[0].length - a[0].length);
  for (const [from, to] of sorted) {
    if (s.includes(from)) s = s.split(from).join(to);
  }
  return s;
}

const ES_EXACT = {
  "common.keywordPt": "Palabra clave",
  "common.approvalsPt": "Aprobaciones",
  "common.reject": "Descartar",
  "common.resume": "Reanudar",
  "common.approvals": "Approvals",
  "status.syncLabel.restated": "Reenviado",
  "status.syncLabel.retracted": "Retirado",
  "status.changeRequestType.createCampaign": "Google Ads — nueva campaña de Búsqueda",
  "status.changeRequestType.syncCampaignNegatives":
    "Google Ads — sincronizar palabras clave negativas de la campaña",
  "status.changeRequestType.syncAdGroupNegatives":
    "Google Ads — sincronizar palabras clave negativas del grupo",
  "status.changeRequestType.replaceExtensions":
    "Google Ads — reemplazar extensiones (sitelinks, destacados, snippet)",
  "campaigns.localMismatchHint":
    "Las campañas sin ID de Google son borradores de este proyecto — no el inventario de ads.google.com{accountSuffix}. Use «Volver a sincronizar e importar» para traer las campañas reales de la cuenta.",
  "terms.badgeProject": "Proyecto",
  "automations.description":
    "Estado actual del motor Paid en este proyecto. Las reglas e historial detallados están en Auditoría — aquí solo el resumen para el media buyer en {cmTitle}.",
  "assistant.descAutopilot": " — intenta aplicar en Google ahora.",
  "assistant.descCopilot": " — el propietario aplica ahora; los demás van a Aprobaciones.",
};

const ES_PHRASES = [
  ["Google Ads — new Search campaign", "Google Ads — nueva campaña de Búsqueda"],
  ["Google Ads — budget change", "Google Ads — cambio de presupuesto"],
  ["Google Ads — new keywords", "Google Ads — nuevas palabras clave"],
  ["Google Ads — publish RSA ad", "Google Ads — publicar anuncio RSA"],
  ["Google Ads — pause entity", "Google Ads — pausar elemento"],
  ["Google Ads — resume entity", "Google Ads — reactivar elemento"],
  ["Google Ads — remove keyword", "Google Ads — eliminar palabra clave"],
  ["Google Ads — update RSA copy", "Google Ads — actualizar textos RSA"],
  ["Google Ads — adjust ad group CPC", "Google Ads — ajustar CPC del grupo"],
  ["Google Ads — change bidding strategy", "Google Ads — cambiar estrategia de puja"],
  ["Google Ads — sync campaign negatives", "Google Ads — sincronizar negativas de campaña"],
  ["Google Ads — sync ad group negatives", "Google Ads — sincronizar negativas del grupo"],
  ["Google Ads — replace extensions", "Google Ads — reemplazar extensiones"],
  ["Google Ads — update locations", "Google Ads — actualizar ubicaciones (incluir / excluir)"],
  ["Google Ads — update languages", "Google Ads — actualizar idiomas de la campaña"],
  ["Google Ads — device bid adjustment", "Google Ads — ajuste de puja por dispositivo"],
  ["Google Ads — exclude age ranges", "Google Ads — excluir rangos de edad"],
  ["Could not load", "No se pudo cargar"],
  ["Could not read upload settings", "No se pudo leer la configuración de carga"],
  ["Could not load sales", "No se pudo cargar ventas"],
  ["Could not apply on Google Ads.", "No se pudo aplicar en Google Ads."],
  ["Only in this project", "Solo en este proyecto"],
  ["On Google", "En Google"],
  ["Re-sync and import", "Volver a sincronizar e importar"],
  ["Use Integrations account", "Usar cuenta de Integraciones"],
  ["Open Integrations", "Abrir Integraciones"],
  ["Change budget", "Cambiar presupuesto"],
  ["Change daily budget on Google", "Cambiar presupuesto diario en Google"],
  ["Dismiss", "Descartar"],
  ["Enable", "Activar"],
  ["Refresh", "Actualizar"],
  ["Manage", "Gestionar"],
  ["Actions", "Acciones"],
  ["Spend", "Gasto"],
  ["Cost", "Costo"],
  ["Conversions", "Conversiones"],
  ["Ready to publish", "Lista para publicar"],
  ["Approved (not published)", "Aprobado (sin publicar)"],
  ["Applied on network", "Aplicado en la red"],
  ["Failed on network", "Falló en la red"],
  ["Off / not configured", "Apagado / sin configurar"],
  ["Apply on network", "Aplicar en la red"],
  ["Open Approvals", "Abrir Aprobaciones"],
  ["Search terms", "Términos de búsqueda"],
  ["Final URL", "URL final"],
  ["this project", "este proyecto"],
  ["This project", "Este proyecto"],
  ["ad network", "red publicitaria"],
  ["the network", "la red"],
  ["on the network", "en la red"],
  ["On the network", "En la red"],
  ["network API", "API de la red"],
  ["network error", "error de red"],
  ["Network error", "Error de red"],
  ["campaign studio", "estudio de campaña"],
  ["Campaign studio", "Estudio de campaña"],
  ["campaigns", "campañas"],
  ["Campaigns", "Campañas"],
  ["campaign", "campaña"],
  ["Campaign", "Campaña"],
  ["Ad group", "Grupo de anuncios"],
  ["ad group", "grupo de anuncios"],
  ["Keywords", "Palabras clave"],
  ["keywords", "palabras clave"],
  ["keyword", "palabra clave"],
  ["Keyword", "Palabra clave"],
  ["Approvals", "Aprobaciones"],
  ["approvals", "aprobaciones"],
  ["Integrations", "Integraciones"],
  ["Studio", "Estudio"],
  ["studio", "estudio"],
  ["Draft", "Borrador"],
  ["draft", "borrador"],
  ["drafts", "borradores"],
  ["Archived", "Archivada"],
  ["Active", "Activa"],
  ["Paused", "Pausada"],
  ["Pending", "Pendiente"],
  ["Rejected", "Rechazado"],
  ["Failed", "Falló"],
  ["failed", "falló"],
  ["Apply", "Aplicar"],
  ["Pause", "Pausar"],
  ["pause", "pausar"],
  ["Budget", "Presupuesto"],
  ["budget", "presupuesto"],
  ["Clicks", "Clics"],
  ["clicks", "clics"],
  ["Overview", "Resumen"],
  ["overview", "resumen"],
  ["Settings", "Configuración"],
  ["History", "Historial"],
  ["Reports", "Informes"],
  ["Recommendations", "Recomendaciones"],
  ["Automations", "Automatizaciones"],
  ["Assistant", "Asistente"],
  ["Audit", "Auditoría"],
  ["audit", "auditoría"],
  ["Import", "Importar"],
  ["import", "importar"],
  ["Duplicate", "Duplicar"],
  ["Filter", "Filtrar"],
  ["Analyze", "Analizar"],
  ["Confirm", "Confirmar"],
  ["View all", "Ver todo"],
  ["View campaigns", "Ver campañas"],
  ["Open campaigns", "Abrir campañas"],
  ["Create campaign", "Crear campaña"],
  ["All campaigns", "Todas las campañas"],
  ["Local only", "Solo local"],
  ["Queue", "Cola"],
  ["queue", "cola"],
  ["Owner", "Propietario"],
  ["owner", "propietario"],
  ["team", "equipo"],
  ["Team", "Equipo"],
  ["account", "cuenta"],
  ["Account", "Cuenta"],
  ["device", "dispositivo"],
  ["Device", "Dispositivo"],
  ["Mobile", "Móvil"],
  ["period", "período"],
  ["Period", "Período"],
  ["linked", "vinculada"],
  ["Connect", "Conectar"],
  ["Disconnect", "Desconectar"],
  ["Approve", "Aprobar"],
  ["Archive request", "Archivar solicitud"],
  ["Waste", "Desperdicio"],
  ["waste", "desperdicio"],
  ["wasteful", "ineficiente"],
  ["Block", "Bloquear"],
  ["blocked", "bloqueado"],
  ["Already blocked", "Ya bloqueado"],
  ["Phrase (recommended)", "Frase (recomendado)"],
  ["This exact term only", "Solo este término exacto"],
  ["Similar (broader)", "Similar (más amplio)"],
  ["Only wasteful spend", "Solo gasto ineficiente"],
  ["Live campaigns", "Campañas activas"],
  ["What people searched", "Lo que buscaron"],
  ["What they searched", "Lo que buscaron"],
  ["Times seen", "Veces visto"],
  ["Sales", "Ventas"],
  ["Risk", "Riesgo"],
  ["risk", "riesgo"],
  ["Funnel risk", "Riesgo de embudo"],
  ["Repair Final URLs", "Reparar URLs finales"],
  ["auto-tagging", "autoetiquetado"],
  ["presell", "presell"],
  ["lander", "lander"],
  ["cloaking", "cloaking"],
  ["Capture", "Captura"],
  ["capture", "captura"],
  ["Average", "Promedio"],
  ["Avg. CPC", "CPC prom."],
  ["Processing…", "Procesando…"],
  ["Applying…", "Aplicando…"],
  ["Syncing…", "Sincronizando…"],
  ["Loading", "Cargando"],
  ["Tip:", "Consejo:"],
  ["Yes", "Sí"],
  ["No", "No"],
  ["Status", "Estado"],
  ["status", "estado"],
  ["Type", "Tipo"],
  ["Note", "Nota"],
  ["When", "Cuándo"],
  ["Error", "Error"],
  ["Summary", "Resumen"],
  ["Why it's here", "Por qué está aquí"],
  ["To handle", "Por gestionar"],
  ["Google overview", "Resumen de Google"],
  ["Google campaigns", "Campañas de Google"],
  ["AI assistant", "Asistente de IA"],
  ["Google account", "Cuenta de Google"],
  ["Connect Google account", "Conectar cuenta de Google"],
  ["Connect account", "Conectar cuenta"],
  ["Account ready", "Cuenta lista"],
  ["Account not synced yet", "Cuenta aún no sincronizada"],
  ["Affiliate loop ready", "Ciclo de afiliado listo"],
  ["Conversion upload incomplete", "Carga de conversiones incompleta"],
  ["Upload ready", "Carga lista"],
  ["Recent sync", "Sincronización reciente"],
  ["This project only", "Solo este proyecto"],
  ["Metrics by campaign", "Métricas por campaña"],
  ["Recent ledger (upload)", "Ledger reciente (carga)"],
  ["Reports → Conversions", "Informes → Conversiones"],
  ["By device", "Por dispositivo"],
  ["By campaign", "Por campaña"],
  ["All imported", "Todas las importadas"],
  ["Open audit & motor", "Abrir auditoría y motor"],
  ["View motor in Audit", "Ver motor en Auditoría"],
  ["Request in queue", "Solicitud en cola"],
  ["Open queue", "Abrir cola"],
  ["Confirm and send", "Confirmar y enviar"],
  ["Suggestions (confirmation required)", "Sugerencias (confirmación obligatoria)"],
  ["Configure / bootstrap", "Configurar / bootstrap"],
  ["Run bootstrap", "Ejecutar bootstrap"],
  ["Bootstrap completed", "Bootstrap completado"],
  ["Use this account and import campaigns", "Usar esta cuenta e importar campañas"],
  ["Re-sync / import", "Volver a sincronizar / importar"],
  ["Disconnect from Studio", "Desconectar del Estudio"],
  ["Filtering requests for campaign", "Filtrando solicitudes de la campaña"],
  ["Open campaign studio", "Abrir estudio de campaña"],
  ["Try “Apply on network” again", "Intentar «Aplicar en la red» de nuevo"],
  ["Records that you accept the plan in Clickora; does not publish to the ad network yet.", "Registra que acepta el plan en Clickora; aún no publica en la red publicitaria."],
  ["Closes the request without applying changes on Google / Meta / TikTok.", "Cierra la solicitud sin aplicar cambios en Google / Meta / TikTok."],
  ["Sends this plan to the network API and tries to create or update resources on the linked account.", "Envía este plan a la API de la red e intenta crear o actualizar recursos en la cuenta vinculada."],
  ["Effective publish on the account — use when you have validated the plan above.", "Publicación efectiva en la cuenta — úselo cuando haya validado el plan anterior."],
];

function buildEs(enTree, esMap) {
  function walk(obj, prefix = "") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const p = prefix ? `${prefix}.${k}` : k;
      if (typeof v === "string") out[k] = esMap.get(p) ?? v;
      else out[k] = walk(v, p);
    }
    return out;
  }
  return walk(enTree);
}

function toTsConst(exportName, obj) {
  return `export const ${exportName} = ${JSON.stringify(obj, null, 2)} as const;\n`;
}

function leafKeys(obj, prefix = "") {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out.push(p);
    else out.push(...leafKeys(v, p));
  }
  return out.sort();
}

const en = buildLocale("en");
const pt = buildLocale("pt");
const ptBR = (function walkPt(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = typeof v === "string" ? ptToPtBR(v) : walkPt(v);
  }
  return out;
})(pt);
const esMap = buildEsMap();
const es = buildEs(en, esMap);

const outDir = path.join(root, "src/i18n/messages/fragments");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "cmOps.en.ts"), toTsConst("cmOpsEn", en));
fs.writeFileSync(path.join(outDir, "cmOps.pt.ts"), toTsConst("cmOpsPt", pt));
fs.writeFileSync(path.join(outDir, "cmOps.pt-BR.ts"), toTsConst("cmOpsPtBR", ptBR));
fs.writeFileSync(path.join(outDir, "cmOps.es.ts"), toTsConst("cmOpsEs", es));

const sets = [
  ["en", new Set(leafKeys(en))],
  ["pt", new Set(leafKeys(pt))],
  ["pt-BR", new Set(leafKeys(ptBR))],
  ["es", new Set(leafKeys(es))],
];
const ref = sets[0][1];
console.log("Generated cmOps fragments.");
for (const [lang, set] of sets) {
  const missing = [...ref].filter((k) => !set.has(k));
  const extra = [...set].filter((k) => !ref.has(k));
  console.log(
    `${lang}: ${set.size} leaves` +
      (missing.length ? ` MISSING[${missing.length}] ${missing.slice(0, 2).join(", ")}` : " parity OK") +
      (extra.length ? ` EXTRA[${extra.length}]` : ""),
  );
}