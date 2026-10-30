/** Estruturas de colunas — partilhadas pelo canvas e pelo painel. */
export const SECTION_LAYOUTS: Array<{ label: string; widths: number[]; title: string }> = [
  { label: "1", widths: [100], title: "1 coluna" },
  { label: "2", widths: [50, 50], title: "2 colunas iguais" },
  { label: "3", widths: [33, 34, 33], title: "3 colunas" },
  { label: "4", widths: [25, 25, 25, 25], title: "4 colunas" },
  { label: "1/3", widths: [33, 67], title: "1/3 + 2/3" },
  { label: "2/3", widths: [67, 33], title: "2/3 + 1/3" },
  { label: "20/60/20", widths: [20, 60, 20], title: "Logo + menu + CTA" },
  { label: "45/55", widths: [45, 55], title: "Imagem + texto (hero)" },
];
