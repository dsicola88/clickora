import type { Prisma, RotatorDeviceRule, TrafficRotatorMode } from "@prisma/client";
import { systemPrisma } from "./prisma";
import { evaluateRotatorRulesPolicy, rotatorRulesPolicySchema } from "./routingRules";
import {
  isRotatorDestinationProbeable,
  probeRotatorDestinationQuick,
  rotatorDestinationProbeEnabled,
} from "./rotatorDestinationHealth";
import { pickWeightedIndex } from "./rotatorWeights";

function parseCountriesJson(j: Prisma.JsonValue | null | undefined): string[] | null {
  if (j == null) return null;
  if (!Array.isArray(j)) return null;
  const out = j
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  return out.length ? out : null;
}

/** Filtro país + dispositivo por braço do rotador. */
export function rotatorArmMatchesContext(args: {
  country: string | null;
  device: string;
  countriesAllow: Prisma.JsonValue | null | undefined;
  countriesDeny: Prisma.JsonValue | null | undefined;
  deviceRule: RotatorDeviceRule;
}): boolean {
  const allow = parseCountriesJson(args.countriesAllow);
  const deny = parseCountriesJson(args.countriesDeny);
  const cc = args.country?.trim().toUpperCase() || null;

  if (allow && allow.length > 0) {
    if (!cc || !allow.includes(cc)) return false;
  }
  if (deny && deny.length > 0 && cc && deny.includes(cc)) return false;

  const { deviceRule } = args;
  const d = args.device;
  if (deviceRule === "all") return true;
  const isMobileLike = d === "mobile" || d === "tablet";
  if (deviceRule === "mobile") return isMobileLike;
  if (deviceRule === "desktop") return d === "desktop";
  return true;
}

export type RotatorDestinationResult =
  | {
      ok: true;
      destinationUrl: string;
      armId: string | null;
      armLabel: string | null;
      usedBackup: boolean;
      /** Redirecionamento definido na política (não braço nem backup configurado como tal). */
      viaPolicyRedirect?: boolean;
      /** Contingência: destino principal falhou probe e usou-se outro braço ou backup. */
      healthFailover?: boolean;
      healthFailReason?: string;
    }
  | { ok: false; reason: "not_found" | "no_arms" | "no_destination" | "policy_block" };

type ArmRow = {
  id: string;
  destinationUrl: string;
  label: string | null;
  orderIndex: number;
  weight: number;
  maxClicks: number | null;
  clicksDelivered: number;
  countriesAllow: Prisma.JsonValue | null;
  countriesDeny: Prisma.JsonValue | null;
  deviceRule: RotatorDeviceRule;
};

type RotRow = {
  id: string;
  userId: string;
  mode: TrafficRotatorMode;
  sequenceCursor: number;
  backupUrl: string | null;
  /** Sticky só em weighted/random; sequential/fill_order ignoram. */
  stickySession: boolean;
  rulesPolicy: Prisma.JsonValue | null;
  arms: ArmRow[];
};

/** Cookie 1.º partido: visitante permanece no mesmo braço (sticky session). */
export function stickyRotatorCookieName(rotatorId: string): string {
  const compact = rotatorId.replace(/-/g, "").slice(0, 16);
  return `clk_rs_${compact}`;
}

function policyNeedsClickCount(policy: Prisma.JsonValue | null | undefined): boolean {
  if (policy == null || typeof policy !== "object") return false;
  const rules = (policy as { rules?: unknown }).rules;
  if (!Array.isArray(rules)) return false;
  return rules.some((r) => {
    const w = (r as { when?: { max_rotator_clicks_today_utc?: number } }).when;
    return w && typeof w.max_rotator_clicks_today_utc === "number";
  });
}

function backupResult(rot: RotRow, extra?: { healthFailover?: boolean; healthFailReason?: string }): RotatorDestinationResult {
  const bu = rot.backupUrl?.trim();
  if (!bu) return { ok: false, reason: "no_destination" };
  return {
    ok: true,
    destinationUrl: bu,
    armId: null,
    armLabel: null,
    usedBackup: true,
    healthFailover: extra?.healthFailover,
    healthFailReason: extra?.healthFailReason,
  };
}

