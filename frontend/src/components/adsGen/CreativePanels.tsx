import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { adTextLength } from "@/lib/adText";
import { cn } from "@/lib/utils";
import type { AdBundle, ValidationIssue } from "@/services/keywordResearchService";

const ANGLE: Record<string, string> = {
  purchase: "Compra",
  feature: "Característica confirmada",
  comparison: "Comparação",
  audience: "Público confirmado",
  offer: "Oferta confirmada",
  brand: "Marca e navegação",
};

const LEVEL: Record<ValidationIssue["level"], string> = {
  valid: "Válido",
  warning: "Aviso",
  invalid: "Inválido",
  confirm: "Confirmar",
  unsupported: "Não suportado",
};

function Counter({ value, max }: { value: string; max: number }) {
  const n = adTextLength(value);
  return (
    <span className={cn("text-[11px] tabular-nums", n > max ? "text-destructive" : "text-muted-foreground")}>
      {n}/{max}
    </span>
  );
}

export function CreativePanels({
  tab,
  bundle,
  issues,
  onChange,
}: {
  tab: "ad" | "assets" | "review" | "export";
  bundle: AdBundle;
  issues: ValidationIssue[];
  onChange: (next: AdBundle) => void;
}) {
  const headlineMax = 30;
  const descriptionMax = 90;
  const pathMax = bundle.platform === "microsoft" ? 15 : 15;

  if (tab === "ad") {
    return (
      <div className="space-y-6">
        {bundle.source === "deterministic" ? (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
            {bundle.llmFailed
              ? "Sem resposta da IA, o anúncio usa o modelo fixo: o mesmo nome do produto e só o preço, o desconto ou a garantia que a página trouxe."
              : "Modelo fixo, sem redação da IA. Usa o nome do produto e só os factos confirmados. Pode editar antes de copiar."}
          </p>
        ) : null}
        <section className="rounded-md border border-border/60 px-3 py-2 text-sm">
          <p className="font-medium">Anúncio de pesquisa</p>
          <p className="text-xs text-muted-foreground mt-1">
            {bundle.headlines.length} títulos de 3 a 15, cada um até 30 caracteres. {bundle.descriptions.length} descrições de 2 a 4, cada uma até 90.
            Caminhos até 15. Estes limites são os do Google Ads e do Microsoft Advertising.
          </p>
        </section>
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Títulos</h3>
          <p className="text-xs text-muted-foreground">
            Cada título conta até 30 caracteres. Caracteres largos, como chinês ou emoji, contam como 2. Fixar uma posição reduz as combinações.
          </p>
          {bundle.headlines.map((h, i) => (
            <div key={h.id} className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <Input
                aria-label={`Título ${i + 1}`}
                value={h.text}
                maxLength={80}
                onChange={(e) => {
                  const headlines = bundle.headlines.slice();
                  headlines[i] = { ...h, text: e.target.value };
                  onChange({ ...bundle, headlines });
                }}
              />
              <Counter value={h.text} max={headlineMax} />
              {h.angle ? <span className="text-[11px] text-muted-foreground sm:col-span-3">{ANGLE[h.angle] ?? h.angle}</span> : null}
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                Fixar
                <select
                  aria-label={`Posição do título ${i + 1}`}
                  className="h-9 rounded-md border bg-background px-2"
                  value={h.pin ?? ""}
                  onChange={(e) => {
                    const headlines = bundle.headlines.slice();
                    const pin = e.target.value === "" ? null : (Number(e.target.value) as 1 | 2 | 3);
                    headlines[i] = { ...h, pin };
                    onChange({ ...bundle, headlines });
                  }}
                >
                  <option value="">Não</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                </select>
              </label>
            </div>
          ))}
        </section>
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Descrições</h3>
          {bundle.descriptions.map((d, i) => (
            <div key={d.id} className="space-y-1">
              <textarea
                aria-label={`Descrição ${i + 1}`}
                className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={d.text}
                onChange={(e) => {
                  const descriptions = bundle.descriptions.slice();
                  descriptions[i] = { ...d, text: e.target.value };
                  onChange({ ...bundle, descriptions });
                }}
              />
              <Counter value={d.text} max={descriptionMax} />
            </div>
          ))}
        </section>
        <section className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="path1">Caminho 1</Label>
            <Input id="path1" value={bundle.path1} onChange={(e) => onChange({ ...bundle, path1: e.target.value })} />
            <Counter value={bundle.path1} max={pathMax} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="path2">Caminho 2</Label>
            <Input id="path2" value={bundle.path2} onChange={(e) => onChange({ ...bundle, path2: e.target.value })} />
            <Counter value={bundle.path2} max={pathMax} />
          </div>
        </section>
        <SearchPreview bundle={bundle} />
      </div>
    );
  }

  if (tab === "assets") {
    return (
      <div className="space-y-6">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Sitelinks</h3>
          <p className="text-xs text-muted-foreground">
            Não criamos páginas. Um destino vazio fica por confirmar. No Microsoft Advertising, as duas descrições preenchem-se juntas;
            o texto passa de 35 para 25 caracteres quando há descrições.
          </p>
          {bundle.sitelinks.map((s, i) => (
            <div key={s.id} className="rounded-lg border border-border/70 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Input
                  aria-label={`Texto do sitelink ${i + 1}`}
                  value={s.text}
                  onChange={(e) => {
                    const sitelinks = bundle.sitelinks.slice();
                    sitelinks[i] = { ...s, text: e.target.value };
                    onChange({ ...bundle, sitelinks });
                  }}
                />
                <Counter value={s.text} max={s.description1 || s.description2 ? 25 : bundle.platform === "microsoft" ? 35 : 25} />
              </div>
              <Input
                aria-label={`URL do sitelink ${i + 1}`}
                placeholder="https:// destino real"
                value={s.url}
                onChange={(e) => {
                  const sitelinks = bundle.sitelinks.slice();
                  sitelinks[i] = { ...s, url: e.target.value };
                  onChange({ ...bundle, sitelinks });
                }}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Input
                    aria-label={`Descrição 1 do sitelink ${i + 1}`}
                    placeholder="Descrição 1"
                    value={s.description1}
                    onChange={(e) => {
                      const sitelinks = bundle.sitelinks.slice();
                      sitelinks[i] = { ...s, description1: e.target.value };
                      onChange({ ...bundle, sitelinks });
                    }}
                  />
                  <Counter value={s.description1} max={35} />
                </div>
                <div className="space-y-1">
                  <Input
                    aria-label={`Descrição 2 do sitelink ${i + 1}`}
                    placeholder="Descrição 2"
                    value={s.description2}
                    onChange={(e) => {
                      const sitelinks = bundle.sitelinks.slice();
                      sitelinks[i] = { ...s, description2: e.target.value };
                      onChange({ ...bundle, sitelinks });
                    }}
                  />
                  <Counter value={s.description2} max={35} />
                </div>
              </div>
            </div>
          ))}
        </section>
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Destaques</h3>
          {bundle.callouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum destaque cabe em 25 caracteres. Preço ou garantia mais longos ficam na descrição e não são cortados.</p>
          ) : (
            bundle.callouts.map((c) => (
              <p key={c.id} className="text-sm">
                {c.text} <Counter value={c.text} max={25} />
              </p>
            ))
          )}
        </section>
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Snippet estruturado</h3>
          <p className="text-sm text-muted-foreground">
            {bundle.snippet
              ? `${bundle.snippet.header}: ${bundle.snippet.values.join(", ")}`
              : "Omitido. Não há uma lista real de tipos, marcas ou serviços."}
          </p>
        </section>
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Promoção</h3>
          <p className="text-sm text-muted-foreground">
            {bundle.promotion
              ? `${bundle.promotion.kind === "percent" ? bundle.promotion.value : bundle.promotion.value} · ${bundle.promotion.item}`
              : "Omitida. Sem desconto confirmado, esta secção não entra no pacote."}
          </p>
        </section>
        <p className="text-xs text-muted-foreground">
          Nome sugerido para a conta: {bundle.businessName}. No anúncio de pesquisa, o nome visível vem do domínio, não deste campo.
          Imagens, chamada e localização não são geradas sem ficheiros ou dados reais.
        </p>
      </div>
    );
  }

  if (tab === "review") {
    const bad = issues.filter((i) => i.level !== "valid");
    const invalid = issues.filter((i) => i.level === "invalid").length;
    const confirm = issues.filter((i) => i.level === "confirm").length;
    const warning = issues.filter((i) => i.level === "warning").length;
    return (
      <div className="space-y-3">
        <p className="text-sm">
          {invalid
            ? "Estado: inválido. Não está pronto para exportação final. O rascunho pode ser gravado."
            : confirm
              ? "Estado: requer confirmação. Não está tratado como pronto."
              : warning
                ? "Estado: aviso. As regras rígidas passaram; há pontos por rever."
                : "Estado: válido nas verificações implementadas. Isto não é uma aprovação da plataforma."}
        </p>
        <ul className="space-y-2">
          {bundle.limitations.map((line) => (
            <li key={line} className="text-sm text-muted-foreground">
              {line}
            </li>
          ))}
        </ul>
        {bad.length === 0 ? <p className="text-sm">Nenhum problema encontrado nas regras carregadas.</p> : null}
        <ul className="space-y-2">
          {bad.map((issue, i) => (
            <li key={`${issue.path}-${i}`} className="rounded-md border border-border/70 px-3 py-2 text-sm">
              <span className="font-medium">{LEVEL[issue.level]}</span>
              <span className="text-muted-foreground"> · {issue.platform} · </span>
              {issue.message}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">Esta revisão não prevê a aprovação do Google Ads nem do Microsoft Advertising.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <p>A exportação é um CSV de revisão. Não é um ficheiro oficial de importação do Google Ads Editor nem do Microsoft Advertising.</p>
      <p>Conteúdo inválido não fica disponível como exportação final. Avisos e confirmações continuam visíveis na revisão.</p>
      <p className="text-muted-foreground">Plataforma pedida: {bundle.platform}. Idioma do pacote: {bundle.locale}.</p>
      <Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(bundle.headlines.map((h) => h.text).join("\n"))}>
        Copiar títulos
      </Button>
    </div>
  );
}

function previewHost(bundle: AdBundle): string {
  const raw = bundle.sitelinks.find((s) => s.url.trim())?.url;
  if (!raw) return "exemplo.com";
  try {
    return new URL(raw).hostname.replace(/^www\./, "");
  } catch {
    return "exemplo.com";
  }
}

function SearchPreview({ bundle }: { bundle: AdBundle }) {
  const heads = bundle.headlines.map((h) => h.text).filter(Boolean).slice(0, 3);
  const desc = bundle.descriptions[0]?.text ?? "";
  const links = bundle.sitelinks.filter((s) => s.text && s.url);
  return (
    <div className="rounded-lg border border-dashed border-border p-4 space-y-1">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Simulação, não o anúncio publicado</p>
      <p className="text-sm text-muted-foreground">
        {previewHost(bundle)}
        {bundle.path1 ? `/${bundle.path1}` : ""}
        {bundle.path2 ? `/${bundle.path2}` : ""}
      </p>
      <p className="text-base text-primary font-medium">{heads.join(" | ") || "Títulos"}</p>
      <p className="text-sm text-muted-foreground">{desc}</p>
      {links.length ? <p className="text-sm">{links.map((s) => s.text).join(" · ")}</p> : null}
    </div>
  );
}
