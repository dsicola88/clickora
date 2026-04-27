import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, Copy, FileJson2, GripVertical, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { LandingRenderer } from "@/components/landing/LandingRenderer";
import {
  createEmptySection,
  createWidget,
  getDefaultFormSettings,
  getDefaultFreeTrialSettings,
  newId,
  type LandingDocument,
  type LandingSectionUi,
  type LandingWidgetUi,
  type SectionNode,
  type WidgetNode,
  type WidgetType,
} from "@/lib/landing-document";
import { LANDING_CURRENCY_CHOICES, normalizeCurrencyCode } from "@/lib/landing-currency";
import { importLandingFromJson } from "@/lib/landing-import";
import {
  filterLandingWidgetsByQuery,
  landingWidgetLabel,
  LANDING_WIDGET_CATEGORIES,
} from "@/landing/landing-widget-registry";
import { cn } from "@/lib/utils";

function setAt<T>(arr: T[], i: number, v: T): T[] {
  const c = [...arr];
  c[i] = v;
  return c;
}

function isoToDatetimeLocalValue(iso: string): string {
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function moveWidgetInSection(
  sec: SectionNode,
  wIndex: number,
  dir: -1 | 1,
): SectionNode {
  const j = wIndex + dir;
  if (j < 0 || j >= sec.children.length) return sec;
  return { ...sec, children: arrayMove(sec.children, wIndex, j) };
}

function updateWidgetInSection(sec: SectionNode, wIndex: number, w: WidgetNode): SectionNode {
  return { ...sec, children: setAt(sec.children, wIndex, w) };
}

function deleteWidgetFromSection(sec: SectionNode, wIndex: number): SectionNode {
  return { ...sec, children: sec.children.filter((_, i) => i !== wIndex) };
}

function SectionSortItem({
  section,
  index,
  children,
  onSelect,
  selected,
}: {
  section: SectionNode;
  index: number;
  children: React.ReactNode;
  onSelect: (id: string) => void;
  selected: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.75 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border border-border bg-card">
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-2 border-b border-border bg-muted/30 px-2 py-2 text-left text-xs",
          selected && "ring-1 ring-primary",
        )}
        onClick={() => onSelect(section.id)}
      >
        <span
          className="inline-flex h-6 w-6 cursor-grab items-center justify-center text-muted-foreground"
          aria-hidden
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </span>
        <span className="font-medium">Secção {index + 1}</span>
        <span className="text-muted-foreground">· {section.children.length} widget(s)</span>
      </button>
      <div className="p-2">{children}</div>
    </div>
  );
}

function LandingInspector({
  selectedId,
  doc,
  onChangeDoc,
}: {
  selectedId: string | null;
  doc: LandingDocument;
  onChangeDoc: (d: LandingDocument) => void;
}) {
  if (!selectedId) {
    return <p className="text-sm text-muted-foreground">Clique numa secção ou widget no canvas.</p>;
  }
  const secI = doc.sections.findIndex((s) => s.id === selectedId);
  if (secI >= 0) {
    const sec = doc.sections[secI]!;
    const secUi: LandingSectionUi = (sec.settings.ui as LandingSectionUi | undefined) ?? {};
    const setSecUi = (p: Partial<LandingSectionUi>) => {
      const next = [...doc.sections];
      const merged: LandingSectionUi = { ...secUi, ...p };
      if (merged.marginTop == null) delete merged.marginTop;
      if (merged.marginBottom == null) delete merged.marginBottom;
      next[secI] = { ...sec, settings: { ...sec.settings, ui: Object.keys(merged).length ? merged : undefined } };
      onChangeDoc({ ...doc, sections: next });
    };
    return (
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground">Secção</p>
        <div>
          <Label className="text-xs">Fundo</Label>
          <select
            className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={sec.settings.background ?? "default"}
            onChange={(e) => {
              const v = e.target.value as SectionNode["settings"]["background"];
              const next = [...doc.sections];
              next[secI] = {
                ...sec,
                settings: { ...sec.settings, background: v, customBg: v === "custom" ? sec.settings.customBg : undefined },
              };
              onChangeDoc({ ...doc, sections: next });
            }}
          >
            <option value="default">Claro (default)</option>
            <option value="muted">Suave</option>
            <option value="primary">Primário</option>
            <option value="dark">Escuro</option>
            <option value="custom">Cor custom (hex abaixo)</option>
          </select>
        </div>
        {sec.settings.background === "custom" && (
          <div>
            <Label className="text-xs">Cor (CSS)</Label>
            <Input
              className="mt-1"
              value={String(sec.settings.customBg ?? "")}
              onChange={(e) => {
                const next = [...doc.sections];
                next[secI] = {
                  ...sec,
                  settings: { ...sec.settings, customBg: e.target.value },
                };
                onChangeDoc({ ...doc, sections: next });
              }}
              placeholder="#0a0a0a"
            />
          </div>
        )}
        <div>
          <Label className="text-xs">Cor do texto (opcional)</Label>
          <Input
            className="mt-1"
            value={String(sec.settings.textColor ?? "")}
            onChange={(e) => {
              const v = e.target.value.trim();
              const next = [...doc.sections];
              next[secI] = {
                ...sec,
                settings: { ...sec.settings, textColor: v.length ? v : undefined },
              };
              onChangeDoc({ ...doc, sections: next });
            }}
            placeholder="ex.: #f8fafc ou deixe vazio"
          />
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Útil com fundo personalizado, para o texto não se misturar com o do tema.
          </p>
        </div>
        <div>
          <Label className="text-xs">Padding vertical</Label>
          <select
            className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={sec.settings.paddingY ?? "md"}
            onChange={(e) => {
              const v = e.target.value as NonNullable<SectionNode["settings"]["paddingY"]>;
              const next = [...doc.sections];
              next[secI] = { ...sec, settings: { ...sec.settings, paddingY: v } };
              onChangeDoc({ ...doc, sections: next });
            }}
          >
            <option value="none">Nenhum</option>
            <option value="sm">Pequeno</option>
            <option value="md">Médio</option>
            <option value="lg">Grande</option>
            <option value="xl">Muito grande</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={Boolean(sec.settings.fullBleed)}
            onCheckedChange={(c) => {
              const next = [...doc.sections];
              next[secI] = { ...sec, settings: { ...sec.settings, fullBleed: c } };
              onChangeDoc({ ...doc, sections: next });
            }}
          />
          <Label className="text-xs">Largura total (sem max-width no conteúdo)</Label>
        </div>
        <div className="space-y-2 rounded-md border border-border/50 bg-muted/20 p-2">
          <p className="text-xs font-medium">Espaçamento (visual)</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Margem em cima (px)</Label>
              <Input
                type="number"
                min={0}
                className="mt-0.5 h-8"
                value={secUi.marginTop ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setSecUi({ marginTop: v === "" ? undefined : Math.min(4000, Math.max(0, Number(v))) });
                }}
              />
            </div>
            <div>
              <Label className="text-[10px]">Margem em baixo (px)</Label>
              <Input
                type="number"
                min={0}
                className="mt-0.5 h-8"
                value={secUi.marginBottom ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setSecUi({ marginBottom: v === "" ? undefined : Math.min(4000, Math.max(0, Number(v))) });
                }}
              />
            </div>
          </div>
        </div>
        <div>
          <Label className="text-xs">Classes no section (ex.: sombras, bordas)</Label>
          <Input
            className="mt-1 font-mono text-xs"
            value={String(sec.settings.htmlClass ?? "")}
            onChange={(e) => {
              const next = [...doc.sections];
              next[secI] = { ...sec, settings: { ...sec.settings, htmlClass: e.target.value } };
              onChangeDoc({ ...doc, sections: next });
            }}
            placeholder="ex.: rounded-3xl border border-border/50"
          />
        </div>
        <div>
          <Label className="text-xs">CSS desta secção</Label>
          <Textarea
            className="mt-1 min-h-20 font-mono text-xs"
            value={String(sec.settings.customCss ?? "")}
            onChange={(e) => {
              const next = [...doc.sections];
              next[secI] = { ...sec, settings: { ...sec.settings, customCss: e.target.value } };
              onChangeDoc({ ...doc, sections: next });
            }}
            placeholder="ex.: padding: 2rem;  |  ex.: & h2 { color: #fff; }"
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            Sem chavetas: só a secção. Com regras, substitua o elemento base por
            <code className="mx-0.5 font-mono">&</code> (como no Elementor).
          </p>
        </div>
      </div>
    );
  }
  for (let si = 0; si < doc.sections.length; si++) {
    const s = doc.sections[si]!;
    const wi = s.children.findIndex((w) => w.id === selectedId);
    if (wi < 0) continue;
    const w = s.children[wi]!;
    const patch = (settings: Record<string, unknown>) => {
      const nextS = { ...s, children: setAt(s.children, wi, { ...w, settings: { ...w.settings, ...settings } }) };
      const next = [...doc.sections];
      next[si] = nextS;
      onChangeDoc({ ...doc, sections: next });
    };
    return <WidgetFields widget={w} onPatch={patch} />;
  }
  return <p className="text-sm text-muted-foreground">Nada selecionado</p>;
}