function chooseEligibleArm(
  rot: RotRow,
  eligible: ArmRow[],
  randomUnit: number,
): { arm: ArmRow; advanceSequential: boolean } | { empty: true } {
  if (eligible.length === 0) return { empty: true };
  const mode: TrafficRotatorMode = rot.mode;
  if (mode === "fill_order") {
    return { arm: eligible[0]!, advanceSequential: false };
  }
  if (mode === "sequential") {
    const idx = rot.sequenceCursor % eligible.length;
    return { arm: eligible[idx]!, advanceSequential: true };
  }
  if (mode === "weighted") {
    const weightPositive = eligible.filter((a) => (a.weight ?? 0) > 0);
    if (weightPositive.length === 0) return { empty: true };
    const weights = weightPositive.map((a) => a.weight);
    return {
      arm: weightPositive[pickWeightedIndex(weights, randomUnit)]!,
      advanceSequential: false,
    };
  }
  return {
    arm: eligible[Math.floor(randomUnit * eligible.length)]!,
    advanceSequential: false,
  };
}

/**
 * Escolhe destino com contingência enterprise:
 * - A/B ponderado / sequential (WhatsApp) / fill_order / random
 * - backup quando sem braços elegíveis ou política `use_backup`
 * - se `backup_url` estiver definido e probe activo: valida destino HTTP e falha → outro braço → backup
 */
