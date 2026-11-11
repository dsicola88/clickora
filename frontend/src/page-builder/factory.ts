import { nanoid } from "nanoid";
import { readStoredAppLocale, translate, type MessageKey } from "@/i18n";
import type {
  ColumnNode,
  PageDocument,
  PagePopup,
  ResponsiveValue,
  SectionNode,
  SpacingValue,
  TypographyValue,
  WidgetInteraction,
  WidgetNode,
  WidgetType,
} from "./types";

export const id = (prefix = "") => `${prefix}${nanoid(8)}`;

/** User-visible seed copy, resolved when the widget or popup is created. */
function defaultText(key: MessageKey): string {
  return translate(readStoredAppLocale(), key);
}

const r = <T,>(v: T): ResponsiveValue<T> => ({ desktop: v });

/** Desktop + mobile (e tablet opcional) — já responsivo ao criar. */
const rm = <T,>(desktop: T, mobile: T, tablet?: T): ResponsiveValue<T> => ({
  desktop,
  ...(tablet !== undefined ? { tablet } : {}),
  mobile,
});

const spacing = (
  top = 0,
  right = 0,
  bottom = 0,
  left = 0,
  unit: SpacingValue["unit"] = "px",
): SpacingValue => ({ top, right, bottom, left, unit });

const typography = (overrides: Partial<TypographyValue> = {}): TypographyValue => ({
  fontSize: 16,
  fontWeight: 400,
  lineHeight: 1.5,
  letterSpacing: 0,
  textAlign: "left",
  textTransform: "none",
  fontStyle: "normal",
  textDecoration: "none",
  wordSpacing: 0,
  ...overrides,
});

export function createColumn(widthPercent = 100): ColumnNode {
  return {
    id: id("col_"),
    widthPercent: { desktop: widthPercent, tablet: 100, mobile: 100 },
    styles: {
      padding: rm(spacing(10, 10, 10, 10), spacing(8, 8, 8, 8)),
    },
    widgets: [],
  };
}

export function createSection(columnCount = 1): SectionNode {
  const width = Math.floor(100 / columnCount);
  const multi = columnCount > 1;
  return {
    id: id("sec_"),
    layout: "boxed",
    contentWidth: 1140,
    columnGap: rm(20, 16, 18),
    styles: {
      padding: rm(spacing(60, 20, 60, 20), spacing(36, 16, 36, 16), spacing(48, 18, 48, 18)),
    },
    columns: Array.from({ length: columnCount }, () => {
      const col = createColumn(width);
      col.widthPercent = {
        desktop: width,
        tablet: multi ? 100 : width,
        mobile: 100,
      };
      return col;
    }),
  };
}

