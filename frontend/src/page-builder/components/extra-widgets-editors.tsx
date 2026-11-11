import { useAppLocale } from "@/i18n/AppLocaleProvider";
import {
  ColorField,
  NumberField,
  SelectField,
  TextField,
  TextareaField,
} from "./PropertyControls";
import { cookieBannerFollowsPageLanguage, resolveCookieBannerCopy } from "../cookieBannerCopy";
import { usePresellPublicLocale } from "@/lib/presellPublicLocale";

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-editor-border p-3 last:border-0">
      {title ? (
        <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-editor-fg-muted">
          {title}
        </h4>
      ) : null}
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function CookieBannerContentEditor({
  content: c,
  setContent,
}: {
  content: Record<string, unknown>;
  setContent: (p: Record<string, unknown>) => void;
}) {
  const { t } = useAppLocale();
  const pageLanguage = usePresellPublicLocale();
  const followsLanguage = cookieBannerFollowsPageLanguage({
    title: typeof c.title === "string" ? c.title : undefined,
    followLanguage: typeof c.followLanguage === "boolean" ? c.followLanguage : undefined,
  });
  const copy = resolveCookieBannerCopy(
    {
      title: typeof c.title === "string" ? c.title : undefined,
      body: typeof c.body === "string" ? c.body : undefined,
      allowLabel: typeof c.allowLabel === "string" ? c.allowLabel : undefined,
      declineLabel: typeof c.declineLabel === "string" ? c.declineLabel : undefined,
      policyLabel: typeof c.policyLabel === "string" ? c.policyLabel : undefined,
      footerNote: typeof c.footerNote === "string" ? c.footerNote : undefined,
      followLanguage: typeof c.followLanguage === "boolean" ? c.followLanguage : undefined,
    },
    pageLanguage,
  );
  const variant = (c.variant as string) ?? "modal";
  const animOptions = [
    { value: "none", label: t("pages.pageBuilder.popups.animNone") },
    { value: "fade", label: t("pages.pageBuilder.popups.animFade") },
    { value: "fadeUp", label: t("pages.pageBuilder.popups.animFadeUp") },
    { value: "fadeDown", label: t("pages.pageBuilder.popups.animFadeDown") },
    { value: "scale", label: t("pages.pageBuilder.popups.animScale") },
    { value: "slideLeft", label: t("pages.pageBuilder.popups.animSlideLeft") },
    { value: "slideRight", label: t("pages.pageBuilder.popups.animSlideRight") },
    { value: "slideUp", label: t("pages.pageBuilder.popups.animSlideUp") },
    { value: "slideDown", label: t("pages.pageBuilder.popups.animSlideDown") },
  ];
  return (
    <>
      <Section title={t("pages.pageBuilder.popups.modePosition")}>
        <SelectField
          label={t("pages.pageBuilder.popups.mode")}
          value={variant}
          options={[
            { value: "modal", label: t("pages.pageBuilder.widgets.opt.modalAds") },
            { value: "corner", label: t("pages.pageBuilder.widgets.opt.cornerToast") },
            { value: "bar", label: t("pages.pageBuilder.widgets.opt.barEnds") },
          ]}
          onChange={(v) => {
            const patch: Record<string, unknown> = { variant: v };
            if (v === "modal") patch.position = "center";
            if (v === "bar" && c.position !== "top" && c.position !== "bottom") patch.position = "bottom";
            if (v === "corner" && (c.position === "center" || c.position === "top" || c.position === "bottom")) {
              patch.position = "bottom-right";
            }
            setContent(patch);
          }}
        />
        <SelectField
          label={t("pages.pageBuilder.popups.position")}
          value={(c.position as string) ?? (variant === "modal" ? "center" : variant === "bar" ? "bottom" : "bottom-right")}
          options={
            variant === "modal"
              ? [{ value: "center", label: t("pages.pageBuilder.popups.posCenter") }]
              : variant === "bar"
                ? [
                    { value: "top", label: t("pages.pageBuilder.panel.top") },
                    { value: "bottom", label: t("pages.pageBuilder.panel.bottom") },
                  ]
                : [
                    { value: "top-left", label: t("pages.pageBuilder.popups.posTopLeft") },
                    { value: "top-right", label: t("pages.pageBuilder.popups.posTopRight") },
                    { value: "bottom-left", label: t("pages.pageBuilder.popups.posBottomLeft") },
                    { value: "bottom-right", label: t("pages.pageBuilder.popups.posBottomRight") },
                  ]
          }
          onChange={(v) => setContent({ position: v })}
        />
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label={t("pages.pageBuilder.popups.offsetX")}
            value={typeof c.offsetXPx === "number" ? c.offsetXPx : 20}
            onChange={(v) => setContent({ offsetXPx: v })}
            min={0}
            max={120}
          />
          <NumberField
            label={t("pages.pageBuilder.popups.offsetY")}
            value={typeof c.offsetYPx === "number" ? c.offsetYPx : 20}
            onChange={(v) => setContent({ offsetYPx: v })}
            min={0}
            max={120}
          />
        </div>
        <NumberField
          label={t("pages.pageBuilder.popups.maxWidth")}
          value={typeof c.maxWidthPx === "number" ? c.maxWidthPx : variant === "corner" ? 340 : 420}
          onChange={(v) => setContent({ maxWidthPx: v })}
          min={240}
          max={720}
        />
      </Section>

      <Section title={t("pages.pageBuilder.widgets.cookie.timing")}>
        <NumberField
          label={t("pages.pageBuilder.popups.entryDelay")}
          value={typeof c.delayMs === "number" ? c.delayMs : 0}
          onChange={(v) => setContent({ delayMs: v })}
          min={0}
          max={30000}
        />
        <SelectField
          label={t("pages.pageBuilder.widgets.cookie.animation")}
          value={(c.animation as string) ?? "fadeUp"}
          options={animOptions}
          onChange={(v) => setContent({ animation: v })}
        />
        <NumberField
          label={t("pages.pageBuilder.widgets.cookie.animDuration")}
          value={typeof c.animationDurationMs === "number" ? c.animationDurationMs : 320}
          onChange={(v) => setContent({ animationDurationMs: v })}
          min={80}
          max={3000}
        />
      </Section>

      <Section title={t("pages.pageBuilder.content")}>
        <SelectField
          label={t("pages.pageBuilder.widgets.cookie.texts")}
          value={followsLanguage ? "locale" : "custom"}
          options={[
            { value: "custom", label: t("pages.pageBuilder.widgets.opt.customText") },
            { value: "locale", label: t("pages.pageBuilder.widgets.opt.followPage") },
          ]}
          onChange={(v) => setContent({ followLanguage: v === "locale" })}
        />
        <TextField
          label={t("pages.pageBuilder.widgets.fields.title")}
          value={copy.title}
          onChange={(v) => setContent({ title: v, followLanguage: false })}
        />
        <TextareaField
          label={t("pages.pageBuilder.widgets.cookie.body")}
          value={copy.body}
          onChange={(v) => setContent({ body: v, followLanguage: false })}
          rows={4}
        />
        <TextField
          label={t("pages.pageBuilder.widgets.cookie.accept")}
          value={copy.allowLabel}
          onChange={(v) => setContent({ allowLabel: v, followLanguage: false })}
        />
        <TextField
          label={t("pages.pageBuilder.widgets.cookie.decline")}
          value={copy.declineLabel}
          onChange={(v) => setContent({ declineLabel: v, followLanguage: false })}
        />
        <TextField
          label={t("pages.pageBuilder.widgets.cookie.policyLabel")}
          value={copy.policyLabel}
          onChange={(v) => setContent({ policyLabel: v, followLanguage: false })}
        />
        <TextField
          label={t("pages.pageBuilder.widgets.cookie.footer")}
          value={copy.footerNote}
          onChange={(v) => setContent({ footerNote: v, followLanguage: false })}
        />
        <TextField
          label={t("pages.pageBuilder.widgets.cookie.policyUrl")}
          value={(c.policyUrl as string) ?? "/privacidade"}
          onChange={(v) => setContent({ policyUrl: v })}
          placeholder="/privacidade"
        />
        <SelectField
          label={t("pages.pageBuilder.widgets.cookie.closeX")}
          value={c.showCloseButton === true ? "on" : "off"}
          options={[
            { value: "off", label: t("pages.pageBuilder.widgets.cookie.closeHidden") },
            { value: "on", label: t("pages.pageBuilder.widgets.cookie.closeVisible") },
          ]}
          onChange={(v) => setContent({ showCloseButton: v === "on" })}
        />
      </Section>

      <Section title={t("pages.pageBuilder.style")}>
        <ColorField
          label={t("pages.pageBuilder.widgets.cookie.acceptColor")}
          value={(c.accentColor as string) ?? "#2563eb"}
          onChange={(v) => setContent({ accentColor: v })}
        />
        {variant === "modal" ? (
          <>
            <SelectField
              label={t("pages.pageBuilder.widgets.cookie.dim")}
              value={c.backdrop === false ? "off" : "on"}
              options={[
                { value: "on", label: t("common.yes") },
                { value: "off", label: t("common.no") },
              ]}
              onChange={(v) => setContent({ backdrop: v === "on" })}
            />
            <NumberField
              label={t("pages.pageBuilder.widgets.cookie.darkness")}
              value={typeof c.overlayOpacity === "number" ? c.overlayOpacity : 12}
              onChange={(v) => setContent({ overlayOpacity: v })}
              min={0}
              max={70}
            />
            <NumberField
              label={t("pages.pageBuilder.widgets.cookie.blur")}
              value={typeof c.overlayBlur === "number" ? c.overlayBlur : 0}
              onChange={(v) => setContent({ overlayBlur: v })}
              min={0}
              max={12}
            />
          </>
        ) : null}
        <TextField
          label={t("pages.pageBuilder.widgets.cookie.storageKey")}
          value={(c.storageKey as string) ?? "clickora-cookie-banner"}
          onChange={(v) => setContent({ storageKey: v })}
        />
        <p className="text-[10px] leading-relaxed text-editor-fg-muted">
          {t("pages.pageBuilder.widgets.cookie.hint")}
        </p>
      </Section>
    </>
  );
}

