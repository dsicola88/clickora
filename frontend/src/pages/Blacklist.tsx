import { useState } from "react";
import { ShieldBan, Search, Trash2, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";

interface BlacklistEntry {
  id: string;
  ip: string;
  addedAt: string;
}

export default function Blacklist() {
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [newIp, setNewIp] = useState("");

  const handleAdd = () => {
    if (!newIp) { toast.error("Insira um IP."); return; }
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(newIp)) { toast.error("Formato de IP inválido."); return; }
    if (blacklist.some((b) => b.ip === newIp)) { toast.error("IP já está na blacklist."); return; }
    setBlacklist([
      { id: Date.now().toString(), ip: newIp, addedAt: new Date().toLocaleDateString("pt-BR") },
      ...blacklist,
    ]);
    setNewIp("");
    toast.success("IP adicionado à blacklist!");
  };

  const handleRemove = (id: string) => {
    setBlacklist(blacklist.filter((b) => b.id !== id));
    toast.success("IP removido da blacklist.");
  };

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        centered
        title="Sua Blacklist"
        description="Adicione endereços de IP que você deseja bloquear automaticamente."
      />

      <div className="bg-card rounded-xl p-6 shadow-card border border-border/50 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4 w-full">
          <div className="space-y-2 flex-1 w-full">
            <Input
              placeholder="Ex: 192.168.1.1"
              value={newIp}
              onChange={(e) => setNewIp(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
          </div>
          <Button
            onClick={handleAdd}
            className="gap-2 w-full sm:w-auto shrink-0 gradient-primary border-0 text-primary-foreground hover:opacity-90"
          >
            <Search className="h-4 w-4" /> Encontrar
          </Button>
        </div>

        <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
          <p className="text-sm text-warning">
            <strong>Atenção:</strong> Todos os endereços de IP adicionados nesta área ficarão impossibilitados de acessar seu site e serão automaticamente redirecionados.
          </p>
        </div>

        {blacklist.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Ainda não há nenhum IP na sua lista de bloqueios.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">IP</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Adicionado em</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Ação</th>
                </tr>
              </thead>
              <tbody>
                {blacklist.map((item) => (
                  <tr key={item.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-xs text-card-foreground">{item.ip}</td>
                    <td className="py-2.5 px-4 text-muted-foreground">{item.addedAt}</td>
                    <td className="py-2.5 px-4 text-right">
                      <button onClick={() => handleRemove(item.id)} className="text-destructive hover:text-destructive/80 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
