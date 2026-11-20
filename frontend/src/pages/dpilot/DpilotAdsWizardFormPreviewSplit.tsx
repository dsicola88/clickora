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
 * Formulário amplo + pré-visualização só a partir de xl (evita aspecto apertado em laptop).
 */
export function DpilotAdsWizardFormPreviewSplit({ autoSaveId, form, preview, className }: Props) {
  return (
    <>
      {/* Até xl: formulário a 100%; preview no fim, sem roubar largura. */}
      <div className="flex flex-col gap-10 xl:hidden">
        {form}
        <div className="mx-auto w-full max-w-md border-t border-border/50 pt-8">{preview}</div>
      </div>

      <div className={cn("hidden xl:block", className)}>
        <ResizablePanelGroup
          direction="horizontal"
          autoSaveId={autoSaveId}
          className="min-h-[min(640px,calc(100vh-220px))]"
        >
          <ResizablePanel defaultSize={68} minSize={52} className="min-w-0">
            <div className="h-full overflow-y-auto pr-6">{form}</div>
          </ResizablePanel>
          <ResizableHandle
            withHandle
            title="Redimensionar formulário e pré-visualização"
            className="mx-1 w-px shrink-0 bg-border/80 transition-colors hover:bg-primary/40 data-[resize-handle-active]:bg-primary/50"
          />
          <ResizablePanel defaultSize={32} minSize={24} maxSize={42} className="min-w-0">
            <div className="h-full overflow-y-auto pl-4">{preview}</div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </>
  );
}