export function BackToTopContentEditor({
  content: c,
  setContent,
}: {
  content: Record<string, unknown>;
  setContent: (p: Record<string, unknown>) => void;
}) {
  const { t } = useAppLocale();
  return (
    <Section title={t("pages.pageBuilder.widgets.backToTop.title")}>
      <NumberField
        label={t("pages.pageBuilder.widgets.backToTop.threshold")}
        value={(c.threshold as number) ?? 300}
        onChange={(v) => setContent({ threshold: v })}
        min={0}
        max={4000}
      />
      <SelectField
        label={t("pages.pageBuilder.widgets.backToTop.hPosition")}
        value={(c.position as string) ?? "right"}
        options={[
          { value: "right", label: t("pages.pageBuilder.widgets.opt.right") },
          { value: "left", label: t("pages.pageBuilder.widgets.opt.left") },
        ]}
        onChange={(v) => setContent({ position: v })}
      />
      <ColorField
        label={t("pages.pageBuilder.widgets.fields.buttonBg")}
        value={(c.bg as string) ?? "#0f172a"}
        onChange={(v) => setContent({ bg: v })}
      />
      <ColorField
        label={t("pages.pageBuilder.widgets.fields.iconColor")}
        value={(c.color as string) ?? "#ffffff"}
        onChange={(v) => setContent({ color: v })}
      />
      <NumberField
        label={t("pages.pageBuilder.widgets.fields.sizePx")}
        value={(c.size as number) ?? 48}
        onChange={(v) => setContent({ size: v })}
        min={32}
        max={96}
      />
      <SelectField
        label={t("pages.pageBuilder.widgets.fields.shape")}
        value={(c.shape as string) ?? "circle"}
        options={[
          { value: "circle", label: t("pages.pageBuilder.widgets.opt.circle") },
          { value: "square", label: t("pages.pageBuilder.widgets.opt.square") },
        ]}
        onChange={(v) => setContent({ shape: v })}
      />
    </Section>
  );
}

