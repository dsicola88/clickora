import type { DeviceType, WidgetNode } from "../types";
import { stylesToCssWidgetContent } from "../style-utils";

export interface GoogleMapsContent {
  /** Endereço ou query de pesquisa (ex.: "Lisboa, Portugal"). */
  query: string;
  zoom: number;
  height: number;
  /** URL completa do iframe Google Maps Embed (opcional; se preenchida, ignora query). */
  embedUrl: string;
}

function buildEmbedSrc(c: Partial<GoogleMapsContent>): string {
  const custom = (c.embedUrl ?? "").trim();
  if (custom) return custom;
  const q = encodeURIComponent((c.query ?? "Lisboa, Portugal").trim() || "Lisboa, Portugal");
  const zoom = Math.max(1, Math.min(21, c.zoom ?? 14));
  return `https://maps.google.com/maps?q=${q}&z=${zoom}&output=embed`;
}

export function GoogleMapsWidget({
  widget,
  device,
}: {
  widget: WidgetNode;
  device: DeviceType;
}) {
  const c = widget.content as Partial<GoogleMapsContent>;
  const height = Math.max(120, c.height ?? 320);
  const src = buildEmbedSrc(c);

  return (
    <div style={{ ...stylesToCssWidgetContent(widget.styles, device), width: "100%" }}>
      <iframe
        title="Google Maps"
        src={src}
        width="100%"
        height={height}
        style={{ border: 0, displayRadius: widget.styles.border?.radius ?? 8, display: "block" }}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
    </div>
  );
}
