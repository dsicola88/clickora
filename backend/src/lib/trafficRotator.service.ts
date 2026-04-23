import type { Prisma, RotatorDeviceRule, TrafficRotatorMode } from "@prisma/client";
import { systemPrisma } from "./prisma";
import { evaluateRotatorRulesPolicy, rotatorRulesPolicySchema } from "./routingRules";

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
    }
  | { ok: false; reason: "not_found" | "no_arms" | "no_destination" | "policy_block" };

function policyNeedsClickCount(policy: Prisma.JsonValue | null | undefined): boolean {
  if (policy == null || typeof policy !== "object") return false;
  const rules = (policy as { rules?: unknown }).rules;
  if (!Array.isArray(rules)) return false;
  return rules.some((r) => {
    const w = (r as { when?: { max_rotator_clicks_today_utc?: number } }).when;
    return w && typeof w.max_rotator_clicks_today_utc === "number";
  });
}

/**
 * Escolhe destino numa transacção: incrementa `clicksDelivered` ou avança `sequenceCursor`.
 */
export async function pickRotatorDestination(
  rotatorId: string,
  ctx: { country: string | null; device: string },
): Promise<RotatorDestinationResult> {
  return systemPrisma.$transaction(async (tx) => {
    const rot = await tx.trafficRotator.findFirst({
      where: { id: rotatorId, isActive: true },
      include: { arms: { orderBy: { orderIndex: "asc" } } },
    });

    if (!rot) return { ok: false, reason: "not_found" };

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

    if (pe.effect === "block") {
      return { ok: false, reason: "policy_block" };
    }
    if (pe.effect === "redirect") {
      return {
        ok: true,
        destinationUrl: pe.url,
        armId: null,
        armLabel: null,
        usedBackup: false,
        viaPolicyRedirect: true,
      };
    }
    if (pe.effect === "use_backup") {
      const bu = rot.backupUrl?.trim();
      if (bu) {
        return {
          ok: true,
          destinationUrl: bu,
          armId: null,
          armLabel: null,
          usedBackup: true,
        };
      }
    }

    if (rot.arms.length === 0) {
      if (rot.backupUrl?.trim()) {
        return {
          ok: true,
          destinationUrl: rot.backupUrl.trim(),
          armId: null,
          armLabel: null,
          usedBackup: true,
        };
      }
      return { ok: false, reason: "no_arms" };
    }

    const eligible = rot.arms.filter((arm) => {
      if (arm.maxClicks != null && arm.clicksDelivered >= arm.maxClicks) return false;
      return rotatorArmMatchesContext({
        country: ctx.country,
        device: ctx.device,
        countriesAllow: arm.countriesAllow,
        countriesDeny: arm.countriesDeny,
        deviceRule: arm.deviceRule,
      });
    });

    if (eligible.length === 0) {
      const bu = rot.backupUrl?.trim();
      if (bu) {
        return {
          ok: true,
          destinationUrl: bu,
          armId: null,
          armLabel: null,
          usedBackup: true,
        };
      }
      return { ok: false, reason: "no_destination" };
    }

    const mode: TrafficRotatorMode = rot.mode;
    let chosen = eligible[0]!;

    if (mode === "fill_order") {
      chosen = eligible[0]!;
    } else if (mode === "sequential") {
      const idx = eligible.length > 0 ? rot.sequenceCursor % eligible.length : 0;
      chosen = eligible[idx]!;
      await tx.trafficRotator.update({
        where: { id: rot.id },
        data: { sequenceCursor: rot.sequenceCursor + 1 },
      });
    } else if (mode === "weighted") {
      const weightPositive = eligible.filter((a) => (a.weight ?? 0) > 0);
      if (weightPositive.length === 0) {
        const bu = rot.backupUrl?.trim();
        if (bu) {
          return {
            ok: true,
            destinationUrl: bu,
            armId: null,
            armLabel: null,
            usedBackup: true,
          };
        }
        return { ok: false, reason: "no_destination" };
      }
      const weights = weightPositive.map((a) => a.weight);
      const sum = weights.reduce((s, w) => s + w, 0);
      let r = Math.random() * sum;
      chosen = weightPositive[weightPositive.length - 1]!;
      for (let i = 0; i < weightPositive.length; i++) {
        r -= weights[i]!;
        if (r <= 0) {
          chosen = weightPositive[i]!;
          break;
        }
      }
    } else {
      chosen = eligible[Math.floor(Math.random() * eligible.length)]!;
    }

    await tx.trafficRotatorArm.update({
      where: { id: chosen.id },
      data: { clicksDelivered: { increment: 1 } },
    });

    return {
      ok: true,
      destinationUrl: chosen.destinationUrl.trim(),
      armId: chosen.id,
      armLabel: chosen.label,
      usedBackup: false,
      viaPolicyRedirect: false,
    };
  });
}