export function ReadingProgressContentEditor({
  content: c,
  setContent,
}: {
  content: Record<string, unknown>;
  setContent: (p: Record<string, unknown>) => void;
}) {
  const { t } = useAppLocale();
  return (
    <Section title={t("pages.pageBuilder.widgets.reading.title")}>
      <NumberField
        label={t("pages.pageBuilder.widgets.fields.heightPx")}
        value={(c.height as number) ?? 4}
        onChange={(v) => setContent({ height: v })}
        min={2}
        max={24}
      />
      <ColorField
        label={t("pages.pageBuilder.widgets.reading.barBg")}
        value={(c.bg as string) ?? "transparent"}
        onChange={(v) => setContent({ bg: v })}
      />
      <ColorField
        label={t("pages.pageBuilder.widgets.reading.progress")}
        value={(c.fillColor as string) ?? "#e63946"}
        onChange={(v) => setContent({ fillColor: v })}
      />
      <SelectField
        label={t("pages.pageBuilder.popups.position")}
        value={(c.position as string) ?? "top"}
        options={[
          { value: "top", label: t("pages.pageBuilder.panel.top") },
          { value: "bottom", label: t("pages.pageBuilder.widgets.opt.footer") },
        ]}
        onChange={(v) => setContent({ position: v })}
      />
    </Section>
  );
}

