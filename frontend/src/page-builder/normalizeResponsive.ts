import type { ColumnNode, PageDocument, SectionNode } from "./types";

/**
 * Garante que multi-coluna empilha no telemóvel (e no tablet por defeito)
 * sem o autor ter de configurar breakpoints à mão.
 */
export function normalizeColumnWidthPercent(column: ColumnNode, multiColumn: boolean): ColumnNode {
  const desktop = column.widthPercent?.desktop ?? 100;
  if (!multiColumn) {
    column.widthPercent = {
      desktop,
      tablet: column.widthPercent?.tablet ?? desktop,
      mobile: column.widthPercent?.mobile ?? desktop,
    };
    return column;
  }

  column.widthPercent = {
    desktop,
    tablet: column.widthPercent?.tablet ?? 100,
    mobile: 100,
  };
  return column;
}

export function normalizeSectionResponsive(section: SectionNode): SectionNode {
  const multi = section.columns.length > 1;
  for (const col of section.columns) {
    normalizeColumnWidthPercent(col, multi);
  }
  /** 3+ colunas: força tablet a 100% para não esmagar conteúdo. */
  if (section.columns.length >= 3) {
    for (const col of section.columns) {
      if (col.widthPercent) {
        col.widthPercent.tablet = 100;
        col.widthPercent.mobile = 100;
      }
    }
  }
  return section;
}

/** Clona e normaliza o documento para publicação / hidratação segura. */
export function normalizePageDocumentResponsive(doc: PageDocument): PageDocument {
  const next: PageDocument = {
    ...doc,
    sections: doc.sections.map((sec) => ({
      ...sec,
      columns: sec.columns.map((col) => ({
        ...col,
        widthPercent: col.widthPercent ? { ...col.widthPercent } : { desktop: 100 },
      })),
    })),
  };
  for (const section of next.sections) {
    normalizeSectionResponsive(section);
  }
  return next;
}

/** Mutação in-place ao criar/alterar colunas no editor. */
export function applyResponsiveColumnWidths(
  columns: ColumnNode[],
  desktopPercents?: number[],
): void {
  const multi = columns.length > 1;
  const n = columns.length || 1;
  columns.forEach((c, i) => {
    const desktop =
      desktopPercents?.[i] ?? c.widthPercent?.desktop ?? Math.floor(100 / n);
    c.widthPercent = {
      desktop,
      tablet: multi ? 100 : desktop,
      mobile: multi ? 100 : desktop,
    };
  });
}
