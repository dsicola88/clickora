import type { DeviceType, WidgetNode } from "../types";
import { stylesToCssWidgetContent, alignToFlexJustify } from "../style-utils";
import { resolveResponsive } from "../store";

type Net = "whatsapp" | "facebook" | "twitter" | "linkedin" | "copy";

const LABELS: Record<Net, string> = {
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  twitter: "X",
  linkedin: "LinkedIn",
  copy: "Copiar link",
};

function shareUrl(net: Net, pageUrl: string, text: string): string | null {
  const u = encodeURIComponent(pageUrl);
  const t = encodeURIComponent(text);
  switch (net) {
    case "whatsapp":
      return `https://wa.me/?text=${t}%20${u}`;
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    case "twitter":
      return `https://twitter.com/intent/tweet?url=${u}&text=${t}`;
    case "linkedin":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
    default:
      return null;
  }
}

export function ShareButtonsWidget({
  widget,
  device,
}: {
  widget: WidgetNode;
  device: DeviceType;
}) {
  const c = widget.content;
  const networks = (Array.isArray(c.networks) ? c.networks : ["whatsapp", "facebook", "twitter", "copy"]) as Net[];
  const text = ((c.text as string) ?? "Confira isto").trim();
  const urlOverride = ((c.url as string) ?? "").trim();
  const bg = ((c.buttonBg as string) ?? "#0f172a").trim();
  const color = ((c.buttonColor as string) ?? "#ffffff").trim();
  const gap = typeof c.gap === "number" ? c.gap : 8;
  const align = resolveResponsive(widget.styles.align, device);
  const css = stylesToCssWidgetContent(widget.styles, device);

  const pageUrl =
    urlOverride ||
    (typeof window !== "undefined" ? window.location.href : "https://example.com");

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap,
        justifyContent: alignToFlexJustify(align),
        ...css,
      }}
    >
      {networks.map((net) => {
        const href = shareUrl(net, pageUrl, text);
        const label = LABELS[net] ?? net;
        if (net === "copy") {
          return (
            <button
              key={net}
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(pageUrl);
              }}
              style={{
                border: "none",
                borderRadius: 8,
                padding: "10px 14px",
                background: bg,
                color,
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          );
        }
        return (
          <a
            key={net}
            href={href ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              borderRadius: 8,
              padding: "10px 14px",
              background: bg,
              color,
              fontWeight: 600,
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            {label}
          </a>
        );
      })}
    </div>
  );
}
