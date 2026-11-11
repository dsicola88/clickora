import type { ComponentType } from "react";
import type { MessageKey } from "@/i18n";
import type { DeviceType, WidgetNode, WidgetType } from "./types";
import {
  Heading1,
  Type as TypeIcon,
  Image as ImageIcon,
  MousePointerClick,
  Video,
  ArrowUpDown,
  Star,
  Minus,
  Code,
  FormInput,
  Quote,
  HelpCircle,
  Timer,
  Images,
  GalleryHorizontal,
  Sparkles,
  Tag,
  Megaphone,
  RotateCcw,
  Gauge,
  Bell,
  LayoutList,
  Share2,
  ListChecks,
  ArrowUpToLine,
  BookMarked,
  PictureInPicture,
  Phone,
  CalendarDays,
  PanelTop,
  Newspaper,
  Info,
  LayoutGrid,
  Cookie,
  MapPin,
  Anchor,
  Hash,
  ImagePlus,
  Clapperboard,
  PanelRightOpen,
  ListOrdered,
} from "lucide-react";
import { LottieWidget } from "./widgets/LottieWidget";
import { OffCanvasWidget } from "./widgets/OffCanvasWidget";
import { ShareButtonsWidget } from "./widgets/ShareButtonsWidget";
import { TableOfContentsWidget } from "./widgets/TableOfContentsWidget";
import { ContainerWidget } from "./widgets/ContainerWidget";
import { CookieBannerWidget } from "./widgets/CookieBannerWidget";
import { HeadingWidget } from "./widgets/HeadingWidget";
import { TextWidget } from "./widgets/TextWidget";
import { ImageWidget } from "./widgets/ImageWidget";
import { ButtonWidget } from "./widgets/ButtonWidget";
import { VideoWidget } from "./widgets/VideoWidget";
import { SpacerWidget } from "./widgets/SpacerWidget";
import { IconWidget } from "./widgets/IconWidget";
import { DividerWidget } from "./widgets/DividerWidget";
import { HtmlWidget } from "./widgets/HtmlWidget";
import { FormWidget } from "./widgets/FormWidget";
import { TestimonialsWidget } from "./widgets/TestimonialsWidget";
import { FaqWidget } from "./widgets/FaqWidget";
import { CountdownWidget } from "./widgets/CountdownWidget";
import { GalleryWidget } from "./widgets/GalleryWidget";
import { AnimatedHeadlineWidget } from "./widgets/AnimatedHeadlineWidget";
import { PriceTableWidget } from "./widgets/PriceTableWidget";
import { LivePlansWidget } from "./widgets/LivePlansWidget";
import { CtaBoxWidget } from "./widgets/CtaBoxWidget";
import { FlipBoxWidget } from "./widgets/FlipBoxWidget";
import { ProgressTrackerWidget } from "./widgets/ProgressTrackerWidget";
import { AlertWidget } from "./widgets/AlertWidget";
import { TabsWidget } from "./widgets/TabsWidget";
import { SocialIconsWidget } from "./widgets/SocialIconsWidget";
import { IconListWidget } from "./widgets/IconListWidget";
import { BackToTopWidget } from "./widgets/BackToTopWidget";
import { ReadingProgressWidget } from "./widgets/ReadingProgressWidget";
import { StickyVideoWidget } from "./widgets/StickyVideoWidget";
import { PhoneCallWidget } from "./widgets/PhoneCallWidget";
import { DateWidget } from "./widgets/DateWidget";
import { NavMenuWidget } from "./widgets/NavMenuWidget";
import { TickerWidget } from "./widgets/TickerWidget";
import { InfoBoxWidget } from "./widgets/InfoBoxWidget";
import { ImageBoxWidget } from "./widgets/ImageBoxWidget";
import { StarRatingWidget } from "./widgets/StarRatingWidget";
import { CounterWidget } from "./widgets/CounterWidget";
import { GoogleMapsWidget } from "./widgets/GoogleMapsWidget";
import { MenuAnchorWidget } from "./widgets/MenuAnchorWidget";

export interface WidgetDefinition {
  type: WidgetType;
  label: string;
  category: "basic" | "media" | "advanced" | "pro";
  icon: ComponentType<{ className?: string }>;
  Render: ComponentType<{ widget: WidgetNode; device: DeviceType }>;
}

