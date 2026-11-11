import { Palette } from "lucide-react";
import { fill } from "@/i18n";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EDITOR_CHROME_THEMES, type EditorChromeThemeId } from "../editorChromeTheme";

export function EditorThemePicker({
  themeId,
  onChange,
}: {
  themeId: EditorChromeThemeId;
  onChange: (id: EditorChromeThemeId) => void;
}) {
  const { t } = useAppLocale();
  const current = EDITOR_CHROME_THEMES.find((theme) => theme.id === themeId) ?? EDITOR_CHROME_THEMES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={fill(t("pages.pageBuilder.theme.title"), { name: current.label })}
          aria-label={t("pages.pageBuilder.theme.aria")}
          className="flex h-8 items-center gap-1.5 rounded-md px-2 text-editor-fg-muted hover:bg-editor-panel-2 hover:text-editor-fg"
        >
          <Palette className="h-4 w-4" />
          <span className="hidden max-w-[6.5rem] truncate text-[11px] font-medium xl:inline">
            {current.label}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="z-[240] w-64 border-editor-border bg-editor-panel text-editor-fg"
      >
        <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wider text-editor-fg-muted">
          {t("pages.pageBuilder.theme.menu")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-editor-border" />
        {EDITOR_CHROME_THEMES.map((theme) => {
          const active = theme.id === themeId;
          return (
            <DropdownMenuItem
              key={theme.id}
              className={`cursor-pointer gap-2.5 focus:bg-editor-border focus:text-editor-fg ${
                active ? "bg-editor-panel-2" : ""
              }`}
              onClick={() => onChange(theme.id)}
            >
              <span className="flex shrink-0 gap-0.5" aria-hidden>
                {theme.swatches.map((c) => (
                  <span
                    key={c}
                    className="h-4 w-4 rounded-sm border border-black/10"
                    style={{ background: c }}
                  />
                ))}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium">{theme.label}</span>
                <span className="block truncate text-[10px] text-editor-fg-muted">
                  {theme.description}
                </span>
              </span>
              {active ? (
                <span className="text-[10px] font-semibold text-editor-accent">{t("common.active")}</span>
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
