import { useCallback, useEffect, useState } from "react";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { Search, RotateCcw, FileText, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { analyticsService } from "@/services/analyticsService";

type LogEntry = { time: string; cat: string; msg: string };

export default function Logs() {
  const { t } = useAppLocale();
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("Todas");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let event_type: string | undefined;
      if (category === "Conversão") event_type = "conversion,sale,lead";
      else if (category === "Core" || category === "Acesso") event_type = "click,pageview,impression";
      const res = await analyticsService.getEvents({
        limit: 100,
        include_bots: true,
        event_type,
        ...(date ? { from: date, to: date } : {}),
      });
      if (res.error) {
        setError(res.error);
        setLogs([]);
        return;
      }
      const raw = Array.isArray(res.data) ? res.data : [];
      const rows = raw.map((e) => {
        const created = String(e.created_at || "");
        const et = String(e.event_type || "event");
        const src = String(e.source || "");
        const camp = String(e.campaign || "");
        const id = String(e.id || "").slice(0, 8);
        return {
          time: created ? new Date(created).toLocaleString("pt-PT") : "—",
          cat: et,
          msg: `${id} · ${src || "—"} · ${camp || "—"}`,
        };
      });
      setLogs(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar eventos");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [date, category]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredLogs = logs.filter((log) => {
    if (category !== "Todas" && category !== "Core" && category !== "Acesso" && category !== "Conversão") {
      return true;
    }
    return true;
  });

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        centered
        title={t("pages.logs.title")}
        description={t("pages.logs.subtitle")}
      />

      <div className="bg-card rounded-xl shadow-card border border-border/50 overflow-hidden">
        <div className="p-4 border-b border-border flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t("pages.logs.date")}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t("pages.logs.category")}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  { value: "Todas", label: "Todas" },
                  { value: "Core", label: "Principal" },
                  { value: "Conversão", label: "Conversão" },
                  { value: "Acesso", label: "Acesso" },
                ].map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => void load()}
            disabled={loading}
            className="gap-2 gradient-primary border-0 text-primary-foreground hover:opacity-90"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Consultar
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setDate("");
              setCategory("Todas");
            }}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" /> Redefinir
          </Button>
        </div>

        <div className="p-4 bg-muted/20 max-h-[600px] overflow-y-auto">
          {loading ? (
            <LoadingState message="A carregar eventos…" />
          ) : error ? (
            <ErrorState message={error} onRetry={() => void load()} />
          ) : filteredLogs.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-8 w-8 text-muted-foreground" />}
              title="Nenhum evento encontrado"
              description="Ajuste a data ou a categoria e consulte de novo."
            />
          ) : (
            <pre className="font-mono text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {filteredLogs.map((log, i) => (
                <div key={i} className="hover:bg-muted/30 px-1 rounded">
                  <span className="text-primary">
                    [dclickora | {log.cat} | {log.time}]
                  </span>{" "}
                  <span className="text-card-foreground">{log.msg}</span>
                </div>
              ))}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
