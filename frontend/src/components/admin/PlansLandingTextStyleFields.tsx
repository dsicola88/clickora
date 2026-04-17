import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LandingTextStyleBlock } from "@/lib/plansLandingTextStyles";

const OPT_FONT = [
  { value: "sans", label: "Sans (UI)" },
  { value: "serif", label: "Serif" },
  { value: "mono", label: "Mono" },
  { value: "display", label: "Display (DM Serif)" },
];

const OPT_SIZE = [
  { value: "xs", label: "XS" },
  { value: "sm", label: "SM" },
  { value: "base", label: "Base" },
  { value: "lg", label: "LG" },
  { value: "xl", label: "XL" },
  { value: "2xl", label: "2XL" },
  { value: "3xl", label: "3XL" },
  { value: "4xl", label: "4XL" },
  { value: "5xl", label: "5XL" },
];

const OPT_WEIGHT = [
  { value: "normal", label: "Normal" },
  { value: "medium", label: "Médio" },
  { value: "semibold", label: "Semibold" },
  { value: "bold", label: "Bold" },
  { value: "extrabold", label: "Extrabold" },
];

const OPT_ALIGN = [
  { value: "left", label: "Esquerda" },
  { value: "center", label: "Centro" },
  { value: "right", label: "Direita" },
];

type Props = {
  label: string;
  value: LandingTextStyleBlock | undefined;
  onChange: (next: LandingTextStyleBlock | undefined) => void;
};

function compactStyle(s: LandingTextStyleBlock | undefined): LandingTextStyleBlock | undefined {
  if (!s) return undefined;
  const o: LandingTextStyleBlock = {};
  if (s.font_family) o.font_family = s.font_family;
  if (s.font_size) o.font_size = s.font_size;
  if (s.font_weight) o.font_weight = s.font_weight;
  if (s.text_align) o.text_align = s.text_align;
  if (s.color?.trim()) o.color = s.color.trim();
  return Object.keys(o).length ? o : undefined;
}

function stripUndefinedPatch(
  current: LandingTextStyleBlock,
  patch: Partial<LandingTextStyleBlock>,
): LandingTextStyleBlock {
  const merged = { ...current, ...patch };
  (Object.keys(patch) as (keyof LandingTextStyleBlock)[]).forEach((k) => {
    if (patch[k] === undefined) delete merged[k];
  });
  return merged;
}

/**
 * Cor, família, tamanho, peso e alinhamento por zona (landing de planos).
 */
export function PlansLandingTextStyleFields({ label, value, onChange }: Props) {
  const v = value ?? {};
  const apply = (patch: Partial<LandingTextStyleBlock>) => {
    const merged = stripUndefinedPatch(v, patch);
    onChange(compactStyle(merged));
  };

  return (
    <div className="rounded-md border border-dashed border-border/60 bg-muted/10 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        <Button type="button" variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => onChange(undefined)}>
          Repor
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-[10px]">Fonte</Label>
          <Select
            value={v.font_family ?? "__default"}
            onValueChange={(x) => apply({ font_family: x === "__default" ? undefined : (x as LandingTextStyleBlock["font_family"]) })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="(padrão)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__default">(padrão)</SelectItem>
              {OPT_FONT.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Tamanho</Label>
          <Select
            value={v.font_size ?? "__default"}
            onValueChange={(x) => apply({ font_size: x === "__default" ? undefined : (x as LandingTextStyleBlock["font_size"]) })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="(padrão)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__default">(padrão)</SelectItem>
              {OPT_SIZE.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Peso</Label>
          <Select
            value={v.font_weight ?? "__default"}
            onValueChange={(x) => apply({ font_weight: x === "__default" ? undefined : (x as LandingTextStyleBlock["font_weight"]) })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="(padrão)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__default">(padrão)</SelectItem>
              {OPT_WEIGHT.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Alinhamento</Label>
          <Select
            value={v.text_align ?? "__default"}
            onValueChange={(x) => apply({ text_align: x === "__default" ? undefined : (x as LandingTextStyleBlock["text_align"]) })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="(padrão)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__default">(padrão)</SelectItem>
              {OPT_ALIGN.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-[10px]">Cor (CSS)</Label>
          <Input
            className="h-8 font-mono text-xs"
            placeholder="#fff ou rgba(…)"
            value={v.color ?? ""}
            onChange={(e) => apply({ color: e.target.value.trim() || undefined })}
            maxLength={80}
          />
        </div>
      </div>
    </div>
  );
}
