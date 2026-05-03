import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const INPUT_STYLE =
  "h-10 w-full rounded-md border border-neutral-400/85 bg-background px-3 py-2 text-[13px] leading-snug shadow-sm outline-none ring-offset-background transition-[border-color,box-shadow] placeholder:text-muted-foreground/65 focus-visible:border-primary/70 focus-visible:ring-2 focus-visible:ring-primary/28 dark:border-border dark:bg-background";

/** Expande até `slots` linhas; caracteres já limitados em cada entrada. */
function linesToSlots(raw: string | undefined, slots: number, maxChars: number): string[] {
  const split = String(raw ?? "").split("\n");
  return Array.from({ length: slots }, (_, i) => String(split[i] ?? "").slice(0, maxChars));
}

function slotsToStored(slots: string[]): string {
  return slots.join("\n");
}

type LineStackPropsBase = {
  value: string;
  onChange: (next: string) => void;
  className?: string;
  /** `minimal`: sem título duplicado quando o bloco já está dentro de um cartão «Títulos · RSA» estilo Google. */
  variant?: "default" | "minimal";
};

/** Até 15 títulos (30 caracteres); primeiros 3 com marcador obrigatório (RSA Pesquisa). */
export function GoogleRsaHeadlinesFieldStack({
  value,
  onChange,
  className,
  variant = "default",
}: LineStackPropsBase) {
  const maxSlots = 15;
  const maxChars = 30;
  const requiredFirst = 3;
  const slots = linesToSlots(value, maxSlots, maxChars);

  const updateLine = (index: number, line: string) => {
    const next = [...slots];
    next[index] = line.slice(0, maxChars);
    onChange(slotsToStored(next));
  };

  const filledCount = slots.filter((s) => s.trim()).length;

  return (
    <div className={cn("space-y-3", className)}>
      {variant === "default" ? (
        <>
          <p className="text-sm font-medium text-foreground">Títulos · RSA</p>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Até {maxSlots} títulos ({maxChars} caracteres cada). Neste fluxo são necessários pelo menos {requiredFirst} (
            {filledCount}/{maxSlots} preenchidos).
          </p>
        </>
      ) : (
        <p className="text-[11px] leading-snug text-muted-foreground">
          {filledCount}/{maxSlots} títulos · Até {maxChars} caracteres cada · {requiredFirst} obrigatórios.
        </p>
      )}
      <div className="space-y-3.5">
        {slots.map((line, idx) => (
          <div key={idx}>
            <Input
              value={line}
              onChange={(e) => updateLine(idx, e.target.value)}
              maxLength={maxChars}
              placeholder={idx < requiredFirst ? "Titular" : "Titular opcional"}
              aria-label={`Título RSA ${idx + 1}`}
              className={INPUT_STYLE}
              autoComplete="off"
            />
            <div className="mt-1 flex items-baseline justify-between gap-3 px-0.5 text-[11px] text-muted-foreground">
              <span
                className={
                  idx < requiredFirst ? "font-medium text-neutral-700 dark:text-neutral-400" : "invisible select-none"
                }
              >
                Obrigatório
              </span>
              <span className="tabular-nums">{line.length}/{maxChars}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Até 4 descrições (90 caracteres); primeiras 2 marcadas obrigatórias. */
export function GoogleRsaDescriptionsFieldStack({
  value,
  onChange,
  className,
  variant = "default",
}: LineStackPropsBase) {
  const maxSlots = 4;
  const maxChars = 90;
  const requiredFirst = 2;
  const slots = linesToSlots(value, maxSlots, maxChars);

  const updateLine = (index: number, line: string) => {
    const next = [...slots];
    next[index] = line.slice(0, maxChars);
    onChange(slotsToStored(next));
  };

  const filledCount = slots.filter((s) => s.trim()).length;

  return (
    <div className={cn("space-y-3", className)}>
      {variant === "default" ? (
        <>
          <p className="text-sm font-medium text-foreground">Descrições · RSA</p>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Até {maxSlots} descrições ({maxChars} caracteres cada). Pelo menos {requiredFirst} obrigatórias (
            {filledCount}/{maxSlots} preenchidas).
          </p>
        </>
      ) : (
        <p className="text-[11px] leading-snug text-muted-foreground">
          {filledCount}/{maxSlots} descrições · Até {maxChars} caracteres · {requiredFirst} obrigatórias.
        </p>
      )}
      <div className="space-y-3.5">
        {slots.map((line, idx) => (
          <div key={idx}>
            <Input
              value={line}
              onChange={(e) => updateLine(idx, e.target.value)}
              maxLength={maxChars}
              placeholder={idx < requiredFirst ? "Descrição" : "Descrição opcional"}
              aria-label={`Descrição RSA ${idx + 1}`}
              className={cn(INPUT_STYLE, "min-h-10")}
              autoComplete="off"
            />
            <div className="mt-1 flex items-baseline justify-between gap-3 px-0.5 text-[11px] text-muted-foreground">
              <span
                className={
                  idx < requiredFirst ? "font-medium text-neutral-700 dark:text-neutral-400" : "invisible select-none"
                }
              >
                Obrigatório
              </span>
              <span className="tabular-nums">{line.length}/{maxChars}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
