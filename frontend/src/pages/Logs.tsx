import { useState } from "react";
import { Search, RotateCcw, FileText } from "lucide-react";
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
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";

const categories = ["Todas", "Core", "Migração", "Conversão", "Acesso", "Blacklist", "API"];

type LogEntry = { time: string; cat: string; msg: string };

export default function Logs() {
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("Todas");
  const [logs] = useState<LogEntry[]>([]);

  const filteredLogs = logs.filter((log) => {
    if (category !== "Todas" && log.cat !== category) return false;
    if (date && !log.time.startsWith(date.split("-").reverse().join("/"))) return false;
    return true;
  });

  const handleReset = () => {
    setDate("");
    setCategory("Todas");
  };

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        centered
        title="Logs"
        description="Consulte os registos do sistema. A lista preenche-se quando houver eventos."
      />

      <div className="bg-card rounded-xl shadow-card border border-border/50 overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-border flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Selecione a data:</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Selecione a categoria:</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button className="gap-2 gradient-primary border-0 text-primary-foreground hover:opacity-90">
            <Search className="h-4 w-4" /> Consultar Log
          </Button>
          <Button variant="outline" onClick={handleReset} className="gap-2">
            <RotateCcw className="h-4 w-4" /> Redefinir
          </Button>
        </div>

        {/* Log Output */}
        <div className="p-4 bg-muted/20 max-h-[600px] overflow-y-auto">
          <pre className="font-mono text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {filteredLogs.map((log, i) => (
              <div key={i} className="hover:bg-muted/30 px-1 rounded">
                <span className="text-primary">[dclickora | {log.cat} | {log.time}]</span>{" "}
                <span className="text-card-foreground">{log.msg}</span>
              </div>
            ))}
            {filteredLogs.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Nenhum log encontrado para os filtros selecionados.
              </div>
            )}
          </pre>
        </div>
      </div>
    </div>
  );
}