export function StickyVideoContentEditor({
  content: c,
  setContent,
}: {
  content: Record<string, unknown>;
  setContent: (p: Record<string, unknown>) => void;
}) {
  const { t } = useAppLocale();
  return (
    <Section title={t("pages.pageBuilder.widgets.stickyVideo.title")}>
      <TextareaField
        label={t("pages.pageBuilder.panel.videoUrl")}
        value={(c.url as string) ?? ""}
        onChange={(v) => setContent({ url: v })}
        rows={3}
        placeholder={t("pages.pageBuilder.widgets.stickyVideo.urlPh")}
      />
      <p className="text-[10px] leading-relaxed text-editor-fg-muted">
        {t("pages.pageBuilder.widgets.stickyVideo.hint")}
      </p>
      <NumberField
        label={t("pages.pageBuilder.widgets.stickyVideo.inlineHeight")}
        value={(c.inlineHeight as number) ?? 360}
        onChange={(v) => setContent({ inlineHeight: v })}
        min={120}
        max={900}
      />
      <SelectField
        label={t("pages.pageBuilder.widgets.stickyVideo.corner")}
        value={(c.position as string) ?? "bottom-right"}
        options={[
          { value: "bottom-right", label: t("pages.pageBuilder.widgets.opt.brShort") },
          { value: "bottom-left", label: t("pages.pageBuilder.widgets.opt.blShort") },
          { value: "top-right", label: t("pages.pageBuilder.widgets.opt.trShort") },
          { value: "top-left", label: t("pages.pageBuilder.widgets.opt.tlShort") },
        ]}
        onChange={(v) => setContent({ position: v })}
      />
      <NumberField
        label={t("pages.pageBuilder.widgets.stickyVideo.fixedWidth")}
        value={(c.width as number) ?? 320}
        onChange={(v) => setContent({ width: v })}
        min={160}
        max={480}
      />
      <SelectField
        label={t("pages.pageBuilder.widgets.stickyVideo.aspect")}
        value={(c.aspectRatio as string) ?? "16/9"}
        options={[
          { value: "16/9", label: "16:9" },
          { value: "4/3", label: "4:3" },
          { value: "1/1", label: "1:1" },
        ]}
        onChange={(v) => setContent({ aspectRatio: v })}
      />
      <NumberField
        label={t("pages.pageBuilder.widgets.stickyVideo.cornerRadius")}
        value={(c.borderRadius as number) ?? 8}
        onChange={(v) => setContent({ borderRadius: v })}
        min={0}
        max={32}
      />
      <SelectField
        label={t("pages.pageBuilder.widgets.stickyVideo.close")}
        value={c.showCloseButton !== false ? "yes" : "no"}
        options={[
          { value: "yes", label: t("common.yes") },
          { value: "no", label: t("common.no") },
        ]}
        onChange={(v) => setContent({ showCloseButton: v === "yes" })}
      />
    </Section>
  );
}

