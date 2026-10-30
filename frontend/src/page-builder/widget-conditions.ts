import type { DeviceType, WidgetConditions, WidgetNode } from "./types";

export function isHiddenByDevice(
  conditions: WidgetConditions | undefined,
  device: DeviceType,
): boolean {
  if (!conditions) return false;
  if (device === "desktop" && conditions.hideDesktop) return true;
  if (device === "tablet" && conditions.hideTablet) return true;
  if (device === "mobile" && conditions.hideMobile) return true;
  return false;
}

/** Decide se o widget deve renderizar agora (após load/scroll). */
export function useConditionGate(
  conditions: WidgetConditions | undefined,
  enabled: boolean,
): boolean {
  // Implemented as plain helpers + hook in WidgetConditionGate component file.
  void conditions;
  void enabled;
  return true;
}

export function conditionsNeedRuntime(conditions: WidgetConditions | undefined): boolean {
  if (!conditions) return false;
  return Boolean(
    (conditions.showAfterMs && conditions.showAfterMs > 0) ||
      (typeof conditions.showAtScrollPercent === "number" &&
        conditions.showAtScrollPercent > 0),
  );
}

export function widgetHasConditions(widget: WidgetNode): boolean {
  const c = widget.conditions;
  if (!c) return false;
  return Boolean(
    c.hideDesktop ||
      c.hideTablet ||
      c.hideMobile ||
      (c.showAfterMs && c.showAfterMs > 0) ||
      (typeof c.showAtScrollPercent === "number" && c.showAtScrollPercent > 0),
  );
}
