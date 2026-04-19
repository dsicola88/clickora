import { useEffect, useMemo, useState } from "react";
import { useBuilder } from "../store";

function formatRelative(savedAt: number, nowMs: number) {
  const sec = Math.floor((nowMs - savedAt) / 1000);
  if (sec < 0) return "agora";
  if (sec < 6) return "agora mesmo";
  if (sec < 60) return `há ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  return new Date(savedAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

export function AutosaveStatus() {
  const lastPersistedAt = useBuilder((s) => s.lastPersistedAt);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 4000);
    return () => clearInterval(id);
  }, []);

  const label = useMemo(() => formatRelative(lastPersistedAt, nowMs), [lastPersistedAt, nowMs]);

  return (
    <div
      className="flex min-w-0 max-w-[9rem] items-center gap-2 rounded-md border border-editor-border/80 bg-editor-panel-2/90 px-2 py-1 sm:max-w-none sm:px-2.5"
      title="Cada alteração é gravada automaticamente no armazenamento local deste browser (autosave)."
    >
      <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.25)]" />
      <span className="truncate text-[11px] text-editor-fg-muted">
        <span className="font-medium text-editor-fg/90">Autosave</span>
        <span className="mx-1.5 text-editor-border">·</span>
        {label}
      </span>
    </div>
  );
}