export const WIDGET_REGISTRY: Record<WidgetType, WidgetDefinition> = {
  container: {
    type: "container",
    label: "Container",
    category: "basic",
    icon: LayoutGrid,
    Render: ContainerWidget,
  },
  heading: {
    type: "heading",
    label: "Heading",
    category: "basic",
    icon: Heading1,
    Render: HeadingWidget,
  },
  text: { type: "text", label: "Text", category: "basic", icon: TypeIcon, Render: TextWidget },
  button: {
    type: "button",
    label: "Button",
    category: "basic",
    icon: MousePointerClick,
    Render: ButtonWidget,
  },
  image: {
    type: "image",
    label: "Image",
    category: "media",
    icon: ImageIcon,
    Render: ImageWidget,
  },
  video: { type: "video", label: "Video", category: "media", icon: Video, Render: VideoWidget },
  icon: { type: "icon", label: "Icon", category: "basic", icon: Star, Render: IconWidget },
  divider: {
    type: "divider",
    label: "Divider",
    category: "basic",
    icon: Minus,
    Render: DividerWidget,
  },
  spacer: {
    type: "spacer",
    label: "Spacer",
    category: "basic",
    icon: ArrowUpDown,
    Render: SpacerWidget,
  },
  html: { type: "html", label: "HTML", category: "advanced", icon: Code, Render: HtmlWidget },
  form: {
    type: "form",
    label: "Form",
    category: "advanced",
    icon: FormInput,
    Render: FormWidget,
  },
  testimonials: {
    type: "testimonials",
    label: "Testimonials",
    category: "pro",
    icon: Quote,
    Render: TestimonialsWidget,
  },
  faq: {
    type: "faq",
    label: "FAQ / Accordion",
    category: "pro",
    icon: HelpCircle,
    Render: FaqWidget,
  },
  countdown: {
    type: "countdown",
    label: "Countdown",
    category: "pro",
    icon: Timer,
    Render: CountdownWidget,
  },
  gallery: {
    type: "gallery",
    label: "Gallery",
    category: "pro",
    icon: Images,
    Render: GalleryWidget,
  },
  imageCarousel: {
    type: "imageCarousel",
    label: "Carousel",
    category: "pro",
    icon: GalleryHorizontal,
    Render: GalleryWidget,
  },
  animatedHeadline: {
    type: "animatedHeadline",
    label: "Animated headline",
    category: "pro",
    icon: Sparkles,
    Render: AnimatedHeadlineWidget,
  },
  priceTable: {
    type: "priceTable",
    label: "Price table",
    category: "pro",
    icon: Tag,
    Render: PriceTableWidget,
  },
  livePlans: {
    type: "livePlans",
    label: "Live plans",
    category: "pro",
    icon: LayoutGrid,
    Render: LivePlansWidget,
  },
  ctaBox: {
    type: "ctaBox",
    label: "Call to action",
    category: "pro",
    icon: Megaphone,
    Render: CtaBoxWidget,
  },
  flipBox: {
    type: "flipBox",
    label: "Flip box",
    category: "pro",
    icon: RotateCcw,
    Render: FlipBoxWidget,
  },
  progressTracker: {
    type: "progressTracker",
    label: "Progress bar",
    category: "pro",
    icon: Gauge,
    Render: ProgressTrackerWidget,
  },
  alert: {
    type: "alert",
    label: "Alert",
    category: "basic",
    icon: Bell,
    Render: AlertWidget,
  },
  tabs: {
    type: "tabs",
    label: "Tabs",
    category: "pro",
    icon: LayoutList,
    Render: TabsWidget,
  },
  socialIcons: {
    type: "socialIcons",
    label: "Social icons",
    category: "basic",
    icon: Share2,
    Render: SocialIconsWidget,
  },
  iconList: {
    type: "iconList",
    label: "Icon list",
    category: "pro",
    icon: ListChecks,
    Render: IconListWidget,
  },
  backToTop: {
    type: "backToTop",
    label: "Back to top",
    category: "pro",
    icon: ArrowUpToLine,
    Render: BackToTopWidget,
  },
  readingProgress: {
    type: "readingProgress",
    label: "Reading bar",
    category: "pro",
    icon: BookMarked,
    Render: ReadingProgressWidget,
  },
  stickyVideo: {
    type: "stickyVideo",
    label: "Sticky video (VSL)",
    category: "media",
    icon: PictureInPicture,
    Render: StickyVideoWidget,
  },
  phoneCall: {
    type: "phoneCall",
    label: "Phone call",
    category: "basic",
    icon: Phone,
    Render: PhoneCallWidget,
  },
  dateWidget: {
    type: "dateWidget",
    label: "Date / time",
    category: "basic",
    icon: CalendarDays,
    Render: DateWidget,
  },
  navMenu: {
    type: "navMenu",
    label: "Navigation menu",
    category: "basic",
    icon: PanelTop,
    Render: NavMenuWidget,
  },
  ticker: {
    type: "ticker",
    label: "Message ticker",
    category: "basic",
    icon: Newspaper,
    Render: TickerWidget,
  },
  infoBox: {
    type: "infoBox",
    label: "Icon box",
    category: "pro",
    icon: Info,
    Render: InfoBoxWidget,
  },
  imageBox: {
    type: "imageBox",
    label: "Image box",
    category: "pro",
    icon: ImagePlus,
    Render: ImageBoxWidget,
  },
  starRating: {
    type: "starRating",
    label: "Star rating",
    category: "basic",
    icon: Star,
    Render: StarRatingWidget,
  },
  counter: {
    type: "counter",
    label: "Counter",
    category: "pro",
    icon: Hash,
    Render: CounterWidget,
  },
  googleMaps: {
    type: "googleMaps",
    label: "Google Maps",
    category: "media",
    icon: MapPin,
    Render: GoogleMapsWidget,
  },
  menuAnchor: {
    type: "menuAnchor",
    label: "Menu anchor",
    category: "basic",
    icon: Anchor,
    Render: MenuAnchorWidget,
  },
  cookieBanner: {
    type: "cookieBanner",
    label: "Cookies (modal/corner/bar)",
    category: "basic",
    icon: Cookie,
    Render: CookieBannerWidget,
  },
  lottie: {
    type: "lottie",
    label: "Lottie",
    category: "pro",
    icon: Clapperboard,
    Render: LottieWidget,
  },
  offCanvas: {
    type: "offCanvas",
    label: "Off-canvas",
    category: "pro",
    icon: PanelRightOpen,
    Render: OffCanvasWidget,
  },
  shareButtons: {
    type: "shareButtons",
    label: "Share",
    category: "pro",
    icon: Share2,
    Render: ShareButtonsWidget,
  },
  tableOfContents: {
    type: "tableOfContents",
    label: "Table of contents",
    category: "pro",
    icon: ListOrdered,
    Render: TableOfContentsWidget,
  },
};

