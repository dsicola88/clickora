import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { USER_ID_MODELS, USER_ID_MODELS_INTENTIONAL_EXCLUSIONS } from "./tenantPrisma";

function prismaModelToClientKey(modelName: string): string {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

/** Modelos com campo `userId` no schema.prisma (fonte de verdade). */
function readSchemaUserIdModelKeys(): string[] {
  const schemaPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../prisma/schema.prisma",
  );
  const schema = fs.readFileSync(schemaPath, "utf8");
  const keys: string[] = [];
  for (const match of schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
    const name = match[1];
    const body = match[2];
    if (/^\s+userId\s+/m.test(body)) {
      keys.push(prismaModelToClientKey(name));
    }
  }
  return keys.sort();
}

describe("tenantPrisma USER_ID_MODELS", () => {
  it("inclui modelos críticos de isolamento (Etapa 5)", () => {
    const required = [
      "presellPage",
      "affiliateCampaign",
      "trafficRotator",
      "apiKey",
      "blacklistedIp",
      "whitelistedIp",
      "trackingEvent",
      "conversion",
      "tenantBranding",
      "paidAdsProject",
      "presellComplianceAudit",
      "presellComplianceJob",
    ] as const;
    for (const m of required) {
      assert.ok((USER_ID_MODELS as readonly string[]).includes(m), `falta ${m}`);
    }
  });

  it("não tem duplicados", () => {
    assert.equal(USER_ID_MODELS.length, new Set(USER_ID_MODELS).size);
    assert.equal(
      USER_ID_MODELS_INTENTIONAL_EXCLUSIONS.length,
      new Set(USER_ID_MODELS_INTENTIONAL_EXCLUSIONS).size,
    );
  });

  it("particiona exactamente os modelos schema com userId (tenant ∪ exclusões)", () => {
    const schemaKeys = readSchemaUserIdModelKeys();
    const tenant = [...USER_ID_MODELS].sort();
    const excluded = [...USER_ID_MODELS_INTENTIONAL_EXCLUSIONS].sort();

    const overlap = tenant.filter((k) => excluded.includes(k as (typeof USER_ID_MODELS_INTENTIONAL_EXCLUSIONS)[number]));
    assert.deepEqual(overlap, [], `overlap tenant/exclusões: ${overlap.join(", ")}`);

    const covered = [...tenant, ...excluded].sort();
    assert.deepEqual(
      covered,
      schemaKeys,
      [
        "Desync schema.prisma ↔ USER_ID_MODELS / EXCLUSIONS.",
        `Só no schema: ${schemaKeys.filter((k) => !covered.includes(k)).join(", ") || "(nenhum)"}`,
        `Só nas listas: ${covered.filter((k) => !schemaKeys.includes(k)).join(", ") || "(nenhum)"}`,
        "Novo modelo com userId → acrescentar a USER_ID_MODELS ou a USER_ID_MODELS_INTENTIONAL_EXCLUSIONS.",
      ].join("\n"),
    );
  });
});
