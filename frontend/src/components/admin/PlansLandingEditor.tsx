import { useEffect, useMemo, useRef, useState } from "react";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { fill, type MessageKey } from "@/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminService } from "@/services/adminService";
import { plansLandingService } from "@/services/plansLandingService";
import { plansService } from "@/services/plansService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  LayoutTemplate,
  Save,
  Trash2,
  Upload,
  Sparkles,
  Type,
  ImageIcon,
  Plus,
  ChevronUp,
  ChevronDown,
  Video,
  Users,
  GripVertical,
  Loader2,
  BadgeCheck,
  ExternalLink,
  ListOrdered,
  Palette,
  Layers,
  AlignLeft,
  Tag,
  Monitor,
  Tablet,
  Smartphone,
  PanelLeft,
  Columns2,
  PanelRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { PlansLandingHeroBlock } from "@/components/plans/PlansLandingHeroBlock";
import {
  coerceBodySize,
  coerceFontFamily,
  coerceFontWeight,
  coerceHeroTitleSize,
  coerceTextAlign,
  plansLandingHeroInnerClasses,
  plansLandingHeroSubtitleMarkdownClasses,
  plansLandingHeroTitleClasses,
} from "@/lib/plansLandingTypography";
import {
  coercePlansHeroVisual,
  DEFAULT_PLANS_HERO_VISUAL,
  type PlansHeroVisual,
} from "@/lib/plansLandingHeroVisual";
import { mergeWithDefaultLabels, PLAN_LABEL_FORM_FIELDS } from "@/lib/planDisplayLabels";
import {
  coerceLandingExtras,
  DEFAULT_LANDING_EXTRAS,
  DEFAULT_LANDING_SITE_CHROME,
  type LandingExtrasPublic,
  type LandingSiteChrome,
} from "@/lib/plansLandingExtras";
import {
  DEFAULT_SALES_LANDING_PROMOS,
  newBlankSalesPromoPopup,
  type SalesLandingPromos,
  type SalesPromoPopup,
} from "@/lib/salesLandingPromos";
import { SalesProductDemo } from "@/components/plans/SalesProductDemo";
import { resolveGalleryCarouselOptions } from "@/lib/landingGalleryCarousel";
import type { LandingPageThemeInput } from "@/lib/landingPageTheme";
import { resolveLandingPageTheme } from "@/lib/landingPageTheme";
import { LandingPageThemeProvider } from "@/contexts/LandingPageThemeContext";
import { LandingPageBodySections } from "@/components/plans/LandingPageBodySections";
import { LandingMarkdown } from "@/components/plans/LandingMarkdown";
import { SalesLandingLegalFooter } from "@/components/plans/SalesLandingSections";
import {
  DEFAULT_LANDING_SECTION_ORDER,
  LANDING_SECTION_IDS,
  resolveSectionOrder,
  resolveSectionsEnabled,
  type LandingSectionId,
} from "@/lib/landingSectionLayout";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { PlansLandingSortableBlockShell } from "@/components/admin/PlansLandingSortableBlockShell";
import { PlansLandingWidgetPalette, type LandingWidgetKind } from "@/components/admin/PlansLandingWidgetPalette";
import { PlansLandingTextStyleFields } from "@/components/admin/PlansLandingTextStyleFields";
import type { LandingTextStyleBlock, LandingTextStyleKey, LandingTextStylesPublic } from "@/lib/plansLandingTextStyles";
import {
  landingTextStyleColorStyle,
  landingTextStyleLabelClasses,
  resolvedFooterClasses,
  resolvedHeroInnerClasses,
  resolvedHeroSubtitleMarkdownClasses,
  resolvedHeroTitleClassNameFixed,
  resolvedIntroClasses,
} from "@/lib/plansLandingTextStyles";
import type { PlansLandingPublic } from "@/types/api";

const ADMIN_KEY = ["admin-plans-landing"] as const;
const PUBLIC_KEY = ["plans-landing-public"] as const;

type EditorVideoBlock = {
  type: "video";
  title: string;
  subtitle: string;
  url: string;
  layout: "contained" | "wide";
};

type EditorImageBlock = {
  type: "image";
  title: string;
  subtitle: string;
  src: string;
  alt: string;
  caption: string;
  layout: "contained" | "wide";
};

type EditorRichTextBlock = {
  type: "rich_text";
  content: string;
  font_family: "sans" | "serif" | "mono";
  font_size: "xs" | "sm" | "base" | "lg" | "xl" | "2xl";
  font_weight: "normal" | "medium" | "semibold" | "bold" | "extrabold";
  text_align: "left" | "center" | "right";
  text_color: string;
  background_color: string;
  layout: "contained" | "wide";
};

type EditorContentBlock = EditorVideoBlock | EditorImageBlock | EditorRichTextBlock;

/** ID estável só no cliente (não vai para a API). */
type EditorContentBlockWithKey = EditorContentBlock & { _key: string };

function newLandingContentBlockKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `lb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const OPT_FONT: { value: string; label: MessageKey }[] = [
  { value: "sans", label: "pages.admin.landing.fontSans" },
  { value: "serif", label: "pages.admin.landing.fontSerif" },
  { value: "mono", label: "pages.admin.landing.fontMono" },
];
const OPT_ALIGN: { value: string; label: MessageKey }[] = [
  { value: "left", label: "pages.admin.landing.alignLeft" },
  { value: "center", label: "pages.admin.landing.alignCenter" },
  { value: "right", label: "pages.admin.landing.alignRight" },
];
const OPT_TITLE_SIZE: { value: string; label: MessageKey }[] = [
  { value: "sm", label: "pages.admin.landing.sizeSm" },
  { value: "md", label: "pages.admin.landing.sizeMd" },
  { value: "lg", label: "pages.admin.landing.sizeLg" },
  { value: "xl", label: "pages.admin.landing.sizeXl" },
  { value: "2xl", label: "pages.admin.landing.size2xl" },
  { value: "3xl", label: "pages.admin.landing.size3xl" },
  { value: "4xl", label: "pages.admin.landing.size4xl" },
  { value: "5xl", label: "pages.admin.landing.size5xl" },
];
const OPT_WEIGHT: { value: string; label: MessageKey }[] = [
  { value: "normal", label: "pages.admin.landing.weightNormal" },
  { value: "medium", label: "pages.admin.landing.weightMedium" },
  { value: "semibold", label: "pages.admin.landing.weightSemibold" },
  { value: "bold", label: "pages.admin.landing.weightBold" },
  { value: "extrabold", label: "pages.admin.landing.weightExtrabold" },
];
const OPT_BODY: { value: string; label: MessageKey }[] = [
  { value: "xs", label: "pages.admin.landing.sizeXs" },
  { value: "sm", label: "pages.admin.landing.sizeSmShort" },
  { value: "base", label: "pages.admin.landing.bodyBase" },
  { value: "lg", label: "pages.admin.landing.sizeLgShort" },
  { value: "xl", label: "pages.admin.landing.sizeXl" },
];

const OPT_RICH_SIZE: { value: string; label: MessageKey }[] = [
  { value: "xs", label: "pages.admin.landing.sizeXs" },
  { value: "sm", label: "pages.admin.landing.sizeSmShort" },
  { value: "base", label: "pages.admin.landing.sizeBase" },
  { value: "lg", label: "pages.admin.landing.sizeLgShort" },
  { value: "xl", label: "pages.admin.landing.sizeXl" },
  { value: "2xl", label: "pages.admin.landing.size2xl" },
];

const OPT_IMAGE_EFFECT: { value: string; label: MessageKey }[] = [
  { value: "none", label: "pages.admin.landing.effectNone" },
  { value: "ken-burns", label: "pages.admin.landing.effectKen" },
  { value: "hover-zoom", label: "pages.admin.landing.effectHover" },
  { value: "parallax", label: "pages.admin.landing.effectParallax" },
];

const OPT_OVERLAY: { value: string; label: MessageKey }[] = [
  { value: "gradient-dark", label: "pages.admin.landing.overlayDark" },
  { value: "gradient-light", label: "pages.admin.landing.overlayLight" },
  { value: "solid-dark", label: "pages.admin.landing.overlaySolidDark" },
  { value: "solid-light", label: "pages.admin.landing.overlaySolidLight" },
  { value: "none", label: "pages.admin.landing.overlayNone" },
];

const OPT_OVERLAY_STRENGTH: { value: string; label: MessageKey }[] = [
  { value: "subtle", label: "pages.admin.landing.strengthSubtle" },
  { value: "medium", label: "pages.admin.landing.strengthMedium" },
  { value: "strong", label: "pages.admin.landing.strengthStrong" },
];

const OPT_ENTRANCE: { value: string; label: MessageKey }[] = [
  { value: "none", label: "pages.admin.landing.entranceNone" },
  { value: "fade-in", label: "pages.admin.landing.entranceFade" },
  { value: "fade-up", label: "pages.admin.landing.entranceUp" },
];

const OPT_HERO_FOCAL: { value: string; label: MessageKey }[] = [
  { value: "center", label: "pages.admin.landing.focalCenter" },
  { value: "top", label: "pages.admin.landing.focalTop" },
  { value: "bottom", label: "pages.admin.landing.focalBottom" },
];

type LandingEditorTab =
  | "structure"
  | "hero"
  | "typography"
  | "sales"
  | "media"
  | "copy"
  | "labels"
  | "builder";

const LANDING_EDITOR_TABS: {
  id: LandingEditorTab;
  label: MessageKey;
  icon: typeof LayoutTemplate;
}[] = [
  { id: "structure", label: "pages.admin.landing.tabStructure", icon: ListOrdered },
  { id: "hero", label: "pages.admin.landing.tabHero", icon: AlignLeft },
  { id: "typography", label: "pages.admin.landing.tabType", icon: Type },
  { id: "sales", label: "pages.admin.landing.tabTheme", icon: Palette },
  { id: "media", label: "pages.admin.landing.tabImage", icon: ImageIcon },
  { id: "copy", label: "pages.admin.landing.tabCopy", icon: Layers },
  { id: "labels", label: "pages.admin.landing.tabLabels", icon: Tag },
  { id: "builder", label: "pages.admin.landing.tabBlocks", icon: LayoutTemplate },
];

const THEME_FIELD_ROWS: { key: keyof LandingPageThemeInput; label: MessageKey; placeholder: string }[] = [
  { key: "page_background", label: "pages.admin.landing.themePageBg", placeholder: "#050a18" },
  { key: "nav_background", label: "pages.admin.landing.themeNavBg", placeholder: "rgba(5,10,24,0.88)" },
  { key: "accent", label: "pages.admin.landing.themeAccent", placeholder: "#059669" },
  { key: "accent_hover", label: "pages.admin.landing.themeAccentHover", placeholder: "#047857" },
  { key: "heading_on_dark", label: "pages.admin.landing.themeHeading", placeholder: "#ffffff" },
  { key: "muted_on_dark", label: "pages.admin.landing.themeMuted", placeholder: "rgba(255,255,255,0.78)" },
  { key: "link", label: "pages.admin.landing.themeLink", placeholder: "#34d399" },
  { key: "card_surface", label: "pages.admin.landing.themeCard", placeholder: "#ffffff" },
  { key: "badge_border", label: "pages.admin.landing.themeBadgeBorder", placeholder: "rgba(16,185,129,0.45)" },
  { key: "badge_background", label: "pages.admin.landing.themeBadgeBg", placeholder: "rgba(16,185,129,0.12)" },
  { key: "badge_text", label: "pages.admin.landing.themeBadgeText", placeholder: "#d1fae5" },
  { key: "selection_bg", label: "pages.admin.landing.themeSelection", placeholder: "rgba(16,185,129,0.2)" },
  { key: "stats_gradient_from", label: "pages.admin.landing.themeStatsFrom", placeholder: "rgba(6,78,59,0.38)" },
  { key: "stats_gradient_to", label: "pages.admin.landing.themeStatsTo", placeholder: "#050a18" },
  { key: "stats_border", label: "pages.admin.landing.themeStatsBorder", placeholder: "rgba(16,185,129,0.25)" },
  { key: "stats_glow", label: "pages.admin.landing.themeStatsGlow", placeholder: "rgba(16,185,129,0.22)" },
  { key: "faq_border", label: "pages.admin.landing.themeFaqBorder", placeholder: "rgba(16,185,129,0.3)" },
  { key: "nav_border", label: "pages.admin.landing.themeNavBorder", placeholder: "rgba(255,255,255,0.1)" },
  { key: "outline_nav_border", label: "pages.admin.landing.themeOutlineBorder", placeholder: "rgba(255,255,255,0.25)" },
  { key: "outline_nav_bg", label: "pages.admin.landing.themeOutlineBg", placeholder: "rgba(255,255,255,0.05)" },
  {
    key: "accent_button_shadow",
    label: "pages.admin.landing.themeBtnShadow",
    placeholder: "0 8px 32px -8px rgba(5,150,105,0.45)",
  },
  { key: "accent_button_radius", label: "pages.admin.landing.themeBtnRadius", placeholder: "9999px ou 0.75rem" },
  { key: "plan_card_radius", label: "pages.admin.landing.themePlanRadius", placeholder: "1rem" },
];

function MarkdownHint() {
  const { t } = useAppLocale();
  return (
    <p className="text-[11px] leading-snug text-muted-foreground">{t("pages.admin.landing.mdHint")}</p>
  );
}

function HeroPreview(props: {
  badgeText: string;
  heroTitle: string;
  heroSubtitle: string;
  hasImage: boolean;
  imageUpdatedAt: string;
  heroFont: string;
  heroTextAlign: string;
  heroTitleSize: string;
  heroTitleWeight: string;
  heroSubtitleSize: string;
  heroVisual: PlansHeroVisual;
  textStyles?: LandingTextStylesPublic | null;
  /** Pré-visualização com texto claro (tema vendas escuro). */
  salesTone?: boolean;
  /** Tema em edição (cores) para pré-visualização. */
  landingTheme?: LandingPageThemeInput | null;
  className?: string;
}) {
  const src = props.hasImage ? plansLandingService.heroImageHref(props.imageUpdatedAt) : null;
  const ts = props.textStyles ?? undefined;

  const salesThemed =
    props.salesTone ? resolveLandingPageTheme(props.landingTheme ?? null) : null;

  return (
    <PlansLandingHeroBlock
      heroImg={src}
      heroVisualRaw={props.heroVisual}
      className={props.className}
      tone={props.salesTone ? "dark" : "default"}
      salesTheme={salesThemed}
    >
      <div
        className={cn(
          "flex min-h-[200px] flex-col",
          resolvedHeroInnerClasses(
            { hero_font: props.heroFont, hero_text_align: props.heroTextAlign },
            ts?.hero_title,
          ),
        )}
      >
        {props.badgeText.trim() ? (
          <span
            className={cn(
              "inline-flex w-fit max-w-full items-center rounded-full border px-3 py-1 font-semibold uppercase tracking-wider",
              !props.salesTone && "border-primary/30 bg-primary/10 text-primary",
              ts?.hero_badge && landingTextStyleLabelClasses(ts.hero_badge),
            )}
            style={{
              ...(props.salesTone && salesThemed
                ? {
                    borderColor: salesThemed.badge_border,
                    backgroundColor: salesThemed.badge_background,
                    color: ts?.hero_badge?.color?.trim() ?? salesThemed.badge_text,
                  }
                : {}),
              ...landingTextStyleColorStyle(ts?.hero_badge),
            }}
          >
            {props.badgeText}
          </span>
        ) : null}
        <h2
          className={resolvedHeroTitleClassNameFixed(
            {
              hero_title_size: props.heroTitleSize,
              hero_title_weight: props.heroTitleWeight,
            },
            ts?.hero_title,
          )}
          style={landingTextStyleColorStyle(ts?.hero_title)}
        >
          {props.heroTitle || "…"}
        </h2>
        {props.heroSubtitle.trim() ? (
          <LandingMarkdown
            content={props.heroSubtitle}
            surface={props.salesTone && !ts?.hero_subtitle?.color?.trim() ? "dark_page" : "inherit"}
            salesTheme={props.salesTone ? salesThemed : null}
            colorOverrides={
              ts?.hero_subtitle?.color?.trim() && salesThemed
                ? {
                    body: ts.hero_subtitle.color.trim(),
                    heading: ts.hero_subtitle.color.trim(),
                    link: salesThemed.link,
                    border: salesThemed.nav_border,
                  }
                : null
            }
            className={cn(
              resolvedHeroSubtitleMarkdownClasses(
                { hero_subtitle_size: props.heroSubtitleSize },
                ts?.hero_subtitle,
              ),
              !props.salesTone && !ts?.hero_subtitle?.color && "text-muted-foreground",
            )}
          />
        ) : null}
      </div>
    </PlansLandingHeroBlock>
  );
}

const SECTION_LABEL_KEY: Record<LandingSectionId, MessageKey> = {
  content_blocks: "pages.admin.landing.secContentBlocks",
  features: "pages.admin.landing.secFeatures",
  stats: "pages.admin.landing.secStats",
  testimonials: "pages.admin.landing.secTestimonials",
  gallery: "pages.admin.landing.secGallery",
  planos: "pages.admin.landing.secPlans",
  guarantee: "pages.admin.landing.secGuarantee",
  faq: "pages.admin.landing.secFaq",
  product_demo: "pages.admin.landing.secProductDemo",
  account_plan: "pages.admin.landing.secAccountPlan",
};

type Props = {
  onInvalidateAdmin?: () => void;
};

export function PlansLandingEditor({ onInvalidateAdmin }: Props) {
  const { t } = useAppLocale();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ADMIN_KEY,
    queryFn: async () => {
      const { data: row, error } = await adminService.getPlansLanding();
      if (error) throw new Error(error);
      if (!row) throw new Error(t("pages.admin.emptyResponse"));
      return row;
    },
  });

  /** Planos reais para a pré-visualização (cartões e preços iguais à página pública). */
  const { data: previewPlans = [] } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data: rows, error } = await plansService.getAll();
      if (error) return [];
      return rows ?? [];
    },
    staleTime: 60_000,
  });

  const [badgeText, setBadgeText] = useState("");
  const [heroTitle, setHeroTitle] = useState("");
  const [heroSubtitle, setHeroSubtitle] = useState("");
  const [introText, setIntroText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [heroFont, setHeroFont] = useState("sans");
  const [heroTextAlign, setHeroTextAlign] = useState("left");
  const [heroTitleSize, setHeroTitleSize] = useState("3xl");
  const [heroTitleWeight, setHeroTitleWeight] = useState("bold");
  const [heroSubtitleSize, setHeroSubtitleSize] = useState("base");
  const [introFont, setIntroFont] = useState("sans");
  const [introTextAlign, setIntroTextAlign] = useState("left");
  const [introTextSize, setIntroTextSize] = useState("base");
  const [footerFont, setFooterFont] = useState("sans");
  const [footerTextAlign, setFooterTextAlign] = useState("center");
  const [footerTextSize, setFooterTextSize] = useState("sm");
  const [saving, setSaving] = useState(false);
  const [editorTab, setEditorTab] = useState<LandingEditorTab>("hero");
  /** split = editor+preview · editor = só formulário · preview = só pré-visualização */
  const [workspaceLayout, setWorkspaceLayout] = useState<"split" | "editor" | "preview">("split");
  const [previewViewport, setPreviewViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [planLabels, setPlanLabels] = useState<Record<string, string>>(() => mergeWithDefaultLabels(undefined));
  const [heroVisual, setHeroVisual] = useState<PlansHeroVisual>(() => ({ ...DEFAULT_PLANS_HERO_VISUAL }));

  const [appearance, setAppearance] = useState<LandingExtrasPublic["appearance"]>("default");
  const [landingTheme, setLandingTheme] = useState<LandingPageThemeInput>({});
  const [plansSectionLabel, setPlansSectionLabel] = useState("");
  const [plansSectionTitle, setPlansSectionTitle] = useState("");
  const [plansSectionSubtitle, setPlansSectionSubtitle] = useState("");
  const [featTitle, setFeatTitle] = useState("");
  const [featSubtitle, setFeatSubtitle] = useState("");
  const [featCards, setFeatCards] = useState(() => [
    { title: "", body: "", image_url: "" },
    { title: "", body: "", image_url: "" },
    { title: "", body: "", image_url: "" },
  ]);
  const featureImageInputRef = useRef<HTMLInputElement>(null);
  const featureImagePickIndexRef = useRef<number | null>(null);
  const [featureImageUploadBusy, setFeatureImageUploadBusy] = useState(false);
  const [statTitle, setStatTitle] = useState("");
  const [statSubtitle, setStatSubtitle] = useState("");
  const [statItems, setStatItems] = useState(() => [
    { value: "", label: "" },
    { value: "", label: "" },
    { value: "", label: "" },
    { value: "", label: "" },
  ]);
  const [faqTitle, setFaqTitle] = useState("");
  const [faqItems, setFaqItems] = useState(() =>
    Array.from({ length: 5 }, () => ({ q: "", a: "" })),
  );
  const [legalLines, setLegalLines] = useState("");
  const [legalLinks, setLegalLinks] = useState(() => [
    { label: "", href: "" },
    { label: "", href: "" },
    { label: "", href: "" },
  ]);
  const [heroNote, setHeroNote] = useState("");
  const [recommendedPlanType, setRecommendedPlanType] = useState("monthly");
  const [recommendedNote, setRecommendedNote] = useState("");
  const [freeLimitsNote, setFreeLimitsNote] = useState("");
  const [planTaglines, setPlanTaglines] = useState({
    free_trial: "",
    monthly: "",
    annual: "",
    quarterly: "",
  });
  const [demoOffer, setDemoOffer] = useState("");
  const [demoNav, setDemoNav] = useState("");
  const [demoStatus, setDemoStatus] = useState("");
  const [demoPresellNote, setDemoPresellNote] = useState("");
  const [demoKeywordsLabel, setDemoKeywordsLabel] = useState("");
  const [demoKeywords, setDemoKeywords] = useState("");
  const [demoKeywordMeta, setDemoKeywordMeta] = useState("");
  const [demoAdLabel, setDemoAdLabel] = useState("");
  const [demoAdTitle, setDemoAdTitle] = useState("");
  const [demoAdMeta, setDemoAdMeta] = useState("");
  const [demoRows, setDemoRows] = useState("");
  const [demoCaption, setDemoCaption] = useState("");
  const [contentBlocks, setContentBlocks] = useState<EditorContentBlockWithKey[]>([]);

  const contentBlockListSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [sectionOrder, setSectionOrder] = useState<LandingSectionId[]>(() => [
    ...DEFAULT_LANDING_SECTION_ORDER,
  ]);
  const [sectionsEnabled, setSectionsEnabled] = useState<Record<LandingSectionId, boolean>>(() => {
    const o = {} as Record<LandingSectionId, boolean>;
    for (const id of LANDING_SECTION_IDS) o[id] = true;
    return o;
  });
  const [siteChrome, setSiteChrome] = useState<LandingSiteChrome>(() => ({
    ...DEFAULT_LANDING_SITE_CHROME,
    objective_links: DEFAULT_LANDING_SITE_CHROME.objective_links.map((l) => ({ ...l })),
  }));
  const [promos, setPromos] = useState<SalesLandingPromos>(() =>
    structuredClone(DEFAULT_SALES_LANDING_PROMOS),
  );
  /** Modo público: visual (page_document) vs clássico (secções deste formulário). */
  const [builderEnabled, setBuilderEnabled] = useState(false);
  const [savedPageDocument, setSavedPageDocument] = useState<unknown | null>(null);
  const [testimonialTitle, setTestimonialTitle] = useState("");
  const [testimonialSubtitle, setTestimonialSubtitle] = useState("");
  const [testimonialItems, setTestimonialItems] = useState<
    {
      thumbnail_url: string;
      video_url: string;
      quote: string;
      name: string;
      role: string;
      social_handle: string;
    }[]
  >([]);
  const [galleryTitle, setGalleryTitle] = useState("");
  const [gallerySubtitle, setGallerySubtitle] = useState("");
  const [galleryItems, setGalleryItems] = useState<
    {
      image_url: string;
      name: string;
      role: string;
      social_handle: string;
      caption: string;
    }[]
  >([]);
  const [galleryDisplay, setGalleryDisplay] = useState<"grid" | "carousel">("grid");
  const [galleryCarouselOpts, setGalleryCarouselOpts] = useState(() => {
    const o = resolveGalleryCarouselOptions({});
    return {
      autoplay: o.autoplay,
      interval_ms: o.interval_ms,
      show_arrows: o.show_arrows,
      show_dots: o.show_dots,
      slides_desktop: o.slides_desktop,
      slides_mobile: o.slides_mobile,
      loop: o.loop,
      gap_px: o.gap_px,
    };
  });
  const galleryFileInputRef = useRef<HTMLInputElement>(null);
  const galleryPickIndexRef = useRef<number | null>(null);
  const [galleryUploadBusy, setGalleryUploadBusy] = useState(false);
  const testimonialThumbFileInputRef = useRef<HTMLInputElement>(null);
  const testimonialThumbPickIndexRef = useRef<number | null>(null);
  const [testimonialThumbUploadBusy, setTestimonialThumbUploadBusy] = useState(false);
  const contentBlockImageFileInputRef = useRef<HTMLInputElement>(null);
  const contentBlockImagePickIndexRef = useRef<number | null>(null);
  const [contentBlockImageUploadBusy, setContentBlockImageUploadBusy] = useState(false);
  const guaranteeSealInputRef = useRef<HTMLInputElement>(null);
  const [guaranteeSealUploadBusy, setGuaranteeSealUploadBusy] = useState(false);
  const [guaranteeEnabled, setGuaranteeEnabled] = useState(true);
  const [guaranteeSealUrl, setGuaranteeSealUrl] = useState("");
  const [guaranteeTitle, setGuaranteeTitle] = useState("");
  const [guaranteeLead, setGuaranteeLead] = useState("");
  const [guaranteeBody, setGuaranteeBody] = useState("");
  const [guaranteeFooter, setGuaranteeFooter] = useState("");
  const [textStyles, setTextStyles] = useState<LandingTextStylesPublic>({});

  const patchTextStyle = (key: LandingTextStyleKey, block: LandingTextStyleBlock | undefined) => {
    setTextStyles((prev) => {
      if (!block || !Object.keys(block).length) {
        const { [key]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: block };
    });
  };

  useEffect(() => {
    if (!data) return;
    setBadgeText(data.badge_text ?? "");
    setHeroTitle(data.hero_title);
    setHeroSubtitle(data.hero_subtitle ?? "");
    setIntroText(data.intro_text ?? "");
    setFooterText(data.footer_text ?? "");
    setHeroFont(data.hero_font ?? "sans");
    setHeroTextAlign(data.hero_text_align ?? "left");
    setHeroTitleSize(data.hero_title_size ?? "3xl");
    setHeroTitleWeight(data.hero_title_weight ?? "bold");
    setHeroSubtitleSize(data.hero_subtitle_size ?? "base");
    setIntroFont(data.intro_font ?? "sans");
    setIntroTextAlign(data.intro_text_align ?? "left");
    setIntroTextSize(data.intro_text_size ?? "base");
    setFooterFont(data.footer_font ?? "sans");
    setFooterTextAlign(data.footer_text_align ?? "center");
    setFooterTextSize(data.footer_text_size ?? "sm");
    setPlanLabels(mergeWithDefaultLabels(data.plan_display_labels));
    setHeroVisual(coercePlansHeroVisual(data.hero_visual));

    const ex = coerceLandingExtras(data.landing_extras);
    setAppearance(ex.appearance);
    setTextStyles(ex.text_styles && Object.keys(ex.text_styles).length ? { ...ex.text_styles } : {});
    setLandingTheme(ex.theme ? { ...ex.theme } : {});
    setPlansSectionLabel(ex.plans_section_label ?? "");
    setPlansSectionTitle(ex.plans_section_title ?? "");
    setPlansSectionSubtitle(ex.plans_section_subtitle ?? "");
    setFeatTitle(ex.features?.title ?? "");
    setFeatSubtitle(ex.features?.subtitle ?? "");
    const fc = ex.features?.cards ?? [];
    setFeatCards(
      fc.length
        ? fc.slice(0, 6).map((card) => ({
            title: card.title ?? "",
            body: card.body ?? "",
            image_url: card.image_url?.trim() ?? "",
          }))
        : [{ title: "", body: "", image_url: "" }],
    );
    setStatTitle(ex.stats?.title ?? "");
    setStatSubtitle(ex.stats?.subtitle ?? "");
    const si = ex.stats?.items ?? [];
    setStatItems(
      si.length
        ? si.slice(0, 8).map((item) => ({ value: item.value ?? "", label: item.label ?? "" }))
        : [{ value: "", label: "" }],
    );
    setFaqTitle(ex.faq?.title ?? "");
    const fq = ex.faq?.items ?? [];
    setFaqItems(
      fq.length ? fq.slice(0, 20).map((item) => ({ q: item.q ?? "", a: item.a ?? "" })) : [{ q: "", a: "" }],
    );
    setLegalLines((ex.legal_footer?.lines ?? []).join("\n"));
    const ll = ex.legal_footer?.links ?? [];
    setLegalLinks(
      ll.length
        ? ll.slice(0, 12).map((link) => ({ label: link.label ?? "", href: link.href ?? "" }))
        : [{ label: "", href: "" }],
    );
    setHeroNote(ex.hero_note ?? "");
    {
      const sc = ex.site_chrome ?? DEFAULT_LANDING_SITE_CHROME;
      setSiteChrome({
        ...DEFAULT_LANDING_SITE_CHROME,
        ...sc,
        objective_links: (sc.objective_links?.length
          ? sc.objective_links
          : DEFAULT_LANDING_SITE_CHROME.objective_links
        ).map((l) => ({ label: l.label, href: l.href })),
      });
    }
    setPromos(
      ex.promos
        ? structuredClone(ex.promos)
        : structuredClone(DEFAULT_SALES_LANDING_PROMOS),
    );
    setBuilderEnabled(ex.builder_enabled === true);
    setSavedPageDocument(ex.page_document ?? null);
    setRecommendedPlanType(ex.recommended_plan_type?.trim() || "none");
    setRecommendedNote(ex.recommended_note ?? "");
    setFreeLimitsNote(ex.free_limits_note ?? "");
    setPlanTaglines({
      free_trial: ex.plan_taglines?.free_trial ?? "",
      monthly: ex.plan_taglines?.monthly ?? "",
      annual: ex.plan_taglines?.annual ?? "",
      quarterly: ex.plan_taglines?.quarterly ?? "",
    });
    const demo = ex.product_demo;
    setDemoOffer(demo?.offer_name ?? "");
    setDemoNav((demo?.nav_items ?? []).join("\n"));
    setDemoStatus(demo?.presell_status ?? "");
    setDemoPresellNote(demo?.presell_note ?? "");
    setDemoKeywordsLabel(demo?.keywords_label ?? "");
    setDemoKeywords((demo?.keywords ?? []).join("\n"));
    setDemoKeywordMeta(demo?.keyword_meta ?? "");
    setDemoAdLabel(demo?.ad_label ?? "");
    setDemoAdTitle(demo?.ad_title ?? "");
    setDemoAdMeta(demo?.ad_meta ?? "");
    setDemoRows((demo?.rows ?? []).map((row) => `${row.label} | ${row.value}`).join("\n"));
    setDemoCaption(demo?.caption ?? "");

    const blocks = ex.content_blocks;
    if (blocks?.length) {
      setContentBlocks(
        blocks.map((b) => {
          const key = newLandingContentBlockKey();
          if (b.type === "rich_text") {
            return {
              type: "rich_text" as const,
              content: b.content ?? "",
              font_family: b.font_family ?? "sans",
              font_size: b.font_size ?? "base",
              font_weight: b.font_weight ?? "normal",
              text_align: b.text_align ?? "left",
              text_color: b.text_color?.trim() ?? "",
              background_color: b.background_color?.trim() ?? "",
              layout: b.layout === "wide" ? "wide" : "contained",
              _key: key,
            };
          }
          if (b.type === "image") {
            return {
              type: "image" as const,
              title: b.title ?? "",
              subtitle: b.subtitle ?? "",
              src: b.src,
              alt: b.alt ?? "",
              caption: b.caption ?? "",
              layout: b.layout === "wide" ? "wide" : "contained",
              _key: key,
            };
          }
          return {
            type: "video" as const,
            title: b.title ?? "",
            subtitle: b.subtitle ?? "",
            url: b.url,
            layout: b.layout === "wide" ? "wide" : "contained",
            _key: key,
          };
        }),
      );
    } else {
      setContentBlocks([]);
    }

    setSectionOrder(resolveSectionOrder(ex.section_order));
    setSectionsEnabled(resolveSectionsEnabled(ex.sections_enabled));

    const te = ex.testimonials;
    setTestimonialTitle(te?.title ?? "");
    setTestimonialSubtitle(te?.subtitle ?? "");
    setTestimonialItems(
      te?.items?.length
        ? te.items.map((it) => ({
            thumbnail_url: it.thumbnail_url,
            video_url: it.video_url,
            quote: it.quote ?? "",
            name: it.name ?? "",
            role: it.role ?? "",
            social_handle: it.social_handle ?? "",
          }))
        : [],
    );

    const gal = ex.gallery;
    setGalleryTitle(gal?.title ?? "");
    setGallerySubtitle(gal?.subtitle ?? "");
    setGalleryItems(
      gal?.items?.length
        ? gal.items.map((it) => ({
            image_url: it.image_url,
            name: it.name ?? "",
            role: it.role ?? "",
            social_handle: it.social_handle ?? "",
            caption: it.caption ?? "",
          }))
        : [],
    );
    setGalleryDisplay(gal?.display === "carousel" ? "carousel" : "grid");
    const gc = resolveGalleryCarouselOptions(gal?.carousel ?? {});
    setGalleryCarouselOpts({
      autoplay: gc.autoplay,
      interval_ms: gc.interval_ms,
      show_arrows: gc.show_arrows,
      show_dots: gc.show_dots,
      slides_desktop: gc.slides_desktop,
      slides_mobile: gc.slides_mobile,
      loop: gc.loop,
      gap_px: gc.gap_px,
    });

    const gu = ex.guarantee;
    setGuaranteeEnabled(gu?.enabled !== false);
    setGuaranteeSealUrl(gu?.seal_image_url?.trim() ?? "");
    setGuaranteeTitle(gu?.title ?? "");
    setGuaranteeLead(gu?.lead ?? "");
    setGuaranteeBody(gu?.body ?? "");
    setGuaranteeFooter(gu?.footer ?? "");
  }, [data]);

  const buildLandingExtrasPayload = (): Record<string, unknown> => {
    const cards = featCards
      .map((c) => ({
        title: c.title.trim(),
        body: c.body.trim(),
        image_url: c.image_url?.trim() || null,
      }))
      .filter((c) => c.title || c.body || c.image_url);
    const features =
      cards.length || featTitle.trim() || featSubtitle.trim()
        ? {
            title: featTitle.trim() || null,
            subtitle: featSubtitle.trim() || null,
            cards,
          }
        : null;

    const statsFiltered = statItems
      .map((s) => ({ value: s.value.trim(), label: s.label.trim() }))
      .filter((s) => s.value || s.label);
    const stats =
      statsFiltered.length || statTitle.trim() || statSubtitle.trim()
        ? {
            title: statTitle.trim() || null,
            subtitle: statSubtitle.trim() || null,
            items: statsFiltered,
          }
        : null;

    const faqFiltered = faqItems
      .map((f) => ({ q: f.q.trim(), a: f.a.trim() }))
      .filter((f) => f.q || f.a);
    const faq =
      faqFiltered.length || faqTitle.trim()
        ? {
            title: faqTitle.trim() || null,
            items: faqFiltered,
          }
        : null;

    const lines = legalLines
      .split("\n")
      .map((l) => l.trimEnd())
      .filter((l) => l.trim());
    const links = legalLinks
      .map((l) => ({ label: l.label.trim(), href: l.href.trim() }))
      .filter((l) => l.label && l.href);
    const legal_footer =
      lines.length || links.length
        ? {
            lines: lines.length ? lines : undefined,
            links: links.length ? links : undefined,
          }
        : null;

    const content_blocks = contentBlocks
      .map((b) => {
        if (b.type === "rich_text") {
          const content = b.content.trim();
          if (!content) return null;
          return {
            type: "rich_text" as const,
            content,
            font_family: b.font_family,
            font_size: b.font_size,
            font_weight: b.font_weight,
            text_align: b.text_align,
            text_color: b.text_color.trim() || null,
            background_color: b.background_color.trim() || null,
            ...(b.layout === "wide" ? { layout: "wide" as const } : {}),
          };
        }
        if (b.type === "video") {
          const url = b.url.trim();
          if (!url) return null;
          return {
            type: "video" as const,
            title: b.title.trim() || null,
            subtitle: b.subtitle.trim() || null,
            url,
            ...(b.layout === "wide" ? { layout: "wide" as const } : {}),
          };
        }
        const src = b.src.trim();
        if (!src) return null;
        return {
          type: "image" as const,
          title: b.title.trim() || null,
          subtitle: b.subtitle.trim() || null,
          src,
          alt: b.alt.trim() || undefined,
          caption: b.caption.trim() || null,
          ...(b.layout === "wide" ? { layout: "wide" as const } : {}),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const testimonialFiltered = testimonialItems
      .map((t) => ({
        thumbnail_url: t.thumbnail_url.trim(),
        video_url: t.video_url.trim(),
        quote: t.quote.trim() || null,
        name: t.name.trim() || null,
        role: t.role.trim() || null,
        social_handle: t.social_handle.trim() || null,
      }))
      .filter((t) => Boolean(t.quote) || (Boolean(t.thumbnail_url) && Boolean(t.video_url)));

    const testimonials =
      testimonialFiltered.length > 0
        ? {
            title: testimonialTitle.trim() || null,
            subtitle: testimonialSubtitle.trim() || null,
            items: testimonialFiltered,
          }
        : null;

    const galleryFiltered = galleryItems
      .map((t) => ({
        image_url: t.image_url.trim(),
        name: t.name.trim() || null,
        role: t.role.trim() || null,
        social_handle: t.social_handle.trim() || null,
        caption: t.caption.trim() || null,
      }))
      .filter((t) => t.image_url);

    const intervalMs = Math.min(
      120_000,
      Math.max(2000, Math.floor(galleryCarouselOpts.interval_ms) || 5000),
    );
    const slidesD = Math.min(4, Math.max(1, Math.floor(galleryCarouselOpts.slides_desktop) || 3));
    const slidesM = Math.min(2, Math.max(1, Math.floor(galleryCarouselOpts.slides_mobile) || 1));
    const gapPx = Math.min(64, Math.max(0, Math.floor(galleryCarouselOpts.gap_px) || 16));

    const gallery =
      galleryFiltered.length > 0
        ? {
            title: galleryTitle.trim() || null,
            subtitle: gallerySubtitle.trim() || null,
            items: galleryFiltered,
            display: galleryDisplay,
            carousel:
              galleryDisplay === "carousel"
                ? {
                    autoplay: galleryCarouselOpts.autoplay,
                    interval_ms: intervalMs,
                    show_arrows: galleryCarouselOpts.show_arrows,
                    show_dots: galleryCarouselOpts.show_dots,
                    slides_desktop: slidesD,
                    slides_mobile: slidesM,
                    loop: galleryCarouselOpts.loop,
                    gap_px: gapPx,
                  }
                : null,
          }
        : null;

    const themeEntries = Object.entries(landingTheme).filter(
      ([k, v]) =>
        v !== undefined &&
        v !== null &&
        (k === "section_font" || (typeof v === "string" && v.trim() !== "")),
    );
    const themePayload =
      themeEntries.length > 0 ? (Object.fromEntries(themeEntries) as LandingPageThemeInput) : null;

    const text_styles = Object.keys(textStyles).length ? textStyles : null;

    const hasGuaranteePayload =
      guaranteeTitle.trim() ||
      guaranteeLead.trim() ||
      guaranteeBody.trim() ||
      guaranteeFooter.trim() ||
      guaranteeSealUrl.trim() ||
      !guaranteeEnabled;
    const guarantee = hasGuaranteePayload
      ? {
          enabled: guaranteeEnabled,
          seal_image_url: guaranteeSealUrl.trim() || null,
          title: guaranteeTitle.trim() || null,
          lead: guaranteeLead.trim() || null,
          body: guaranteeBody.trim() || null,
          footer: guaranteeFooter.trim() || null,
        }
      : null;

    return {
      appearance,
      plans_section_label: plansSectionLabel.trim() || null,
      plans_section_title: plansSectionTitle.trim() || null,
      plans_section_subtitle: plansSectionSubtitle.trim() || null,
      features,
      stats,
      faq,
      legal_footer,
      content_blocks: content_blocks.length ? content_blocks : null,
      testimonials,
      gallery,
      guarantee,
      section_order: sectionOrder,
      sections_enabled: {
        content_blocks: sectionsEnabled.content_blocks,
        features: sectionsEnabled.features,
        stats: sectionsEnabled.stats,
        testimonials: sectionsEnabled.testimonials,
        gallery: sectionsEnabled.gallery,
        planos: sectionsEnabled.planos,
        guarantee: sectionsEnabled.guarantee,
        faq: sectionsEnabled.faq,
        product_demo: sectionsEnabled.product_demo,
        account_plan: sectionsEnabled.account_plan,
      },
      hero_note: heroNote.trim() || null,
      recommended_plan_type: recommendedPlanType === "none" ? "" : recommendedPlanType,
      recommended_note: recommendedNote.trim() || null,
      free_limits_note: freeLimitsNote.trim() || null,
      plan_taglines: {
        free_trial: planTaglines.free_trial.trim() || null,
        monthly: planTaglines.monthly.trim() || null,
        annual: planTaglines.annual.trim() || null,
        quarterly: planTaglines.quarterly.trim() || null,
      },
      product_demo: {
        offer_name: demoOffer.trim() || null,
        nav_items: demoNav.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 6),
        presell_status: demoStatus.trim() || null,
        presell_note: demoPresellNote.trim() || null,
        keywords_label: demoKeywordsLabel.trim() || null,
        keywords: demoKeywords.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 8),
        keyword_meta: demoKeywordMeta.trim() || null,
        ad_label: demoAdLabel.trim() || null,
        ad_title: demoAdTitle.trim() || null,
        ad_meta: demoAdMeta.trim() || null,
        rows: demoRows
          .split("\n")
          .map((line) => {
            const [label, ...rest] = line.split("|");
            return { label: (label ?? "").trim(), value: rest.join("|").trim() };
          })
          .filter((row) => row.label || row.value)
          .slice(0, 6),
        caption: demoCaption.trim() || null,
      },
      theme: themePayload,
      text_styles,
      site_chrome: {
        brand_label: siteChrome.brand_label?.trim() || null,
        brand_logo_url: siteChrome.brand_logo_url?.trim() || null,
        buy_label: siteChrome.buy_label?.trim() || null,
        login_label: siteChrome.login_label?.trim() || null,
        panel_label: siteChrome.panel_label?.trim() || null,
        hero_secondary_cta_enabled: siteChrome.hero_secondary_cta_enabled,
        hero_secondary_cta_label: siteChrome.hero_secondary_cta_label?.trim() || null,
        hero_secondary_cta_href: siteChrome.hero_secondary_cta_href?.trim() || null,
        show_objective_nav: siteChrome.show_objective_nav,
        objective_nav_label: siteChrome.objective_nav_label?.trim() || null,
        objective_links: siteChrome.objective_links
          .map((l) => ({ label: l.label.trim(), href: l.href.trim() }))
          .filter((l) => l.label && l.href)
          .slice(0, 8),
        agency_banner_enabled: siteChrome.agency_banner_enabled,
        agency_banner_text: siteChrome.agency_banner_text?.trim() || null,
        agency_banner_cta_label: siteChrome.agency_banner_cta_label?.trim() || null,
        agency_banner_href: siteChrome.agency_banner_href?.trim() || null,
        seo_title: siteChrome.seo_title?.trim() || null,
        seo_description: siteChrome.seo_description?.trim() || null,
      },
      promos: {
        sticky_bar: {
          ...promos.sticky_bar,
          text: promos.sticky_bar.text.trim(),
          cta_label: promos.sticky_bar.cta_label?.trim() || null,
          cta_href: promos.sticky_bar.cta_href?.trim() || null,
          discount_code: promos.sticky_bar.discount_code?.trim() || null,
          accent: promos.sticky_bar.accent?.trim() || null,
          text_color: promos.sticky_bar.text_color?.trim() || null,
          background: promos.sticky_bar.background?.trim() || null,
        },
        popups: promos.popups.slice(0, 8).map((p) => ({
          ...p,
          id: p.id.trim() || `promo_${Date.now()}`,
          badge: p.badge?.trim() || null,
          title: p.title.trim(),
          body: p.body.trim(),
          discount_code: p.discount_code?.trim() || null,
          discount_hint: p.discount_hint?.trim() || null,
          cta_label: p.cta_label.trim() || "Continuar",
          cta_href: p.cta_href.trim() || "#planos",
          secondary_label: p.secondary_label?.trim() || null,
          secondary_href: p.secondary_href?.trim() || null,
          accent: p.accent?.trim() || null,
        })),
      },
      /**
       * Preserva o documento do editor visual ao guardar o clássico.
       * Nunca enviar `page_document: null` — o merge apagaria o layout publicado.
       */
      builder_enabled: builderEnabled,
      ...(savedPageDocument != null ? { page_document: savedPageDocument } : {}),
    };
  };

  /* buildLandingExtrasPayload() usa apenas estados já listados; a referência da função muda a cada render. */
  const previewExtras = useMemo(
    () => coerceLandingExtras(buildLandingExtrasPayload()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      appearance,
      landingTheme,
      textStyles,
      plansSectionLabel,
      plansSectionTitle,
      plansSectionSubtitle,
      featTitle,
      featSubtitle,
      featCards,
      statTitle,
      statSubtitle,
      statItems,
      faqTitle,
      faqItems,
      legalLines,
      legalLinks,
      contentBlocks,
      testimonialTitle,
      testimonialSubtitle,
      testimonialItems,
      galleryTitle,
      gallerySubtitle,
      galleryItems,
      galleryDisplay,
      galleryCarouselOpts,
      guaranteeEnabled,
      guaranteeSealUrl,
      guaranteeTitle,
      guaranteeLead,
      guaranteeBody,
      guaranteeFooter,
      builderEnabled,
      savedPageDocument,
      sectionOrder,
      sectionsEnabled,
      siteChrome,
      promos,
      heroNote,
      recommendedPlanType,
      recommendedNote,
      freeLimitsNote,
      planTaglines,
      demoOffer,
      demoNav,
      demoStatus,
      demoPresellNote,
      demoKeywordsLabel,
      demoKeywords,
      demoKeywordMeta,
      demoAdLabel,
      demoAdTitle,
      demoAdMeta,
      demoRows,
      demoCaption,
    ],
  );

  const previewSalesThemed = useMemo(() => resolveLandingPageTheme(landingTheme), [landingTheme]);

  const previewFrameWidth =
    previewViewport === "mobile" ? 390 : previewViewport === "tablet" ? 768 : 1200;

  const addContentBlock = (kind: LandingWidgetKind) => {
    const key = newLandingContentBlockKey();
    setContentBlocks((prev) => [
      ...prev,
      kind === "rich_text"
        ? {
            type: "rich_text",
            content: "",
            font_family: "sans",
            font_size: "base",
            font_weight: "normal",
            text_align: "left",
            text_color: "",
            background_color: "",
            layout: "contained",
            _key: key,
          }
        : kind === "video"
          ? {
              type: "video",
              title: "",
              subtitle: "",
              url: "",
              layout: "contained",
              _key: key,
            }
          : {
              type: "image",
              title: "",
              subtitle: "",
              src: "",
              alt: "",
              caption: "",
              layout: "contained",
              _key: key,
            },
    ]);
  };

  const handleContentBlocksDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setContentBlocks((items) => {
      const oldIndex = items.findIndex((b) => b._key === active.id);
      const newIndex = items.findIndex((b) => b._key === over.id);
      if (oldIndex < 0 || newIndex < 0) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const moveContentBlock = (index: number, delta: -1 | 1) => {
    setContentBlocks((prev) => {
      const next = [...prev];
      const j = index + delta;
      if (j < 0 || j >= next.length) return prev;
      const moved = next[index];
      next[index] = next[j]!;
      next[j] = moved!;
      return next;
    });
  };

  const removeContentBlock = (index: number) => {
    setContentBlocks((prev) => prev.filter((_, i) => i !== index));
  };

  const moveGalleryItem = (index: number, delta: -1 | 1) => {
    setGalleryItems((prev) => {
      const next = [...prev];
      const j = index + delta;
      if (j < 0 || j >= next.length) return prev;
      const moved = next[index]!;
      next[index] = next[j]!;
      next[j] = moved;
      return next;
    });
  };

  const moveSectionInOrder = (index: number, delta: -1 | 1) => {
    setSectionOrder((prev) => {
      const next = [...prev];
      const j = index + delta;
      if (j < 0 || j >= next.length) return prev;
      const moved = next[index];
      next[index] = next[j]!;
      next[j] = moved!;
      return next;
    });
  };

  const saveTexts = async () => {
    if (!heroTitle.trim()) {
      toast.error(t("pages.admin.landing.heroRequired"));
      return;
    }
    if (builderEnabled && !savedPageDocument) {
      toast.error(
        t("pages.admin.landing.visualNoDoc"),
      );
      return;
    }
    setSaving(true);
    try {
      const { data: patched, error } = await adminService.patchPlansLanding({
        badge_text: badgeText.trim() === "" ? null : badgeText.trim(),
        hero_title: heroTitle.trim(),
        hero_subtitle: heroSubtitle.trim() === "" ? null : heroSubtitle.trim(),
        intro_text: introText.trim() === "" ? null : introText.trim(),
        footer_text: footerText.trim() === "" ? null : footerText.trim(),
        hero_font: heroFont,
        hero_text_align: heroTextAlign,
        hero_title_size: heroTitleSize,
        hero_title_weight: heroTitleWeight,
        hero_subtitle_size: heroSubtitleSize,
        intro_font: introFont,
        intro_text_align: introTextAlign,
        intro_text_size: introTextSize,
        footer_font: footerFont,
        footer_text_align: footerTextAlign,
        footer_text_size: footerTextSize,
        plan_display_labels: planLabels,
        hero_visual: {
          image_effect: heroVisual.image_effect,
          image_object_position: heroVisual.image_object_position,
          min_height_mobile_px: heroVisual.min_height_mobile_px,
          min_height_desktop_px: heroVisual.min_height_desktop_px,
          overlay_style: heroVisual.overlay_style,
          overlay_intensity: heroVisual.overlay_intensity,
          content_entrance: heroVisual.content_entrance,
          cta_enabled: heroVisual.cta_enabled,
          cta_label: heroVisual.cta_label?.trim() ? heroVisual.cta_label.trim() : null,
          cta_href: heroVisual.cta_href?.trim() ? heroVisual.cta_href.trim() : null,
        },
        landing_extras: buildLandingExtrasPayload(),
      });
      if (error) {
        toast.error(error);
        return;
      }
      /** Evita corrida: refetches antigos do GET não podem sobrescrever resposta fresca do PATCH. */
      await queryClient.cancelQueries({ queryKey: ADMIN_KEY });
      if (patched) {
        const { ok: _ok, ...row } = patched as PlansLandingPublic & { ok?: boolean };
        queryClient.setQueryData(ADMIN_KEY, row as PlansLandingPublic);
        const ex = coerceLandingExtras(row.landing_extras);
        setBuilderEnabled(ex.builder_enabled === true);
        setSavedPageDocument(ex.page_document ?? null);
      }
      toast.success(
        builderEnabled
          ? t("pages.admin.landing.savedVisual")
          : t("pages.admin.landing.savedClassic"),
      );
      queryClient.invalidateQueries({ queryKey: PUBLIC_KEY });
      onInvalidateAdmin?.();
    } finally {
      setSaving(false);
    }
  };

  const uploadMutation = useMutation({
    mutationFn: (file: File) => adminService.uploadPlansHeroImage(file),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const at = result.data?.updated_at;
      if (at) {
        void queryClient.cancelQueries({ queryKey: ADMIN_KEY });
        queryClient.setQueryData(ADMIN_KEY, (prev) =>
          prev && typeof prev === "object"
            ? { ...prev, has_hero_image: true, updated_at: at }
            : prev,
        );
      }
      toast.success(result.data?.message ?? t("pages.admin.landing.imagePublished"));
      queryClient.invalidateQueries({ queryKey: PUBLIC_KEY });
      onInvalidateAdmin?.();
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => adminService.clearPlansHeroImage(),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const row = result.data;
      if (row?.updated_at) {
        void queryClient.cancelQueries({ queryKey: ADMIN_KEY });
        const { message: _m, ...rest } = row as PlansLandingPublic & { message?: string };
        queryClient.setQueryData(ADMIN_KEY, rest as PlansLandingPublic);
      }
      toast.success(t("pages.admin.landing.heroRemoved"));
      queryClient.invalidateQueries({ queryKey: PUBLIC_KEY });
      onInvalidateAdmin?.();
    },
  });

  if (isLoading) {
    return (
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="py-4">
          <CardTitle className="text-base">{t("pages.admin.landing.title")}</CardTitle>
          <CardDescription>{t("pages.admin.landing.loading")}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="border-destructive/30 shadow-sm">
        <CardHeader className="py-4">
          <CardTitle className="text-base">{t("pages.admin.landing.title")}</CardTitle>
          <CardDescription>{t("pages.admin.landing.loadError")}</CardDescription>
        </CardHeader>
        <CardContent className="pt-0 pb-4">
          <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  const previewAt = data.updated_at;

  const previewDocument = (
    <LandingPageThemeProvider value={appearance === "sales_dark" ? previewSalesThemed : null}>
      <div
        className={cn(
          "landing-admin-preview overflow-hidden rounded-lg border border-border/50 shadow-sm",
          appearance === "sales_dark" && "min-h-[200px]",
        )}
        style={
          appearance === "sales_dark"
            ? {
                backgroundColor: previewSalesThemed.page_background,
                color: previewSalesThemed.heading_on_dark,
              }
            : { backgroundColor: "hsl(var(--background))" }
        }
      >
        <style>{`
          .landing-admin-preview [class*="aspect-[9/16]"] {
            aspect-ratio: 4 / 5;
            max-height: 14rem;
          }
          .landing-admin-preview .grid.md\\:grid-cols-3 {
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          }
        `}</style>
        <div className="p-4 sm:p-5">
          {appearance === "sales_dark" ? (
            <section
              className={cn(
                "grid items-start gap-5",
                previewExtras.product_demo && sectionsEnabled.product_demo && "lg:grid-cols-2",
              )}
            >
              <div className="space-y-3">
                {badgeText.trim() ? (
                  <span
                    className="inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                    style={{
                      borderColor: previewSalesThemed.badge_border,
                      backgroundColor: previewSalesThemed.badge_background,
                      color: previewSalesThemed.badge_text,
                    }}
                  >
                    {badgeText}
                  </span>
                ) : null}
                <h3 className="text-xl font-bold leading-snug text-white sm:text-2xl">{heroTitle || "…"}</h3>
                {heroSubtitle.trim() ? (
                  <p className="text-sm leading-relaxed text-white/75 sm:text-base">{heroSubtitle}</p>
                ) : null}
                {previewExtras.hero_note?.trim() ? (
                  <p className="text-xs leading-relaxed text-white/60 sm:text-sm">{previewExtras.hero_note}</p>
                ) : null}
              </div>
              {sectionsEnabled.product_demo && previewExtras.product_demo ? (
                <SalesProductDemo demo={previewExtras.product_demo} />
              ) : null}
            </section>
          ) : (
            <HeroPreview
              badgeText={badgeText}
              heroTitle={heroTitle || "…"}
              heroSubtitle={heroSubtitle}
              hasImage={data.has_hero_image}
              imageUpdatedAt={previewAt}
              heroFont={heroFont}
              heroTextAlign={heroTextAlign}
              heroTitleSize={heroTitleSize}
              heroTitleWeight={heroTitleWeight}
              heroSubtitleSize={heroSubtitleSize}
              heroVisual={heroVisual}
              textStyles={previewExtras.text_styles ?? undefined}
              salesTone={false}
              landingTheme={null}
              className="mb-0 border-border/80 bg-muted/20 shadow-inner"
            />
          )}
          {introText.trim() ? (
            <div
              className={cn(
                "mt-4 rounded-lg border border-border/60 bg-card/80 p-4",
                resolvedIntroClasses(
                  {
                    intro_font: introFont,
                    intro_text_align: introTextAlign,
                    intro_text_size: introTextSize,
                  },
                  previewExtras.text_styles?.intro,
                  {
                    omitColor:
                      appearance === "sales_dark" || Boolean(previewExtras.text_styles?.intro?.color?.trim()),
                  },
                ),
              )}
              style={landingTextStyleColorStyle(previewExtras.text_styles?.intro)}
            >
              <LandingMarkdown
                content={introText}
                surface={
                  appearance === "sales_dark" && !previewExtras.text_styles?.intro?.color?.trim()
                    ? "dark_page"
                    : "inherit"
                }
                salesTheme={appearance === "sales_dark" ? previewSalesThemed : null}
                colorOverrides={
                  previewExtras.text_styles?.intro?.color?.trim() && previewSalesThemed
                    ? {
                        body: previewExtras.text_styles.intro.color!.trim(),
                        heading: previewExtras.text_styles.intro.color!.trim(),
                        link: previewSalesThemed.link,
                        border: previewSalesThemed.nav_border,
                      }
                    : null
                }
              />
            </div>
          ) : (
            <p className="mt-4 text-xs italic text-muted-foreground">{t("pages.admin.landing.noIntro")}</p>
          )}
          <div className="mt-4">
            <LandingPageBodySections
              extras={previewExtras}
              plans={previewPlans}
              planLabels={mergeWithDefaultLabels(planLabels)}
              userPlan={null}
              previewMode
              onSelectPlan={() => {}}
            />
          </div>
          {footerText.trim() ? (
            <div
              className={cn(
                "mt-5 rounded-md border border-dashed border-border/80 bg-muted/30 p-3",
                resolvedFooterClasses(
                  {
                    footer_font: footerFont,
                    footer_text_align: footerTextAlign,
                    footer_text_size: footerTextSize,
                  },
                  previewExtras.text_styles?.footer,
                  {
                    omitColor:
                      appearance === "sales_dark" ||
                      Boolean(previewExtras.text_styles?.footer?.color?.trim()),
                  },
                ),
              )}
              style={landingTextStyleColorStyle(previewExtras.text_styles?.footer)}
            >
              <LandingMarkdown
                content={footerText}
                surface={
                  appearance === "sales_dark" && !previewExtras.text_styles?.footer?.color?.trim()
                    ? "dark_page"
                    : "inherit"
                }
                salesTheme={appearance === "sales_dark" ? previewSalesThemed : null}
                colorOverrides={
                  previewExtras.text_styles?.footer?.color?.trim() && previewSalesThemed
                    ? {
                        body: previewExtras.text_styles.footer.color!.trim(),
                        heading: previewExtras.text_styles.footer.color!.trim(),
                        link: previewSalesThemed.link,
                        border: previewSalesThemed.nav_border,
                      }
                    : null
                }
              />
            </div>
          ) : null}
          <div className="mt-5">
            <SalesLandingLegalFooter extras={previewExtras} />
          </div>
        </div>
      </div>
    </LandingPageThemeProvider>
  );

  const previewPane = (
    <div className="flex h-full min-h-0 flex-col bg-muted/30">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {t("pages.admin.landing.preview")}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {(
            [
              { id: "desktop" as const, icon: Monitor, label: t("pages.admin.landing.viewportDesktop") },
              { id: "tablet" as const, icon: Tablet, label: t("pages.admin.landing.viewportTablet") },
              { id: "mobile" as const, icon: Smartphone, label: t("pages.admin.landing.viewportMobile") },
            ] as const
          ).map((v) => {
            const Icon = v.icon;
            const active = previewViewport === v.id;
            return (
              <button
                key={v.id}
                type="button"
                title={v.label}
                aria-label={v.label}
                aria-pressed={active}
                onClick={() => setPreviewViewport(v.id)}
                className={cn(
                  "inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition-colors",
                  active
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{v.label}</span>
              </button>
            );
          })}
          <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-[11px]" asChild>
            <Link to="/" target="_blank" rel="noreferrer">
              Abrir
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>
      <div
        className={cn(
          "min-h-0 flex-1 overflow-auto",
          appearance === "sales_dark" ? "bg-[#070b16]" : "bg-muted/40",
        )}
      >
        <div className="flex justify-center p-3 sm:p-4">
          <div
            className={cn(
              "w-full transition-[max-width] duration-200",
              previewViewport === "mobile" && "rounded-[1.25rem] ring-1 ring-border/80 shadow-lg",
            )}
            style={{ maxWidth: `min(100%, ${previewFrameWidth}px)` }}
          >
            {previewDocument}
          </div>
        </div>
      </div>
      <p className="shrink-0 border-t border-border/50 px-3 py-1.5 text-[10px] text-muted-foreground">
        {fill(t("pages.admin.landing.frameWidth"), { px: previewFrameWidth })}
        {previewViewport === "desktop"
          ? t("pages.admin.landing.frameDesktop")
          : previewViewport === "tablet"
            ? t("pages.admin.landing.frameTablet")
            : t("pages.admin.landing.frameMobile")}
      </p>
    </div>
  );

  const workspaceHeightClass = "h-[min(78vh,920px)] min-h-[520px]";

  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
      <div className="sticky top-0 z-20 border-b border-border/70 bg-card/95 backdrop-blur-md supports-[backdrop-filter]:bg-card/90">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
              <LayoutTemplate className="h-4 w-4 text-primary" />
              {t("pages.admin.landing.title")}
            </h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {t("pages.admin.landing.editorLead")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-border/70 bg-muted/40 p-0.5">
              {(
                [
                  { id: "editor" as const, icon: PanelLeft, label: t("pages.admin.landing.layoutEditor"), short: t("pages.admin.landing.layoutEditorShort") },
                  { id: "split" as const, icon: Columns2, label: t("pages.admin.landing.layoutSplit"), short: t("pages.admin.landing.layoutSplit") },
                  { id: "preview" as const, icon: PanelRight, label: t("pages.admin.landing.layoutPreview"), short: t("pages.admin.landing.layoutPreviewShort") },
                ] as const
              ).map((layout) => {
                const Icon = layout.icon;
                const active = workspaceLayout === layout.id;
                return (
                  <button
                    key={layout.id}
                    type="button"
                    title={layout.label}
                    aria-label={layout.label}
                    aria-pressed={active}
                    onClick={() => setWorkspaceLayout(layout.id)}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                      active
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden lg:inline">{layout.short}</span>
                  </button>
                );
              })}
            </div>
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" asChild>
              <Link to="/" target="_blank" rel="noreferrer">
                {t("pages.admin.viewPage")}
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5"
              disabled={saving}
              onClick={() => void saveTexts()}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {t("common.save")}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 px-3 pb-3">
          {LANDING_EDITOR_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = editorTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setEditorTab(tab.id);
                  if (workspaceLayout === "preview") setWorkspaceLayout("split");
                }}
                className={cn(
                  "inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
                  active
                    ? "border-primary/40 bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20"
                    : "border-border/60 bg-muted/30 text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {t(tab.label)}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className={cn(
          "mx-3 mt-3 rounded-lg border px-3 py-3 text-xs leading-relaxed sm:mx-4",
          builderEnabled
            ? "border-emerald-500/40 bg-emerald-500/10 text-foreground"
            : "border-amber-500/40 bg-amber-500/10 text-foreground",
        )}
      >
        <p className="font-medium">
          {builderEnabled
            ? t("pages.admin.landing.modeVisual")
            : t("pages.admin.landing.modeClassic")}
        </p>
        <p className="mt-1 text-muted-foreground">
          {builderEnabled
            ? t("pages.admin.landing.modeVisualHint")
            : t("pages.admin.landing.modeClassicHint")}
        </p>
        <label className="mt-3 flex cursor-pointer items-center gap-2 font-medium">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border"
            checked={builderEnabled}
            disabled={!builderEnabled && !savedPageDocument}
            onChange={(e) => {
              const on = e.target.checked;
              if (on && !savedPageDocument) {
                toast.error(t("pages.admin.landing.noVisualDoc"));
                return;
              }
              setBuilderEnabled(on);
            }}
          />
          {t("pages.admin.landing.useVisual")}
          {!savedPageDocument ? (
            <span className="font-normal text-muted-foreground">{t("pages.admin.landing.noDoc")}</span>
          ) : null}
        </label>
      </div>

      <div
        className={cn(
          "grid",
          workspaceHeightClass,
          workspaceLayout === "split" && "xl:grid-cols-[minmax(0,1fr)_minmax(420px,1.05fr)]",
          workspaceLayout === "editor" && "grid-cols-1",
          workspaceLayout === "preview" && "grid-cols-1",
        )}
      >
        {workspaceLayout !== "preview" ? (
        <div
          className={cn(
            "min-w-0 min-h-0",
            workspaceLayout === "split" && "border-b border-border/60 xl:border-b-0 xl:border-r",
          )}
        >
          <div className={cn(workspaceHeightClass, "space-y-3 overflow-y-auto overscroll-contain p-3 sm:p-4")}>
            {editorTab === "structure" ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{t("pages.admin.landing.orderTitle")}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    {t("pages.admin.landing.orderHint")}
                  </p>
                </div>
                <div className="space-y-1.5">
                  {sectionOrder.map((id, index) => (
                    <div
                      key={id}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-muted/10 px-2.5 py-1.5"
                    >
                      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1 text-sm font-medium leading-tight">
                        {t(SECTION_LABEL_KEY[id])}
                      </span>
                      <div className="flex items-center gap-2">
                        <Label className="text-[11px] text-muted-foreground whitespace-nowrap">{t("pages.admin.landing.lblShow")}</Label>
                        <Switch
                          checked={sectionsEnabled[id]}
                          onCheckedChange={(v) =>
                            setSectionsEnabled((prev) => ({ ...prev, [id]: v }))
                          }
                        />
                      </div>
                      <div className="flex items-center gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={index === 0}
                          onClick={() => moveSectionInOrder(index, -1)}
                          aria-label={t("pages.admin.landing.moveUp")}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={index >= sectionOrder.length - 1}
                          onClick={() => moveSectionInOrder(index, 1)}
                          aria-label={t("pages.admin.landing.moveDown")}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-3 rounded-lg border border-border/70 bg-muted/10 p-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t("pages.admin.landing.navSeoTitle")}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                      {t("pages.admin.landing.navSeoHint")}
                    </p>
                  </div>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-[11px]">{t("pages.admin.landing.lblBrand")}</Label>
                      <Input
                        className="h-8 text-sm"
                        value={siteChrome.brand_label ?? ""}
                        onChange={(e) => setSiteChrome((p) => ({ ...p, brand_label: e.target.value }))}
                        maxLength={80}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">{t("pages.admin.landing.lblLogo")}</Label>
                      <Input
                        className="h-8 text-sm"
                        placeholder="/brand-dclickora.png"
                        value={siteChrome.brand_logo_url ?? ""}
                        onChange={(e) =>
                          setSiteChrome((p) => ({ ...p, brand_logo_url: e.target.value }))
                        }
                        maxLength={500}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">{t("pages.admin.landing.lblBuy")}</Label>
                      <Input
                        className="h-8 text-sm"
                        value={siteChrome.buy_label ?? ""}
                        onChange={(e) => setSiteChrome((p) => ({ ...p, buy_label: e.target.value }))}
                        maxLength={40}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">{t("pages.admin.landing.lblSignIn")}</Label>
                      <Input
                        className="h-8 text-sm"
                        value={siteChrome.login_label ?? ""}
                        onChange={(e) => setSiteChrome((p) => ({ ...p, login_label: e.target.value }))}
                        maxLength={40}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">{t("pages.admin.landing.lblPanel")}</Label>
                      <Input
                        className="h-8 text-sm"
                        value={siteChrome.panel_label ?? ""}
                        onChange={(e) => setSiteChrome((p) => ({ ...p, panel_label: e.target.value }))}
                        maxLength={40}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-2.5 py-2">
                    <Label className="text-xs">{t("pages.admin.landing.lblCta2")}</Label>
                    <Switch
                      checked={siteChrome.hero_secondary_cta_enabled}
                      onCheckedChange={(v) =>
                        setSiteChrome((p) => ({ ...p, hero_secondary_cta_enabled: v }))
                      }
                    />
                  </div>
                  {siteChrome.hero_secondary_cta_enabled ? (
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-[11px]">{t("pages.admin.landing.lblCta2Text")}</Label>
                        <Input
                          className="h-8 text-sm"
                          value={siteChrome.hero_secondary_cta_label ?? ""}
                          onChange={(e) =>
                            setSiteChrome((p) => ({
                              ...p,
                              hero_secondary_cta_label: e.target.value,
                            }))
                          }
                          maxLength={80}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">{t("pages.admin.landing.lblCta2Url")}</Label>
                        <Input
                          className="h-8 text-sm"
                          value={siteChrome.hero_secondary_cta_href ?? ""}
                          onChange={(e) =>
                            setSiteChrome((p) => ({
                              ...p,
                              hero_secondary_cta_href: e.target.value,
                            }))
                          }
                          maxLength={500}
                        />
                      </div>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-2.5 py-2">
                    <Label className="text-xs">{t("pages.admin.landing.lblShowGoals")}</Label>
                    <Switch
                      checked={siteChrome.show_objective_nav}
                      onCheckedChange={(v) => setSiteChrome((p) => ({ ...p, show_objective_nav: v }))}
                    />
                  </div>
                  {siteChrome.show_objective_nav ? (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <Label className="text-[11px]">{t("pages.admin.landing.lblRowLabel")}</Label>
                        <Input
                          className="h-8 text-sm"
                          value={siteChrome.objective_nav_label ?? ""}
                          onChange={(e) =>
                            setSiteChrome((p) => ({ ...p, objective_nav_label: e.target.value }))
                          }
                          maxLength={80}
                        />
                      </div>
                      {siteChrome.objective_links.map((link, idx) => (
                        <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                          <Input
                            className="h-8 text-sm"
                            placeholder={t("pages.admin.landing.textPlaceholder")}
                            value={link.label}
                            onChange={(e) =>
                              setSiteChrome((p) => ({
                                ...p,
                                objective_links: p.objective_links.map((l, i) =>
                                  i === idx ? { ...l, label: e.target.value } : l,
                                ),
                              }))
                            }
                          />
                          <Input
                            className="h-8 text-sm"
                            placeholder={t("pages.admin.landing.routePlaceholder")}
                            value={link.href}
                            onChange={(e) =>
                              setSiteChrome((p) => ({
                                ...p,
                                objective_links: p.objective_links.map((l, i) =>
                                  i === idx ? { ...l, href: e.target.value } : l,
                                ),
                              }))
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() =>
                              setSiteChrome((p) => ({
                                ...p,
                                objective_links: p.objective_links.filter((_, i) => i !== idx),
                              }))
                            }
                            aria-label={t("pages.admin.landing.removeLink")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                      {siteChrome.objective_links.length < 8 ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() =>
                            setSiteChrome((p) => ({
                              ...p,
                              objective_links: [...p.objective_links, { label: "", href: "" }],
                            }))
                          }
                        >
                          {t("pages.admin.landing.addLink")}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-2.5 py-2">
                    <Label className="text-xs">{t("pages.admin.landing.lblAgency")}</Label>
                    <Switch
                      checked={siteChrome.agency_banner_enabled}
                      onCheckedChange={(v) => setSiteChrome((p) => ({ ...p, agency_banner_enabled: v }))}
                    />
                  </div>
                  {siteChrome.agency_banner_enabled ? (
                    <div className="grid gap-2.5">
                      <div className="space-y-1">
                        <Label className="text-[11px]">{t("pages.admin.landing.lblBannerText")}</Label>
                        <Input
                          className="h-8 text-sm"
                          value={siteChrome.agency_banner_text ?? ""}
                          onChange={(e) =>
                            setSiteChrome((p) => ({ ...p, agency_banner_text: e.target.value }))
                          }
                          maxLength={300}
                        />
                      </div>
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-[11px]">{t("pages.admin.landing.lblLinkText")}</Label>
                          <Input
                            className="h-8 text-sm"
                            value={siteChrome.agency_banner_cta_label ?? ""}
                            onChange={(e) =>
                              setSiteChrome((p) => ({ ...p, agency_banner_cta_label: e.target.value }))
                            }
                            maxLength={80}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">{t("pages.admin.landing.lblLinkUrl")}</Label>
                          <Input
                            className="h-8 text-sm"
                            value={siteChrome.agency_banner_href ?? ""}
                            onChange={(e) =>
                              setSiteChrome((p) => ({ ...p, agency_banner_href: e.target.value }))
                            }
                            maxLength={500}
                          />
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <div className="grid gap-2.5">
                    <div className="space-y-1">
                      <Label className="text-[11px]">{t("pages.admin.landing.lblSeoTitle")}</Label>
                      <Input
                        className="h-8 text-sm"
                        placeholder={t("pages.admin.landing.seoTitleEmpty")}
                        value={siteChrome.seo_title ?? ""}
                        onChange={(e) => setSiteChrome((p) => ({ ...p, seo_title: e.target.value }))}
                        maxLength={120}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">{t("pages.admin.landing.lblSeoDesc")}</Label>
                      <Textarea
                        rows={2}
                        className="resize-y text-sm"
                        placeholder={t("pages.admin.landing.seoDescEmpty")}
                        value={siteChrome.seo_description ?? ""}
                        onChange={(e) =>
                          setSiteChrome((p) => ({ ...p, seo_description: e.target.value }))
                        }
                        maxLength={320}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3 rounded-lg border border-border/70 bg-muted/10 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {t("pages.admin.landing.promosTitle")}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                        {t("pages.admin.landing.promosHint")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => {
                        setPromos(structuredClone(DEFAULT_SALES_LANDING_PROMOS));
                        toast.message(t("pages.admin.landing.promoTemplate"));
                      }}
                    >
                      {t("pages.admin.landing.restoreTemplate")}
                    </Button>
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-2.5 py-2">
                    <Label className="text-xs">{t("pages.admin.landing.lblSticky")}</Label>
                    <Switch
                      checked={promos.sticky_bar.enabled}
                      onCheckedChange={(v) =>
                        setPromos((p) => ({
                          ...p,
                          sticky_bar: { ...p.sticky_bar, enabled: v },
                        }))
                      }
                    />
                  </div>
                  {promos.sticky_bar.enabled ? (
                    <div className="grid gap-2.5">
                      <div className="space-y-1">
                        <Label className="text-[11px]">{t("pages.admin.landing.lblBarText")}</Label>
                        <Input
                          className="h-8 text-sm"
                          value={promos.sticky_bar.text}
                          onChange={(e) =>
                            setPromos((p) => ({
                              ...p,
                              sticky_bar: { ...p.sticky_bar, text: e.target.value },
                            }))
                          }
                          maxLength={400}
                        />
                      </div>
                      <div className="grid gap-2.5 sm:grid-cols-3">
                        <div className="space-y-1">
                          <Label className="text-[11px]">{t("pages.admin.landing.lblCta")}</Label>
                          <Input
                            className="h-8 text-sm"
                            value={promos.sticky_bar.cta_label ?? ""}
                            onChange={(e) =>
                              setPromos((p) => ({
                                ...p,
                                sticky_bar: { ...p.sticky_bar, cta_label: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">{t("pages.admin.landing.lblUrl")}</Label>
                          <Input
                            className="h-8 text-sm"
                            value={promos.sticky_bar.cta_href ?? ""}
                            onChange={(e) =>
                              setPromos((p) => ({
                                ...p,
                                sticky_bar: { ...p.sticky_bar, cta_href: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">{t("pages.admin.landing.lblDiscount")}</Label>
                          <Input
                            className="h-8 text-sm"
                            value={promos.sticky_bar.discount_code ?? ""}
                            onChange={(e) =>
                              setPromos((p) => ({
                                ...p,
                                sticky_bar: { ...p.sticky_bar, discount_code: e.target.value },
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-2.5 py-2">
                        <Label className="text-xs">{t("pages.admin.landing.lblDismiss")}</Label>
                        <Switch
                          checked={promos.sticky_bar.dismissible}
                          onCheckedChange={(v) =>
                            setPromos((p) => ({
                              ...p,
                              sticky_bar: { ...p.sticky_bar, dismissible: v },
                            }))
                          }
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs font-semibold">{t("pages.admin.landing.lblPopups")}</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={promos.popups.length >= 8}
                        onClick={() =>
                          setPromos((p) => ({
                            ...p,
                            popups: [...p.popups, newBlankSalesPromoPopup()].slice(0, 8),
                          }))
                        }
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Adicionar
                      </Button>
                    </div>
                    {promos.popups.map((popup, idx) => (
                      <div
                        key={popup.id}
                        className="space-y-2 rounded-md border border-border/60 bg-background/60 p-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={popup.enabled}
                              onCheckedChange={(v) =>
                                setPromos((p) => ({
                                  ...p,
                                  popups: p.popups.map((x, i) =>
                                    i === idx ? { ...x, enabled: v } : x,
                                  ),
                                }))
                              }
                            />
                            <span className="text-xs font-medium">{popup.id}</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() =>
                              setPromos((p) => ({
                                ...p,
                                popups: p.popups.filter((_, i) => i !== idx),
                              }))
                            }
                            aria-label={t("pages.admin.landing.removePopup")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-[11px]">{t("pages.admin.landing.lblTrigger")}</Label>
                            <Select
                              value={popup.trigger}
                              onValueChange={(v) =>
                                setPromos((p) => ({
                                  ...p,
                                  popups: p.popups.map((x, i) =>
                                    i === idx
                                      ? {
                                          ...x,
                                          trigger: v as SalesPromoPopup["trigger"],
                                        }
                                      : x,
                                  ),
                                }))
                              }
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="exit_intent">{t("pages.admin.landing.triggerExit")}</SelectItem>
                                <SelectItem value="timed">{t("pages.admin.landing.triggerTimed")}</SelectItem>
                                <SelectItem value="scroll">{t("pages.admin.landing.lblScroll")}</SelectItem>
                                <SelectItem value="manual">{t("pages.admin.landing.triggerManual")}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {popup.trigger === "timed" ? (
                            <div className="space-y-1">
                              <Label className="text-[11px]">{t("pages.admin.landing.lblDelay")}</Label>
                              <Input
                                type="number"
                                className="h-8 text-sm"
                                value={popup.delay_ms}
                                onChange={(e) =>
                                  setPromos((p) => ({
                                    ...p,
                                    popups: p.popups.map((x, i) =>
                                      i === idx
                                        ? { ...x, delay_ms: Number(e.target.value) || 0 }
                                        : x,
                                    ),
                                  }))
                                }
                              />
                            </div>
                          ) : null}
                          {popup.trigger === "scroll" ? (
                            <div className="space-y-1">
                              <Label className="text-[11px]">{t("pages.admin.landing.lblScroll")}</Label>
                              <Input
                                type="number"
                                className="h-8 text-sm"
                                value={popup.scroll_percent}
                                onChange={(e) =>
                                  setPromos((p) => ({
                                    ...p,
                                    popups: p.popups.map((x, i) =>
                                      i === idx
                                        ? {
                                            ...x,
                                            scroll_percent: Number(e.target.value) || 0,
                                          }
                                        : x,
                                    ),
                                  }))
                                }
                              />
                            </div>
                          ) : null}
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Input
                            className="h-8 text-sm"
                            placeholder={t("pages.admin.landing.popupBadgePh")}
                            value={popup.badge ?? ""}
                            onChange={(e) =>
                              setPromos((p) => ({
                                ...p,
                                popups: p.popups.map((x, i) =>
                                  i === idx ? { ...x, badge: e.target.value } : x,
                                ),
                              }))
                            }
                          />
                          <Input
                            className="h-8 text-sm"
                            placeholder={t("pages.admin.landing.lblDiscount")}
                            value={popup.discount_code ?? ""}
                            onChange={(e) =>
                              setPromos((p) => ({
                                ...p,
                                popups: p.popups.map((x, i) =>
                                  i === idx ? { ...x, discount_code: e.target.value } : x,
                                ),
                              }))
                            }
                          />
                        </div>
                        <Input
                          className="h-8 text-sm"
                          placeholder={t("pages.admin.landing.lblTitle")}
                          value={popup.title}
                          onChange={(e) =>
                            setPromos((p) => ({
                              ...p,
                              popups: p.popups.map((x, i) =>
                                i === idx ? { ...x, title: e.target.value } : x,
                              ),
                            }))
                          }
                        />
                        <Textarea
                          rows={2}
                          className="resize-y text-sm"
                          placeholder={t("pages.admin.landing.bodyPh")}
                          value={popup.body}
                          onChange={(e) =>
                            setPromos((p) => ({
                              ...p,
                              popups: p.popups.map((x, i) =>
                                i === idx ? { ...x, body: e.target.value } : x,
                              ),
                            }))
                          }
                        />
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Input
                            className="h-8 text-sm"
                            placeholder={t("pages.admin.landing.lblCta")}
                            value={popup.cta_label}
                            onChange={(e) =>
                              setPromos((p) => ({
                                ...p,
                                popups: p.popups.map((x, i) =>
                                  i === idx ? { ...x, cta_label: e.target.value } : x,
                                ),
                              }))
                            }
                          />
                          <Input
                            className="h-8 text-sm"
                            placeholder={t("pages.admin.landing.ctaUrlPh")}
                            value={popup.cta_href}
                            onChange={(e) =>
                              setPromos((p) => ({
                                ...p,
                                popups: p.popups.map((x, i) =>
                                  i === idx ? { ...x, cta_href: e.target.value } : x,
                                ),
                              }))
                            }
                          />
                          <Input
                            className="h-8 text-sm"
                            placeholder={t("pages.admin.landing.secondBtnPh")}
                            value={popup.secondary_label ?? ""}
                            onChange={(e) =>
                              setPromos((p) => ({
                                ...p,
                                popups: p.popups.map((x, i) =>
                                  i === idx ? { ...x, secondary_label: e.target.value } : x,
                                ),
                              }))
                            }
                          />
                          <Input
                            className="h-8 text-sm"
                            placeholder={t("pages.admin.landing.secondUrlPh")}
                            value={popup.secondary_href ?? ""}
                            onChange={(e) =>
                              setPromos((p) => ({
                                ...p,
                                popups: p.popups.map((x, i) =>
                                  i === idx ? { ...x, secondary_href: e.target.value } : x,
                                ),
                              }))
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => {
                      setAppearance(DEFAULT_LANDING_EXTRAS.appearance);
                      setPlansSectionLabel(DEFAULT_LANDING_EXTRAS.plans_section_label ?? "");
                      setPlansSectionTitle(DEFAULT_LANDING_EXTRAS.plans_section_title ?? "");
                      setPlansSectionSubtitle(DEFAULT_LANDING_EXTRAS.plans_section_subtitle ?? "");
                      setFeatTitle(DEFAULT_LANDING_EXTRAS.features?.title ?? "");
                      setFeatSubtitle(DEFAULT_LANDING_EXTRAS.features?.subtitle ?? "");
                      setFeatCards(
                        (DEFAULT_LANDING_EXTRAS.features?.cards ?? []).map((c) => ({
                          title: c.title,
                          body: c.body,
                          image_url: c.image_url ?? "",
                        })),
                      );
                      setStatTitle(DEFAULT_LANDING_EXTRAS.stats?.title ?? "");
                      setStatSubtitle(DEFAULT_LANDING_EXTRAS.stats?.subtitle ?? "");
                      setStatItems(
                        (DEFAULT_LANDING_EXTRAS.stats?.items ?? []).map((s) => ({
                          value: s.value,
                          label: s.label,
                        })),
                      );
                      setFaqTitle(DEFAULT_LANDING_EXTRAS.faq?.title ?? "");
                      setFaqItems(
                        (DEFAULT_LANDING_EXTRAS.faq?.items ?? []).map((f) => ({
                          q: f.q,
                          a: f.a,
                        })),
                      );
                      setHeroNote(DEFAULT_LANDING_EXTRAS.hero_note ?? "");
                      setSiteChrome({
                        ...DEFAULT_LANDING_SITE_CHROME,
                        objective_links: DEFAULT_LANDING_SITE_CHROME.objective_links.map((l) => ({
                          ...l,
                        })),
                      });
                      setPromos(structuredClone(DEFAULT_SALES_LANDING_PROMOS));
                      setSectionOrder(
                        (DEFAULT_LANDING_EXTRAS.section_order ?? DEFAULT_LANDING_SECTION_ORDER).slice(),
                      );
                      if (DEFAULT_LANDING_EXTRAS.theme) {
                        setLandingTheme({ ...DEFAULT_LANDING_EXTRAS.theme });
                      }
                      toast.success(
                        t("pages.admin.landing.enterpriseLoaded"),
                      );
                    }}
                  >
                    {t("pages.admin.landing.applyEnterprise")}
                  </Button>
                </div>
              </div>
            ) : null}

            {editorTab === "hero" ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pl-badge">{t("pages.admin.landing.lblBadge")}</Label>
                  <Input
                    id="pl-badge"
                    placeholder={t("pages.admin.landing.badgePlaceholder")}
                    value={badgeText}
                    onChange={(e) => setBadgeText(e.target.value)}
                    maxLength={80}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pl-title">{t("pages.admin.landing.lblMainTitle")}</Label>
                  <Input
                    id="pl-title"
                    value={heroTitle}
                    onChange={(e) => setHeroTitle(e.target.value)}
                    maxLength={200}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pl-sub">{t("pages.admin.landing.lblSubtitle")}</Label>
                  <Textarea
                    id="pl-sub"
                    rows={3}
                    placeholder={t("pages.admin.landing.plansValuePh")}
                    value={heroSubtitle}
                    onChange={(e) => setHeroSubtitle(e.target.value)}
                    className="min-h-[72px] resize-y"
                  />
                  <MarkdownHint />
                </div>
              </div>
            ) : null}

            {editorTab === "typography" ? (
              <div className="space-y-3">
            <div className="rounded-lg border border-border/80 bg-muted/20 p-3 space-y-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Type className="h-4 w-4 text-primary" />
                Tipografia do hero
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("pages.admin.landing.lblFont")}</Label>
                  <Select value={heroFont} onValueChange={setHeroFont}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_FONT.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {t(o.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("pages.admin.landing.lblAlign")}</Label>
                  <Select value={heroTextAlign} onValueChange={setHeroTextAlign}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_ALIGN.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {t(o.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("pages.admin.landing.lblTitleSize")}</Label>
                  <Select value={heroTitleSize} onValueChange={setHeroTitleSize}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_TITLE_SIZE.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {t(o.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("pages.admin.landing.lblTitleWeight")}</Label>
                  <Select value={heroTitleWeight} onValueChange={setHeroTitleWeight}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_WEIGHT.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {t(o.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">{t("pages.admin.landing.lblSubSize")}</Label>
                  <Select value={heroSubtitleSize} onValueChange={setHeroSubtitleSize}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_BODY.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {t(o.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-violet-500/25 bg-violet-500/[0.06] p-3 space-y-2.5">
              <p className="text-sm font-semibold text-foreground">{t("pages.admin.landing.typographyZone")}</p>
              <p className="text-[11px] text-muted-foreground leading-snug">
                {t("pages.admin.landing.typoZoneHint")}
              </p>
              <div className="space-y-2.5 pr-0.5">
                <PlansLandingTextStyleFields
                  label={t("pages.admin.landing.zoneHeroTitle")}
                  value={textStyles.hero_title}
                  onChange={(b) => patchTextStyle("hero_title", b)}
                />
                <PlansLandingTextStyleFields
                  label={t("pages.admin.landing.zoneHeroSub")}
                  value={textStyles.hero_subtitle}
                  onChange={(b) => patchTextStyle("hero_subtitle", b)}
                />
                <PlansLandingTextStyleFields
                  label={t("pages.admin.landing.zoneHeroBadge")}
                  value={textStyles.hero_badge}
                  onChange={(b) => patchTextStyle("hero_badge", b)}
                />
                <PlansLandingTextStyleFields
                  label={t("pages.admin.landing.zoneIntro")}
                  value={textStyles.intro}
                  onChange={(b) => patchTextStyle("intro", b)}
                />
                <PlansLandingTextStyleFields
                  label={t("pages.admin.landing.zoneSectionFooter")}
                  value={textStyles.footer}
                  onChange={(b) => patchTextStyle("footer", b)}
                />
                <PlansLandingTextStyleFields
                  label={t("pages.admin.landing.zonePlansKicker")}
                  value={textStyles.plans_section_label}
                  onChange={(b) => patchTextStyle("plans_section_label", b)}
                />
                <PlansLandingTextStyleFields
                  label={t("pages.admin.landing.zonePlansTitle")}
                  value={textStyles.plans_section_title}
                  onChange={(b) => patchTextStyle("plans_section_title", b)}
                />
                <PlansLandingTextStyleFields
                  label={t("pages.admin.landing.zonePlansSub")}
                  value={textStyles.plans_section_subtitle}
                  onChange={(b) => patchTextStyle("plans_section_subtitle", b)}
                />
                <PlansLandingTextStyleFields
                  label={t("pages.admin.landing.zoneFeatTitle")}
                  value={textStyles.features_title}
                  onChange={(b) => patchTextStyle("features_title", b)}
                />
                <PlansLandingTextStyleFields
                  label={t("pages.admin.landing.zoneFeatSub")}
                  value={textStyles.features_subtitle}
                  onChange={(b) => patchTextStyle("features_subtitle", b)}
                />
                <PlansLandingTextStyleFields
                  label={t("pages.admin.landing.zoneFeatCardTitle")}
                  value={textStyles.feature_card_title}
                  onChange={(b) => patchTextStyle("feature_card_title", b)}
                />
                <PlansLandingTextStyleFields
                  label={t("pages.admin.landing.zoneFeatCardBody")}
                  value={textStyles.feature_card_body}
                  onChange={(b) => patchTextStyle("feature_card_body", b)}
                />
                <PlansLandingTextStyleFields
                  label={t("pages.admin.landing.zoneStatsTitle")}
                  value={textStyles.stats_title}
                  onChange={(b) => patchTextStyle("stats_title", b)}
                />
                <PlansLandingTextStyleFields
                  label={t("pages.admin.landing.zoneStatsSub")}
                  value={textStyles.stats_subtitle}
                  onChange={(b) => patchTextStyle("stats_subtitle", b)}
                />
                <PlansLandingTextStyleFields
                  label={t("pages.admin.landing.zoneStatsValue")}
                  value={textStyles.stat_value}
                  onChange={(b) => patchTextStyle("stat_value", b)}
                />
                <PlansLandingTextStyleFields
                  label={t("pages.admin.landing.zoneStatsLabel")}
                  value={textStyles.stat_label}
                  onChange={(b) => patchTextStyle("stat_label", b)}
                />
                <PlansLandingTextStyleFields
                  label={t("pages.admin.landing.zoneFaqTitle")}
                  value={textStyles.faq_title}
                  onChange={(b) => patchTextStyle("faq_title", b)}
                />
                <PlansLandingTextStyleFields
                  label={t("pages.admin.landing.zoneFaqQuestion")}
                  value={textStyles.faq_question}
                  onChange={(b) => patchTextStyle("faq_question", b)}
                />
                <PlansLandingTextStyleFields
                  label={t("pages.admin.landing.zoneFaqAnswer")}
                  value={textStyles.faq_answer}
                  onChange={(b) => patchTextStyle("faq_answer", b)}
                />
                <PlansLandingTextStyleFields
                  label={t("pages.admin.landing.zoneLegalLines")}
                  value={textStyles.legal_footer}
                  onChange={(b) => patchTextStyle("legal_footer", b)}
                />
                <PlansLandingTextStyleFields
                  label={t("pages.admin.landing.zoneQuotesTitle")}
                  value={textStyles.testimonials_title}
                  onChange={(b) => patchTextStyle("testimonials_title", b)}
                />
                <PlansLandingTextStyleFields
                  label={t("pages.admin.landing.zoneQuotesSub")}
                  value={textStyles.testimonials_subtitle}
                  onChange={(b) => patchTextStyle("testimonials_subtitle", b)}
                />
                <PlansLandingTextStyleFields
                  label={t("pages.admin.landing.zoneGalleryTitle")}
                  value={textStyles.gallery_title}
                  onChange={(b) => patchTextStyle("gallery_title", b)}
                />
                <PlansLandingTextStyleFields
                  label={t("pages.admin.landing.zoneGallerySub")}
                  value={textStyles.gallery_subtitle}
                  onChange={(b) => patchTextStyle("gallery_subtitle", b)}
                />
                <PlansLandingTextStyleFields
                  label={t("pages.admin.landing.zoneGuaranteeTitle")}
                  value={textStyles.guarantee_title}
                  onChange={(b) => patchTextStyle("guarantee_title", b)}
                />
                <PlansLandingTextStyleFields
                  label={t("pages.admin.landing.zoneGuaranteeLead")}
                  value={textStyles.guarantee_lead}
                  onChange={(b) => patchTextStyle("guarantee_lead", b)}
                />
                <PlansLandingTextStyleFields
                  label={t("pages.admin.landing.zoneGuaranteeBody")}
                  value={textStyles.guarantee_body}
                  onChange={(b) => patchTextStyle("guarantee_body", b)}
                />
                <PlansLandingTextStyleFields
                  label={t("pages.admin.landing.zoneGuaranteeFoot")}
                  value={textStyles.guarantee_footer}
                  onChange={(b) => patchTextStyle("guarantee_footer", b)}
                />
              </div>
            </div>
              </div>
            ) : null}

            {editorTab === "sales" ? (
              <div className="space-y-3">
            <div className="rounded-lg border border-blue-500/25 bg-blue-500/[0.06] p-3 space-y-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Sparkles className="h-4 w-4 text-blue-600" />
                {t("pages.admin.landing.salesThemeTitle")}
              </p>
              <p className="text-[11px] text-muted-foreground leading-snug">
                {t("pages.admin.landing.salesThemeHint")}
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("pages.admin.landing.lblAppearance")}</Label>
                <Select
                  value={appearance}
                  onValueChange={(v) => setAppearance(v as LandingExtrasPublic["appearance"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">{t("pages.admin.landing.appearanceLight")}</SelectItem>
                    <SelectItem value="sales_dark">{t("pages.admin.landing.appearanceDark")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3 rounded-md border border-border/60 bg-background/50 p-3">
                <p className="text-xs font-semibold text-foreground">{t("pages.admin.landing.firstScreen")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("pages.admin.landing.productWindowHint")}
                </p>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("pages.admin.landing.heroNoteLabel")}</Label>
                  <Textarea value={heroNote} onChange={(e) => setHeroNote(e.target.value)} rows={3} className="resize-y text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("pages.admin.landing.lblFeatured")}</Label>
                  <Select value={recommendedPlanType} onValueChange={setRecommendedPlanType}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("pages.admin.landing.effectNone")}</SelectItem>
                      <SelectItem value="free_trial">Starter</SelectItem>
                      <SelectItem value="monthly">{t("pages.admin.landing.planMonthly")}</SelectItem>
                      <SelectItem value="annual">{t("pages.admin.landing.planAnnual")}</SelectItem>
                      <SelectItem value="quarterly">{t("pages.admin.landing.planQuarterly")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("pages.admin.landing.lblFeaturedLine")}</Label>
                  <Input value={recommendedNote} onChange={(e) => setRecommendedNote(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("pages.admin.landing.lblFreeClicks")}</Label>
                  <Input value={freeLimitsNote} onChange={(e) => setFreeLimitsNote(e.target.value)} />
                </div>
                {(["free_trial", "monthly", "annual", "quarterly"] as const).map((key) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-xs">Frase curta — {key === "free_trial" ? "Starter" : key === "monthly" ? t("pages.admin.landing.planMonthly") : key === "annual" ? t("pages.admin.landing.planAnnual") : t("pages.admin.landing.planQuarterly")}</Label>
                    <Input
                      value={planTaglines[key]}
                      onChange={(e) => setPlanTaglines((prev) => ({ ...prev, [key]: e.target.value }))}
                    />
                  </div>
                ))}
                <Separator />
                <p className="text-xs font-medium text-foreground">{t("pages.admin.landing.productWindow")}</p>
                <Input placeholder={t("pages.admin.landing.demoOfferPh")} value={demoOffer} onChange={(e) => setDemoOffer(e.target.value)} />
                <Textarea placeholder={t("pages.admin.landing.demoMenuPh")} value={demoNav} onChange={(e) => setDemoNav(e.target.value)} rows={4} className="resize-y text-sm" />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input placeholder={t("pages.admin.landing.demoStatusPh")} value={demoStatus} onChange={(e) => setDemoStatus(e.target.value)} />
                  <Input placeholder={t("pages.admin.landing.demoNotePh")} value={demoPresellNote} onChange={(e) => setDemoPresellNote(e.target.value)} />
                  <Input placeholder={t("pages.admin.landing.demoKwLabel")} value={demoKeywordsLabel} onChange={(e) => setDemoKeywordsLabel(e.target.value)} />
                  <Input placeholder={t("pages.admin.landing.demoKwMeta")} value={demoKeywordMeta} onChange={(e) => setDemoKeywordMeta(e.target.value)} />
                  <Input placeholder={t("pages.admin.landing.demoAdLabel")} value={demoAdLabel} onChange={(e) => setDemoAdLabel(e.target.value)} />
                  <Input placeholder={t("pages.admin.landing.demoAdTitle")} value={demoAdTitle} onChange={(e) => setDemoAdTitle(e.target.value)} />
                  <Input placeholder={t("pages.admin.landing.demoAdMeta")} value={demoAdMeta} onChange={(e) => setDemoAdMeta(e.target.value)} />
                </div>
                <Textarea placeholder={t("pages.admin.landing.keywordsPh")} value={demoKeywords} onChange={(e) => setDemoKeywords(e.target.value)} rows={3} className="resize-y text-sm" />
                <Textarea placeholder={t("pages.admin.landing.trackingRowsPh")} value={demoRows} onChange={(e) => setDemoRows(e.target.value)} rows={3} className="resize-y text-sm" />
                <Textarea placeholder={t("pages.admin.landing.captionPh")} value={demoCaption} onChange={(e) => setDemoCaption(e.target.value)} rows={2} className="resize-y text-sm" />
              </div>

              <div className="rounded-md border border-border/60 bg-background/50 p-3 space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("pages.admin.landing.productWindowLead")}
                </p>
                {appearance === "sales_dark" ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
                      <p className="text-xs font-semibold text-foreground">{t("pages.admin.landing.colorsCss")}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setLandingTheme({})}
                      >
                        {t("pages.admin.landing.resetTheme")}
                      </Button>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t("pages.admin.landing.lblSectionFont")}</Label>
                      <Select
                        value={landingTheme.section_font ?? "sans"}
                        onValueChange={(v) =>
                          setLandingTheme((prev) => ({
                            ...prev,
                            section_font: v as LandingPageThemeInput["section_font"],
                          }))
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {OPT_FONT.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {t(o.label)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid max-h-[min(420px,55vh)] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                      {THEME_FIELD_ROWS.map(({ key, label, placeholder }) => (
                        <div key={key} className="space-y-1">
                          <Label className="text-[11px] leading-tight text-muted-foreground">{t(label)}</Label>
                          <Input
                            value={String(landingTheme[key] ?? "")}
                            onChange={(e) =>
                              setLandingTheme((prev) => ({
                                ...prev,
                                [key]: e.target.value.trim() === "" ? undefined : e.target.value,
                              }))
                            }
                            placeholder={placeholder}
                            className="h-8 font-mono text-[11px]"
                          />
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-1">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("pages.admin.landing.lblPlansEyebrow")}</Label>
                  <Input
                    value={plansSectionLabel}
                    onChange={(e) => setPlansSectionLabel(e.target.value)}
                    placeholder={t("pages.admin.landing.plansKickerPh")}
                    maxLength={80}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("pages.admin.landing.zonePlansTitle")}</Label>
                  <Input
                    value={plansSectionTitle}
                    onChange={(e) => setPlansSectionTitle(e.target.value)}
                    placeholder={t("pages.admin.landing.plansTitlePh")}
                    maxLength={200}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("pages.admin.landing.zonePlansSub")}</Label>
                  <Textarea
                    value={plansSectionSubtitle}
                    onChange={(e) => setPlansSectionSubtitle(e.target.value)}
                    rows={2}
                    maxLength={500}
                    className="resize-y min-h-[52px]"
                  />
                </div>
              </div>

              <Separator />

              <p className="text-xs font-medium text-foreground">{t("pages.admin.landing.featureCards")}</p>
              <p className="text-[11px] text-muted-foreground leading-snug">
                {t("pages.admin.landing.featLayoutHint")}
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("pages.admin.landing.lblBlockTitle")}</Label>
                <Input value={featTitle} onChange={(e) => setFeatTitle(e.target.value)} maxLength={200} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("pages.admin.landing.lblBlockSubtitle")}</Label>
                <Input value={featSubtitle} onChange={(e) => setFeatSubtitle(e.target.value)} maxLength={500} />
              </div>
              <input
                ref={featureImageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                tabIndex={-1}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  const idx = featureImagePickIndexRef.current;
                  e.target.value = "";
                  featureImagePickIndexRef.current = null;
                  if (file == null || idx === null) return;
                  setFeatureImageUploadBusy(true);
                  try {
                    const { data, error } = await adminService.uploadPlansGalleryImage(file);
                    if (error || !data?.image_url) {
                      toast.error(error || t("pages.admin.landing.imageLoadError"));
                      return;
                    }
                    setFeatCards((prev) =>
                      prev.map((c, i) => (i === idx ? { ...c, image_url: data.image_url } : c)),
                    );
                    toast.success(t("pages.admin.landing.cardImageLoaded"));
                  } finally {
                    setFeatureImageUploadBusy(false);
                  }
                }}
              />
              {featCards.map((card, idx) => (
                <div key={idx} className="rounded-md border border-border/60 bg-background/80 p-3 space-y-2">
                  <p className="text-[11px] font-medium text-muted-foreground">{fill(t("pages.admin.landing.cardN"), { n: idx + 1 })}</p>
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      <Label className="text-xs">{t("pages.admin.landing.lblImageOpt")}</Label>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        disabled={featureImageUploadBusy}
                        onClick={() => {
                          featureImagePickIndexRef.current = idx;
                          featureImageInputRef.current?.click();
                        }}
                      >
                        {featureImageUploadBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                        Carregar
                      </Button>
                    </div>
                    <Input
                      placeholder="https://…"
                      value={card.image_url}
                      onChange={(e) =>
                        setFeatCards((prev) =>
                          prev.map((c, i) => (i === idx ? { ...c, image_url: e.target.value } : c)),
                        )
                      }
                      maxLength={2000}
                    />
                    {card.image_url.trim() ? (
                      <div className="min-w-0 max-w-full overflow-hidden rounded-md border border-border/50 bg-muted/25 p-2">
                        <img
                          src={card.image_url}
                          alt=""
                          className="mx-auto block h-auto max-h-32 w-full max-w-full object-contain md:max-h-40"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                    ) : null}
                  </div>
                  <Input
                    placeholder={t("pages.admin.landing.lblTitle")}
                    value={card.title}
                    onChange={(e) =>
                      setFeatCards((prev) =>
                        prev.map((c, i) => (i === idx ? { ...c, title: e.target.value } : c)),
                      )
                    }
                  />
                  <Textarea
                    placeholder={t("pages.admin.landing.textPlaceholder")}
                    value={card.body}
                    onChange={(e) =>
                      setFeatCards((prev) =>
                        prev.map((c, i) => (i === idx ? { ...c, body: e.target.value } : c)),
                      )
                    }
                    rows={2}
                    className="resize-y min-h-[56px] text-sm"
                  />
                </div>
              ))}
              {featCards.length < 6 ? (
                <Button type="button" variant="outline" size="sm" onClick={() => setFeatCards((prev) => [...prev, { title: "", body: "", image_url: "" }])}>
                  {t("pages.admin.landing.addCard")}
                </Button>
              ) : null}
              <MarkdownHint />

              <Separator />

              <p className="text-xs font-medium text-foreground">
                {t("pages.admin.landing.statsBandHint")}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  placeholder={t("pages.admin.landing.lblBlockTitle")}
                  value={statTitle}
                  onChange={(e) => setStatTitle(e.target.value)}
                  maxLength={200}
                />
                <Input
                  placeholder={t("pages.admin.landing.lblSubtitle")}
                  value={statSubtitle}
                  onChange={(e) => setStatSubtitle(e.target.value)}
                  maxLength={500}
                />
              </div>
              {statItems.map((row, idx) => (
                <div key={idx} className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    placeholder={t("pages.admin.landing.valuePh")}
                    value={row.value}
                    onChange={(e) =>
                      setStatItems((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, value: e.target.value } : r)),
                      )
                    }
                  />
                  <Input
                    placeholder={t("pages.admin.landing.labelWord")}
                    value={row.label}
                    onChange={(e) =>
                      setStatItems((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, label: e.target.value } : r)),
                      )
                    }
                  />
                </div>
              ))}
              {statItems.length < 8 ? (
                <Button type="button" variant="outline" size="sm" onClick={() => setStatItems((prev) => [...prev, { value: "", label: "" }])}>
                  {t("pages.admin.landing.addStat")}
                </Button>
              ) : null}

              <Separator />

              <p className="text-xs font-medium text-foreground">{t("pages.admin.landing.faqLimit")}</p>
              <Input
                placeholder={t("pages.admin.landing.faqTitlePh")}
                value={faqTitle}
                onChange={(e) => setFaqTitle(e.target.value)}
                maxLength={200}
                className="mb-2"
              />
              {faqItems.map((row, idx) => (
                <div key={idx} className="mb-3 space-y-2 rounded-md border border-border/60 p-3">
                  <Input
                    placeholder={fill(t("pages.admin.landing.questionN"), { n: idx + 1 })}
                    value={row.q}
                    onChange={(e) =>
                      setFaqItems((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, q: e.target.value } : r)),
                      )
                    }
                  />
                  <Textarea
                    placeholder={t("pages.admin.landing.answerPh")}
                    value={row.a}
                    onChange={(e) =>
                      setFaqItems((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, a: e.target.value } : r)),
                      )
                    }
                    rows={2}
                    className="resize-y text-sm"
                  />
                </div>
              ))}
              {faqItems.length < 20 ? (
                <Button type="button" variant="outline" size="sm" onClick={() => setFaqItems((prev) => [...prev, { q: "", a: "" }])}>
                  {t("pages.admin.landing.addQuestion")}
                </Button>
              ) : null}

              <Separator />

              <Collapsible defaultOpen className="rounded-md border border-border/50 bg-background/40">
                <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-semibold hover:bg-muted/50 [&[data-state=open]]:border-b border-border/50">
                  <span className="flex items-center gap-2">
                    <BadgeCheck className="h-4 w-4 text-primary" />
                    Garantia / selo (abaixo dos planos)
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 px-3 pb-3 pt-1">
                  <p className="text-xs text-muted-foreground">
                    {t("pages.admin.landing.guaranteeHint")}
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/15 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="guarantee-enabled"
                        checked={guaranteeEnabled}
                        onCheckedChange={setGuaranteeEnabled}
                      />
                      <Label htmlFor="guarantee-enabled" className="text-xs font-medium">
                        {t("pages.admin.landing.showSection")}
                      </Label>
                    </div>
                  </div>
                  <input
                    ref={guaranteeSealInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    tabIndex={-1}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      setGuaranteeSealUploadBusy(true);
                      try {
                        const { data, error } = await adminService.uploadPlansGalleryImage(file);
                        if (error || !data?.image_url) {
                          toast.error(error || t("pages.admin.landing.imageLoadError"));
                          return;
                        }
                        setGuaranteeSealUrl(data.image_url);
                        toast.success(t("pages.admin.landing.badgeLoaded"));
                      } finally {
                        setGuaranteeSealUploadBusy(false);
                      }
                    }}
                  />
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      <Label className="text-xs">{t("pages.admin.landing.sealImageUrl")}</Label>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        disabled={guaranteeSealUploadBusy}
                        onClick={() => guaranteeSealInputRef.current?.click()}
                      >
                        {guaranteeSealUploadBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                        {t("pages.admin.landing.uploadFromPc")}
                      </Button>
                    </div>
                    <Input
                      placeholder={t("pages.admin.landing.uploadFromPcPh")}
                      value={guaranteeSealUrl}
                      onChange={(e) => setGuaranteeSealUrl(e.target.value)}
                      maxLength={2000}
                    />
                    {guaranteeSealUrl.trim() ? (
                      <div className="flex min-w-0 max-w-full justify-center overflow-hidden rounded-md border border-border/50 bg-muted/25 p-2">
                        <img
                          src={guaranteeSealUrl}
                          alt=""
                          className="mx-auto h-24 w-24 max-w-full rounded-full object-cover md:h-28 md:w-28"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("pages.admin.landing.lblTitle")}</Label>
                    <Input
                      placeholder={t("pages.admin.landing.riskFreePh")}
                      value={guaranteeTitle}
                      onChange={(e) => setGuaranteeTitle(e.target.value)}
                      maxLength={200}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("pages.admin.landing.leadHighlight")}</Label>
                    <Textarea
                      placeholder={t("pages.admin.landing.shortLinePh")}
                      value={guaranteeLead}
                      onChange={(e) => setGuaranteeLead(e.target.value)}
                      rows={2}
                      maxLength={800}
                      className="resize-y text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("pages.admin.landing.bodyMarkdown")}</Label>
                    <Textarea
                      placeholder={t("pages.admin.landing.guaranteeBodyPh")}
                      value={guaranteeBody}
                      onChange={(e) => setGuaranteeBody(e.target.value)}
                      rows={5}
                      maxLength={12000}
                      className="resize-y font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("pages.admin.landing.guaranteeFootLabel")}</Label>
                    <Textarea
                      placeholder={t("pages.admin.landing.guaranteeFootPh")}
                      value={guaranteeFooter}
                      onChange={(e) => setGuaranteeFooter(e.target.value)}
                      rows={3}
                      maxLength={8000}
                      className="resize-y font-mono text-sm"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              <Collapsible defaultOpen={false} className="rounded-md border border-border/50 bg-background/40">
                <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-semibold hover:bg-muted/50 [&[data-state=open]]:border-b border-border/50">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    {t("pages.admin.landing.videoGridTitle")}
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 px-3 pb-3 pt-1">
                  <input
                    ref={testimonialThumbFileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    tabIndex={-1}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      const idx = testimonialThumbPickIndexRef.current;
                      e.target.value = "";
                      testimonialThumbPickIndexRef.current = null;
                      if (file == null || idx === null) return;
                      setTestimonialThumbUploadBusy(true);
                      try {
                        const { data, error } = await adminService.uploadPlansGalleryImage(file);
                        if (error || !data?.image_url) {
                          toast.error(error || t("pages.admin.landing.imageLoadError"));
                          return;
                        }
                        setTestimonialItems((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, thumbnail_url: data.image_url } : r)),
                        );
                        toast.success(t("pages.admin.landing.thumbLoaded"));
                      } finally {
                        setTestimonialThumbUploadBusy(false);
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("pages.admin.landing.videoGridHint")}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("pages.admin.landing.sectionTitleLabel")}</Label>
                  <Input
                    placeholder={t("pages.admin.landing.testimonialsPh")}
                    value={testimonialTitle}
                    onChange={(e) => setTestimonialTitle(e.target.value)}
                    maxLength={200}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("pages.admin.landing.lblSubtitle")}</Label>
                  <Input
                    placeholder={t("pages.admin.landing.testimonialsSubPh")}
                    value={testimonialSubtitle}
                    onChange={(e) => setTestimonialSubtitle(e.target.value)}
                    maxLength={800}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  disabled={testimonialItems.length >= 8}
                  onClick={() =>
                    setTestimonialItems((prev) => [
                      ...prev,
                      {
                        thumbnail_url: "",
                        video_url: "",
                        quote: "",
                        name: "",
                        role: "",
                        social_handle: "",
                      },
                    ])
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t("pages.admin.landing.addCard")}
                </Button>
              </div>
              {testimonialItems.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t("pages.admin.landing.noTestimonials")}
                </p>
              ) : (
                <div className="space-y-3">
                  {testimonialItems.map((row, idx) => (
                    <div
                      key={`tm-${idx}`}
                      className="space-y-2 rounded-md border border-border/60 bg-background/80 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-muted-foreground">{fill(t("pages.admin.landing.cardN"), { n: idx + 1 })}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-destructive"
                          onClick={() =>
                            setTestimonialItems((prev) => prev.filter((_, i) => i !== idx))
                          }
                        >
                          Remover
                        </Button>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-xs">{t("pages.admin.landing.quoteLabel")}</Label>
                          <Textarea
                            placeholder={t("pages.admin.landing.quoteExamplePh")}
                            value={row.quote}
                            onChange={(e) =>
                              setTestimonialItems((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, quote: e.target.value } : r)),
                              )
                            }
                            rows={3}
                            maxLength={800}
                          />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <div className="flex flex-wrap items-end justify-between gap-2">
                            <Label className="text-xs">{t("pages.admin.landing.thumbUrlLabel")}</Label>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="h-8 gap-1.5 text-xs"
                              disabled={testimonialThumbUploadBusy}
                              onClick={() => {
                                testimonialThumbPickIndexRef.current = idx;
                                testimonialThumbFileInputRef.current?.click();
                              }}
                            >
                              {testimonialThumbUploadBusy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Upload className="h-3.5 w-3.5" />
                              )}
                              {t("pages.admin.landing.uploadFromPc")}
                            </Button>
                          </div>
                          <Input
                            placeholder={t("pages.admin.landing.portraitPh")}
                            value={row.thumbnail_url}
                            onChange={(e) =>
                              setTestimonialItems((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, thumbnail_url: e.target.value } : r,
                                ),
                              )
                            }
                            maxLength={2000}
                          />
                          {row.thumbnail_url.trim() ? (
                            <div className="min-w-0 max-w-full overflow-hidden rounded-md border border-border/50 bg-muted/25 p-2">
                              <p className="mb-1.5 text-[10px] text-muted-foreground">
                                {t("pages.admin.landing.videoPreview")}
                              </p>
                              <div className="mx-auto aspect-[9/16] w-full max-w-[140px] overflow-hidden rounded-lg bg-muted">
                                <img
                                  src={row.thumbnail_url.trim()}
                                  alt=""
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                  decoding="async"
                                />
                              </div>
                            </div>
                          ) : null}
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label className="text-xs">{t("pages.admin.landing.videoUrlClick")}</Label>
                          <Input
                            placeholder={t("pages.admin.landing.videoSrcPh")}
                            value={row.video_url}
                            onChange={(e) =>
                              setTestimonialItems((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, video_url: e.target.value } : r,
                                ),
                              )
                            }
                            maxLength={2000}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">{t("pages.admin.landing.nameOptional")}</Label>
                          <Input
                            value={row.name}
                            onChange={(e) =>
                              setTestimonialItems((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, name: e.target.value } : r,
                                ),
                              )
                            }
                            maxLength={120}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">{t("pages.admin.landing.roleOptional")}</Label>
                          <Input
                            placeholder={t("pages.admin.landing.roleExamplePh")}
                            value={row.role}
                            onChange={(e) =>
                              setTestimonialItems((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, role: e.target.value } : r,
                                ),
                              )
                            }
                            maxLength={200}
                          />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label className="text-xs">{t("pages.admin.landing.handleTop")}</Label>
                          <Input
                            placeholder={t("pages.admin.landing.handlePh")}
                            value={row.social_handle}
                            onChange={(e) =>
                              setTestimonialItems((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, social_handle: e.target.value } : r,
                                ),
                              )
                            }
                            maxLength={80}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              <Collapsible defaultOpen={false} className="rounded-md border border-border/50 bg-background/40">
                <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-semibold hover:bg-muted/50 [&[data-state=open]]:border-b border-border/50">
                  <span className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-primary" />
                    Galeria de imagens (grelha ou carrossel)
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 px-3 pb-3 pt-1">
                  <p className="text-xs text-muted-foreground">
                    {t("pages.admin.landing.galleryHint")}
                  </p>
                  <input
                    ref={galleryFileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    tabIndex={-1}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      const idx = galleryPickIndexRef.current;
                      e.target.value = "";
                      galleryPickIndexRef.current = null;
                      if (file == null || idx === null) return;
                      setGalleryUploadBusy(true);
                      try {
                        const { data, error } = await adminService.uploadPlansGalleryImage(file);
                        if (error || !data?.image_url) {
                          toast.error(error || t("pages.admin.landing.imageLoadError"));
                          return;
                        }
                        setGalleryItems((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, image_url: data.image_url } : r)),
                        );
                        toast.success(t("pages.admin.landing.imageLoaded"));
                      } finally {
                        setGalleryUploadBusy(false);
                      }
                    }}
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t("pages.admin.landing.lblTitle")}</Label>
                      <Input
                        placeholder={t("pages.admin.landing.galleryPh")}
                        value={galleryTitle}
                        onChange={(e) => setGalleryTitle(e.target.value)}
                        maxLength={200}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t("pages.admin.landing.lblSubtitle")}</Label>
                      <Input
                        value={gallerySubtitle}
                        onChange={(e) => setGallerySubtitle(e.target.value)}
                        maxLength={800}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("pages.admin.landing.presentation")}</Label>
                    <Select
                      value={galleryDisplay}
                      onValueChange={(v) => setGalleryDisplay(v === "carousel" ? "carousel" : "grid")}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="grid">{t("pages.admin.landing.layoutGrid")}</SelectItem>
                        <SelectItem value="carousel">{t("pages.admin.landing.layoutCarousel")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {galleryDisplay === "carousel" ? (
                    <div className="space-y-3 rounded-md border border-border/60 bg-muted/20 p-3">
                      <p className="text-xs font-medium text-foreground">{t("pages.admin.landing.carouselOptions")}</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-background/80 px-2 py-1.5">
                          <Label className="text-xs">{t("pages.admin.landing.autoplay")}</Label>
                          <Switch
                            checked={galleryCarouselOpts.autoplay}
                            onCheckedChange={(v) =>
                              setGalleryCarouselOpts((prev) => ({ ...prev, autoplay: v }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">{t("pages.admin.landing.intervalMs")}</Label>
                          <Input
                            type="number"
                            min={2000}
                            max={120000}
                            step={500}
                            value={galleryCarouselOpts.interval_ms}
                            onChange={(e) =>
                              setGalleryCarouselOpts((prev) => ({
                                ...prev,
                                interval_ms: Number(e.target.value) || prev.interval_ms,
                              }))
                            }
                            className="h-9"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-background/80 px-2 py-1.5">
                          <Label className="text-xs">{t("pages.admin.landing.arrows")}</Label>
                          <Switch
                            checked={galleryCarouselOpts.show_arrows}
                            onCheckedChange={(v) =>
                              setGalleryCarouselOpts((prev) => ({ ...prev, show_arrows: v }))
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-background/80 px-2 py-1.5">
                          <Label className="text-xs">{t("pages.admin.landing.dots")}</Label>
                          <Switch
                            checked={galleryCarouselOpts.show_dots}
                            onCheckedChange={(v) =>
                              setGalleryCarouselOpts((prev) => ({ ...prev, show_dots: v }))
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-background/80 px-2 py-1.5 sm:col-span-2">
                          <Label className="text-xs">{t("pages.admin.landing.loopSlides")}</Label>
                          <Switch
                            checked={galleryCarouselOpts.loop}
                            onCheckedChange={(v) =>
                              setGalleryCarouselOpts((prev) => ({ ...prev, loop: v }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">{t("pages.admin.landing.slidesDesktop")}</Label>
                          <Select
                            value={String(galleryCarouselOpts.slides_desktop)}
                            onValueChange={(v) =>
                              setGalleryCarouselOpts((prev) => ({
                                ...prev,
                                slides_desktop: Number(v) || 3,
                              }))
                            }
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1</SelectItem>
                              <SelectItem value="2">2</SelectItem>
                              <SelectItem value="3">3</SelectItem>
                              <SelectItem value="4">4</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">{t("pages.admin.landing.slidesMobile")}</Label>
                          <Select
                            value={String(galleryCarouselOpts.slides_mobile)}
                            onValueChange={(v) =>
                              setGalleryCarouselOpts((prev) => ({
                                ...prev,
                                slides_mobile: Number(v) === 2 ? 2 : 1,
                              }))
                            }
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1</SelectItem>
                              <SelectItem value="2">2</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label className="text-xs">{t("pages.admin.landing.slideGap")}</Label>
                          <Input
                            type="number"
                            min={0}
                            max={64}
                            value={galleryCarouselOpts.gap_px}
                            onChange={(e) =>
                              setGalleryCarouselOpts((prev) => ({
                                ...prev,
                                gap_px: Number(e.target.value) || 0,
                              }))
                            }
                            className="h-9"
                          />
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={galleryItems.length >= 8}
                      onClick={() =>
                        setGalleryItems((prev) => [
                          ...prev,
                          {
                            image_url: "",
                            name: "",
                            role: "",
                            social_handle: "",
                            caption: "",
                          },
                        ])
                      }
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {t("pages.admin.landing.addImage")}
                    </Button>
                  </div>
                  {galleryItems.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t("pages.admin.landing.noGalleryImages")}</p>
                  ) : (
                    <div className="space-y-3">
                      {galleryItems.map((row, idx) => (
                        <div
                          key={`gal-${idx}`}
                          className="space-y-2 rounded-md border border-border/60 bg-background/80 p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] font-medium text-muted-foreground">
                              Imagem {idx + 1}
                            </span>
                            <div className="flex items-center gap-0.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                disabled={idx === 0}
                                onClick={() => moveGalleryItem(idx, -1)}
                                aria-label={t("pages.admin.landing.moveGalleryUp")}
                              >
                                <ChevronUp className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                disabled={idx >= galleryItems.length - 1}
                                onClick={() => moveGalleryItem(idx, 1)}
                                aria-label={t("pages.admin.landing.moveGalleryDown")}
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-destructive"
                                onClick={() =>
                                  setGalleryItems((prev) => prev.filter((_, i) => i !== idx))
                                }
                              >
                                Remover
                              </Button>
                            </div>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div className="space-y-1.5 sm:col-span-2">
                              <div className="flex flex-wrap items-end justify-between gap-2">
                                <Label className="text-xs">{t("pages.admin.landing.imageUrlOrUpload")}</Label>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  className="h-8 gap-1.5 text-xs"
                                  disabled={galleryUploadBusy}
                                  onClick={() => {
                                    galleryPickIndexRef.current = idx;
                                    galleryFileInputRef.current?.click();
                                  }}
                                >
                                  {galleryUploadBusy ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Upload className="h-3.5 w-3.5" />
                                  )}
                                  {t("pages.admin.landing.uploadFromPc")}
                                </Button>
                              </div>
                              <Input
                                placeholder={t("pages.admin.landing.uploadFromPcPh")}
                                value={row.image_url}
                                onChange={(e) =>
                                  setGalleryItems((prev) =>
                                    prev.map((r, i) =>
                                      i === idx ? { ...r, image_url: e.target.value } : r,
                                    ),
                                  )
                                }
                                maxLength={2000}
                              />
                              {row.image_url.trim() ? (
                                <div className="min-w-0 max-w-full overflow-hidden rounded-md border border-border/50 bg-muted/25 p-2">
                                  <img
                                    src={row.image_url}
                                    alt=""
                                    className="mx-auto block h-auto max-h-32 w-full max-w-full object-contain md:max-h-40"
                                    loading="lazy"
                                    decoding="async"
                                  />
                                </div>
                              ) : null}
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">{t("pages.admin.landing.nameOptional")}</Label>
                              <Input
                                value={row.name}
                                onChange={(e) =>
                                  setGalleryItems((prev) =>
                                    prev.map((r, i) =>
                                      i === idx ? { ...r, name: e.target.value } : r,
                                    ),
                                  )
                                }
                                maxLength={120}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">{t("pages.admin.landing.roleShort")}</Label>
                              <Input
                                value={row.role}
                                onChange={(e) =>
                                  setGalleryItems((prev) =>
                                    prev.map((r, i) =>
                                      i === idx ? { ...r, role: e.target.value } : r,
                                    ),
                                  )
                                }
                                maxLength={200}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">{t("pages.admin.landing.captionOptional")}</Label>
                              <Input
                                value={row.caption}
                                onChange={(e) =>
                                  setGalleryItems((prev) =>
                                    prev.map((r, i) =>
                                      i === idx ? { ...r, caption: e.target.value } : r,
                                    ),
                                  )
                                }
                                maxLength={500}
                              />
                            </div>
                            <div className="space-y-1.5 sm:col-span-2">
                              <Label className="text-xs">{t("pages.admin.landing.handleOptional")}</Label>
                              <Input
                                value={row.social_handle}
                                onChange={(e) =>
                                  setGalleryItems((prev) =>
                                    prev.map((r, i) =>
                                      i === idx ? { ...r, social_handle: e.target.value } : r,
                                    ),
                                  )
                                }
                                maxLength={80}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              <p className="text-xs font-medium text-foreground">{t("pages.admin.landing.legalFooter")}</p>
              <Textarea
                placeholder={t("pages.admin.landing.legalLinesPh")}
                value={legalLines}
                onChange={(e) => setLegalLines(e.target.value)}
                rows={3}
                className="resize-y text-sm"
              />
              {legalLinks.map((link, idx) => (
                <div key={idx} className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    placeholder={t("pages.admin.landing.lblLinkText")}
                    value={link.label}
                    onChange={(e) =>
                      setLegalLinks((prev) =>
                        prev.map((l, i) => (i === idx ? { ...l, label: e.target.value } : l)),
                      )
                    }
                  />
                  <Input
                    placeholder={t("pages.admin.landing.lblUrl")}
                    value={link.href}
                    onChange={(e) =>
                      setLegalLinks((prev) =>
                        prev.map((l, i) => (i === idx ? { ...l, href: e.target.value } : l)),
                      )
                    }
                  />
                </div>
              ))}
              {legalLinks.length < 12 ? (
                <Button type="button" variant="outline" size="sm" onClick={() => setLegalLinks((prev) => [...prev, { label: "", href: "" }])}>
                  {t("pages.admin.landing.addLink")}
                </Button>
              ) : null}
            </div>
              </div>
            ) : null}

            {editorTab === "media" ? (
              <div className="space-y-3">
            <div className="space-y-2">
              <Label>{t("pages.admin.landing.heroBg")}</Label>
              <p className="text-xs text-muted-foreground">{t("pages.admin.landing.heroBgHint")}</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadMutation.mutate(f);
                  e.target.value = "";
                }}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-2"
                  disabled={uploadMutation.isPending}
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  {t("pages.admin.landing.uploadImage")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 text-destructive hover:text-destructive"
                  disabled={!data.has_hero_image || clearMutation.isPending}
                  onClick={() => clearMutation.mutate()}
                >
                  <Trash2 className="h-4 w-4" />
                  Remover imagem
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border/80 bg-muted/15 p-4 space-y-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ImageIcon className="h-4 w-4 text-primary" />
                Efeitos visuais do hero
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t("pages.admin.landing.heroMediaHint")}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("pages.admin.landing.minHeightMobile")}</Label>
                  <Input
                    type="number"
                    min={160}
                    max={900}
                    step={10}
                    value={heroVisual.min_height_mobile_px}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setHeroVisual((p) => ({
                        ...p,
                        min_height_mobile_px: Number.isFinite(n) ? n : p.min_height_mobile_px,
                      }));
                    }}
                  />
                  <p className="text-[11px] text-muted-foreground">{t("pages.admin.landing.minHeightMobileHint")}</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("pages.admin.landing.minHeightDesktop")}</Label>
                  <Input
                    type="number"
                    min={200}
                    max={1200}
                    step={10}
                    value={heroVisual.min_height_desktop_px}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setHeroVisual((p) => ({
                        ...p,
                        min_height_desktop_px: Number.isFinite(n) ? n : p.min_height_desktop_px,
                      }));
                    }}
                  />
                  <p className="text-[11px] text-muted-foreground">{t("pages.admin.landing.minHeightDesktopHint")}</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("pages.admin.landing.tabImage")}</Label>
                  <Select
                    value={heroVisual.image_effect}
                    onValueChange={(v) =>
                      setHeroVisual((p) => ({ ...p, image_effect: v as PlansHeroVisual["image_effect"] }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_IMAGE_EFFECT.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {t(o.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("pages.admin.landing.imageCrop")}</Label>
                  <Select
                    value={heroVisual.image_object_position}
                    onValueChange={(v) =>
                      setHeroVisual((p) => ({
                        ...p,
                        image_object_position: v as PlansHeroVisual["image_object_position"],
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_HERO_FOCAL.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {t(o.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("pages.admin.landing.overlayOnPhoto")}</Label>
                  <Select
                    value={heroVisual.overlay_style}
                    onValueChange={(v) =>
                      setHeroVisual((p) => ({ ...p, overlay_style: v as PlansHeroVisual["overlay_style"] }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_OVERLAY.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {t(o.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("pages.admin.landing.overlayStrength")}</Label>
                  <Select
                    value={heroVisual.overlay_intensity}
                    onValueChange={(v) =>
                      setHeroVisual((p) => ({ ...p, overlay_intensity: v as PlansHeroVisual["overlay_intensity"] }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_OVERLAY_STRENGTH.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {t(o.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("pages.admin.landing.textEntrance")}</Label>
                  <Select
                    value={heroVisual.content_entrance}
                    onValueChange={(v) =>
                      setHeroVisual((p) => ({ ...p, content_entrance: v as PlansHeroVisual["content_entrance"] }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_ENTRANCE.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {t(o.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-3 rounded-md border border-border/60 bg-background/50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label htmlFor="pl-hero-cta" className="text-sm">
                      {t("pages.admin.landing.heroCta")}
                    </Label>
                    <p className="text-xs text-muted-foreground">{t("pages.admin.landing.heroCtaExample")}</p>
                  </div>
                  <Switch
                    id="pl-hero-cta"
                    checked={heroVisual.cta_enabled}
                    onCheckedChange={(c) => setHeroVisual((p) => ({ ...p, cta_enabled: c }))}
                  />
                </div>
                {heroVisual.cta_enabled ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t("pages.admin.landing.buttonText")}</Label>
                      <Input
                        placeholder={t("pages.admin.landing.seePlansPh")}
                        value={heroVisual.cta_label ?? ""}
                        onChange={(e) => setHeroVisual((p) => ({ ...p, cta_label: e.target.value }))}
                        maxLength={80}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t("pages.admin.landing.ctaLink")}</Label>
                      <Input
                        placeholder="#planos"
                        value={heroVisual.cta_href ?? ""}
                        onChange={(e) => setHeroVisual((p) => ({ ...p, cta_href: e.target.value }))}
                        maxLength={500}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
              </div>
            ) : null}

            {editorTab === "copy" ? (
              <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="pl-intro">{t("pages.admin.landing.introBeforePlans")}</Label>
              <Textarea
                id="pl-intro"
                rows={4}
                placeholder={t("pages.admin.landing.introPh")}
                value={introText}
                onChange={(e) => setIntroText(e.target.value)}
                className="resize-y"
              />
              <MarkdownHint />
            </div>
            <div className="rounded-lg border border-border/60 p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">{t("pages.admin.landing.introType")}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("pages.admin.landing.lblFont")}</Label>
                  <Select value={introFont} onValueChange={setIntroFont}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_FONT.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {t(o.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("pages.admin.landing.lblAlign")}</Label>
                  <Select value={introTextAlign} onValueChange={setIntroTextAlign}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_ALIGN.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {t(o.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("pages.admin.landing.lblSize")}</Label>
                  <Select value={introTextSize} onValueChange={setIntroTextSize}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_BODY.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {t(o.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pl-foot">{t("pages.admin.landing.sectionFooterOpt")}</Label>
              <Textarea
                id="pl-foot"
                rows={3}
                placeholder={t("pages.admin.landing.footerNotePh")}
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                className="resize-y"
              />
              <MarkdownHint />
            </div>
            <div className="rounded-lg border border-border/60 p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">{t("pages.admin.landing.footerType")}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("pages.admin.landing.lblFont")}</Label>
                  <Select value={footerFont} onValueChange={setFooterFont}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_FONT.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {t(o.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("pages.admin.landing.lblAlign")}</Label>
                  <Select value={footerTextAlign} onValueChange={setFooterTextAlign}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_ALIGN.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {t(o.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("pages.admin.landing.lblSize")}</Label>
                  <Select value={footerTextSize} onValueChange={setFooterTextSize}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_BODY.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {t(o.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

              </div>
            ) : null}

            {editorTab === "labels" ? (
              <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Tag className="h-4 w-4 text-primary" />
                {t("pages.admin.landing.planCardLabels")}
              </p>
              <p className="text-[11px] text-muted-foreground leading-snug">
                {t("pages.admin.landing.planCardLabelsHint")}
              </p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {PLAN_LABEL_FORM_FIELDS.map(({ key, title }) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-[11px] leading-tight" htmlFor={`plab-${key}`}>
                      {title}
                    </Label>
                    <Input
                      id={`plab-${key}`}
                      value={planLabels[key] ?? ""}
                      onChange={(e) =>
                        setPlanLabels((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                ))}
              </div>
              </div>
            ) : null}

            {editorTab === "builder" ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{t("pages.admin.landing.contentBlocksTitle")}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    {t("pages.admin.landing.contentBlocksHint")}
                  </p>
                </div>
        <input
          ref={contentBlockImageFileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          tabIndex={-1}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            const idx = contentBlockImagePickIndexRef.current;
            e.target.value = "";
            contentBlockImagePickIndexRef.current = null;
            if (file == null || idx === null) return;
            setContentBlockImageUploadBusy(true);
            try {
              const { data, error } = await adminService.uploadPlansGalleryImage(file);
              if (error || !data?.image_url) {
                toast.error(error || t("pages.admin.landing.imageLoadError"));
                return;
              }
              setContentBlocks((prev) =>
                prev.map((b, i) =>
                  i === idx && b.type === "image" ? { ...b, src: data.image_url } : b,
                ),
              );
              toast.success(t("pages.admin.landing.imageLoaded"));
            } finally {
              setContentBlockImageUploadBusy(false);
            }
          }}
        />
        <div className="grid gap-6 xl:grid-cols-[minmax(260px,300px)_1fr]">
          <PlansLandingWidgetPalette
            onAddWidget={addContentBlock}
            className="xl:sticky xl:top-4 xl:self-start"
          />
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border/70 bg-muted/10 px-3 py-2">
              <span className="text-xs text-muted-foreground">{t("pages.admin.landing.quickShortcuts")}</span>
              <Button type="button" variant="secondary" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => addContentBlock("video")}>
                <Plus className="h-3.5 w-3.5" />
                {t("pages.admin.landing.video")}
              </Button>
              <Button type="button" variant="secondary" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => addContentBlock("image")}>
                <Plus className="h-3.5 w-3.5" />
                {t("pages.admin.landing.tabImage")}
              </Button>
              <Button type="button" variant="secondary" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => addContentBlock("rich_text")}>
                <Plus className="h-3.5 w-3.5" />
                {t("pages.admin.landing.textPlaceholder")}
              </Button>
            </div>

        {contentBlocks.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-muted/10 px-4 py-10 text-center">
            <p className="text-sm font-medium text-foreground">{t("pages.admin.landing.emptyBlocks")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("pages.admin.landing.emptyBlocksHint")}</p>
          </div>
        ) : (
          <DndContext
            sensors={contentBlockListSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleContentBlocksDragEnd}
          >
            <SortableContext
              items={contentBlocks.map((b) => b._key)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-4">
                {contentBlocks.map((block, index) => (
                  <PlansLandingSortableBlockShell key={block._key} id={block._key}>
                    {({ setNodeRef, style, isDragging, dragHandleProps }) => (
                      <div
                        ref={setNodeRef}
                        style={style}
                        className={cn(
                          "rounded-lg border border-border/80 bg-background/80 p-4 space-y-3 transition-shadow",
                          isDragging && "opacity-[0.92] shadow-lg ring-2 ring-primary/20",
                        )}
                      >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex min-w-0 flex-1 items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <button {...dragHandleProps} title={t("pages.admin.landing.dragReorder")}>
                      <GripVertical className="h-4 w-4" aria-hidden />
                    </button>
                    {block.type === "video" ? (
                      <>
                        <Video className="h-3.5 w-3.5" /> {t("pages.admin.landing.video")}
                      </>
                    ) : block.type === "image" ? (
                      <>
                        <ImageIcon className="h-3.5 w-3.5" /> {t("pages.admin.landing.tabImage")}
                      </>
                    ) : (
                      <>
                        <Type className="h-3.5 w-3.5" /> {t("pages.admin.landing.textPlaceholder")}
                      </>
                    )}
                    <span className="text-[10px] font-normal normal-case opacity-70">#{index + 1}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={index === 0}
                      onClick={() => moveContentBlock(index, -1)}
                      aria-label={t("pages.admin.landing.moveUp")}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={index >= contentBlocks.length - 1}
                      onClick={() => moveContentBlock(index, 1)}
                      aria-label={t("pages.admin.landing.moveDown")}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => removeContentBlock(index)}
                      aria-label={t("pages.admin.landing.removeBlock")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {block.type === "rich_text" ? (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t("pages.admin.landing.markdownContent")}</Label>
                      <Textarea
                        rows={8}
                        placeholder={t("pages.admin.landing.markdownPh")}
                        value={block.content}
                        onChange={(e) =>
                          setContentBlocks((prev) =>
                            prev.map((b, i) =>
                              i === index && b.type === "rich_text"
                                ? { ...b, content: e.target.value }
                                : b,
                            ),
                          )
                        }
                        className="resize-y font-mono text-sm"
                      />
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        {t("pages.admin.landing.emptyNotSaved")}
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">{t("pages.admin.landing.lblFont")}</Label>
                        <Select
                          value={block.font_family}
                          onValueChange={(v) =>
                            setContentBlocks((prev) =>
                              prev.map((b, i) =>
                                i === index && b.type === "rich_text"
                                  ? { ...b, font_family: v as EditorRichTextBlock["font_family"] }
                                  : b,
                              ),
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {OPT_FONT.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {t(o.label)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">{t("pages.admin.landing.lblSize")}</Label>
                        <Select
                          value={block.font_size}
                          onValueChange={(v) =>
                            setContentBlocks((prev) =>
                              prev.map((b, i) =>
                                i === index && b.type === "rich_text"
                                  ? { ...b, font_size: v as EditorRichTextBlock["font_size"] }
                                  : b,
                              ),
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {OPT_RICH_SIZE.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {t(o.label)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">{t("pages.admin.landing.lblWeight")}</Label>
                        <Select
                          value={block.font_weight}
                          onValueChange={(v) =>
                            setContentBlocks((prev) =>
                              prev.map((b, i) =>
                                i === index && b.type === "rich_text"
                                  ? { ...b, font_weight: v as EditorRichTextBlock["font_weight"] }
                                  : b,
                              ),
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {OPT_WEIGHT.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {t(o.label)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">{t("pages.admin.landing.lblAlign")}</Label>
                        <Select
                          value={block.text_align}
                          onValueChange={(v) =>
                            setContentBlocks((prev) =>
                              prev.map((b, i) =>
                                i === index && b.type === "rich_text"
                                  ? { ...b, text_align: v as EditorRichTextBlock["text_align"] }
                                  : b,
                              ),
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {OPT_ALIGN.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {t(o.label)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">{t("pages.admin.landing.textColorOpt")}</Label>
                        <Input
                          placeholder={t("pages.admin.landing.textColorPh")}
                          value={block.text_color}
                          onChange={(e) =>
                            setContentBlocks((prev) =>
                              prev.map((b, i) =>
                                i === index && b.type === "rich_text"
                                  ? { ...b, text_color: e.target.value }
                                  : b,
                              ),
                            )
                          }
                          maxLength={80}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">{t("pages.admin.landing.sectionBgOpt")}</Label>
                        <Input
                          placeholder={t("pages.admin.landing.sectionBgPh")}
                          value={block.background_color}
                          onChange={(e) =>
                            setContentBlocks((prev) =>
                              prev.map((b, i) =>
                                i === index && b.type === "rich_text"
                                  ? { ...b, background_color: e.target.value }
                                  : b,
                              ),
                            )
                          }
                          maxLength={80}
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-xs">{t("pages.admin.landing.lblWidth")}</Label>
                        <Select
                          value={block.layout}
                          onValueChange={(v) =>
                            setContentBlocks((prev) =>
                              prev.map((b, i) =>
                                i === index && b.type === "rich_text"
                                  ? { ...b, layout: v === "wide" ? "wide" : "contained" }
                                  : b,
                              ),
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="contained">{t("pages.admin.landing.layoutContained")}</SelectItem>
                            <SelectItem value="wide">{t("pages.admin.landing.layoutWide")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">{t("pages.admin.landing.titleOpt")}</Label>
                        <Input
                          value={block.title}
                          onChange={(e) =>
                            setContentBlocks((prev) =>
                              prev.map((b, i) =>
                                i === index && (b.type === "video" || b.type === "image")
                                  ? { ...b, title: e.target.value }
                                  : b,
                              ),
                            )
                          }
                          maxLength={200}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">{t("pages.admin.landing.subtitleOpt")}</Label>
                        <Input
                          value={block.subtitle}
                          onChange={(e) =>
                            setContentBlocks((prev) =>
                              prev.map((b, i) =>
                                i === index && (b.type === "video" || b.type === "image")
                                  ? { ...b, subtitle: e.target.value }
                                  : b,
                              ),
                            )
                          }
                          maxLength={500}
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-xs">{t("pages.admin.landing.lblWidth")}</Label>
                        <Select
                          value={block.layout}
                          onValueChange={(v) =>
                            setContentBlocks((prev) =>
                              prev.map((b, i) =>
                                i === index && (b.type === "video" || b.type === "image")
                                  ? { ...b, layout: v === "wide" ? "wide" : "contained" }
                                  : b,
                              ),
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="contained">{t("pages.admin.landing.layoutContained")}</SelectItem>
                            <SelectItem value="wide">{t("pages.admin.landing.layoutWide")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {block.type === "video" ? (
                      <div className="space-y-1.5">
                        <Label className="text-xs">{t("pages.admin.landing.videoUrl")}</Label>
                        <Input
                          placeholder={t("pages.admin.landing.videoUrlExample")}
                          value={block.url}
                          onChange={(e) =>
                            setContentBlocks((prev) =>
                              prev.map((b, i) =>
                                i === index && b.type === "video" ? { ...b, url: e.target.value } : b,
                              ),
                            )
                          }
                          maxLength={2000}
                        />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-end justify-between gap-2">
                            <Label className="text-xs">{t("pages.admin.landing.imageUrlOrUpload")}</Label>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="h-8 gap-1.5 text-xs"
                              disabled={contentBlockImageUploadBusy}
                              onClick={() => {
                                contentBlockImagePickIndexRef.current = index;
                                contentBlockImageFileInputRef.current?.click();
                              }}
                            >
                              {contentBlockImageUploadBusy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Upload className="h-3.5 w-3.5" />
                              )}
                              {t("pages.admin.landing.uploadFromPc")}
                            </Button>
                          </div>
                          <Input
                            placeholder={t("pages.admin.landing.uploadFromPcPh")}
                            value={block.src}
                            onChange={(e) =>
                              setContentBlocks((prev) =>
                                prev.map((b, i) =>
                                  i === index && b.type === "image" ? { ...b, src: e.target.value } : b,
                                ),
                              )
                            }
                            maxLength={2000}
                          />
                          {block.src.trim() ? (
                            <div className="min-w-0 max-w-full overflow-hidden rounded-md border border-border/50 bg-muted/25 p-2">
                              <img
                                src={block.src}
                                alt=""
                                className="mx-auto block h-auto max-h-32 w-full max-w-full object-contain md:max-h-40"
                                loading="lazy"
                                decoding="async"
                              />
                            </div>
                          ) : null}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs">{t("pages.admin.landing.altText")}</Label>
                            <Input
                              value={block.alt}
                              onChange={(e) =>
                                setContentBlocks((prev) =>
                                  prev.map((b, i) =>
                                    i === index && b.type === "image" ? { ...b, alt: e.target.value } : b,
                                  ),
                                )
                              }
                              maxLength={200}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">{t("pages.admin.landing.captionOptional")}</Label>
                            <Input
                              value={block.caption}
                              onChange={(e) =>
                                setContentBlocks((prev) =>
                                  prev.map((b, i) =>
                                    i === index && b.type === "image"
                                      ? { ...b, caption: e.target.value }
                                      : b,
                                  ),
                                )
                              }
                              maxLength={500}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
                    )}
                  </PlansLandingSortableBlockShell>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
          </div>
        </div>
              </div>
            ) : null}
          </div>
        </div>
        ) : null}

        {workspaceLayout !== "editor" ? (
          <aside className={cn("flex min-h-0 min-w-0 flex-col", workspaceHeightClass)}>
            {previewPane}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
