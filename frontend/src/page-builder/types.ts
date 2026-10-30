// Core type definitions for the page builder

export type DeviceType = "desktop" | "tablet" | "mobile";

export type WidgetType =
  | "heading"
  | "text"
  | "image"
  | "button"
  | "video"
  | "spacer"
  | "icon"
  | "divider"
  | "html"
  | "form"
  | "testimonials"
  | "faq"
  | "countdown"
  | "gallery"
  | "imageCarousel"
  | "animatedHeadline"
  | "priceTable"
  /** Grelha de planos vivos (API `/plans`) — para a landing de vendas do admin. */
  | "livePlans"
  | "ctaBox"
  | "flipBox"
  | "progressTracker"
  | "alert"
  | "tabs"
  | "socialIcons"
  | "iconList"
  | "backToTop"
  | "readingProgress"
  | "stickyVideo"
  | "phoneCall"
  | "dateWidget"
  | "navMenu"
  | "ticker"
  | "infoBox"
  | "imageBox"
  | "starRating"
  | "counter"
  | "googleMaps"
  | "menuAnchor"
  | "cookieBanner"
  | "container"
  /** Lottie / DotLottie. */
  | "lottie"
  /** Painel lateral (off-canvas). */
  | "offCanvas"
  /** Botões de partilha social. */
  | "shareButtons"
  /** Índice / tabela de conteúdos por âncoras. */
  | "tableOfContents";

export interface PageSeo {
  title?: string;
  description?: string;
  ogImage?: string;
  favicon?: string;
  keywords?: string;
  ogType?: string;
  twitterCard?: "summary" | "summary_large_image";
  noindex?: boolean;
  canonicalUrl?: string;
}

export interface PageTrackingConfig {
  gtmId?: string;
  ga4Id?: string;
  metaPixelId?: string;
  customHeadCode?: string;
  customBodyCode?: string;
  trackFormSubmits?: boolean;
  trackButtonClicks?: boolean;
}

/** Per-device value: device-specific values fall back to desktop. */
export interface ResponsiveValue<T> {
  desktop: T;
  tablet?: T;
  mobile?: T;
}

export interface SpacingValue {
  top: number;
  right: number;
  bottom: number;
  left: number;
  unit: "px" | "%" | "em" | "rem";
}

export interface BorderValue {
  width: number;
  style: "none" | "solid" | "dashed" | "dotted";
  color: string;
  radius: number;
}

export interface TypographyValue {
  fontFamily?: string;
  fontSize: number;
  /** Predefinição `px` quando omitido (documentos antigos). */
  fontSizeUnit?: "px" | "em" | "rem" | "vw";
  fontWeight: number;
  lineHeight: number;
  /** Vazio = multiplicador sem unidade (ex.: 1,5). Caso contrário, `lineHeight` usa esta unidade. */
  lineHeightUnit?: "" | "px" | "em" | "rem";
  letterSpacing: number;
  letterSpacingUnit?: "px" | "em";
  wordSpacing?: number;
  wordSpacingUnit?: "px" | "em";
  textAlign: "left" | "center" | "right" | "justify";
  textTransform: "none" | "uppercase" | "lowercase" | "capitalize";
  fontStyle?: "normal" | "italic" | "oblique";
  textDecoration?: "none" | "underline" | "overline" | "line-through";
}

/** Style rules that can vary per device. */
export interface ResponsiveStyles {
  padding?: ResponsiveValue<SpacingValue>;
  margin?: ResponsiveValue<SpacingValue>;
  typography?: ResponsiveValue<TypographyValue>;
  width?: ResponsiveValue<string>;
  height?: ResponsiveValue<string>;
  align?: ResponsiveValue<"left" | "center" | "right">;
  visibility?: ResponsiveValue<boolean>;
  position?: ResponsiveValue<"static" | "relative" | "absolute" | "fixed" | "sticky">;
  /** Offset CSS `top` (ex.: "0" / "0px") — necessário para sticky/fixed. */
  top?: ResponsiveValue<string>;
  /** Offset CSS `right` / `bottom` / `left` — posicionamento absoluto/relativo. */
  right?: ResponsiveValue<string>;
  bottom?: ResponsiveValue<string>;
  left?: ResponsiveValue<string>;
  zIndex?: ResponsiveValue<number>;
  alignSelf?: ResponsiveValue<"auto" | "flex-start" | "center" | "flex-end" | "stretch">;
  order?: ResponsiveValue<number>;
  flexGrow?: ResponsiveValue<number>;
  flexShrink?: ResponsiveValue<number>;
  /**
   * Alinhamento vertical do conteúdo numa coluna (flex column → justify-content).
   * Equivalente ao Vertical Align do Elementor.
   */
  justifyContent?: ResponsiveValue<
    "flex-start" | "center" | "flex-end" | "space-between" | "space-around" | "space-evenly"
  >;
}

/** Non-responsive style rules. */
export interface BaseStyles {
  color?: string;
  background?: string;
  border?: BorderValue;
  boxShadow?: string;
  opacity?: number;
}

