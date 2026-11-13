import { useEffect, useMemo, useState } from "react";
import { fill } from "@/i18n";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import type { MessageKey } from "@/i18n";
import { usePresellBuilderEmbedOptional } from "@/contexts/PresellBuilderEmbedContext";
import { useBuilder } from "../store";

function formatRelative(savedAt: number, nowMs: number, t: (key: MessageKey) => string) {
  const sec = Math.floor((nowMs - savedAt) / 1000);
  if (sec < 0) return t("pages.pageBuilder.autosave.now");
  if (sec < 6) return t("pages.pageBuilder.autosave.justNow");
  if (sec < 60) return fill(t("pages.pageBuilder.autosave.secondsAgo"), { n: sec });
  const min = Math.floor(sec / 60);
  if (min < 60) return fill(t("pages.pageBuilder.autosave.minutesAgo"), { n: min });
  const h = Math.floor(min / 60);
  if (h < 24) return fill(t("pages.pageBuilder.autosave.hoursAgo"), { n: h });
  return new Date(savedAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

export function AutosaveStatus() {
  const { t } = useAppLocale();
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
      return formatRelative(lastPersistedAt, nowMs, t);
    }
    if (cloudStatus === "pending" || cloudStatus === "saving") {
      return t("pages.pageBuilder.autosave.savingDraft");
    }
    if (cloudStatus === "error") return t("pages.pageBuilder.autosave.retrying");
    if (cloudAt) {
      return fill(t("pages.pageBuilder.autosave.draftSavedAgo"), {
        when: formatRelative(cloudAt, nowMs, t),
      });
    }
    return formatRelative(lastPersistedAt, nowMs, t);
  }, [cloudAt, cloudStatus, inAccount, lastPersistedAt, nowMs, t]);

  const dotClass =
    cloudStatus === "error"
      ? "bg-amber-500 shadow-[0_0_0_2px_rgba(245,158,11,0.25)]"
      : cloudStatus === "pending" || cloudStatus === "saving"
        ? "bg-sky-500 shadow-[0_0_0_2px_rgba(14,165,233,0.25)] animate-pulse"
        : "bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.25)]";

  const title = inAccount
    ? t("pages.pageBuilder.autosave.titleAccount")
    : t("pages.pageBuilder.autosave.titleLocal");

  return (
    <div
      className="flex min-w-0 max-w-[14rem] items-center gap-2 rounded-md border border-editor-border/80 bg-editor-panel-2/90 px-2 py-1 sm:max-w-[18rem] sm:px-2.5"
      title={title}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} aria-hidden />
      <span className="truncate text-[11px] text-editor-fg-muted">
        <span className="font-medium text-editor-fg/90">
          {inAccount
            ? t("pages.pageBuilder.autosave.draft")
            : t("pages.pageBuilder.autosave.local")}
        </span>
        <span className="mx-1.5 text-editor-border">·</span>
        {label}
      </span>
    </div>
  );
}
