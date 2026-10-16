import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PageIdentityPreview = {
  page_status: "fetched" | "pasted";
  page_title: string | null;
  page_h1: string | null;
  suggested_product_name: string | null;
  effective_product_name: string;
  aligned: boolean;
  alignment_score: number;
  product_name_source: string;
};

type Props = {
  preview: PageIdentityPreview | null;
  loading: boolean;
  productNameSource: "auto" | "form" | "page";
  onUsePageName: () => void;
  onKeepFormName: () => void;
  onUseAuto: () => void;
};

export function ProductPageIdentityBanner({
  preview,
  loading,
  productNameSource,
  onUsePageName,
  onKeepFormName,
  onUseAuto,
}: Props) {
  if (loading) {
    return (
      <p className="text-xs text-muted-foreground rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
        A ler a página do produto para alinhar nome, keywords e anúncios…
      </p>
    );
  }
  if (!preview?.suggested_product_name) return null;

  const aligned = preview.aligned;
  const mismatch = !aligned && preview.suggested_product_name;

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-3 space-y-2 text-sm",
        aligned ? "border-emerald-500/35 bg-emerald-500/10" : "border-amber-500/40 bg-amber-500/10",
      )}
    >
      <p className="font-medium text-foreground">
        {aligned ? "Nome alinhado com a página" : "Ajuste o nome para bater certo com a oferta"}
      </p>
      <ul className="text-xs text-muted-foreground space-y-1">
        {preview.page_h1 ? (
          <li>
            <span className="text-foreground/80">H1:</span> {preview.page_h1}
          </li>
        ) : null}
        {preview.page_title ? (
          <li>
            <span className="text-foreground/80">Título:</span> {preview.page_title}
          </li>
        ) : null}
        <li>
          <span className="text-foreground/80">Nome sugerido:</span>{" "}
          <strong className="text-foreground">{preview.suggested_product_name}</strong>
        </li>
        {!aligned ? (
          <li>
            Campanha gerada com <strong className="text-foreground">{preview.effective_product_name}</strong> (modo{" "}
            {productNameSource === "auto" ? "automático" : productNameSource === "page" ? "página" : "formulário"}).
          </li>
        ) : null}
      </ul>
      <div className="flex flex-wrap gap-2 pt-1">
        {mismatch ? (
          <Button type="button" size="sm" variant="default" onClick={onUsePageName}>
            Usar nome da página
          </Button>
        ) : null}
        <Button type="button" size="sm" variant={mismatch ? "outline" : "secondary"} onClick={onKeepFormName}>
          Manter o meu nome
        </Button>
        <Button
          type="button"
          size="sm"
          variant={productNameSource === "auto" ? "secondary" : "ghost"}
          onClick={onUseAuto}
        >
          Automático
        </Button>
      </div>
    </div>
  );
}
