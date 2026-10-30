import { useEffect, useState, type CSSProperties } from "react";
import { Menu, X } from "lucide-react";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCssWidgetContent } from "../style-utils";

/**
 * Painel lateral (off-canvas): botão flutuante abre painel com HTML / links.
 */
export function OffCanvasWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const c = widget.content;
  const side = ((c.side as string) ?? "right") === "left" ? "left" : "right";
  const width = typeof c.width === "number" && c.width > 0 ? c.width : 320;
  const btnLabel = ((c.buttonLabel as string) ?? "Menu").trim() || "Menu";
  const html = ((c.html as string) ?? "").trim();
  const bg = ((c.panelBg as string) ?? "#0f172a").trim();
  const color = ((c.panelColor as string) ?? "#f8fafc").trim();
  const btnBg = ((c.buttonBg as string) ?? "#e63946").trim();
  const btnColor = ((c.buttonColor as string) ?? "#ffffff").trim();
  const position = ((c.position as string) ?? "bottom-right") as string;
  const css = stylesToCssWidgetContent(widget.styles, device);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const floatPos: CSSProperties =
    position === "bottom-left"
      ? { left: 16, bottom: 16 }
      : position === "top-right"
        ? { right: 16, top: 16 }
        : position === "top-left"
          ? { left: 16, top: 16 }
          : { right: 16, bottom: 16 };

  return (
    <div style={{ ...css, minHeight: 1 }}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          zIndex: 99980,
          ...floatPos,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 16px",
          borderRadius: 999,
          border: "none",
          background: btnBg,
          color: btnColor,
          fontWeight: 700,
          fontSize: 14,
          cursor: "pointer",
          boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
        }}
      >
        <Menu size={18} />
        {btnLabel}
      </button>

      {open ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99985,
            background: "rgba(15,23,42,0.45)",
          }}
          onClick={() => setOpen(false)}
        >
          <aside
            role="dialog"
            aria-modal
            aria-label={btnLabel}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              [side]: 0,
              width: `min(92vw, ${width}px)`,
              background: bg,
              color,
              padding: 24,
              overflow: "auto",
              boxShadow: "0 0 40px rgba(0,0,0,0.35)",
            }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar"
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                border: "none",
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
              }}
            >
              <X size={22} />
            </button>
            {html ? (
              <div dangerouslySetInnerHTML={{ __html: html }} />
            ) : (
              <p style={{ opacity: 0.7, fontSize: 14 }}>
                Adicione HTML do painel na aba Conteúdo.
              </p>
            )}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
