import { useEffect, useMemo, useRef, useState } from "react";
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
} from "lucide-react";
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
import { coerceLandingExtras, type LandingExtrasPublic } from "@/lib/plansLandingExtras";
import { resolveGalleryCarouselOptions } from "@/lib/landingGalleryCarousel";
import type { LandingPageThemeInput } from "@/lib/landingPageTheme";
import { resolveLandingPageTheme } from "@/lib/landingPageTheme";
import { LandingPageThemeProvider } from "@/contexts/LandingPageThemeContext";
import { LandingPageBodySections } from "@/components/plans/LandingPageBodySections";
import { LandingMarkdown } from "@/components/plans/LandingMarkdown";
import { SalesLandingLegalFooter } from "@/components/plans/SalesLandingSections";
import {
  DEFAULT_LANDING_SECTION_ORDER,
  LANDING_SECTION_LABELS,
  LANDING_SECTION_IDS,
  resolveSectionOrder,
  type LandingSectionId,
} from "@/lib/landingSectionLayout";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  font_weight: "normal" | "medium" | "semibold" | "bold";
  text_align: "left" | "center" | "right";
  text_color: string;
  background_color: string;
  layout: "contained" | "wide";
};

type EditorContentBlock = EditorVideoBlock | EditorImageBlock | EditorRichTextBlock;

const OPT_FONT = [
  { value: "sans", label: "Sans (UI)" },
  { value: "serif", label: "Serif" },
  { value: "mono", label: "Mono" },
];
const OPT_ALIGN = [
  { value: "left", label: "Esquerda" },
  { value: "center", label: "Centro" },
  { value: "right", label: "Direita" },
];
const OPT_TITLE_SIZE = [
  { value: "sm", label: "Pequeno" },
  { value: "md", label: "Médio" },
  { value: "lg", label: "Grande" },
  { value: "xl", label: "XL" },
  { value: "2xl", label: "2XL" },
  { value: "3xl", label: "3XL (padrão)" },
  { value: "4xl", label: "4XL" },
  { value: "5xl", label: "5XL" },
];
const OPT_WEIGHT = [
  { value: "normal", label: "Normal" },
  { value: "medium", label: "Médio" },
  { value: "semibold", label: "Semibold" },
  { value: "bold", label: "Bold (padrão)" },
  { value: "extrabold", label: "Extrabold" },
];
const OPT_BODY = [
  { value: "xs", label: "XS" },
  { value: "sm", label: "SM" },
  { value: "base", label: "Base (padrão)" },
  { value: "lg", label: "LG" },
  { value: "xl", label: "XL" },
];

const OPT_RICH_SIZE = [
  { value: "xs", label: "XS" },
  { value: "sm", label: "SM" },
  { value: "base", label: "Base" },
  { value: "lg", label: "LG" },
  { value: "xl", label: "XL" },
  { value: "2xl", label: "2XL" },
];

const OPT_IMAGE_EFFECT = [
  { value: "none", label: "Nenhum" },
  { value: "ken-burns", label: "Zoom suave (Ken Burns)" },
  { value: "hover-zoom", label: "Zoom ao passar o rato" },
  { value: "parallax", label: "Parallax (fundo fixo em desktop)" },
];

const OPT_OVERLAY = [
  { value: "gradient-dark", label: "Gradiente escuro (legível)" },
  { value: "gradient-light", label: "Gradiente claro" },
  { value: "solid-dark", label: "Overlay escuro uniforme" },
  { value: "solid-light", label: "Overlay claro uniforme" },
  { value: "none", label: "Sem overlay" },
];

const OPT_OVERLAY_STRENGTH = [
  { value: "subtle", label: "Suave" },
  { value: "medium", label: "Médio" },
  { value: "strong", label: "Forte" },
];

const OPT_ENTRANCE = [
  { value: "none", label: "Nenhuma" },
  { value: "fade-in", label: "Fade in" },
  { value: "fade-up", label: "Fade + subir (recomendado)" },
];

const OPT_HERO_FOCAL = [
  { value: "center", label: "Centro" },
  { value: "top", label: "Topo (cabeças / horizonte)" },
  { value: "bottom", label: "Baixo" },
];

const THEME_FIELD_ROWS: { key: keyof LandingPageThemeInput; label: string; placeholder: string }[] = [
  { key: "page_background", label: "Fundo da página", placeholder: "#050a18" },
  { key: "nav_background", label: "Barra fixa (topo)", placeholder: "rgba(5,10,24,0.88)" },
  { key: "accent", label: "Cor de destaque (CTAs)", placeholder: "#059669" },
  { key: "accent_hover", label: "Destaque ao passar o rato", placeholder: "#047857" },
  { key: "heading_on_dark", label: "Títulos sobre escuro", placeholder: "#ffffff" },
  { key: "muted_on_dark", label: "Texto secundário", placeholder: "rgba(255,255,255,0.78)" },
  { key: "link", label: "Ligações e rótulos pequenos", placeholder: "#34d399" },
  { key: "card_surface", label: "Fundo dos cartões brancos", placeholder: "#ffffff" },
  { key: "badge_border", label: "Borda do selo (hero)", placeholder: "rgba(16,185,129,0.45)" },
  { key: "badge_background", label: "Fundo do selo", placeholder: "rgba(16,185,129,0.12)" },
  { key: "badge_text", label: "Texto do selo", placeholder: "#d1fae5" },
  { key: "selection_bg", label: "Seleção de texto", placeholder: "rgba(16,185,129,0.2)" },
  { key: "stats_gradient_from", label: "Bloco números — topo do gradiente", placeholder: "rgba(6,78,59,0.38)" },
  { key: "stats_gradient_to", label: "Bloco números — base do gradiente", placeholder: "#050a18" },
  { key: "stats_border", label: "Borda do bloco números", placeholder: "rgba(16,185,129,0.25)" },
  { key: "stats_glow", label: "Brilho ao fundo (números)", placeholder: "rgba(16,185,129,0.22)" },
  { key: "faq_border", label: "Borda do FAQ", placeholder: "rgba(16,185,129,0.3)" },
  { key: "nav_border", label: "Borda da barra / separadores", placeholder: "rgba(255,255,255,0.1)" },
  { key: "outline_nav_border", label: "Botões outline (borda)", placeholder: "rgba(255,255,255,0.25)" },
  { key: "outline_nav_bg", label: "Botões outline (fundo)", placeholder: "rgba(255,255,255,0.05)" },
  {
    key: "accent_button_shadow",
    label: "Sombra dos botões principais (CTA)",
    placeholder: "0 8px 32px -8px rgba(5,150,105,0.45)",
  },
  { key: "accent_button_radius", label: "Raio dos botões CTA", placeholder: "9999px ou 0.75rem" },
  { key: "plan_card_radius", label: "Raio dos cartões de plano", placeholder: "1rem" },
];