export function PhoneCallContentEditor({
  content: c,
  setContent,
}: {
  content: Record<string, unknown>;
  setContent: (p: Record<string, unknown>) => void;
}) {
  const { t } = useAppLocale();
  return (
    <Section title={t("pages.pageBuilder.widgets.phone.title")}>
      <TextField
        label={t("pages.pageBuilder.widgets.phone.number")}
        value={(c.number as string) ?? ""}
        onChange={(v) => setContent({ number: v })}
        placeholder={t("pages.pageBuilder.widgets.phone.numberPh")}
      />
      <TextField
        label={t("pages.pageBuilder.widgets.fields.text")}
        value={(c.displayText as string) ?? ""}
        onChange={(v) => setContent({ displayText: v })}
      />
      <SelectField
        label={t("pages.pageBuilder.style")}
        value={(c.variant as string) ?? "button"}
        options={[
          { value: "button", label: t("pages.pageBuilder.widgets.opt.button") },
          { value: "link", label: t("pages.pageBuilder.widgets.opt.link") },
          { value: "floating", label: t("pages.pageBuilder.widgets.opt.floating") },
        ]}
        onChange={(v) => setContent({ variant: v })}
      />
      <ColorField
        label={t("pages.pageBuilder.background")}
        value={(c.bg as string) ?? "#10b981"}
        onChange={(v) => setContent({ bg: v })}
      />
      <ColorField
        label={t("pages.pageBuilder.widgets.phone.iconText")}
        value={(c.color as string) ?? "#ffffff"}
        onChange={(v) => setContent({ color: v })}
      />
      <NumberField
        label={t("pages.pageBuilder.widgets.phone.radius")}
        value={(c.borderRadius as number) ?? 8}
        onChange={(v) => setContent({ borderRadius: v })}
        min={0}
        max={32}
      />
      <SelectField
        label={t("pages.pageBuilder.widgets.phone.showIcon")}
        value={c.showIcon !== false ? "yes" : "no"}
        options={[
          { value: "yes", label: t("common.yes") },
          { value: "no", label: t("common.no") },
        ]}
        onChange={(v) => setContent({ showIcon: v === "yes" })}
      />
      <NumberField
        label={t("pages.pageBuilder.widgets.phone.fontSize")}
        value={(c.fontSize as number) ?? 16}
        onChange={(v) => setContent({ fontSize: v })}
        min={10}
        max={32}
      />
      <SelectField
        label={t("pages.pageBuilder.widgets.phone.side")}
        value={(c.position as string) ?? "right"}
        options={[
          { value: "right", label: t("pages.pageBuilder.widgets.opt.right") },
          { value: "left", label: t("pages.pageBuilder.widgets.opt.left") },
        ]}
        onChange={(v) => setContent({ position: v })}
      />
    </Section>
  );
}

export function DateContentEditor({
  content: c,
  setContent,
}: {
  content: Record<string, unknown>;
  setContent: (p: Record<string, unknown>) => void;
}) {
  const { t } = useAppLocale();
  return (
    <Section title={t("pages.pageBuilder.widgets.date.title")}>
      <SelectField
        label={t("pages.pageBuilder.widgets.date.source")}
        value={(c.source as string) ?? "now"}
        options={[
          { value: "now", label: t("pages.pageBuilder.widgets.opt.now") },
          { value: "fixed", label: t("pages.pageBuilder.widgets.opt.fixed") },
        ]}
        onChange={(v) => setContent({ source: v })}
      />
      {(c.source as string) === "fixed" ? (
        <TextField
          label={t("pages.pageBuilder.widgets.date.iso")}
          value={(c.fixedDate as string) ?? ""}
          onChange={(v) => setContent({ fixedDate: v })}
          placeholder="2026-04-18T12:00:00"
        />
      ) : null}
      <SelectField
        label={t("pages.pageBuilder.widgets.date.format")}
        value={(c.format as string) ?? "long"}
        options={[
          { value: "long", label: t("pages.pageBuilder.widgets.opt.long") },
          { value: "short", label: t("pages.pageBuilder.widgets.opt.medium") },
          { value: "numeric", label: t("pages.pageBuilder.widgets.opt.numeric") },
          { value: "time", label: t("pages.pageBuilder.widgets.opt.time") },
          { value: "datetime", label: t("pages.pageBuilder.widgets.opt.datetime") },
        ]}
        onChange={(v) => setContent({ format: v })}
      />
      <TextField
        label={t("pages.pageBuilder.widgets.date.locale")}
        value={(c.locale as string) ?? "pt-BR"}
        onChange={(v) => setContent({ locale: v })}
      />
      <TextField
        label={t("pages.pageBuilder.widgets.fields.prefix")}
        value={(c.prefix as string) ?? ""}
        onChange={(v) => setContent({ prefix: v })}
      />
      <TextField
        label={t("pages.pageBuilder.widgets.fields.suffix")}
        value={(c.suffix as string) ?? ""}
        onChange={(v) => setContent({ suffix: v })}
      />
      <NumberField
        label={t("pages.pageBuilder.widgets.fields.sizePx")}
        value={(c.fontSize as number) ?? 16}
        onChange={(v) => setContent({ fontSize: v })}
        min={10}
        max={48}
      />
      <ColorField
        label={t("pages.pageBuilder.widgets.fields.color")}
        value={(c.color as string) ?? "#0f172a"}
        onChange={(v) => setContent({ color: v })}
      />
      <NumberField
        label={t("pages.pageBuilder.widgets.date.weight")}
        value={(c.fontWeight as number) ?? 500}
        onChange={(v) => setContent({ fontWeight: v })}
        min={300}
        max={900}
        step={50}
      />
    </Section>
  );
}

