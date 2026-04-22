import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  Check,
  Plus,
  Pencil,
  Trash2,
  Shuffle,
  ExternalLink,
  Loader2,
  Trophy,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/PageHeader";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { getApiBaseUrl } from "@/lib/apiOrigin";
import { useAuth } from "@/contexts/AuthContext";
import { presellService } from "@/services/presellService";
import {
  trafficRotatorsService,
  type CreateTrafficRotatorBody,
  type TrafficRotatorArmInput,
  type TrafficRotatorDto,
  type TrafficRotatorMode,
  type RotatorDeviceRule,
} from "@/services/trafficRotatorsService";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 52);
}

function parseIsoList(raw: string): string[] | null {
  const parts = raw
    .split(/[,;\s]+/)
    .map((x) => x.trim().toUpperCase())
    .filter((x) => /^[A-Z]{2}$/.test(x));
  return parts.length ? [...new Set(parts)] : null;
}

const MODE_LABELS: Record<TrafficRotatorMode, string> = {
  random: "Aleatório — reparte igualmente pelos destinos elegíveis",
  weighted: "Ponderado — probabilidade por peso (A/B; peso 0 = braço desactivado)",
  sequential: "Sequencial — round-robin entre destinos elegíveis",
  fill_order: "Preenchimento — enche o 1.º até ao limite, depois o seguinte",
};

