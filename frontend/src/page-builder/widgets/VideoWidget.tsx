import type { DeviceType, WidgetNode } from "../types";
import { stylesToCss } from "../style-utils";
import { resolvePageBuilderVideoUrl } from "../videoEmbed";

export function VideoWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const url = (widget.content.url as string) ?? "";
  const resolved = resolvePageBuilderVideoUrl(url);
  const css = stylesToCss(widget.styles, device);

  return (
    <div style={{ ...css, position: "relative", paddingBottom: "56.25%", height: 0 }}>
      {resolved ? (
        <iframe
          src={resolved.embedUrl}
          title="Vídeo"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: 0,
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "#1a1a1a",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            textAlign: "center",
            padding: 16,
            lineHeight: 1.5,
          }}
        >
          {url.trim()
            ? "URL não reconhecida. Use um link do YouTube ou do Bunny Stream (Play ou iframe embed)."
            : "Cole no painel uma URL do YouTube ou do Bunny (video.bunnycdn.com/play/… ou iframe.mediadelivery.net/embed/…)."}
        </div>
      )}
    </div>
  );
}
