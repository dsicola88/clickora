import { z } from "zod";

const whenSchema = z
  .object({
    countries_allow: z.array(z.string().length(2)).max(200).optional(),
    countries_deny: z.array(z.string().length(2)).max(200).optional(),
    device: z.enum(["all", "mobile", "desktop"]).optional(),
    hour_start_utc: z.number().int().min(0).max(23).optional(),
    hour_end_utc: z.number().int().min(0).max(23).optional(),
    weekdays_utc: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    /** Limite global de cliques do rotador nesta janela (UTC, reinício diário). Só avaliado com `action: block` ou `redirect` em conjunto. */
    max_rotator_clicks_today_utc: z.number().int().min(1).max(1_000_000_000).optional(),
  })
  .strict();

const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("continue") }),
  z.object({ type: z.literal("block") }),
  z.object({ type: z.literal("redirect"), url: z.string().url().max(8000) }),
  z.object({ type: z.literal("use_backup") }),
]);

const ruleSchema = z
  .object({
    name: z.string().max(120).optional(),
    when: whenSchema,
    action: actionSchema,
  })
  .strict();

export const rotatorRulesPolicySchema = z
  .object({
    version: z.literal(1),
    rules: z.array(ruleSchema).max(50),
  })
  .strict();

export type RotatorRulesPolicy = z.infer<typeof rotatorRulesPolicySchema>;
export type RotatorRuleWhen = z.infer<typeof whenSchema>;
export type RotatorRuleAction = z.infer<typeof actionSchema>;