export function TickerContentEditor({
  content: c,
  setContent,
}: {
  content: Record<string, unknown>;
  setContent: (p: Record<string, unknown>) => void;
}) {
  const { t } = useAppLocale();
  const items = (c.items as string[]) ?? [];
  const text = items.join("\n");
  return (
    <Section title={t("pages.pageBuilder.widgets.ticker.title")}>
      <TextareaField
        label={t("pages.pageBuilder.widgets.ticker.messages")}
        value={text}
        onChange={(v) =>
          setContent({
            items: v
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
          })
        }
        rows={5}
        placeholder={t("pages.pageBuilder.widgets.ticker.placeholder")}
      />
      <NumberField
        label={t("pages.pageBuilder.widgets.ticker.speed")}
        value={(c.speed as number) ?? 25}
        onChange={(v) => setContent({ speed: v })}
        min={8}
        max={90}
      />
      <SelectField
        label={t("pages.pageBuilder.widgets.ticker.direction")}
        value={(c.direction as string) ?? "left"}
        options={[
          { value: "left", label: t("pages.pageBuilder.widgets.opt.arrowLeft") },
          { value: "right", label: t("pages.pageBuilder.widgets.opt.arrowRight") },
        ]}
        onChange={(v) => setContent({ direction: v })}
      />
      <TextField
        label={t("pages.pageBuilder.widgets.ticker.separator")}
        value={(c.separator as string) ?? "•"}
        onChange={(v) => setContent({ separator: v })}
      />
      <NumberField
        label={t("pages.pageBuilder.widgets.ticker.textSize")}
        value={(c.fontSize as number) ?? 16}
        onChange={(v) => setContent({ fontSize: v })}
        min={10}
        max={28}
      />
      <ColorField
        label={t("pages.pageBuilder.panel.textColor")}
        value={(c.color as string) ?? "#0f172a"}
        onChange={(v) => setContent({ color: v })}
      />
      <ColorField
        label={t("pages.pageBuilder.widgets.ticker.bandBg")}
        value={(c.bg as string) ?? "transparent"}
        onChange={(v) => setContent({ bg: v })}
      />
      <NumberField
        label={t("pages.pageBuilder.widgets.ticker.padY")}
        value={(c.paddingY as number) ?? 12}
        onChange={(v) => setContent({ paddingY: v })}
        min={4}
        max={32}
      />
      <NumberField
        label={t("pages.pageBuilder.widgets.ticker.gap")}
        value={(c.gap as number) ?? 40}
        onChange={(v) => setContent({ gap: v })}
        min={16}
        max={80}
      />
    </Section>
  );
}

