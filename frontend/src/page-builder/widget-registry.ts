import type { ComponentType } from "react";
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
} from "lucide-react";
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
    label: "Contentor",
    category: "basic",
    icon: LayoutGrid,
    Render: ContainerWidget,
  },
  heading: {
    type: "heading",
    label: "Título",
    category: "basic",
    icon: Heading1,
    Render: HeadingWidget,
  },
  text: { type: "text", label: "Texto", category: "basic", icon: TypeIcon, Render: TextWidget },
  button: {
    type: "button",
    label: "Botão",
    category: "basic",
    icon: MousePointerClick,
    Render: ButtonWidget,
  },
  image: {
    type: "image",
    label: "Imagem",
    category: "media",
    icon: ImageIcon,
    Render: ImageWidget,
  },
  video: { type: "video", label: "Vídeo", category: "media", icon: Video, Render: VideoWidget },
  icon: { type: "icon", label: "Ícone", category: "basic", icon: Star, Render: IconWidget },
  divider: {
    type: "divider",
    label: "Divisor",
    category: "basic",
    icon: Minus,
    Render: DividerWidget,
  },
  spacer: {
    type: "spacer",
    label: "Espaçador",
    category: "basic",
    icon: ArrowUpDown,
    Render: SpacerWidget,
  },
  html: { type: "html", label: "HTML", category: "advanced", icon: Code, Render: HtmlWidget },
  form: {
    type: "form",
    label: "Formulário",
    category: "advanced",
    icon: FormInput,
    Render: FormWidget,
  },
  testimonials: {
    type: "testimonials",
    label: "Depoimentos",
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
    label: "Contagem",
    category: "pro",
    icon: Timer,
    Render: CountdownWidget,
  },
  gallery: {
    type: "gallery",
    label: "Galeria",
    category: "pro",
    icon: Images,
    Render: GalleryWidget,
  },
  imageCarousel: {
    type: "imageCarousel",
    label: "Carrossel",
    category: "pro",
    icon: GalleryHorizontal,
    Render: GalleryWidget,
  },
  animatedHeadline: {
    type: "animatedHeadline",
    label: "Título Animado",
    category: "pro",
    icon: Sparkles,
    Render: AnimatedHeadlineWidget,
  },
  priceTable: {
    type: "priceTable",
    label: "Tabela de Preços",
    category: "pro",
    icon: Tag,
    Render: PriceTableWidget,
  },
  ctaBox: {
    type: "ctaBox",
    label: "Caixa de chamada",
    category: "pro",
    icon: Megaphone,
    Render: CtaBoxWidget,
  },
  flipBox: {
    type: "flipBox",
    label: "Cartão giratório",
    category: "pro",
    icon: RotateCcw,
    Render: FlipBoxWidget,
  },
  progressTracker: {
    type: "progressTracker",
    label: "Barra de progresso",
    category: "pro",
    icon: Gauge,
    Render: ProgressTrackerWidget,
  },
  alert: {
    type: "alert",
    label: "Alerta",
    category: "basic",
    icon: Bell,
    Render: AlertWidget,
  },
  tabs: {
    type: "tabs",
    label: "Abas",
    category: "pro",
    icon: LayoutList,
    Render: TabsWidget,
  },
  socialIcons: {
    type: "socialIcons",
    label: "Redes sociais",
    category: "basic",
    icon: Share2,
    Render: SocialIconsWidget,
  },
  iconList: {
    type: "iconList",
    label: "Lista com ícones",
    category: "pro",
    icon: ListChecks,
    Render: IconListWidget,
  },
  backToTop: {
    type: "backToTop",
    label: "Voltar ao topo",
    category: "pro",
    icon: ArrowUpToLine,
    Render: BackToTopWidget,
  },
  readingProgress: {
    type: "readingProgress",
    label: "Barra de leitura",
    category: "pro",
    icon: BookMarked,
    Render: ReadingProgressWidget,
  },
  stickyVideo: {
    type: "stickyVideo",
    label: "Vídeo fixo (VSL)",
    category: "media",
    icon: PictureInPicture,
    Render: StickyVideoWidget,
  },
  phoneCall: {
    type: "phoneCall",
    label: "Chamada telefónica",
    category: "basic",
    icon: Phone,
    Render: PhoneCallWidget,
  },
  dateWidget: {
    type: "dateWidget",
    label: "Data / hora",
    category: "basic",
    icon: CalendarDays,
    Render: DateWidget,
  },
  navMenu: {
    type: "navMenu",
    label: "Menu de navegação",
    category: "basic",
    icon: PanelTop,
    Render: NavMenuWidget,
  },
  ticker: {
    type: "ticker",
    label: "Faixa de mensagens (ticker)",
    category: "basic",
    icon: Newspaper,
    Render: TickerWidget,
  },
  infoBox: {
    type: "infoBox",
    label: "Caixa de ícone",
    category: "pro",
    icon: Info,
    Render: InfoBoxWidget,
  },
  imageBox: {
    type: "imageBox",
    label: "Caixa de imagem",
    category: "pro",
    icon: ImagePlus,
    Render: ImageBoxWidget,
  },
  starRating: {
    type: "starRating",
    label: "Avaliação (estrelas)",
    category: "basic",
    icon: Star,
    Render: StarRatingWidget,
  },
  counter: {
    type: "counter",
    label: "Contador",
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
    label: "Âncora de menu",
    category: "basic",
    icon: Anchor,
    Render: MenuAnchorWidget,
  },
  cookieBanner: {
    type: "cookieBanner",
    label: "Cookies (modal/canto)",
    category: "basic",
    icon: Cookie,
    Render: CookieBannerWidget,
  },
};

export const WIDGET_LIST: WidgetDefinition[] = Object.values(WIDGET_REGISTRY);

export const WIDGET_CATEGORIES: Array<{
  id: WidgetDefinition["category"];
  label: string;
}> = [
  { id: "basic", label: "Básico" },
  { id: "media", label: "Multimédia" },
  { id: "pro", label: "Profissional" },
  { id: "advanced", label: "Avançado" },
];
