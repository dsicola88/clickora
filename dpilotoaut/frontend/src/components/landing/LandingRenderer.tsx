import { createElement, type CSSProperties, type ReactNode } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LandingCountdown } from "@/components/landing/LandingCountdown";
import { buildScopedStylesheet } from "@/lib/landing-css";
import { formatLandingCurrency, normalizeCurrencyCode } from "@/lib/landing-currency";
import { embedVideoFromUrl, isHttpsEmbeddableUrl } from "@/lib/landing-embed";
import { isAllowedFormAction } from "@/lib/landing-form-action";
import { cn } from "@/lib/utils";
import {
  computePlanPrices,
  getDefaultFreeTrialSettings,
  type LandingDocument,
  type LandingWidgetUi,
  type PricingFreeTrialSettings,
  type SectionNode,
  type WidgetNode,
} from "@/lib/landing-document";

const bgMap: Record<string, string> = {
  default: "bg-background",
  muted: "bg-muted/50",
  primary: "bg-primary text-primary-foreground",
  dark: "bg-zinc-950 text-zinc-50",
  custom: "",
};

const paddingMap: Record<string, string> = {
  none: "py-0",
  sm: "py-6",
  md: "py-10",
  lg: "py-16",
  xl: "py-24",
};

const alignMap: Record<string, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

function boxMarginFromUi(
  ui: LandingWidgetUi | { marginTop?: number; marginBottom?: number } | undefined,
): CSSProperties {
  if (!ui) return {};
  const s: CSSProperties = {};
  if (ui.marginTop != null) s.marginTop = ui.marginTop;
  if (ui.marginBottom != null) s.marginBottom = ui.marginBottom;
  return s;
}

