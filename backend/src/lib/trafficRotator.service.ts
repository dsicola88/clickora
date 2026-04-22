import type { Prisma, RotatorDeviceRule, TrafficRotatorMode } from "@prisma/client";
import { systemPrisma } from "./prisma";

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
      armId: string;
      armLabel: string | null;
      usedBackup: false;
    }
  | { ok: true; destinationUrl: string; armId: null; armLabel: null; usedBackup: true }
  | { ok: false; reason: "not_found" | "no_arms" | "no_destination" };

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
    };
  });
}
