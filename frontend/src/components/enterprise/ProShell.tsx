import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

/** Shell largo e denso — reporting / P&L. */
export const PRO_PAGE_SHELL = "w-full min-w-0 max-w-[1600px] mx-auto space-y-5";

export function ProPageHeader({
  title,
  subtitle,
  meta,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border/70 pb-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0 space-y-1">
        <h1 className="text-[1.375rem] font-semibold tracking-tight text-foreground md:text-2xl">{title}</h1>
        {subtitle ? <div className="text-xs text-muted-foreground leading-relaxed max-w-3xl">{subtitle}</div> : null}
        {meta ? <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">{meta}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div> : null}
    </div>
  );
}

export function ProToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "sticky top-0 z-20 -mx-1 flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-background/95 px-3 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ProKpiGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border/70 bg-border/70 sm:grid-cols-4 xl:grid-cols-8">{children}</div>;
}

export function ProKpiCell({
  label,
  value,
  hint,
  delta,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: string | null;
  tone?: "positive" | "negative" | "muted";
}) {
  return (
    <div className="bg-card px-3 py-3.5 sm:px-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums tracking-tight sm:text-2xl",
          tone === "positive" && "text-emerald-600 dark:text-emerald-400",
          tone === "negative" && "text-destructive",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {value}
      </p>
      {delta ? (
        <p
          className={cn(
            "mt-0.5 text-[10px] font-medium tabular-nums",
            delta.startsWith("+") && "text-emerald-600",
            delta.startsWith("-") && "text-destructive",
            !delta.startsWith("+") && !delta.startsWith("-") && "text-muted-foreground",
          )}
        >
          {delta}
        </p>
      ) : null}
      {hint ? <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function ProPanel({
  title,
  description,
  actions,
  children,
  className,
  id,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("rounded-lg border border-border/70 bg-card", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description ? <div className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">{description}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className="p-0">{children}</div>
    </section>
  );
}

export function ProTable({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function ProTh({
  children,
  align = "left",
  className,
}: {
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th
      className={cn(
        "sticky top-0 z-10 border-b border-border/70 bg-muted/50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground backdrop-blur",
        align === "right" && "text-right",
        align === "left" && "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function ProTd({
  children,
  align = "left",
  mono,
  className,
}: {
  children: ReactNode;
  align?: "left" | "right";
  mono?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "border-b border-border/40 px-3 py-2 align-middle",
        align === "right" && "text-right tabular-nums",
        mono && "font-mono text-xs",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function ProStatusDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className={cn("h-1.5 w-1.5 rounded-full", ok ? "bg-emerald-500" : "bg-amber-500")} aria-hidden />
      <span className="text-foreground/90">{label}</span>
    </span>
  );
}

export function ProEmpty({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-2 px-4 py-10">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {detail ? <p className="text-xs text-muted-foreground max-w-md leading-relaxed">{detail}</p> : null}
      {action}
    </div>
  );
}

export function ProInlineLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="text-xs font-medium text-primary underline-offset-2 hover:underline">
      {children}
    </Link>
  );
}

export function ProAlert({
  severity,
  title,
  detail,
}: {
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5",
        severity === "critical" && "border-destructive/40 bg-destructive/5",
        severity === "warning" && "border-amber-500/40 bg-amber-500/5",
        severity === "info" && "border-border/60 bg-muted/30",
      )}
    >
      <p className="text-xs font-semibold text-foreground">{title}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">{detail}</p>
    </div>
  );
}