function RotatorAbPanel({ rotatorId }: { rotatorId: string }) {
  const [open, setOpen] = useState(false);
  const [lookback, setLookback] = useState(30);
  const [metric, setMetric] = useState<"conversion_rate" | "revenue">("conversion_rate");
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["traffic-rotator-ab-stats", rotatorId, lookback] as const,
    queryFn: async () => {
      const { data: d, error } = await trafficRotatorsService.abStats(rotatorId, { lookback_days: lookback });
      if (error) throw new Error(error);
      if (!d) throw new Error("Resposta vazia");
      return d;
    },
    enabled: open,
  });

  const promoteMut = useMutation({
    mutationFn: async () => {
      const { data: d, error } = await trafficRotatorsService.promoteWinner(rotatorId, {
        metric,
        lookback_days: lookback,
        min_clicks_per_arm: 0,
      });
      if (error) throw new Error(error);
      return d;
    },
    onSuccess: (payload) => {
      qc.invalidateQueries({ queryKey: ["traffic-rotators"] });
      qc.invalidateQueries({ queryKey: ["traffic-rotator-ab-stats", rotatorId] });
      const label = payload?.winner_label?.trim() || payload?.winner_arm_id?.slice(0, 8) || "—";
      toast.success(`Vencedor: ${label}. Tráfego concentrado neste braço (peso 100; restantes 0).`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-t border-border/50 pt-3 mt-3">
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-between h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <span className="inline-flex items-center gap-2">
            <Trophy className="h-3.5 w-3.5 opacity-70" />
            Teste A/B — estatísticas e promover vencedor
          </span>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-2">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Dias de histórico</Label>
            <Input
              type="number"
              min={1}
              max={730}
              className="h-8 w-24 text-xs"
              value={lookback}
              onChange={(e) => setLookback(Math.max(1, Math.min(730, parseInt(e.target.value, 10) || 30)))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Métrica do vencedor</Label>
            <Select value={metric} onValueChange={(v) => setMetric(v as "conversion_rate" | "revenue")}>
              <SelectTrigger className="h-8 w-[200px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="conversion_rate">Taxa de conversão (conversões / cliques)</SelectItem>
                <SelectItem value="revenue">Receita (soma de conversões)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 text-xs"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Actualizar"}
          </Button>
        </div>
        {isLoading ? (
          <p className="text-xs text-muted-foreground">A carregar…</p>
        ) : isError ? (
          <p className="text-xs text-destructive">Não foi possível carregar estatísticas.</p>
        ) : data ? (
          <>
            <p className="text-[11px] text-muted-foreground">
              Desde {new Date(data.lookback_from).toLocaleString("pt-PT", { dateStyle: "short" })} · cliques
              atribuídos a braço (excl. recurso)
            </p>
            <div className="overflow-x-auto rounded-md border border-border/60 text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-muted/30 text-muted-foreground">
                    <th className="py-1.5 px-2 font-medium">Braço</th>
                    <th className="py-1.5 px-2 font-medium">Peso</th>
                    <th className="py-1.5 px-2 font-medium">Cliques</th>
                    <th className="py-1.5 px-2 font-medium">Conv.</th>
                    <th className="py-1.5 px-2 font-medium">Tx</th>
                    <th className="py-1.5 px-2 font-medium">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {data.arms.map((row) => (
                    <tr key={row.arm_id} className="border-t border-border/50">
                      <td className="py-1.5 px-2 max-w-[140px] truncate" title={row.label || row.arm_id}>
                        {row.label || "—"}
                      </td>
                      <td className="py-1.5 px-2 tabular-nums">{row.current_weight}</td>
                      <td className="py-1.5 px-2 tabular-nums">{row.clicks.toLocaleString("pt-PT")}</td>
                      <td className="py-1.5 px-2 tabular-nums">{row.conversions.toLocaleString("pt-PT")}</td>
                      <td className="py-1.5 px-2 tabular-nums">
                        {(row.conversion_rate * 100).toLocaleString("pt-PT", { maximumFractionDigits: 2 })}%
                      </td>
                      <td className="py-1.5 px-2 tabular-nums">{row.revenue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <strong className="text-foreground/90">Promover vencedor</strong> ajusta o modo para ponderado, define o
              braço vencedor com peso 100 e os outros com 0 (sem tráfego). Pode editar de novo no diálogo do rotador.
            </p>
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs gap-1.5"
              disabled={promoteMut.isPending}
              onClick={() => {
                if (
                  !confirm(
                    "Concentrar 100% do tráfego no braço vencedor (segundo a métrica e o período escolhidos)?",
                  )
                ) {
                  return;
                }
                promoteMut.mutate();
              }}
            >
              {promoteMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trophy className="h-3.5 w-3.5" />}
              Aplicar vencedor
            </Button>
          </>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}

type ArmForm = {
  destination_url: string;
  label: string;
  order_index: number;
  weight: string;
  max_clicks: string;
  countries_allow: string;
  countries_deny: string;
  device_rule: RotatorDeviceRule;
};

function emptyArm(i: number): ArmForm {
  return {
    destination_url: "",
    label: "",
    order_index: i,
    weight: "100",
    max_clicks: "",
    countries_allow: "",
    countries_deny: "",
    device_rule: "all",
  };
}

function dtoToArms(r: TrafficRotatorDto): ArmForm[] {
  return r.arms.map((a, i) => ({
    destination_url: a.destination_url,
    label: a.label ?? "",
    order_index: a.order_index,
    weight: String(a.weight),
    max_clicks: a.max_clicks != null ? String(a.max_clicks) : "",
    countries_allow: a.countries_allow?.join(", ") ?? "",
    countries_deny: a.countries_deny?.join(", ") ?? "",
    device_rule: a.device_rule,
  }));
}

function armsToPayload(arms: ArmForm[]): TrafficRotatorArmInput[] | null {
  const out: TrafficRotatorArmInput[] = [];
  arms.forEach((a, i) => {
    const url = a.destination_url.trim();
    if (!url) return;
    const wRaw = a.weight.trim();
    const wParsed = wRaw === "" ? 100 : parseInt(wRaw, 10);
    const w = Number.isNaN(wParsed) ? 100 : Math.max(0, Math.min(100_000, wParsed));
    const maxRaw = a.max_clicks.trim();
    const maxClicks = maxRaw ? Math.max(1, parseInt(maxRaw, 10) || 0) : null;
    out.push({
      destination_url: url,
      label: a.label.trim() || null,
      order_index: i,
      weight: w,
      max_clicks: maxClicks,
      countries_allow: parseIsoList(a.countries_allow),
      countries_deny: parseIsoList(a.countries_deny),
      device_rule: a.device_rule,
    });
  });
  return out.length ? out : null;
}

export default function Rotadores() {
  const { user } = useAuth();
  const tenantKey = user?.id ?? "";
  const qc = useQueryClient();
  const apiBase = useMemo(() => getApiBaseUrl(), []);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TrafficRotatorDto | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [mode, setMode] = useState<TrafficRotatorMode>("weighted");
  const [backupUrl, setBackupUrl] = useState("");
  const [contextPresellId, setContextPresellId] = useState("");
  const [accessCode, setAccessCode] = useState("");
  /** Só em edição: remover código guardado sem substituir. */
  const [stripAccessCode, setStripAccessCode] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [arms, setArms] = useState<ArmForm[]>([emptyArm(0), emptyArm(1)]);

  const { data: presells = [] } = useQuery({
    queryKey: ["presells-rotadores", tenantKey],
    queryFn: async () => {
      const { data, error } = await presellService.getAll();
      if (error) throw new Error(error);
      return data ?? [];
    },
    enabled: !!tenantKey,
  });

  const publishedPresells = presells.filter((p) => p.status === "published");

  const { data: rotators = [], isLoading } = useQuery({
    queryKey: ["traffic-rotators", tenantKey],
    queryFn: async () => {
      const { data, error } = await trafficRotatorsService.list();
      if (error) throw new Error(error);
      return data ?? [];
    },
    enabled: !!tenantKey,
  });

  const resetForm = () => {
    setEditing(null);
    setName("");
    setSlug("");
    setSlugManual(false);
    setMode("weighted");
    setBackupUrl("");
    setContextPresellId("");
    setAccessCode("");
    setStripAccessCode(false);
    setIsActive(true);
    setArms([emptyArm(0), emptyArm(1)]);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (r: TrafficRotatorDto) => {
    setEditing(r);
    setName(r.name);
    setSlug(r.slug);
    setSlugManual(true);
    setMode(r.mode);
    setBackupUrl(r.backup_url ?? "");
    setContextPresellId(r.context_presell_id);
    setAccessCode("");
    setStripAccessCode(false);
    setIsActive(r.is_active);
    setArms(dtoToArms(r).length ? dtoToArms(r) : [emptyArm(0)]);
    setDialogOpen(true);
  };

  const createMut = useMutation({
    mutationFn: async (body: CreateTrafficRotatorBody) => {
      const { data, error } = await trafficRotatorsService.create(body);
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["traffic-rotators"] });
      toast.success("Rotador criado.");
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Partial<CreateTrafficRotatorBody> & { access_code?: string } }) => {
      const { data, error } = await trafficRotatorsService.update(id, body);
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["traffic-rotators"] });
      toast.success("Rotador actualizado.");
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await trafficRotatorsService.remove(id);
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["traffic-rotators"] });
      toast.success("Rotador removido.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleNameChange = (v: string) => {
    setName(v);
    if (!slugManual && !editing) setSlug(slugify(v));
  };

  const submit = () => {
    const armPayload = armsToPayload(arms);
    if (!name.trim() || !slug.trim() || !contextPresellId || !armPayload) {
      toast.error("Preencha nome, slug, presell de contexto e pelo menos um URL de destino válido.");
      return;
    }

    const base: CreateTrafficRotatorBody = {
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      mode,
      backup_url: backupUrl.trim() || null,
      context_presell_id: contextPresellId,
      access_code: accessCode.trim() || null,
      is_active: isActive,
      arms: armPayload,
    };

    if (editing) {
      const patch: Partial<CreateTrafficRotatorBody> & { access_code?: string } = {
        name: base.name,
        slug: base.slug,
        mode: base.mode,
        backup_url: base.backup_url,
        context_presell_id: base.context_presell_id,
        is_active: base.is_active,
        arms: base.arms,
      };
      if (stripAccessCode) patch.access_code = "";
      else if (accessCode.trim()) patch.access_code = accessCode.trim();
      updateMut.mutate({ id: editing.id, body: patch });
    } else {
      createMut.mutate(base);
    }
  };

  const copyUrl = async (url: string, id: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success("URL copiado.");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const busy = createMut.isPending || updateMut.isPending;

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        title="Rotadores de tráfego"
        description="Um link público distribui por vários destinos: A/B ponderado, geo (permitir/excluir países), mobile vs desktop por braço, URL de recurso. sub1–sub3 e sufixo de caminho no URL (ex.: /rot/UUID/fb/campanha) segmentam nos relatórios. A presell de contexto liga conversões por postback."
        actions={
          <Button
            type="button"
            className="gap-2 gradient-primary border-0 text-primary-foreground hover:opacity-90"
            onClick={openCreate}
          >
            <Plus className="h-4 w-4" />
            Novo rotador
          </Button>
        }
      />

      <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-sm text-muted-foreground mb-6 space-y-2">
        <p>
          <strong className="text-foreground/90">URL público:</strong>{" "}
          <span className="font-mono text-xs">{apiBase}/track/rot/`{"{"}uuid{"}"}`</span> — parâmetros como no redirect
          (gclid, utm_*, <span className="text-foreground/85">sub1–sub3</span>
          ). Opcional: <span className="font-mono text-xs">…/rot/UUID/fonte/campanha/criativo</span> para drill-down no
          caminho. Código: <span className="font-mono text-xs">?access_code=…</span>
        </p>
        <p>
          <strong className="text-foreground/90">A/B:</strong> modo <em>ponderado</em> + tabela abaixo em cada cartão;{" "}
          <strong className="text-foreground/90">Promover vencedor</strong> concentra tráfego no melhor braço (taxa de
          conversão ou receita).
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : rotators.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
          <Shuffle className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>Ainda não há rotadores. Crie um para testar A/B ou rotação por país/dispositivo.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rotators.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-border/50 bg-card shadow-sm p-5 space-y-3 flex flex-col"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-foreground">{r.name}</h3>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{r.slug}</p>
                  <p className="text-xs text-muted-foreground mt-1">{MODE_LABELS[r.mode]}</p>
                </div>
                <span
                  className={cn(
                    "text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full",
                    r.is_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
                  )}
                >
                  {r.is_active ? "Activo" : "Inactivo"}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={() => copyUrl(r.public_click_url, r.id)}
                >
                  {copiedId === r.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  Copiar link
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1" asChild>
                  <a href={r.public_click_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={() => openEdit(r)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-destructive gap-1"
                  onClick={() => {
                    if (confirm("Eliminar este rotador? Os cliques já registados mantêm-se nos relatórios.")) {
                      deleteMut.mutate(r.id);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="text-xs text-muted-foreground border-t border-border/50 pt-3 space-y-1">
                {r.arms.map((a) => (
                  <div key={a.id} className="flex justify-between gap-2">
                    <span className="truncate" title={a.destination_url}>
                      {a.label || a.destination_url.slice(0, 48)}
                      {a.destination_url.length > 48 && !a.label ? "…" : ""}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {a.clicks_delivered}
                      {a.max_clicks != null ? ` / ${a.max_clicks}` : ""}
                    </span>
                  </div>
                ))}
              </div>
              <RotatorAbPanel rotatorId={r.id} />
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => !busy && setDialogOpen(o)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar rotador" : "Novo rotador"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="Campanha FB — teste A/B" />
              </div>
              <div className="space-y-2">
                <Label>Slug (único na conta)</Label>
                <Input
                  value={slug}
                  onChange={(e) => {
                    setSlugManual(true);
                    setSlug(e.target.value.toLowerCase());
                  }}
                  placeholder="campanha-fb-ab"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Modo de distribuição</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as TrafficRotatorMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(MODE_LABELS) as TrafficRotatorMode[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {MODE_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Presell de contexto (conversões / relatórios)</Label>
              <Select value={contextPresellId} onValueChange={setContextPresellId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione uma presell publicada" />
                </SelectTrigger>
                <SelectContent>
                  {publishedPresells.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title} ({p.slug})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                O postback de afiliados continua a usar o <span className="font-mono">clickora_click_id</span> deste
                clique; a presell cumpre a regra de negócio da conta.
              </p>
            </div>

            <div className="space-y-2">
              <Label>URL de recurso (opcional)</Label>
              <Input
                value={backupUrl}
                onChange={(e) => setBackupUrl(e.target.value)}
                placeholder="https://… quando nenhum braço se aplica"
              />
            </div>

            <div className="space-y-2">
              <Label>Código de acesso (opcional)</Label>
              <Input
                value={accessCode}
                onChange={(e) => {
                  setStripAccessCode(false);
                  setAccessCode(e.target.value);
                }}
                placeholder={
                  editing?.access_code_set
                    ? "Novo código (opcional) — vazio mantém o actual"
                    : "Ex.: promo2026 → ?access_code=promo2026"
                }
                disabled={stripAccessCode}
              />
              {editing?.access_code_set ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      setStripAccessCode((s) => !s);
                      setAccessCode("");
                    }}
                  >
                    {stripAccessCode ? "Cancelar remoção" : "Remover protecção do link"}
                  </Button>
                  {stripAccessCode ? (
                    <span className="text-[11px] text-amber-700 dark:text-amber-400">
                      Ao guardar, o link deixará de exigir código.
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} id="rot-active" />
              <Label htmlFor="rot-active" className="cursor-pointer">
                Rotador activo
              </Label>
            </div>

            <div className="space-y-3 border-t border-border pt-4">
              {editing ? (
                <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 rounded-md border border-amber-500/25 bg-amber-500/5 px-3 py-2">
                  Ao guardar, a lista de destinos é substituída e os contadores de cliques <strong>entregues</strong> por
                  braço voltam a zero (os cliques antigos permanecem nos relatórios).
                </p>
              ) : null}
              <div className="flex items-center justify-between">
                <Label className="text-base">Destinos (braços)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setArms((prev) => [...prev, emptyArm(prev.length)])}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Braço
                </Button>
              </div>

              {arms.map((arm, idx) => (
                <div key={idx} className="rounded-lg border border-border/60 p-3 space-y-2 bg-muted/10">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-muted-foreground">Braço {idx + 1}</span>
                    {arms.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive"
                        onClick={() => setArms((prev) => prev.filter((_, i) => i !== idx).map((a, i) => ({ ...a, order_index: i })))}
                      >
                        Remover
                      </Button>
                    ) : null}
                  </div>
                  <Input
                    placeholder="URL de destino (https://…)"
                    value={arm.destination_url}
                    onChange={(e) =>
                      setArms((prev) => prev.map((a, i) => (i === idx ? { ...a, destination_url: e.target.value } : a)))
                    }
                  />
                  <div className="grid sm:grid-cols-2 gap-2">
                    <Input
                      placeholder="Etiqueta (opcional)"
                      value={arm.label}
                      onChange={(e) =>
                        setArms((prev) => prev.map((a, i) => (i === idx ? { ...a, label: e.target.value } : a)))
                      }
                    />
                    <div className="flex gap-2">
                      <Input
                        placeholder="Peso (0 = off)"
                        className="w-24"
                        value={arm.weight}
                        onChange={(e) =>
                          setArms((prev) => prev.map((a, i) => (i === idx ? { ...a, weight: e.target.value } : a)))
                        }
                      />
                      <Input
                        placeholder="Máx. cliques"
                        className="flex-1"
                        value={arm.max_clicks}
                        onChange={(e) =>
                          setArms((prev) => prev.map((a, i) => (i === idx ? { ...a, max_clicks: e.target.value } : a)))
                        }
                      />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <Input
                      placeholder="Países permitidos (PT, ES)"
                      value={arm.countries_allow}
                      onChange={(e) =>
                        setArms((prev) => prev.map((a, i) => (i === idx ? { ...a, countries_allow: e.target.value } : a)))
                      }
                    />
                    <Input
                      placeholder="Países excluídos (US)"
                      value={arm.countries_deny}
                      onChange={(e) =>
                        setArms((prev) => prev.map((a, i) => (i === idx ? { ...a, countries_deny: e.target.value } : a)))
                      }
                    />
                  </div>
                  <Select
                    value={arm.device_rule}
                    onValueChange={(v) =>
                      setArms((prev) =>
                        prev.map((a, i) => (i === idx ? { ...a, device_rule: v as RotatorDeviceRule } : a)),
                      )
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Qualquer dispositivo</SelectItem>
                      <SelectItem value="mobile">Só móvel / tablet</SelectItem>
                      <SelectItem value="desktop">Só desktop</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="button" className="gradient-primary border-0 text-primary-foreground" onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Guardar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
