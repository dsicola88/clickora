import { useEffect } from "react";
import { PageRenderer } from "@/page-builder/components/PageRenderer";
import type { PageDocument } from "@/page-builder/types";
import { applyTrackingToDocument } from "@/page-builder/tracking";

/** Renderização síncrona (sem lazy) para a vista pública: evita o flash «Carregando página…» e o segundo desenho. */
export function PublicBuilderPresellView({ doc }: { doc: PageDocument }) {
  useEffect(() => {
    const t = doc.tracking;
    if (!t) return () => {};
    const cleanup = applyTrackingToDocument(t);
    return () => cleanup();
  }, [doc]);

  return <PageRenderer doc={doc} device="desktop" />;
}
