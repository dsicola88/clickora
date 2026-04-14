import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export type DnsTableRow = {
  kind: "CNAME" | "A" | "TXT";
  /** Nome / host no painel DNS (ex.: www, @, _vercel...) */
  name: string;
  /** Valor / destino / conteúdo TXT */
  value: string;
  /** Contexto opcional (ex.: motivo da Vercel) */
  detail?: string;
};

type Props = {
  /** Prefixo único para ids de cópia (ex.: domínio id) */
  idPrefix: string;
  title: string;
  /** Texto curto sobre origem dos valores */
  sourceNote?: string;
  /** Parágrafo explicativo acima da tabela */
  description?: string;
  rows: DnsTableRow[];
  copiedField: string | null;
  onCopy: (fieldId: string, text: string) => void;
};

export function CustomDomainDnsTable({
  idPrefix,
  title,
  sourceNote,
  description,
  rows,
  copiedField,
  onCopy,
}: Props) {
  return (
    <div className="rounded-md border border-border/50 bg-background/60 overflow-hidden text-xs">
      <div className="border-b border-border/50 bg-muted/30 px-3 py-2 space-y-0.5">
        <p className="font-medium text-card-foreground">{title}</p>
        {sourceNote ? (
          <p className="text-[11px] text-muted-foreground leading-relaxed">{sourceNote}</p>
        ) : null}
      </div>
      {description ? <p className="px-3 py-2 text-muted-foreground leading-relaxed border-b border-border/40">{description}</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border/50 bg-muted/20 text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-medium w-[72px]">Tipo</th>
              <th className="px-3 py-2 font-medium min-w-[100px]">Nome / Host</th>
              <th className="px-3 py-2 font-medium min-w-[120px]">Valor</th>
              <th className="px-2 py-2 font-medium w-[100px] text-right">Copiar</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const base = `${idPrefix}-r${i}`;
              const line = `${row.name}\t${row.value}`;
              return (
                <tr key={i} className="border-b border-border/40 last:border-0 align-top">
                  <td className="px-3 py-2">
                    <span className="inline-block font-mono text-[11px] rounded-md bg-primary/12 text-primary px-1.5 py-0.5">
                      {row.kind}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-[12px] text-card-foreground break-all">{row.name}</td>
                  <td className="px-3 py-2 font-mono text-[12px] text-card-foreground break-all">
                    <div className="space-y-1">
                      <span>{row.value}</span>
                      {row.detail ? <p className="text-[10px] text-muted-foreground font-sans normal-case">{row.detail}</p> : null}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-1.5 text-[10px]"
                        title="Copiar só o nome"
                        onClick={() => onCopy(`${base}-n`, row.name)}
                      >
                        {copiedField === `${base}-n` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        <span className="ml-0.5">Nome</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-1.5 text-[10px]"
                        title="Copiar só o valor"
                        onClick={() => onCopy(`${base}-v`, row.value)}
                      >
                        {copiedField === `${base}-v` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        <span className="ml-0.5">Valor</span>
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-7 px-1.5 text-[10px]"
                        title="Copiar linha (nome e valor)"
                        onClick={() => onCopy(`${base}-l`, line)}
                      >
                        {copiedField === `${base}-l` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        <span className="ml-0.5">Linha</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="px-3 py-2 text-[10px] text-muted-foreground border-t border-border/40 bg-muted/10">
        Os tipos A/CNAME seguem a{" "}
        <a
          href="https://vercel.com/docs/projects/domains/working-with-domains"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2"
        >
          documentação de domínios da Vercel
        </a>{" "}
        (apex → registo A 76.76.21.21; subdomínio → CNAME para cname.vercel-dns.com). TXT quando a Vercel os pedir para
        verificação.
      </p>
    </div>
  );
}