/** No editor, permite clicar na pré-visualização para escolher o bloco; links/botões não navegam. */
export type LandingRendererEditorMode = {
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function LandingRenderer({
  doc,
  theme,
  editor,
}: {
  doc: LandingDocument;
  theme: Record<string, unknown> | null;
  /** Só no painel de edição: clique = selecionar bloco. */
  editor?: LandingRendererEditorMode | null;
}) {
  const primary = typeof theme?.primary === "string" ? theme.primary : "hsl(var(--primary))";
  const maxW = typeof theme?.contentWidth === "string" ? theme.contentWidth : "max-w-5xl";

  return (
    <div
      className="lp-page min-h-screen w-full min-w-0 max-w-full overflow-x-hidden"
      style={
        {
          ["--lp-primary" as string]: primary,
        } as CSSProperties
      }
    >
      {doc.customCss ? <style dangerouslySetInnerHTML={{ __html: doc.customCss }} /> : null}
      {doc.sections.map((s) => (
        <SectionView key={s.id} section={s} maxW={maxW} editor={editor} />
      ))}
    </div>
  );
}

function SectionView({
  section,
  maxW,
  editor,
}: {
  section: SectionNode;
  maxW: string;
  editor?: LandingRendererEditorMode | null;
}) {
  const s = section.settings;
  const bg = s?.background === "custom" && s?.customBg ? { background: s.customBg } : undefined;
  const tc = String(s?.textColor ?? "").trim();
  const textStyle: CSSProperties | undefined = tc ? { color: tc } : undefined;
  const secSel = `[data-lp-sec="${section.id}"]`;
  const secCss = String(s?.customCss ?? "").trim();
  const sui = s?.ui;
  const isSecSel = editor != null && editor.selectedId === section.id;
  return (
    <section
      data-lp-sec={section.id}
      className={cn(
        bgMap[s?.background ?? "default"] ?? bgMap.default,
        paddingMap[s?.paddingY ?? "md"] ?? paddingMap.md,
        s?.fullBleed ? "" : "",
        String(s?.htmlClass ?? "").trim() || undefined,
        editor && "cursor-pointer",
        isSecSel && "ring-2 ring-dashed ring-primary/40 ring-inset",
      )}
      style={{ ...bg, ...textStyle, ...boxMarginFromUi(sui) }}
      onClick={
        editor
          ? (e) => {
              e.stopPropagation();
              editor.onSelect(section.id);
            }
          : undefined
      }
    >
      {secCss ? <style dangerouslySetInnerHTML={{ __html: buildScopedStylesheet(secSel, secCss) }} /> : null}
      <div className={cn("mx-auto w-full min-w-0 max-w-full px-4 sm:px-6", s?.fullBleed ? "w-full" : maxW)}>
        {section.children.map((w) => (
          <WidgetView key={w.id} w={w} editor={editor} />
        ))}
      </div>
    </section>
  );
}

function WidgetView({ w, editor }: { w: WidgetNode; editor?: LandingRendererEditorMode | null }) {
  const ui = w.settings.ui as LandingWidgetUi | undefined;
  const a = (w.settings.align as string) || "left";
  const ac = alignMap[a] ?? "text-left";
  const typo = (o: Record<string, string | undefined>): CSSProperties => {
    const s: CSSProperties = {};
    if (o.fontSize) s.fontSize = o.fontSize;
    if (o.lineHeight) s.lineHeight = o.lineHeight;
    if (o.fontWeight) s.fontWeight = o.fontWeight;
    if (o.color) s.color = o.color;
    if (o.letterSpacing) s.letterSpacing = o.letterSpacing;
    return s;
  };
  let inner: ReactNode;
  switch (w.type) {
    case "hero": {
      const t = w.settings.title as string;
      const st = w.settings.subtitle as string;
      const titleS: CSSProperties = {
        ...typo({
          fontSize: ui?.titleFontSize,
          color: ui?.titleColor,
          fontWeight: ui?.titleFontWeight,
        }),
      };
      const subS: CSSProperties = { ...typo({ fontSize: ui?.subtitleFontSize, color: ui?.subtitleColor }) };
      const ctaJustify =
        a === "right" ? "justify-end" : a === "left" ? "justify-start" : "justify-center";
      inner = (
        <div className={cn("mb-8 w-full min-w-0 max-w-full space-y-4", ac)}>
          {t && (
            <h1
              className="text-balance break-words text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl"
              style={titleS}
            >
              {t}
            </h1>
          )}
          {st && (
            <p className="text-pretty break-words text-lg text-muted-foreground sm:text-xl" style={subS}>
              {st}
            </p>
          )}
          <div className={cn("flex flex-wrap gap-3 pt-2", ctaJustify)}>
            {String(w.settings.primaryCtaLabel ?? "") !== "" ? (
              <Button size="lg" asChild>
                <a href={String(w.settings.primaryCtaHref ?? "/auth/sign-up")}>
                  {String(w.settings.primaryCtaLabel)}
                </a>
              </Button>
            ) : null}
            {String(w.settings.secondaryCtaLabel ?? "") !== "" ? (
              <Button size="lg" variant="outline" asChild>
                <a href={String(w.settings.secondaryCtaHref ?? "/auth/sign-in")}>
                  {String(w.settings.secondaryCtaLabel)}
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      );
      break;
    }
    case "heading": {
      const lv = Math.min(6, Math.max(1, Number(w.settings.level) || 2));
      const T = w.settings.text as string;
      const st = typo({
        fontSize: ui?.fontSize,
        lineHeight: ui?.lineHeight,
        fontWeight: ui?.fontWeight,
        color: ui?.color,
        letterSpacing: ui?.letterSpacing,
      });
      const sizeC =
        lv === 1
          ? "text-3xl"
          : lv === 2
            ? "text-2xl"
            : lv === 3
              ? "text-xl"
              : lv === 4
                ? "text-lg"
                : "text-base";
      const C = { className: cn("mb-3 font-bold tracking-tight", sizeC, ac), style: st };
      const tags = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;
      const Tag = tags[lv - 1] ?? "h2";
      inner = createElement(Tag, { ...C }, T);
      break;
    }
    case "text": {
      const b = String(w.settings.body ?? "");
      const st = typo({
        fontSize: ui?.fontSize,
        lineHeight: ui?.lineHeight,
        fontWeight: ui?.fontWeight,
        color: ui?.color,
        letterSpacing: ui?.letterSpacing,
      });
      const looksLikeHtml = /<[a-z][\s\S]*>/i.test(b);
      inner = looksLikeHtml ? (
        <div
          className={cn("lp-text-html mb-4 max-w-none text-sm text-muted-foreground [&_a]:text-primary [&_a]:underline", ac)}
          style={st}
          dangerouslySetInnerHTML={{ __html: b }}
        />
      ) : (
        <p className={cn("mb-4 text-muted-foreground whitespace-pre-wrap", ac)} style={st}>
          {b}
        </p>
      );
      break;
    }
    case "image": {
      const src = w.settings.src as string;
      if (!src) {
        inner = null;
        break;
      }
      const imgS: CSSProperties = {};
      if (ui?.maxWidth) imgS.maxWidth = ui.maxWidth;
      if (ui?.borderRadius) imgS.borderRadius = ui.borderRadius;
      const link = String((w.settings as { link?: string }).link ?? "").trim();
      const img = (
        <img
          src={src}
          alt={String(w.settings.alt ?? "")}
          className="max-h-96 w-full max-w-3xl object-contain"
          style={Object.keys(imgS).length ? imgS : undefined}
        />
      );
      const wrap = link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block max-w-full"
        >
          {img}
        </a>
      ) : (
        img
      );
      inner = (
        <div
          className={cn(
            "mb-6",
            w.settings.rounded ? "overflow-hidden rounded-xl" : "",
            ac === "text-center" && "flex justify-center",
          )}
        >
          {wrap}
        </div>
      );
      break;
    }
    case "button": {
      const sz = ui?.buttonSize === "sm" || ui?.buttonSize === "lg" ? ui.buttonSize : "default";
      const target = String((w.settings as { target?: string }).target ?? "_self");
      const rel = target === "_blank" ? "noopener noreferrer" : undefined;
      inner = (
        <div className={cn("mb-4", ac === "text-center" && "flex justify-center", ac === "text-right" && "flex justify-end")}>
          <Button size={sz} variant={(w.settings.variant as "default" | "outline" | "secondary") || "default"} asChild>
            <a href={String(w.settings.href ?? "#")} target={target} rel={rel}>
              {String(w.settings.label)}
            </a>
          </Button>
        </div>
      );
      break;
    }
    case "spacer":
      inner = <div style={{ height: Number(w.settings.height ?? 16) }} />;
      break;
    case "divider":
      inner = <hr className="my-8 border-border" />;
      break;
    case "pricing": {
      const s = w.settings;
      const prices = computePlanPrices({
        monthlyBase: Number(s.monthlyBase ?? 0),
        discountPercent: Number(s.discountPercent ?? 10),
      });
      const names = (s.planNames as Record<string, string>) || {};
      const cta = String(s.ctaLabel ?? "Subscrever");
      const fe = (s.features as string[]) || [];
      const d = Number(s.discountPercent ?? 10);
      const defFt = getDefaultFreeTrialSettings();
      const rawFt = s.freeTrial as PricingFreeTrialSettings | undefined;
      // Se freeTrial não existir no JSON (landings antigas), mostrar com defaults. enabled: false esconde.
      const showFree = rawFt == null || rawFt.enabled !== false;
      const fromRaw = Array.isArray(rawFt?.features) ? (rawFt!.features as string[]) : null;
      const freeFeatures: string[] = showFree
        ? fromRaw != null && fromRaw.length > 0
          ? fromRaw
          : fe.length
            ? fe
            : defFt.features
        : fe;
      const ft: ReturnType<typeof getDefaultFreeTrialSettings> = { ...defFt, ...(rawFt ?? {}), features: defFt.features };
      if (Array.isArray(rawFt?.features) && (rawFt!.features as string[]).length > 0) {
        ft.features = rawFt!.features as string[];
      } else {
        ft.features = defFt.features;
      }
      const freePos = ft.position === "last" ? "last" : "first";
      const hl = String(s.headline ?? "").trim();
      const cur = normalizeCurrencyCode(String(s.currency));
      const paid = (
        <>
          <PriceCard
            name={names.monthly ?? "Mensal"}
            perMonth={prices.monthly.perMonth}
            total={prices.monthly.total}
            period="mês a mês"
            cta={cta}
            href={String(s.checkoutMonthly ?? "#")}
            features={fe}
            highlight={false}
            badge={null}
            currency={cur}
          />
          <PriceCard
            name={names.quarterly ?? "Trimestral"}
            perMonth={prices.quarterly.perMonth}
            total={prices.quarterly.total}
            period="a cada 3 meses"
            cta={cta}
            href={String(s.checkoutQuarterly ?? "#")}
            features={fe}
            highlight
            badge={`${d}% de desconto`}
            currency={cur}
          />
          <PriceCard
            name={names.annual ?? "Anual"}
            perMonth={prices.annual.perMonth}
            total={prices.annual.total}
            period="por ano"
            cta={cta}
            href={String(s.checkoutAnnual ?? "#")}
            features={fe}
            highlight={false}
            badge={`${d}% de desconto`}
            currency={cur}
          />
        </>
      );
      const freeCard = showFree ? (
        <FreeTrialPriceCard
          name={ft.name}
          priceLabel={ft.priceLabel}
          subtitle={ft.subtitle}
          trialDays={ft.trialDays}
          periodText={ft.periodText}
          badge={ft.badge}
          cta={ft.ctaLabel}
          href={ft.checkoutUrl}
          features={freeFeatures}
          highlight={ft.highlight}
        />
      ) : null;
      inner = (
        <div className="mb-8 w-full min-w-0">
          {hl ? (
            <h2 className="mb-6 text-balance break-words text-center text-xl font-bold tracking-tight sm:text-2xl">
              {hl}
            </h2>
          ) : null}
          <div
            className={cn(
              "grid w-full min-w-0 gap-4",
              showFree ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
            )}
          >
            {showFree && freePos === "first" ? freeCard : null}
            {paid}
            {showFree && freePos === "last" ? freeCard : null}
          </div>
        </div>
      );
      break;
    }
    case "icon_list": {
      const items = (w.settings.items as string[]) || [];
      inner = (
        <ul className="mb-6 space-y-2">
          {items.map((t, i) => (
            <li key={i} className="flex min-w-0 gap-2 text-sm break-words">
              <span className="shrink-0 text-primary">✓</span>
              <span className="min-w-0">{t}</span>
            </li>
          ))}
        </ul>
      );
      break;
    }
    case "html": {
      const h = w.settings.html as string;
      inner = (
        <div className="mb-6 max-w-full min-w-0 overflow-x-auto">
          <div className="prose prose-invert max-w-none min-w-0 break-words text-sm" dangerouslySetInnerHTML={{ __html: h }} />
        </div>
      );
      break;
    }
    case "video": {
      const u = String(w.settings.url ?? "").trim();
      const cap = String((w.settings as { caption?: string }).caption ?? "").trim();
      const aspect = (w.settings as { aspect?: string }).aspect;
      const ar =
        aspect === "4/3" ? "aspect-[4/3]" : aspect === "1/1" ? "aspect-square" : "aspect-video";
      const emb = u ? embedVideoFromUrl(u) : null;
      if (!emb) {
        inner = (
          <div className="mb-6 rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            Indique o URL de um vídeo (YouTube ou Vimeo) nas propriedades do bloco.
          </div>
        );
        break;
      }
      inner = (
        <div
          className={cn(
            "mb-6 w-full min-w-0 max-w-full",
            ac === "text-center" && "mx-auto max-w-3xl",
            ac === "text-right" && "ml-auto max-w-3xl",
          )}
        >
          <div className={cn("relative w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-border bg-black/5", ar)}>
            <iframe
              title={cap || "Vídeo"}
              src={emb.src}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
          {cap ? <p className="mt-2 text-center text-sm text-muted-foreground">{cap}</p> : null}
        </div>
      );
      break;
    }
    case "accordion": {
      const raw = (w.settings as { items?: { title: string; body: string }[]; allowMultiple?: boolean }).items;
      const items = Array.isArray(raw) ? raw.filter((x) => x && String(x.title ?? "").length) : [];
      const multi = Boolean((w.settings as { allowMultiple?: boolean }).allowMultiple);
      if (items.length === 0) {
        inner = <p className="mb-6 text-sm text-muted-foreground">Adicione perguntas e respostas a este acordeão.</p>;
        break;
      }
      if (multi) {
        inner = (
          <Accordion type="multiple" className="mb-6 w-full">
            {items.map((it, i) => (
              <AccordionItem value={`a-${i}`} key={i}>
                <AccordionTrigger className="whitespace-normal break-words text-left">
                  {it.title}
                </AccordionTrigger>
                <AccordionContent>
                  <p className="whitespace-pre-wrap text-muted-foreground">{it.body}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        );
      } else {
        inner = (
          <Accordion type="single" collapsible className="mb-6 w-full">
            {items.map((it, i) => (
              <AccordionItem value={`a-${i}`} key={i}>
                <AccordionTrigger className="whitespace-normal break-words text-left">
                  {it.title}
                </AccordionTrigger>
                <AccordionContent>
                  <p className="whitespace-pre-wrap text-muted-foreground">{it.body}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        );
      }
      break;
    }
    case "testimonial": {
      const quote = String((w.settings as { quote?: string }).quote ?? "");
      const author = String((w.settings as { author?: string }).author ?? "");
      const role = String((w.settings as { role?: string }).role ?? "").trim();
      const avatar = String((w.settings as { avatarUrl?: string }).avatarUrl ?? "").trim();
      inner = (
        <figure
          className={cn(
            "mb-6 w-full min-w-0 max-w-full rounded-2xl border border-border/80 bg-card/50 p-4 shadow-sm sm:p-6",
            ac === "text-center" && "mx-auto max-w-2xl",
            (ac === "text-left" || ac === "text-right") && "max-w-2xl",
            ac === "text-right" && "ml-auto",
            ac,
          )}
        >
          {quote ? (
            <blockquote className="text-base leading-relaxed break-words text-foreground">&ldquo;{quote}&rdquo;</blockquote>
          ) : null}
          <figcaption
            className={cn(
              "mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center",
              ac === "text-center" && "items-center justify-center",
              ac === "text-right" && "items-end sm:items-center sm:justify-end",
            )}
          >
            {avatar ? (
              <img
                src={avatar}
                alt=""
                className="h-12 w-12 shrink-0 rounded-full object-cover"
                loading="lazy"
              />
            ) : null}
            <div className="min-w-0 sm:text-inherit">
              {author ? <div className="text-sm font-semibold break-words">{author}</div> : null}
              {role ? <div className="text-xs break-words text-muted-foreground">{role}</div> : null}
            </div>
          </figcaption>
        </figure>
      );
      break;
    }
    case "embed": {
      const src = String((w.settings as { src?: string }).src ?? "").trim();
      const title = String((w.settings as { title?: string }).title ?? "Incorporação");
      const h = Number((w.settings as { height?: number }).height) || 400;
      if (!isHttpsEmbeddableUrl(src)) {
        inner = (
          <div className="mb-6 rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            Cole o URL de incorporação (iframe) de um mapa ou serviço — tem de começar por{" "}
            <code className="font-mono">https://</code>
          </div>
        );
        break;
      }
      inner = (
        <div
          className={cn(
            "mb-6 w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-border",
            ac === "text-center" && "mx-auto max-w-4xl",
          )}
        >
          <iframe
            title={title}
            src={src}
            className="w-full min-w-0 max-w-full border-0"
            style={{
              height: h,
              maxHeight: "min(80vh, 900px)",
            }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      );
      break;
    }
    case "columns": {
      const n0 = Number((w.settings as { columnCount?: number }).columnCount) || 2;
      const n = n0 >= 2 && n0 <= 4 ? n0 : 2;
      const gapKey = (w.settings as { gap?: string }).gap ?? "md";
      const gap =
        gapKey === "sm" ? "gap-3" : gapKey === "lg" ? "gap-6 md:gap-8" : "gap-4 md:gap-6";
      const gridCols = n === 2 ? "md:grid-cols-2" : n === 3 ? "md:grid-cols-3" : "md:grid-cols-4";
      const raw = ((w.settings as { cells?: string[] }).cells ?? []) as string[];
      const padded = [...raw];
      while (padded.length < n) padded.push("<p></p>");
      const cells = padded.slice(0, n);
      inner = (
        <div className={cn("mb-6 grid w-full min-w-0 max-w-full grid-cols-1", gridCols, gap)}>
          {cells.map((html, i) => (
            <div
              key={i}
              className="lp-col-cell min-w-0 max-w-full break-words rounded-lg border border-border/60 bg-card/30 p-3 text-sm text-foreground sm:p-4 [&_a]:text-primary [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: String(html) }}
            />
          ))}
        </div>
      );
      break;
    }
    case "gallery": {
      const images = (w.settings as { images?: { src?: string; alt?: string }[] }).images ?? [];
      const gc = Number((w.settings as { gridCols?: number }).gridCols) || 3;
      const gridCols = gc <= 2 ? "sm:grid-cols-2" : gc === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3";
      const gapKey = (w.settings as { gap?: string }).gap ?? "md";
      const gap = gapKey === "sm" ? "gap-2" : gapKey === "lg" ? "gap-4" : "gap-3";
      const rounded = (w.settings as { rounded?: boolean }).rounded !== false;
      if (images.length === 0) {
        inner = <p className="mb-6 text-sm text-muted-foreground">Adicione imagens a esta galeria.</p>;
        break;
      }
      inner = (
        <div className={cn("mb-6 grid w-full min-w-0 max-w-full grid-cols-1", gridCols, gap)}>
          {images
            .filter((im) => String(im?.src ?? "").trim())
            .map((im, i) => (
              <div key={`${im.src}-${i}`} className="min-w-0 overflow-hidden">
                <img
                  src={String(im.src).trim()}
                  alt={String(im?.alt ?? "")}
                  className={cn(
                    "h-auto w-full max-h-64 min-h-0 object-cover sm:max-h-72",
                    rounded ? "rounded-xl" : "",
                  )}
                  loading="lazy"
                />
              </div>
            ))}
        </div>
      );
      break;
    }
    case "form": {
      const s = w.settings as {
        heading?: string;
        description?: string;
        submitLabel?: string;
        action?: string;
        method?: string;
        fields?: { id: string; type: string; label: string; required?: boolean; placeholder?: string }[];
      };
      const action = String(s.action ?? "").trim();
      const method = s.method === "get" ? "get" : "post";
      const ok = isAllowedFormAction(action);
      const fields = Array.isArray(s.fields) && s.fields.length > 0 ? s.fields : [];
      const heading = String(s.heading ?? "");
      const desc = String(s.description ?? "");
      const submit = String(s.submitLabel ?? "Enviar");
      inner = (
        <div className="mb-6 w-full min-w-0 max-w-full rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
          {heading ? <h3 className="text-lg font-semibold">{heading}</h3> : null}
          {desc ? <p className="mt-1 text-sm text-muted-foreground">{desc}</p> : null}
          {!ok ? (
            <p className="mt-4 rounded-md border border-dashed border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
              Defina o URL de envio (https) no editor. Enquanto estiver vazio, o envio fica inativo.
            </p>
          ) : null}
          <form className="mt-4 space-y-4" method={method} action={ok ? action : undefined} onSubmit={ok ? undefined : (e) => e.preventDefault()}>
            {fields.map((f) => {
              const id = `lp-f-${f.id}`.replace(/[^a-zA-Z0-9_-]/g, "_");
              const req = f.required === true;
              if (f.type === "textarea") {
                return (
                  <div key={f.id} className="space-y-1.5">
                    <Label htmlFor={id} className="text-sm">
                      {f.label}
                      {req ? <span className="text-destructive"> *</span> : null}
                    </Label>
                    <Textarea
                      id={id}
                      name={f.id}
                      required={ok && req}
                      placeholder={f.placeholder}
                      className="min-h-[120px]"
                      disabled={!ok}
                    />
                  </div>
                );
              }
              return (
                <div key={f.id} className="space-y-1.5">
                  <Label htmlFor={id} className="text-sm">
                    {f.label}
                    {req ? <span className="text-destructive"> *</span> : null}
                  </Label>
                  <Input
                    id={id}
                    name={f.id}
                    type={f.type === "email" ? "email" : "text"}
                    required={ok && req}
                    placeholder={f.placeholder}
                    disabled={!ok}
                    autoComplete={f.type === "email" ? "email" : undefined}
                  />
                </div>
              );
            })}
            <Button type="submit" className="w-full sm:w-auto" disabled={!ok}>
              {submit}
            </Button>
          </form>
        </div>
      );
      break;
    }
    case "countdown": {
      const s = w.settings as {
        headline?: string;
        targetDate?: string;
        labels?: unknown;
        expiredMessage?: string;
      };
      const head = String(s.headline ?? "").trim();
      const targetIso = String(s.targetDate ?? "");
      inner = (
        <div className="mb-6">
          {head ? <h3 className="mb-4 text-center text-lg font-semibold">{head}</h3> : null}
          <LandingCountdown
            targetIso={targetIso}
            labels={s.labels}
            expiredMessage={String(s.expiredMessage ?? "")}
            className="max-w-2xl mx-auto"
          />
        </div>
      );
      break;
    }
    default:
      inner = null;
  }
  if (inner === null) return null;

  const wCls = String(w.settings.htmlClass ?? "").trim();
  const wCss = String(w.settings.customCss ?? "").trim();
  const wSel = `[data-lp-w="${w.id}"]`;
  const ed = editor;
  const isSel = ed != null && ed.selectedId === w.id;
  return (
    <>
      {wCss ? <style dangerouslySetInnerHTML={{ __html: buildScopedStylesheet(wSel, wCss) }} /> : null}
      <div
        data-lp-w={w.id}
        className={cn(
          "lp-widget min-w-0 w-full max-w-full",
          wCls || undefined,
          ed && "cursor-pointer rounded-md",
          isSel && "ring-2 ring-primary ring-offset-2 ring-offset-background",
          ed &&
            "[&_a]:pointer-events-none [&_button]:pointer-events-none [&_input]:pointer-events-none [&_textarea]:pointer-events-none [&_label]:pointer-events-none [&_iframe]:pointer-events-none",
        )}
        style={boxMarginFromUi(ui)}
        onClick={
          ed
            ? (e) => {
                e.stopPropagation();
                ed.onSelect(w.id);
              }
            : undefined
        }
      >
        {inner}
      </div>
    </>
  );
}

function replaceTrialPlaceholders(text: string, days: number): string {
  return text.replace(/\{dias\}/g, String(days)).replace(/\{days\}/g, String(days));
}

function FreeTrialPriceCard({
  name,
  priceLabel,
  subtitle,
  trialDays,
  periodText,
  badge,
  cta,
  href,
  features,
  highlight,
}: {
  name: string;
  priceLabel: string;
  subtitle: string;
  trialDays: number;
  periodText: string;
  badge: string;
  cta: string;
  href: string;
  features: string[];
  highlight: boolean;
}) {
  const period = replaceTrialPlaceholders(periodText, trialDays);
  return (
    <div
      className={cn(
        "flex min-w-0 max-w-full flex-col rounded-2xl border p-4 shadow-sm transition-shadow sm:p-6",
        highlight ? "border-primary shadow-md ring-1 ring-primary/20" : "border-border bg-card",
      )}
    >
      {badge ? (
        <span className="mb-2 w-fit max-w-full rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary break-words">
          {replaceTrialPlaceholders(badge, trialDays)}
        </span>
      ) : null}
      <h3 className="break-words text-lg font-semibold">{replaceTrialPlaceholders(name, trialDays)}</h3>
      <p
        className="mt-2 break-words text-2xl font-bold tabular-nums sm:text-3xl"
        style={{ color: "var(--lp-primary, hsl(var(--primary)))" }}
      >
        {replaceTrialPlaceholders(priceLabel, trialDays)}
      </p>
      {subtitle ? (
        <p className="mt-1 break-words text-sm text-muted-foreground">{replaceTrialPlaceholders(subtitle, trialDays)}</p>
      ) : null}
      {period ? (
        <p className="mt-2 break-words text-xs leading-relaxed text-muted-foreground">{period}</p>
      ) : null}
      <ul className="mt-4 flex-1 space-y-1.5 text-sm text-muted-foreground">
        {features.map((f, i) => (
          <li key={i} className="flex min-w-0 gap-2 break-words">
            <span className="shrink-0 text-primary">✓</span>{" "}
            <span className="min-w-0">{replaceTrialPlaceholders(f, trialDays)}</span>
          </li>
        ))}
      </ul>
      <Button className="mt-6 w-full max-w-full" variant={highlight ? "default" : "outline"} asChild>
        <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined}>
          {cta}
        </a>
      </Button>
    </div>
  );
}

function PriceCard({
  name,
  perMonth,
  total,
  period,
  cta,
  href,
  features,
  highlight,
  badge,
  currency,
}: {
  name: string;
  perMonth: number;
  total: number;
  period: string;
  cta: string;
  href: string;
  features: string[];
  highlight: boolean;
  badge: string | null;
  currency: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 max-w-full flex-col rounded-2xl border p-4 shadow-sm transition-shadow sm:p-6",
        highlight ? "border-primary shadow-md ring-1 ring-primary/20" : "border-border bg-card",
      )}
    >
      {badge && (
        <span className="mb-2 w-fit max-w-full rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary break-words">
          {badge}
        </span>
      )}
      <h3 className="break-words text-lg font-semibold">{name}</h3>
      <p
        className="mt-1 break-words text-2xl font-bold tabular-nums sm:text-3xl"
        style={{ color: "var(--lp-primary, hsl(var(--primary)))" }}
      >
        {formatLandingCurrency(perMonth, currency)}
        <span className="text-sm font-normal text-muted-foreground">/mês</span>
      </p>
      <p className="break-words text-xs text-muted-foreground">
        Total: {formatLandingCurrency(total, currency)} ({period})
      </p>
      <ul className="mt-4 flex-1 space-y-1.5 text-sm text-muted-foreground">
        {features.map((f, i) => (
          <li key={i} className="flex min-w-0 gap-2 break-words">
            <span className="shrink-0 text-primary">•</span> <span className="min-w-0">{f}</span>
          </li>
        ))}
      </ul>
      <Button className="mt-6 w-full max-w-full" variant={highlight ? "default" : "outline"} asChild>
        <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined}>
          {cta}
        </a>
      </Button>
    </div>
  );
}
