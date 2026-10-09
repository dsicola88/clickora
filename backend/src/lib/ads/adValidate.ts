import type { AdBundle } from "./adBundle";
import { claimIsUserSupplied } from "./adBundle";
import { adTextLength } from "./adText";
import {
  CALLOUT_MAX,
  CALLOUT_MIN_COUNT,
  GOOGLE_SNIPPET_HEADERS,
  MICROSOFT_SNIPPET_HEADERS,
  SNIPPET_MIN_VALUES,
  SNIPPET_VALUE_MAX,
  type AdPlatform,
  rsaSpec,
  sitelinkSpec,
} from "./platformSpecs";

export type ValidationLevel = "valid" | "warning" | "invalid" | "confirm" | "unsupported";

export type ValidationIssue = {
  level: ValidationLevel;
  code: string;
  path: string;
  message: string;
  platform: AdPlatform | "both";
};

function issue(
  level: ValidationLevel,
  code: string,
  path: string,
  message: string,
  platform: AdPlatform | "both",
): ValidationIssue {
  return { level, code, path, message, platform };
}

function isHttp(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function sameText(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function validateBundle(bundle: AdBundle, notes: string): ValidationIssue[] {
  const platforms: AdPlatform[] = bundle.platform === "both" ? ["google", "microsoft"] : [bundle.platform];
  const issues: ValidationIssue[] = [];

  if (bundle.source === "deterministic") {
    issues.push(
      issue(
        "warning",
        "fallback",
        "source",
        bundle.llmFailed
          ? "A geração inteligente falhou. Este pacote é o fallback determinístico, não um resultado novo da IA."
          : "Pacote gerado pelo fallback determinístico. Não é equivalente a uma redação da IA.",
        "both",
      ),
    );
  }

  for (const platform of platforms) {
    const rsa = rsaSpec(platform);
    const sl = sitelinkSpec(platform);
    const label = platform === "google" ? "Google Ads" : "Microsoft Advertising";

    if (bundle.headlines.length < rsa.headlineMin) {
      issues.push(
        issue("invalid", "headline_count", "headlines", `${label}: são necessários pelo menos ${rsa.headlineMin} títulos.`, platform),
      );
    } else if (bundle.headlines.length > rsa.headlineMaxCount) {
      issues.push(
        issue("invalid", "headline_count", "headlines", `${label}: no máximo ${rsa.headlineMaxCount} títulos.`, platform),
      );
    }
    const seenH = new Set<string>();
    bundle.headlines.forEach((h, i) => {
      const len = adTextLength(h.text);
      if (!h.text.trim()) {
        issues.push(issue("invalid", "empty", `headlines.${i}`, `${label}: título vazio.`, platform));
      } else if (len > rsa.headlineMax) {
        issues.push(
          issue("invalid", "length", `headlines.${i}`, `${label}: título com ${len}/${rsa.headlineMax} caracteres.`, platform),
        );
      }
      const key = h.text.trim().toLowerCase();
      if (key && seenH.has(key)) {
        issues.push(issue("invalid", "duplicate", `headlines.${i}`, `${label}: título repetido no mesmo anúncio.`, platform));
      }
      seenH.add(key);
      if (h.pin && !claimIsUserSupplied(h.text, notes)) {
        issues.push(issue("confirm", "claim", `headlines.${i}`, `${label}: alegação sem dados confirmados.`, platform));
      } else if (!claimIsUserSupplied(h.text, notes)) {
        issues.push(issue("invalid", "claim", `headlines.${i}`, `${label}: alegação que não está nos dados indicados.`, platform));
      }
      if (h.pin) {
        issues.push(
          issue(
            "warning",
            "pin",
            `headlines.${i}`,
            `${label}: título fixado na posição ${h.pin}. Isto reduz a liberdade de combinação do anúncio.`,
            platform,
          ),
        );
      }
    });

    if (bundle.descriptions.length < rsa.descriptionMin) {
      issues.push(
        issue(
          "invalid",
          "description_count",
          "descriptions",
          `${label}: são necessárias pelo menos ${rsa.descriptionMin} descrições.`,
          platform,
        ),
      );
    } else if (bundle.descriptions.length > rsa.descriptionMaxCount) {
      issues.push(
        issue(
          "invalid",
          "description_count",
          "descriptions",
          `${label}: no máximo ${rsa.descriptionMaxCount} descrições.`,
          platform,
        ),
      );
    }
    const seenD = new Set<string>();
    bundle.descriptions.forEach((d, i) => {
      const len = adTextLength(d.text);
      if (!d.text.trim()) {
        issues.push(issue("invalid", "empty", `descriptions.${i}`, `${label}: descrição vazia.`, platform));
      } else if (len > rsa.descriptionMax) {
        issues.push(
          issue(
            "invalid",
            "length",
            `descriptions.${i}`,
            `${label}: descrição com ${len}/${rsa.descriptionMax} caracteres.`,
            platform,
          ),
        );
      }
      const key = d.text.trim().toLowerCase();
      if (key && seenD.has(key)) {
        issues.push(issue("invalid", "duplicate", `descriptions.${i}`, `${label}: descrição repetida.`, platform));
      }
      seenD.add(key);
      if (!claimIsUserSupplied(d.text, notes)) {
        issues.push(issue("invalid", "claim", `descriptions.${i}`, `${label}: alegação que não está nos dados indicados.`, platform));
      }
    });

    for (const [pathKey, value] of [
      ["path1", bundle.path1],
      ["path2", bundle.path2],
    ] as const) {
      if (!value) continue;
      if (/\s/.test(value)) {
        issues.push(issue("invalid", "path", pathKey, `${label}: o caminho não pode ter espaços.`, platform));
      }
      if (adTextLength(value) > rsa.pathMax) {
        issues.push(issue("invalid", "length", pathKey, `${label}: caminho com mais de ${rsa.pathMax} caracteres.`, platform));
      }
    }
    if (platform === "microsoft" && bundle.path2.trim() && !bundle.path1.trim()) {
      issues.push(
        issue(
          "invalid",
          "path_order",
          "path2",
          `${label}: o caminho 2 só pode existir quando o caminho 1 também está preenchido.`,
          platform,
        ),
      );
    }
    if (rsa.domainPlusPathsMax && adTextLength(`${bundle.path1}${bundle.path2}`) > rsa.domainPlusPathsMax) {
      issues.push(
        issue(
          "warning",
          "path_total",
          "paths",
          `${label}: domínio mais caminhos não devem ultrapassar ${rsa.domainPlusPathsMax} caracteres.`,
          platform,
        ),
      );
    }

    const urls = bundle.sitelinks.map((s) => s.url.trim()).filter(Boolean);
    bundle.sitelinks.forEach((s, i) => {
      const hasDesc = Boolean(s.description1.trim() || s.description2.trim());
      const textMax = hasDesc ? sl.textMax : sl.textMaxWithoutDescriptions;
      if (adTextLength(s.text) > textMax) {
        issues.push(
          issue("invalid", "length", `sitelinks.${i}.text`, `${label}: texto do sitelink com mais de ${textMax}.`, platform),
        );
      }
      if (!s.text.trim()) {
        issues.push(issue("invalid", "empty", `sitelinks.${i}.text`, `${label}: sitelink sem texto.`, platform));
      }
      if (!s.url.trim()) {
        issues.push(
          issue(
            "confirm",
            "missing_url",
            `sitelinks.${i}.url`,
            `${label}: destino em falta. Não foi criada nenhuma página. Indique um URL real.`,
            platform,
          ),
        );
      } else if (!isHttp(s.url)) {
        issues.push(issue("invalid", "url", `sitelinks.${i}.url`, `${label}: URL do sitelink inválido.`, platform));
      }
      if (sl.descriptionsArePair && Boolean(s.description1.trim()) !== Boolean(s.description2.trim())) {
        issues.push(
          issue(
            "invalid",
            "sitelink_pair",
            `sitelinks.${i}.description1`,
            `${label}: as duas linhas descritivas têm de ser preenchidas em conjunto.`,
            platform,
          ),
        );
      }
      for (const [field, text] of [
        ["description1", s.description1],
        ["description2", s.description2],
      ] as const) {
        if (text && adTextLength(text) > sl.descriptionMax) {
          issues.push(
            issue(
              "invalid",
              "length",
              `sitelinks.${i}.${field}`,
              `${label}: descrição do sitelink com mais de ${sl.descriptionMax}.`,
              platform,
            ),
          );
        }
      }
      if (!claimIsUserSupplied(s.text, notes)) {
        issues.push(issue("invalid", "claim", `sitelinks.${i}.text`, `${label}: alegação no sitelink sem dados confirmados.`, platform));
      }
    });
    const urlKeys = urls.map((u) => u.replace(/\/$/, "").toLowerCase());
    if (new Set(urlKeys).size < urlKeys.length) {
      issues.push(issue("warning", "duplicate_url", "sitelinks", `${label}: há sitelinks com o mesmo destino.`, platform));
    }
    const filled = bundle.sitelinks.filter((s) => s.url.trim() && s.text.trim());
    if (filled.length > 0 && filled.length < 2) {
      issues.push(
        issue(
          "warning",
          "sitelink_min",
          "sitelinks",
          `${label}: são precisos pelo menos 2 sitelinks com destino para poderem aparecer.`,
          platform,
        ),
      );
    }

    bundle.callouts.forEach((c, i) => {
      if (adTextLength(c.text) > CALLOUT_MAX) {
        issues.push(issue("invalid", "length", `callouts.${i}`, `${label}: destaque com mais de ${CALLOUT_MAX}.`, platform));
      }
      if (!claimIsUserSupplied(c.text, notes)) {
        issues.push(issue("invalid", "claim", `callouts.${i}`, `${label}: destaque com alegação não confirmada.`, platform));
      }
      if (bundle.headlines.some((h) => sameText(h.text, c.text)) || bundle.descriptions.some((d) => sameText(d.text, c.text))) {
        issues.push(issue("warning", "callout_overlap", `callouts.${i}`, `${label}: o destaque repete texto do anúncio.`, platform));
      }
    });
    if (bundle.callouts.length === 1) {
      issues.push(
        issue(
          "warning",
          "callout_min",
          "callouts",
          `${label}: com menos de ${CALLOUT_MIN_COUNT} destaques, o recurso não é apresentado.`,
          platform,
        ),
      );
    }

    if (bundle.snippet) {
      const headers = platform === "google" ? GOOGLE_SNIPPET_HEADERS : MICROSOFT_SNIPPET_HEADERS;
      if (!(headers as readonly string[]).includes(bundle.snippet.header)) {
        issues.push(
          issue("unsupported", "snippet_header", "snippet.header", `${label}: cabeçalho de snippet não suportado.`, platform),
        );
      }
      if (bundle.snippet.values.length < SNIPPET_MIN_VALUES) {
        issues.push(
          issue(
            "invalid",
            "snippet_count",
            "snippet.values",
            `${label}: um snippet precisa de pelo menos ${SNIPPET_MIN_VALUES} valores.`,
            platform,
          ),
        );
      }
      bundle.snippet.values.forEach((v, i) => {
        if (adTextLength(v) > SNIPPET_VALUE_MAX) {
          issues.push(
            issue("invalid", "length", `snippet.values.${i}`, `${label}: valor do snippet com mais de ${SNIPPET_VALUE_MAX}.`, platform),
          );
        }
      });
    }

    if (bundle.promotion) {
      if (!bundle.promotion.value.trim()) {
        issues.push(issue("invalid", "promotion", "promotion.value", `${label}: promoção sem valor.`, platform));
      }
      if (!bundle.promotion.url.trim() || !isHttp(bundle.promotion.url)) {
        issues.push(issue("confirm", "promotion_url", "promotion.url", `${label}: promoção sem URL de destino real.`, platform));
      }
      if (!bundle.promotion.terms.trim()) {
        issues.push(
          issue("confirm", "promotion_terms", "promotion.terms", `${label}: confirme as condições da promoção antes de a usar.`, platform),
        );
      }
    }
  }

  if (!bundle.snippet) {
    issues.push(
      issue(
        "confirm",
        "snippet_skipped",
        "snippet",
        "Snippet estruturado não foi gerado: não há uma lista real de tipos, marcas ou serviços.",
        "both",
      ),
    );
  }
  if (!bundle.promotion) {
    issues.push(
      issue("confirm", "promotion_skipped", "promotion", "Recurso de promoção omitido: não há desconto confirmado.", "both"),
    );
  }

  return issues;
}

/** Bloqueia a exportação final quando há regras rígidas falhadas. Avisos e confirmações não contam como prontos. */
export function finalExportBlockReason(issues: ValidationIssue[]): string | null {
  const invalid = issues.filter((item) => item.level === "invalid").length;
  if (!invalid) return null;
  return `Exportação final bloqueada: ${invalid} elemento(s) inválido(s). O rascunho pode ser gravado.`;
}

export function validationSummary(issues: ValidationIssue[]): Record<ValidationLevel, number> {
  const base: Record<ValidationLevel, number> = { valid: 0, warning: 0, invalid: 0, confirm: 0, unsupported: 0 };
  for (const item of issues) base[item.level] += 1;
  return base;
}
