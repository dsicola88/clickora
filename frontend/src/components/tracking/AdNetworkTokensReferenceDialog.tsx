import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  AD_NETWORK_TOKEN_SECTIONS,
  orderedAdNetworkTokenSections,
} from "@/lib/adNetworkDynamicTokens";
import { AdNetworkTokensPickerPanel } from "@/components/tracking/AdNetworkTokensPickerPanel";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Plataforma do Construtor de URL (ex. «Google Ads») — prioriza essa secção no topo */
  boostPlatformLabel?: string;
};

/**
 * Referência tipo ClickMagick: pesquisar e copiar macros por rede.
 * No redirect `/track/r/…` use chaves aceites pelo servidor: utm_term (keyword), utm_content, campaign, sub1–sub3, gclid, etc.
 */
export function AdNetworkTokensReferenceDialog({ open, onOpenChange, boostPlatformLabel }: Props) {
  const sections = useMemo(() => {
    if (boostPlatformLabel) return orderedAdNetworkTokenSections(boostPlatformLabel);
    return AD_NETWORK_TOKEN_SECTIONS;
  }, [boostPlatformLabel]);

  const handleSelect = (token: string) => {
    void navigator.clipboard.writeText(token).then(
      () => {
        toast.success("Macro copiada — cole no parâmetro certo (ex. utm_term, sub1).");
      },
      () => {
        toast.error("Não foi possível copiar. Selecione o texto manualmente.");
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] flex flex-col gap-0 p-0 sm:max-w-lg"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0 text-left space-y-2">
          <DialogTitle className="text-lg">Marcadores dinâmicos das redes</DialogTitle>
          <DialogDescription className="text-sm font-normal leading-relaxed">
            Escolha a rede onde vai veicular. Cada item copia a <strong className="text-foreground">macro</strong> — a plataforma substitui pelo
            valor real no clique. No link <span className="font-mono text-[11px]">/track/r/…</span> mapeie palavra-chave para{" "}
            <span className="font-mono text-[11px]">utm_term</span>, criativos para{" "}
            <span className="font-mono text-[11px]">utm_content</span>, extras para{" "}
            <span className="font-mono text-[11px]">sub1</span>–<span className="font-mono text-[11px]">sub3</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-6 flex-1 min-h-0 flex flex-col gap-3">
          <AdNetworkTokensPickerPanel sections={sections} onSelect={handleSelect} listMaxHeightClass="max-h-[min(52vh,360px)]" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
