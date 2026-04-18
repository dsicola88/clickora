import type { DeviceType, WidgetNode } from "../types";
import { stylesToCss } from "../style-utils";

function youtubeIdFromUrl(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export function VideoWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const url = (widget.content.url as string) ?? "";
  const ytId = youtubeIdFromUrl(url);
  const css = stylesToCss(widget.styles, device);

  return (
    <div style={{ ...css, position: "relative", paddingBottom: "56.25%", height: 0 }}>
      {ytId ? (
        <iframe
          src={`https://www.youtube.com/embed/${ytId}`}
          title="Vídeo"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
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
            fontSize: 14,
          }}
        >
          Cole uma URL do YouTube
        </div>
      )}
    </div>
  );
}
