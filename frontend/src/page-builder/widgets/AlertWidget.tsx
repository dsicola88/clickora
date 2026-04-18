import { useState } from "react";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCss } from "../style-utils";
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";

type AlertVariant = "info" | "success" | "warning" | "danger";

const VARIANT_STYLES: Record<
  AlertVariant,
  { bg: string; border: string; title: string; body: string; icon: typeof Info }
> = {
  info: {
    bg: "#eff6ff",
    border: "#bfdbfe",
    title: "#1e3a8a",
    body: "#1e40af",
    icon: Info,
  },
  success: {
    bg: "#ecfdf5",
    border: "#a7f3d0",
    title: "#064e3b",
    body: "#047857",
    icon: CheckCircle2,
  },
  warning: {
    bg: "#fffbeb",
    border: "#fde68a",
    title: "#78350f",
    body: "#92400e",
    icon: TriangleAlert,
  },
  danger: {
    bg: "#fef2f2",
    border: "#fecaca",
    title: "#7f1d1d",
    body: "#b91c1c",
    icon: AlertCircle,
  },
};

export function AlertWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const c = widget.content as Record<string, unknown>;
  const variant = (["info", "success", "warning", "danger"].includes(c.variant as string)
    ? c.variant
    : "info") as AlertVariant;
  const palette = VARIANT_STYLES[variant];
  const title = (c.title as string) ?? "";
  const message = (c.message as string) ?? "";
  const showIcon = (c.showIcon as boolean) ?? true;
  const dismissible = (c.dismissible as boolean) ?? false;
  const borderRadius = typeof c.borderRadius === "number" ? c.borderRadius : 10;
  const [dismissed, setDismissed] = useState(false);

  const outer = stylesToCss(widget.styles, device);

  if (dismissed) return null;

  const Icon = palette.icon;

  return (
    <div style={outer}>
      <div
        role="status"
        style={{
          display: "flex",
          gap: 14,
          alignItems: "flex-start",
          padding: "16px 18px",
          borderRadius,
          background: palette.bg,
          border: `1px solid ${palette.border}`,
          boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
        }}
      >
        {showIcon ? (
          <span style={{ flexShrink: 0, color: palette.title, marginTop: 2 }} aria-hidden>
            <Icon size={22} strokeWidth={2} />
          </span>
        ) : null}
        <div style={{ flex: 1, minWidth: 0 }}>
          {title ? (
            <p
              style={{
                margin: 0,
                marginBottom: message ? 6 : 0,
                fontSize: 15,
                fontWeight: 600,
                color: palette.title,
                lineHeight: 1.35,
              }}
            >
              {title}
            </p>
          ) : null}
          {message ? (
            <div
              style={{
                fontSize: 14,
                lineHeight: 1.55,
                color: palette.body,
              }}
              // eslint-disable-next-line react/no-danger -- author-controlled rich text
              dangerouslySetInnerHTML={{ __html: message }}
            />
          ) : null}
        </div>
        {dismissible ? (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Fechar aviso"
            style={{
              flexShrink: 0,
              border: "none",
              background: "rgba(255,255,255,0.55)",
              borderRadius: 8,
              padding: 6,
              cursor: "pointer",
              color: palette.title,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={18} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