function cleanWidgetUi(merged: LandingWidgetUi): LandingWidgetUi | undefined {
  const o: Record<string, unknown> = { ...merged };
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (v === undefined || v === "" || (typeof v === "number" && Number.isNaN(v))) {
      delete o[k];
    }
  }
  return Object.keys(o).length ? (o as LandingWidgetUi) : undefined;
}

function NumPx({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (n: number | undefined) => void;
}) {
  return (
    <div>
      <Label className="text-[10px]">{label}</Label>
      <Input
        type="number"
        min={0}
        className="mt-0.5 h-8"
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? undefined : Math.min(4000, Math.max(0, Number(v))));
        }}
      />
    </div>
  );
}

function WidgetVisualDesign({
  widget: w,
  onPatch,
}: {
  widget: WidgetNode;
  onPatch: (p: Record<string, unknown>) => void;
}) {
  const u = (w.settings.ui as LandingWidgetUi | undefined) ?? {};
  const setU = (p: Partial<LandingWidgetUi>) => onPatch({ ui: cleanWidgetUi({ ...u, ...p }) });

  return (
    <div className="space-y-3 rounded-md border border-border/50 bg-muted/20 p-2">
      <p className="text-xs font-medium text-foreground">Design (sem CSS)</p>
      <p className="text-[10px] text-muted-foreground">Espaçamento do bloco (px)</p>
      <div className="grid grid-cols-2 gap-2">
        <NumPx
          label="Margem cima"
          value={u.marginTop}
          onChange={(n) => setU({ marginTop: n })}
        />
        <NumPx
          label="Margem baixo"
          value={u.marginBottom}
          onChange={(n) => setU({ marginBottom: n })}
        />
      </div>
      {w.type === "heading" || w.type === "text" ? (
        <div className="space-y-2 border-t border-border/40 pt-2">
          <p className="text-[10px] font-medium text-muted-foreground">Tipografia</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Tamanho (ex.: 1.5rem)</Label>
              <Input
                className="mt-0.5 h-8 font-mono text-xs"
                value={u.fontSize ?? ""}
                onChange={(e) => setU({ fontSize: e.target.value || undefined })}
                placeholder="1.5rem"
              />
            </div>
            <div>
              <Label className="text-[10px]">Interlinha (ex.: 1.4)</Label>
              <Input
                className="mt-0.5 h-8 font-mono text-xs"
                value={u.lineHeight ?? ""}
                onChange={(e) => setU({ lineHeight: e.target.value || undefined })}
                placeholder="1.5"
              />
            </div>
            <div>
              <Label className="text-[10px]">Peso</Label>
              <select
                className="mt-0.5 flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                value={u.fontWeight ?? ""}
                onChange={(e) => setU({ fontWeight: e.target.value || undefined })}
              >
                <option value="">(padrão)</option>
                <option value="400">400</option>
                <option value="500">500</option>
                <option value="600">600</option>
                <option value="700">700</option>
                <option value="800">800</option>
                <option value="normal">normal</option>
              </select>
            </div>
            <div>
              <Label className="text-[10px]">Cor (hex ou css)</Label>
              <Input
                className="mt-0.5 h-8 font-mono text-xs"
                value={u.color ?? ""}
                onChange={(e) => setU({ color: e.target.value || undefined })}
                placeholder="#e2e2e2"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-[10px]">Espaçamento de letras</Label>
              <Input
                className="mt-0.5 h-8 font-mono text-xs"
                value={u.letterSpacing ?? ""}
                onChange={(e) => setU({ letterSpacing: e.target.value || undefined })}
                placeholder="0.02em"
              />
            </div>
          </div>
        </div>
      ) : null}
      {w.type === "hero" ? (
        <div className="space-y-2 border-t border-border/40 pt-2">
          <p className="text-[10px] font-medium text-muted-foreground">Título (hero)</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Tamanho título</Label>
              <Input
                className="mt-0.5 h-8 font-mono text-xs"
                value={u.titleFontSize ?? ""}
                onChange={(e) => setU({ titleFontSize: e.target.value || undefined })}
                placeholder="2.5rem"
              />
            </div>
            <div>
              <Label className="text-[10px]">Peso título</Label>
              <select
                className="mt-0.5 flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                value={u.titleFontWeight ?? ""}
                onChange={(e) => setU({ titleFontWeight: e.target.value || undefined })}
              >
                <option value="">(padrão)</option>
                <option value="600">600</option>
                <option value="700">700</option>
                <option value="800">800</option>
              </select>
            </div>
            <div className="col-span-2">
              <Label className="text-[10px]">Cor título</Label>
              <Input
                className="mt-0.5 h-8 font-mono text-xs"
                value={u.titleColor ?? ""}
                onChange={(e) => setU({ titleColor: e.target.value || undefined })}
              />
            </div>
          </div>
          <p className="pt-1 text-[10px] font-medium text-muted-foreground">Subtítulo (hero)</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Tamanho subtítulo</Label>
              <Input
                className="mt-0.5 h-8 font-mono text-xs"
                value={u.subtitleFontSize ?? ""}
                onChange={(e) => setU({ subtitleFontSize: e.target.value || undefined })}
                placeholder="1.125rem"
              />
            </div>
            <div>
              <Label className="text-[10px]">Cor subtítulo</Label>
              <Input
                className="mt-0.5 h-8 font-mono text-xs"
                value={u.subtitleColor ?? ""}
                onChange={(e) => setU({ subtitleColor: e.target.value || undefined })}
              />
            </div>
          </div>
        </div>
      ) : null}
      {w.type === "image" ? (
        <div className="space-y-2 border-t border-border/40 pt-2">
          <p className="text-[10px] font-medium text-muted-foreground">Imagem</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Largura máx. (ex.: 600px)</Label>
              <Input
                className="mt-0.5 h-8 font-mono text-xs"
                value={u.maxWidth ?? ""}
                onChange={(e) => setU({ maxWidth: e.target.value || undefined })}
                placeholder="100%"
              />
            </div>
            <div>
              <Label className="text-[10px]">Raio borda</Label>
              <Input
                className="mt-0.5 h-8 font-mono text-xs"
                value={u.borderRadius ?? ""}
                onChange={(e) => setU({ borderRadius: e.target.value || undefined })}
                placeholder="12px"
              />
            </div>
          </div>
        </div>
      ) : null}
      {w.type === "button" ? (
        <div className="space-y-2 border-t border-border/40 pt-2">
          <p className="text-[10px] font-medium text-muted-foreground">Tamanho do botão</p>
          <select
            className="mt-0.5 flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
            value={u.buttonSize ?? "default"}
            onChange={(e) => {
              const v = e.target.value;
              setU({ buttonSize: v === "default" ? undefined : (v as "sm" | "lg") });
            }}
          >
            <option value="default">Normal</option>
            <option value="sm">Pequeno</option>
            <option value="lg">Grande</option>
          </select>
        </div>
      ) : null}
    </div>
  );
}

type GalleryImg = { src: string; alt: string };

