import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

export type RotatorRuleDraft = {
  name: string;
  countries_allow: string;
  countries_deny: string;
  device: "all" | "mobile" | "desktop";
  max_rotator_clicks_today_utc: string;
  action: "continue" | "block" | "redirect" | "use_backup";
  redirect_url: string;
};

export type RotatorRulesPolicyV1 = {
  version: 1;
  rules: Array<{
    name?: string;
    when: {
      countries_allow?: string[];
      countries_deny?: string[];
      device?: "all" | "mobile" | "desktop";
      max_rotator_clicks_today_utc?: number;
    };
    action:
      | { type: "continue" }
      | { type: "block" }
      | { type: "redirect"; url: string }
      | { type: "use_backup" };
  }>;
};

function parseIsoList(raw: string): string[] | undefined {
  const list = raw
    .split(/[\s,;]+/)
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z]{2}$/.test(s));
  return list.length ? list : undefined;
}

export function emptyRuleDraft(): RotatorRuleDraft {
  return {
    name: "",
    countries_allow: "",
    countries_deny: "",
    device: "all",
    max_rotator_clicks_today_utc: "",
    action: "continue",
    redirect_url: "",
  };
}

/** Converte JSON / object policy → drafts editáveis (falha silenciosa → []). */
export function policyToDrafts(policy: unknown): RotatorRuleDraft[] {
  if (!policy || typeof policy !== "object") return [];
  const p = policy as { version?: number; rules?: unknown[] };
  if (p.version !== 1 || !Array.isArray(p.rules)) return [];
  return p.rules.map((raw) => {
    const r = (raw || {}) as {
      name?: string;
      when?: {
        countries_allow?: string[];
        countries_deny?: string[];
        device?: string;
        max_rotator_clicks_today_utc?: number;
      };
      action?: { type?: string; url?: string };
    };
    const actionType = (r.action?.type || "continue") as RotatorRuleDraft["action"];
    return {
      name: r.name || "",
      countries_allow: (r.when?.countries_allow || []).join(", "),
      countries_deny: (r.when?.countries_deny || []).join(", "),
      device: (r.when?.device as RotatorRuleDraft["device"]) || "all",
      max_rotator_clicks_today_utc:
        r.when?.max_rotator_clicks_today_utc != null ? String(r.when.max_rotator_clicks_today_utc) : "",
      action: ["continue", "block", "redirect", "use_backup"].includes(actionType) ? actionType : "continue",
      redirect_url: r.action?.url || "",
    };
  });
}

export function draftsToPolicy(drafts: RotatorRuleDraft[]): RotatorRulesPolicyV1 | null {
  if (!drafts.length) return null;
  const rules: RotatorRulesPolicyV1["rules"] = [];
  for (const d of drafts) {
    const when: RotatorRulesPolicyV1["rules"][0]["when"] = {};
    const allow = parseIsoList(d.countries_allow);
    const deny = parseIsoList(d.countries_deny);
    if (allow) when.countries_allow = allow;
    if (deny) when.countries_deny = deny;
    if (d.device && d.device !== "all") when.device = d.device;
    const cap = d.max_rotator_clicks_today_utc.trim();
    if (cap) {
      const n = parseInt(cap, 10);
      if (Number.isFinite(n) && n >= 1) when.max_rotator_clicks_today_utc = n;
    }
    let action: RotatorRulesPolicyV1["rules"][0]["action"];
    if (d.action === "block") action = { type: "block" };
    else if (d.action === "use_backup") action = { type: "use_backup" };
    else if (d.action === "redirect") {
      const url = d.redirect_url.trim();
      if (!/^https?:\/\//i.test(url)) continue;
      action = { type: "redirect", url };
    } else action = { type: "continue" };

    rules.push({
      ...(d.name.trim() ? { name: d.name.trim().slice(0, 120) } : {}),
      when,
      action,
    });
  }
  if (!rules.length) return null;
  return { version: 1, rules };
}

type Props = {
  drafts: RotatorRuleDraft[];
  onChange: (next: RotatorRuleDraft[]) => void;
  disabled?: boolean;
};

/**
 * UI visual de regras do rotador (geo / device / cap / acção) — sem JSON cru.
 */
export function RotatorRulesBuilder({ drafts, onChange, disabled }: Props) {
  const update = (i: number, patch: Partial<RotatorRuleDraft>) => {
    onChange(drafts.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Regras avaliadas antes dos braços: país, dispositivo, limite diário UTC. Acção: continuar, bloquear,
        redireccionar ou usar backup.
      </p>
      {drafts.map((d, i) => (
        <div key={i} className="rounded-lg border border-border/60 bg-background/80 p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <Input
              value={d.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder={`Regra ${i + 1}`}
              className="h-8 text-xs"
              disabled={disabled}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              disabled={disabled}
              onClick={() => onChange(drafts.filter((_, idx) => idx !== i))}
              aria-label="Remover regra"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Países OK</Label>
              <Input
                value={d.countries_allow}
                onChange={(e) => update(i, { countries_allow: e.target.value })}
                placeholder="US, CA, AU"
                className="h-8 font-mono text-xs"
                disabled={disabled}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Países deny</Label>
              <Input
                value={d.countries_deny}
                onChange={(e) => update(i, { countries_deny: e.target.value })}
                placeholder="CN, RU"
                className="h-8 font-mono text-xs"
                disabled={disabled}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Dispositivo</Label>
              <Select
                value={d.device}
                onValueChange={(v) => update(i, { device: v as RotatorRuleDraft["device"] })}
                disabled={disabled}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="mobile">Mobile</SelectItem>
                  <SelectItem value="desktop">Desktop</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Cap cliques/dia UTC</Label>
              <Input
                value={d.max_rotator_clicks_today_utc}
                onChange={(e) => update(i, { max_rotator_clicks_today_utc: e.target.value })}
                placeholder="ex. 5000"
                className="h-8 font-mono text-xs"
                disabled={disabled}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Acção</Label>
              <Select
                value={d.action}
                onValueChange={(v) => update(i, { action: v as RotatorRuleDraft["action"] })}
                disabled={disabled}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="continue">Continuar</SelectItem>
                  <SelectItem value="block">Bloquear</SelectItem>
                  <SelectItem value="redirect">Redirect URL</SelectItem>
                  <SelectItem value="use_backup">Usar backup</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {d.action === "redirect" ? (
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">URL redirect</Label>
                <Input
                  value={d.redirect_url}
                  onChange={(e) => update(i, { redirect_url: e.target.value })}
                  placeholder="https://…"
                  className="h-8 font-mono text-xs"
                  disabled={disabled}
                />
              </div>
            ) : null}
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled={disabled || drafts.length >= 50}
        onClick={() => onChange([...drafts, emptyRuleDraft()])}
      >
        <Plus className="h-3.5 w-3.5" />
        Adicionar regra
      </Button>
    </div>
  );
}
