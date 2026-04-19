import { AlertCircle, Play } from "lucide-react";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCssWidgetContent } from "../style-utils";
import { resolvePageBuilderVideoUrl } from "../videoEmbed";

function VideoPlaceholder({
  variant,
  title,
  subtitle,
}: {
  variant: "empty" | "error";
  title: string;
  subtitle: string;
}) {
  const bg =
    variant === "error"
      ? "linear-gradient(165deg, #3f1d1d 0%, #5c2a2a 45%, #7f2d2d 100%)"
      : "linear-gradient(165deg, #1e1b2e 0%, #4c1d5c 38%, #9d3d6f 72%, #e8a87c 100%)";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: bg,
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: 20,
        lineHeight: 1.45,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 10,
          left: 12,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          opacity: 0.75,
        }}
      >
        Vídeo
      </span>
      {variant === "error" ? (
        <AlertCircle
          style={{ width: 44, height: 44, marginBottom: 12, opacity: 0.95 }}
          strokeWidth={1.75}
        />
      ) : (
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.18)",
            border: "2px solid rgba(255,255,255,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 14,
            boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
          }}
        >
          <Play
            style={{ width: 36, height: 36, marginLeft: 5, opacity: 0.95 }}
            strokeWidth={1.5}
            fill="rgba(255,255,255,0.15)"
          />
        </div>
      )}
      <p style={{ fontSize: 16, fontWeight: 600, margin: "0 0 8px", maxWidth: 320 }}>{title}</p>
      <p style={{ fontSize: 12, opacity: 0.88, maxWidth: 340, margin: 0 }}>{subtitle}</p>
    </div>
  );
}

export function VideoWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const url = (widget.content.url as string) ?? "";
  const resolved = resolvePageBuilderVideoUrl(url);
  const css = stylesToCssWidgetContent(widget.styles, device);

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
      ) : url.trim() ? (
        <VideoPlaceholder
          variant="error"
          title="Ligação não suportada"
          subtitle="Usa um URL do YouTube ou do Bunny Stream (página Play ou iframe mediadelivery.net)."
        />
      ) : (
        <VideoPlaceholder
          variant="empty"
          title="Escolhe o vídeo"
          subtitle="Painel à direita → Conteúdo → YouTube ou Bunny.net — cola o link do vídeo (não é upload de ficheiro)."
        />
      )}
    </div>
  );
}
