import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import type { AppLocale } from "@/i18n/types";
import type {
  DemandDeviceBreakdown,
  DemandPlannerDeviceBreakdown,
} from "@/services/demandRadarService";
import { cn } from "@/lib/utils";

type DeviceBucket = "desktop" | "mobile" | "tablet" | "other";
type DeviceFilter = "all" | DeviceBucket;
type DeviceSourceTab = "google" | "clickora";

const DEVICE_COLORS: Record<DeviceBucket, string> = {
  desktop: "hsl(199 89% 42%)",
  mobile: "hsl(152 60% 40%)",
  tablet: "hsl(38 92% 48%)",
  other: "hsl(220 9% 55%)",
};

function numberLocale(locale: AppLocale) {
  if (locale === "pt-BR") return "pt-BR";
  if (locale === "pt") return "pt-PT";
  if (locale === "es") return "es-ES";
  return "en-US";
}

function formatInt(n: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n);
}

function normalizeDevice(raw: string): DeviceBucket {
  const d = raw.trim().toLowerCase();
  if (!d || d === "(desconhecido)" || d === "unknown" || d === "null") return "other";
  if (d.includes("mobile") || d.includes("phone") || d === "m" || d === "smartphone") return "mobile";
  if (d.includes("tablet") || d.includes("ipad")) return "tablet";
  if (d.includes("desktop") || d.includes("computer") || d === "pc" || d === "d") return "desktop";
  return "other";
}

function deviceIcon(key: DeviceBucket) {
  if (key === "mobile") return Smartphone;
  if (key === "tablet") return Tablet;
  return Monitor;
}

