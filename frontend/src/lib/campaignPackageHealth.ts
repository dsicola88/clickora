import { adTextLength } from "@/lib/adText";
import type { AdBundle, ValidationIssue } from "@/services/keywordResearchService";

export type PackageHealthRow = {
  id: string;
  label: string;
  detail: string;
  ok: boolean;
};

const HEADLINE_MIN = 3;
const HEADLINE_MAX = 15;
const HEADLINE_LEN = 30;
const DESC_MIN = 2;
const DESC_MAX = 4;
const DESC_LEN = 90;
const SITELINK_TARGET = 4;
const SITELINK_TEXT = 25;
const SITELINK_DESC = 35;
const CALLOUT_LEN = 25;
const CALLOUT_MIN = 2;

function sitelinkTextMax(s: { description1: string; description2: string }, platform: AdBundle["platform"]): number {
  if (s.description1.trim() || s.description2.trim()) return 25;
  return platform === "microsoft" ? 35 : 25;
}

export function campaignPackageHealth(bundle: AdBundle, issues: ValidationIssue[]): PackageHealthRow[] {
  const invalidPaths = new Set(issues.filter((i) => i.level === "invalid").map((i) => i.path.split(".")[0]));

  const headlineCountOk = bundle.headlines.length >= HEADLINE_MIN && bundle.headlines.length <= HEADLINE_MAX;
  const headlineLenOk = bundle.headlines.every((h) => adTextLength(h.text) <= HEADLINE_LEN);
  const descCountOk = bundle.descriptions.length >= DESC_MIN && bundle.descriptions.length <= DESC_MAX;
  const descLenOk = bundle.descriptions.every((d) => adTextLength(d.text) <= DESC_LEN);

  const sitelinkCount = bundle.sitelinks.length;
  const sitelinkOk =
    sitelinkCount >= SITELINK_TARGET &&
    bundle.sitelinks.every((s) => {
      const tMax = sitelinkTextMax(s, bundle.platform);
      if (adTextLength(s.text) > tMax) return false;
      if (adTextLength(s.description1) > SITELINK_DESC) return false;
      if (adTextLength(s.description2) > SITELINK_DESC) return false;
      return true;
    });

  const calloutLenOk = bundle.callouts.every((c) => adTextLength(c.text) <= CALLOUT_LEN && adTextLength(c.text) >= 1);
  const calloutCountOk = bundle.callouts.length === 0 || bundle.callouts.length >= CALLOUT_MIN;

  const snippetOk =
    !bundle.snippet ||
    (bundle.snippet.values.length >= 3 && bundle.snippet.values.every((v) => adTextLength(v) <= 25));

  const promotionOk = !bundle.promotion || Boolean(bundle.promotion.item?.trim() && bundle.promotion.value?.trim());

  const exportBlocked = issues.some((i) => i.level === "invalid");

  return [
    {
      id: "headlines",
      label: "Títulos (RSA)",
      detail: `${bundle.headlines.length} títulos · máx. ${HEADLINE_LEN} car.`,
      ok: headlineCountOk && headlineLenOk && !invalidPaths.has("headlines"),
    },
    {
      id: "descriptions",
      label: "Descrições",
      detail: `${bundle.descriptions.length} descrições · máx. ${DESC_LEN} car.`,
      ok: descCountOk && descLenOk && !invalidPaths.has("descriptions"),
    },
    {
      id: "sitelinks",
      label: "Sitelinks",
      detail: `${sitelinkCount}/${SITELINK_TARGET} · texto ${SITELINK_TEXT} (35 sem desc.) · desc. ${SITELINK_DESC}`,
      ok: sitelinkOk && !invalidPaths.has("sitelinks"),
    },
    {
      id: "callouts",
      label: "Destaques",
      detail:
        bundle.callouts.length === 0
          ? "Opcional · confirme preço/oferta na página ou use neutros com URL"
          : `${bundle.callouts.length} · máx. ${CALLOUT_LEN} car. (${CALLOUT_MIN}+ para servir)`,
      ok: calloutLenOk && calloutCountOk && !invalidPaths.has("callouts"),
    },
    {
      id: "snippet",
      label: "Snippet estruturado",
      detail: bundle.snippet
        ? `${bundle.snippet.header}: ${bundle.snippet.values.length} valores`
        : "Omitido até haver lista real (tipos, marcas, serviços)",
      ok: snippetOk && !invalidPaths.has("snippet"),
    },
    {
      id: "promotion",
      label: "Promoção",
      detail: bundle.promotion
        ? `${bundle.promotion.value} · ${bundle.promotion.item}`
        : "Omitida sem desconto confirmado",
      ok: promotionOk && !invalidPaths.has("promotion"),
    },
    {
      id: "export",
      label: "Exportação",
      detail: exportBlocked ? "Corrija inválidos antes do CSV final" : "Regras rígidas OK · CSV continua a ser revisão",
      ok: !exportBlocked,
    },
  ];
}
