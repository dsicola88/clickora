import type { BrowserRenderStatus } from "./presellFoldBrowser";

/** Modo explícito. `mirror` não é uma cópia 1:1: o visitante não executa o JavaScript da origem. */
export type PresellImportMode = "mirror" | "template" | "incomplete";

export type ClassifiedPresellImport = {
  mode: PresellImportMode;
  /** Só o espelho renderizado pode ser publicado automaticamente. */
  publishable: boolean;
  notes: string[];
};

const MIRROR_MIN_CHARS = 800;

export function classifyPresellImport(args: {
  mirrorChars: number;
  imageCount: number;
  salesChars: number;
  title: string;
  browser: BrowserRenderStatus | "skipped";
}): ClassifiedPresellImport {
  const notes: string[] = [];
  const titleOk = args.title.trim().length >= 8;
  const hasImages = args.imageCount > 0;
  const hasCopy = args.salesChars >= 180;
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
      "Espelho renderizado guardado. O iframe da presell não executa o JavaScript da origem: vídeo, galerias e preços que só aparecem por script podem faltar. Isto não é uma cópia fiel.",
    );
    return { mode: "mirror", publishable: true, notes };
  }

  if (titleOk && (hasImages || hasCopy)) {
    notes.push(
      "Modelo editável: foram extraídos título, texto e imagens disponíveis. Não é a página original. A publicação automática fica em rascunho até rever e publicar.",
    );
    return { mode: "template", publishable: false, notes };
  }

  notes.push(
    "Importação incompleta. A página fica em rascunho. Pode tentar de novo ou passar ao editor manual. Não foi publicada uma aproximação como se fosse a landing original.",
  );
  return { mode: "incomplete", publishable: false, notes };
}
