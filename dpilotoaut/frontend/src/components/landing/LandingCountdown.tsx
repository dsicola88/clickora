"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type Labels = { days: string; hours: string; minutes: string; seconds: string };

const ptLabels: Labels = { days: "Dias", hours: "Horas", minutes: "Minutos", seconds: "Segundos" };

function parseLabels(raw: unknown): Labels {
  if (raw && typeof raw === "object" && raw !== null) {
    const o = raw as Record<string, unknown>;
    return {
      days: String(o.days ?? ptLabels.days),
      hours: String(o.hours ?? ptLabels.hours),
      minutes: String(o.minutes ?? ptLabels.minutes),
      seconds: String(o.seconds ?? ptLabels.seconds),
    };
  }
  return ptLabels;
}

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

export function LandingCountdown({
  targetIso,
  labels: labelsRaw,
  expiredMessage,
  className,
}: {
  targetIso: string;
  labels?: unknown;
  expiredMessage?: string;
  className?: string;
}) {
  const labels = parseLabels(labelsRaw);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const end = Date.parse(targetIso);
  if (Number.isNaN(end)) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>Data-alvo inválida. Ajuste no editor.</p>
    );
  }

  const left = Math.max(0, end - now);
  const done = end <= now;

  if (done) {
    return (
      <p className={cn("text-center text-lg font-medium text-foreground", className)}>
        {expiredMessage || "O tempo acabou."}
      </p>
    );
  }

  const totalSec = Math.floor(left / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const units = [
    { v: String(days), l: labels.days },
    { v: pad2(hours), l: labels.hours },
    { v: pad2(minutes), l: labels.minutes },
    { v: pad2(seconds), l: labels.seconds },
  ];

  return (
    <div
      className={cn("grid grid-cols-2 gap-3 sm:grid-cols-4", className)}
      role="timer"
      aria-live="polite"
      aria-atomic="true"
    >
      {units.map((u) => (
        <div
          key={u.l}
          className="flex min-w-0 flex-col items-center rounded-xl border border-border bg-card p-2 shadow-sm sm:p-4"
        >
          <span
            className="text-2xl font-bold tabular-nums sm:text-3xl"
            style={{ color: "var(--lp-primary, hsl(var(--primary)))" }}
          >
            {u.v}
          </span>
          <span className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{u.l}</span>
        </div>
      ))}
    </div>
  );
}
