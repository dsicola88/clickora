import type { MessageKey } from "@/i18n";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import type { WidgetEffects, WidgetNode } from "../types";
import {
  CONTINUOUS_ANIMATION_OPTIONS,
  EASING_PRESET_OPTIONS,
  ENTRANCE_ANIMATION_OPTIONS,
  ENTRANCE_TRIGGER_OPTIONS,
  HOVER_PRESET_OPTIONS,
  MOTION_PATH_OPTIONS,
  SCROLLING_EFFECT_OPTIONS,
  resolveWidgetEffects,
} from "../widget-motion";
import { ColorField, NumberField, SelectField, TextareaField } from "./PropertyControls";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-editor-border p-3 last:border-0">
      <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-editor-fg-muted">
        {title}
      </h4>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function localizeOptions(
  options: ReadonlyArray<{ value: string; label: string }>,
  keys: Partial<Record<string, MessageKey>>,
  t: (key: MessageKey) => string,
) {
  return options.map((o) => ({
    value: o.value,
    label: keys[o.value] ? t(keys[o.value] as MessageKey) : o.label,
  }));
}

const ENTRANCE_KEYS: Partial<Record<string, MessageKey>> = {
  none: "pages.pageBuilder.widgets.opt.noneFem",
};

const TRIGGER_KEYS: Partial<Record<string, MessageKey>> = {
  scroll: "pages.pageBuilder.chrome.effects.onScroll",
  load: "pages.pageBuilder.chrome.effects.onLoad",
};

const CONTINUOUS_KEYS: Partial<Record<string, MessageKey>> = {
  none: "pages.pageBuilder.widgets.opt.noneFem",
  float: "pages.pageBuilder.chrome.effects.float",
  spin: "pages.pageBuilder.chrome.effects.spin",
  shake: "pages.pageBuilder.chrome.effects.shake",
  glow: "pages.pageBuilder.chrome.effects.glow",
};

const SCROLL_KEYS: Partial<Record<string, MessageKey>> = {
  none: "pages.pageBuilder.widgets.opt.noneMasc",
  transparency: "pages.pageBuilder.chrome.effects.transparency",
  rotate: "pages.pageBuilder.chrome.effects.spin",
  scale: "pages.pageBuilder.chrome.effects.scale",
};

const PATH_KEYS: Partial<Record<string, MessageKey>> = {
  none: "pages.pageBuilder.widgets.opt.noneMasc",
  lineH: "pages.pageBuilder.chrome.effects.lineH",
  lineV: "pages.pageBuilder.chrome.effects.lineV",
  arc: "pages.pageBuilder.chrome.effects.arc",
  circle: "pages.pageBuilder.widgets.opt.circle",
  figure8: "pages.pageBuilder.chrome.effects.figure8",
};

const HOVER_KEYS: Partial<Record<string, MessageKey>> = {
  "": "pages.pageBuilder.chrome.effects.hoverEmpty",
  "scale(1.05)": "pages.pageBuilder.chrome.effects.grow",
  "scale(0.95)": "pages.pageBuilder.chrome.effects.shrink",
  "translateY(-4px)": "pages.pageBuilder.chrome.effects.moveUp",
  "translateY(4px)": "pages.pageBuilder.chrome.effects.moveDown",
  "scale(1.05) translateY(-3px)": "pages.pageBuilder.chrome.effects.growUp",
  "rotate(2deg)": "pages.pageBuilder.chrome.effects.rotateSlight",
  "rotate(-2deg) scale(1.03)": "pages.pageBuilder.chrome.effects.rotateGrow",
  "translateY(-6px) scale(1.04)": "pages.pageBuilder.chrome.effects.lift",
};

const EASING_KEYS: Partial<Record<string, MessageKey>> = {
  "cubic-bezier(0.4, 0, 0.2, 1)": "pages.pageBuilder.widgets.button.easeMaterial",
  "cubic-bezier(0.22, 1, 0.36, 1)": "pages.pageBuilder.chrome.effects.expo",
  "cubic-bezier(0.68, -0.55, 0.265, 1.55)": "pages.pageBuilder.widgets.button.easeElastic",
  "cubic-bezier(0.34, 1.56, 0.64, 1)": "pages.pageBuilder.chrome.effects.overshoot",
};