const widgetDefaults: Record<WidgetType, () => Pick<WidgetNode, "content" | "styles">> = {
  heading: () => ({
    content: { text: defaultText("pages.pageBuilder.defaults.headingText"), tag: "h2" },
    styles: {
      typography: rm(
        typography({ fontSize: 36, fontWeight: 700, lineHeight: 1.2 }),
        typography({ fontSize: 26, fontWeight: 700, lineHeight: 1.25 }),
        typography({ fontSize: 32, fontWeight: 700, lineHeight: 1.2 }),
      ),
      color: "#1a1a1a",
      margin: rm(spacing(0, 0, 16, 0), spacing(0, 0, 12, 0)),
    },
  }),
  text: () => ({
    content: {
      html: defaultText("pages.pageBuilder.defaults.textHtml"),
    },
    styles: {
      typography: rm(
        typography({ fontSize: 16, lineHeight: 1.7 }),
        typography({ fontSize: 15, lineHeight: 1.65 }),
      ),
      color: "#4a4a4a",
      margin: rm(spacing(0, 0, 16, 0), spacing(0, 0, 12, 0)),
    },
  }),
  image: () => ({
    content: {
      src: "",
      alt: defaultText("pages.pageBuilder.defaults.imageAlt"),
      link: "",
    },
    styles: {
      align: r("center" as const),
      width: r("100%"),
    },
  }),
  button: () => ({
    content: { text: defaultText("pages.pageBuilder.defaults.buttonText"), href: "#", target: "_self" },
    styles: {
      typography: rm(
        typography({ fontSize: 16, fontWeight: 600, textAlign: "center" }),
        typography({ fontSize: 15, fontWeight: 600, textAlign: "center" }),
      ),
      color: "#ffffff",
      background: "#e63946",
      padding: rm(spacing(14, 28, 14, 28), spacing(12, 20, 12, 20)),
      border: { width: 0, style: "solid", color: "#000000", radius: 6 },
      align: r("center" as const),
    },
  }),
  video: () => ({
    content: {
      provider: "youtube",
      url: "",
      autoplay: false,
      controls: true,
    },
    styles: {},
  }),
  spacer: () => ({
    content: {},
    styles: { height: rm("50px", "28px", "40px") },
  }),
  icon: () => ({
    content: { name: "star", size: 48 },
    styles: { color: "#e63946", align: r("center" as const) },
  }),
  divider: () => ({
    content: { style: "solid", weight: 1 },
    styles: {
      color: "#e0e0e0",
      margin: r(spacing(16, 0, 16, 0)),
      width: r("100%"),
    },
  }),
  html: () => ({
    content: { code: defaultText("pages.pageBuilder.defaults.htmlCustom") },
    styles: {},
  }),
  form: () => ({
    content: {
      fields: [
        {
          id: id("f_"),
          type: "text",
          name: "name",
          label: defaultText("pages.pageBuilder.defaults.formNameLabel"),
          placeholder: defaultText("pages.pageBuilder.defaults.formNamePlaceholder"),
          required: true,
        },
        {
          id: id("f_"),
          type: "email",
          name: "email",
          label: defaultText("pages.pageBuilder.defaults.formEmailLabel"),
          placeholder: defaultText("pages.pageBuilder.defaults.formEmailPlaceholder"),
          required: true,
        },
      ],
      submitText: defaultText("pages.pageBuilder.defaults.formSubmit"),
      successMessage: defaultText("pages.pageBuilder.defaults.formSuccess"),
      errorMessage: defaultText("pages.pageBuilder.defaults.formError"),
      webhookUrl: "",
      redirectUrl: "",
      fieldGap: 12,
      buttonBg: "#e63946",
      buttonColor: "#ffffff",
      buttonRadius: 6,
      inputBg: "#ffffff",
      inputBorderColor: "#d0d5dd",
      inputRadius: 6,
      labelColor: "#1a1a1a",
    },
    styles: {
      padding: r(spacing(0, 0, 0, 0)),
    },
  }),
  testimonials: () => ({
    content: {
      items: [
        {
          id: id("t_"),
          name: "Ana Silva",
          role: defaultText("pages.pageBuilder.defaults.testimonial1Role"),
          avatar: "",
          quote: defaultText("pages.pageBuilder.defaults.testimonial1Quote"),
          rating: 5,
        },
        {
          id: id("t_"),
          name: "Carlos Mendes",
          role: defaultText("pages.pageBuilder.defaults.testimonial2Role"),
          avatar: "",
          quote: defaultText("pages.pageBuilder.defaults.testimonial2Quote"),
          rating: 5,
        },
        {
          id: id("t_"),
          name: "Joana Costa",
          role: defaultText("pages.pageBuilder.defaults.testimonial3Role"),
          avatar: "",
          quote: defaultText("pages.pageBuilder.defaults.testimonial3Quote"),
          rating: 5,
        },
      ],
      autoplay: true,
      intervalMs: 5000,
      showStars: true,
      showAvatars: true,
      cardBg: "#ffffff",
      textColor: "#1a1a1a",
      accentColor: "#f59e0b",
    },
    styles: {
      padding: r(spacing(20, 0, 20, 0)),
    },
  }),
  faq: () => ({
    content: {
      items: [
        {
          id: id("q_"),
          question: defaultText("pages.pageBuilder.defaults.faq1Q"),
          answer: defaultText("pages.pageBuilder.defaults.faq1A"),
        },
        {
          id: id("q_"),
          question: defaultText("pages.pageBuilder.defaults.faq2Q"),
          answer: defaultText("pages.pageBuilder.defaults.faq2A"),
        },
        {
          id: id("q_"),
          question: defaultText("pages.pageBuilder.defaults.faq3Q"),
          answer: defaultText("pages.pageBuilder.defaults.faq3A"),
        },
      ],
      allowMultiple: false,
      defaultOpen: 0,
      itemBg: "#ffffff",
      itemBorderColor: "#e5e7eb",
      questionColor: "#111827",
      answerColor: "#4b5563",
      accentColor: "#38bdf8",
    },
    styles: {
      padding: r(spacing(0, 0, 0, 0)),
    },
  }),
  countdown: () => ({
    content: {
      deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      showLabels: true,
      showDays: true,
      expiredMessage: defaultText("pages.pageBuilder.defaults.countdownExpired"),
      digitBg: "#0f172a",
      digitColor: "#ffffff",
      labelColor: "#475569",
      separatorColor: "#0f172a",
      digitSize: 48,
    },
    styles: {
      padding: r(spacing(20, 0, 20, 0)),
    },
  }),
  gallery: () => ({
    content: {
      /** Sem imagens de exemplo — o utilizador adiciona URL ou upload do PC no painel. */
      images: [],
      columns: 3,
      gap: 12,
      borderRadius: 8,
      enableLightbox: true,
      aspectRatio: "square",
      layout: "grid",
      carouselAutoplay: true,
      carouselIntervalMs: 4500,
      carouselShowDots: true,
      carouselShowArrows: true,
      carouselSlidesDesktop: 3,
      carouselSlidesTablet: 2,
      carouselSlidesMobile: 1,
      carouselSlidesToScroll: 1,
      carouselObjectFit: "contain",
      carouselThumbWidthPx: 0,
      carouselTransitionMs: 450,
      carouselPauseOnHover: true,
    },
    styles: {
      padding: r(spacing(0, 0, 0, 0)),
    },
  }),
  imageCarousel: () => {
    const base = widgetDefaults.gallery();
    return {
      content: {
        ...base.content,
        layout: "carousel",
        carouselThumbWidthPx: 150,
        carouselSlidesDesktop: 4,
        carouselSlidesTablet: 3,
        carouselSlidesMobile: 2,
        carouselObjectFit: "contain",
        carouselTransitionMs: 500,
        carouselPauseOnHover: true,
      },
      styles: { ...base.styles },
    };
  },
  animatedHeadline: () => ({
    content: {
      prefix: defaultText("pages.pageBuilder.defaults.animatedPrefix"),
      rotatingWords: [
        defaultText("pages.pageBuilder.defaults.animatedWord1"),
        defaultText("pages.pageBuilder.defaults.animatedWord2"),
        defaultText("pages.pageBuilder.defaults.animatedWord3"),
      ],
      suffix: defaultText("pages.pageBuilder.defaults.animatedSuffix"),
      animation: "fade",
      intervalMs: 2200,
      tag: "h2",
      highlightColor: "#e63946",
    },
    styles: {
      typography: rm(
        typography({ fontSize: 40, fontWeight: 800, lineHeight: 1.2, textAlign: "center" }),
        typography({ fontSize: 28, fontWeight: 800, lineHeight: 1.25, textAlign: "center" }),
        typography({ fontSize: 34, fontWeight: 800, lineHeight: 1.2, textAlign: "center" }),
      ),
      color: "#0f172a",
      margin: rm(spacing(0, 0, 16, 0), spacing(0, 0, 12, 0)),
    },
  }),
  livePlans: () => ({
    content: {
      sectionLabel: defaultText("pages.pageBuilder.defaults.livePlansLabel"),
      title: defaultText("pages.pageBuilder.defaults.livePlansTitle"),
      subtitle: defaultText("pages.pageBuilder.defaults.livePlansSubtitle"),
      showHeader: true,
      accentColor: "#38bdf8",
      cardBg: "#ffffff",
      textColor: "#0f172a",
      ctaBg: "#e63946",
      ctaColor: "#ffffff",
    },
    styles: {
      padding: r(spacing(8, 0, 8, 0)),
    },
  }),
  priceTable: () => ({
    content: {
      badge: defaultText("pages.pageBuilder.defaults.mostPopular"),
      title: "Pro",
      subtitle: defaultText("pages.pageBuilder.defaults.priceSubtitle"),
      currency: "R$",
      price: "97",
      period: defaultText("pages.pageBuilder.livePlans.perMonth"),
      features: [
        { id: id("pf_"), text: defaultText("pages.pageBuilder.defaults.featureAllBasic"), included: true },
        { id: id("pf_"), text: defaultText("pages.pageBuilder.defaults.featureUnlimitedPages"), included: true },
        { id: id("pf_"), text: defaultText("pages.pageBuilder.defaults.featurePrioritySupport"), included: true },
        { id: id("pf_"), text: defaultText("pages.pageBuilder.defaults.featureCustomDomain"), included: true },
        { id: id("pf_"), text: defaultText("pages.pageBuilder.defaults.featureApi"), included: false },
      ],
      ctaText: defaultText("pages.pageBuilder.defaults.ctaSubscribePro"),
      ctaHref: "#",
      highlighted: true,
      cardBg: "#ffffff",
      textColor: "#1a1a1a",
      accentColor: "#38bdf8",
      ctaBg: "#e63946",
      ctaColor: "#ffffff",
      borderRadius: 12,
    },
    styles: {
      padding: r(spacing(20, 0, 20, 0)),
    },
  }),
  ctaBox: () => ({
    content: {
      title: defaultText("pages.pageBuilder.defaults.ctaTitle"),
      description: defaultText("pages.pageBuilder.defaults.ctaDescription"),
      primaryText: defaultText("pages.pageBuilder.defaults.ctaPrimary"),
      primaryHref: "#",
      secondaryText: defaultText("pages.pageBuilder.defaults.ctaSecondary"),
      secondaryHref: "#",
      layout: "centered",
      background: "#0f172a",
      gradient: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
      textColor: "#ffffff",
      primaryBg: "#e63946",
      primaryColor: "#ffffff",
      borderRadius: 16,
      imageUrl: "",
    },
    styles: {
      padding: r(spacing(0, 0, 0, 0)),
    },
  }),
  flipBox: () => ({
    content: {
      frontTitle: defaultText("pages.pageBuilder.defaults.flipFrontTitle"),
      frontSubtitle: defaultText("pages.pageBuilder.defaults.flipFrontSubtitle"),
      frontIcon: "✨",
      frontBg: "#1f2937",
      frontTextColor: "#ffffff",
      backTitle: defaultText("pages.pageBuilder.defaults.flipBackTitle"),
      backDescription: defaultText("pages.pageBuilder.defaults.flipBackDescription"),
      backCtaText: defaultText("pages.pageBuilder.defaults.flipBackCta"),
      backCtaHref: "#",
      backBg: "#e63946",
      backTextColor: "#ffffff",
      backCtaBg: "#ffffff",
      backCtaColor: "#e63946",
      height: 280,
      borderRadius: 12,
      trigger: "hover",
      flipDirection: "horizontal",
    },
    styles: {
      padding: r(spacing(0, 0, 0, 0)),
    },
  }),
  progressTracker: () => ({
    content: {
      items: [
        { id: id("pb_"), label: defaultText("pages.pageBuilder.defaults.progressDesign"), value: 90 },
        { id: id("pb_"), label: defaultText("pages.pageBuilder.defaults.progressDev"), value: 75 },
        { id: id("pb_"), label: defaultText("pages.pageBuilder.defaults.progressMarketing"), value: 60 },
        { id: id("pb_"), label: defaultText("pages.pageBuilder.defaults.progressSales"), value: 85 },
      ],
      variant: "bar",
      showPercent: true,
      animate: true,
      trackColor: "#e5e7eb",
      fillColor: "#e63946",
      labelColor: "#1a1a1a",
      height: 10,
      gap: 20,
      borderRadius: 999,
    },
    styles: {
      padding: r(spacing(20, 0, 20, 0)),
    },
  }),
  alert: () => ({
    content: {
      variant: "info",
      title: defaultText("pages.pageBuilder.defaults.alertTitle"),
      message: defaultText("pages.pageBuilder.defaults.alertMessage"),
      showIcon: true,
      dismissible: false,
      borderRadius: 10,
    },
    styles: {
      margin: r(spacing(0, 0, 16, 0)),
    },
  }),
  tabs: () => ({
    content: {
      tabs: [
        {
          id: id("tab_"),
          label: defaultText("pages.pageBuilder.defaults.tabBenefits"),
          html: defaultText("pages.pageBuilder.defaults.tabBenefitsHtml"),
        },
        {
          id: id("tab_"),
          label: defaultText("pages.pageBuilder.defaults.tabHow"),
          html: defaultText("pages.pageBuilder.defaults.tabHowHtml"),
        },
        {
          id: id("tab_"),
          label: defaultText("pages.pageBuilder.defaults.tabGuarantee"),
          html: defaultText("pages.pageBuilder.defaults.tabGuaranteeHtml"),
        },
      ],
      tabBg: "#f1f5f9",
      tabActiveBg: "#ffffff",
      tabTextColor: "#64748b",
      tabActiveTextColor: "#0f172a",
      accentColor: "#38bdf8",
      panelBg: "#ffffff",
      panelTextColor: "#334155",
      borderColor: "#e2e8f0",
      borderRadius: 12,
    },
    styles: {
      margin: r(spacing(0, 0, 20, 0)),
    },
  }),
  socialIcons: () => ({
    content: {
      items: [
        { id: id("soc_"), network: "instagram", url: "https://instagram.com" },
        { id: id("soc_"), network: "facebook", url: "https://facebook.com" },
        { id: id("soc_"), network: "youtube", url: "https://youtube.com" },
      ],
      iconSize: 22,
      gap: 16,
      variant: "filled",
      iconBg: "#0f172a",
      iconColor: "#ffffff",
    },
    styles: {
      align: r("center" as const),
      padding: r(spacing(12, 0, 12, 0)),
    },
  }),
  iconList: () => ({
    content: {
      items: [
        {
          id: id("il_"),
          iconName: "check",
          title: defaultText("pages.pageBuilder.defaults.iconListFastTitle"),
          description: defaultText("pages.pageBuilder.defaults.iconListFastDesc"),
          href: "",
        },
        {
          id: id("il_"),
          iconName: "shield",
          title: defaultText("pages.pageBuilder.defaults.iconListSecureTitle"),
          description: defaultText("pages.pageBuilder.defaults.iconListSecureDesc"),
          href: "",
        },
        {
          id: id("il_"),
          iconName: "headphones",
          title: defaultText("pages.pageBuilder.defaults.iconListSupportTitle"),
          description: defaultText("pages.pageBuilder.defaults.iconListSupportDesc"),
          href: "",
        },
      ],
      iconSize: 22,
      iconColor: "#e63946",
      iconShape: "circle",
      gap: 16,
      titleColor: "#0f172a",
      descColor: "#64748b",
    },
    styles: {
      padding: r(spacing(0, 0, 0, 0)),
    },
  }),
  lottie: () => ({
    content: {
      src: "",
      loop: true,
      autoplay: true,
      speed: 1,
      width: 280,
    },
    styles: {
      align: r("center"),
      margin: r(spacing(0, 0, 16, 0)),
    },
  }),
  offCanvas: () => ({
    content: {
      side: "right",
      width: 340,
      buttonLabel: defaultText("pages.pageBuilder.defaults.offCanvasButton"),
      html: defaultText("pages.pageBuilder.defaults.offCanvasHtml"),
      panelBg: "#0f172a",
      panelColor: "#f8fafc",
      buttonBg: "#e63946",
      buttonColor: "#ffffff",
      position: "bottom-right",
    },
    styles: { margin: r(spacing(0, 0, 0, 0)) },
  }),
  shareButtons: () => ({
    content: {
      networks: ["whatsapp", "facebook", "twitter", "copy"],
      text: defaultText("pages.pageBuilder.defaults.shareText"),
      url: "",
      buttonBg: "#0f172a",
      buttonColor: "#ffffff",
      gap: 8,
    },
    styles: {
      align: r("center"),
      margin: r(spacing(0, 0, 16, 0)),
    },
  }),
  tableOfContents: () => ({
    content: {
      title: defaultText("pages.pageBuilder.defaults.tocTitle"),
      auto: true,
      items: [],
      linkColor: "#0f172a",
      hoverColor: "#e63946",
    },
    styles: {
      padding: r(spacing(16, 16, 16, 16)),
      background: "#f8fafc",
      margin: r(spacing(0, 0, 16, 0)),
    },
  }),
  cookieBanner: () => ({
    content: {
      title: "Cookie Policy",
      body: 'This site uses cookies to personalize content and ads, provide social media features, and analyze our traffic. By clicking "Allow", you agree to the use of cookies. For more information, visit our',
      allowLabel: "Allow",
      declineLabel: "Close",
      policyLabel: "Cookie Policy",
      policyUrl: "/privacidade",
      accentColor: "#22c55e",
      variant: "modal",
      backdrop: true,
      followLanguage: false,
      footerNote: "Your privacy matters to us.",
      overlayOpacity: 12,
      overlayBlur: 0,
      position: "center",
      animation: "fadeUp",
      animationDurationMs: 320,
      delayMs: 0,
      maxWidthPx: 420,
      offsetXPx: 20,
      offsetYPx: 20,
      showCloseButton: false,
      storageKey: "clickora-cookie-banner",
    },
    styles: {
      margin: r(spacing(0, 0, 0, 0)),
    },
  }),
  backToTop: () => ({
    content: {
      threshold: 300,
      position: "right",
      bg: "#0f172a",
      color: "#ffffff",
      size: 48,
      shape: "circle",
    },
    styles: { margin: r(spacing(0, 0, 0, 0)) },
  }),
  readingProgress: () => ({
    content: {
      height: 4,
      bg: "transparent",
      fillColor: "#e63946",
      position: "top",
    },
    styles: { margin: r(spacing(0, 0, 0, 0)) },
  }),
  stickyVideo: () => ({
    content: {
      url: "",
      position: "bottom-right",
      width: 320,
      aspectRatio: "16/9",
      borderRadius: 8,
      showCloseButton: true,
      inlineHeight: 360,
    },
    styles: { margin: r(spacing(0, 0, 16, 0)) },
  }),
  phoneCall: () => ({
    content: {
      number: "+351910000000",
      displayText: defaultText("pages.pageBuilder.defaults.phoneCallText"),
      variant: "button",
      bg: "#10b981",
      color: "#ffffff",
      borderRadius: 8,
      showIcon: true,
      fontSize: 16,
      position: "right",
    },
    styles: { align: r("center" as const), margin: r(spacing(0, 0, 16, 0)) },
  }),
  dateWidget: () => ({
    content: {
      source: "now",
      fixedDate: "",
      format: "long",
      locale: "pt-BR",
      prefix: "",
      suffix: "",
      fontSize: 16,
      color: "#0f172a",
      fontWeight: 500,
    },
    styles: { margin: r(spacing(0, 0, 12, 0)) },
  }),
  navMenu: () => ({
    content: {
      items: [
        { id: id("nav_"), label: defaultText("pages.pageBuilder.defaults.navHome"), href: "#" },
        { id: id("nav_"), label: defaultText("pages.pageBuilder.defaults.navBenefits"), href: "#beneficios" },
        { id: id("nav_"), label: defaultText("pages.pageBuilder.defaults.navContact"), href: "#contato" },
      ],
      layout: "horizontal",
      align: "center",
      pointer: "underline",
      color: "#0f172a",
      hoverColor: "#e63946",
      activeColor: "#e63946",
      fontSize: 15,
      fontWeight: 500,
      gap: 24,
      itemPaddingX: 4,
      itemPaddingY: 6,
      underlineOnHover: true,
      submenuBg: "#ffffff",
      submenuColor: "#0f172a",
      submenuHoverColor: "#e63946",
      submenuMinWidth: 180,
      mobileBreakpoint: 767,
      mobileAlign: "left",
      toggleColor: "#0f172a",
      toggleSize: 28,
      stickyMode: "none",
    },
    styles: { padding: r(spacing(8, 0, 8, 0)) },
  }),
  ticker: () => ({
    content: {
      items: [
        defaultText("pages.pageBuilder.defaults.tickerShip"),
        defaultText("pages.pageBuilder.defaults.tickerGuarantee"),
        defaultText("pages.pageBuilder.defaults.tickerPay"),
      ],
      speed: 25,
      direction: "left",
      separator: "•",
      fontSize: 15,
      color: "#334155",
      bg: "#f1f5f9",
      paddingY: 10,
      gap: 36,
    },
    styles: { margin: r(spacing(0, 0, 0, 0)) },
  }),
  infoBox: () => ({
    content: {
      iconName: "sparkles",
      iconColor: "#e63946",
      iconBg: "#fef2f2",
      iconShape: "circle",
      title: defaultText("pages.pageBuilder.defaults.infoBoxTitle"),
      description: defaultText("pages.pageBuilder.defaults.infoBoxDesc"),
      ctaText: defaultText("pages.pageBuilder.defaults.infoBoxCta"),
      ctaHref: "#",
      layout: "stacked",
      align: "center",
      titleColor: "#0f172a",
      descColor: "#475569",
      ctaColor: "#e63946",
      bg: "transparent",
      borderRadius: 0,
    },
    styles: { padding: r(spacing(12, 12, 12, 12)) },
  }),
  imageBox: () => ({
    content: {
      src: "",
      alt: defaultText("pages.pageBuilder.defaults.imageAlt"),
      title: defaultText("pages.pageBuilder.defaults.imageBoxTitle"),
      description: defaultText("pages.pageBuilder.defaults.imageBoxDesc"),
      href: "",
      titleColor: "#0f172a",
      descColor: "#64748b",
      imageHeight: 200,
      objectFit: "cover",
    },
    styles: { padding: r(spacing(0, 0, 0, 0)), margin: r(spacing(0, 0, 16, 0)) },
  }),
  starRating: () => ({
    content: {
      rating: 4.8,
      max: 5,
      size: 22,
      color: "#f59e0b",
      emptyColor: "#e5e7eb",
      showScore: true,
      title: defaultText("pages.pageBuilder.defaults.starRatingTitle"),
    },
    styles: {
      align: r("left" as const),
      margin: r(spacing(0, 0, 12, 0)),
    },
  }),
  counter: () => ({
    content: {
      start: 0,
      end: 1250,
      durationMs: 1600,
      prefix: "",
      suffix: "+",
      title: defaultText("pages.pageBuilder.defaults.counterTitle"),
      numberColor: "#0f172a",
      titleColor: "#64748b",
    },
    styles: {
      align: r("center" as const),
      padding: r(spacing(8, 8, 8, 8)),
      margin: r(spacing(0, 0, 16, 0)),
    },
  }),
  googleMaps: () => ({
    content: {
      query: "Lisboa, Portugal",
      zoom: 14,
      height: 320,
      embedUrl: "",
    },
    styles: {
      margin: r(spacing(0, 0, 16, 0)),
      border: { width: 0, style: "solid", color: "#000000", radius: 8 },
    },
  }),
  menuAnchor: () => ({
    content: { anchorId: "oferta" },
    styles: { margin: r(spacing(0, 0, 0, 0)), padding: r(spacing(0, 0, 0, 0)) },
  }),
  container: () => ({
    content: {
      direction: "row",
      justify: "flex-start",
      align: "center",
      /** wrap evita overflow no telemóvel (logo + menu + CTA). */
      wrap: "wrap",
      gap: 16,
      widgets: [],
    },
    styles: {
      padding: r(spacing(0, 0, 0, 0)),
      margin: r(spacing(0, 0, 0, 0)),
      width: r("100%"),
    },
  }),
};