function GalleryImagesEditor({
  images,
  onImages,
}: {
  images: GalleryImg[];
  onImages: (next: GalleryImg[]) => void;
}) {
  return (
    <div className="space-y-3">
      {images.map((im, i) => (
        <div key={i} className="space-y-2 rounded-md border border-border/50 p-2">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-medium text-muted-foreground">Imagem {i + 1}</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-[10px] text-destructive"
              onClick={() => onImages(images.filter((_, j) => j !== i))}
            >
              Remover
            </Button>
          </div>
          <Field label="URL" value={im.src} on={(v) => onImages(images.map((x, j) => (j === i ? { ...x, src: v } : x)))} />
          <Field
            label="Texto alternativo"
            value={im.alt}
            on={(v) => onImages(images.map((x, j) => (j === i ? { ...x, alt: v } : x)))}
          />
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full"
        onClick={() => onImages([...images, { src: "", alt: "" }])}
      >
        Adicionar imagem
      </Button>
    </div>
  );
}

type FormFieldDef = {
  id: string;
  type: "text" | "email" | "textarea";
  label: string;
  required?: boolean;
  placeholder?: string;
};

function FormFieldsEditor({
  fields,
  onFields,
}: {
  fields: FormFieldDef[];
  onFields: (next: FormFieldDef[]) => void;
}) {
  return (
    <div className="space-y-3">
      {fields.map((f, i) => (
        <div key={f.id} className="space-y-2 rounded-md border border-border/50 p-2">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-[10px] font-medium text-muted-foreground">Campo: {f.id}</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-[10px] text-destructive"
              onClick={() => onFields(fields.filter((_, j) => j !== i))}
            >
              Remover
            </Button>
          </div>
          <div>
            <Label className="text-[10px]">Nome (atributo name)</Label>
            <Input
              className="mt-0.5 h-8 font-mono text-xs"
              value={f.id}
              onChange={(e) => {
                const v = e.target.value.replace(/[^a-zA-Z0-9_]/g, "");
                onFields(fields.map((x, j) => (j === i ? { ...x, id: v || "campo" } : x)));
              }}
            />
          </div>
          <div>
            <Label className="text-[10px]">Tipo</Label>
            <select
              className="mt-0.5 flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
              value={f.type}
              onChange={(e) => {
                const t = e.target.value as FormFieldDef["type"];
                onFields(fields.map((x, j) => (j === i ? { ...x, type: t } : x)));
              }}
            >
              <option value="text">Texto</option>
              <option value="email">E-mail</option>
              <option value="textarea">Área de texto</option>
            </select>
          </div>
          <Field
            label="Rótulo"
            value={f.label}
            on={(v) => onFields(fields.map((x, j) => (j === i ? { ...x, label: v } : x)))}
          />
          <Field
            label="Placeholder (opcional)"
            value={f.placeholder ?? ""}
            on={(v) => onFields(fields.map((x, j) => (j === i ? { ...x, placeholder: v } : x)))}
          />
          <div className="flex items-center gap-2">
            <Switch
              checked={f.required === true}
              onCheckedChange={(c) => onFields(fields.map((x, j) => (j === i ? { ...x, required: c } : x)))}
            />
            <Label className="text-xs">Obrigatório</Label>
          </div>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full"
        onClick={() => {
          const existing = new Set(fields.map((f) => f.id));
          let n = 1;
          let nid = `campo_${n}`;
          while (existing.has(nid)) {
            n += 1;
            nid = `campo_${n}`;
          }
          onFields([...fields, { id: nid, type: "text", label: "Novo campo", required: false, placeholder: "" }]);
        }}
      >
        Adicionar campo
      </Button>
    </div>
  );
}

function AccordionItemEditor({
  items,
  allowMultiple,
  onItems,
  onAllowMultiple,
}: {
  items: { title: string; body: string }[];
  allowMultiple: boolean;
  onItems: (next: { title: string; body: string }[]) => void;
  onAllowMultiple: (v: boolean) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">Várias abertas ao mesmo tempo</Label>
        <Switch checked={allowMultiple} onCheckedChange={onAllowMultiple} />
      </div>
      <p className="text-[10px] text-muted-foreground">Cada pergunta pode ter o texto de resposta em várias linhas.</p>
      {items.map((it, i) => (
        <div key={i} className="space-y-2 rounded-md border border-border/50 p-2">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-medium text-muted-foreground">Pergunta {i + 1}</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-[10px] text-destructive"
              onClick={() => onItems(items.filter((_, j) => j !== i))}
            >
              Remover
            </Button>
          </div>
          <Input
            className="h-8 text-sm"
            value={it.title}
            onChange={(e) => {
              const next = items.slice();
              const row = { ...next[i]!, title: e.target.value };
              next[i] = row;
              onItems(next);
            }}
            placeholder="Pergunta"
          />
          <Textarea
            className="min-h-16 text-sm"
            value={it.body}
            onChange={(e) => {
              const next = items.slice();
              const row = { ...next[i]!, body: e.target.value };
              next[i] = row;
              onItems(next);
            }}
            placeholder="Resposta"
          />
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full"
        onClick={() => onItems([...items, { title: "Nova pergunta", body: "Resposta…" }])}
      >
        Adicionar pergunta
      </Button>
    </div>
  );
}

function WidgetFields({
  widget: w,
  onPatch,
}: {
  widget: WidgetNode;
  onPatch: (p: Record<string, unknown>) => void;
}) {
  const t = w.settings;
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground">
        {landingWidgetLabel(w.type)} <span className="text-[10px]">({w.type})</span>
      </p>
      {w.type === "hero" && (
        <>
          <Field label="Título" value={String(t.title ?? "")} on={ (v) => onPatch({ title: v })} />
          <Field label="Subtítulo" value={String(t.subtitle ?? "")} on={ (v) => onPatch({ subtitle: v })} area />
          <Field label="CTA primário" value={String(t.primaryCtaLabel ?? "")} on={ (v) => onPatch({ primaryCtaLabel: v })} />
          <Field label="URL CTA primário" value={String(t.primaryCtaHref ?? "")} on={ (v) => onPatch({ primaryCtaHref: v })} />
          <Field label="CTA secundário (opcional)" value={String(t.secondaryCtaLabel ?? "")} on={ (v) => onPatch({ secondaryCtaLabel: v })} />
          <Field label="URL CTA secundário" value={String(t.secondaryCtaHref ?? "")} on={ (v) => onPatch({ secondaryCtaHref: v })} />
          <div>
            <Label className="text-xs">Alinhamento</Label>
            <select
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={String(t.align ?? "center")}
              onChange={(e) => onPatch({ align: e.target.value })}
            >
              <option value="left">Esquerda</option>
              <option value="center">Centro</option>
              <option value="right">Direita</option>
            </select>
          </div>
        </>
      )}
      {w.type === "heading" && (
        <>
          <Field label="Texto" value={String(t.text ?? "")} on={ (v) => onPatch({ text: v })} />
          <div>
            <Label className="text-xs">Nível</Label>
            <select
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={String(t.level ?? 2)}
              onChange={(e) => onPatch({ level: Number(e.target.value) })}
            >
              <option value="1">H1</option>
              <option value="2">H2</option>
              <option value="3">H3</option>
              <option value="4">H4</option>
              <option value="5">H5</option>
              <option value="6">H6</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">Alinhamento</Label>
            <select
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={String(t.align ?? "left")}
              onChange={(e) => onPatch({ align: e.target.value })}
            >
              <option value="left">Esquerda</option>
              <option value="center">Centro</option>
              <option value="right">Direita</option>
            </select>
          </div>
        </>
      )}
      {w.type === "text" && (
        <>
          <div>
            <Label className="text-xs">Parágrafo (texto simples ou HTML básico)</Label>
            <Textarea
              className="mt-1 min-h-24"
              value={String(t.body ?? "")}
              onChange={(e) => onPatch({ body: e.target.value })}
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Se começar com uma etiqueta HTML (ex. <span className="font-mono">&lt;p&gt;</span>), a pré-visualização renderiza como HTML.
            </p>
          </div>
          <div>
            <Label className="text-xs">Alinhamento</Label>
            <select
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={String(t.align ?? "left")}
              onChange={(e) => onPatch({ align: e.target.value })}
            >
              <option value="left">Esquerda</option>
              <option value="center">Centro</option>
              <option value="right">Direita</option>
            </select>
          </div>
        </>
      )}
      {w.type === "image" && (
        <>
          <Field label="URL da imagem" value={String(t.src ?? "")} on={ (v) => onPatch({ src: v })} />
          <Field label="Texto alternativo" value={String(t.alt ?? "")} on={ (v) => onPatch({ alt: v })} />
          <Field
            label="Ligar imagem a (URL, opcional)"
            value={String((t as { link?: string }).link ?? "")}
            on={ (v) => onPatch({ link: v.length ? v : undefined })}
          />
          <div className="flex items-center gap-2">
            <Switch
              checked={t.rounded !== false}
              onCheckedChange={(c) => onPatch({ rounded: c })}
            />
            <Label className="text-xs">Cantos arredondados</Label>
          </div>
        </>
      )}
      {w.type === "button" && (
        <>
          <Field label="Texto" value={String(t.label ?? "")} on={ (v) => onPatch({ label: v })} />
          <Field label="URL" value={String(t.href ?? "")} on={ (v) => onPatch({ href: v })} />
          <div>
            <Label className="text-xs">Abrir em</Label>
            <select
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={String((t as { target?: string }).target ?? "_self")}
              onChange={(e) => onPatch({ target: e.target.value === "_self" ? undefined : e.target.value })}
            >
              <option value="_self">Mesma página</option>
              <option value="_blank">Novo separador</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">Estilo</Label>
            <select
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={String(t.variant ?? "default")}
              onChange={(e) => onPatch({ variant: e.target.value })}
            >
              <option value="default">Preenchido</option>
              <option value="outline">Contorno</option>
              <option value="secondary">Secundário</option>
            </select>
          </div>
        </>
      )}
      {w.type === "spacer" && (
        <div>
          <Label className="text-xs">Altura (px)</Label>
          <Input
            type="number"
            className="mt-1"
            value={Number(t.height ?? 24)}
            onChange={(e) => onPatch({ height: Number(e.target.value) })}
          />
        </div>
      )}
      {w.type === "pricing" && (
        <>
          <Field label="Título" value={String(t.headline ?? "")} on={ (v) => onPatch({ headline: v })} />
          <div>
            <Label className="text-xs">Preço base mensal (valor numérico)</Label>
            <Input
              type="number"
              className="mt-1"
              value={Number(t.monthlyBase ?? 0)}
              onChange={(e) => onPatch({ monthlyBase: Number(e.target.value) })}
            />
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              O montante é indicado na moeda escolhida abaixo (só afecta o texto na página; o checkout Hotmart usa a
              moeda do produto lá configurada).
            </p>
          </div>
          <div>
            <Label className="text-xs">Moeda (exibição na landing)</Label>
            {(() => {
              const cur = normalizeCurrencyCode(String(t.currency));
              const inPreset = LANDING_CURRENCY_CHOICES.some((c) => c.value === cur);
              return (
                <select
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={inPreset ? cur : cur}
                  onChange={(e) => onPatch({ currency: e.target.value })}
                >
                  {!inPreset && cur ? (
                    <option value={cur}>
                      {cur} (atual, não listado)
                    </option>
                  ) : null}
                  {LANDING_CURRENCY_CHOICES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              );
            })()}
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Símbolo e formatação seguem a moeda (códigos ISO 4217). O produto no Hotmart pode ter outra moeda de cobrança.
            </p>
          </div>
          <div>
            <Label className="text-xs">Desconto % (pactos 3 e 12 meses)</Label>
            <Input
              type="number"
              className="mt-1"
              value={Number(t.discountPercent ?? 10)}
              onChange={(e) => onPatch({ discountPercent: Number(e.target.value) })}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Trimestral e anual: total = 3× ou 12× o mês, menos esta % de desconto sobre o valor linear.
          </p>
          <Field
            label="Rótulo mensal"
            value={String((t.planNames as Record<string, string>)?.monthly ?? "")}
            on={(v) => {
              const pn = (t.planNames as Record<string, string>) ?? {};
              onPatch({ planNames: { ...pn, monthly: v } });
            }}
          />
          <Field
            label="Rótulo trimestral"
            value={String((t.planNames as Record<string, string>)?.quarterly ?? "")}
            on={(v) => {
              const pn = (t.planNames as Record<string, string>) ?? {};
              onPatch({ planNames: { ...pn, quarterly: v } });
            }}
          />
          <Field
            label="Rótulo anual"
            value={String((t.planNames as Record<string, string>)?.annual ?? "")}
            on={(v) => {
              const pn = (t.planNames as Record<string, string>) ?? {};
              onPatch({ planNames: { ...pn, annual: v } });
            }}
          />
          <div>
            <Label className="text-xs">Uma feature por linha</Label>
            <Textarea
              className="mt-1 min-h-20 font-mono text-xs"
              value={((t.features as string[]) || []).join("\n")}
              onChange={(e) => onPatch({ features: e.target.value.split("\n").map((l) => l.trim()).filter(Boolean) })}
            />
          </div>
          <Field label="CTA" value={String(t.ctaLabel ?? "")} on={ (v) => onPatch({ ctaLabel: v })} />
          <Field label="URL checkout mensal" value={String(t.checkoutMonthly ?? "")} on={ (v) => onPatch({ checkoutMonthly: v })} />
          <Field label="URL checkout trimestral" value={String(t.checkoutQuarterly ?? "")} on={ (v) => onPatch({ checkoutQuarterly: v })} />
          <Field label="URL checkout anual" value={String(t.checkoutAnnual ?? "")} on={ (v) => onPatch({ checkoutAnnual: v })} />
          <p className="text-[10px] leading-snug text-muted-foreground">
            Os links reais de pagamento vêm da sua conta (Hotmart ou definição do alojamento). Aqui vê
            {` `}«placeholders» que no site ao vivo são trocados pelos endereços corretos. A confirmação de compra é
            tratada pelo serviço em segundo plano (quem aloja a app configura isso; não precisa de alterar a página).
          </p>
          <div className="mt-3 space-y-2 rounded-md border border-border/60 bg-muted/15 p-3">
            <p className="text-xs font-medium text-foreground">Plano grátis / teste</p>
            <p className="text-[10px] text-muted-foreground">
              Cartão extra, totalmente editável. Pode usar os textos <code className="font-mono">{"{dias}"}</code> ou{" "}
              <code className="font-mono">{"{days}"}</code> para o número de dias de teste abaixo. O endereço do botão
              pode ser preenchido no alojamento se deixar em branco o que está na página pública.
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={
                    t.freeTrial == null ||
                    (t.freeTrial as { enabled?: boolean }).enabled !== false
                  }
                  onCheckedChange={(c) => {
                    const cur = (t.freeTrial as Record<string, unknown>) ?? {};
                    onPatch({ freeTrial: { ...getDefaultFreeTrialSettings(), ...cur, enabled: c } });
                  }}
                />
                <Label className="text-xs">Mostrar plano de teste</Label>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-[10px]"
                onClick={() => onPatch({ freeTrial: getDefaultFreeTrialSettings() })}
              >
                Repor padrão grátis
              </Button>
            </div>
            <div>
              <Label className="text-xs">Posição do cartão de teste</Label>
              <select
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={String((t.freeTrial as { position?: string })?.position ?? "first")}
                onChange={(e) => {
                  const cur = (t.freeTrial as Record<string, unknown>) ?? {};
                  onPatch({ freeTrial: { ...getDefaultFreeTrialSettings(), ...cur, position: e.target.value } });
                }}
              >
                <option value="first">Antes dos planos pagos</option>
                <option value="last">Depois dos planos pagos</option>
              </select>
            </div>
            <div>
              <Field
                label="Nome do plano"
                value={String((t.freeTrial as { name?: string })?.name ?? "")}
                on={(v) => {
                  const cur = (t.freeTrial as Record<string, unknown>) ?? {};
                  onPatch({ freeTrial: { ...getDefaultFreeTrialSettings(), ...cur, name: v } });
                }}
              />
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Em nome, preço, subtítulo, badge, período e linhas de features pode usar <code className="font-mono">{"{dias}"}</code> ou{" "}
                <code className="font-mono">{"{days}"}</code> — substituem o valor de «Duração (dias)» (ex.{" "}
                <code className="font-mono">Grátis {"{dias}"} dias</code>).
              </p>
            </div>
            <Field
              label="Texto do preço (ex.: Grátis, 0€)"
              value={String((t.freeTrial as { priceLabel?: string })?.priceLabel ?? "")}
              on={(v) => {
                const cur = (t.freeTrial as Record<string, unknown>) ?? {};
                onPatch({ freeTrial: { ...getDefaultFreeTrialSettings(), ...cur, priceLabel: v } });
              }}
            />
            <Field
              label="Subtítulo (opcional)"
              value={String((t.freeTrial as { subtitle?: string })?.subtitle ?? "")}
              on={(v) => {
                const cur = (t.freeTrial as Record<string, unknown>) ?? {};
                onPatch({ freeTrial: { ...getDefaultFreeTrialSettings(), ...cur, subtitle: v } });
              }}
            />
            <div>
              <Label className="text-xs">Duração (dias)</Label>
              <Input
                type="number"
                min={1}
                className="mt-1"
                value={Number((t.freeTrial as { trialDays?: number })?.trialDays ?? 14)}
                onChange={(e) => {
                  const cur = (t.freeTrial as Record<string, unknown>) ?? {};
                  onPatch({ freeTrial: { ...getDefaultFreeTrialSettings(), ...cur, trialDays: Math.max(1, Number(e.target.value) || 14) } });
                }}
              />
            </div>
            <div>
              <Label className="text-xs">Texto do período (com {"{dias}"} opcional)</Label>
              <Textarea
                className="mt-1 min-h-16 text-sm"
                value={String((t.freeTrial as { periodText?: string })?.periodText ?? "")}
                onChange={(e) => {
                  const cur = (t.freeTrial as Record<string, unknown>) ?? {};
                  onPatch({ freeTrial: { ...getDefaultFreeTrialSettings(), ...cur, periodText: e.target.value } });
                }}
              />
            </div>
            <Field
              label="Destaque (badge, opcional)"
              value={String((t.freeTrial as { badge?: string })?.badge ?? "")}
              on={(v) => {
                const cur = (t.freeTrial as Record<string, unknown>) ?? {};
                onPatch({ freeTrial: { ...getDefaultFreeTrialSettings(), ...cur, badge: v } });
              }}
            />
            <Field
              label="CTA do teste"
              value={String((t.freeTrial as { ctaLabel?: string })?.ctaLabel ?? "")}
              on={(v) => {
                const cur = (t.freeTrial as Record<string, unknown>) ?? {};
                onPatch({ freeTrial: { ...getDefaultFreeTrialSettings(), ...cur, ctaLabel: v } });
              }}
            />
            <Field
              label="URL (registo, checkout, etc.)"
              value={String((t.freeTrial as { checkoutUrl?: string })?.checkoutUrl ?? "")}
              on={(v) => {
                const cur = (t.freeTrial as Record<string, unknown>) ?? {};
                onPatch({ freeTrial: { ...getDefaultFreeTrialSettings(), ...cur, checkoutUrl: v } });
              }}
            />
            <div>
              <Label className="text-xs">Features (uma por linha) — vazio = lista dos planos pagos</Label>
              <Textarea
                className="mt-1 min-h-20 font-mono text-xs"
                value={(
                  (t.freeTrial as { features?: string[] } | undefined)?.features ?? []
                ).join("\n")}
                onChange={(e) => {
                  const cur = (t.freeTrial as Record<string, unknown>) ?? {};
                  const lines = e.target.value
                    .split("\n")
                    .map((l) => l.trim())
                    .filter(Boolean);
                  onPatch({ freeTrial: { ...getDefaultFreeTrialSettings(), ...cur, features: lines } });
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={Boolean((t.freeTrial as { highlight?: boolean })?.highlight)}
                onCheckedChange={(c) => {
                  const cur = (t.freeTrial as Record<string, unknown>) ?? {};
                  onPatch({ freeTrial: { ...getDefaultFreeTrialSettings(), ...cur, highlight: c } });
                }}
              />
              <Label className="text-xs">Destacar cartão (anular como plano popular)</Label>
            </div>
          </div>
        </>
      )}
      {w.type === "icon_list" && (
        <div>
          <Label className="text-xs">Itens (um por linha)</Label>
          <Textarea
            className="mt-1 min-h-20"
            value={((t.items as string[]) || []).join("\n")}
            onChange={(e) => onPatch({ items: e.target.value.split("\n").map((l) => l.trim()).filter(Boolean) })}
          />
        </div>
      )}
      {w.type === "html" && (
        <div>
          <Label className="text-xs">HTML</Label>
          <Textarea
            className="mt-1 min-h-32 font-mono text-xs"
            value={String(t.html ?? "")}
            onChange={(e) => onPatch({ html: e.target.value })}
          />
        </div>
      )}
      {w.type === "video" && (
        <>
          <Field
            label="URL (YouTube, Vimeo)"
            value={String(t.url ?? "")}
            on={(v) => onPatch({ url: v })}
          />
          <Field label="Legenda (opcional)" value={String((t as { caption?: string }).caption ?? "")} on={(v) => onPatch({ caption: v })} />
          <div>
            <Label className="text-xs">Proporção</Label>
            <select
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={String((t as { aspect?: string }).aspect ?? "16/9")}
              onChange={(e) => onPatch({ aspect: e.target.value })}
            >
              <option value="16/9">16:9</option>
              <option value="4/3">4:3</option>
              <option value="1/1">1:1 (quadrado)</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">Alinhamento</Label>
            <select
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={String(t.align ?? "center")}
              onChange={(e) => onPatch({ align: e.target.value })}
            >
              <option value="left">Esquerda</option>
              <option value="center">Centro</option>
              <option value="right">Direita</option>
            </select>
          </div>
        </>
      )}
      {w.type === "accordion" && (
        <AccordionItemEditor
          items={
            (t.items as { title: string; body: string }[] | undefined) ?? [
              { title: "Pergunta", body: "Resposta" },
            ]
          }
          allowMultiple={Boolean((t as { allowMultiple?: boolean }).allowMultiple)}
          onItems={(items) => onPatch({ items })}
          onAllowMultiple={(allowMultiple) => onPatch({ allowMultiple })}
        />
      )}
      {w.type === "testimonial" && (
        <>
          <div>
            <Label className="text-xs">Citação</Label>
            <Textarea
              className="mt-1 min-h-20"
              value={String((t as { quote?: string }).quote ?? "")}
              onChange={(e) => onPatch({ quote: e.target.value })}
            />
          </div>
          <Field
            label="Autor"
            value={String((t as { author?: string }).author ?? "")}
            on={(v) => onPatch({ author: v })}
          />
          <Field
            label="Função / empresa (opcional)"
            value={String((t as { role?: string }).role ?? "")}
            on={(v) => onPatch({ role: v })}
          />
          <Field
            label="URL foto (opcional)"
            value={String((t as { avatarUrl?: string }).avatarUrl ?? "")}
            on={(v) => onPatch({ avatarUrl: v })}
          />
          <div>
            <Label className="text-xs">Alinhamento</Label>
            <select
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={String((t as { align?: string }).align ?? "left")}
              onChange={(e) => onPatch({ align: e.target.value })}
            >
              <option value="left">Esquerda</option>
              <option value="center">Centro</option>
              <option value="right">Direita</option>
            </select>
          </div>
        </>
      )}
      {w.type === "embed" && (
        <>
          <Field
            label="Título (acessibilidade)"
            value={String((t as { title?: string }).title ?? "")}
            on={(v) => onPatch({ title: v })}
          />
          <Field
            label="URL do iframe (https)"
            value={String((t as { src?: string }).src ?? "")}
            on={(v) => onPatch({ src: v })}
          />
          <p className="text-[10px] text-muted-foreground">
            Cole o <code className="font-mono">src</code> do iframe (ex.: partilha do Google Maps &gt; incorporar).
          </p>
          <div>
            <Label className="text-xs">Altura (px)</Label>
            <Input
              type="number"
              className="mt-1"
              min={120}
              max={1200}
              value={Number((t as { height?: number }).height ?? 400)}
              onChange={(e) => onPatch({ height: Math.max(120, Math.min(1200, Number(e.target.value) || 400)) })}
            />
          </div>
          <div>
            <Label className="text-xs">Alinhamento</Label>
            <select
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={String(t.align ?? "left")}
              onChange={(e) => onPatch({ align: e.target.value })}
            >
              <option value="left">Esquerda</option>
              <option value="center">Centro</option>
              <option value="right">Direita</option>
            </select>
          </div>
        </>
      )}
      {w.type === "columns" && (
        <>
          <div>
            <Label className="text-xs">Número de colunas</Label>
            <select
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={String((t as { columnCount?: number }).columnCount ?? 2)}
              onChange={(e) => {
                const nc = Math.min(4, Math.max(2, Number(e.target.value) || 2));
                const cur = ([...((t as { cells?: string[] }).cells ?? [])] as string[]);
                const next = [...cur];
                while (next.length < nc) next.push("<p></p>");
                onPatch({ columnCount: nc, cells: next.slice(0, nc) });
              }}
            >
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">Espaço</Label>
            <select
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={String((t as { gap?: string }).gap ?? "md")}
              onChange={(e) => onPatch({ gap: e.target.value })}
            >
              <option value="sm">Pequeno</option>
              <option value="md">Médio</option>
              <option value="lg">Grande</option>
            </select>
          </div>
          <p className="text-[10px] text-muted-foreground">Conteúdo de cada coluna (HTML). Em mobile, as colunas empilham.</p>
          {(((t as { cells?: string[] }).cells ?? []) as string[]).map((cell, i) => (
            <div key={i} className="space-y-1">
              <Label className="text-xs">Coluna {i + 1}</Label>
              <Textarea
                className="min-h-24 font-mono text-xs"
                value={cell}
                onChange={(e) => {
                  const cur = ([...((t as { cells?: string[] }).cells ?? [])] as string[]);
                  const out = cur.slice();
                  out[i] = e.target.value;
                  onPatch({ cells: out });
                }}
              />
            </div>
          ))}
        </>
      )}
      {w.type === "gallery" && (
        <>
          <div>
            <Label className="text-xs">Colunas na grelha</Label>
            <select
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={String((t as { gridCols?: number }).gridCols ?? 3)}
              onChange={(e) => onPatch({ gridCols: Number(e.target.value) })}
            >
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">Espaço</Label>
            <select
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={String((t as { gap?: string }).gap ?? "md")}
              onChange={(e) => onPatch({ gap: e.target.value })}
            >
              <option value="sm">Pequeno</option>
              <option value="md">Médio</option>
              <option value="lg">Grande</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={(t as { rounded?: boolean }).rounded !== false}
              onCheckedChange={(c) => onPatch({ rounded: c })}
            />
            <Label className="text-xs">Cantos arredondados</Label>
          </div>
          <GalleryImagesEditor
            images={((t as { images?: GalleryImg[] }).images ?? []) as GalleryImg[]}
            onImages={(images) => onPatch({ images })}
          />
        </>
      )}
      {w.type === "form" && (
        <>
          <Field
            label="Título"
            value={String((t as { heading?: string }).heading ?? "")}
            on={(v) => onPatch({ heading: v })}
          />
          <Field
            label="Descrição (opcional)"
            value={String((t as { description?: string }).description ?? "")}
            on={(v) => onPatch({ description: v })}
            area
          />
          <Field
            label="URL de envio (https:)"
            value={String((t as { action?: string }).action ?? "")}
            on={(v) => onPatch({ action: v })}
          />
          <p className="text-[10px] text-muted-foreground">
            Para onde enviar os dados quando o visitante carrega em Enviar (serviço de formulários, o seu
            fornecedor, etc.). Só ligações seguras (https) em produção; em testes o sistema pode permitir
            ligações locais.
          </p>
          <div>
            <Label className="text-xs">Método</Label>
            <select
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={String((t as { method?: string }).method ?? "post")}
              onChange={(e) => onPatch({ method: e.target.value })}
            >
              <option value="post">POST</option>
              <option value="get">GET</option>
            </select>
          </div>
          <Field
            label="Texto do botão"
            value={String((t as { submitLabel?: string }).submitLabel ?? "Enviar")}
            on={(v) => onPatch({ submitLabel: v })}
          />
          <p className="text-xs font-medium text-muted-foreground">Campos</p>
          <FormFieldsEditor
            fields={((t as { fields?: FormFieldDef[] }).fields ?? getDefaultFormSettings().fields) as FormFieldDef[]}
            onFields={(fields) => onPatch({ fields })}
          />
        </>
      )}
      {w.type === "countdown" && (
        <>
          <Field
            label="Título (opcional)"
            value={String((t as { headline?: string }).headline ?? "")}
            on={(v) => onPatch({ headline: v })}
          />
          <div>
            <Label className="text-xs">Data e hora alvo (hora local)</Label>
            <Input
              className="mt-1"
              type="datetime-local"
              value={isoToDatetimeLocalValue(String((t as { targetDate?: string }).targetDate ?? ""))}
              onChange={(e) => {
                const v = e.target.value;
                onPatch({ targetDate: v ? new Date(v).toISOString() : "" });
              }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">O visitante vê a contagem no fuso do navegador; o valor é guardado em ISO UTC.</p>
          <div className="grid grid-cols-2 gap-2">
            <Field
              label="Rótulo: dias"
              value={String((t as { labels?: { days?: string } }).labels?.days ?? "Dias")}
              on={(v) =>
                onPatch({ labels: { ...((t as { labels?: Record<string, string> }).labels ?? {}), days: v } })
              }
            />
            <Field
              label="Rótulo: horas"
              value={String((t as { labels?: { hours?: string } }).labels?.hours ?? "Horas")}
              on={(v) =>
                onPatch({ labels: { ...((t as { labels?: Record<string, string> }).labels ?? {}), hours: v } })
              }
            />
            <Field
              label="Rótulo: minutos"
              value={String((t as { labels?: { minutes?: string } }).labels?.minutes ?? "Minutos")}
              on={(v) =>
                onPatch({ labels: { ...((t as { labels?: Record<string, string> }).labels ?? {}), minutes: v } })
              }
            />
            <Field
              label="Rótulo: segundos"
              value={String((t as { labels?: { seconds?: string } }).labels?.seconds ?? "Segundos")}
              on={(v) =>
                onPatch({ labels: { ...((t as { labels?: Record<string, string> }).labels ?? {}), seconds: v } })
              }
            />
          </div>
          <Field
            label="Mensagem após fim (opcional)"
            value={String((t as { expiredMessage?: string }).expiredMessage ?? "")}
            on={(v) => onPatch({ expiredMessage: v })}
            area
          />
        </>
      )}
      {w.type === "divider" && <p className="text-xs text-muted-foreground">Sem opções. Linha horizontais.</p>}
      <WidgetVisualDesign widget={w} onPatch={onPatch} />
      <div className="mt-3 border-t border-border pt-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Avançado (CSS manual)</p>
        <Field
          label="Classes no bloco"
          value={String(t.htmlClass ?? "")}
          on={(v) => onPatch({ htmlClass: v })}
        />
        <div>
          <Label className="text-xs">CSS do bloco</Label>
          <Textarea
            className="mt-1 min-h-20 font-mono text-xs"
            value={String(t.customCss ?? "")}
            onChange={(e) => onPatch({ customCss: e.target.value })}
            placeholder="ex.: max-width: 40rem; margin-inline: auto;  |  ex.: & p { line-height: 1.6; }"
          />
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Isto aplica a um contentor em volta do bloco. Use <code className="font-mono">&</code> para
          estilos em elementos internos. CSS global da página: painel &quot;CSS global&quot; à
          esquerda.
        </p>
      </div>
    </div>
  );
}

function Field({ label, value, on, area }: { label: string; value: string; on: (v: string) => void; area?: boolean }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      {area ? (
        <Textarea className="mt-1 min-h-16" value={value} onChange={(e) => on(e.target.value)} />
      ) : (
        <Input className="mt-1" value={value} onChange={(e) => on(e.target.value)} />
      )}
    </div>
  );
}

/** Ajusta o espaçamento *acima* da secção (equivale a `marginTop` / margem do inspector) — arraste vertical. */
function SectionGapResizer({
  marginTopPx,
  onDrag,
  sectionLabel,
}: {
  marginTopPx: number;
  onDrag: (next: number) => void;
  sectionLabel: string;
}) {
  const start = useRef({ y0: 0, m0: 0 });
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!active) return;
    const move = (e: PointerEvent) => {
      const d = e.clientY - start.current.y0;
      const next = Math.min(4000, Math.max(0, Math.round(start.current.m0 + d)));
      onDrag(next);
    };
    const up = () => setActive(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [active, onDrag]);

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      title={`Ajustar espaço acima de «${sectionLabel}» (${marginTopPx}px) — arraste verticalmente`}
      className="group relative -mx-1 flex h-6 cursor-row-resize items-center justify-center select-none"
      onPointerDown={(e) => {
        e.preventDefault();
        start.current = { y0: e.clientY, m0: marginTopPx };
        setActive(true);
      }}
    >
      <div
        className={cn(
          "h-1 w-20 rounded-full border border-dashed border-muted-foreground/50 bg-muted/40 transition-colors",
          active && "border-primary bg-primary/20",
          "group-hover:border-primary/60 group-hover:bg-primary/10",
        )}
      />
      {active && (
        <span className="absolute top-1/2 z-10 -translate-y-1/2 rounded bg-primary px-1.5 py-0.5 font-mono text-[10px] text-primary-foreground shadow">
          {Math.round(marginTopPx)}px
        </span>
      )}
    </div>
  );
}

export function LandingEditorView({
  doc,
  onChangeDoc,
  theme,
  readOnly = false,
}: {
  doc: LandingDocument;
  onChangeDoc: (d: LandingDocument) => void;
  theme: Record<string, unknown>;
  /** Só visualização (ex.: membro com permissão de leitura). */
  readOnly?: boolean;
}) {
  const applyDoc = useCallback(
    (d: LandingDocument) => {
      if (readOnly) return;
      onChangeDoc(d);
    },
    [readOnly, onChangeDoc],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importJsonOpen, setImportJsonOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState("");
  const [widgetQuery, setWidgetQuery] = useState("");
  const sectionIds = useMemo(() => doc.sections.map((s) => s.id), [doc.sections]);
  const filteredPalette = useMemo(() => filterLandingWidgetsByQuery(widgetQuery), [widgetQuery]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onSectionDrag = useCallback(
    (e: DragEndEvent) => {
      const { active, over } = e;
      if (!over || active.id === over.id) return;
      const oi = sectionIds.indexOf(String(active.id));
      const ni = sectionIds.indexOf(String(over.id));
      if (oi < 0 || ni < 0) return;
      applyDoc({ ...doc, sections: arrayMove(doc.sections, oi, ni) });
    },
    [doc, applyDoc, sectionIds],
  );

  const addSection = () => applyDoc({ ...doc, sections: [...doc.sections, createEmptySection()] });
  const addWidget = (type: WidgetType) => {
    if (doc.sections.length === 0) addSection();
    const last = doc.sections.length - 1;
    const s = doc.sections[last]!;
    const w = createWidget(type);
    const nextS = { ...s, children: [...s.children, w] };
    const sections = setAt(doc.sections, last, nextS);
    applyDoc({ ...doc, sections });
    setSelectedId(w.id);
  };

  const duplicateWidget = (si: number, wi: number) => {
    const s = doc.sections[si]!;
    const w = s.children[wi]!;
    const copy: WidgetNode = {
      ...w,
      id: newId(),
      settings: typeof structuredClone === "function" ? structuredClone(w.settings) : { ...w.settings },
    };
    if (w.type === "pricing") {
      const h = (copy.settings.headline as string) || "Planos";
      copy.settings = { ...copy.settings, headline: `${h} (cópia)` };
    }
    if (w.type === "form") {
      const h = String((copy.settings as { heading?: string }).heading ?? "Formulário");
      copy.settings = { ...copy.settings, heading: `${h} (cópia)` };
    }
    const nextS = { ...s, children: [...s.children.slice(0, wi + 1), copy, ...s.children.slice(wi + 1)] };
    applyDoc({ ...doc, sections: setAt(doc.sections, si, nextS) });
    setSelectedId(copy.id);
  };

  const setSectionMarginTop = useCallback(
    (sIdx: number, marginTop: number) => {
      const sec = doc.sections[sIdx]!;
      const prev = (sec.settings.ui as LandingSectionUi | undefined) ?? {};
      const ui: LandingSectionUi = { ...prev };
      if (marginTop <= 0) delete ui.marginTop;
      else ui.marginTop = marginTop;
      applyDoc({
        ...doc,
        sections: setAt(doc.sections, sIdx, {
          ...sec,
          settings: { ...sec.settings, ui: Object.keys(ui).length ? ui : undefined },
        }),
      });
    },
    [doc, applyDoc],
  );

  const applyJsonImport = () => {
    const r = importLandingFromJson(importJsonText);
    if (r.ok) {
      applyDoc(r.doc);
      setImportJsonOpen(false);
      setImportJsonText("");
      setSelectedId(null);
      toast.success("Documento importado. Use «Guardar» no topo para persistir na base de dados.");
    } else {
      toast.error(r.error);
    }
  };

  return (
    <>
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
    <Group
      id="landing-editor"
      orientation="horizontal"
      className="h-full min-h-0 w-full min-w-0 flex-1"
      resizeTargetMinimumSize={{ fine: 12, coarse: 20 }}
    >
      <Panel
        className="flex !min-w-0 min-w-0 flex-col overflow-hidden"
        id="lp-widgets"
        defaultSize="22%"
        minSize="14%"
        maxSize="40%"
        groupResizeBehavior="preserve-relative-size"
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-border/80 bg-gradient-to-b from-muted/30 to-muted/10 p-2 shadow-sm">
        <div className="flex items-center justify-between gap-1 px-1 pb-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Elementos</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 gap-1 px-1.5 text-[10px] text-muted-foreground"
            onClick={() => setImportJsonOpen(true)}
          >
            <FileJson2 className="h-3.5 w-3.5" />
            Importar ficheiro
          </Button>
        </div>
        <p className="px-1 pb-2 text-[10px] text-muted-foreground">
          Blocos estilo page builder (hero, texto, preços, vídeo, FAQ, depoimento, iframe, HTML…). Cada bloco e cada
          secção têm estilos e CSS opcional. O que faltar cobre-se com o bloco HTML ou CSS global.
        </p>
        <div className="relative px-1 pb-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={widgetQuery}
            onChange={(e) => setWidgetQuery(e.target.value)}
            placeholder="Pesquisar widget…"
            className="h-8 pl-8 text-xs"
            aria-label="Pesquisar widgets"
          />
        </div>
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full max-h-full pr-0">
          <div className="space-y-3 pr-2">
            {LANDING_WIDGET_CATEGORIES.map((cat) => {
              const items = filteredPalette.filter((w) => w.category === cat.id);
              if (items.length === 0) return null;
              return (
                <div key={cat.id}>
                  <h3 className="mb-1.5 px-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {cat.label}
                  </h3>
                  <div className="grid grid-cols-2 gap-1.5">
                    {items.map((def) => {
                      const Icon = def.icon;
                      return (
                        <Button
                          key={def.type}
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-auto flex-col gap-1 px-1.5 py-2 text-[10px] leading-tight"
                          onClick={() => addWidget(def.type)}
                          title={def.hint ?? def.label}
                        >
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="line-clamp-2 text-center font-medium">{def.label}</span>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
        </div>
        <Button type="button" className="mt-2 w-full shrink-0" size="sm" variant="outline" onClick={addSection}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Nova secção
        </Button>
        <div className="mt-2 shrink-0 space-y-1 border-t border-border/80 pt-2">
          <p className="px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">CSS global (página)</p>
          <p className="px-1 text-[9px] leading-snug text-muted-foreground">
            Injetado na raiz (classe <code className="font-mono">.lp-page</code>). Afecta toda a landing.
          </p>
          <Textarea
            className="min-h-20 max-h-36 w-full resize-y font-mono text-[11px] leading-normal"
            value={doc.customCss ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              applyDoc({ ...doc, customCss: v.length ? v : undefined });
            }}
            placeholder={`.lp-page { }\\n[data-lp-sec] { }\\n@import url(…);  /* cuidado com import externos */`}
          />
        </div>
      </div>
      </Panel>
      <Separator
        id="lp-sep-1"
        title="Arrastar para redimensionar"
        className="group relative flex w-[10px] max-w-[14px] shrink-0 cursor-col-resize items-center justify-center border-l border-r border-border/50 bg-muted/40 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] transition-colors hover:bg-muted/70 data-[active]:border-primary/30 data-[active]:bg-primary/5"
      >
        <GripVertical
          className="pointer-events-none h-4 w-4 shrink-0 text-muted-foreground/45 group-hover:text-muted-foreground/70"
          aria-hidden
        />
      </Separator>
      <Panel
        className="!min-w-0 min-w-0 overflow-hidden"
        id="lp-canvas"
        defaultSize="48%"
        minSize="32%"
        maxSize="70%"
        groupResizeBehavior="preserve-relative-size"
      >
        <div className="flex h-full min-h-0 min-w-0 flex-col overflow-auto border-r border-border/80 bg-gradient-to-b from-background to-muted/5 p-3">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onSectionDrag}>
          <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
            <div className="mx-auto max-w-3xl space-y-3">
              {doc.sections.length === 0 && (
                <p className="text-center text-sm text-muted-foreground">Sem secções. Use «Nova secção» ou adicione um widget.</p>
              )}
              {doc.sections.map((section, sIdx) => {
                const secUi: LandingSectionUi = (section.settings.ui as LandingSectionUi | undefined) ?? {};
                const marginTopPx = Number(secUi.marginTop ?? 0);
                return (
                  <Fragment key={section.id}>
                    {sIdx > 0 && (
                      <SectionGapResizer
                        marginTopPx={marginTopPx}
                        onDrag={(next) => setSectionMarginTop(sIdx, next)}
                        sectionLabel={`Secção ${sIdx + 1}`}
                      />
                    )}
                <SectionSortItem
                  section={section}
                  index={sIdx}
                  selected={selectedId === section.id}
                  onSelect={setSelectedId}
                >
                  {section.children.length === 0 && (
                    <p className="p-2 text-center text-xs text-muted-foreground">Vazio — escolha um widget à esquerda.</p>
                  )}
                  {section.children.map((w, wIdx) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setSelectedId(w.id)}
                      className={cn(
                        "mb-1 flex w-full items-start justify-between gap-2 rounded border bg-background/80 p-2 text-left text-xs",
                        selectedId === w.id && "ring-1 ring-primary",
                      )}
                    >
                      <div className="min-w-0">
                        <span className="font-medium">{landingWidgetLabel(w.type)}</span>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {w.type === "hero" && String(w.settings.title ?? "")}
                          {w.type === "heading" && String(w.settings.text ?? "")}
                          {w.type === "text" && String((w.settings.body as string)?.slice(0, 50) ?? "")}
                          {w.type === "video" && String(w.settings.url ?? "")}
                          {w.type === "accordion" && String((w.settings as { items?: { title: string }[] }).items?.[0]?.title ?? "FAQ")}
                          {w.type === "testimonial" && String((w.settings as { author?: string }).author ?? "")}
                          {w.type === "embed" && String((w.settings as { src?: string }).src ?? "").slice(0, 40)}
                          {w.type === "columns" && `${(w.settings as { columnCount?: number }).columnCount ?? 2} col.`}
                          {w.type === "gallery" && `${((w.settings as { images?: unknown[] }).images ?? []).length} fotos`}
                          {w.type === "form" && String((w.settings as { heading?: string }).heading ?? "")}
                          {w.type === "countdown" && String((w.settings as { headline?: string }).headline ?? "Contagem")}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-0.5">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            applyDoc({
                              ...doc,
                              sections: setAt(doc.sections, sIdx, moveWidgetInSection(section, wIdx, -1)),
                            });
                          }}
                          aria-label="Mover acima"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            applyDoc({
                              ...doc,
                              sections: setAt(doc.sections, sIdx, moveWidgetInSection(section, wIdx, 1)),
                            });
                          }}
                          aria-label="Mover abaixo"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicateWidget(sIdx, wIdx);
                          }}
                          aria-label="Duplicar"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            applyDoc({
                              ...doc,
                              sections: setAt(
                                doc.sections,
                                sIdx,
                                deleteWidgetFromSection(section, wIdx),
                              ),
                            });
                          }}
                          aria-label="Apagar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </button>
                  ))}
                </SectionSortItem>
                  </Fragment>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
        </div>
      </Panel>
      <Separator
        id="lp-sep-2"
        title="Arrastar para redimensionar"
        className="group relative flex w-[10px] max-w-[14px] shrink-0 cursor-col-resize items-center justify-center border-l border-r border-border/50 bg-muted/40 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] transition-colors hover:bg-muted/70 data-[active]:border-primary/30 data-[active]:bg-primary/5"
      >
        <GripVertical
          className="pointer-events-none h-4 w-4 shrink-0 text-muted-foreground/45 group-hover:text-muted-foreground/70"
          aria-hidden
        />
      </Separator>
      <Panel
        className="!min-w-0 min-w-0 overflow-hidden"
        id="lp-inspector"
        defaultSize="30%"
        minSize="20%"
        maxSize="45%"
        groupResizeBehavior="preserve-relative-size"
      >
        <div className="flex h-full min-h-0 min-w-0 flex-col border-l border-border/50 bg-gradient-to-b from-card/90 to-muted/20 p-0 shadow-sm">
        <div className="shrink-0 space-y-1.5 border-b border-border/60 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Como editar</p>
          <p className="text-[11px] leading-relaxed text-foreground/90">
            1) Clique numa <strong>secção</strong> ou num <strong>bloco</strong> na <strong>lista do meio</strong>,{" "}
            <strong>ou clique no bloco na pré-visualização</strong> abaixo. 2) Altere títulos e textos no painel
            <strong> «Estilos (widget)»</strong> (role para cima, se necessário). 3) Use <strong>Guardar</strong> no
            topo da página.
          </p>
        </div>
        <p className="shrink-0 px-3 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Estilos (widget / secção)
        </p>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          <LandingInspector selectedId={selectedId} doc={doc} onChangeDoc={applyDoc} />
        </div>
        <p className="shrink-0 border-t border-border/60 px-3 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Pré-visualização (clique num bloco para o editar)
        </p>
        <div className="max-h-[min(16rem,40vh)] shrink-0 overflow-y-auto border-t border-border/40 px-2 pb-3 pt-1">
          <div className="scale-[0.9] origin-top rounded border border-border bg-background p-1 shadow-sm">
            <LandingRenderer
              doc={doc}
              theme={theme}
              editor={{ selectedId, onSelect: setSelectedId }}
            />
          </div>
        </div>
        </div>
      </Panel>
    </Group>
    </div>
    <Dialog open={importJsonOpen} onOpenChange={setImportJsonOpen}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar conteúdo a partir de ficheiro de texto</DialogTitle>
          <DialogDescription>
            Cole o texto de um exporto (formato conhecido pela app) ou a estrutura completa da página. Isto
            <strong> substitui</strong> tudo o que editou abaixo. Depois use <strong>Guardar</strong> no topo para
            guardar no servidor. Se tiver dúvidas, peça a quem lhe forneceu o ficheiro.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          className="min-h-52 font-mono text-xs"
          value={importJsonText}
          onChange={(e) => setImportJsonText(e.target.value)}
          placeholder='{"version":1,"sections":[...]}'
          spellCheck={false}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setImportJsonOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={applyJsonImport}>
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
