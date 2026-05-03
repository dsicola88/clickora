import { useState } from "react";
import { ChevronsDown, ChevronsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AD_NETWORK_TOKEN_SECTIONS, type AdNetworkTokenSection } from "@/lib/adNetworkDynamicTokens";
import { AdNetworkTokensPickerPanel } from "@/components/tracking/AdNetworkTokensPickerPanel";
import { cn } from "@/lib/utils";

const GOOGLE_SECTION = AD_NETWORK_TOKEN_SECTIONS.find((s) => s.id === "google");
const MICROSOFT_SECTION = AD_NETWORK_TOKEN_SECTIONS.find((s) => s.id === "microsoft");

type Props = {
  onSelectToken: (token: string) => void;
  /** Secções completas (rede escolhida no construtor em primeiro lugar). */
  allSectionsOrdered: AdNetworkTokenSection[];
  searchPlaceholder?: string;
};

/**
 * Corpo do modal do Construtor de URL: duas colunas Google | Microsoft (tipo Smart Click),
 * com pesquisa nas restantes redes abaixo.
 */
export function UrlBuilderTokenModalBody({
  onSelectToken,
  allSectionsOrdered,
  searchPlaceholder = "Pesquisar em todas as redes…",
}: Props) {
  const [showAllNetworks, setShowAllNetworks] = useState(false);

  return (
    <div className="flex flex-col gap-4 min-h-0">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 text-left">
        <TokenColumn title="Google Ads" section={GOOGLE_SECTION} onPick={onSelectToken} />
        <TokenColumn title="Microsoft Ads" section={MICROSOFT_SECTION} onPick={onSelectToken} />
      </div>

      <div className="border-t border-border/60 pt-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full gap-2 text-muted-foreground hover:text-foreground h-auto py-2"
          onClick={() => setShowAllNetworks((v) => !v)}
        >
          {showAllNetworks ? (
            <ChevronsUp className="h-4 w-4 shrink-0" aria-hidden />
          ) : (
            <ChevronsDown className="h-4 w-4 shrink-0" aria-hidden />
          )}
          {showAllNetworks
            ? "Fechar pesquisa nas outras redes"
            : "Pesquisar em todas as redes (Meta, TikTok, Taboola…)"}
        </Button>
        {showAllNetworks ? (
          <div className="mt-3 animate-in fade-in duration-200">
            <AdNetworkTokensPickerPanel
              sections={allSectionsOrdered}
              onSelect={onSelectToken}
              searchPlaceholder={searchPlaceholder}
              listMaxHeightClass="max-h-[min(40vh,300px)]"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TokenColumn({
  title,
  section,
  onPick,
}: {
  title: string;
  section: AdNetworkTokenSection | undefined;
  onPick: (token: string) => void;
}) {
  if (!section) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-3 sm:px-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/90 mb-3 border-b border-border/50 pb-2">
        {title}
      </h3>
      <ul className="flex flex-col gap-1.5 m-0 p-0 list-none">
        {section.items.map((item) => (
          <li key={item.token}>
            <button
              type="button"
              onClick={() => onPick(item.token)}
              className={cn(
                "w-full text-left rounded-md px-2.5 py-2 font-mono text-[12px] sm:text-[13px]",
                "border border-transparent bg-background/80 hover:bg-accent hover:border-border",
                "text-foreground transition-colors",
              )}
            >
              {item.token}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
