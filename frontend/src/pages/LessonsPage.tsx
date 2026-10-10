import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, PlayCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { LoadingState } from "@/components/LoadingState";
import { Button } from "@/components/ui/button";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { cn } from "@/lib/utils";
import { isSafeLessonEmbed, lessonsService, type AcademyLesson } from "@/services/lessonsService";

function groupLessons(lessons: AcademyLesson[]) {
  const groups = new Map<string, AcademyLesson[]>();
  for (const lesson of lessons) {
    const key = lesson.module?.trim() || "Começar";
    const list = groups.get(key) ?? [];
    list.push(lesson);
    groups.set(key, list);
  }
  return [...groups.entries()];
}

export default function LessonsPage() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("id");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["academy-lessons"],
    queryFn: async () => {
      const { data, error, errorCode } = await lessonsService.list();
      if (error) {
        const err = new Error(error) as Error & { code?: string | null };
        err.code = errorCode;
        throw err;
      }
      return (data?.lessons ?? []).filter((lesson) => isSafeLessonEmbed(lesson.embed_url));
    },
  });

  const lessons = data ?? [];
  const groups = useMemo(() => groupLessons(lessons), [lessons]);
  const selected = lessons.find((lesson) => lesson.id === selectedId) ?? lessons[0] ?? null;

  if (isLoading) return <LoadingState message="A carregar aulas…" />;

  if (isError) {
    const code = (error as Error & { code?: string | null })?.code ?? "";
    const blocked = code.startsWith("subscription_");
    return (
      <div className={cn(APP_PAGE_SHELL, "max-w-xl py-10")}>
        <PageHeader
          title="Aulas"
          description={
            blocked
              ? "As aulas em vídeo fazem parte da assinatura activa."
              : error instanceof Error
                ? error.message
                : "Não foi possível carregar as aulas."
          }
        />
        {blocked ? (
          <Button asChild>
            <Link to="/planos">Ver planos</Link>
          </Button>
        ) : (
          <Button variant="outline" onClick={() => void refetch()}>
            Tentar novamente
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        title="Aulas"
        description={
          <>
            Vídeos curtos para usar a ferramenta sem abrir um ticket. O guia escrito continua em{" "}
            <Link to="/ajuda" className="font-medium text-primary underline-offset-2 hover:underline">
              Aprender
            </Link>
            .
          </>
        }
      />

      {lessons.length === 0 || !selected ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
          <GraduationCap className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">Ainda não há aulas publicadas</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Quando o super administrador adicionar vídeos do YouTube ou do Bunny, eles aparecem aqui, agrupados por
            módulo.
          </p>
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <nav className="space-y-4 rounded-xl border border-border/70 bg-card/50 p-3" aria-label="Módulos de aulas">
            {groups.map(([moduleName, items]) => (
              <div key={moduleName}>
                <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {moduleName}
                </p>
                <ul className="space-y-1">
                  {items.map((lesson) => {
                    const active = lesson.id === selected.id;
                    return (
                      <li key={lesson.id}>
                        <button
                          type="button"
                          onClick={() => setParams({ id: lesson.id })}
                          className={cn(
                            "flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                            active ? "bg-primary/10 font-medium text-foreground" : "text-foreground/80 hover:bg-muted",
                          )}
                        >
                          <PlayCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <span className="min-w-0 leading-snug">{lesson.title}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <article className="min-w-0 space-y-4">
            <div className="overflow-hidden rounded-xl border border-border bg-black">
              <div className="aspect-video w-full">
                <iframe
                  key={selected.id}
                  src={selected.embed_url!}
                  title={selected.title}
                  className="h-full w-full"
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{selected.module}</p>
              <h2 className="text-xl font-semibold text-foreground">{selected.title}</h2>
              {selected.description ? (
                <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{selected.description}</p>
              ) : null}
            </div>
          </article>
        </div>
      )}
    </div>
  );
}
