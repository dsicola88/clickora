import { lazy, Suspense, useEffect } from "react";
import type { PageDocument } from "@/page-builder/types";
import { applyTrackingToDocument } from "@/page-builder/tracking";

const PageRenderer = lazy(() =>
  import("@/page-builder/components/PageRenderer").then((m) => ({ default: m.PageRenderer })),
);

export function PublicBuilderPresellView({ doc }: { doc: PageDocument }) {
  useEffect(() => {
    const t = doc.tracking;
    if (!t) return () => {};
    const cleanup = applyTrackingToDocument(t);
    return () => cleanup();
  }, [doc]);

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center bg-background text-muted-foreground text-sm">
          Carregando página…
        </div>
      }
    >
      <PageRenderer doc={doc} device="desktop" />
    </Suspense>
  );
}