/** Motion effects shared by every widget (Advanced tab). */
export function WidgetEffectsEditor({
  widget,
  onChange,
}: {
  widget: WidgetNode;
  onChange: (effects: WidgetEffects) => void;
}) {
  const { t } = useAppLocale();
  const e = resolveWidgetEffects(widget.effects, widget.content);
  const patch = (partial: Partial<WidgetEffects>) =>
    onChange({ ...(widget.effects ?? {}), ...partial });

  const hoverPresetMatch = HOVER_PRESET_OPTIONS.find((o) => o.value === (e.hoverTransform ?? ""));

  return (
    <>
      <Section title={t("pages.pageBuilder.chrome.effects.entrance")}>
        <p className="text-[10px] leading-relaxed text-editor-fg-muted -mt-1">
          {t("pages.pageBuilder.chrome.effects.entranceHint")}
        </p>
        <SelectField
          label={t("pages.pageBuilder.widgets.fields.type")}
          value={e.entranceAnimation ?? "none"}
          options={localizeOptions(ENTRANCE_ANIMATION_OPTIONS, ENTRANCE_KEYS, t)}
          onChange={(v) => patch({ entranceAnimation: v })}
        />
        <SelectField
          label={t("pages.pageBuilder.chrome.effects.trigger")}
          value={e.entranceTrigger ?? "scroll"}
          options={localizeOptions(ENTRANCE_TRIGGER_OPTIONS, TRIGGER_KEYS, t)}
          onChange={(v) => patch({ entranceTrigger: v === "load" ? "load" : "scroll" })}
        />
        <NumberField
          label={t("pages.pageBuilder.widgets.fields.durationMs")}
          value={e.entranceDurationMs ?? 700}
          min={0}
          max={10000}
          onChange={(v) => patch({ entranceDurationMs: v })}
        />
        <NumberField
          label={t("pages.pageBuilder.widgets.fields.delayMs")}
          value={e.entranceDelayMs ?? 0}
          min={0}
          max={10000}
          onChange={(v) => patch({ entranceDelayMs: v })}
        />
        <SelectField
          label={t("pages.pageBuilder.chrome.effects.easing")}
          value={e.entranceEasing ?? "cubic-bezier(0.22, 1, 0.36, 1)"}
          options={localizeOptions(EASING_PRESET_OPTIONS, EASING_KEYS, t)}
          onChange={(v) => patch({ entranceEasing: v })}
        />
        <NumberField
          label={t("pages.pageBuilder.chrome.effects.threshold")}
          value={e.entranceThreshold ?? 12}
          min={0}
          max={100}
          onChange={(v) => patch({ entranceThreshold: v })}
        />
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[11px] text-editor-fg">{t("pages.pageBuilder.chrome.effects.once")}</Label>
          <Switch
            checked={e.entranceOnce !== false}
            onCheckedChange={(v) => patch({ entranceOnce: v })}
          />
        </div>
      </Section>

      <Section title={t("pages.pageBuilder.chrome.effects.scrolling")}>
        <p className="text-[10px] leading-relaxed text-editor-fg-muted -mt-1">
          {t("pages.pageBuilder.chrome.effects.scrollingHint")}
        </p>
        <SelectField
          label={t("pages.pageBuilder.chrome.effects.effect")}
          value={e.scrollingEffect ?? "none"}
          options={localizeOptions(SCROLLING_EFFECT_OPTIONS, SCROLL_KEYS, t)}
          onChange={(v) => patch({ scrollingEffect: v })}
        />
        {(e.scrollingEffect || "none") !== "none" ? (
          <>
            <NumberField
              label={t("pages.pageBuilder.chrome.effects.intensity")}
              value={e.scrollingSpeed ?? 40}
              min={0}
              max={100}
              onChange={(v) => patch({ scrollingSpeed: v })}
            />
            <div className="flex items-center justify-between gap-2">
              <Label className="text-[11px] text-editor-fg">{t("pages.pageBuilder.chrome.effects.reverse")}</Label>
              <Switch
                checked={Boolean(e.scrollingReverse)}
                onCheckedChange={(v) => patch({ scrollingReverse: v })}
              />
            </div>
          </>
        ) : null}
      </Section>

      <Section title={t("pages.pageBuilder.chrome.effects.mouse")}>
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[11px] text-editor-fg">{t("pages.pageBuilder.chrome.effects.tilt")}</Label>
          <Switch
            checked={Boolean(e.mouseTilt)}
            onCheckedChange={(v) => patch({ mouseTilt: v })}
          />
        </div>
        {e.mouseTilt ? (
          <NumberField
            label={t("pages.pageBuilder.chrome.effects.maxDeg")}
            value={e.mouseTiltMaxDeg ?? 8}
            min={1}
            max={30}
            onChange={(v) => patch({ mouseTiltMaxDeg: v })}
          />
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[11px] text-editor-fg">{t("pages.pageBuilder.chrome.effects.track")}</Label>
          <Switch
            checked={Boolean(e.mouseTrack)}
            onCheckedChange={(v) => patch({ mouseTrack: v })}
          />
        </div>
        {e.mouseTrack ? (
          <NumberField
            label={t("pages.pageBuilder.chrome.effects.trackPx")}
            value={e.mouseTrackPx ?? 12}
            min={1}
            max={60}
            onChange={(v) => patch({ mouseTrackPx: v })}
          />
        ) : null}
      </Section>

      <Section title={t("pages.pageBuilder.chrome.effects.sticky")}>
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[11px] text-editor-fg">{t("pages.pageBuilder.chrome.effects.pin")}</Label>
          <Switch checked={Boolean(e.sticky)} onCheckedChange={(v) => patch({ sticky: v })} />
        </div>
        {e.sticky ? (
          <NumberField
            label={t("pages.pageBuilder.chrome.effects.stickyOffset")}
            value={e.stickyOffsetPx ?? 0}
            min={0}
            max={400}
            onChange={(v) => patch({ stickyOffsetPx: v })}
          />
        ) : null}
      </Section>

      <Section title={t("pages.pageBuilder.chrome.effects.continuous")}>
        <SelectField
          label={t("pages.pageBuilder.chrome.effects.loop")}
          value={e.continuousAnimation ?? "none"}
          options={localizeOptions(CONTINUOUS_ANIMATION_OPTIONS, CONTINUOUS_KEYS, t)}
          onChange={(v) => patch({ continuousAnimation: v })}
        />
        {(e.continuousAnimation || "none") !== "none" ? (
          <NumberField
            label={t("pages.pageBuilder.chrome.effects.cycle")}
            value={e.continuousDurationMs ?? 3000}
            min={400}
            max={20000}
            onChange={(v) => patch({ continuousDurationMs: v })}
          />
        ) : null}
      </Section>

      <Section title={t("pages.pageBuilder.chrome.effects.path")}>
        <p className="text-[10px] leading-relaxed text-editor-fg-muted -mt-1">
          {t("pages.pageBuilder.chrome.effects.pathHint")}
        </p>
        <SelectField
          label={t("pages.pageBuilder.chrome.effects.pathLabel")}
          value={e.motionPath ?? "none"}
          options={localizeOptions(MOTION_PATH_OPTIONS, PATH_KEYS, t)}
          onChange={(v) => patch({ motionPath: v })}
        />
        {(e.motionPath || "none") !== "none" ? (
          <>
            <NumberField
              label={t("pages.pageBuilder.widgets.fields.durationMs")}
              value={e.motionPathDurationMs ?? 4000}
              min={600}
              max={30000}
              onChange={(v) => patch({ motionPathDurationMs: v })}
            />
            <div className="flex items-center justify-between gap-2">
              <Label className="text-[11px] text-editor-fg">{t("pages.pageBuilder.chrome.effects.loop")}</Label>
              <Switch
                checked={e.motionPathLoop !== false}
                onCheckedChange={(v) => patch({ motionPathLoop: v })}
              />
            </div>
          </>
        ) : null}
      </Section>

      <Section title={t("pages.pageBuilder.chrome.effects.transformSection")}>
        <TextareaField
          label={t("pages.pageBuilder.chrome.effects.transformNormal")}
          value={e.transform ?? ""}
          onChange={(v) => patch({ transform: v.trim() ? v : undefined })}
          rows={2}
          placeholder={t("pages.pageBuilder.chrome.effects.transformPh")}
        />
        <NumberField
          label={t("pages.pageBuilder.chrome.effects.hoverDuration")}
          value={e.transitionDurationMs ?? 280}
          min={0}
          max={5000}
          onChange={(v) => patch({ transitionDurationMs: v })}
        />
        <SelectField
          label={t("pages.pageBuilder.chrome.effects.transitionCurve")}
          value={e.transitionEasing ?? "cubic-bezier(0.4, 0, 0.2, 1)"}
          options={localizeOptions(EASING_PRESET_OPTIONS, EASING_KEYS, t)}
          onChange={(v) => patch({ transitionEasing: v })}
        />
      </Section>

      <Section title={t("pages.pageBuilder.chrome.effects.hoverSection")}>
        <SelectField
          label={t("pages.pageBuilder.chrome.effects.hoverPreset")}
          value={hoverPresetMatch ? (e.hoverTransform ?? "") : ""}
          options={localizeOptions(HOVER_PRESET_OPTIONS, HOVER_KEYS, t)}
          onChange={(v) => patch({ hoverTransform: v.trim() ? v : undefined })}
        />
        <TextareaField
          label={t("pages.pageBuilder.chrome.effects.transformCustom")}
          value={e.hoverTransform ?? ""}
          onChange={(v) => patch({ hoverTransform: v.trim() ? v : undefined })}
          rows={2}
          placeholder="scale(1.05) translateY(-2px)"
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.effects.hoverText")}
          value={e.hoverColor ?? ""}
          onChange={(v) => patch({ hoverColor: v.trim() ? v : undefined })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.effects.hoverBg")}
          value={e.hoverBackground ?? ""}
          onChange={(v) => patch({ hoverBackground: v.trim() ? v : undefined })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.effects.hoverBorder")}
          value={e.hoverBorderColor ?? ""}
          onChange={(v) => patch({ hoverBorderColor: v.trim() ? v : undefined })}
        />
        <TextareaField
          label={t("pages.pageBuilder.chrome.effects.hoverShadow")}
          value={e.hoverBoxShadow ?? ""}
          onChange={(v) => patch({ hoverBoxShadow: v.trim() ? v : undefined })}
          rows={2}
          placeholder="0 8px 24px rgba(0,0,0,0.18)"
        />
        <NumberField
          label={t("pages.pageBuilder.chrome.effects.hoverOpacity")}
          value={typeof e.hoverOpacity === "number" ? e.hoverOpacity : 1}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => patch({ hoverOpacity: v })}
        />
      </Section>
    </>
  );
}
