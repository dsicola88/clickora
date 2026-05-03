import type { ReactNode } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { cn } from "@/lib/utils";

type Props = {
  /** Gravado no `localStorage` do browser (painéis arrastáveis). */
  autoSaveId: string;
  /** Formulário principal do assistente. */
  form: ReactNode;
  /** Pré‑visualização (mockup carteira ou feed). */
  preview: ReactNode;
  /** Classe opcional no grupo de desktop. */
  className?: string;
};

/**
 * Em ecrãs largos permite redimensionar o separador entre formulário e pré‑visualização
 * (estilo Gmail / consolas). Em mobile mantém‑se coluna empilhada (pré‑visualização no topo).
 */
export function DpilotAdsWizardFormPreviewSplit({ autoSaveId, form, preview, className }: Props) {
  return (
    <>
      <div className="flex flex-col gap-8 lg:hidden">
        {preview}
        {form}
      </div>

      <div className={cn("hidden lg:block", className)}>
        <div className="rounded-xl border border-border/70 bg-muted/20 p-1">
          <p className="px-3 py-2 text-[10px] leading-snug text-muted-foreground border-b border-border/50">
            Ponteiro sobre a barra entre colunas para redimensionar. A proporção gravada apenas neste
            navegador.
          </p>
          <ResizablePanelGroup
            direction="horizontal"
            autoSaveId={autoSaveId}
            className="min-h-[min(620px,calc(100vh-240px))] rounded-b-lg bg-background"
          >
            <ResizablePanel defaultSize={60} minSize={38} className="min-w-0">
              <div className="h-full overflow-y-auto p-5 pr-2">{form}</div>
            </ResizablePanel>
            <ResizableHandle
              withHandle
              title="Redimensionar colunas"
              className="w-3 shrink-0 bg-border/70 transition-colors hover:bg-primary/20 data-[resize-handle-active]:bg-primary/30"
            />
            <ResizablePanel defaultSize={40} minSize={26} maxSize={55} className="min-w-0">
              <div className="h-full overflow-y-auto p-4 pl-2">{preview}</div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </>
  );
}
