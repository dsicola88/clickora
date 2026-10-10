import { createContext, useContext, type CSSProperties } from "react";

type Commit = (patch: Record<string, unknown>) => void;

const InlineEditContext = createContext<Commit | null>(null);

export const InlineEditProvider = InlineEditContext.Provider;

export function useInlineEdit() {
  return useContext(InlineEditContext);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Texto editável no canvas. Na página publicada fica estático. */
export function InlinePlain({
  value,
  field,
  style,
  className,
}: {
  value: string;
  field: string;
  style?: CSSProperties;
  className?: string;
}) {
  const commit = useInlineEdit();
  if (!commit) return <span style={style} className={className}>{value}</span>;
  return (
    <span
      style={style}
      className={className}
      contentEditable
      suppressContentEditableWarning
      dangerouslySetInnerHTML={{ __html: escapeHtml(value) }}
      onMouseDown={(event) => event.stopPropagation()}
      onBlur={(event) => {
        const next = event.currentTarget.textContent ?? "";
        if (next !== value) commit({ [field]: next });
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
    />
  );
}
