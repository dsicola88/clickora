import type { CSSProperties, ReactNode } from "react";
import type { PageDocument, PageGlobalDesign } from "./types";

const DEFAULTS: Required<PageGlobalDesign> = {
  primary: "#0f172a",
  secondary: "#334155",
  text: "#1e293b",
  accent: "#e63946",
  muted: "#64748b",
  fontPrimary: "Inter, system-ui, sans-serif",
  fontSecondary: "Georgia, 'Times New Roman', serif",
};

export function resolveGlobalDesign(
  settings: PageDocument["settings"] | undefined,
): Required<PageGlobalDesign> {
  const g = settings?.globalDesign ?? {};
  return {
    primary: g.primary?.trim() || DEFAULTS.primary,
    secondary: g.secondary?.trim() || DEFAULTS.secondary,
    text: g.text?.trim() || DEFAULTS.text,
    accent: g.accent?.trim() || DEFAULTS.accent,
    muted: g.muted?.trim() || DEFAULTS.muted,
    fontPrimary: g.fontPrimary?.trim() || DEFAULTS.fontPrimary,
    fontSecondary: g.fontSecondary?.trim() || DEFAULTS.fontSecondary,
  };
}

/** Injeta CSS variables --pb-* no canvas / página pública (kit global). */
export function PageGlobalDesignVars({
  settings,
  children,
}: {
  settings: PageDocument["settings"];
  children: ReactNode;
}) {
  const g = resolveGlobalDesign(settings);
  const style: CSSProperties & Record<`--pb-${string}`, string> = {
    ["--pb-primary"]: g.primary,
    ["--pb-secondary"]: g.secondary,
    ["--pb-text"]: g.text,
    ["--pb-accent"]: g.accent,
    ["--pb-muted"]: g.muted,
    ["--pb-font-primary"]: g.fontPrimary,
    ["--pb-font-secondary"]: g.fontSecondary,
    color: g.text,
    fontFamily: g.fontPrimary,
  };
  return <div style={style}>{children}</div>;
}