/** Efeitos de movimento — independente por widget. */
export interface WidgetEffects {
  entranceAnimation?: string;
  entranceDurationMs?: number;
  entranceDelayMs?: number;
  entranceEasing?: string;
  /**
   * `scroll` = ao entrar no viewport.
   * `load` = ao carregar a página.
   */
  entranceTrigger?: "scroll" | "load";
  /** Se true, a entrada só corre uma vez. */
  entranceOnce?: boolean;
  /** % do elemento visível para disparar (0–100). */
  entranceThreshold?: number;
  transform?: string;
  hoverTransform?: string;
  hoverBoxShadow?: string;
  hoverOpacity?: number;
  /** Cores de hover — todos os widgets. */
  hoverColor?: string;
  hoverBackground?: string;
  hoverBorderColor?: string;
  transitionDurationMs?: number;
  transitionEasing?: string;
  /** position:sticky no wrapper. */
  sticky?: boolean;
  /** Offset `top` em px quando sticky. */
  stickyOffsetPx?: number;
  /** Efeitos contínuos (loop). */
  continuousAnimation?: string;
  continuousDurationMs?: number;
  /**
   * Efeitos de scroll: movimento ligado ao scroll do viewport.
   * `none` | `vertical` | `horizontal` | `transparency` | `blur` | `rotate` | `scale`
   */
  scrollingEffect?: string;
  /** Intensidade 0–100 (default 40). */
  scrollingSpeed?: number;
  /** Invert direction. */
  scrollingReverse?: boolean;
  /** Mouse Effects — tilt 3D. */
  mouseTilt?: boolean;
  mouseTiltMaxDeg?: number;
  /** Mouse track — deslocamento 2D. */
  mouseTrack?: boolean;
  mouseTrackPx?: number;
  /**
   * Percurso de movimento (motion path).
   * `none` | `lineH` | `lineV` | `arc` | `circle` | `zigzag` | `figure8`
   */
  motionPath?: string;
  /** Duração do ciclo do percurso (ms). */
  motionPathDurationMs?: number;
  /** Percurso em loop contínuo (default true). */
  motionPathLoop?: boolean;
}

/** Condições de visibilidade do widget. */
export interface WidgetConditions {
  /** Atraso após load antes de mostrar (ms). */
  showAfterMs?: number;
  /** Só mostrar depois de X% de scroll (0–100). */
  showAtScrollPercent?: number;
  /** Ocultar em desktop / tablet / mobile (além de visibility nos estilos). */
  hideDesktop?: boolean;
  hideTablet?: boolean;
  hideMobile?: boolean;
}

/** Disparo de interação no widget. */
export type WidgetInteractionTrigger = "click" | "hover";

/** Acção de interação no widget. */
export type WidgetInteractionAction =
  | "openUrl"
  | "scrollTo"
  | "openPopup"
  | "show"
  | "hide"
  | "toggle";

export interface WidgetInteraction {
  id: string;
  trigger: WidgetInteractionTrigger;
  action: WidgetInteractionAction;
  /** openUrl */
  url?: string;
  openInNewTab?: boolean;
  /** scrollTo → #id ; show/hide/toggle → cssId do alvo ; openPopup → id do popup */
  targetId?: string;
}

export interface WidgetNode {
  id: string;
  type: WidgetType;
  /** Free-form widget content (text, src, href, etc). Shape depends on type. */
  content: Record<string, unknown>;
  styles: BaseStyles & ResponsiveStyles;
  /** Entrada / hover / transform — cada widget independente. */
  effects?: WidgetEffects;
  /** Interações (clique/hover → acção). */
  interactions?: WidgetInteraction[];
  /** Condições de exibição. */
  conditions?: WidgetConditions;
  /**
   * Máscara CSS (clip).
   * `none` | `circle` | `ellipse` | `diamond` | `hexagon` | `blob` | `custom`
   */
  cssMask?: string;
  /** clip-path custom quando cssMask = custom. */
  cssMaskCustom?: string;
  /** Atributo `id` HTML (aba Avançado). */
  cssId?: string;
  /** Custom CSS class names (advanced tab). */
  cssClasses?: string;
  /** CSS cru injetado num `<style>` dentro do invólucro do widget (aba Avançado). */
  customCss?: string;
}

/** Popup / modal da página (disparado por tempo, scroll, exit ou interação). */
export type PagePopupTrigger = "onLoad" | "onScroll" | "exitIntent" | "manual";

export type PagePopupPosition =
  | "center"
  | "top"
  | "bottom"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "left"
  | "right";

export type PagePopupDisplayMode = "modal" | "bar" | "slide-in" | "toast";

export type PagePopupAnimation =
  | "none"
  | "fade"
  | "fadeUp"
  | "fadeDown"
  | "scale"
  | "slideLeft"
  | "slideRight"
  | "slideUp"
  | "slideDown";

