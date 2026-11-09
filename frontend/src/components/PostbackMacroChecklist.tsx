import { Link } from "react-router-dom";
import { CheckCircle2, Circle } from "lucide-react";
import { AFFILIATE_POSTBACK_PRESETS } from "@/lib/marketingPlatforms";

const CRITICAL: { platform: string; mustInclude: string[]; why: string }[] = [
  {
    platform: "MaxWeb",
    mustInclude: ["{SUBID2}", "subid2="],
    why: "A MaxWeb reescreve subid no lander; {SUBID2} é o canal estável.",
  },
  {
    platform: "BuyGoods",
    mustInclude: ["{SUBID2}", "subid2="],
    why: "Backup de atribuição se {SUBID} não for UUID.",
  },
  {
    platform: "Digistore24",
    mustInclude: ["{sid1}", "sid1="],
    why: "Se outro tracker usa cid, o UUID da dclickora fica em sid1.",
  },
  {
    platform: "SmartAdv",
    mustInclude: ["{sub3}", "sub3="],
    why: "O UUID do clique na SmartAdv vai em sub3.",
  },
  {
    platform: "AdCombo",
    mustInclude: ["{clickid}", "clickora_click_id="],
    why: "AdCombo ecoa o clickid da oferta para atribuir a venda.",
  },
  {
    platform: "Monetizze",
    mustInclude: ["[[src]]", "clickora_click_id="],
    why: "Monetizze ecoa [[src]] / referência do hoplink.",
  },
  {
    platform: "Braip",
    mustInclude: ["{xcod}", "clickora_click_id="],
    why: "Braip ecoa xcod do hoplink.",
  },
];

type Props = {
  /** URL de postback actualmente mostrado / copiado (com macros). */
  postbackUrl?: string | null;
  platform?: string | null;
  /** Compacto para hub (sem URL → CTA para configurar). */
  compact?: boolean;
};

/**
 * Valida macros críticas por rede. Com URL: checks reais. Sem URL: guia.
 */
export function PostbackMacroChecklist({ postbackUrl, platform, compact }: Props) {
  const url = (postbackUrl || "").trim();
  const plat = (platform || "").trim();
  const rows = CRITICAL.filter((c) => !plat || c.platform.toLowerCase() === plat.toLowerCase());
  if (!rows.length) return null;

  if (!url) {
    return (
      <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-3 space-y-2">
        <p className="text-xs font-medium text-foreground">Códigos da rede</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Cada rede usa códigos próprios no aviso de venda. Copie o URL gerado em Integrações — não invente o endereço.
        </p>
        {compact ? (
          <Link
            to="/integracoes/postback"
            className="inline-flex text-[11px] font-medium text-primary underline-offset-2 hover:underline"
          >
            Abrir aviso de venda
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-3 space-y-2">
      <p className="text-xs font-medium text-foreground">Confirmação do aviso de venda</p>
      <ul className="space-y-2">
        {rows.map((c) => {
          const preset = AFFILIATE_POSTBACK_PRESETS[c.platform];
          const hasMacro = c.mustInclude.some((m) => url.includes(m));
          void preset;
          return (
            <li key={c.platform} className="flex items-start gap-2 text-xs">
              {hasMacro ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
              ) : (
                <Circle className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              )}
              <span>
                <span className="font-medium">{c.platform}</span>
                {!hasMacro ? (
                  <span className="text-muted-foreground"> — falta {c.mustInclude[0]}</span>
                ) : (
                  <span className="text-emerald-700 dark:text-emerald-400"> — OK</span>
                )}
                <span className="mt-0.5 block text-[11px] text-muted-foreground leading-snug">{c.why}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
