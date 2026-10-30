/** Catálogo de tipografias do editor (Elementor-like). */

export type TypographyFontPreset = {
  id: string;
  label: string;
  /** CSS font-family stack. */
  value: string;
  /** Google Fonts family query fragment, ou null se for só sistema. */
  google: string | null;
  category: "system" | "sans" | "serif" | "display" | "mono";
};

export const TYPOGRAPHY_FONT_PRESETS: TypographyFontPreset[] = [
  {
    id: "system",
    label: "Sistema",
    value: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    google: null,
    category: "system",
  },
  {
    id: "inter",
    label: "Inter",
    value: "Inter, system-ui, sans-serif",
    google: "Inter:wght@300;400;500;600;700;800;900",
    category: "sans",
  },
  {
    id: "jakarta",
    label: "Plus Jakarta Sans",
    value: "'Plus Jakarta Sans', system-ui, sans-serif",
    google: "Plus+Jakarta+Sans:wght@400;500;600;700;800",
    category: "sans",
  },
  {
    id: "dm-sans",
    label: "DM Sans",
    value: "'DM Sans', system-ui, sans-serif",
    google: "DM+Sans:wght@400;500;600;700",
    category: "sans",
  },
  {
    id: "manrope",
    label: "Manrope",
    value: "Manrope, system-ui, sans-serif",
    google: "Manrope:wght@400;500;600;700;800",
    category: "sans",
  },
  {
    id: "outfit",
    label: "Outfit",
    value: "Outfit, system-ui, sans-serif",
    google: "Outfit:wght@300;400;500;600;700;800",
    category: "sans",
  },
  {
    id: "poppins",
    label: "Poppins",
    value: "Poppins, system-ui, sans-serif",
    google: "Poppins:wght@300;400;500;600;700;800",
    category: "sans",
  },
  {
    id: "montserrat",
    label: "Montserrat",
    value: "Montserrat, system-ui, sans-serif",
    google: "Montserrat:wght@400;500;600;700;800;900",
    category: "sans",
  },
  {
    id: "space-grotesk",
    label: "Space Grotesk",
    value: "'Space Grotesk', system-ui, sans-serif",
    google: "Space+Grotesk:wght@400;500;600;700",
    category: "sans",
  },
  {
    id: "sora",
    label: "Sora",
    value: "Sora, system-ui, sans-serif",
    google: "Sora:wght@400;500;600;700;800",
    category: "sans",
  },
  {
    id: "georgia",
    label: "Georgia",
    value: "Georgia, 'Times New Roman', Times, serif",
    google: null,
    category: "serif",
  },
  {
    id: "playfair",
    label: "Playfair Display",
    value: "'Playfair Display', Georgia, serif",
    google: "Playfair+Display:wght@400;500;600;700;800",
    category: "serif",
  },
  {
    id: "libre-baskerville",
    label: "Libre Baskerville",
    value: "'Libre Baskerville', Georgia, serif",
    google: "Libre+Baskerville:wght@400;700",
    category: "serif",
  },
  {
    id: "lora",
    label: "Lora",
    value: "Lora, Georgia, serif",
    google: "Lora:wght@400;500;600;700",
    category: "serif",
  },
  {
    id: "instrument-serif",
    label: "Instrument Serif",
    value: "'Instrument Serif', Georgia, serif",
    google: "Instrument+Serif:wght@400",
    category: "display",
  },
  {
    id: "bebas",
    label: "Bebas Neue",
    value: "'Bebas Neue', Impact, sans-serif",
    google: "Bebas+Neue",
    category: "display",
  },
  {
    id: "oswald",
    label: "Oswald",
    value: "Oswald, Impact, sans-serif",
    google: "Oswald:wght@400;500;600;700",
    category: "display",
  },
  {
    id: "jetbrains",
    label: "JetBrains Mono",
    value: "'JetBrains Mono', ui-monospace, monospace",
    google: "JetBrains+Mono:wght@400;500;600;700",
    category: "mono",
  },
  {
    id: "ibm-plex-mono",
    label: "IBM Plex Mono",
    value: "'IBM Plex Mono', ui-monospace, monospace",
    google: "IBM+Plex+Mono:wght@400;500;600;700",
    category: "mono",
  },
];

