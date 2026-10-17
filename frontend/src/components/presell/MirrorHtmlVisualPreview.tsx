import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { applyMirrorEphemeralEditMode } from "@/lib/mirrorEphemeralEdit";
import { cn } from "@/lib/utils";

export type MirrorHtmlVisualPreviewHandle = {
  /** HTML completo do documento do iframe (com marcas efémeras — o backend limpa ao guardar). */
  captureDocumentHtml: () => string | null;
};

type Props = {
  srcDoc: string;
  editMode?: boolean;
  className?: string;
};

export const MirrorHtmlVisualPreview = forwardRef<MirrorHtmlVisualPreviewHandle, Props>(
  function MirrorHtmlVisualPreview({ srcDoc, editMode = true, className }, ref) {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useImperativeHandle(ref, () => ({
      captureDocumentHtml() {
        try {
          const doc = iframeRef.current?.contentDocument;
          const root = doc?.documentElement;
          if (!root) return null;
          return root.outerHTML;
        } catch {
          return null;
        }
      },
    }));

    const onLoad = useCallback(() => {
      if (!editMode) return;
      try {
        const doc = iframeRef.current?.contentDocument;
        if (doc) applyMirrorEphemeralEditMode(doc);
      } catch {
        /* sandbox */
      }
    }, [editMode]);

    useEffect(() => {
      if (!editMode) return;
      try {
        const doc = iframeRef.current?.contentDocument;
        if (doc?.readyState === "complete") applyMirrorEphemeralEditMode(doc);
      } catch {
        /* ignore */
      }
    }, [editMode, srcDoc]);

    if (!srcDoc.trim() || srcDoc.trim().length < 200) return null;

    return (
      <div className={cn("rounded-lg border border-border/60 overflow-hidden bg-white", className)}>
        <p className="text-[11px] text-muted-foreground px-3 py-2 border-b border-border/50 bg-muted/20">
          Edição visual: clique nos textos destacados. Links e botões de compra não são editáveis. Ao{" "}
          <span className="font-medium text-foreground/90">Guardar</span>, o servidor limpa o HTML para a página
          pública.
        </p>
        <iframe
          ref={iframeRef}
          title="Pré-visualização editável do espelho"
          srcDoc={srcDoc}
          onLoad={onLoad}
          className="w-full min-h-[min(60vh,480px)] border-0 block"
          sandbox="allow-same-origin"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    );
  },
);
