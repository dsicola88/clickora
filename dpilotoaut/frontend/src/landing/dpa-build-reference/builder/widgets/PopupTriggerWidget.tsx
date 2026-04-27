import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCss } from "../style-utils";

export interface PopupTriggerContent {
  triggerType: "click" | "scroll" | "exit" | "delay";
  triggerLabel: string;
  triggerBg: string;
  triggerColor: string;
  scrollPercent: number;
  delaySeconds: number;
  popupTitle: string;
  popupContent: string;
  popupCtaText: string;
  popupCtaHref: string;
  popupBg: string;
  popupColor: string;
  ctaBg: string;
  ctaColor: string;
  showOnce: boolean;
}

export function PopupTriggerWidget({
  widget,
  device,
}: {
  widget: WidgetNode;
  device: DeviceType;
}) {
  const c = widget.content as Partial<PopupTriggerContent>;
  const triggerType = c.triggerType ?? "click";
  const showOnce = c.showOnce ?? false;
  const storageKey = `lov-popup-${widget.id}`;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (showOnce && sessionStorage.getItem(storageKey)) return;

    const trigger = () => {
      if (showOnce) sessionStorage.setItem(storageKey, "1");
      setOpen(true);
    };

    if (triggerType === "scroll") {
      const pct = (c.scrollPercent ?? 50) / 100;
      const onScroll = () => {
        const scrolled =
          (window.scrollY + window.innerHeight) /
          Math.max(1, document.documentElement.scrollHeight);
        if (scrolled >= pct) {
          window.removeEventListener("scroll", onScroll);
          trigger();
        }
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => window.removeEventListener("scroll", onScroll);
    }
    if (triggerType === "exit") {
      const onLeave = (e: MouseEvent) => {
        if (e.clientY <= 0) {
          document.removeEventListener("mouseleave", onLeave);
          trigger();
        }
      };
      document.addEventListener("mouseleave", onLeave);
      return () => document.removeEventListener("mouseleave", onLeave);
    }
    if (triggerType === "delay") {
      const t = setTimeout(trigger, (c.delaySeconds ?? 5) * 1000);
      return () => clearTimeout(t);
    }
  }, [triggerType, c.scrollPercent, c.delaySeconds, showOnce, storageKey]);

  const popup = open ? (
    <div
      onClick={() => setOpen(false)}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        animation: "lov-fade-in 0.25s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: c.popupBg ?? "#ffffff",
          color: c.popupColor ?? "#0f172a",
          padding: 32,
          borderRadius: 12,
          maxWidth: 480,
          width: "100%",
          position: "relative",
          boxShadow: "0 25px 70px rgba(0,0,0,.35)",
          animation: "lov-zoom-in 0.3s ease",
        }}
      >
        <button
          type="button"
          aria-label="Fechar"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(false);
          }}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "currentColor",
            opacity: 0.6,
            padding: 4,
          }}
        >
          <X size={20} />
        </button>
        <h3 style={{ margin: "0 0 12px", fontSize: 22, fontWeight: 700 }}>
          {c.popupTitle ?? "Oferta especial"}
        </h3>
        <p style={{ margin: "0 0 20px", fontSize: 15, lineHeight: 1.6, opacity: 0.85 }}>
          {c.popupContent ?? "Conteúdo do popup. Edite no painel."}
        </p>
        {c.popupCtaText && (
          <a
            href={c.popupCtaHref || "#"}
            style={{
              display: "inline-block",
              background: c.ctaBg ?? "#e63946",
              color: c.ctaColor ?? "#ffffff",
              padding: "12px 24px",
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            {c.popupCtaText}
          </a>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div style={stylesToCss(widget.styles, device)}>
      {triggerType === "click" && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          style={{
            background: c.triggerBg ?? "#e63946",
            color: c.triggerColor ?? "#ffffff",
            border: "none",
            padding: "12px 24px",
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {c.triggerLabel ?? "Abrir popup"}
        </button>
      )}
      {triggerType !== "click" && (
        <div
          style={{
            padding: 12,
            background: "#f3f4f6",
            border: "1px dashed #cbd5e1",
            borderRadius: 6,
            fontSize: 12,
            color: "#64748b",
            textAlign: "center",
          }}
        >
          Popup será exibido por gatilho: <strong>{triggerType}</strong>
        </div>
      )}
      {popup}
    </div>
  );
}
