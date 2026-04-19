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
  | "dateWidget";

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
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
  textAlign: "left" | "center" | "right" | "justify";
  textTransform: "none" | "uppercase" | "lowercase" | "capitalize";
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
}

/** Non-responsive style rules. */
export interface BaseStyles {
  color?: string;
  background?: string;
  border?: BorderValue;
  boxShadow?: string;
  opacity?: number;
}

export interface WidgetNode {
  id: string;
  type: WidgetType;
  /** Free-form widget content (text, src, href, etc). Shape depends on type. */
  content: Record<string, unknown>;
  styles: BaseStyles & ResponsiveStyles;
  /** Custom CSS class names (advanced tab). */
  cssClasses?: string;
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