const MARKDOWN_HINT = (
  <p className="text-[11px] leading-snug text-muted-foreground">
    Pode usar Markdown: <span className="font-mono">**negrito**</span>, listas,{" "}
    <span className="font-mono">[texto](https://…)</span>, imagens{" "}
    <span className="font-mono">![descrição](https://…)</span>.
  </p>
);

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

type Props = {
  onInvalidateAdmin?: () => void;
};

export function PlansLandingEditor({ onInvalidateAdmin }: Props) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ADMIN_KEY,
    queryFn: async () => {
      const { data: row, error } = await adminService.getPlansLanding();
      if (error) throw new Error(error);
      if (!row) throw new Error("Resposta vazia");
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
  const [contentBlocks, setContentBlocks] = useState<EditorContentBlock[]>([]);
  const [sectionOrder, setSectionOrder] = useState<LandingSectionId[]>(() => [
    ...DEFAULT_LANDING_SECTION_ORDER,
  ]);
  const [sectionsEnabled, setSectionsEnabled] = useState<Record<LandingSectionId, boolean>>(() => {
    const o = {} as Record<LandingSectionId, boolean>;
    for (const id of LANDING_SECTION_IDS) o[id] = true;
    return o;
  });
  const [testimonialTitle, setTestimonialTitle] = useState("");
  const [testimonialSubtitle, setTestimonialSubtitle] = useState("");
  const [testimonialItems, setTestimonialItems] = useState<
    {
      thumbnail_url: string;
      video_url: string;
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
    setFeatCards([
      {
        title: fc[0]?.title ?? "",
        body: fc[0]?.body ?? "",
        image_url: fc[0]?.image_url?.trim() ?? "",
      },
      {
        title: fc[1]?.title ?? "",
        body: fc[1]?.body ?? "",
        image_url: fc[1]?.image_url?.trim() ?? "",
      },
      {
        title: fc[2]?.title ?? "",
        body: fc[2]?.body ?? "",
        image_url: fc[2]?.image_url?.trim() ?? "",
      },
    ]);
    setStatTitle(ex.stats?.title ?? "");
    setStatSubtitle(ex.stats?.subtitle ?? "");
    const si = ex.stats?.items ?? [];
    setStatItems([
      { value: si[0]?.value ?? "", label: si[0]?.label ?? "" },
      { value: si[1]?.value ?? "", label: si[1]?.label ?? "" },
      { value: si[2]?.value ?? "", label: si[2]?.label ?? "" },
      { value: si[3]?.value ?? "", label: si[3]?.label ?? "" },
    ]);
    setFaqTitle(ex.faq?.title ?? "");
    const fq = ex.faq?.items ?? [];
    setFaqItems(
      Array.from({ length: 5 }, (_, i) => ({
        q: fq[i]?.q ?? "",
        a: fq[i]?.a ?? "",
      })),
    );
    setLegalLines((ex.legal_footer?.lines ?? []).join("\n"));
    const ll = ex.legal_footer?.links ?? [];
    setLegalLinks([
      { label: ll[0]?.label ?? "", href: ll[0]?.href ?? "" },
      { label: ll[1]?.label ?? "", href: ll[1]?.href ?? "" },
      { label: ll[2]?.label ?? "", href: ll[2]?.href ?? "" },
    ]);

    const blocks = ex.content_blocks;
    if (blocks?.length) {
      setContentBlocks(
        blocks.map((b) => {
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
            };
          }
          return {
            type: "video" as const,
            title: b.title ?? "",
            subtitle: b.subtitle ?? "",
            url: b.url,
            layout: b.layout === "wide" ? "wide" : "contained",
          };
        }),
      );
    } else {
      setContentBlocks([]);
    }

    setSectionOrder(resolveSectionOrder(ex.section_order));
    const se = ex.sections_enabled;
    if (se) {
      setSectionsEnabled({
        content_blocks: se.content_blocks !== false,
        features: se.features !== false,
        stats: se.stats !== false,
        testimonials: se.testimonials !== false,
        gallery: se.gallery !== false,
        planos: se.planos !== false,
        guarantee: se.guarantee !== false,
        faq: se.faq !== false,
      });
    } else {
      const o = {} as Record<LandingSectionId, boolean>;
      for (const id of LANDING_SECTION_IDS) o[id] = true;
      setSectionsEnabled(o);
    }

    const te = ex.testimonials;
    setTestimonialTitle(te?.title ?? "");
    setTestimonialSubtitle(te?.subtitle ?? "");
    setTestimonialItems(
      te?.items?.length
        ? te.items.map((it) => ({
            thumbnail_url: it.thumbnail_url,
            video_url: it.video_url,
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
        name: t.name.trim() || null,
        role: t.role.trim() || null,
        social_handle: t.social_handle.trim() || null,
      }))
      .filter((t) => t.thumbnail_url && t.video_url);

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
      },
      theme: themePayload,
      text_styles,
    };
  };

  const previewExtras = useMemo(
    () => coerceLandingExtras(buildLandingExtrasPayload()),
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
      sectionOrder,
      sectionsEnabled,
    ],
  );

  const previewSalesThemed = useMemo(() => resolveLandingPageTheme(landingTheme), [landingTheme]);

  const addContentBlock = (kind: "video" | "image" | "rich_text") => {
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
          }
        : kind === "video"
          ? {
              type: "video",
              title: "",
              subtitle: "",
              url: "",
              layout: "contained",
            }
          : {
              type: "image",
              title: "",
              subtitle: "",
              src: "",
              alt: "",
              caption: "",
              layout: "contained",
            },
    ]);
  };

  const moveContentBlock = (index: number, delta: -1 | 1) => {
    setContentBlocks((prev) => {
      const next = [...prev];
      const j = index + delta;
      if (j < 0 || j >= next.length) return prev;
      const t = next[index];
      next[index] = next[j]!;
      next[j] = t!;
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
      const t = next[index]!;
      next[index] = next[j]!;
      next[j] = t;
      return next;
    });
  };

  const moveSectionInOrder = (index: number, delta: -1 | 1) => {
    setSectionOrder((prev) => {
      const next = [...prev];
      const j = index + delta;
      if (j < 0 || j >= next.length) return prev;
      const t = next[index];
      next[index] = next[j]!;
      next[j] = t!;
      return next;
    });
  };

  const saveTexts = async () => {
    if (!heroTitle.trim()) {
      toast.error("O título do hero é obrigatório.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await adminService.patchPlansLanding({
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
      toast.success("Landing de planos atualizada.");
      queryClient.invalidateQueries({ queryKey: ADMIN_KEY });
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
      toast.success(result.data?.message ?? "Imagem publicada.");
      queryClient.invalidateQueries({ queryKey: ADMIN_KEY });
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
      toast.success("Imagem do hero removida.");
      queryClient.invalidateQueries({ queryKey: ADMIN_KEY });
      queryClient.invalidateQueries({ queryKey: PUBLIC_KEY });
      onInvalidateAdmin?.();
    },
  });

  if (isLoading) {
    return (
      <Card className="border-primary/15">
        <CardHeader>
          <CardTitle className="text-lg">Landing da página de planos</CardTitle>
          <CardDescription>A carregar…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-lg">Landing da página de planos</CardTitle>
          <CardDescription>Não foi possível carregar a configuração.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  const previewAt = data.updated_at;

  return (
    <div className="space-y-6">
    <Card className="border-primary/20 shadow-sm">
      <CardHeader className="border-b border-border/60 bg-muted/20">
        <CardTitle className="text-lg">Ordem e visibilidade das secções</CardTitle>
        <CardDescription>
          A primeira entrada da lista corresponde ao bloco mais acima na página (logo após o texto introdutório); use Subir/Descer para
          alterar. Defina também se cada secção fica visível. «Planos» pode ficar oculto só se não quiser mostrar preços aqui.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 p-4">
        {sectionOrder.map((id, index) => (
          <div
            key={id}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-muted/10 px-3 py-2"
          >
            <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 text-sm font-medium leading-tight">
              {LANDING_SECTION_LABELS[id]}
            </span>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Mostrar</Label>
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
                className="h-8 w-8"
                disabled={index === 0}
                onClick={() => moveSectionInOrder(index, -1)}
                aria-label="Subir"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={index >= sectionOrder.length - 1}
                onClick={() => moveSectionInOrder(index, 1)}
                aria-label="Descer"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>

    <Card className="overflow-hidden border-primary/20 shadow-sm">
      <CardHeader className="border-b border-border/60 bg-muted/30">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <LayoutTemplate className="h-5 w-5 text-primary" />
              Landing da página de planos
            </CardTitle>
            <CardDescription className="mt-1 max-w-2xl">
              Textos (subtítulo, intro e rodapé suportam Markdown para negrito, listas, ligações e imagens por URL), imagem,
              tipografia e efeitos visuais do hero (overlay, zoom, parallax, botão, animação de entrada). A pré-visualização
              replica a <span className="font-medium text-foreground">página inicial</span> (
              <span className="font-medium text-foreground">/</span>
              ); <span className="font-medium text-foreground">/plans</span> e <span className="font-medium text-foreground">/planos</span>{" "}
              redirecionam para lá.
            </CardDescription>
          </div>
          <Button type="button" className="gap-2 shrink-0" disabled={saving} onClick={() => saveTexts()}>
            <Save className="h-4 w-4" />
            Guardar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid gap-0 lg:grid-cols-2">
          <div className="space-y-5 p-6 lg:border-r border-border/60">
            <div className="space-y-2">
              <Label htmlFor="pl-badge">Selo / etiqueta (opcional)</Label>
              <Input
                id="pl-badge"
                placeholder="Ex.: Planos e preços"
                value={badgeText}
                onChange={(e) => setBadgeText(e.target.value)}
                maxLength={80}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pl-title">Título principal</Label>
              <Input id="pl-title" value={heroTitle} onChange={(e) => setHeroTitle(e.target.value)} maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pl-sub">Subtítulo</Label>
              <Textarea
                id="pl-sub"
                rows={3}
                placeholder="Uma frase que explica o valor dos planos…"
                value={heroSubtitle}
                onChange={(e) => setHeroSubtitle(e.target.value)}
                className="resize-y min-h-[72px]"
              />
              {MARKDOWN_HINT}
            </div>

            <div className="rounded-lg border border-border/80 bg-muted/20 p-4 space-y-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Type className="h-4 w-4 text-primary" />
                Tipografia do hero
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Fonte</Label>
                  <Select value={heroFont} onValueChange={setHeroFont}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_FONT.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Alinhamento</Label>
                  <Select value={heroTextAlign} onValueChange={setHeroTextAlign}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_ALIGN.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tamanho do título</Label>
                  <Select value={heroTitleSize} onValueChange={setHeroTitleSize}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_TITLE_SIZE.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Peso do título</Label>
                  <Select value={heroTitleWeight} onValueChange={setHeroTitleWeight}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_WEIGHT.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Tamanho do subtítulo</Label>
                  <Select value={heroSubtitleSize} onValueChange={setHeroSubtitleSize}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_BODY.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-violet-500/25 bg-violet-500/[0.06] p-4 space-y-3">
              <p className="text-sm font-semibold text-foreground">Tipografia por zona (opcional)</p>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Cor, tipo de letra, tamanho, peso e alinhamento por bloco — como no Elementor. Sobrepõem o tema escuro e os
                campos base ao lado quando preenchidos. Use «Repor» para voltar ao padrão de cada zona.
              </p>
              <div className="max-h-[min(480px,50vh)] space-y-3 overflow-y-auto pr-1">
                <PlansLandingTextStyleFields
                  label="Título do hero"
                  value={textStyles.hero_title}
                  onChange={(b) => patchTextStyle("hero_title", b)}
                />
                <PlansLandingTextStyleFields
                  label="Subtítulo do hero"
                  value={textStyles.hero_subtitle}
                  onChange={(b) => patchTextStyle("hero_subtitle", b)}
                />
                <PlansLandingTextStyleFields
                  label="Selo / etiqueta (hero)"
                  value={textStyles.hero_badge}
                  onChange={(b) => patchTextStyle("hero_badge", b)}
                />
                <PlansLandingTextStyleFields
                  label="Texto introdutório"
                  value={textStyles.intro}
                  onChange={(b) => patchTextStyle("intro", b)}
                />
                <PlansLandingTextStyleFields
                  label="Rodapé da secção"
                  value={textStyles.footer}
                  onChange={(b) => patchTextStyle("footer", b)}
                />
                <PlansLandingTextStyleFields
                  label="Etiqueta pequena (PLANOS)"
                  value={textStyles.plans_section_label}
                  onChange={(b) => patchTextStyle("plans_section_label", b)}
                />
                <PlansLandingTextStyleFields
                  label="Título da secção de planos"
                  value={textStyles.plans_section_title}
                  onChange={(b) => patchTextStyle("plans_section_title", b)}
                />
                <PlansLandingTextStyleFields
                  label="Subtítulo da secção de planos"
                  value={textStyles.plans_section_subtitle}
                  onChange={(b) => patchTextStyle("plans_section_subtitle", b)}
                />
                <PlansLandingTextStyleFields
                  label="Destaques — título"
                  value={textStyles.features_title}
                  onChange={(b) => patchTextStyle("features_title", b)}
                />
                <PlansLandingTextStyleFields
                  label="Destaques — subtítulo"
                  value={textStyles.features_subtitle}
                  onChange={(b) => patchTextStyle("features_subtitle", b)}
                />
                <PlansLandingTextStyleFields
                  label="Destaques — título do cartão"
                  value={textStyles.feature_card_title}
                  onChange={(b) => patchTextStyle("feature_card_title", b)}
                />
                <PlansLandingTextStyleFields
                  label="Destaques — texto do cartão"
                  value={textStyles.feature_card_body}
                  onChange={(b) => patchTextStyle("feature_card_body", b)}
                />
                <PlansLandingTextStyleFields
                  label="Números — título"
                  value={textStyles.stats_title}
                  onChange={(b) => patchTextStyle("stats_title", b)}
                />
                <PlansLandingTextStyleFields
                  label="Números — subtítulo"
                  value={textStyles.stats_subtitle}
                  onChange={(b) => patchTextStyle("stats_subtitle", b)}
                />
                <PlansLandingTextStyleFields
                  label="Números — valor (grande)"
                  value={textStyles.stat_value}
                  onChange={(b) => patchTextStyle("stat_value", b)}
                />
                <PlansLandingTextStyleFields
                  label="Números — etiqueta"
                  value={textStyles.stat_label}
                  onChange={(b) => patchTextStyle("stat_label", b)}
                />
                <PlansLandingTextStyleFields
                  label="FAQ — título"
                  value={textStyles.faq_title}
                  onChange={(b) => patchTextStyle("faq_title", b)}
                />
                <PlansLandingTextStyleFields
                  label="FAQ — pergunta"
                  value={textStyles.faq_question}
                  onChange={(b) => patchTextStyle("faq_question", b)}
                />
                <PlansLandingTextStyleFields
                  label="FAQ — resposta"
                  value={textStyles.faq_answer}
                  onChange={(b) => patchTextStyle("faq_answer", b)}
                />
                <PlansLandingTextStyleFields
                  label="Rodapé legal (linhas)"
                  value={textStyles.legal_footer}
                  onChange={(b) => patchTextStyle("legal_footer", b)}
                />
                <PlansLandingTextStyleFields
                  label="Testemunhos — título"
                  value={textStyles.testimonials_title}
                  onChange={(b) => patchTextStyle("testimonials_title", b)}
                />
                <PlansLandingTextStyleFields
                  label="Testemunhos — subtítulo"
                  value={textStyles.testimonials_subtitle}
                  onChange={(b) => patchTextStyle("testimonials_subtitle", b)}
                />
                <PlansLandingTextStyleFields
                  label="Galeria — título"
                  value={textStyles.gallery_title}
                  onChange={(b) => patchTextStyle("gallery_title", b)}
                />
                <PlansLandingTextStyleFields
                  label="Galeria — subtítulo"
                  value={textStyles.gallery_subtitle}
                  onChange={(b) => patchTextStyle("gallery_subtitle", b)}
                />
                <PlansLandingTextStyleFields
                  label="Garantia — título"
                  value={textStyles.guarantee_title}
                  onChange={(b) => patchTextStyle("guarantee_title", b)}
                />
                <PlansLandingTextStyleFields
                  label="Garantia — destaque / lead"
                  value={textStyles.guarantee_lead}
                  onChange={(b) => patchTextStyle("guarantee_lead", b)}
                />
                <PlansLandingTextStyleFields
                  label="Garantia — corpo"
                  value={textStyles.guarantee_body}
                  onChange={(b) => patchTextStyle("guarantee_body", b)}
                />
                <PlansLandingTextStyleFields
                  label="Garantia — rodapé destacado"
                  value={textStyles.guarantee_footer}
                  onChange={(b) => patchTextStyle("guarantee_footer", b)}
                />
              </div>
            </div>

            <Separator />

            <div className="rounded-lg border border-blue-500/25 bg-blue-500/[0.06] p-4 space-y-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Sparkles className="h-4 w-4 text-blue-600" />
                Tema e secções (estilo página de vendas)
              </p>
              <p className="text-xs text-muted-foreground">
                Ative o fundo escuro (tipo Smart Click), títulos da secção de planos, até 3 cartões de destaque, números, FAQ e rodapé
                legal. Deixe vazio o que não quiser mostrar.
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs">Aparência global</Label>
                <Select
                  value={appearance}
                  onValueChange={(v) => setAppearance(v as LandingExtrasPublic["appearance"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Claro (padrão do site)</SelectItem>
                    <SelectItem value="sales_dark">Escuro — vendas (cartões brancos, destaque verde)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-md border border-border/60 bg-background/50 p-3 space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Personalização completa da <span className="font-medium text-foreground">copy</span>,{" "}
                  <span className="font-medium text-foreground">imagem e vídeo do hero</span>,{" "}
                  <span className="font-medium text-foreground">tipografia</span>,{" "}
                  <span className="font-medium text-foreground">ordem e visibilidade das secções</span>,{" "}
                  <span className="font-medium text-foreground">cores</span> e{" "}
                  <span className="font-medium text-foreground">posição do recorte</span> da foto. Isto não é um page
                  builder por arrastar blocos como o Elementor em WordPress — aqui tudo passa por estes campos e
                  pré-visualização ao lado.
                </p>
                {appearance === "sales_dark" ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
                      <p className="text-xs font-semibold text-foreground">Cores (CSS: #hex ou rgba)</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setLandingTheme({})}
                      >
                        Repor tema padrão
                      </Button>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Fonte das secções (destaques, estatísticas, FAQ…)</Label>
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
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid max-h-[min(420px,55vh)] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                      {THEME_FIELD_ROWS.map(({ key, label, placeholder }) => (
                        <div key={key} className="space-y-1">
                          <Label className="text-[11px] leading-tight text-muted-foreground">{label}</Label>
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
                  <Label className="text-xs">Etiqueta pequena acima dos planos (ex.: PLANOS)</Label>
                  <Input
                    value={plansSectionLabel}
                    onChange={(e) => setPlansSectionLabel(e.target.value)}
                    placeholder="PLANOS"
                    maxLength={80}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Título da secção de planos</Label>
                  <Input
                    value={plansSectionTitle}
                    onChange={(e) => setPlansSectionTitle(e.target.value)}
                    placeholder="Nossas Opções de Adesão"
                    maxLength={200}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Subtítulo da secção de planos</Label>
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

              <p className="text-xs font-medium text-foreground">Cartões de destaque (até 3)</p>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Layout em faixa clara: imagem opcional por cartão (16:9), título e texto alinhados à esquerda — como uma secção de
                benefícios.
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs">Título do bloco</Label>
                <Input value={featTitle} onChange={(e) => setFeatTitle(e.target.value)} maxLength={200} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Subtítulo do bloco</Label>
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
                      toast.error(error || "Não foi possível carregar a imagem.");
                      return;
                    }
                    setFeatCards((prev) =>
                      prev.map((c, i) => (i === idx ? { ...c, image_url: data.image_url } : c)),
                    );
                    toast.success("Imagem do cartão carregada. Guarde a landing para persistir.");
                  } finally {
                    setFeatureImageUploadBusy(false);
                  }
                }}
              />
              {featCards.map((card, idx) => (
                <div key={idx} className="rounded-md border border-border/60 bg-background/80 p-3 space-y-2">
                  <p className="text-[11px] font-medium text-muted-foreground">Cartão {idx + 1}</p>
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      <Label className="text-xs">Imagem (opcional, URL ou PC)</Label>
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
                      <div className="rounded-md border border-border/50 bg-muted/25 p-2">
                        <img
                          src={card.image_url}
                          alt=""
                          className="mx-auto max-h-24 w-full max-w-sm object-contain"
                        />
                      </div>
                    ) : null}
                  </div>
                  <Input
                    placeholder="Título"
                    value={card.title}
                    onChange={(e) =>
                      setFeatCards((prev) =>
                        prev.map((c, i) => (i === idx ? { ...c, title: e.target.value } : c)),
                      )
                    }
                  />
                  <Textarea
                    placeholder="Texto"
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
              {MARKDOWN_HINT}

              <Separator />

              <p className="text-xs font-medium text-foreground">
                Números / estatísticas (até 4) — visíveis na página só com aparência «Escuro — vendas»
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  placeholder="Título do bloco"
                  value={statTitle}
                  onChange={(e) => setStatTitle(e.target.value)}
                  maxLength={200}
                />
                <Input
                  placeholder="Subtítulo"
                  value={statSubtitle}
                  onChange={(e) => setStatSubtitle(e.target.value)}
                  maxLength={500}
                />
              </div>
              {statItems.map((row, idx) => (
                <div key={idx} className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    placeholder="Valor (ex.: 7k+)"
                    value={row.value}
                    onChange={(e) =>
                      setStatItems((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, value: e.target.value } : r)),
                      )
                    }
                  />
                  <Input
                    placeholder="Etiqueta"
                    value={row.label}
                    onChange={(e) =>
                      setStatItems((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, label: e.target.value } : r)),
                      )
                    }
                  />
                </div>
              ))}

              <Separator />

              <p className="text-xs font-medium text-foreground">FAQ (até 5 perguntas)</p>
              <Input
                placeholder="Título da secção FAQ"
                value={faqTitle}
                onChange={(e) => setFaqTitle(e.target.value)}
                maxLength={200}
                className="mb-2"
              />
              {faqItems.map((row, idx) => (
                <div key={idx} className="mb-3 space-y-2 rounded-md border border-border/60 p-3">
                  <Input
                    placeholder={`Pergunta ${idx + 1}`}
                    value={row.q}
                    onChange={(e) =>
                      setFaqItems((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, q: e.target.value } : r)),
                      )
                    }
                  />
                  <Textarea
                    placeholder="Resposta"
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
                    Secção em duas colunas: imagem do selo (opcional) e textos. A posição na página segue a ordem das secções
                    (por defeito após «Planos»). Corpo e rodapé suportam Markdown (**negrito**, ligações).
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/15 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="guarantee-enabled"
                        checked={guaranteeEnabled}
                        onCheckedChange={setGuaranteeEnabled}
                      />
                      <Label htmlFor="guarantee-enabled" className="text-xs font-medium">
                        Mostrar conteúdo desta secção
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
                          toast.error(error || "Não foi possível carregar a imagem.");
                          return;
                        }
                        setGuaranteeSealUrl(data.image_url);
                        toast.success("Selo carregado. Guarde a landing para persistir.");
                      } finally {
                        setGuaranteeSealUploadBusy(false);
                      }
                    }}
                  />
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      <Label className="text-xs">URL da imagem do selo (ou carregue do PC)</Label>
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
                        Carregar do PC
                      </Button>
                    </div>
                    <Input
                      placeholder="https://… ou use «Carregar do PC»"
                      value={guaranteeSealUrl}
                      onChange={(e) => setGuaranteeSealUrl(e.target.value)}
                      maxLength={2000}
                    />
                    {guaranteeSealUrl.trim() ? (
                      <div className="rounded-md border border-border/50 bg-muted/25 p-2">
                        <img
                          src={guaranteeSealUrl}
                          alt=""
                          className="mx-auto h-24 w-24 rounded-full object-cover md:h-28 md:w-28"
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Título</Label>
                    <Input
                      placeholder="Ex.: 100% Livre de Riscos"
                      value={guaranteeTitle}
                      onChange={(e) => setGuaranteeTitle(e.target.value)}
                      maxLength={200}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Destaque / lead</Label>
                    <Textarea
                      placeholder="Frase curta abaixo do título"
                      value={guaranteeLead}
                      onChange={(e) => setGuaranteeLead(e.target.value)}
                      rows={2}
                      maxLength={800}
                      className="resize-y text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Corpo (Markdown)</Label>
                    <Textarea
                      placeholder="Texto principal — parágrafos, **negrito**, listas"
                      value={guaranteeBody}
                      onChange={(e) => setGuaranteeBody(e.target.value)}
                      rows={5}
                      maxLength={12000}
                      className="resize-y font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Rodapé destacado (Markdown, ícone verde na página)</Label>
                    <Textarea
                      placeholder="Ex.: A decisão agora é sua — e o **risco é todo nosso.**"
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
                    Testemunhos em vídeo (grelha)
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 px-3 pb-3 pt-1">
              <p className="text-xs text-muted-foreground">
                Miniatura em retrato (9:16), URL do vídeo (YouTube/Vimeo ou .mp4) ao clicar. Até 8 cartões. Aparece após os números e
                antes dos planos.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Título da secção</Label>
                  <Input
                    placeholder="Testemunhos"
                    value={testimonialTitle}
                    onChange={(e) => setTestimonialTitle(e.target.value)}
                    maxLength={200}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Subtítulo</Label>
                  <Input
                    placeholder="Veja o que os utilizadores dizem…"
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
                        name: "",
                        role: "",
                        social_handle: "",
                      },
                    ])
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar cartão
                </Button>
              </div>
              {testimonialItems.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem testemunhos. Adicione cartões com miniatura e vídeo.</p>
              ) : (
                <div className="space-y-3">
                  {testimonialItems.map((row, idx) => (
                    <div
                      key={`tm-${idx}`}
                      className="space-y-2 rounded-md border border-border/60 bg-background/80 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-muted-foreground">Cartão {idx + 1}</span>
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
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label className="text-xs">URL da miniatura (imagem)</Label>
                          <Input
                            placeholder="https://… (retrato recomendado)"
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
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label className="text-xs">URL do vídeo (ao clicar)</Label>
                          <Input
                            placeholder="YouTube, Vimeo ou .mp4"
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
                          <Label className="text-xs">Nome (opcional)</Label>
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
                          <Label className="text-xs">Função / título (opcional)</Label>
                          <Input
                            placeholder="Ex.: Empreendedora digital"
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
                          <Label className="text-xs">Rede / handle (opcional, canto superior)</Label>
                          <Input
                            placeholder="@instagram ou texto curto"
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
                    Imagens em grelha ou em carrossel (setas, pontos, autoplay). Clique na imagem para ampliar. Até 8
                    cartões. Ordem na lista = ordem no carrossel ou na grelha. Pode{" "}
                    <strong className="text-foreground/90">colar um URL</strong> ou{" "}
                    <strong className="text-foreground/90">carregar do PC</strong> (JPG, PNG ou WebP, máx. 2 MB) — o
                    servidor gera o URL público. Guarde a landing em seguida.
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
                          toast.error(error || "Não foi possível carregar a imagem.");
                          return;
                        }
                        setGalleryItems((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, image_url: data.image_url } : r)),
                        );
                        toast.success("Imagem carregada. Guarde a landing para persistir.");
                      } finally {
                        setGalleryUploadBusy(false);
                      }
                    }}
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Título</Label>
                      <Input
                        placeholder="Galeria"
                        value={galleryTitle}
                        onChange={(e) => setGalleryTitle(e.target.value)}
                        maxLength={200}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Subtítulo</Label>
                      <Input
                        value={gallerySubtitle}
                        onChange={(e) => setGallerySubtitle(e.target.value)}
                        maxLength={800}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Apresentação</Label>
                    <Select
                      value={galleryDisplay}
                      onValueChange={(v) => setGalleryDisplay(v === "carousel" ? "carousel" : "grid")}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="grid">Grelha</SelectItem>
                        <SelectItem value="carousel">Carrossel de imagens</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {galleryDisplay === "carousel" ? (
                    <div className="space-y-3 rounded-md border border-border/60 bg-muted/20 p-3">
                      <p className="text-xs font-medium text-foreground">Opções do carrossel</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-background/80 px-2 py-1.5">
                          <Label className="text-xs">Reprodução automática</Label>
                          <Switch
                            checked={galleryCarouselOpts.autoplay}
                            onCheckedChange={(v) =>
                              setGalleryCarouselOpts((prev) => ({ ...prev, autoplay: v }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Intervalo (ms)</Label>
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
                          <Label className="text-xs">Setas</Label>
                          <Switch
                            checked={galleryCarouselOpts.show_arrows}
                            onCheckedChange={(v) =>
                              setGalleryCarouselOpts((prev) => ({ ...prev, show_arrows: v }))
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-background/80 px-2 py-1.5">
                          <Label className="text-xs">Pontos (indicadores)</Label>
                          <Switch
                            checked={galleryCarouselOpts.show_dots}
                            onCheckedChange={(v) =>
                              setGalleryCarouselOpts((prev) => ({ ...prev, show_dots: v }))
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-background/80 px-2 py-1.5 sm:col-span-2">
                          <Label className="text-xs">Loop (voltar ao início)</Label>
                          <Switch
                            checked={galleryCarouselOpts.loop}
                            onCheckedChange={(v) =>
                              setGalleryCarouselOpts((prev) => ({ ...prev, loop: v }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Slides visíveis (desktop)</Label>
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
                          <Label className="text-xs">Slides visíveis (telemóvel)</Label>
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
                          <Label className="text-xs">Espaço entre slides (px)</Label>
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
                      Adicionar imagem
                    </Button>
                  </div>
                  {galleryItems.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sem imagens na galeria.</p>
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
                                aria-label="Subir na galeria"
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
                                aria-label="Descer na galeria"
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
                                <Label className="text-xs">URL da imagem (ou carregue do PC)</Label>
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
                                  Carregar do PC
                                </Button>
                              </div>
                              <Input
                                placeholder="https://… ou use «Carregar do PC»"
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
                                <div className="rounded-md border border-border/50 bg-muted/25 p-2">
                                  <img
                                    src={row.image_url}
                                    alt=""
                                    className="max-h-28 w-full object-contain object-left"
                                  />
                                </div>
                              ) : null}
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Nome (opcional)</Label>
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
                              <Label className="text-xs">Função (opcional)</Label>
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
                              <Label className="text-xs">Legenda (opcional)</Label>
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
                              <Label className="text-xs">Handle / rede (opcional)</Label>
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

              <p className="text-xs font-medium text-foreground">Rodapé legal</p>
              <Textarea
                placeholder="Linhas de texto (uma por linha): copyright, avisos…"
                value={legalLines}
                onChange={(e) => setLegalLines(e.target.value)}
                rows={3}
                className="resize-y text-sm"
              />
              {legalLinks.map((link, idx) => (
                <div key={idx} className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    placeholder="Texto do link"
                    value={link.label}
                    onChange={(e) =>
                      setLegalLinks((prev) =>
                        prev.map((l, i) => (i === idx ? { ...l, label: e.target.value } : l)),
                      )
                    }
                  />
                  <Input
                    placeholder="URL"
                    value={link.href}
                    onChange={(e) =>
                      setLegalLinks((prev) =>
                        prev.map((l, i) => (i === idx ? { ...l, href: e.target.value } : l)),
                      )
                    }
                  />
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Imagem de fundo do hero</Label>
              <p className="text-xs text-muted-foreground">JPG, PNG ou WebP até 2 MB.</p>
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
                  Carregar imagem
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
                Overlay, animação de entrada e efeitos na imagem — tudo configurável aqui, sem ferramentas externas.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Altura mínima — mobile (px)</Label>
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
                  <p className="text-[11px] text-muted-foreground">160–900 (padrão 220)</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Altura mínima — desktop (px)</Label>
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
                  <p className="text-[11px] text-muted-foreground">200–1200 (padrão 280)</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Imagem</Label>
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
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Recorte da imagem (foco)</Label>
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
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Overlay sobre a foto</Label>
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
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Intensidade do overlay</Label>
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
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Entrada do texto</Label>
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
                          {o.label}
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
                      Botão sobre o hero
                    </Label>
                    <p className="text-xs text-muted-foreground">Ex.: “Ver planos” com link para a grelha (#planos).</p>
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
                      <Label className="text-xs">Texto do botão</Label>
                      <Input
                        placeholder="Ver planos"
                        value={heroVisual.cta_label ?? ""}
                        onChange={(e) => setHeroVisual((p) => ({ ...p, cta_label: e.target.value }))}
                        maxLength={80}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Link (URL, /rota ou #planos)</Label>
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

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="pl-intro">Texto antes dos cartões (opcional)</Label>
              <Textarea
                id="pl-intro"
                rows={4}
                placeholder="Parágrafo curto acima da grelha de planos…"
                value={introText}
                onChange={(e) => setIntroText(e.target.value)}
                className="resize-y"
              />
              {MARKDOWN_HINT}
            </div>
            <div className="rounded-lg border border-border/60 p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Tipografia do texto introdutório</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Fonte</Label>
                  <Select value={introFont} onValueChange={setIntroFont}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_FONT.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Alinhamento</Label>
                  <Select value={introTextAlign} onValueChange={setIntroTextAlign}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_ALIGN.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tamanho</Label>
                  <Select value={introTextSize} onValueChange={setIntroTextSize}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_BODY.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pl-foot">Rodapé da secção (opcional)</Label>
              <Textarea
                id="pl-foot"
                rows={3}
                placeholder="Nota legal, garantias ou CTA final…"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                className="resize-y"
              />
              {MARKDOWN_HINT}
            </div>
            <div className="rounded-lg border border-border/60 p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Tipografia do rodapé</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Fonte</Label>
                  <Select value={footerFont} onValueChange={setFooterFont}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_FONT.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Alinhamento</Label>
                  <Select value={footerTextAlign} onValueChange={setFooterTextAlign}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_ALIGN.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tamanho</Label>
                  <Select value={footerTextSize} onValueChange={setFooterTextSize}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_BODY.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Type className="h-4 w-4 text-primary" />
                Etiquetas dos cartões de plano
              </p>
              <p className="text-xs text-muted-foreground">
                Moeda, textos das secções e botões na página pública (início <span className="font-medium text-foreground">/</span>). Guardar também aplica
                estas alterações.
              </p>
              <div className="grid max-h-[min(70vh,520px)] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                {PLAN_LABEL_FORM_FIELDS.map(({ key, title }) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-xs leading-tight" htmlFor={`plab-${key}`}>
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
                      className="h-9 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-muted/20 p-4 lg:min-h-[520px] lg:max-w-[min(100%,520px)] xl:max-w-none">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Pré-visualização ao vivo
            </div>
            <p className="mb-3 text-[11px] leading-snug text-muted-foreground">
              Ordem e conteúdo iguais à página pública (inclui secções, planos e rodapé legal). Botões de plano estão inativos aqui.
            </p>
            <div
              className={cn(
                "max-h-[min(75vh,1100px)] overflow-y-auto overflow-x-hidden rounded-lg border border-border/50",
                appearance === "sales_dark" ? "shadow-inner" : "bg-background/80",
              )}
            >
              <LandingPageThemeProvider value={appearance === "sales_dark" ? previewSalesThemed : null}>
                <div
                  className={cn("p-3", appearance === "sales_dark" && "min-h-[200px]")}
                  style={
                    appearance === "sales_dark"
                      ? {
                          backgroundColor: previewSalesThemed.page_background,
                          color: previewSalesThemed.heading_on_dark,
                        }
                      : undefined
                  }
                >
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
                    salesTone={appearance === "sales_dark"}
                    landingTheme={appearance === "sales_dark" ? landingTheme : null}
                    className={cn(
                      "mb-0 border-border/80 shadow-inner",
                      appearance === "sales_dark" ? "bg-white/[0.06]" : "bg-muted/20",
                    )}
                  />
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
                    <p className="mt-4 text-xs italic text-muted-foreground">Sem texto introdutório.</p>
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
                        "mt-6 rounded-md border border-dashed border-border/80 bg-muted/30 p-3",
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
                  <div className="mt-6">
                    <SalesLandingLegalFooter extras={previewExtras} />
                  </div>
                </div>
              </LandingPageThemeProvider>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <Card className="border-primary/15 shadow-sm">
      <Collapsible defaultOpen>
        <CardHeader className="border-b border-border/60 bg-muted/20">
          <CollapsibleTrigger className="group flex w-full items-start justify-between gap-3 text-left">
            <div className="min-w-0 space-y-1.5">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Video className="h-5 w-5 text-primary" />
                Blocos de conteúdo (vídeo, imagem, texto)
              </CardTitle>
              <CardDescription>
                Ordem de cima para baixo = ordem na página (após o texto introdutório). Vídeos e imagens em sequência aparecem{" "}
                <strong className="text-foreground/90">em fila (lado a lado)</strong>, com proporção 16:9 que se adapta ao
                ecrã; blocos de texto Markdown ocupam a largura completa. Vídeo: YouTube, Vimeo ou .mp4/.webm. Imagem: URL ou
                carregar do PC. Guarde
                com o botão do cartão principal ou abaixo.
              </CardDescription>
            </div>
            <ChevronDown className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
      <CardContent className="space-y-4 p-6">
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
                toast.error(error || "Não foi possível carregar a imagem.");
                return;
              }
              setContentBlocks((prev) =>
                prev.map((b, i) =>
                  i === idx && b.type === "image" ? { ...b, src: data.image_url } : b,
                ),
              );
              toast.success("Imagem carregada. Guarde a landing para persistir.");
            } finally {
              setContentBlockImageUploadBusy(false);
            }
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => addContentBlock("video")}
          >
            <Plus className="h-4 w-4" />
            Vídeo
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => addContentBlock("image")}
          >
            <Plus className="h-4 w-4" />
            Imagem
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => addContentBlock("rich_text")}
          >
            <Plus className="h-4 w-4" />
            <Type className="h-4 w-4" />
            Texto
          </Button>
        </div>

        {contentBlocks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum bloco. Adicione vídeo, imagem ou secções de texto para mostrar na landing.
          </p>
        ) : (
          <div className="space-y-4">
            {contentBlocks.map((block, index) => (
              <div
                key={`cb-${index}`}
                className="rounded-lg border border-border/80 bg-background/80 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {block.type === "video" ? (
                      <>
                        <Video className="h-3.5 w-3.5" /> Vídeo
                      </>
                    ) : block.type === "image" ? (
                      <>
                        <ImageIcon className="h-3.5 w-3.5" /> Imagem
                      </>
                    ) : (
                      <>
                        <Type className="h-3.5 w-3.5" /> Texto
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
                      aria-label="Mover para cima"
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
                      aria-label="Mover para baixo"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => removeContentBlock(index)}
                      aria-label="Remover bloco"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {block.type === "rich_text" ? (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Conteúdo (Markdown)</Label>
                      <Textarea
                        rows={8}
                        placeholder="Parágrafos, **negrito**, listas e [ligações](https://…)"
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
                        Vazio não é guardado. Cor vazio no texto = cores do tema escolhido na landing.
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Tipo de letra</Label>
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
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Tamanho</Label>
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
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Peso</Label>
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
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Alinhamento</Label>
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
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Cor do texto (opcional)</Label>
                        <Input
                          placeholder="ex.: #e2e8f0 ou rgba(255,255,255,0.9)"
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
                        <Label className="text-xs">Fundo da secção (opcional)</Label>
                        <Input
                          placeholder="ex.: rgba(0,0,0,0.25)"
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
                        <Label className="text-xs">Largura</Label>
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
                            <SelectItem value="contained">Contida (max. ~896px)</SelectItem>
                            <SelectItem value="wide">Larga (largura útil)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Título (opcional)</Label>
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
                        <Label className="text-xs">Subtítulo (opcional)</Label>
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
                        <Label className="text-xs">Largura</Label>
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
                            <SelectItem value="contained">Contida (max. ~896px)</SelectItem>
                            <SelectItem value="wide">Larga (largura útil)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {block.type === "video" ? (
                      <div className="space-y-1.5">
                        <Label className="text-xs">URL do vídeo</Label>
                        <Input
                          placeholder="https://www.youtube.com/watch?v=… ou https://…/video.mp4"
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
                            <Label className="text-xs">URL da imagem (ou carregue do PC)</Label>
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
                              Carregar do PC
                            </Button>
                          </div>
                          <Input
                            placeholder="https://… ou use «Carregar do PC»"
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
                            <div className="rounded-md border border-border/50 bg-muted/25 p-2">
                              <img
                                src={block.src}
                                alt=""
                                className="max-h-28 w-full object-contain object-left"
                              />
                            </div>
                          ) : null}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Texto alternativo (acessibilidade)</Label>
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
                            <Label className="text-xs">Legenda (opcional)</Label>
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
            ))}
          </div>
        )}

        <Button type="button" className="gap-2" disabled={saving} onClick={() => void saveTexts()}>
          <Save className="h-4 w-4" />
          Guardar landing
        </Button>
      </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
    </div>
  );
}
