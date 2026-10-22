import type { ComponentType, CSSProperties } from "react";
import * as Icons from "lucide-react";

type LucideComp = ComponentType<{ size?: number; color?: string; style?: CSSProperties }>;

/** Resolve nomes Lucide (`arrow-right`, `ShoppingCart`, `check`) para o componente. */
export function resolveLucideIcon(name: string): LucideComp | null {
  const raw = name.trim();
  if (!raw) return null;
  const pascal = raw.includes("-") || raw.includes("_") || raw.includes(" ")
    ? raw
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join("")
    : raw.charAt(0).toUpperCase() + raw.slice(1);
  const Comp = (Icons as unknown as Record<string, LucideComp>)[pascal];
  return Comp ?? null;
}

export function resolveLucideIconOr(
  name: string,
  fallback: LucideComp,
): LucideComp {
  return resolveLucideIcon(name) ?? fallback;
}
