import { useMemo } from "react";
import { Eye, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const HEADLINE_MAX = 30;
const DESCRIPTION_MAX = 90;

/** Recorta até `max` caracteres, tentando partir na última palavra da janela. */
export function rsaNextChunk(source: string, max: number): { chunk: string; rest: string } {
  const s = source.trim().replace(/\s+/g, " ");
  if (!s.length) return { chunk: "", rest: "" };
  if (s.length <= max) return { chunk: s, rest: "" };
  const window = s.slice(0, max + 14);
  let cut = max;
  const lastSpace = window.lastIndexOf(" ");
  if (lastSpace >= Math.floor(max * 0.45)) cut = lastSpace;
  const rawChunk = s.slice(0, cut);
  const chunk = rawChunk.trimEnd();
  const rest = s.slice(rawChunk.length).trimStart();
  if (!chunk.length) {
    const hard = s.slice(0, max).trimEnd();
    return { chunk: hard, rest: s.slice(max).trimStart() };
  }
  return { chunk, rest };
}

/** Caminho verde ao estilo Google Ads: domínio + caminhos opcionais do anúncio (path1/path2). */
export function googleAdsRsaDisplayGreenLine(finalUrl: string, path1?: string, path2?: string): string {
  const trimmed = finalUrl.trim();
  const base = trimmed || "https://example.com";
  try {
    const u = new URL(/^https?:\/\//i.test(base) ? base : `https://${base}`);
    const host = u.hostname.replace(/^www\./i, "");
    const p1 = (path1 ?? "").trim().replace(/^\/+|\/+$/g, "");
    const p2 = (path2 ?? "").trim().replace(/^\/+|\/+$/g, "");
    const tail = [p1, p2].filter(Boolean).join("/");
    const pathPart = tail ? `/${tail}` : "";
    const full = `${host}${pathPart}`;
    return full.length > 56 ? `${full.slice(0, 55)}…` : full;
  } catch {
    return "seudominio.com";
  }
}

function displayUrlHostnamePath(landingUrl: string): string {
  const trimmed = landingUrl.trim();
  if (!trimmed) return "seudominio.com";
  try {
    const u = new URL(trimmed);
    const host = u.hostname.replace(/^www\./i, "");
    const path =
      !u.pathname || u.pathname === "/"
        ? ""
        : u.pathname.length > 28
          ? `${u.pathname.slice(0, 26)}…`
          : u.pathname;
    const full = `${host}${path}`;
    return full.length > 52 ? `${full.slice(0, 51)}…` : full;
  } catch {
    return "seudominio.com";
  }
}

export type GoogleSearchAdPreviewProps = {
  landingUrl: string;
  offer: string;
  seedKeyword?: string | null;
  price?: string;
  discount?: string;
  guarantee?: string;
  shipping?: string;
  bundles?: string;
  className?: string;
};

type LineStat = { text: string; len: number; max: number; truncated: boolean };

function buildAssetLines(props: GoogleSearchAdPreviewProps): {
  headlines: LineStat[];
  descriptions: LineStat[];
  headlineJoin: string;
  descriptionPreview: string;
  displaySite: string;
  queryHint: string;
} {
  const base = props.offer.trim() || "";
  let cursor = base.replace(/\s+/g, " ");
  const headlinesRaw: string[] = [];

  for (let i = 0; i < 3; i++) {
    const { chunk, rest } = rsaNextChunk(cursor, HEADLINE_MAX);
    headlinesRaw.push(chunk);
    cursor = rest;
  }

  const signalBits = [
    props.discount?.trim(),
    props.price?.trim(),
    props.guarantee?.trim(),
    props.shipping?.trim(),
    props.bundles
      ?.split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean)[0],
  ].filter(Boolean) as string[];

  const filled = [...headlinesRaw];
  for (let i = 0; i < filled.length; i++) {
    if (!filled[i] && signalBits.length) {
      filled[i] = rsaNextChunk(signalBits.shift()!, HEADLINE_MAX).chunk;
    }
  }

  const headlines: LineStat[] = filled.map((raw) => {
    const emptyPlaceholder = "— Titular exemplo —";
    const slice = raw.length ? raw.slice(0, HEADLINE_MAX) : emptyPlaceholder;
    const sourceLen = raw.length ? Math.min(raw.length, HEADLINE_MAX) : Math.min(emptyPlaceholder.length, HEADLINE_MAX);
    return {
      text: slice,
      len: sourceLen,
      max: HEADLINE_MAX,
      truncated: Boolean(raw.length > HEADLINE_MAX),
    };
  });

  const descSeed =
    cursor.length >= 24
      ? cursor
      : base.length >= 24
        ? base
        : `${base} ${props.price ?? ""} ${props.guarantee ?? ""}`.trim();
  let dCursor = rsaNextChunk(descSeed, DESCRIPTION_MAX).rest || descSeed;
  const descriptionsRaw: string[] = [];
  for (let q = 0; q < 2; q++) {
    const { chunk, rest } = rsaNextChunk(dCursor.length ? dCursor : descSeed, DESCRIPTION_MAX);
    const line =
      chunk ||
      (q === 0
        ? "Adicione uma oferta mais longa ou sinais de produto para preencher as descrições."
        : "Segunda linha de descrição com benefícios e prova social.");
    descriptionsRaw.push(line);
    dCursor = rest;
  }

  const descriptions: LineStat[] = descriptionsRaw.map((raw) => {
    const txt = raw.slice(0, DESCRIPTION_MAX);
    return {
      text: txt,
      len: Math.min(raw.length, DESCRIPTION_MAX),
      max: DESCRIPTION_MAX,
      truncated: raw.length > DESCRIPTION_MAX,
    };
  });

  const hJoin = headlines.map((h) => h.text).join(" · ");
  const queryHint = props.seedKeyword?.trim() || "consulta exemplo";
  const descPreview = descriptions.map((d) => d.text).join(" ");

  return {
    headlines,
    descriptions,
    headlineJoin: hJoin || "Titulares combinados na pesquisa",
    descriptionPreview:
      descPreview.substring(0, 180) ||
      "Texto complementar com beneficios até 90 caracteres por elemento.",
    displaySite: displayUrlHostnamePath(props.landingUrl),
    queryHint,
  };
}

function LenBadge({ len, max, truncated }: { len: number; max: number; truncated?: boolean }) {
  const ratio = len / max;
  const tone =
    truncated || ratio >= 1
      ? "text-amber-600 dark:text-amber-400"
      : ratio >= 0.85
        ? "text-amber-700/90 dark:text-amber-400/90"
        : "text-muted-foreground";
  return (
    <span className={cn("tabular-nums text-[10px] font-medium", tone)}>
      {len}/{max}
    </span>
  );
}

export type GoogleAdsRsaDraftPreviewProps = {
  finalUrl: string;
  path1?: string;
  path2?: string;
  headlinesText: string;
  descriptionsText: string;
  /** Palavra ou frase mostrada como «consulta exemplo» (primeira keyword). */
  queryHint?: string;
  /** Mostrar grelha de limites por linha (como no assistente de criação). */
  showCharacterGrid?: boolean;
  className?: string;
};

function headlineLineStats(headlinesText: string): LineStat[] {
  const raw = headlinesText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 15);
  if (raw.length === 0) {
    return [
      { text: "— Titular —", len: 0, max: HEADLINE_MAX, truncated: false },
      { text: "— Titular —", len: 0, max: HEADLINE_MAX, truncated: false },
      { text: "— Titular —", len: 0, max: HEADLINE_MAX, truncated: false },
    ];
  }
  return raw.map((line) => ({
    text: line.slice(0, HEADLINE_MAX),
    len: Math.min(line.length, HEADLINE_MAX),
    max: HEADLINE_MAX,
    truncated: line.length > HEADLINE_MAX,
  }));
}

