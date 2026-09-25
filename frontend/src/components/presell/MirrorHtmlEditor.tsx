import { useState } from "react";
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (html: string) => void;
  onReimport?: () => void;
  reimportBusy?: boolean;
  className?: string;
};

/**
 * Editor do HTML espelhado (import Playwright). Guarda em `content.importMirrorSrcDoc`.
 * Re-import sincroniza de novo a partir do URL do produto.
 */
export function MirrorHtmlEditor({
  value,
  onChange,
  onReimport,
  reimportBusy = false,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const len = value.length;
  const healthy = len > 800;

  return (
    <div className={cn("space-y-2", className)}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="w-full flex items-center justify-between gap-3 rounded-xl px-4 py-4 sm:px-6 border border-border/50 bg-card hover:bg-muted/30 text-card-foreground transition-colors cursor-pointer text-left min-w-0">
          <div className="min-w-0">
            <span className="font-medium">Espelho HTML (1:1)</span>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {healthy
                ? `${len.toLocaleString("pt-PT")} caracteres — activo na página pública`
                : len > 0
                  ? `${len.toLocaleString("pt-PT")} caracteres — curto demais; a UI React pode substituir`
                  : "Sem espelho — a página usa o layout React importado"}
            </p>
          </div>
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="rounded-b-xl px-4 py-4 sm:px-6 border-x border-b border-border/50 bg-card space-y-3">
            <p className="text-[11px] leading-relaxed text-muted-foreground rounded-md border border-border/60 bg-muted/30 px-2.5 py-2">
              Edite o HTML do clone com cuidado. Scripts externos e JS da origem não correm no iframe.
              Use «Re-importar» para voltar a capturar a página do produto (Playwright + rehost R2 se
              configurado). Ao guardar, imagens http externas no espelho são reconciliadas de novo para o R2.
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="mirror-html-editor">importMirrorSrcDoc</Label>
              {onReimport ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={reimportBusy}
                  onClick={onReimport}
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", reimportBusy && "animate-spin")} />
                  {reimportBusy ? "A re-importar…" : "Re-importar da URL"}
                </Button>
              ) : null}
            </div>
            <Textarea
              id="mirror-html-editor"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="min-h-[220px] font-mono text-[11px] leading-snug"
              spellCheck={false}
              placeholder="<!DOCTYPE html>…"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
