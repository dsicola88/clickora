import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import type { AppLocale } from "@/i18n/types";
import type { DemandDeviceBreakdown } from "@/services/demandRadarService";
import { cn } from "@/lib/utils";

type DeviceBucket = "desktop" | "mobile" | "tablet" | "other";

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

export function DemandDeviceBreakdownPanel({
  devices,
}: {
  devices: DemandDeviceBreakdown | null | undefined;
}) {
  const { t, locale } = useAppLocale();
  const nl = numberLocale(locale);

  const rows = useMemo(() => {
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

  const totalClicks = devices?.total_clicks ?? rows.reduce((s, r) => s + r.clicks, 0);
  const totalSales = rows.reduce((s, r) => s + r.sales, 0);

  const pieData = useMemo(
    () =>
      rows
        .filter((r) => r.clicks > 0)
        .map((r) => ({
          name: deviceLabel(r.device, t),
          key: r.device,
          value: r.clicks,
        })),
    [rows, t],
  );

  if (!devices || rows.length === 0 || totalClicks === 0) {
    return (
      <div className="rounded-xl border border-border/70 bg-card px-4 py-6">
        <h3 className="text-sm font-semibold tracking-tight">{t("pages.demandRadar.devicesTitle")}</h3>
        <p className="mt-1 text-[11px] text-muted-foreground">{t("pages.demandRadar.devicesSource")}</p>
        <p className="mt-4 text-sm text-muted-foreground">{t("pages.demandRadar.devicesEmpty")}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
      <div className="border-b border-border/60 px-4 py-3">
        <h3 className="text-sm font-semibold tracking-tight">{t("pages.demandRadar.devicesTitle")}</h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{t("pages.demandRadar.devicesSource")}</p>
      </div>

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
                  <Cell key={entry.key} fill={DEVICE_COLORS[entry.key]} />
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
                  formatInt(Number(value), nl),
                  t("pages.demandRadar.deviceClicks"),
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-2">
          {rows.map((row) => {
            const Icon = deviceIcon(row.device);
            const pct = totalClicks > 0 ? Math.round((row.clicks / totalClicks) * 1000) / 10 : 0;
            const color = DEVICE_COLORS[row.device];
            return (
              <div key={row.device} className="space-y-1.5">
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
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, pct)}%`, background: color }}
                  />
                </div>
                <p className={cn("text-[10px] text-muted-foreground")}>
                  {t("pages.demandRadar.deviceSales")}: {formatInt(row.sales, nl)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-4 border-t border-border/50 bg-muted/20 px-4 py-2.5 text-[11px] text-muted-foreground">
        <span>
          {t("pages.demandRadar.deviceClicks")}:{" "}
          <span className="font-semibold tabular-nums text-foreground">{formatInt(totalClicks, nl)}</span>
        </span>
        <span>
          {t("pages.demandRadar.deviceSales")}:{" "}
          <span className="font-semibold tabular-nums text-foreground">{formatInt(totalSales, nl)}</span>
        </span>
      </div>
    </div>
  );
}
