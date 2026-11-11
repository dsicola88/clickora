import {
  embedUrlForSectionBackground,
  resolvePageBuilderVideoUrl,
} from "../videoEmbed";
import { useAppLocale } from "@/i18n/AppLocaleProvider";

/**
 * Camada de vídeo atrás do conteúdo da secção (YouTube / Bunny).
 * `pointerEventsNone` no editor para não bloquear cliques no canvas.
 */
export function SectionBackgroundVideo({
  rawUrl,
  pointerEventsNone,
}: {
  rawUrl: string;
  pointerEventsNone?: boolean;
}) {
  const { t } = useAppLocale();
  const resolved = resolvePageBuilderVideoUrl(rawUrl.trim());
  if (!resolved) return null;
  const src = embedUrlForSectionBackground(resolved);

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        overflow: "hidden",
        pointerEvents: pointerEventsNone ? "none" : "auto",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "177.78vh",
          minWidth: "100%",
          height: "56.25vw",
          minHeight: "100%",
          transform: "translate(-50%, -50%)",
        }}
      >
        <iframe
          title={t("pages.pageBuilder.chrome.bgVideoTitle")}
          src={src}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: 0,
          }}
        />
      </div>
    </div>
  );
}
