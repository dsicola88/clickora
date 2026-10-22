import { useEffect, useMemo, useState } from "react";
import { usePresellBuilderEmbedOptional } from "@/contexts/PresellBuilderEmbedContext";
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
  const embed = usePresellBuilderEmbedOptional();
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 4000);
    return () => clearInterval(id);
  }, []);

  const cloudStatus = embed?.cloudAutosaveStatus;
  const cloudAt = embed?.lastCloudSavedAt ?? null;
  const inAccount = Boolean(embed && embed.canSave !== false);

  const label = useMemo(() => {
    if (!inAccount) {
      return formatRelative(lastPersistedAt, nowMs);
    }
    if (cloudStatus === "pending" || cloudStatus === "saving") return "a guardar na conta…";
    if (cloudStatus === "error") return "falha — a tentar de novo";
    if (cloudAt) return formatRelative(cloudAt, nowMs);
    return formatRelative(lastPersistedAt, nowMs);
  }, [cloudAt, cloudStatus, inAccount, lastPersistedAt, nowMs]);

  const dotClass =
    cloudStatus === "error"
      ? "bg-amber-500 shadow-[0_0_0_2px_rgba(245,158,11,0.25)]"
      : cloudStatus === "pending" || cloudStatus === "saving"
        ? "bg-sky-500 shadow-[0_0_0_2px_rgba(14,165,233,0.25)] animate-pulse"
        : "bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.25)]";

  const title = inAccount
    ? "Cada alteração grava automaticamente na sua conta (base de dados). O browser só é cache local."
    : "Alterações gravadas localmente neste browser.";

  return (
    <div
      className="flex min-w-0 max-w-[11rem] items-center gap-2 rounded-md border border-editor-border/80 bg-editor-panel-2/90 px-2 py-1 sm:max-w-none sm:px-2.5"
      title={title}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
      <span className="truncate text-[11px] text-editor-fg-muted">
        <span className="font-medium text-editor-fg/90">
          {inAccount ? "Autosave (conta)" : "Autosave"}
        </span>
        <span className="mx-1.5 text-editor-border">·</span>
        {label}
      </span>
    </div>
  );
}