export function InfoBoxContentEditor({
  content: c,
  setContent,
}: {
  content: Record<string, unknown>;
  setContent: (p: Record<string, unknown>) => void;
}) {
  const { t } = useAppLocale();
  return (
    <>
      <Section title={t("pages.pageBuilder.widgets.infoBox.iconSection")}>
        <TextField
          label={t("pages.pageBuilder.widgets.infoBox.iconName")}
          value={(c.iconName as string) ?? "sparkles"}
          onChange={(v) => setContent({ iconName: v.trim() })}
          placeholder={t("pages.pageBuilder.widgets.infoBox.iconPh")}
        />
        <NumberField
          label={t("pages.pageBuilder.widgets.button.iconSize")}
          value={(c.iconSize as number) ?? 32}
          onChange={(v) => setContent({ iconSize: v })}
          min={16}
          max={96}
        />
        <ColorField
          label={t("pages.pageBuilder.widgets.fields.iconColor")}
          value={(c.iconColor as string) ?? "#e63946"}
          onChange={(v) => setContent({ iconColor: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.widgets.infoBox.iconBg")}
          value={(c.iconBg as string) ?? "#fef2f2"}
          onChange={(v) => setContent({ iconBg: v })}
        />
        <SelectField
          label={t("pages.pageBuilder.widgets.infoBox.iconShape")}
          value={(c.iconShape as string) ?? "circle"}
          options={[
            { value: "circle", label: t("pages.pageBuilder.widgets.opt.circle") },
            { value: "square", label: t("pages.pageBuilder.widgets.opt.square") },
            { value: "none", label: t("pages.pageBuilder.widgets.opt.noneMasc") },
          ]}
          onChange={(v) => setContent({ iconShape: v })}
        />
      </Section>
      <Section title={t("pages.pageBuilder.content")}>
        <TextField
          label={t("pages.pageBuilder.widgets.fields.title")}
          value={(c.title as string) ?? ""}
          onChange={(v) => setContent({ title: v })}
        />
        <TextareaField
          label={t("pages.pageBuilder.widgets.fields.description")}
          value={(c.description as string) ?? ""}
          onChange={(v) => setContent({ description: v })}
          rows={3}
        />
        <TextField
          label={t("pages.pageBuilder.widgets.infoBox.linkText")}
          value={(c.ctaText as string) ?? ""}
          onChange={(v) => setContent({ ctaText: v })}
        />
        <TextField
          label={t("pages.pageBuilder.widgets.infoBox.linkUrl")}
          value={(c.ctaHref as string) ?? ""}
          onChange={(v) => setContent({ ctaHref: v })}
        />
      </Section>
      <Section title={t("pages.pageBuilder.disposition")}>
        <SelectField
          label={t("pages.pageBuilder.disposition")}
          value={(c.layout as string) ?? "stacked"}
          options={[
            { value: "stacked", label: t("pages.pageBuilder.widgets.opt.stacked") },
            { value: "side", label: t("pages.pageBuilder.widgets.opt.beside") },
          ]}
          onChange={(v) => setContent({ layout: v })}
        />
        <SelectField
          label={t("pages.pageBuilder.widgets.fields.alignment")}
          value={(c.align as string) ?? "center"}
          options={[
            { value: "left", label: t("pages.pageBuilder.widgets.opt.left") },
            { value: "center", label: t("pages.pageBuilder.panel.center") },
            { value: "right", label: t("pages.pageBuilder.widgets.opt.right") },
          ]}
          onChange={(v) => setContent({ align: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.widgets.fields.titleColor")}
          value={(c.titleColor as string) ?? "#0f172a"}
          onChange={(v) => setContent({ titleColor: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.widgets.fields.descColor")}
          value={(c.descColor as string) ?? "#475569"}
          onChange={(v) => setContent({ descColor: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.widgets.infoBox.linkColor")}
          value={(c.ctaColor as string) ?? "#e63946"}
          onChange={(v) => setContent({ ctaColor: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.widgets.infoBox.blockBg")}
          value={(c.bg as string) ?? "transparent"}
          onChange={(v) => setContent({ bg: v })}
        />
        <NumberField
          label={t("pages.pageBuilder.widgets.infoBox.cornerRadius")}
          value={(c.borderRadius as number) ?? 0}
          onChange={(v) => setContent({ borderRadius: v })}
          min={0}
          max={24}
        />
      </Section>
    </>
  );
}
