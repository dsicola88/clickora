import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { LoadingState } from "@/components/LoadingState";
import { lessonsService, type AcademyLessonAdmin, type LessonDraft } from "@/services/lessonsService";

type FormState = {
  title: string;
  description: string;
  module_name: string;
  source_url: string;
  sort_order: string;
  published: boolean;
};

const emptyForm = (): FormState => ({
  title: "",
  description: "",
  module_name: "Começar",
  source_url: "",
  sort_order: "0",
  published: false,
});

function toDraft(form: FormState): LessonDraft {
  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    source_url: form.source_url.trim(),
    module_name: form.module_name.trim() || "Começar",
    sort_order: Number.parseInt(form.sort_order, 10) || 0,
    published: form.published,
  };
}

export function AdminLessonsPanel() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data: lessons = [], isLoading } = useQuery({
    queryKey: ["admin-lessons"],
    queryFn: async () => {
      const { data, error } = await lessonsService.listAdmin();
      if (error) throw new Error(error);
      return data?.lessons ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = toDraft(form);
      const result = editingId
        ? await lessonsService.update(editingId, body)
        : await lessonsService.create(body);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      toast.success(editingId ? "Aula actualizada" : "Aula criada");
      setEditingId(null);
      setForm(emptyForm());
      void queryClient.invalidateQueries({ queryKey: ["admin-lessons"] });
      void queryClient.invalidateQueries({ queryKey: ["academy-lessons"] });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Não foi possível guardar a aula");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await lessonsService.remove(id);
      if (result.error) throw new Error(result.error);
    },
    onSuccess: (_data, id) => {
      toast.success("Aula removida");
      if (editingId === id) {
        setEditingId(null);
        setForm(emptyForm());
      }
      void queryClient.invalidateQueries({ queryKey: ["admin-lessons"] });
      void queryClient.invalidateQueries({ queryKey: ["academy-lessons"] });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Não foi possível remover a aula");
    },
  });

  function startEdit(lesson: AcademyLessonAdmin) {
    setEditingId(lesson.id);
    setForm({
      title: lesson.title,
      description: lesson.description ?? "",
      module_name: lesson.module,
      source_url: lesson.source_url,
      sort_order: String(lesson.sort_order),
      published: lesson.published,
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="h-4 w-4 text-primary" />
            {editingId ? "Editar aula" : "Nova aula"}
          </CardTitle>
          <CardDescription>
            Cole o link do YouTube (watch, youtu.be ou shorts) ou o embed do Bunny Stream
            (iframe.mediadelivery.net). Rascunhos ficam invisíveis para os assinantes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="lesson-title">Título</Label>
              <Input
                id="lesson-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Como criar a primeira presell"
                required
                maxLength={200}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="lesson-module">Módulo</Label>
                <Input
                  id="lesson-module"
                  value={form.module_name}
                  onChange={(e) => setForm((f) => ({ ...f, module_name: e.target.value }))}
                  placeholder="Começar"
                  maxLength={80}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lesson-order">Ordem</Label>
                <Input
                  id="lesson-order"
                  inputMode="numeric"
                  value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lesson-url">Link do vídeo</Label>
              <Input
                id="lesson-url"
                value={form.source_url}
                onChange={(e) => setForm((f) => ({ ...f, source_url: e.target.value }))}
                placeholder="https://www.youtube.com/watch?v=… ou embed Bunny"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lesson-description">Descrição</Label>
              <Textarea
                id="lesson-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="O que a pessoa consegue fazer depois de ver esta aula."
                rows={3}
                maxLength={2000}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2">
              <Label htmlFor="lesson-published" className="cursor-pointer">
                Publicada para assinantes
              </Label>
              <Switch
                id="lesson-published"
                checked={form.published}
                onCheckedChange={(published) => setForm((f) => ({ ...f, published }))}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saveMutation.isPending} className="gap-2">
                <Plus className="h-4 w-4" />
                {editingId ? "Guardar alterações" : "Adicionar aula"}
              </Button>
              {editingId ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyForm());
                  }}
                >
                  Cancelar
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Catálogo</CardTitle>
          <CardDescription>Os assinantes vêem só as aulas publicadas, em /aulas.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState message="A carregar aulas…" />
          ) : lessons.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma aula ainda. A primeira fica como rascunho até publicar.</p>
          ) : (
            <ul className="space-y-2">
              {lessons.map((lesson) => (
                <li
                  key={lesson.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border/70 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{lesson.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {lesson.module} · {lesson.provider === "bunny" ? "Bunny" : "YouTube"} · ordem {lesson.sort_order}
                    </p>
                    <Badge variant={lesson.published ? "secondary" : "outline"} className="mt-2">
                      {lesson.published ? "Publicada" : "Rascunho"}
                    </Badge>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button type="button" size="icon" variant="ghost" onClick={() => startEdit(lesson)} aria-label="Editar aula">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={deleteMutation.isPending}
                      aria-label="Remover aula"
                      onClick={() => {
                        if (window.confirm(`Remover a aula “${lesson.title}”?`)) deleteMutation.mutate(lesson.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
