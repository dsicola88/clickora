import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enterpriseService, type ApiKeyRow } from "@/services/enterpriseService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProPanel } from "@/components/enterprise/ProShell";
import { toast } from "sonner";
import { Copy, Key, Loader2, Plus, Trash2 } from "lucide-react";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-PT");
  } catch {
    return iso;
  }
}

export function EnterpriseApiKeysPanel() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [createdPlain, setCreatedPlain] = useState<string | null>(null);

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ["enterprise-api-keys"],
    queryFn: async () => {
      const { data, error } = await enterpriseService.listApiKeys();
      if (error) throw new Error(error);
      return data ?? [];
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Indique um nome para a chave.");
      const { data, error } = await enterpriseService.createApiKey(trimmed);
      if (error) throw new Error(error);
      return data!;
    },
    onSuccess: (data) => {
      setCreatedPlain(data.api_key);
      setName("");
      qc.invalidateQueries({ queryKey: ["enterprise-api-keys"] });
      qc.invalidateQueries({ queryKey: ["enterprise-onboarding"] });
      toast.success("API key criada. Guarde-a agora — não volta a ser mostrada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await enterpriseService.revokeApiKey(id);
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["enterprise-api-keys"] });
      qc.invalidateQueries({ queryKey: ["enterprise-onboarding"] });
      toast.success("API key revogada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyKey = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Chave copiada.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <ProPanel
      title="API keys (B2B)"
      description="Chaves para integrações server-to-server. A chave completa só é mostrada no momento da criação."
    >
      <div className="space-y-4 px-4 pb-4">
        {createdPlain ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
            <p className="text-xs font-medium text-foreground">Nova chave (copie agora):</p>
            <code className="block break-all rounded bg-background/80 border border-border/60 px-2 py-1.5 text-xs font-mono">
              {createdPlain}
            </code>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="secondary" className="gap-1" onClick={() => void copyKey(createdPlain)}>
                <Copy className="h-3.5 w-3.5" /> Copiar
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setCreatedPlain(null)}>
                Fechar aviso
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="space-y-1.5 flex-1">
            <Label htmlFor="api-key-name">Nome</Label>
            <Input
              id="api-key-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: CRM produção"
              maxLength={80}
            />
          </div>
          <Button
            type="button"
            className="gap-1.5 shrink-0"
            disabled={createMut.isPending || !name.trim()}
            onClick={() => createMut.mutate()}
          >
            {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Criar chave
          </Button>
        </div>

        {isLoading ? (
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> A carregar…
          </p>
        ) : keys.length === 0 ? (
          <p className="text-xs text-muted-foreground">Ainda não tem API keys activas.</p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-lg border border-border/60 overflow-hidden">
            {keys.map((k: ApiKeyRow) => (
              <li key={k.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-3 py-2.5 bg-card text-sm">
                <div className="min-w-0 space-y-0.5">
                  <p className="font-medium truncate flex items-center gap-1.5">
                    <Key className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {k.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    {k.key_prefix}… · {k.scopes.join(", ")} · criada {formatDate(k.created_at)}
                    {k.last_used_at ? ` · último uso ${formatDate(k.last_used_at)}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1 text-destructive hover:text-destructive shrink-0"
                  disabled={revokeMut.isPending}
                  onClick={() => {
                    if (window.confirm(`Revogar a chave «${k.name}»?`)) revokeMut.mutate(k.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Revogar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ProPanel>
  );
}
