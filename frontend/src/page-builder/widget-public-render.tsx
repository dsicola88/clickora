import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { DeviceType, WidgetNode, WidgetType } from "./types";

type WidgetRender = ComponentType<{ widget: WidgetNode; device: DeviceType }>;
type LazyRender = LazyExoticComponent<WidgetRender>;

/**
 * Widgets da 1.ª dobra — estáticos no chunk público para LCP rápido.
 * O resto carrega sob demanda (code-split) para não puxar ~todos os widgets + lucide.
 */
import { HeadingWidget } from "./widgets/HeadingWidget";
import { TextWidget } from "./widgets/TextWidget";
import { ImageWidget } from "./widgets/ImageWidget";
import { ButtonWidget } from "./widgets/ButtonWidget";
import { SpacerWidget } from "./widgets/SpacerWidget";
import { DividerWidget } from "./widgets/DividerWidget";
import { HtmlWidget } from "./widgets/HtmlWidget";
import { NavMenuWidget } from "./widgets/NavMenuWidget";
import { CookieBannerWidget } from "./widgets/CookieBannerWidget";
import { ContainerWidget } from "./widgets/ContainerWidget";

const CORE: Partial<Record<WidgetType, WidgetRender>> = {
  heading: HeadingWidget,
  text: TextWidget,
  image: ImageWidget,
  button: ButtonWidget,
  spacer: SpacerWidget,
  divider: DividerWidget,
  html: HtmlWidget,
  navMenu: NavMenuWidget,
  cookieBanner: CookieBannerWidget,
  container: ContainerWidget,
};

function lz(loader: () => Promise<{ default: WidgetRender }>): LazyRender {
  return lazy(loader);
}

const LAZY: Partial<Record<WidgetType, LazyRender>> = {
  video: lz(() => import("./widgets/VideoWidget").then((m) => ({ default: m.VideoWidget }))),
  icon: lz(() => import("./widgets/IconWidget").then((m) => ({ default: m.IconWidget }))),
  form: lz(() => import("./widgets/FormWidget").then((m) => ({ default: m.FormWidget }))),
  testimonials: lz(() =>
    import("./widgets/TestimonialsWidget").then((m) => ({ default: m.TestimonialsWidget })),
  ),
  faq: lz(() => import("./widgets/FaqWidget").then((m) => ({ default: m.FaqWidget }))),
  countdown: lz(() =>
    import("./widgets/CountdownWidget").then((m) => ({ default: m.CountdownWidget })),
  ),
  gallery: lz(() => import("./widgets/GalleryWidget").then((m) => ({ default: m.GalleryWidget }))),
  imageCarousel: lz(() =>
    import("./widgets/GalleryWidget").then((m) => ({ default: m.GalleryWidget })),
  ),
  animatedHeadline: lz(() =>
    import("./widgets/AnimatedHeadlineWidget").then((m) => ({ default: m.AnimatedHeadlineWidget })),
  ),
  priceTable: lz(() =>
    import("./widgets/PriceTableWidget").then((m) => ({ default: m.PriceTableWidget })),
  ),
  ctaBox: lz(() => import("./widgets/CtaBoxWidget").then((m) => ({ default: m.CtaBoxWidget }))),
  flipBox: lz(() => import("./widgets/FlipBoxWidget").then((m) => ({ default: m.FlipBoxWidget }))),
  progressTracker: lz(() =>
    import("./widgets/ProgressTrackerWidget").then((m) => ({ default: m.ProgressTrackerWidget })),
  ),
  alert: lz(() => import("./widgets/AlertWidget").then((m) => ({ default: m.AlertWidget }))),
  tabs: lz(() => import("./widgets/TabsWidget").then((m) => ({ default: m.TabsWidget }))),
  socialIcons: lz(() =>
    import("./widgets/SocialIconsWidget").then((m) => ({ default: m.SocialIconsWidget })),
  ),
  iconList: lz(() =>
    import("./widgets/IconListWidget").then((m) => ({ default: m.IconListWidget })),
  ),
  backToTop: lz(() =>
    import("./widgets/BackToTopWidget").then((m) => ({ default: m.BackToTopWidget })),
  ),
  readingProgress: lz(() =>
    import("./widgets/ReadingProgressWidget").then((m) => ({ default: m.ReadingProgressWidget })),
  ),
  stickyVideo: lz(() =>
    import("./widgets/StickyVideoWidget").then((m) => ({ default: m.StickyVideoWidget })),
  ),
  phoneCall: lz(() =>
    import("./widgets/PhoneCallWidget").then((m) => ({ default: m.PhoneCallWidget })),
  ),
  dateWidget: lz(() => import("./widgets/DateWidget").then((m) => ({ default: m.DateWidget }))),
  ticker: lz(() => import("./widgets/TickerWidget").then((m) => ({ default: m.TickerWidget }))),
  infoBox: lz(() => import("./widgets/InfoBoxWidget").then((m) => ({ default: m.InfoBoxWidget }))),
  imageBox: lz(() =>
    import("./widgets/ImageBoxWidget").then((m) => ({ default: m.ImageBoxWidget })),
  ),
  starRating: lz(() =>
    import("./widgets/StarRatingWidget").then((m) => ({ default: m.StarRatingWidget })),
  ),
  counter: lz(() => import("./widgets/CounterWidget").then((m) => ({ default: m.CounterWidget }))),
  googleMaps: lz(() =>
    import("./widgets/GoogleMapsWidget").then((m) => ({ default: m.GoogleMapsWidget })),
  ),
  menuAnchor: lz(() =>
    import("./widgets/MenuAnchorWidget").then((m) => ({ default: m.MenuAnchorWidget })),
  ),
};

/** Resolve o Render público (core síncrono ou lazy). */
export function resolvePublicWidgetRender(
  type: WidgetType,
): WidgetRender | LazyRender | null {
  return CORE[type] ?? LAZY[type] ?? null;
}

export function isPublicWidgetLazy(type: WidgetType): boolean {
  return Boolean(LAZY[type]) && !CORE[type];
}
