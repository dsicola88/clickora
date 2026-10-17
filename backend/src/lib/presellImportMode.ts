import type { BrowserRenderStatus } from "./presellFoldBrowser";
import type { PresellGenerationNiche } from "./presellGenerationNiche";

/** Modo explícito. `mirror` não é uma cópia 1:1: o visitante não executa o JavaScript da origem. */
export type PresellImportMode = "mirror" | "template" | "incomplete";

export type ClassifiedPresellImport = {
  mode: PresellImportMode;
  /** Só o espelho renderizado pode ser publicado automaticamente. */
  publishable: boolean;
  notes: string[];
};

const MIRROR_MIN_CHARS = 800;
const SOURCE_TEXT_MIN = 180;

const GENERIC_TITLE =
  /^(example domain|just a moment\.{0,3}|attention required!?|access denied|403 forbidden|404( not found)?|page not found|untitled( document)?|loading\.{0,3}|enable javascript|please wait|document|home|welcome|new (page|presell)|nova presell|oficial|official( site)?|pv\s*v?\d*|get started|text presentation)$/i;

/** Frases de compra presentes no HTML da origem. Não trata «Get started» nem um texto longo como oferta. */
const SOURCE_COMMERCIAL_CTA =
  /\b(buy now|order now|add to cart|shop now|checkout now|comprar agora|adicionar ao carrinho|encomendar agora|get yours now|claim your (discount|offer))\b/i;

export function sourceHasCommercialCta(text: string): boolean {
  return SOURCE_COMMERCIAL_CTA.test(text);
}

/**
 * Título útil para publicar. Marcas curtas (Yusleep, Visivra) são válidas;
 * só rejeita placeholders e títulos quase vazios.
 */
export function isGenericImportTitle(title: string): boolean {
  const value = title.trim().replace(/\s+/g, " ");
  if (value.length < 3) return true;
  if (/^[\d\W_]+$/.test(value)) return true;
  return GENERIC_TITLE.test(value);
}

export function classifyPresellImport(args: {
  mirrorChars: number;
  imageCount: number;
  salesChars: number;
  title: string;
  browser: BrowserRenderStatus | "skipped";
  /** Texto lido da página, sem o modelo de locale. */
  sourceTextChars?: number;
  headingCount?: number;
  hasPrice?: boolean;
  hasSourceCta?: boolean;
  generationNiche?: PresellGenerationNiche;
}): ClassifiedPresellImport {
  const notes: string[] = [];
  const niche = args.generationNiche ?? "black";
  const titleOk = !isGenericImportTitle(args.title);
  const hasImages = args.imageCount > 0;
  const hasCopy = (args.sourceTextChars ?? args.salesChars) >= SOURCE_TEXT_MIN;
  const hasMirror = args.mirrorChars >= MIRROR_MIN_CHARS;

  if (args.browser === "disabled") {
    notes.push("A renderização no browser está desligada (PRESELL_DISABLE_PLAYWRIGHT). Não há espelho da página original.");
  } else if (args.browser === "unavailable") {
    notes.push("O Chromium não está disponível neste servidor. O espelho renderizado não correu. Em produção a imagem Docker instala o browser; localmente é preciso `npx playwright install chromium`.");
  } else if (args.browser === "failed") {
    notes.push("O browser de importação falhou ou esgotou o tempo. A página pode bloquear datacenters, exigir login ou depender de serviços externos.");
  } else if (args.browser === "empty") {
    notes.push("O browser abriu a página, mas o espelho ficou vazio ou abaixo do mínimo. A origem pode ser só JavaScript que não chegou a desenhar o corpo.");
  }

  if (!hasImages) {
    notes.push(
      "Nenhuma imagem de produto foi encontrada. Não é usada uma imagem genérica. Pode indicar uma imagem real no editor.",
    );
  }

  if (hasMirror) {
    notes.push(
      niche === "white"
        ? "Modo white: espelho visual da sales page (sem JavaScript da origem). CTAs rastreados apontam para o teu hoplink; aviso de cookies não substitui o CTA da oferta."
        : "Modo black: a sales page agressiva não é copiada para o anúncio. Só nome e fotos da origem; texto informativo (Google/Bing).",
    );
  } else if (niche === "black") {
    notes.push(
      "Modo black: página informativa à prova de bloqueio com imagens da origem. Sem clonar claims da oferta. Sem espelho Playwright no anúncio.",
    );
  } else {
    notes.push("Modo white: textos e subtítulo extraídos da página; espelho indisponível nesta importação.");
  }
  if (niche === "black") {
    notes.push("Black: o hoplink fica no gate (cookies, desconto…). Não invente contacto — vem da origem quando existir.");
  } else {
    notes.push("White: copy e políticas alinhadas ao produtor; tipos agressivos ocultos no assistente.");
  }
  const hasOfferSignal = Boolean(args.hasPrice || args.hasSourceCta || hasCopy || hasMirror);
  if (titleOk && (hasImages || hasOfferSignal)) {
    notes.push("Presell própria, com os dados lidos na origem. Não é um clone da página do vendedor.");
    return { mode: "template", publishable: true, notes };
  }

  if (!titleOk) {
    notes.push("O título é genérico, curto ou de uma página de exemplo. Isso não chega para publicar.");
  }
  if (!hasImages && !hasOfferSignal) {
    notes.push("Não há imagem, texto, preço nem chamada de compra úteis na origem.");
  }
  notes.push(
    "Importação incompleta. A página fica em rascunho. Pode tentar de novo ou passar ao editor manual. Não foi publicada uma aproximação como se fosse a landing original.",
  );
  return { mode: "incomplete", publishable: false, notes };
}