export interface PagePopup {
  id: string;
  name: string;
  enabled?: boolean;
  trigger: PagePopupTrigger;
  /** Atraso após load / scroll / exit (ms). */
  delayMs?: number;
  /** % de scroll (0–100) quando trigger = onScroll. */
  scrollPercent?: number;
  /** Só uma vez por sessão do browser. */
  oncePerSession?: boolean;
  backdrop?: boolean;
  backdropClose?: boolean;
  maxWidthPx?: number;
  title?: string;
  html?: string;
  ctaLabel?: string;
  ctaHref?: string;
  background?: string;
  textColor?: string;
  /** Cor do botão CTA. */
  ctaBg?: string;
  ctaColor?: string;
  /** Modo de apresentação. */
  displayMode?: PagePopupDisplayMode;
  /** Posição no ecrã. */
  position?: PagePopupPosition;
  /** Animação de entrada. */
  animation?: PagePopupAnimation;
  animationDurationMs?: number;
  animationEasing?: string;
  zIndex?: number;
  borderRadiusPx?: number;
  offsetXPx?: number;
  offsetYPx?: number;
  showCloseButton?: boolean;
  /** Opacidade do backdrop 0–100 (quando activo). */
  backdropOpacity?: number;
}

export type FlexDirection = "row" | "column" | "row-reverse" | "column-reverse";
export type FlexJustify =
  | "flex-start"
  | "center"
  | "flex-end"
  | "space-between"
  | "space-around"
  | "space-evenly";
export type FlexAlign = "flex-start" | "center" | "flex-end" | "stretch";
export type FlexWrapMode = "nowrap" | "wrap";

/** Contentor flex, por dispositivo. Sem valor, a secção fica em linha no desktop e empilha no telemóvel. */
export interface FlexLayout {
  direction?: ResponsiveValue<FlexDirection>;
  justify?: ResponsiveValue<FlexJustify>;
  align?: ResponsiveValue<FlexAlign>;
  wrap?: ResponsiveValue<FlexWrapMode>;
}

export interface ColumnNode {
  id: string;
  /** Width as percentage of section, per device. */
  widthPercent: ResponsiveValue<number>;
  styles: BaseStyles & ResponsiveStyles;
  widgets: WidgetNode[];
}

/** Overlay de fundo da secção. */
export interface SectionBackgroundOverlay {
  color?: string;
  /** 0–100 (default 50). */
  opacity?: number;
  /** CSS mix-blend-mode. */
  blendMode?: string;
}

/** Divisor de forma (topo ou fundo da secção). */
export interface ShapeDividerConfig {
  preset?: string;
  color?: string;
  heightPx?: number;
  flip?: boolean;
  /** Inverte verticalmente o SVG. */
  invert?: boolean;
  bringToFront?: boolean;
}

export interface SectionNode {
  id: string;
  /** "boxed" constrains content width, "full" stretches to viewport. */
  layout: "boxed" | "full";
  contentWidth: number; // px, used when boxed
  /** Stack direction inside section. */
  columnGap: ResponsiveValue<number>;
  /** YouTube ou Bunny Stream — vídeo em autoplay silencioso atrás do conteúdo da seção. */
  backgroundVideoUrl?: string;
  /** Imagem de fundo da secção. */
  backgroundImageUrl?: string;
  backgroundImageSize?: "cover" | "contain" | "auto";
  backgroundImagePosition?: string;
  /** Overlay sobre cor/imagem/vídeo de fundo. */
  backgroundOverlay?: SectionBackgroundOverlay;
  /** Slideshow de imagens de fundo (URLs). */
  backgroundSlideshow?: string[];
  /** Intervalo do slideshow (ms). */
  backgroundSlideshowMs?: number;
  shapeDividerTop?: ShapeDividerConfig;
  shapeDividerBottom?: ShapeDividerConfig;
  /** Direção, alinhamento e quebra do contentor. As colunas são os filhos flex. */
  flex?: FlexLayout;
  styles: BaseStyles & ResponsiveStyles;
  columns: ColumnNode[];
}

/** Cores/tipografia globais da página. */
export interface PageGlobalDesign {
  primary?: string;
  secondary?: string;
  text?: string;
  accent?: string;
  muted?: string;
  fontPrimary?: string;
  fontSecondary?: string;
}

export interface PageDocument {
  id: string;
  name: string;
  sections: SectionNode[];
  /** Page-level settings. */
  settings: {
    background?: string;
    maxContentWidth: number;
    globalDesign?: PageGlobalDesign;
    /** Id do tema/preset da biblioteca (ex.: dclickora-market). */
    themePreset?: string;
  };
  /** Popups / modais da página. */
  popups?: PagePopup[];
  /** Per-page SEO metadata used in the public route and HTML export. */
  seo?: PageSeo;
  /** Per-page analytics/tracking integrations. */
  tracking?: PageTrackingConfig;
  updatedAt: number;
}

export type SelectionTarget =
  | { kind: "section"; id: string }
  | { kind: "column"; sectionId: string; id: string }
  | { kind: "widget"; sectionId: string; columnId: string; id: string }
  | null;
