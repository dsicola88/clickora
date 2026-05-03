import { z } from "zod";

export type GoogleManualPlanFormAdGroupRow = {
  id: string;
  name: string;
  keywordsText: string;
  headlinesText: string;
  descriptionsText: string;
};

export type GoogleManualPlanFormState = {
  campaignName: string;
  objectiveSummary: string;
  adGroups: GoogleManualPlanFormAdGroupRow[];
};

/** Identificador estável só para reconciliar linhas ao renderizar React. */

export function newAdGroupRow(name = "Novo grupo"): GoogleManualPlanFormAdGroupRow {
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `ag-${Math.random().toString(36).slice(2, 11)}`;
  return {
    id,
    name,
    keywordsText: "",
    headlinesText: "",
    descriptionsText: "",
  };
}

export function createEmptyGoogleManualPlanForm(): GoogleManualPlanFormState {
  return {
    campaignName: "",
    objectiveSummary: "",
    adGroups: [newAdGroupRow("Grupo principal"), newAdGroupRow("Grupo secundário")],
  };
}

/** Preenche campos em branco a partir do assistente antes do primeiro envio em modo manual. */
export function hydrateManualGoogleFormFromBrief(
  prev: GoogleManualPlanFormState,
  brief: { offer: string; objective: string; seed: string | null },
): GoogleManualPlanFormState {
  const offer = brief.offer.trim();
  const obj = brief.objective.trim();
  const seed = brief.seed?.trim() ?? "";
  const seedBlock =
    seed && !/^exact\s|^phrase\s|^broad\s/mi.test(seed)
      ? [`exact ${seed}`, `phrase ${seed}`, `broad ${seed}`].join("\n")
      : "";

  return {
    ...prev,
    campaignName: prev.campaignName.trim() || offer.slice(0, 250),
    objectiveSummary: prev.objectiveSummary.trim() || obj.slice(0, 500),
    adGroups: prev.adGroups.map((ag, i) => {
      if (i !== 0 || ag.keywordsText.trim()) return ag;
      return seedBlock ? { ...ag, keywordsText: seedBlock } : ag;
    }),
  };
}

const KEYWORD_LINE = /^(exact|phrase|broad)\s+(.+)$/i;

/** Uma keyword por linha; prefixo opcional `exact`, `phrase` ou `broad` (tal como na Google Ads). */
export function parseGoogleManualKeywordLines(raw: string): { text: string; match_type: "exact" | "phrase" | "broad" }[] {
  const out: { text: string; match_type: "exact" | "phrase" | "broad" }[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const m = t.match(KEYWORD_LINE);
    if (m) {
      const kind = m[1]!.toLowerCase() as "exact" | "phrase" | "broad";
      const text = m[2]!.trim().slice(0, 80);
      if (text) out.push({ text, match_type: kind });
    } else {
      out.push({ text: t.slice(0, 80), match_type: "broad" });
    }
  }
  return out.slice(0, 50);
}

export function rsaLines(raw: string, max: number): string[] {
  return raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).slice(0, max);
}

const manualApiSchema = z.object({
  campaign: z.object({
    name: z.string().trim().min(1).max(250),
    objective_summary: z.string().trim().min(1).max(500),
  }),
  ad_groups: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(255),
        keywords: z
          .array(
            z.object({
              text: z.string().trim().min(1).max(80),
              match_type: z.enum(["exact", "phrase", "broad"]),
            }),
          )
          .min(1)
          .max(50),
        rsa: z.object({
          headlines: z.array(z.string()).min(3).max(15),
          descriptions: z.array(z.string()).min(2).max(4),
        }),
      }),
    )
    .min(1)
    .max(5),
});

export type GoogleManualSearchPlanPayload = z.infer<typeof manualApiSchema>;

export function formStateToGoogleManualPlanPayload(form: GoogleManualPlanFormState):
  | { ok: true; plan: GoogleManualSearchPlanPayload }
  | { ok: false; error: string } {
  const ad_groups = form.adGroups.map((ag) => ({
    name: ag.name.trim(),
    keywords: parseGoogleManualKeywordLines(ag.keywordsText),
    rsa: {
      headlines: rsaLines(ag.headlinesText, 15),
      descriptions: rsaLines(ag.descriptionsText, 4),
    },
  }));

  const candidate = {
    campaign: {
      name: form.campaignName.trim(),
      objective_summary: form.objectiveSummary.trim(),
    },
    ad_groups,
  };

  const parsed = manualApiSchema.safeParse(candidate);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Plano manual inválido.";
    const path = parsed.error.issues[0]?.path.join(".") ?? "";
    return {
      ok: false,
      error: path ? `${msg} (${path})` : msg,
    };
  }

  const emptyRg = parsed.data.ad_groups.some((ag) => ag.keywords.length === 0);
  if (emptyRg) {
    return { ok: false, error: "Cada grupo deve ter pelo menos uma palavra-chave (uma por linha)." };
  }

  return { ok: true, plan: parsed.data };
}
