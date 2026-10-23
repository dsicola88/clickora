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
];

type Props = {
  /** URL de postback actualmente mostrado / copiado (com macros). */
  postbackUrl?: string | null;
  platform?: string | null;
};

/**
 * Valida se o URL de postback tem as macros críticas por rede (Fase 0).
 */
export function PostbackMacroChecklist({ postbackUrl, platform }: Props) {
  const url = (postbackUrl || "").trim();
  const plat = (platform || "").trim();
  const rows = CRITICAL.filter((c) => !plat || c.platform.toLowerCase() === plat.toLowerCase());
  if (!rows.length) return null;

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-3 space-y-2">
      <p className="text-xs font-medium text-foreground">Checklist de macros (atribuição)</p>
      <ul className="space-y-2">
        {rows.map((c) => {
          const preset = AFFILIATE_POSTBACK_PRESETS[c.platform];
          const ok =
            Boolean(url) &&
            c.mustInclude.some((m) => url.includes(m)) &&
            (preset ? url.toLowerCase().includes(c.platform.toLowerCase()) || url.includes("platform=") : true);
          const hasMacro = Boolean(url) && c.mustInclude.some((m) => url.includes(m));
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
                {!ok && url ? null : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
