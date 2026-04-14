import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Globe, Copy, Check, Loader2, Trash2, Star } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { customDomainService } from "@/services/customDomainService";
import type { CustomDomainDto, CustomDomainPendingDns } from "@/types/api";

export function CustomDomainSettings() {
  const queryClient = useQueryClient();
  const [newHostname, setNewHostname] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { data: domains = [], isLoading } = useQuery({
    queryKey: ["custom-domain"],
    queryFn: async () => {
      const { data, error } = await customDomainService.list();
      if (error) throw new Error(error);
      return data ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: (hostname: string) => customDomainService.create(hostname),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["custom-domain"] });
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
      toast.success("Domínio removido.");
    },
    onError: () => toast.error("Não foi possível remover."),
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

  /** Compatível com APIs antigas sem `pending_dns`. */
  function legacyPendingDns(d: CustomDomainDto): Extract<CustomDomainPendingDns, { mode: "dclickora" }> {
    return {
      mode: "dclickora",
      txt_name: `_dclickora-verify.${d.hostname}`,
      txt_value: `dclickora-verification=${d.verification_token}`,
      note:
        "Crie um único registo TXT: use a primeira linha como Nome/Host e a segunda como Valor. Depois clique em «Verificar agora».",
    };
  }

  function pendingDnsFor(d: CustomDomainDto): CustomDomainPendingDns | null {
    if (d.status !== "pending") return null;
    return d.pending_dns ?? legacyPendingDns(d);
  }

  return (
    <div className="bg-card rounded-xl p-6 shadow-card border border-border/50 space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Globe className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-card-foreground">Domínios personalizados</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Adicione vários domínios (um por campanha ou marca). Com a integração Vercel ativa no servidor, o hostname é
            registado no projeto do site e verá instruções de CNAME/A e TXT da Vercel. Sem essa integração, a verificação
            é com <strong className="text-foreground font-medium">um único registo TXT</strong>: no DNS cria tipo{" "}
            <strong className="text-foreground font-medium">TXT</strong> e preenche o{" "}
            <strong className="text-foreground font-medium">nome</strong> e o{" "}
            <strong className="text-foreground font-medium">valor</strong> exatamente como abaixo (são duas caixas
            diferentes no painel — não são dois TXT com o mesmo texto). O domínio padrão aplica-se às presells que não
            escolhem outro.
          </p>
        </div>
      </div>

      <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground border border-border/50 rounded-lg p-4 bg-muted/20">
        <li>
          No registador (Hostinger, Cloudflare, etc.): <strong className="text-foreground font-medium">um</strong>{" "}
          registo TXT — campo «Nome/Host» = primeira linha abaixo; «Valor/Conteúdo» = segunda linha. Não inverta nem
          coloque aspas a envolver mal o valor.
        </li>
        <li>
          Se as instruções incluírem CNAME ou A (Vercel), adicione também esse apontamento para o site carregar no seu
          domínio.
        </li>
        <li>Aguarde a propagação (minutos a horas) e clique em «Verificar agora».</li>
        <li>Nas presells, em editar, escolha o domínio dos links públicos.</li>
      </ol>

      <div className="space-y-2">
        <Label htmlFor="new-custom-hostname">Adicionar domínio</Label>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            id="new-custom-hostname"
            placeholder="www.seusite.com"
            value={newHostname}
            onChange={(e) => setNewHostname(e.target.value)}
            disabled={createMutation.isPending}
            className="font-mono text-sm"
          />
          <Button
            type="button"
            className="shrink-0"
            disabled={createMutation.isPending}
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
            const dns = pendingDnsFor(d);
            const isPending = d.status === "pending";
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
                        d.status === "verified"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                      }`}
                    >
                      {d.status === "verified" ? "Verificado" : "Pendente"}
                    </span>
                    {d.status === "verified" && d.is_default && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-500" /> Padrão
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 shrink-0">
                    {d.status === "verified" && !d.is_default && (
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
                  <div className="space-y-3 text-xs">
                    {dns.mode === "vercel" ? (
                      <>
                        <p className="text-muted-foreground">{dns.note}</p>
                        <div className="rounded-md border border-border/50 bg-background/60 p-3 space-y-1">
                          <p className="font-medium text-card-foreground">Apontamento (Vercel)</p>
                          <p className="text-muted-foreground">{dns.cname.note}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono">
                            <span>
                              Nome: <span className="text-card-foreground">{dns.cname.host}</span>
                            </span>
                            <span>
                              Valor: <span className="text-card-foreground">{dns.cname.target}</span>
                            </span>
                          </div>
                        </div>
                        {dns.vercel_txt.length > 0 && (
                          <div className="space-y-2">
                            <p className="font-medium text-card-foreground">TXT adicionais (Vercel)</p>
                            <p className="text-muted-foreground leading-relaxed">
                              Para cada linha abaixo, crie <strong className="text-foreground font-medium">um</strong>{" "}
                              registo TXT no DNS: o nome e o valor são os dois textos indicados (não troque nome e valor).
                            </p>
                            {dns.vercel_txt.map((row, i) => (
                              <div key={i} className="rounded-md border border-border/50 bg-background/60 p-2 space-y-2">
                                <p className="text-[11px] text-muted-foreground">{row.reason}</p>
                                <div className="space-y-1">
                                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Nome</p>
                                  <code className="block break-all rounded px-2 py-1.5 text-[12px]">{row.name}</code>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Valor</p>
                                  <div className="flex gap-2 items-start">
                                  <code className="break-all flex-1 rounded px-2 py-1.5 text-[12px]">
                                    {row.value}
                                  </code>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 shrink-0"
                                    onClick={() => copy(`vt-${d.id}-${i}`, `${row.name} ${row.value}`)}
                                  >
                                    {copiedField === `vt-${d.id}-${i}` ? (
                                      <Check className="h-3 w-3" />
                                    ) : (
                                      <Copy className="h-3 w-3" />
                                    )}
                                  </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="space-y-3 rounded-md border border-border/50 bg-background/40 p-3">
                        <div>
                          <p className="font-medium text-card-foreground">Um registo TXT (verificação dclickora)</p>
                          <p className="text-muted-foreground mt-1 leading-relaxed">{dns.note}</p>
                        </div>
                        <ul className="list-disc pl-4 text-muted-foreground space-y-1.5 leading-relaxed">
                          <li>
                            No painel DNS, tipo <strong className="text-foreground font-medium">TXT</strong> — não use
                            tipo A nem CNAME para estes valores.
                          </li>
                          <li>
                            <strong className="text-foreground font-medium">Nome / Host / Name:</strong> muitos painéis
                            pedem só <code className="text-[11px]">_dclickora-verify</code> (o domínio acrescenta-se
                            sozinho). Se o sistema pedir o nome completo, use a primeira linha tal como está.
                          </li>
                          <li>
                            <strong className="text-foreground font-medium">Valor / Conteúdo / Value:</strong> a segunda
                            linha completa, começando por <code className="text-[11px]">dclickora-verification=</code>{" "}
                            — não coloque aqui o nome do registo nem aspas desnecessárias.
                          </li>
                        </ul>
                        <div className="space-y-1.5">
                          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            1 — Nome do registo (host)
                          </Label>
                          <div className="flex gap-2 items-start">
                            <code className="break-all flex-1 bg-background border border-border/50 rounded px-2 py-1.5 text-[13px]">
                              {dns.txt_name}
                            </code>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={() => copy("n-" + d.id, dns.txt_name)}
                              aria-label="Copiar nome do registo TXT"
                            >
                              {copiedField === "n-" + d.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            2 — Valor do TXT (conteúdo)
                          </Label>
                          <div className="flex gap-2 items-start">
                            <code className="break-all flex-1 bg-background border border-border/50 rounded px-2 py-1.5 text-[13px]">
                              {dns.txt_value}
                            </code>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={() => copy("v-" + d.id, dns.txt_value)}
                              aria-label="Copiar valor do registo TXT"
                            >
                              {copiedField === "v-" + d.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
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