export const WIDGET_LIST: WidgetDefinition[] = Object.values(WIDGET_REGISTRY);

export const WIDGET_CATEGORIES: Array<{
  id: WidgetDefinition["category"];
  label: string;
}> = [
  { id: "basic", label: "Basic" },
  { id: "media", label: "Media" },
  { id: "pro", label: "Professional" },
  { id: "advanced", label: "Advanced" },
];

/** Sidebar and chrome names. `label` on the definition stays a fallback for non-React callers. */
export const WIDGET_NAME_KEY: Record<WidgetType, MessageKey> = {
  container: "pages.pageBuilder.chrome.names.container",
  heading: "pages.pageBuilder.chrome.names.heading",
  text: "pages.pageBuilder.chrome.names.text",
  button: "pages.pageBuilder.chrome.names.button",
  image: "pages.pageBuilder.chrome.names.image",
  video: "pages.pageBuilder.chrome.names.video",
  icon: "pages.pageBuilder.chrome.names.icon",
  divider: "pages.pageBuilder.chrome.names.divider",
  spacer: "pages.pageBuilder.chrome.names.spacer",
  html: "pages.pageBuilder.chrome.names.html",
  form: "pages.pageBuilder.chrome.names.form",
  testimonials: "pages.pageBuilder.chrome.names.testimonials",
  faq: "pages.pageBuilder.chrome.names.faq",
  countdown: "pages.pageBuilder.chrome.names.countdown",
  gallery: "pages.pageBuilder.chrome.names.gallery",
  imageCarousel: "pages.pageBuilder.chrome.names.imageCarousel",
  animatedHeadline: "pages.pageBuilder.chrome.names.animatedHeadline",
  priceTable: "pages.pageBuilder.chrome.names.priceTable",
  livePlans: "pages.pageBuilder.chrome.names.livePlans",
  ctaBox: "pages.pageBuilder.chrome.names.ctaBox",
  flipBox: "pages.pageBuilder.chrome.names.flipBox",
  progressTracker: "pages.pageBuilder.chrome.names.progressTracker",
  alert: "pages.pageBuilder.chrome.names.alert",
  tabs: "pages.pageBuilder.chrome.names.tabs",
  socialIcons: "pages.pageBuilder.chrome.names.socialIcons",
  iconList: "pages.pageBuilder.chrome.names.iconList",
  backToTop: "pages.pageBuilder.chrome.names.backToTop",
  readingProgress: "pages.pageBuilder.chrome.names.readingProgress",
  stickyVideo: "pages.pageBuilder.chrome.names.stickyVideo",
  phoneCall: "pages.pageBuilder.chrome.names.phoneCall",
  dateWidget: "pages.pageBuilder.chrome.names.dateWidget",
  navMenu: "pages.pageBuilder.chrome.names.navMenu",
  ticker: "pages.pageBuilder.chrome.names.ticker",
  infoBox: "pages.pageBuilder.chrome.names.infoBox",
  imageBox: "pages.pageBuilder.chrome.names.imageBox",
  starRating: "pages.pageBuilder.chrome.names.starRating",
  counter: "pages.pageBuilder.chrome.names.counter",
  googleMaps: "pages.pageBuilder.chrome.names.googleMaps",
  menuAnchor: "pages.pageBuilder.chrome.names.menuAnchor",
  cookieBanner: "pages.pageBuilder.chrome.names.cookieBanner",
  lottie: "pages.pageBuilder.chrome.names.lottie",
  offCanvas: "pages.pageBuilder.chrome.names.offCanvas",
  shareButtons: "pages.pageBuilder.chrome.names.shareButtons",
  tableOfContents: "pages.pageBuilder.chrome.names.tableOfContents",
};

export const WIDGET_CATEGORY_KEY: Record<WidgetDefinition["category"], MessageKey> = {
  basic: "pages.pageBuilder.chrome.categories.basic",
  media: "pages.pageBuilder.chrome.categories.media",
  pro: "pages.pageBuilder.chrome.categories.pro",
  advanced: "pages.pageBuilder.chrome.categories.advanced",
};
