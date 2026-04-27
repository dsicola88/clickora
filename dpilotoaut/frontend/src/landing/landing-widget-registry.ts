/**
 * Registo de widgets da landing (padrão alinhado a `build_dpa/src/builder/widget-registry.ts`).
 * Categorias, rótulos e ícones — base para a palete no editor e rótulos no canvas/inspector.
 */
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpDown,
  Clock3,
  Code,
  Columns2,
  Film,
  Heading1,
  Image as ImageIcon,
  LayoutGrid,
  LayoutTemplate,
  ListChecks,
  MapPin,
  MessageSquareQuote,
  Minus,
  MousePointerClick,
  PanelsTopLeft,
  Send,
  Tag,
  Type,
} from "lucide-react";

import type { WidgetType } from "@/lib/landing-document";

export type LandingWidgetCategoryId = "basic" | "content" | "media" | "layout" | "commerce" | "advanced";

export interface LandingWidgetDefinition {
  type: WidgetType;
  label: string;
  /** Dica curta na palete (opcional) */
  hint?: string;
  category: LandingWidgetCategoryId;
  icon: LucideIcon;
}

export const LANDING_WIDGET_CATEGORIES: Array<{ id: LandingWidgetCategoryId; label: string }> = [
  { id: "basic", label: "Básico" },
  { id: "content", label: "Conteúdo" },
  { id: "media", label: "Mídia" },
  { id: "layout", label: "Layout" },
  { id: "commerce", label: "Comercial" },
  { id: "advanced", label: "Avançado" },
];

export const LANDING_WIDGET_REGISTRY: Record<WidgetType, LandingWidgetDefinition> = {
  hero: {
    type: "hero",
    label: "Hero",
    hint: "Título, subtítulo e CTAs",
    category: "basic",
    icon: LayoutTemplate,
  },
  heading: {
    type: "heading",
    label: "Título",
    hint: "H1–H6",
    category: "basic",
    icon: Heading1,
  },
  text: {
    type: "text",
    label: "Texto",
    category: "basic",
    icon: Type,
  },
  image: {
    type: "image",
    label: "Imagem",
    category: "media",
    icon: ImageIcon,
  },
  button: {
    type: "button",
    label: "Botão",
    category: "basic",
    icon: MousePointerClick,
  },
  spacer: {
    type: "spacer",
    label: "Espaçador",
    category: "layout",
    icon: ArrowUpDown,
  },
  divider: {
    type: "divider",
    label: "Divisor",
    category: "layout",
    icon: Minus,
  },
  pricing: {
    type: "pricing",
    label: "Preços (3 planos + teste grátis)",
    hint: "Mensal / trimestral / anual + plano de teste personalizável",
    category: "commerce",
    icon: Tag,
  },
  icon_list: {
    type: "icon_list",
    label: "Lista com ícones",
    category: "commerce",
    icon: ListChecks,
  },
  html: {
    type: "html",
    label: "HTML",
    category: "advanced",
    icon: Code,
  },
  video: {
    type: "video",
    label: "Vídeo",
    hint: "YouTube, Vimeo ou URL de incorporação",
    category: "media",
    icon: Film,
  },
  accordion: {
    type: "accordion",
    label: "Acordeão (FAQ)",
    hint: "Perguntas e respostas expansíveis",
    category: "content",
    icon: PanelsTopLeft,
  },
  testimonial: {
    type: "testimonial",
    label: "Depoimento",
    hint: "Citação, autor e função (opcional)",
    category: "content",
    icon: MessageSquareQuote,
  },
  embed: {
    type: "embed",
    label: "Incorporar (iframe)",
    hint: "Mapa, vídeo, iframe (URLs https confiáveis)",
    category: "media",
    icon: MapPin,
  },
  columns: {
    type: "columns",
    label: "Colunas",
    hint: "2–4 colunas, HTML por célula (responsivo)",
    category: "layout",
    icon: Columns2,
  },
  gallery: {
    type: "gallery",
    label: "Galeria",
    hint: "Grelha de imagens com legenda",
    category: "media",
    icon: LayoutGrid,
  },
  form: {
    type: "form",
    label: "Formulário",
    hint: "Campos e envio para URL (https) sua",
    category: "content",
    icon: Send,
  },
  countdown: {
    type: "countdown",
    label: "Contagem",
    hint: "Contagem decrescente até data/hora",
    category: "content",
    icon: Clock3,
  },
};

export const LANDING_WIDGET_LIST: LandingWidgetDefinition[] = Object.values(LANDING_WIDGET_REGISTRY);

export function landingWidgetLabel(type: string): string {
  const d = LANDING_WIDGET_REGISTRY[type as WidgetType];
  return d?.label ?? type;
}

export function filterLandingWidgetsByQuery(query: string): LandingWidgetDefinition[] {
  const q = query.trim().toLowerCase();
  if (!q) return LANDING_WIDGET_LIST;
  return LANDING_WIDGET_LIST.filter(
    (w) =>
      w.label.toLowerCase().includes(q) ||
      w.type.toLowerCase().includes(q) ||
      (w.hint?.toLowerCase().includes(q) ?? false),
  );
}
