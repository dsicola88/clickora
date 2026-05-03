import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CheckCircle2, ChevronDown, CircleHelp, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { GoogleRsaDescriptionsFieldStack, GoogleRsaHeadlinesFieldStack } from "./GoogleRsaLineEditors";

const SECTION_SHELL =
  "overflow-hidden rounded-lg border border-neutral-300/95 bg-background text-foreground shadow-sm dark:border-border";

function GoogleAdsSectionChrome({
  title,
  subtitle,
  help,
  defaultOpen = true,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  help?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className={cn(SECTION_SHELL, className)}>
      <CollapsibleTrigger className="group/ads-sec flex w-full items-start gap-2 px-4 py-3 text-left hover:bg-muted/25">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-medium tracking-tight text-foreground">{title}</span>
            {help ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Ajuda">
                      <CircleHelp className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                    {help}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
          </div>
          {subtitle ? (
            <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/ads-sec:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-neutral-200/90 px-4 pb-4 pt-4 dark:border-border">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function keywordBareText(kw: string): string {
  return kw
    .replace(/^\[+|\]+$/g, "")
    .replace(/^"+|"+$/g, "")
    .replace(/^'+|'+$/g, "")
    .trim()
    .toLowerCase();
}

/** Verifica inclusão informal da palavra-chave nos títulos RSA (várias linhas). */
export function keywordAppearsInHeadlines(headlinesNewlineSeparated: string, keywordText: string): boolean {
  const core = keywordBareText(keywordText);
  if (!core) return false;
  const blob = headlinesNewlineSeparated.split("\n").join(" ").toLowerCase();
  return blob.includes(core);
}

function extractDisplayHostSegments(finalUrl: string): { hostname: string; pathPrefix: string } {
  const raw = finalUrl.trim();
  if (!raw) return { hostname: "—", pathPrefix: "" };
  try {
    const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
    const hostname = `${u.hostname}${u.port ? `:${u.port}` : ""}`;
    const pathPrefix =
      u.pathname && u.pathname !== "/" ? u.pathname.replace(/\/$/, "") : "";
    return { hostname, pathPrefix };
  } catch {
    return { hostname: "URL inválida", pathPrefix: "" };
  }
}

export type GoogleAdsStudioRsaCreativeBlockProps = {
  finalUrlId: string;
  finalUrl: string;
  onFinalUrlChange: (v: string) => void;
  path1: string;
  path2: string;
  onPath1: (v: string) => void;
  onPath2: (v: string) => void;
  headlines: string;
  onHeadlines: (v: string) => void;
  descriptions: string;
  onDescriptions: (v: string) => void;
  /** Palavras-chave do grupo (na rede ou rascunho) para chips de inclusão nos títulos. */
  keywordHints: Array<{ text: string }>;
  className?: string;
};

/**
 * Layout inspirado nos cartões RSA da Google: URL final, caminho de visualização, títulos com sugestões
 * a partir das palavras-chave e descrições — para a Gestão de campanhas.
 */
export function GoogleAdsStudioRsaCreativeBlock(props: GoogleAdsStudioRsaCreativeBlockProps) {
  const { hostname, pathPrefix } = extractDisplayHostSegments(props.finalUrl);
  const pathMax = 15;

  const hLines = props.headlines
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const titleCountLabel = `${hLines.length}/15`;

  return (
    <div className={cn("space-y-3", props.className)}>
      <GoogleAdsSectionChrome
        title="URL final"
        help="O destino do clique. No Clickora faz parte do anúncio RSA gravado neste grupo; deve ser HTTPS e coerente com a oferta."
        defaultOpen
      >
        <div className="space-y-2">
          <div className="rounded-md border border-neutral-400/90 bg-background px-3 py-2 shadow-sm dark:border-border">
            <label htmlFor={props.finalUrlId} className="block text-[11px] font-medium text-muted-foreground">
              URL final
            </label>
            <Input
              id={props.finalUrlId}
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={props.finalUrl}
              onChange={(e) => props.onFinalUrlChange(e.target.value)}
              className="mt-1 h-8 border-0 bg-transparent px-0 text-[13px] shadow-none focus-visible:ring-0"
            />
          </div>
          <p className="text-[12px] leading-snug text-muted-foreground">
            Esta opção é usada para o destino principal do anúncio e para alinhar com a sua página.
          </p>
        </div>
      </GoogleAdsSectionChrome>

      <GoogleAdsSectionChrome
        title="Caminho de visualização"
        help="Dois segmentos opcionais (máx. 15 caracteres cada) mostrados no anúncio junto ao domínio, como na Google."
        defaultOpen
      >
        <div className="space-y-3">
          <p className="text-[13px] font-medium text-foreground">
            {hostname}
            {pathPrefix ? (
              <span className="font-normal text-muted-foreground">
                {pathPrefix}
                <span className="text-muted-foreground/80"> / …</span>
              </span>
            ) : null}
          </p>
          <div className="flex flex-wrap items-start gap-x-2 gap-y-3">
            <span className="mt-2 select-none text-muted-foreground">/</span>
            <div className="min-w-[7rem] flex-1">
              <Input
                value={props.path1}
                maxLength={pathMax}
                onChange={(e) => props.onPath1(e.target.value.slice(0, pathMax))}
                placeholder="Caminho 1"
                className="h-10 rounded-md border-neutral-400/85 text-[13px] dark:border-border"
                aria-label="Caminho de visualização 1"
              />
              <div className="mt-1 flex justify-end text-[11px] tabular-nums text-muted-foreground">
                {props.path1.length}/{pathMax}
              </div>
            </div>
            <span className="mt-2 select-none text-muted-foreground">/</span>
            <div className="min-w-[7rem] flex-1">
              <Input
                value={props.path2}
                maxLength={pathMax}
                onChange={(e) => props.onPath2(e.target.value.slice(0, pathMax))}
                placeholder="Caminho 2"
                className="h-10 rounded-md border-neutral-400/85 text-[13px] dark:border-border"
                aria-label="Caminho de visualização 2"
              />
              <div className="mt-1 flex justify-end text-[11px] tabular-nums text-muted-foreground">
                {props.path2.length}/{pathMax}
              </div>
            </div>
          </div>
        </div>
      </GoogleAdsSectionChrome>

      <GoogleAdsSectionChrome
        title={`Títulos ${titleCountLabel}`}
        subtitle="Para um bom desempenho, distribua estas palavras-chave nos títulos abaixo."
        help="Responsive Search Ads: até 15 títulos. Os três primeiros são tratados como obrigatórios neste fluxo."
        defaultOpen
      >
        <div className="space-y-4">
          {props.keywordHints.length ? (
            <div className="space-y-2">
              <p className="text-[12px] leading-snug text-muted-foreground">
                Palavras-chave sugeridas para reflectir nos títulos:
              </p>
              <ul className="flex flex-col gap-1.5">
                {props.keywordHints.map((kw, idx) => {
                  const used = keywordAppearsInHeadlines(props.headlines, kw.text);
                  return (
                    <li key={`kw-hint-${idx}-${kw.text.slice(0, 24)}`} className="flex flex-wrap items-center gap-2 text-[13px]">
                      {used ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-500" aria-hidden />
                      ) : (
                        <span className="inline-block h-4 w-4 shrink-0 rounded-full border border-dashed border-muted-foreground/50" aria-hidden />
                      )}
                      <span
                        className={cn(
                          !used && "border-b border-dashed border-muted-foreground/60",
                          used && "text-foreground",
                        )}
                      >
                        {kw.text}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  variant="link"
                  className="h-auto gap-1 px-0 text-xs font-medium text-[#1a73e8] dark:text-sky-400"
                  onClick={() =>
                    toast.message("Mais ideias", {
                      description:
                        "Use as palavras-chave do grupo e variações curtas (benefício, oferta, marca). Pode colar linhas adicionais nos campos de título abaixo.",
                    })
                  }
                >
                  Mais ideias
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-[12px] text-muted-foreground">
              Adicione palavras‑chave ao grupo para ver aqui sugestões de inclusão nos títulos.
            </p>
          )}
          <GoogleRsaHeadlinesFieldStack value={props.headlines} onChange={props.onHeadlines} variant="minimal" />
        </div>
      </GoogleAdsSectionChrome>

      <GoogleAdsSectionChrome
        title="Descrições"
        help="Até quatro descrições de 90 caracteres; as duas primeiras são obrigatórias neste fluxo."
        defaultOpen
      >
        <GoogleRsaDescriptionsFieldStack value={props.descriptions} onChange={props.onDescriptions} variant="minimal" />
      </GoogleAdsSectionChrome>
    </div>
  );
}