export async function pickRotatorDestination(
  rotatorId: string,
  ctx: { country: string | null; device: string },
  deps?: {
    db?: typeof systemPrisma;
    randomUnit?: number;
    probe?: typeof probeRotatorDestinationQuick;
    probeEnabled?: boolean;
    /** Arm id do cookie sticky (só aplicado se `stickySession` e modo weighted/random). */
    stickyArmId?: string | null;
  },
): Promise<RotatorDestinationResult> {
  const db = deps?.db ?? systemPrisma;
  const randomUnit = deps?.randomUnit ?? Math.random();
  const probe = deps?.probe ?? probeRotatorDestinationQuick;
  const probeEnabled = deps?.probeEnabled ?? rotatorDestinationProbeEnabled();
  const stickyArmId = typeof deps?.stickyArmId === "string" ? deps.stickyArmId.trim() : "";

  const loaded = await db.$transaction(async (tx) => {
    const rot = await tx.trafficRotator.findFirst({
      where: { id: rotatorId, isActive: true },
      include: { arms: { orderBy: { orderIndex: "asc" } } },
    });
    if (!rot) return { kind: "missing" as const };

    const now = new Date();
    let rotatorClicksTodayUtc: number | undefined;
    if (policyNeedsClickCount(rot.rulesPolicy)) {
      const start = new Date(now);
      start.setUTCHours(0, 0, 0, 0);
      rotatorClicksTodayUtc = await tx.trackingEvent.count({
        where: {
          userId: rot.userId,
          eventType: "click",
          createdAt: { gte: start },
          metadata: { path: ["rotator_id"], equals: rotatorId },
        },
      });
    }

    const parsedPolicy = rotatorRulesPolicySchema.safeParse(rot.rulesPolicy ?? undefined);
    const policy = parsedPolicy.success ? parsedPolicy.data : null;
    const pe = evaluateRotatorRulesPolicy(policy, {
      country: ctx.country,
      device: ctx.device,
      now,
      rotatorClicksTodayUtc,
    });

    if (pe.effect === "block") return { kind: "policy_block" as const };
    if (pe.effect === "redirect") {
      return {
        kind: "policy_redirect" as const,
        url: pe.url,
      };
    }
    if (pe.effect === "use_backup") {
      return { kind: "force_backup" as const, rot: rot as unknown as RotRow };
    }

    return { kind: "pick" as const, rot: rot as unknown as RotRow };
  });

  if (loaded.kind === "missing") return { ok: false, reason: "not_found" };
  if (loaded.kind === "policy_block") return { ok: false, reason: "policy_block" };
  if (loaded.kind === "policy_redirect") {
    return {
      ok: true,
      destinationUrl: loaded.url,
      armId: null,
      armLabel: null,
      usedBackup: false,
      viaPolicyRedirect: true,
    };
  }
  if (loaded.kind === "force_backup") {
    const bu = loaded.rot.backupUrl?.trim();
    if (bu) {
      return { ok: true, destinationUrl: bu, armId: null, armLabel: null, usedBackup: true };
    }
  }

  const rot = loaded.kind === "force_backup" || loaded.kind === "pick" ? loaded.rot : null;
  if (!rot) return { ok: false, reason: "not_found" };

  if (rot.arms.length === 0) {
    return backupResult(rot);
  }

  const baseEligible = rot.arms.filter((arm) => {
    if (arm.maxClicks != null && arm.clicksDelivered >= arm.maxClicks) return false;
    return rotatorArmMatchesContext({
      country: ctx.country,
      device: ctx.device,
      countriesAllow: arm.countriesAllow,
      countriesDeny: arm.countriesDeny,
      deviceRule: arm.deviceRule,
    });
  });

  if (baseEligible.length === 0) {
    return backupResult(rot);
  }

  const failedIds = new Set<string>();
  let lastFailReason: string | undefined;
  const maxTries = Math.min(baseEligible.length, 4);
  let advanceSequential = false;
  let chosen: ArmRow | null = null;

  const stickyModes = rot.mode === "weighted" || rot.mode === "random";
  if (rot.stickySession && stickyModes && stickyArmId) {
    const stickyArm = baseEligible.find((a) => a.id === stickyArmId);
    if (stickyArm) {
      const hasBackup = Boolean(rot.backupUrl?.trim());
      const shouldProbe =
        probeEnabled && hasBackup && isRotatorDestinationProbeable(stickyArm.destinationUrl);
      if (!shouldProbe) {
        chosen = stickyArm;
      } else {
        const health = await probe(stickyArm.destinationUrl.trim());
        if (health.healthy) {
          chosen = stickyArm;
        } else {
          failedIds.add(stickyArm.id);
          lastFailReason = health.reason || "unhealthy";
        }
      }
    }
  }

  for (let attempt = 0; !chosen && attempt < maxTries; attempt++) {
    const eligible = baseEligible.filter((a) => !failedIds.has(a.id));
    if (eligible.length === 0) break;
    const pick = chooseEligibleArm(rot, eligible, randomUnit);
    if ("empty" in pick) break;
    chosen = pick.arm;
    advanceSequential = pick.advanceSequential;

    const hasBackup = Boolean(rot.backupUrl?.trim());
    const shouldProbe =
      probeEnabled && hasBackup && isRotatorDestinationProbeable(chosen.destinationUrl);

    if (!shouldProbe) break;

    const health = await probe(chosen.destinationUrl.trim());
    if (health.healthy) break;

    failedIds.add(chosen.id);
    lastFailReason = health.reason || "unhealthy";
    chosen = null;
    advanceSequential = false;
  }

  if (!chosen) {
    return backupResult(rot, {
      healthFailover: failedIds.size > 0,
      healthFailReason: lastFailReason,
    });
  }

  await db.$transaction(async (tx) => {
    if (advanceSequential) {
      await tx.trafficRotator.update({
        where: { id: rot.id },
        data: { sequenceCursor: rot.sequenceCursor + 1 },
      });
    }
    await tx.trafficRotatorArm.update({
      where: { id: chosen!.id },
      data: { clicksDelivered: { increment: 1 } },
    });
  });

  return {
    ok: true,
    destinationUrl: chosen.destinationUrl.trim(),
    armId: chosen.id,
    armLabel: chosen.label,
    usedBackup: false,
    viaPolicyRedirect: false,
    healthFailover: failedIds.size > 0,
    healthFailReason: failedIds.size > 0 ? lastFailReason : undefined,
  };
}
