import type { LandingGalleryCarouselOptions } from "@/lib/plansLandingExtras";

/** Valores finais para o carrossel (grelha ou ausente → defaults). */
export function resolveGalleryCarouselOptions(
  raw: LandingGalleryCarouselOptions | null | undefined,
): Required<LandingGalleryCarouselOptions> {
  const r = raw ?? {};
  return {
    autoplay: Boolean(r.autoplay),
    interval_ms:
      typeof r.interval_ms === "number" && r.interval_ms >= 2000 && r.interval_ms <= 120000
        ? r.interval_ms
        : 5000,
    show_arrows: r.show_arrows !== false,
    show_dots: r.show_dots !== false,
    slides_desktop:
      typeof r.slides_desktop === "number"
        ? (Math.min(4, Math.max(1, Math.floor(r.slides_desktop))) as 1 | 2 | 3 | 4)
        : 3,
    slides_mobile:
      typeof r.slides_mobile === "number"
        ? (Math.min(2, Math.max(1, Math.floor(r.slides_mobile))) as 1 | 2)
        : 1,
    loop: r.loop !== false,
    gap_px:
      typeof r.gap_px === "number" ? Math.min(64, Math.max(0, Math.floor(r.gap_px))) : 16,
  };
}

/** Classes Tailwind para largura de cada slide (mobile e desktop). */
export function galleryCarouselItemBasisClasses(slidesMobile: 1 | 2, slidesDesktop: 1 | 2 | 3 | 4): string {
  const mob = slidesMobile === 2 ? "basis-1/2" : "basis-full";
  const desk: Record<1 | 2 | 3 | 4, string> = {
    1: "md:basis-full",
    2: "md:basis-1/2",
    3: "md:basis-1/3",
    4: "md:basis-1/4",
  };
  return `${mob} ${desk[slidesDesktop]}`;
}
