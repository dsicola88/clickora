import type { ReactNode } from "react";

/** Secção partilhada dos editors do PropertyPanel — evita drift de estilo. */
export function PanelSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="border-b border-editor-border p-3 last:border-0">
      {title ? (
        <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-editor-fg-muted">
          {title}
        </h4>
      ) : null}
      <div className="space-y-3">{children}</div>
    </div>
  );
}