function deviceLabel(key: DeviceBucket, t: (k: string) => string): string {
  if (key === "desktop") return t("pages.demandRadar.deviceDesktop");
  if (key === "mobile") return t("pages.demandRadar.deviceMobile");
  if (key === "tablet") return t("pages.demandRadar.deviceTablet");
  return t("pages.demandRadar.deviceOther");
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <div className="inline-flex flex-wrap rounded-md border border-border/70 bg-muted/30 p-0.5">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            "rounded-[5px] px-2.5 py-1.5 text-[11px] font-semibold transition-colors",
            value === opt.id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function DemandDeviceBreakdownPanel({
  devices,
  googleDevices,
  filter,
  onFilterChange,
}: {
  devices: DemandDeviceBreakdown | null | undefined;
  googleDevices?: DemandPlannerDeviceBreakdown | null;
  filter?: DeviceFilter;
  onFilterChange?: (v: DeviceFilter) => void;
}) {
  const { t, locale } = useAppLocale();
  const nl = numberLocale(locale);
  const hasGoogle = Boolean(googleDevices?.items?.length);
  const [tab, setTab] = useState<DeviceSourceTab>(hasGoogle ? "google" : "clickora");
  const activeFilter = filter ?? "all";

  const clickoraRows = useMemo(() => {
    if (!devices?.items?.length) return [];
    const buckets = new Map<DeviceBucket, { clicks: number; sales: number; revenue: number }>();
    for (const item of devices.items) {
      const key = normalizeDevice(item.device);
      const prev = buckets.get(key) ?? { clicks: 0, sales: 0, revenue: 0 };
      buckets.set(key, {
        clicks: prev.clicks + item.clicks,
        sales: prev.sales + item.approved_sales,
        revenue: prev.revenue + item.revenue,
      });
    }
    return (["desktop", "mobile", "tablet", "other"] as DeviceBucket[])
      .map((device) => {
        const stats = buckets.get(device) ?? { clicks: 0, sales: 0, revenue: 0 };
        return { device, ...stats };
      })
      .filter((r) => r.clicks > 0 || r.sales > 0)
      .sort((a, b) => b.clicks - a.clicks);
  }, [devices]);

  const googleRows = useMemo(() => {
    if (!googleDevices?.items?.length) return [];
    return googleDevices.items.map((i) => ({
      device: i.device as DeviceBucket,
      share: i.search_share,
      count: i.search_count,
    }));
  }, [googleDevices]);

  const showingGoogle = tab === "google" && hasGoogle;
  const totalClicks = devices?.total_clicks ?? clickoraRows.reduce((s, r) => s + r.clicks, 0);
  const totalSales = clickoraRows.reduce((s, r) => s + r.sales, 0);

  const pieData = useMemo(() => {
    if (showingGoogle) {
      return googleRows.map((r) => ({
        name: deviceLabel(r.device, t),
        key: r.device,
        value: r.share,
      }));
    }
    return clickoraRows
      .filter((r) => r.clicks > 0)
      .map((r) => ({
        name: deviceLabel(r.device, t),
        key: r.device,
        value: r.clicks,
      }));
  }, [showingGoogle, googleRows, clickoraRows, t]);

  const empty =
    showingGoogle
      ? googleRows.length === 0
      : clickoraRows.length === 0 || totalClicks === 0;

  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
      <div className="space-y-2 border-b border-border/60 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">{t("pages.demandRadar.devicesTitle")}</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {showingGoogle
                ? t("pages.demandRadar.devicesSourceGoogle")
                : t("pages.demandRadar.devicesSource")}
            </p>
          </div>
          {hasGoogle && clickoraRows.length > 0 ? (
            <Segmented
              value={showingGoogle ? "google" : "clickora"}
              onChange={(v) => setTab(v as DeviceSourceTab)}
              options={[
                ...(hasGoogle
                  ? [{ id: "google", label: t("pages.demandRadar.devicesTabGoogle") }]
                  : []),
                { id: "clickora", label: t("pages.demandRadar.devicesTabClickora") },
              ]}
            />
          ) : null}
        </div>
        {onFilterChange ? (
          <Segmented
            value={activeFilter}
            onChange={(v) => onFilterChange(v as DeviceFilter)}
            options={[
              { id: "all", label: t("pages.demandRadar.filterDeviceAll") },
              { id: "desktop", label: t("pages.demandRadar.deviceDesktop") },
              { id: "mobile", label: t("pages.demandRadar.deviceMobile") },
              { id: "tablet", label: t("pages.demandRadar.deviceTablet") },
            ]}
          />
        ) : null}
      </div>

      {empty ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">{t("pages.demandRadar.devicesEmpty")}</p>
      ) : (
        <>
          <div className="grid gap-4 p-4 lg:grid-cols-[180px_1fr] lg:items-center">
            <div className="mx-auto h-40 w-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {pieData.map((entry) => (
                      <Cell
                        key={entry.key}
                        fill={DEVICE_COLORS[entry.key as DeviceBucket] ?? DEVICE_COLORS.other}
                        opacity={
                          activeFilter === "all" || activeFilter === entry.key ? 1 : 0.28
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 10,
                      fontSize: 12,
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--card))",
                    }}
                    formatter={(value: number | string) => [
                      showingGoogle
                        ? `${Number(value)}%`
                        : formatInt(Number(value), nl),
                      showingGoogle
                        ? t("pages.demandRadar.deviceShare")
                        : t("pages.demandRadar.deviceClicks"),
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2">
              {showingGoogle
                ? googleRows.map((row) => {
                    const Icon = deviceIcon(row.device);
                    const color = DEVICE_COLORS[row.device];
                    const selected = activeFilter === "all" || activeFilter === row.device;
                    return (
                      <button
                        key={row.device}
                        type="button"
                        className={cn(
                          "w-full space-y-1.5 rounded-md px-1 py-1 text-left transition-opacity",
                          !selected && "opacity-40",
                        )}
                        onClick={() => onFilterChange?.(activeFilter === row.device ? "all" : row.device)}
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2 font-medium text-foreground">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                            {deviceLabel(row.device, t)}
                          </div>
                          <div className="tabular-nums text-muted-foreground">{row.share}%</div>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.min(100, row.share)}%`, background: color }}
                          />
                        </div>
                      </button>
                    );
                  })
                : clickoraRows.map((row) => {
                    const Icon = deviceIcon(row.device);
                    const pct =
                      totalClicks > 0 ? Math.round((row.clicks / totalClicks) * 1000) / 10 : 0;
                    const color = DEVICE_COLORS[row.device];
                    const selected = activeFilter === "all" || activeFilter === row.device;
                    return (
                      <button
                        key={row.device}
                        type="button"
                        className={cn(
                          "w-full space-y-1.5 rounded-md px-1 py-1 text-left transition-opacity",
                          !selected && "opacity-40",
                        )}
                        onClick={() => onFilterChange?.(activeFilter === row.device ? "all" : row.device)}
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2 font-medium text-foreground">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                            {deviceLabel(row.device, t)}
                          </div>
                          <div className="tabular-nums text-muted-foreground">
                            {formatInt(row.clicks, nl)} · {pct}%
                          </div>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.min(100, pct)}%`, background: color }}
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {t("pages.demandRadar.deviceSales")}: {formatInt(row.sales, nl)}
                        </p>
                      </button>
                    );
                  })}
            </div>
          </div>

          {!showingGoogle ? (
            <div className="flex gap-4 border-t border-border/50 bg-muted/20 px-4 py-2.5 text-[11px] text-muted-foreground">
              <span>
                {t("pages.demandRadar.deviceClicks")}:{" "}
                <span className="font-semibold tabular-nums text-foreground">
                  {formatInt(totalClicks, nl)}
                </span>
              </span>
              <span>
                {t("pages.demandRadar.deviceSales")}:{" "}
                <span className="font-semibold tabular-nums text-foreground">
                  {formatInt(totalSales, nl)}
                </span>
              </span>
            </div>
          ) : (
            <p className="border-t border-border/50 bg-muted/20 px-4 py-2.5 text-[10px] text-muted-foreground">
              {t("pages.demandRadar.devicesGoogleNote")}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export type { DeviceFilter };
