import { cn } from "@/lib/utils";

export type RichTextFontFamily = "sans" | "serif" | "mono";
export type RichTextFontSize = "xs" | "sm" | "base" | "lg" | "xl" | "2xl";
export type RichTextFontWeight = "normal" | "medium" | "semibold" | "bold";
export type RichTextAlign = "left" | "center" | "right";

export function richTextFontSizeClass(size: RichTextFontSize | undefined): string {
  switch (size ?? "base") {
    case "xs":
      return "text-xs";
    case "sm":
      return "text-sm";
    case "base":
      return "text-base md:text-[1.07rem]";
    case "lg":
      return "text-lg md:text-xl";
    case "xl":
      return "text-xl md:text-2xl";
    case "2xl":
      return "text-2xl md:text-3xl";
    default:
      return "text-base md:text-[1.07rem]";
  }
}

export function richTextFontFamilyClass(family: RichTextFontFamily | undefined): string {
  switch (family ?? "sans") {
    case "serif":
      return "font-serif";
    case "mono":
      return "font-mono";
    default:
      return "font-sans";
  }
}

export function richTextFontWeightClass(weight: RichTextFontWeight | undefined): string {
  switch (weight ?? "normal") {
    case "medium":
      return "font-medium";
    case "semibold":
      return "font-semibold";
    case "bold":
      return "font-bold";
    default:
      return "font-normal";
  }
}

export function richTextAlignClass(align: RichTextAlign | undefined): string {
  switch (align ?? "left") {
    case "center":
      return "text-center";
    case "right":
      return "text-right";
    default:
      return "text-left";
  }
}

export function richTextBlockWrapperClass(bg: string | null | undefined): string {
  const hasBg = Boolean(bg?.trim());
  return cn(
    hasBg && "rounded-2xl border border-white/10 px-5 py-7 shadow-sm md:px-8 md:py-9",
    !hasBg && "px-0 py-1",
  );
}