function parseDescriptionLines(text: string): LineStat[] {
  const raw = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 4);
  const out: LineStat[] = [];
  for (let i = 0; i < 2; i++) {
    const line = raw[i] ?? "";
    const slice = line.slice(0, DESCRIPTION_MAX);
    const placeholder =
      i === 0
        ? "Adicione descrições com benefícios e chamadas à acção."
        : "Segunda linha: prova social, promoção ou diferenciação.";
    const display = slice || placeholder;
    const srcLen = line ? Math.min(line.length, DESCRIPTION_MAX) : Math.min(placeholder.length, DESCRIPTION_MAX);
    out.push({
      text: display,
      len: srcLen,
      max: DESCRIPTION_MAX,
      truncated: Boolean(line.length > DESCRIPTION_MAX),
    });
  }
  return out;
}

/**
 * Pré-visualização alinhada ao painel direito da Google Ads (combinação exemplo RSA + resultado de pesquisa).
 * Usa texto em edição (uma linha = um ativo).
 */
export function GoogleAdsRsaDraftPreview(props: GoogleAdsRsaDraftPreviewProps) {
  const headlinesFull = useMemo(() => {
    return props.headlinesText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 15)
      .map((h) => h.slice(0, HEADLINE_MAX));
  }, [props.headlinesText]);

  const descriptionsFull = useMemo(() => {
    return props.descriptionsText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 4)
      .map((d) => d.slice(0, DESCRIPTION_MAX));
  }, [props.descriptionsText]);

  const headlineJoin = useMemo(() => {
    const trio = headlinesFull.slice(0, 3);
    if (trio.length === 0) return "Titulares do anúncio responsivo";
    return trio.join(" · ");
  }, [headlinesFull]);

  const descriptionPreview = useMemo(() => {
    if (descriptionsFull.length === 0) {
      return "O texto da descrição aparece aqui quando adicionar linhas ao formulário.";
    }
    return descriptionsFull.slice(0, 2).join(" ");
  }, [descriptionsFull]);

  const displaySite = useMemo(
    () => googleAdsRsaDisplayGreenLine(props.finalUrl, props.path1, props.path2),
    [props.finalUrl, props.path1, props.path2],
  );

  const queryHint = props.queryHint?.trim() || "consulta exemplo";

  const headlineStats = useMemo(() => headlineLineStats(props.headlinesText), [props.headlinesText]);
  const descriptionStats = useMemo(() => parseDescriptionLines(props.descriptionsText), [props.descriptionsText]);

  const sponsoredDomain = displaySite.split("/")[0] || displaySite;

  return (
    <div
      className={cn(
        "rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-border dark:bg-card",
        "ring-1 ring-black/[0.06] dark:ring-white/[0.06]",
        props.className,
      )}
    >
      <div className="flex items-start justify-between gap-2 border-b border-neutral-200 bg-neutral-50/90 px-3 py-2.5 dark:border-border dark:bg-muted/30">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
            style={{ background: "#1a73e8" }}
            aria-hidden
          >
            G
          </div>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Google Ads</p>
            <p className="truncate text-[12px] font-medium text-foreground">Pré-visualização</p>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-3">
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-border dark:bg-muted/25">
          <div className="mb-2 flex flex-wrap items-center gap-2 border-b border-neutral-200/90 pb-2 dark:border-border/80">
            <Smartphone className="h-3 w-3 text-muted-foreground" aria-hidden />
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Pesquisa · telemóvel</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Pesquisas relacionadas com <span className="font-semibold text-foreground/90">{queryHint}</span>
          </p>
          <div className="mt-2.5 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Anúncio · {sponsoredDomain}</p>
            <p
              className="text-[13px] leading-snug text-emerald-800 dark:text-emerald-400/95"
              style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
            >
              {displaySite}
            </p>
            <h3
              className="text-[17px] font-normal leading-snug text-[#1a0dab] dark:text-blue-400"
              style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
            >
              {headlineJoin}
            </h3>
            <p
              className="text-[13px] leading-relaxed text-[#4d5156] dark:text-foreground/85"
              style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
            >
              {descriptionPreview}
            </p>
          </div>
        </div>

        {props.showCharacterGrid !== false ? (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Contagem de caracteres
            </p>
            <ul className="max-h-[min(240px,40vh)] space-y-1 overflow-y-auto rounded-md border border-neutral-200 bg-white p-2 text-[11px] dark:border-border dark:bg-card">
              {headlineStats.map((h, i) => (
                <li
                  key={`h-${i}`}
                  className="flex items-start justify-between gap-2 border-b border-neutral-100 pb-1 last:border-0 dark:border-border/50"
                >
                  <span className="min-w-0 flex-1 break-words font-mono leading-snug text-foreground/85">{h.text}</span>
                  <LenBadge len={h.len} max={h.max} truncated={h.truncated} />
                </li>
              ))}
              {descriptionStats.map((d, i) => (
                <li
                  key={`d-${i}`}
                  className="flex items-start justify-between gap-2 border-t border-neutral-100 pt-1 dark:border-border/50"
                >
                  <span className="min-w-0 flex-1 break-words font-mono leading-snug text-muted-foreground">{d.text}</span>
                  <LenBadge len={d.len} max={d.max} truncated={d.truncated} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function DpilotGoogleSearchAdPreview(props: GoogleSearchAdPreviewProps) {
  const { headlines, descriptions, headlineJoin, descriptionPreview, displaySite, queryHint } = buildAssetLines(props);

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/70 bg-background/95 shadow-md",
        "ring-1 ring-black/[0.04] dark:ring-white/[0.06]",
        props.className,
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600/10 dark:bg-blue-400/15">
            <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Pesquisa Google
            </p>
            <p className="truncate text-[13px] font-medium text-foreground">Pré-visualização RSA</p>
          </div>
        </div>
        <Badge
          variant="secondary"
          className="hidden shrink-0 text-[10px] font-semibold uppercase tracking-wide sm:inline-flex"
        >
          Ao vivo
        </Badge>
      </div>

      <div className="space-y-4 p-4">
        <div className="rounded-xl border border-border/70 bg-muted/35 p-3.5 dark:bg-muted/20">
          <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-border/50 pb-2">
            <Smartphone className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Resultado móvel
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Pesquisas relacionadas com <span className="font-semibold italic text-foreground/90">{queryHint}</span>
          </p>
          <div className="mt-3 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/90">
              Patrocinado · {displaySite.split("/")[0] || displaySite}
            </p>
            <p className="text-[12px] font-normal leading-snug text-emerald-800 dark:text-emerald-400/95">{displaySite}</p>
            <h3
              className="text-[17px] font-normal leading-snug text-[#1558d6] dark:text-blue-400"
              style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
            >
              {headlineJoin}
            </h3>
            <p className="text-[13px] leading-relaxed text-foreground/80 dark:text-foreground/85">{descriptionPreview}</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Limites de caracteres RSA
          </p>
          <ul className="space-y-1.5 rounded-lg border border-border/60 bg-card/90 p-3 text-[11px]">
            {headlines.map((h, i) => (
              <li
                key={`h-${i}`}
                className="flex items-start justify-between gap-2 border-b border-border/40 pb-1.5 last:border-0 last:pb-0"
              >
                <span className="min-w-0 flex-1 break-words font-mono leading-snug text-foreground/85">{h.text}</span>
                <LenBadge len={h.len} max={h.max} truncated={h.truncated} />
              </li>
            ))}
            {descriptions.map((d, i) => (
              <li
                key={`d-${i}`}
                className="flex items-start justify-between gap-2 border-t border-border/50 pt-1.5 first:border-t-0"
              >
                <span className="min-w-0 flex-1 break-words font-mono leading-snug text-muted-foreground">{d.text}</span>
                <LenBadge len={d.len} max={d.max} truncated={d.truncated} />
              </li>
            ))}
          </ul>
          <p className="mt-2 px-1 text-[10px] leading-relaxed text-muted-foreground">
            A API permite até 15 titulares e 4 descrições; aqui combinamos o que está no formulário antes da IA
            estender o plano.
          </p>
        </div>
      </div>
    </div>
  );
}
