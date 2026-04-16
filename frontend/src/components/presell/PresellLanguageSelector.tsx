import { Languages } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRESELL_CREATION_LANGUAGES } from "@/lib/presellUiStrings.types";
import type { PresellUiMode } from "@/lib/presellUiLanguage";
import { overrideToMode } from "@/lib/presellUiLanguage";

type Props = {
  override: string | null;
  onModeChange: (mode: PresellUiMode) => void;
  className?: string;
};

/**
 * Controlo compacto: por defeito segue o idioma da presell; o visitante pode escolher
 * automático (navegador) ou um dos idiomas suportados pela interface.
 */
export function PresellLanguageSelector({ override, onModeChange, className }: Props) {
  const mode = overrideToMode(override);

  return (
    <div
      className={
        className ??
        "fixed bottom-4 left-4 z-[80] flex max-w-[min(100%,240px)] flex-col gap-1 rounded-lg border border-border/80 bg-card/95 px-2 py-1.5 shadow-lg backdrop-blur-sm sm:bottom-5 sm:left-5"
      }
    >
      <Label htmlFor="presell-ui-lang" className="sr-only">
        Idioma da interface
      </Label>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Languages className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <Select value={mode} onValueChange={(v) => onModeChange(v as PresellUiMode)}>
          <SelectTrigger
            id="presell-ui-lang"
            className="h-8 border-0 bg-transparent px-1 text-xs font-medium shadow-none focus:ring-0"
          >
            <SelectValue placeholder="Idioma" />
          </SelectTrigger>
          <SelectContent position="popper" side="top" align="start" className="max-h-[min(70vh,360px)]">
            <SelectItem value="default" className="text-xs">
              Idioma da página
            </SelectItem>
            <SelectItem value="auto" className="text-xs">
              Automático (navegador)
            </SelectItem>
            {PRESELL_CREATION_LANGUAGES.map(({ id, name }) => (
              <SelectItem key={id} value={id} className="text-xs">
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
