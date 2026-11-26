import { cn } from "@/lib/utils";
import {
  mirrorReferenceNoticeText,
  publicAffiliateDisclosureText,
} from "@/lib/presellPublicComplianceCopy";

export function PresellAffiliateDisclosureBar({
  language,
  className,
  variant = "light",
  textOverride,
}: {
  language: string | undefined;
  className?: string;
  /** Barra escura no topo (estilo SuperPresell / review desk). */
  variant?: "light" | "dark";
  textOverride?: string;
}) {
  const text = (textOverride || publicAffiliateDisclosureText(language)).trim();
  return (
    <div
      role="note"
      className={cn(
        "relative z-[36] w-full px-3 py-2 text-center text-[11px] sm:text-xs leading-snug",
        variant === "dark"
          ? "border-b border-white/10 bg-[#0c0f14] text-slate-300"
          : "border-b border-amber-200/80 bg-amber-50/95 text-amber-950",
        className,
      )}
    >
      {text}
    </div>
  );
}

export function PresellMirrorReferenceNotice({
  language,
  className,
}: {
  language: string | undefined;
  className?: string;
}) {
  return (
    <p
      role="note"
      className={cn(
        "mx-auto max-w-6xl px-3 py-2 text-center text-xs leading-snug text-slate-600 bg-slate-100/95 border-b border-slate-200",
        className,
      )}
    >
      {mirrorReferenceNoticeText(language)}
    </p>
  );
}
