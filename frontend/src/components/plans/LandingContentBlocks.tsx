import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { resolveVideoEmbedUrl } from "@/lib/resolveVideoEmbed";
import type { LandingContentBlock } from "@/lib/plansLandingExtras";
import { LandingMarkdown } from "@/components/plans/LandingMarkdown";
import type { ResolvedLandingPageTheme } from "@/lib/landingPageTheme";
import {
  richTextAlignClass,
  richTextBlockWrapperClass,
  richTextFontFamilyClass,
  richTextFontSizeClass,
  richTextFontWeightClass,
} from "@/lib/landingRichTextBlock";

type Props = {
  blocks: LandingContentBlock[];
  salesDark: boolean;
  /** Tema resolvido (aparencia escura); necessário para Markdown nos blocos `rich_text`. */
  salesTheme?: ResolvedLandingPageTheme | null;
  className?: string;
};

function VideoEmbed({ url, salesDark }: { url: string; salesDark: boolean }) {
  const resolved = resolveVideoEmbedUrl(url);
  if (!resolved) {
    return (
      <div
        className={cn(
          "rounded-xl border px-4 py-6 text-center text-sm",
          salesDark ? "border-white/15 bg-white/5 text-white/70" : "border-border bg-muted/40 text-muted-foreground",
        )}
      >
        <p>Não foi possível incorporar este vídeo.</p>
        <p className="mt-2 break-all text-xs opacity-80">{url}</p>
      </div>
    );
  }

  /** 16:9 responsivo: encaixa na célula da grelha e escala com o ecrã. */
  const frameCn =
    "relative aspect-video w-full max-w-full overflow-hidden rounded-xl bg-black shadow-lg";

  if (resolved.mode === "native") {
    return (
      <div className={frameCn}>
        <video
          className="absolute inset-0 h-full w-full object-contain"
          controls
          playsInline
          preload="metadata"
          src={resolved.src}
        />
      </div>
    );
  }

  return (
    <div className={frameCn}>
      <iframe
        title="Vídeo incorporado"
        src={resolved.src}
        className="absolute inset-0 h-full w-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}

type MediaBlock = Extract<LandingContentBlock, { type: "video" | "image" }>;

function MediaTile({
  block,
  salesDark,
}: {
  block: MediaBlock;
  salesDark: boolean;
}) {
  const hasHeader = Boolean(block.title?.trim() || block.subtitle?.trim());

  return (
    <div className="flex min-w-0 w-full max-w-full flex-col gap-2">
      {hasHeader ? (
        <header className="space-y-1 text-center">
          {block.title?.trim() ? (
            <h2
              className={cn(
                "text-sm font-bold leading-snug md:text-base",
                salesDark ? "text-white" : "text-foreground",
              )}
            >
              {block.title}
            </h2>
          ) : null}
          {block.subtitle?.trim() ? (
            <p
              className={cn(
                "whitespace-pre-line text-[11px] leading-snug md:text-xs",
                salesDark ? "text-white/75" : "text-muted-foreground",
              )}
            >
              {block.subtitle}
            </p>
          ) : null}
        </header>
      ) : null}

      {block.type === "video" ? (
        <VideoEmbed url={block.url} salesDark={salesDark} />
      ) : (
        <figure className="min-w-0 w-full max-w-full">
          <div
            className={cn(
              "relative aspect-video w-full max-w-full overflow-hidden rounded-xl shadow-lg",
              salesDark ? "bg-black/25 ring-1 ring-white/10" : "border border-border/60 bg-muted/30",
            )}
          >
            <img
              src={block.src}
              alt={block.alt?.trim() || ""}
              className="h-full w-full object-contain object-center"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              loading="lazy"
              decoding="async"
            />
          </div>
          {block.caption?.trim() ? (
            <figcaption
              className={cn(
                "mt-2 text-center text-[11px] leading-snug md:text-xs",
                salesDark ? "text-white/60" : "text-muted-foreground",
              )}
            >
              {block.caption}
            </figcaption>
          ) : null}
        </figure>
      )}
    </div>
  );
}

type Segment =
  | { kind: "media_row"; blocks: MediaBlock[] }
  | { kind: "rich_text"; block: Extract<LandingContentBlock, { type: "rich_text" }> };

function buildSegments(list: LandingContentBlock[]): Segment[] {
  const out: Segment[] = [];
  let mediaBuf: MediaBlock[] = [];
  const flush = () => {
    if (mediaBuf.length) {
      out.push({ kind: "media_row", blocks: mediaBuf });
      mediaBuf = [];
    }
  };
  for (const b of list) {
    if (b.type === "rich_text") {
      flush();
      out.push({ kind: "rich_text", block: b });
    } else {
      mediaBuf.push(b);
    }
  }
  flush();
  return out;
}

export function LandingContentBlocks({ blocks, salesDark, salesTheme = null, className }: Props) {
  const list = blocks.filter((b) => {
    if (b.type === "video") return Boolean(b.url?.trim());
    if (b.type === "image") return Boolean(b.src?.trim());
    if (b.type === "rich_text") return Boolean(b.content?.trim());
    return false;
  });
  if (!list.length) return null;

  const segments = buildSegments(list);

  return (
    <div className={cn("space-y-12", className)}>
      {segments.map((seg, si) => (
        <Fragment key={si}>
          {seg.kind === "media_row" ? (
            <div
              className={cn(
                "grid w-full gap-3 sm:gap-4",
                /* auto-fit + 1fr: cada célula estica e partilha a linha; mín. ~160px por coluna */
                "[grid-template-columns:repeat(auto-fit,minmax(min(100%,160px),1fr))]",
              )}
            >
              {seg.blocks.map((block, bi) => (
                <article key={`${si}-${bi}`} className="scroll-mt-24 min-w-0 w-full max-w-full">
                  <MediaTile block={block} salesDark={salesDark} />
                </article>
              ))}
            </div>
          ) : (
            <article className="scroll-mt-24">
              <div
                className={cn(
                  "w-full",
                  seg.block.layout === "wide" ? "max-w-none" : "mx-auto max-w-4xl",
                  richTextBlockWrapperClass(seg.block.background_color),
                )}
                style={
                  seg.block.background_color?.trim()
                    ? { backgroundColor: seg.block.background_color.trim() }
                    : undefined
                }
              >
                <LandingMarkdown
                  content={seg.block.content}
                  surface={salesDark && !seg.block.text_color?.trim() ? "dark_page" : "inherit"}
                  salesTheme={salesTheme}
                  sizeClassName={richTextFontSizeClass(seg.block.font_size)}
                  className={cn(
                    richTextFontFamilyClass(seg.block.font_family),
                    richTextFontWeightClass(seg.block.font_weight),
                    richTextAlignClass(seg.block.text_align),
                    "[&_p]:max-w-none [&_li]:text-inherit",
                  )}
                  colorOverrides={
                    seg.block.text_color?.trim()
                      ? {
                          body: seg.block.text_color.trim(),
                          heading: seg.block.text_color.trim(),
                          link: salesTheme?.link ?? seg.block.text_color.trim(),
                          border: salesTheme?.nav_border,
                        }
                      : null
                  }
                />
              </div>
            </article>
          )}
        </Fragment>
      ))}
    </div>
  );
}
