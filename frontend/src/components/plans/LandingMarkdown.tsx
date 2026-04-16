import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import type { ResolvedLandingPageTheme } from "@/lib/landingPageTheme";

type Surface = "dark_page" | "light_card" | "inherit";

type ColorOverrides = {
  body?: string;
  heading?: string;
  link?: string;
  border?: string;
};

type Props = {
  content: string;
  /** `dark_page`: cores do tema da landing escura. `light_card`: cartões brancos (destaques). `inherit`: só estrutura, cor do pai. */
  surface?: Surface;
  /** Obrigatório quando `surface` é `dark_page`. */
  salesTheme?: ResolvedLandingPageTheme | null;
  /** Sobrepõe cores do tema (blocos de texto personalizados). */
  colorOverrides?: ColorOverrides | null;
  /** Classes Tailwind do tamanho base do texto (ex.: `text-lg`). Omissão: `text-sm md:text-base`. */
  sizeClassName?: string;
  className?: string;
};

/**
 * Markdown (GFM) para textos da landing: **negrito**, listas, links, imagens por URL, tabelas simples.
 * Conteúdo vem do admin — sem HTML cru (react-markdown não interpreta tags HTML por defeito).
 */
export function LandingMarkdown({
  content,
  surface = "inherit",
  salesTheme,
  colorOverrides,
  sizeClassName,
  className,
}: Props) {
  const t = salesTheme ?? null;
  const ov = colorOverrides ?? null;
  const body =
    ov?.body ??
    (surface === "dark_page" && t ? t.muted_on_dark : undefined);
  const heading =
    ov?.heading ??
    ov?.body ??
    (surface === "dark_page" && t ? t.heading_on_dark : undefined);
  const link = ov?.link ?? (surface === "dark_page" && t ? t.link : undefined);
  const border = ov?.border ?? (surface === "dark_page" && t ? t.nav_border : undefined);

  const lightCard = surface === "light_card";

  return (
    <div
      className={cn(
        "landing-md leading-relaxed",
        sizeClassName ?? "text-sm md:text-base",
        lightCard && "text-slate-600 [&_strong]:text-slate-900 [&_a]:text-primary [&_code]:text-slate-800",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p
              className={cn("mb-3 last:mb-0 whitespace-pre-wrap", lightCard && "text-slate-600")}
              style={body ? { color: body } : undefined}
            >
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong
              className={cn("font-semibold", lightCard && "text-slate-900")}
              style={heading ? { color: heading } : undefined}
            >
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic" style={body ? { color: body } : undefined}>
              {children}
            </em>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "underline underline-offset-2 hover:opacity-90",
                lightCard && "text-primary",
              )}
              style={link ? { color: link } : undefined}
            >
              {children}
            </a>
          ),
          ul: ({ children }) => (
            <ul
              className={cn("mb-3 list-disc space-y-1 pl-5 last:mb-0", lightCard && "text-slate-600")}
              style={body ? { color: body } : undefined}
            >
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol
              className={cn("mb-3 list-decimal space-y-1 pl-5 last:mb-0", lightCard && "text-slate-600")}
              style={body ? { color: body } : undefined}
            >
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          h1: ({ children }) => (
            <h1
              className={cn("mb-2 mt-4 text-xl font-bold first:mt-0", lightCard && "text-slate-900")}
              style={heading ? { color: heading } : undefined}
            >
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2
              className={cn("mb-2 mt-4 text-lg font-bold first:mt-0", lightCard && "text-slate-900")}
              style={heading ? { color: heading } : undefined}
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3
              className={cn("mb-2 mt-3 text-base font-semibold first:mt-0", lightCard && "text-slate-900")}
              style={heading ? { color: heading } : undefined}
            >
              {children}
            </h3>
          ),
          blockquote: ({ children }) => (
            <blockquote
              className={cn(
                "my-3 border-l-4 pl-3 italic opacity-95",
                lightCard && "border-primary/40 text-slate-700",
              )}
              style={
                body || link
                  ? { borderColor: link ?? border, color: body }
                  : undefined
              }
            >
              {children}
            </blockquote>
          ),
          hr: () => (
            <hr
              className={cn("my-4 border-0 border-t", lightCard && "border-border")}
              style={border ? { borderColor: border } : undefined}
            />
          ),
          table: ({ children }) => (
            <div
              className={cn(
                "my-3 overflow-x-auto rounded-md border text-xs md:text-sm",
                lightCard && "border-border",
              )}
              style={border ? { borderColor: border } : undefined}
            >
              <table className="w-full min-w-[280px] border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className={cn("bg-black/10", lightCard && "bg-muted/50")}>{children}</thead>,
          th: ({ children }) => (
            <th
              className={cn("border px-2 py-1.5 text-left font-semibold", lightCard && "border-border text-slate-900")}
              style={heading ? { color: heading } : undefined}
            >
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td
              className={cn("border px-2 py-1.5", lightCard && "border-border text-slate-600")}
              style={body ? { color: body } : undefined}
            >
              {children}
            </td>
          ),
          img: ({ src, alt }) =>
            src ? (
              <img
                src={src}
                alt={alt ?? ""}
                className="my-3 max-h-[min(70vh,480px)] w-full max-w-full rounded-lg object-contain shadow-sm"
                loading="lazy"
                decoding="async"
              />
            ) : null,
          pre: ({ children }) => (
            <pre
              className={cn(
                "my-3 overflow-x-auto rounded-lg p-3 text-xs",
                lightCard ? "bg-slate-100 text-slate-800" : "bg-black/25 text-white/90",
              )}
            >
              {children}
            </pre>
          ),
          code: ({ className: codeClass, children }) => {
            const isBlock = Boolean(codeClass?.includes("language-"));
            if (isBlock) {
              return <code className={codeClass}>{children}</code>;
            }
            return (
              <code
                className={cn(
                  "rounded px-1 py-0.5 font-mono text-[0.9em]",
                  lightCard ? "bg-slate-100 text-slate-800" : "bg-black/20",
                )}
                style={body ? { color: body } : undefined}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
