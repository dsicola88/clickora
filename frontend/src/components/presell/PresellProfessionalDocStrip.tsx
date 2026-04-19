import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "https://support.google.com/google-ads/answer/6331314", label: "Google Ads · Conversões" },
  { href: "https://developers.google.com/tag-platform/gtagjs", label: "gtag.js" },
  { href: "https://support.google.com/analytics/answer/9304153", label: "GA4 · Measurement ID" },
  { href: "https://developers.facebook.com/docs/meta-pixel", label: "Meta Pixel" },
  { href: "https://help.ads.microsoft.com/#apex/ads/en/56713/2", label: "Microsoft Ads · UET" },
  { href: "https://ads.tiktok.com/help/article/get-started-pixel", label: "TikTok Pixel" },
] as const;

type Props = { isEditor?: boolean };

/** Ligações oficiais para configurar tags em cada rede (abrem em novo separador). */
export function PresellProfessionalDocStrip({ isEditor }: Props) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5",
        isEditor ? "border-editor-border bg-editor-panel-2/60" : "border-border/60 bg-muted/25",
      )}
    >
      <p
        className={cn(
          "text-[11px] font-medium uppercase tracking-wide mb-2",
          isEditor ? "text-editor-fg-muted" : "text-muted-foreground",
        )}
      >
        Documentação das redes
      </p>
      <div className="flex flex-wrap gap-1.5">
        {LINKS.map((l) => (
          <a
            key={l.href}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
              isEditor
                ? "border-editor-border bg-editor-panel text-editor-fg hover:bg-editor-border/80"
                : "border-border/70 bg-background text-foreground hover:bg-muted/80",
            )}
          >
            {l.label}
            <ExternalLink className="h-3 w-3 opacity-70" aria-hidden />
          </a>
        ))}
      </div>
    </div>
  );
}
