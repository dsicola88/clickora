import { cn } from "@/lib/utils";
import {
  mirrorReferenceNoticeText,
  publicAffiliateDisclosureText,
} from "@/lib/presellPublicComplianceCopy";

export function PresellAffiliateDisclosureBar({
  language,
  className,
}: {
  language: string | undefined;
  className?: string;
}) {
  const text = publicAffiliateDisclosureText(language);
  return (
    <div
      role="note"
      className={cn(
        "relative z-[36] w-full border-b border-amber-200/80 bg-amber-50/95 px-3 py-2 text-center text-xs leading-snug text-amber-950",
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
