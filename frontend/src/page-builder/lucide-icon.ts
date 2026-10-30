import {
  createElement,
  lazy,
  Suspense,
  type ComponentType,
  type CSSProperties,
} from "react";
import dynamicIconImports from "lucide-react/dynamicIconImports";

type LucideComp = ComponentType<{
  size?: number;
  color?: string;
  style?: CSSProperties;
  className?: string;
}>;

type DynamicIconKey = keyof typeof dynamicIconImports;

const cache = new Map<string, LucideComp>();

function toKebabKey(name: string): string {
  const raw = name.trim();
  if (!raw) return "";
  if (raw.includes("-") || raw.includes("_") || raw.includes(" ")) {
    return raw
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((p) => p.toLowerCase())
      .join("-");
  }
  // PascalCase / camelCase → kebab-case (ShoppingCart → shopping-cart)
  return raw
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

/**
 * Resolve nomes Lucide (`arrow-right`, `ShoppingCart`, `check`) sem importar o barrel
 * completo (~760 kB). Cada ícone é um `import()` dinâmico.
 */
export function resolveLucideIcon(name: string): LucideComp | null {
  const key = toKebabKey(name) as DynamicIconKey;
  if (!key || !(key in dynamicIconImports)) return null;

  const cached = cache.get(key);
  if (cached) return cached;

  const loader = dynamicIconImports[key];
  const LazyIcon = lazy(async () => {
    const mod = await loader();
    const Comp = (mod as { default: LucideComp }).default;
    return { default: Comp };
  });

  const Wrapper: LucideComp = (props) =>
    createElement(Suspense, { fallback: null }, createElement(LazyIcon, props));
  Wrapper.displayName = `LucideDynamic(${key})`;
  cache.set(key, Wrapper);
  return Wrapper;
}

export function resolveLucideIconOr(name: string, fallback: LucideComp): LucideComp {
  return resolveLucideIcon(name) ?? fallback;
}
