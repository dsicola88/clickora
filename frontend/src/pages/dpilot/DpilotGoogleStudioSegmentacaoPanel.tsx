/**
 * Segmentação no estúdio: Localizações | Idiomas | Dispositivos | Idades.
 * Só mostra / grava o que o afiliado define ou o que veio da Google — sem inventar lances.
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  GoogleAdsCountriesSelect,
  GoogleAdsLanguagesSelect,
} from "@/components/dpilot/GoogleAdsTargetingSelect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  GOOGLE_ADS_COUNTRY_OPTIONS,
  GOOGLE_ADS_LANGUAGE_OPTIONS,
  countryLabel,
} from "@/lib/googleAdsTargeting";
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

type DeviceKey = "MOBILE" | "DESKTOP" | "TABLET";
/** null = sem dado guardado (não inventar 0%). */
type DeviceBids = Partial<Record<DeviceKey, number | null>>;

function parseGeoList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim().toUpperCase()).filter(Boolean);
}

function parseLangList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim().toLowerCase()).filter(Boolean);
}

function readTargeting(bidding: unknown): {
  geo_exclude: string[];
  device_bids: DeviceBids;
  age_exclude: string[];
} {
  if (!bidding || typeof bidding !== "object" || Array.isArray(bidding)) {
    return { geo_exclude: [], device_bids: {}, age_exclude: [] };
  }
  const t = (bidding as { targeting?: unknown }).targeting;
  if (!t || typeof t !== "object" || Array.isArray(t)) {
    return { geo_exclude: [], device_bids: {}, age_exclude: [] };
  }
  const o = t as Record<string, unknown>;
  const device_bids: DeviceBids = {};
  if (o.device_bids && typeof o.device_bids === "object" && !Array.isArray(o.device_bids)) {
    const d = o.device_bids as Record<string, unknown>;
    for (const k of ["MOBILE", "DESKTOP", "TABLET"] as const) {
      if (d[k] == null || d[k] === "") continue;
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
    language_targets?: unknown;
    bidding_config?: unknown;
  };
  onSaved: () => void;
}) {
  const initial = useMemo(() => {
    const t = readTargeting(campaign.bidding_config);
    return {
      include: parseGeoList(campaign.geo_targets),
      languages: parseLangList(campaign.language_targets),
      exclude: t.geo_exclude,
      devices: t.device_bids,
      ages: t.age_exclude,
    };
  }, [campaign.bidding_config, campaign.geo_targets, campaign.language_targets]);

  const [include, setInclude] = useState<string[]>(initial.include);
  const [exclude, setExclude] = useState<string[]>(initial.exclude);
  const [languages, setLanguages] = useState<string[]>(initial.languages);
  const [devices, setDevices] = useState<DeviceBids>(initial.devices);
  const [ages, setAges] = useState<string[]>(initial.ages);
  const [busy, setBusy] = useState<"geo" | "lang" | "device" | "age" | null>(null);

  useEffect(() => {
    setInclude(initial.include);
    setExclude(initial.exclude);
    setLanguages(initial.languages);
    setDevices(initial.devices);
    setAges(initial.ages);
  }, [initial]);

  const countryOpts = useMemo(() => GOOGLE_ADS_COUNTRY_OPTIONS, []);
  const langOpts = useMemo(() => GOOGLE_ADS_LANGUAGE_OPTIONS, []);

  const runStudio = async (body: Record<string, unknown>, kind: "geo" | "lang" | "device" | "age") => {
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
          toast.error("Falhou na rede — veja Aprovações.");
          return;
        }
        if (st === "applied") toast.success("Aplicado na Google.");
        else toast.message("Enviado para Aprovações.");
      } else {
        const { error } = await paidAdsService.patchGoogleCampaignDraft(projectId, campaignId, body);
        if (error) {
          toast.error(toastGoogleAdsError(error));
          return;
        }
        toast.success("Guardado no rascunho.");
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

  const saveLanguages = () => {
    if (languages.length === 0) {
      toast.error("Escolha pelo menos um idioma.");
      return;
    }
    if (published) {
      void runStudio({ action: "sync_campaign_language_targets", languages }, "lang");
    } else {
      void runStudio({ language_targets: languages }, "lang");
    }
  };

  const saveDevices = () => {
    const payload: Partial<Record<DeviceKey, number>> = {};
    for (const k of ["MOBILE", "DESKTOP", "TABLET"] as const) {
      const v = devices[k];
      if (v != null && Number.isFinite(v)) payload[k] = v;
    }
    if (Object.keys(payload).length === 0) {
      toast.message("Nada a gravar — defina um ajuste ou exclusão por dispositivo.");
      return;
    }
    if (published) {
      void runStudio({ action: "sync_campaign_device_bids", device_bids: payload }, "device");
    } else {
      void runStudio({ device_bids: payload }, "device");
    }
  };

  const saveAges = () => {
    if (published) {
      void runStudio({ action: "sync_campaign_age_exclusions", age_exclude: ages }, "age");
    } else {
      void runStudio({ age_exclude: ages }, "age");
    }
  };

  const setDevice = (key: DeviceKey, raw: string) => {
    if (raw.trim() === "") {
      setDevices((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }
    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n)) return;
    setDevices((prev) => ({
      ...prev,
      [key]: Math.max(-100, Math.min(900, Math.round(n))),
    }));
  };

  const toggleAge = (code: string, on: boolean) => {
    setAges((prev) => (on ? [...new Set([...prev, code])] : prev.filter((x) => x !== code)));
  };

  const deviceRow = (key: DeviceKey, label: string) => {
    const val = devices[key];
    const has = val != null;
    return (
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200/80 bg-slate-50/50 px-3 py-2.5">
        <div className="min-w-[7rem] flex-1 space-y-1">
          <Label className="text-xs font-medium text-slate-800">{label}</Label>
          <p className="text-[11px] text-slate-500">
            {!has
              ? "Sem ajuste guardado (padrão da conta Google)"
              : val! <= -100
                ? "Excluído"
                : val === 0
                  ? "Sem ajuste (0%)"
                  : `${val! > 0 ? "+" : ""}${val}% no lance`}
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`dev-${key}`} className="text-[10px] text-slate-500">
            Ajuste %
          </Label>
          <Input
            id={`dev-${key}`}
            className="w-24"
            inputMode="numeric"
            placeholder="—"
            value={has ? String(val) : ""}
            onChange={(e) => setDevice(key, e.target.value)}
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant={has && val! <= -100 ? "secondary" : "outline"}
          onClick={() => setDevices((p) => ({ ...p, [key]: -100 }))}
        >
          Excluir
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() =>
            setDevices((p) => {
              const n = { ...p };
              delete n[key];
              return n;
            })
          }
        >
          Limpar
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <p className="text-xs leading-relaxed text-slate-500">
        Países e idiomas vêm da Google ao importar; pode editar e aplicar aqui. Se estiver vazio, em Campanhas use
        «Re-sincronizar e importar».
      </p>

      <Card className="border-slate-200/90 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-slate-900">Localizações</CardTitle>
          <CardDescription className="text-xs">
            Onde anuncia e o que exclui
            {initial.include.length > 0 ? (
              <>
                {" "}
                · Agora:{" "}
                <span className="font-medium text-slate-700">
                  {initial.include.map((c) => countryLabel(c)).join(", ")}
                </span>
              </>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <GoogleAdsCountriesSelect
            options={countryOpts}
            value={include}
            onChange={setInclude}
            label="Países onde anuncia"
            hint="Mínimo 1 — vem da Google ou do que gravar aqui."
            searchPlaceholder="Pesquisar país…"
            emptyText="Sem países"
            max={30}
          />
          <GoogleAdsCountriesSelect
            options={countryOpts}
            value={exclude}
            onChange={setExclude}
            label="Países a excluir"
            hint="Opcional."
            searchPlaceholder="Pesquisar país a excluir…"
            emptyText="Sem exclusões"
            max={30}
          />
          <div className="flex justify-end">
            <Button type="button" disabled={busy === "geo"} onClick={saveGeo}>
              {busy === "geo" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {published ? "Aplicar localizações" : "Guardar no rascunho"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200/90 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-slate-900">Idiomas</CardTitle>
          <CardDescription className="text-xs">
            Idiomas dos anúncios na Google. Vazio após import = re-sincronize a estrutura da campanha.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <GoogleAdsLanguagesSelect
            options={langOpts}
            value={languages}
            onChange={setLanguages}
            label="Idiomas da campanha"
            hint="Mínimo 1."
            searchPlaceholder="Pesquisar idioma…"
            emptyText="Sem idiomas"
            max={10}
          />
          <div className="flex justify-end">
            <Button type="button" disabled={busy === "lang"} onClick={saveLanguages}>
              {busy === "lang" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {published ? "Aplicar idiomas" : "Guardar no rascunho"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200/90 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-slate-900">Dispositivos</CardTitle>
          <CardDescription className="text-xs">
            Só grava o que definir. Vazio = deixa o padrão da Google (não inventamos 0%).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {deviceRow("MOBILE", "Telemóvel")}
          {deviceRow("DESKTOP", "Computador")}
          {deviceRow("TABLET", "Tablet")}
          <div className="flex justify-end pt-1">
            <Button type="button" disabled={busy === "device"} onClick={saveDevices}>
              {busy === "device" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {published ? "Aplicar dispositivos" : "Guardar no rascunho"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200/90 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-slate-900">Idades</CardTitle>
          <CardDescription className="text-xs">
            Marque só o que quer excluir. Lista vazia = sem exclusões guardadas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {AGE_OPTIONS.map((opt) => {
              const on = ages.includes(opt.code);
              return (
                <label
                  key={opt.code}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200/80 px-3 py-2 text-sm"
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
              {published ? "Aplicar idades" : "Guardar no rascunho"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
