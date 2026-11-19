/**
 * Segmentação no estúdio: Localizações | Dispositivos | Idades — cada bloco separado.
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { GoogleAdsCountriesSelect } from "@/components/dpilot/GoogleAdsTargetingSelect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GOOGLE_ADS_COUNTRY_OPTIONS } from "@/lib/googleAdsTargeting";
import { toastGoogleAdsError } from "@/lib/paidAdsUi";
import { paidAdsService } from "@/services/paidAdsService";
import { toast } from "sonner";

const AGE_OPTIONS = [
  { code: "AGE_RANGE_18_24", label: "18–24 anos" },
  { code: "AGE_RANGE_25_34", label: "25–34 anos" },
  { code: "AGE_RANGE_35_44", label: "35–44 anos" },
  { code: "AGE_RANGE_45_54", label: "45–54 anos" },
  { code: "AGE_RANGE_55_64", label: "55–64 anos" },
  { code: "AGE_RANGE_65_UP", label: "65+ anos" },
  { code: "AGE_RANGE_UNDETERMINED", label: "Idade desconhecida" },
] as const;

type DeviceBids = { MOBILE: number; DESKTOP: number; TABLET: number };

function parseGeoList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim().toUpperCase()).filter(Boolean);
}

function readTargeting(bidding: unknown): {
  geo_exclude: string[];
  device_bids: DeviceBids;
  age_exclude: string[];
} {
  const empty: DeviceBids = { MOBILE: 0, DESKTOP: 0, TABLET: 0 };
  if (!bidding || typeof bidding !== "object" || Array.isArray(bidding)) {
    return { geo_exclude: [], device_bids: empty, age_exclude: [] };
  }
  const t = (bidding as { targeting?: unknown }).targeting;
  if (!t || typeof t !== "object" || Array.isArray(t)) {
    return { geo_exclude: [], device_bids: empty, age_exclude: [] };
  }
  const o = t as Record<string, unknown>;
  const device_bids = { ...empty };
  if (o.device_bids && typeof o.device_bids === "object" && !Array.isArray(o.device_bids)) {
    const d = o.device_bids as Record<string, unknown>;
    for (const k of ["MOBILE", "DESKTOP", "TABLET"] as const) {
      const n = Number(d[k]);
      if (Number.isFinite(n)) device_bids[k] = Math.max(-100, Math.min(900, Math.round(n)));
    }
  }
  return {
    geo_exclude: parseGeoList(o.geo_exclude),
    device_bids,
    age_exclude: Array.isArray(o.age_exclude)
      ? o.age_exclude.map((x) => String(x).trim()).filter(Boolean)
      : [],
  };
}

export function DpilotGoogleStudioSegmentacaoPanel({
  projectId,
  campaignId,
  published,
  campaign,
  onSaved,
}: {
  projectId: string;
  campaignId: string;
  published: boolean;
  campaign: {
    geo_targets?: unknown;
    bidding_config?: unknown;
  };
  onSaved: () => void;
}) {
  const initial = useMemo(() => {
    const t = readTargeting(campaign.bidding_config);
    return {
      include: parseGeoList(campaign.geo_targets),
      exclude: t.geo_exclude,
      devices: t.device_bids,
      ages: t.age_exclude,
    };
  }, [campaign.bidding_config, campaign.geo_targets]);

  const [include, setInclude] = useState<string[]>(initial.include);
  const [exclude, setExclude] = useState<string[]>(initial.exclude);
  const [devices, setDevices] = useState<DeviceBids>(initial.devices);
  const [ages, setAges] = useState<string[]>(initial.ages);
  const [busy, setBusy] = useState<"geo" | "device" | "age" | null>(null);

  useEffect(() => {
    setInclude(initial.include);
    setExclude(initial.exclude);
    setDevices(initial.devices);
    setAges(initial.ages);
  }, [initial]);

  const countryOpts = useMemo(() => GOOGLE_ADS_COUNTRY_OPTIONS, []);

  const runStudio = async (body: Record<string, unknown>, kind: "geo" | "device" | "age") => {
    setBusy(kind);
    try {
      if (published) {
        const { data, error } = await paidAdsService.postGoogleStudioActions(projectId, campaignId, body);
        if (error) {
          toast.error(toastGoogleAdsError(error));
          return;
        }
        const st = data?.change_request?.status;
        if (st === "failed") {
          toast.error("Falhou na rede — veja Aprovações para o detalhe.");
          return;
        }
        toast.success(
          st === "applied" ? "Aplicado na Google." : "Enviado para Aprovações (ou Autopilot).",
        );
      } else {
        const { error } = await paidAdsService.patchGoogleCampaignDraft(projectId, campaignId, body);
        if (error) {
          toast.error(toastGoogleAdsError(error));
          return;
        }
        toast.success("Guardado no rascunho — aplica na primeira publicação.");
      }
      onSaved();
    } finally {
      setBusy(null);
    }
  };

  const saveGeo = () => {
    if (include.length === 0) {
      toast.error("Escolha pelo menos um país onde quer anunciar.");
      return;
    }
    const cleanExclude = exclude.filter((c) => !include.includes(c));
    if (published) {
      void runStudio(
        { action: "sync_campaign_geo_targets", include, exclude: cleanExclude },
        "geo",
      );
    } else {
      void runStudio({ geo_targets: include, geo_exclude: cleanExclude }, "geo");
    }
  };

  const saveDevices = () => {
    if (published) {
      void runStudio({ action: "sync_campaign_device_bids", device_bids: devices }, "device");
    } else {
      void runStudio({ device_bids: devices }, "device");
    }
  };

  const saveAges = () => {
    if (published) {
      void runStudio({ action: "sync_campaign_age_exclusions", age_exclude: ages }, "age");
    } else {
      void runStudio({ age_exclude: ages }, "age");
    }
  };

  const setDevice = (key: keyof DeviceBids, raw: string) => {
    const n = Number(raw.replace(",", "."));
    setDevices((prev) => ({
      ...prev,
      [key]: Number.isFinite(n) ? Math.max(-100, Math.min(900, Math.round(n))) : prev[key],
    }));
  };

  const toggleAge = (code: string, on: boolean) => {
    setAges((prev) => (on ? [...new Set([...prev, code])] : prev.filter((x) => x !== code)));
  };

  const deviceRow = (key: keyof DeviceBids, label: string) => (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
      <div className="min-w-[7rem] flex-1 space-y-1">
        <Label className="text-xs">{label}</Label>
        <p className="text-[11px] text-muted-foreground">
          {devices[key] <= -100
            ? "Excluído (−100%)"
            : devices[key] === 0
              ? "Sem ajuste"
              : `${devices[key] > 0 ? "+" : ""}${devices[key]}% no lance`}
        </p>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`dev-${key}`} className="text-[10px] text-muted-foreground">
          Ajuste %
        </Label>
        <Input
          id={`dev-${key}`}
          className="w-24"
          inputMode="numeric"
          value={String(devices[key])}
          onChange={(e) => setDevice(key, e.target.value)}
        />
      </div>
      <Button
        type="button"
        size="sm"
        variant={devices[key] <= -100 ? "secondary" : "outline"}
        onClick={() => setDevices((p) => ({ ...p, [key]: -100 }))}
      >
        Excluir
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setDevices((p) => ({ ...p, [key]: 0 }))}
      >
        Reset
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <Card className="border-muted-foreground/15 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Localizações</CardTitle>
          <CardDescription>
            Onde quer anunciar e países a excluir. Não mistura com dispositivos nem idades.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <GoogleAdsCountriesSelect
            options={countryOpts}
            value={include}
            onChange={setInclude}
            label="Países onde anuncia"
            hint="Pelo menos um."
            searchPlaceholder="Pesquisar país…"
            emptyText="Sem países"
            max={30}
          />
          <GoogleAdsCountriesSelect
            options={countryOpts}
            value={exclude}
            onChange={setExclude}
            label="Países a excluir"
            hint="Opcional — quem está nestes mercados não vê o anúncio."
            searchPlaceholder="Pesquisar país a excluir…"
            emptyText="Sem exclusões"
            max={30}
          />
          <div className="flex justify-end">
            <Button type="button" disabled={busy === "geo"} onClick={saveGeo}>
              {busy === "geo" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {published ? "Aplicar localizações" : "Guardar localizações no rascunho"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-muted-foreground/15 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Dispositivos</CardTitle>
          <CardDescription>
            Ajuste o lance por telemóvel, computador ou tablet. −100% = excluir esse dispositivo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {deviceRow("MOBILE", "Telemóvel")}
          {deviceRow("DESKTOP", "Computador")}
          {deviceRow("TABLET", "Tablet")}
          <div className="flex justify-end pt-1">
            <Button type="button" disabled={busy === "device"} onClick={saveDevices}>
              {busy === "device" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {published ? "Aplicar dispositivos" : "Guardar dispositivos no rascunho"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-muted-foreground/15 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Idades</CardTitle>
          <CardDescription>
            Marque as faixas que quer excluir. As outras continuam a ver o anúncio.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {AGE_OPTIONS.map((opt) => {
              const on = ages.includes(opt.code);
              return (
                <label
                  key={opt.code}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm"
                >
                  <Checkbox
                    checked={on}
                    onCheckedChange={(v) => toggleAge(opt.code, v === true)}
                    aria-label={`Excluir ${opt.label}`}
                  />
                  <span>Excluir {opt.label}</span>
                </label>
              );
            })}
          </div>
          <div className="flex justify-end">
            <Button type="button" disabled={busy === "age"} onClick={saveAges}>
              {busy === "age" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {published ? "Aplicar exclusões de idade" : "Guardar idades no rascunho"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
