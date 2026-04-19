import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Download,
  FileJson,
  FileUp,
  FolderOpen,
  Loader2,
  Trash2,
  Link2,
  Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  createLibraryEntry,
  deleteLibraryEntry,
  getLibraryDoc,
  listLibraryMetas,
  type LibraryEntryMeta,
} from "../library-storage";
import {
  extractPageDocumentFromExportedHtml,
  parsePageDocumentFromJson,
} from "../document-import";
import { downloadHtml } from "../export-html";
import { useBuilder } from "../store";

function formatWhen(ts: number) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString();
  }
}

export function PagesLibraryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const doc = useBuilder((s) => s.doc);
  const linkedLibraryId = useBuilder((s) => s.linkedLibraryId);
  const hydrateDocument = useBuilder((s) => s.hydrateDocument);
  const setLinkedLibraryId = useBuilder((s) => s.setLinkedLibraryId);

  const [entries, setEntries] = useState<LibraryEntryMeta[]>([]);
  const [saveName, setSaveName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    setEntries(listLibraryMetas());
  }, []);

  useEffect(() => {
    if (open) {
      refresh();
      setSaveName(doc.name?.trim() || "");
    }
  }, [open, refresh, doc.name]);

  const linkedMeta = useMemo(
    () => entries.find((e) => e.id === linkedLibraryId),
    [entries, linkedLibraryId],
  );

  const handleSaveCopy = () => {
    const name = saveName.trim() || doc.name || "Página sem título";
    try {
      createLibraryEntry(name, doc);
      refresh();
      toast.success("Cópia guardada na biblioteca local.");
      setSaveName(name);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível guardar.");
    }
  };

  const handleSaveAndLink = () => {
    const name = saveName.trim() || doc.name || "Página sem título";
    try {
      const id = createLibraryEntry(name, doc);
      setLinkedLibraryId(id);
      refresh();
      toast.success("Guardado e ligado: as próximas edições atualizam esta entrada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível guardar.");
    }
  };

  const handleOpen = async (id: string, sync: boolean) => {
    setBusyId(id);
    try {
      const loaded = getLibraryDoc(id);
      if (!loaded) {
        toast.error("Entrada em falta ou corrompida.");
        refresh();
        return;
      }
      hydrateDocument(loaded, sync ? { linkedLibraryId: id } : {});
      toast.success(sync ? "Página aberta com sincronização à biblioteca." : "Página carregada no editor.");
      onClose();
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = (id: string) => {
    if (!confirm("Eliminar esta entrada da biblioteca local?")) return;
    deleteLibraryEntry(id);
    if (linkedLibraryId === id) {
      setLinkedLibraryId(null);
    }
    refresh();
    toast.success("Entrada removida.");
  };

  const exportEntryHtml = (id: string) => {
    const d = getLibraryDoc(id);
    if (!d) {
      toast.error("Documento em falta.");
      return;
    }
    const slug = d.name.replace(/\s+/g, "-").toLowerCase().slice(0, 80) || "pagina";
    downloadHtml(d, slug);
  };

  const exportEntryJson = (id: string) => {
    const d = getLibraryDoc(id);
    if (!d) {
      toast.error("Documento em falta.");
      return;
    }
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(d.name || "pagina").replace(/\s+/g, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("JSON descarregado.");
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusyId("import");
    try {
      const text = await file.text();
      const lower = file.name.toLowerCase();
      let parsed = lower.endsWith(".html") || lower.endsWith(".htm")
        ? extractPageDocumentFromExportedHtml(text)
        : parsePageDocumentFromJson(text);
      if (!parsed && (lower.endsWith(".html") || lower.endsWith(".htm"))) {
        parsed = parsePageDocumentFromJson(text);
      }
      if (!parsed) {
        toast.error(
          "Ficheiro inválido. Use JSON exportado pelo editor ou HTML gerado pelo Clickora (com dados embutidos).",
        );
        return;
      }
      hydrateDocument(parsed, {});
      toast.success("Documento importado para o editor.");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao ler o ficheiro.");
    } finally {
      setBusyId(null);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={cn(
          "flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-editor-border bg-editor-panel text-editor-fg shadow-2xl",
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pages-library-title"
      >
        <header className="space-y-1 border-b border-editor-border px-5 py-4 text-left">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-editor-accent/15 text-editor-accent">
                <FolderOpen className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 id="pages-library-title" className="text-base font-semibold text-editor-fg">
                  Biblioteca de páginas
                </h2>
                <p className="text-xs leading-relaxed text-editor-fg-muted">
                  Cópias guardadas neste dispositivo (local). Exporte para HTML ou JSON, ou importe ficheiros gerados pelo
                  Clickora.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="rounded-md p-1.5 text-editor-fg-muted hover:bg-editor-border hover:text-editor-fg"
              onClick={onClose}
              aria-label="Fechar"
            >
              <span className="text-lg leading-none">×</span>
            </button>
          </div>
          {linkedLibraryId ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-editor-border bg-editor-panel-2 px-3 py-2 text-[11px] text-editor-fg-muted">
              <Link2 className="h-3.5 w-3.5 shrink-0 text-editor-accent" aria-hidden />
              <span>
                Sincronizado com:{" "}
                <span className="font-medium text-editor-fg">{linkedMeta?.name ?? linkedLibraryId}</span>
              </span>
              <button
                type="button"
                className="ml-auto inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium text-editor-fg-muted hover:bg-editor-border hover:text-editor-fg"
                onClick={() => {
                  setLinkedLibraryId(null);
                  toast.message("Sincronização desligada — o editor continua com o conteúdo atual.");
                }}
              >
                <Unlink className="h-3 w-3" />
                Desligar
              </button>
            </div>
          ) : null}
        </header>

        <div className="space-y-4 px-5 py-4">
          <div className="rounded-lg border border-editor-border bg-editor-bg/80 p-3">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-editor-fg-muted">Nova cópia</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Nome da página na biblioteca"
                className="h-9 border-editor-border bg-editor-panel text-editor-fg text-sm"
              />
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-9 border border-editor-border bg-editor-panel-2 text-editor-fg hover:bg-editor-border"
                  onClick={handleSaveCopy}
                >
                  Guardar cópia
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-9 bg-editor-accent text-editor-accent-fg hover:opacity-90"
                  onClick={handleSaveAndLink}
                >
                  Guardar e ligar
                </Button>
              </div>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-editor-fg-muted">
              «Guardar e ligar» mantém esta entrada atualizada enquanto editas. «Guardar cópia» apenas arquiva um instantâneo.
            </p>
          </div>

          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".json,.html,.htm,application/json,text/html"
              className="hidden"
              onChange={handleImportFile}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 w-full border-editor-border bg-editor-panel-2 text-editor-fg hover:bg-editor-border sm:w-auto"
              disabled={busyId === "import"}
              onClick={() => fileRef.current?.click()}
            >
              {busyId === "import" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileUp className="mr-2 h-4 w-4" />
              )}
              Importar ficheiro (.json ou .html Clickora)
            </Button>
          </div>
        </div>

        <div className="border-t border-editor-border px-5 pb-2 pt-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-editor-fg-muted">Entradas guardadas</p>
        </div>

        <ScrollArea className="max-h-[min(42vh,320px)] px-3">
          <ul className="space-y-2 pb-4">
            {entries.length === 0 ? (
              <li className="rounded-lg border border-dashed border-editor-border bg-editor-bg/50 px-4 py-8 text-center text-sm text-editor-fg-muted">
                Ainda não há cópias. Edite a página e use «Guardar cópia» acima.
              </li>
            ) : (
              entries.map((en) => (
                <li
                  key={en.id}
                  className={cn(
                    "rounded-lg border border-editor-border bg-editor-panel-2 p-3 transition-colors",
                    linkedLibraryId === en.id && "ring-1 ring-editor-accent/50",
                  )}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-editor-fg">{en.name}</p>
                      <p className="text-[10px] text-editor-fg-muted">{formatWhen(en.updatedAt)}</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-7 px-2 text-[11px] border-editor-border"
                        disabled={busyId === en.id}
                        onClick={() => handleOpen(en.id, true)}
                      >
                        {busyId === en.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Abrir"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[11px] text-editor-fg-muted"
                        disabled={busyId === en.id}
                        onClick={() => handleOpen(en.id, false)}
                        title="Carregar sem sobrescrever a biblioteca ao editar"
                      >
                        Sem ligação
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-editor-fg-muted hover:text-editor-fg"
                        title="Exportar HTML"
                        onClick={() => exportEntryHtml(en.id)}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-editor-fg-muted hover:text-editor-fg"
                        title="Exportar JSON"
                        onClick={() => exportEntryJson(en.id)}
                      >
                        <FileJson className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive/80 hover:text-destructive"
                        title="Eliminar"
                        onClick={() => handleDelete(en.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </ScrollArea>
      </div>
    </div>
  );
}
