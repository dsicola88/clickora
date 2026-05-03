import { cn } from "@/lib/utils";

/** Linha tipo «definições» da consola Google Ads (rótulo discreto + valor). */
export function StudioSettingsRow({
  label,
  value,
  subdued,
}: {
  label: string;
  value: React.ReactNode;
  subdued?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 border-t border-border/60 px-3 py-2.5 first:border-t-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className={cn("min-w-0 text-sm leading-snug sm:text-right", subdued && "text-muted-foreground")}>{value}</div>
    </div>
  );
}

export function StudioSettingsPanel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-md border border-border/60 bg-muted/10", className)}>{children}</div>;
}
