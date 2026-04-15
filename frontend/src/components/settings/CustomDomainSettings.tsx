import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Globe, Loader2, Trash2, Star } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { customDomainService } from "@/services/customDomainService";
import { presellService } from "@/services/presellService";
import type { CustomDomainDto } from "@/types/api";
import {
  inferDnsRecordKind,
  normalizeDomainStatus,
  resolveHostingDnsHint,
  resolvePendingDnsForDisplay,
} from "@/lib/customDomainDnsDisplay";
import { CustomDomainDnsTable } from "@/components/settings/CustomDomainDnsTable";

export function CustomDomainSettings() {
  const { user } = useAuth();
  const tenantKey = user?.id ?? "";
  const queryClient = useQueryClient();
  const [newHostname, setNewHostname] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { data: domains = [], isLoading } = useQuery({
    queryKey: ["custom-domain", tenantKey],
    queryFn: async () => {
      const { data, error } = await customDomainService.list();
      if (error) throw new Error(error);
      return data ?? [];
    },
    enabled: !!tenantKey,
  });

  const { data: quota } = useQuery({
    queryKey: ["custom-domain-quota", tenantKey],
    queryFn: async () => {
      const { data, error } = await customDomainService.quota();
      if (error) throw new Error(error);
      return data ?? null;
    },
    enabled: !!tenantKey,
    staleTime: 30_000,
  });

  const { data: presells = [] } = useQuery({
    queryKey: ["presells", tenantKey],
    queryFn: async () => {
      const { data, error } = await presellService.getAll();
      if (error) throw new Error(error);
      return data ?? [];
    },
    enabled: !!tenantKey,
  });

  const createMutation = useMutation({
    mutationFn: (hostname: string) => customDomainService.create(hostname),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const created = res.data;
      if (created) {
        queryClient.setQueryData<CustomDomainDto[]>(["custom-domain", tenantKey], (old) => {
          const list = old ?? [];
          const rest = list.filter((x) => x.id !== created.id);
          return [created, ...rest];
        });
      }
      queryClient.invalidateQueries({ queryKey: ["custom-domain"] });
      queryClient.invalidateQueries({ queryKey: ["custom-domain-quota"] });
      setNewHostname("");
      const d = res.data;
      const mode = d?.pending_dns?.mode;
      if (mode === "vercel") {
        toast.success("Domínio adicionado ao alojamento. Configure CNAME e TXT no DNS e use «Verificar».");
      } else {
        toast.success("Domínio adicionado. Configure o TXT no DNS e verifique.");
      }
    },
    onError: () => toast.error("Não foi possível adicionar."),
  });

  const verifyMutation = useMutation({
    mutationFn: (id: string) => customDomainService.verify(id),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["custom-domain"] });
      toast.success("Domínio verificado.");
    },
    onError: () => toast.error("Verificação falhou."),
  });

  const defaultMutation = useMutation({
    mutationFn: (id: string) => customDomainService.setDefault(id),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["custom-domain"] });
      toast.success("Domínio padrão atualizado.");
    },
    onError: () => toast.error("Não foi possível definir o padrão."),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => customDomainService.remove(id),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["custom-domain"] });
      queryClient.invalidateQueries({ queryKey: ["custom-domain-quota"] });
      toast.success("Domínio removido.");
    },
    onError: () => toast.error("Não foi possível remover."),
  });

  const rootPresellMutation = useMutation({
    mutationFn: async ({ domainId, presellId }: { domainId: string; presellId: string | null }) => {
      const res = await customDomainService.setRootPresell(domainId, presellId);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-domain"] });
      queryClient.invalidateQueries({ queryKey: ["public-custom-domain-root-presell"] });
      toast.success("Presell na raiz do domínio atualizada.");
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Não foi possível guardar.";
      toast.error(msg);
    },
  });

  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(label);
      setTimeout(() => setCopiedField(null), 2000);
      toast.success("Copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <div className="bg-card rounded-xl p-6 shadow-card border border-border/50 space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Globe className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-card-foreground">Domínios personalizados</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Adicione vários domínios (um por campanha ou marca). Os <strong className="text-foreground font-medium">valores
            para copiar no DNS</strong> (TXT e, com Vercel, CNAME/A) aparecem{" "}
            <strong className="text-foreground font-medium">dentro do cartão</strong> de cada domínio enquanto o estado for{" "}
            <strong className="text-foreground font-medium">Pendente</strong>. Depois de «Verificado», o cartão mostra só
            referência de apontamento (se aplicável) e a presell na raiz. Com integração Vercel no servidor, o hostname é
            registado no projeto do site. Sem Vercel, a verificação é com{" "}
            <strong className="text-foreground font-medium">um registo TXT</strong> (nome e valor no cartão pendente). O
            domínio padrão aplica-se às presells que não escolhem outro.
          </p>
        </div>
      </div>

      <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground border border-border/50 rounded-lg p-4 bg-muted/20">
        <li>
          Com o domínio em estado <strong className="text-foreground font-medium">Pendente</strong>, abra o respetivo
          cartão: lá estão as linhas <strong className="text-foreground font-medium">Nome</strong> e{" "}
          <strong className="text-foreground font-medium">Valor</strong> para colar no DNS (Hostinger, Cloudflare, etc.).
          Não inverta nome e valor nem adicione aspas a mais.
        </li>
        <li>
          Se o cartão mostrar CNAME ou A (Vercel), crie também esse registo para o site carregar no seu domínio.
        </li>
        <li>Aguarde a propagação (minutos a horas) e clique em «Verificar agora» no mesmo cartão.</li>
        <li>Nas presells, em editar, escolha o domínio dos links públicos.</li>
      </ol>

      {quota && !quota.can_add ? (
        <div
          className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100/95"
          role="status"
        >
          {quota.max_custom_domains === 0
            ? "O seu plano não inclui domínios personalizados. O plano Premium permite até 2 domínios; no Pro use exportação HTML para WordPress (Elementor) no domínio dclickora."
            : `Limite atingido (${quota.used}/${quota.max_custom_domains}). Remova um domínio abaixo para libertar um lugar.`}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="new-custom-hostname">Adicionar domínio</Label>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            id="new-custom-hostname"
            placeholder="www.seusite.com"
            value={newHostname}
            onChange={(e) => setNewHostname(e.target.value)}
            disabled={createMutation.isPending || (quota != null && !quota.can_add)}
            className="font-mono text-sm"
          />
          <Button
            type="button"
            className="shrink-0"
            disabled={createMutation.isPending || (quota != null && !quota.can_add)}
            onClick={() => {
              const raw = newHostname.trim();
              if (!raw) {
                toast.error("Indique o hostname.");
                return;
              }
              createMutation.mutate(raw);
            }}
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Sem https:// — só o hostname.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> A carregar…
        </div>
      ) : domains.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum domínio ainda. Adicione um acima.</p>
      ) : (
        <div className="space-y-4">
          {domains.map((d) => {
            const dns = resolvePendingDnsForDisplay(d);
            const isPending = normalizeDomainStatus(d.status) === "pending";
            const hostingHint = resolveHostingDnsHint(d);
            return (
              <div
                key={d.id}
                className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <code className="text-sm font-mono break-all">https://{d.hostname}</code>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        normalizeDomainStatus(d.status) === "verified"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                      }`}
                    >
                      {normalizeDomainStatus(d.status) === "verified" ? "Verificado" : "Pendente"}
                    </span>
                    {normalizeDomainStatus(d.status) === "verified" && d.is_default && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-500" /> Padrão
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 shrink-0">
                    {normalizeDomainStatus(d.status) === "verified" && !d.is_default && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        disabled={defaultMutation.isPending}
                        onClick={() => defaultMutation.mutate(d.id)}
                      >
                        Tornar padrão
                      </Button>
                    )}
                    {isPending && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="text-xs"
                        disabled={verifyMutation.isPending}
                        onClick={() => verifyMutation.mutate(d.id)}
                      >
                        Verificar agora
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive text-xs"
                      disabled={removeMutation.isPending}
                      onClick={() => {
                        if (!confirm(`Remover ${d.hostname}?`)) return;
                        removeMutation.mutate(d.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {isPending && dns && (
                  <div className="space-y-3 text-xs" data-testid="custom-domain-pending-dns">
                    {dns.mode === "vercel" ? (
                      <>
                        <p className="text-muted-foreground leading-relaxed">{dns.note}</p>
                        <CustomDomainDnsTable
                          idPrefix={`${d.id}-pend-v`}
                          title="Registos DNS (Vercel)"
                          sourceNote="Valores alinhados com o projeto do site na Vercel (API add domain / mesma lógica que o painel Vercel)."
                          description={dns.cname.note}
                          rows={[
                            {
                              kind: inferDnsRecordKind(dns.cname.target),
                              name: dns.cname.host,
                              value: dns.cname.target,
                            },
                            ...dns.vercel_txt.map((row) => ({
                              kind: "TXT" as const,
                              name: row.name,
                              value: row.value,
                              detail: row.reason,
                            })),
                          ]}
                          copiedField={copiedField}
                          onCopy={(fieldId, text) => void copy(fieldId, text)}
                        />
                        {dns.vercel_txt.length === 0 && (
                          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-muted-foreground leading-relaxed">
                            <p className="font-medium text-card-foreground mb-1">Sem TXT extra da Vercel neste momento</p>
                            <p>
                              Em muitos casos basta o <strong className="text-foreground font-medium">CNAME</strong> (ou{" "}
                              <strong className="text-foreground font-medium">A</strong> no domínio raiz) na tabela. Guarde o
                              DNS, aguarde a propagação e use «Verificar agora». Se continuar pendente, atualize a página
                              — a Vercel pode passar a pedir um TXT depois.
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-muted-foreground leading-relaxed">{dns.note}</p>
                        <ul className="list-disc pl-4 text-muted-foreground space-y-1 text-[11px] leading-relaxed">
                          <li>
                            No painel DNS crie tipo <strong className="text-foreground font-medium">TXT</strong> (não use
                            A/CNAME para esta linha).
                          </li>
                        </ul>
                        <CustomDomainDnsTable
                          idPrefix={`${d.id}-pend-d`}
                          title="Registo TXT (verificação dclickora)"
                          sourceNote="Prova de posse do domínio; independente da Vercel."
                          rows={[
                            {
                              kind: "TXT",
                              name: dns.txt_name,
                              value: dns.txt_value,
                            },
                          ]}
                          copiedField={copiedField}
                          onCopy={(fieldId, text) => void copy(fieldId, text)}
                        />
                      </>
                    )}
                  </div>
                )}
                {hostingHint && (
                  <CustomDomainDnsTable
                    idPrefix={`${d.id}-host`}
                    title="Apontamento do site (referência Vercel)"
                    sourceNote="Mesmos valores recomendados pela Vercel para o projeto do site; use na Hostinger se o domínio não abrir o site."
                    description={hostingHint.note}
                    rows={[
                      {
                        kind: inferDnsRecordKind(hostingHint.target),
                        name: hostingHint.host,
                        value: hostingHint.target,
                      },
                    ]}
                    copiedField={copiedField}
                    onCopy={(fieldId, text) => void copy(fieldId, text)}
                  />
                )}
                {normalizeDomainStatus(d.status) === "verified" && (
                  <div className="space-y-2 pt-3 border-t border-border/40">
                    <Label className="text-xs font-medium text-card-foreground">
                      Presell ao abrir <span className="font-mono text-[11px]">https://{d.hostname}/</span>
                    </Label>
                    <Select
                      value={d.root_presell_id ?? "__auto__"}
                      onValueChange={(v) => {
                        const next = v === "__auto__" ? null : v;
                        rootPresellMutation.mutate({ domainId: d.id, presellId: next });
                      }}
                      disabled={rootPresellMutation.isPending}
                    >
                      <SelectTrigger className="text-sm max-w-md">
                        <SelectValue placeholder="Automático" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__auto__">Automático (última presell publicada atualizada)</SelectItem>
                        {presells
                          .filter((p) => p.custom_domain_id === d.id && p.status === "published")
                          .map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.title}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Com várias presells no mesmo domínio, escolhe qual aparece na raiz; sem escolha, usa-se a
                      publicada alterada mais recentemente.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