export const TYPOGRAPHY_SIZE_PRESETS: Array<{ label: string; px: number }> = [
  { label: "XS", px: 12 },
  { label: "S", px: 14 },
  { label: "M", px: 16 },
  { label: "L", px: 18 },
  { label: "XL", px: 24 },
  { label: "2XL", px: 32 },
  { label: "3XL", px: 40 },
  { label: "4XL", px: 48 },
  { label: "5XL", px: 64 },
  { label: "Hero", px: 72 },
];

export const TYPOGRAPHY_WEIGHT_LABELS: Record<number, string> = {
  100: "100 Thin",
  200: "200 Extra light",
  300: "300 Light",
  400: "400 Regular",
  500: "500 Medium",
  600: "600 Semi-bold",
  700: "700 Bold",
  800: "800 Extra bold",
  900: "900 Black",
};

const loadedGoogleQueries = new Set<string>();

/** Carrega Google Fonts sob demanda (editor + página pública). */
export function ensureGoogleFontLoaded(googleQuery: string | null | undefined): void {
  if (!googleQuery || typeof document === "undefined") return;
  if (loadedGoogleQueries.has(googleQuery)) return;
  loadedGoogleQueries.add(googleQuery);
  const id = `pb-gf-${googleQuery.replace(/[^a-zA-Z0-9]+/g, "-")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${googleQuery}&display=swap`;
  document.head.appendChild(link);
}

export function ensureFontFamilyLoaded(fontFamily: string | undefined | null): void {
  const raw = fontFamily?.trim();
  if (!raw) return;
  const preset = TYPOGRAPHY_FONT_PRESETS.find(
    (p) => p.value === raw || raw.startsWith(p.value.split(",")[0]!.replace(/['"]/g, "")),
  );
  if (preset?.google) {
    ensureGoogleFontLoaded(preset.google);
    return;
  }
  // Família custom: tenta primeiro token como Google Font name.
  const first = raw.split(",")[0]?.replace(/['"]/g, "").trim();
  if (!first || /system-ui|serif|sans-serif|monospace|Segoe|Georgia|Times|Roboto|Arial|Helvetica/i.test(first)) {
    return;
  }
  ensureGoogleFontLoaded(`${first.replace(/ /g, "+")}:wght@400;500;600;700;800`);
}

export function matchFontPresetId(fontFamily: string | undefined | null): string {
  const raw = fontFamily?.trim() ?? "";
  if (!raw) return "system";
  const hit = TYPOGRAPHY_FONT_PRESETS.find((p) => p.value === raw);
  if (hit) return hit.id;
  const first = raw.split(",")[0]?.replace(/['"]/g, "").trim().toLowerCase() ?? "";
  const byName = TYPOGRAPHY_FONT_PRESETS.find((p) => {
    const name = p.value.split(",")[0]?.replace(/['"]/g, "").trim().toLowerCase();
    return name === first;
  });
  return byName?.id ?? "custom";
}

/** Percorre o documento e carrega as famílias usadas (canvas + público). */
export function ensurePageDocumentFonts(doc: {
  settings?: { globalDesign?: { fontPrimary?: string; fontSecondary?: string } };
  sections?: Array<{
    columns?: Array<{
      widgets?: Array<{
        styles?: { typography?: { desktop?: { fontFamily?: string }; tablet?: { fontFamily?: string }; mobile?: { fontFamily?: string } } };
      }>;
    }>;
  }>;
}): void {
  const g = doc.settings?.globalDesign;
  ensureFontFamilyLoaded(g?.fontPrimary);
  ensureFontFamilyLoaded(g?.fontSecondary);
  for (const section of doc.sections ?? []) {
    for (const col of section.columns ?? []) {
      for (const widget of col.widgets ?? []) {
        const ty = widget.styles?.typography;
        ensureFontFamilyLoaded(ty?.desktop?.fontFamily);
        ensureFontFamilyLoaded(ty?.tablet?.fontFamily);
        ensureFontFamilyLoaded(ty?.mobile?.fontFamily);
      }
    }
  }
}
