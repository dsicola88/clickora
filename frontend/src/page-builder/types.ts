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
  | "container";

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
  zIndex?: ResponsiveValue<number>;
  alignSelf?: ResponsiveValue<"auto" | "flex-start" | "center" | "flex-end" | "stretch">;
  order?: ResponsiveValue<number>;
  flexGrow?: ResponsiveValue<number>;
  flexShrink?: ResponsiveValue<number>;
}

/** Non-responsive style rules. */
export interface BaseStyles {
  color?: string;
  background?: string;
  border?: BorderValue;
  boxShadow?: string;
  opacity?: number;
}

/** Motion Effects (Elementor Advanced) — independente por widget. */
export interface WidgetEffects {
  entranceAnimation?: string;
  entranceDurationMs?: number;
  entranceDelayMs?: number;
  entranceEasing?: string;
  transform?: string;
  hoverTransform?: string;
  hoverBoxShadow?: string;
  hoverOpacity?: number;
  /** Cores de hover (Elementor Style → Hover) — todos os widgets. */
  hoverColor?: string;
  hoverBackground?: string;
  hoverBorderColor?: string;
  transitionDurationMs?: number;
  transitionEasing?: string;
}

export interface WidgetNode {
  id: string;
  type: WidgetType;
  /** Free-form widget content (text, src, href, etc). Shape depends on type. */
  content: Record<string, unknown>;
  styles: BaseStyles & ResponsiveStyles;
  /** Entrada / hover / transform — cada widget independente. */
  effects?: WidgetEffects;
  /** Atributo `id` HTML (aba Avançado). */
  cssId?: string;
  /** Custom CSS class names (advanced tab). */
  cssClasses?: string;
  /** CSS cru injetado num `<style>` dentro do invólucro do widget (aba Avançado). */
  customCss?: string;
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

export interface SectionNode {
  id: string;
  /** "boxed" constrains content width, "full" stretches to viewport. */
  layout: "boxed" | "full";
  contentWidth: number; // px, used when boxed
  /** Stack direction inside section. */
  columnGap: ResponsiveValue<number>;
  /** YouTube ou Bunny Stream — vídeo em autoplay silencioso atrás do conteúdo da seção. */
  backgroundVideoUrl?: string;
  /** Direção, alinhamento e quebra do contentor. As colunas são os filhos flex. */
  flex?: FlexLayout;
  styles: BaseStyles & ResponsiveStyles;
  columns: ColumnNode[];
}

export interface PageDocument {
  id: string;
  name: string;
  sections: SectionNode[];
  /** Page-level settings. */
  settings: {
    background?: string;
    maxContentWidth: number;
  };
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
