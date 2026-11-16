import type { CSSProperties } from "react";
import type { PageDocument } from "./types";

export type PageBackgroundType = "solid" | "gradient" | "image";

export type PageBackgroundSettings = Pick<
  PageDocument["settings"],
  | "background"
  | "backgroundType"
  | "backgroundSolid"
  | "backgroundGradient"
  | "backgroundImageUrl"
  | "backgroundImageSize"
  | "backgroundImagePosition"
  | "backgroundImageRepeat"
>;

function cssUrl(url: string): string {
  return `url("${url.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}")`;
}

/** Infere o tipo a partir do CSS legado em `settings.background`. */
export function inferPageBackgroundType(background?: string): PageBackgroundType {
  const b = (background ?? "").trim().toLowerCase();
  if (!b) return "solid";
  if (b.includes("gradient(")) return "gradient";
  if (b.includes("url(")) return "image";
  return "solid";
}

export function resolvePageBackgroundType(
  settings: PageBackgroundSettings | undefined,
): PageBackgroundType {
  if (!settings) return "solid";
  if (settings.backgroundType) return settings.backgroundType;
  return inferPageBackgroundType(settings.background);
}

/** CSS aplicado no canvas / página pública / export. */
export function resolvePageBackgroundStyle(
  settings: PageBackgroundSettings | undefined,
): CSSProperties {
  const s = settings ?? {};
  const type = resolvePageBackgroundType(s);
  const solid =
    (s.backgroundSolid ?? (type === "solid" ? s.background : undefined) ?? "#ffffff").trim() ||
    "#ffffff";
  const gradient = (
    s.backgroundGradient ?? (type === "gradient" ? s.background : undefined) ??
    ""
  ).trim();
  const imageUrl = (s.backgroundImageUrl ?? "").trim();

  if (type === "gradient" && gradient) {
    return { background: gradient };
  }

  if (type === "image" && imageUrl) {
    return {
      backgroundColor: solid,
      backgroundImage: cssUrl(imageUrl),
      backgroundSize: s.backgroundImageSize ?? "cover",
      backgroundPosition: s.backgroundImagePosition ?? "center center",
      backgroundRepeat: s.backgroundImageRepeat ?? "no-repeat",
    };
  }

  /** Legado sem `backgroundType`: respeitar a string CSS tal como está. */
  if (!s.backgroundType && (s.background ?? "").trim()) {
    return { background: s.background!.trim() };
  }

  return { background: solid };
}

/**
 * Valor único em `settings.background` para compatibilidade com templates/testes.
 * Imagem fica como shorthand incompleto — o style resolver usa os campos estruturados.
 */
export function serializePageBackground(input: {
  type: PageBackgroundType;
  solid?: string;
  gradient?: string;
  imageUrl?: string;
  imageSize?: "cover" | "contain" | "auto";
  imagePosition?: string;
  imageRepeat?: string;
}): string {
  const solid = (input.solid ?? "#ffffff").trim() || "#ffffff";
  if (input.type === "gradient") {
    return (input.gradient ?? "").trim() || solid;
  }
  if (input.type === "image") {
    const url = (input.imageUrl ?? "").trim();
    if (!url) return solid;
    const size = input.imageSize ?? "cover";
    const pos = input.imagePosition ?? "center center";
    const repeat = input.imageRepeat ?? "no-repeat";
    return `${solid} ${cssUrl(url)} ${pos} / ${size} ${repeat}`;
  }
  return solid;
}
