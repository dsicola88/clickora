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

/**
 * Painel direito tipo Pesquisa Google: combinação de titulares e descrições com limites RSA.
 */
export function DpilotGoogleSearchAdPreview(props: GoogleSearchAdPreviewProps) {
  const { headlines, descriptions, headlineJoin, descriptionPreview, displaySite, queryHint } = useMemo(
    () => buildAssetLines(props),
    [
      props.landingUrl,
      props.offer,
      props.seedKeyword,
      props.price,
      props.discount,
      props.guarantee,
      props.shipping,
      props.bundles,
    ],
  );

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
