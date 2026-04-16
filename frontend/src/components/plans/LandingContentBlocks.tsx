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

  if (resolved.mode === "native") {
    return (
      <video
        className="w-full rounded-xl border border-white/10 bg-black shadow-lg"
        controls
        playsInline
        preload="metadata"
        src={resolved.src}
      />
    );
  }

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-xl shadow-lg",
        "aspect-video bg-black",
      )}
    >
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

export function LandingContentBlocks({ blocks, salesDark, salesTheme = null, className }: Props) {
  const list = blocks.filter((b) => {
    if (b.type === "video") return Boolean(b.url?.trim());
    if (b.type === "image") return Boolean(b.src?.trim());
    if (b.type === "rich_text") return Boolean(b.content?.trim());
    return false;
  });
  if (!list.length) return null;

  return (
    <div className={cn("space-y-12", className)}>
      {list.map((block, i) => (
        <article key={i} className="scroll-mt-24">
          {block.type === "rich_text" ? (
            <div
              className={cn(
                "w-full",
                block.layout === "wide" ? "max-w-none" : "mx-auto max-w-4xl",
                richTextBlockWrapperClass(block.background_color),
              )}
              style={
                block.background_color?.trim()
                  ? { backgroundColor: block.background_color.trim() }
                  : undefined
              }
            >
              <LandingMarkdown
                content={block.content}
                surface={salesDark && !block.text_color?.trim() ? "dark_page" : "inherit"}
                salesTheme={salesTheme}
                sizeClassName={richTextFontSizeClass(block.font_size)}
                className={cn(
                  richTextFontFamilyClass(block.font_family),
                  richTextFontWeightClass(block.font_weight),
                  richTextAlignClass(block.text_align),
                  "[&_p]:max-w-none [&_li]:text-inherit",
                )}
                colorOverrides={
                  block.text_color?.trim()
                    ? {
                        body: block.text_color.trim(),
                        heading: block.text_color.trim(),
                        link: salesTheme?.link ?? block.text_color.trim(),
                        border: salesTheme?.nav_border,
                      }
                    : null
                }
              />
            </div>
          ) : null}
          {(block.type === "video" || block.type === "image") &&
          (block.title?.trim() || block.subtitle?.trim()) ? (
            <header
              className={cn(
                "mb-4 max-w-3xl",
                block.layout === "wide" ? "text-left" : "mx-auto text-center",
              )}
            >
              {block.title?.trim() ? (
                <h2
                  className={cn(
                    "text-xl font-bold tracking-tight md:text-2xl",
                    salesDark ? "text-white" : "text-foreground",
                  )}
                >
                  {block.title}
                </h2>
              ) : null}
              {block.subtitle?.trim() ? (
                <p
                  className={cn(
                    "mt-2 text-sm whitespace-pre-line",
                    salesDark ? "text-white/75" : "text-muted-foreground",
                  )}
                >
                  {block.subtitle}
                </p>
              ) : null}
            </header>
          ) : null}

          {block.type === "video" ? (
            <div
              className={cn(
                "w-full",
                block.layout === "wide" ? "max-w-none" : "mx-auto max-w-4xl",
              )}
            >
              <VideoEmbed url={block.url} salesDark={salesDark} />
            </div>
          ) : block.type === "image" ? (
            <figure
              className={cn(
                "w-full",
                block.layout === "wide" ? "max-w-none" : "mx-auto max-w-4xl",
              )}
            >
              <div
                className={cn(
                  "overflow-hidden rounded-xl shadow-lg",
                  salesDark ? "ring-1 ring-white/10" : "border border-border/60",
                )}
              >
                <img
                  src={block.src}
                  alt={block.alt?.trim() || ""}
                  className="h-auto w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              {block.caption?.trim() ? (
                <figcaption
                  className={cn(
                    "mt-3 text-center text-sm",
                    salesDark ? "text-white/60" : "text-muted-foreground",
                  )}
                >
                  {block.caption}
                </figcaption>
              ) : null}
            </figure>
          ) : null}
        </article>
      ))}
    </div>
  );
}