export function createWidget(type: WidgetType): WidgetNode {
  const defaults = widgetDefaults[type]();
  return {
    id: id("w_"),
    type,
    ...defaults,
  };
}

export function createEmptyPage(name = defaultText("pages.pageBuilder.defaults.emptyPageName")): PageDocument {
  return {
    id: id("page_"),
    name,
    sections: [],
    settings: { maxContentWidth: 1140, background: "#ffffff" },
    popups: [],
    updatedAt: Date.now(),
  };
}

export function createPagePopup(name = defaultText("pages.pageBuilder.popups.new")): PagePopup {
  return {
    id: id("pop_"),
    name,
    enabled: true,
    trigger: "onLoad",
    delayMs: 800,
    oncePerSession: true,
    backdrop: true,
    backdropClose: true,
    backdropOpacity: 55,
    maxWidthPx: 480,
    displayMode: "modal",
    position: "center",
    animation: "fadeUp",
    animationDurationMs: 320,
    showCloseButton: true,
    offsetXPx: 16,
    offsetYPx: 16,
    borderRadiusPx: 16,
    zIndex: 99990,
    title: defaultText("pages.pageBuilder.defaults.popupTitle"),
    html: `<p>${defaultText("pages.pageBuilder.defaults.popupBody")}</p>`,
    ctaLabel: defaultText("pages.pageBuilder.defaults.popupCta"),
    ctaHref: "#",
    background: "#ffffff",
    textColor: "#0f172a",
    ctaBg: "#e63946",
    ctaColor: "#ffffff",
  };
}

export function createWidgetInteraction(
  partial: Partial<WidgetInteraction> = {},
): WidgetInteraction {
  return {
    id: id("ix_"),
    trigger: "click",
    action: "openUrl",
    url: "",
    ...partial,
  };
}
