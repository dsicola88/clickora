/**
 * Liga cliques de lander (CTA /track/r/) ao hop do rotador A/B.
 * O rotador grava clickora_click_id na URL da lander; a lander reenvia como parent_click_id.
 */
export type RotatorParentMeta = {
  parent_rotator_click_id: string;
  rotator_id: string;
  rotator_arm_id: string | null;
};

export function rotatorMetaFromParentClick(args: {
  parentId: string;
  parentUserId: string;
  ownerUserId: string;
  parentMetadata: unknown;
}): RotatorParentMeta | null {
  if (args.parentUserId !== args.ownerUserId) return null;
  if (!args.parentMetadata || typeof args.parentMetadata !== "object" || Array.isArray(args.parentMetadata)) {
    return null;
  }
  const m = args.parentMetadata as Record<string, unknown>;
  const rotatorId = typeof m.rotator_id === "string" ? m.rotator_id.trim() : "";
  if (!rotatorId) return null;
  const arm =
    typeof m.rotator_arm_id === "string" && m.rotator_arm_id.trim()
      ? m.rotator_arm_id.trim()
      : null;
  return {
    parent_rotator_click_id: args.parentId,
    rotator_id: rotatorId,
    rotator_arm_id: arm,
  };
}
