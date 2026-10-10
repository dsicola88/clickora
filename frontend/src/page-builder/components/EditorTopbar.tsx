import { useEffect, useState } from "react";
import { usePresellBuilderEmbedOptional } from "@/contexts/PresellBuilderEmbedContext";
import { useBuilder } from "../store";
import { downloadHtml } from "../export-html";
import { slugify } from "../published";
import {
  Monitor,
  Tablet,
  Smartphone,
  Eye,
  Undo2,
  Redo2,
  Globe,
  Trash2,
  Download,
  LayoutTemplate,
  Search,
  BarChart3,
  ListTree,
  History,
  FolderOpen,
  MoreHorizontal,
  FileJson,
} from "lucide-react";
import type { DeviceType } from "../types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AutosaveStatus } from "./AutosaveStatus";
import { PagesLibraryModal } from "./PagesLibraryModal";
import { TemplatesModal } from "./TemplatesModal";
import { PublishModal } from "./PublishModal";
import { SeoModal } from "./SeoModal";
import { TrackingModal } from "./TrackingModal";

const DEVICES: Array<{ id: DeviceType; Icon: typeof Monitor; label: string }> = [
  { id: "desktop", Icon: Monitor, label: "Desktop" },
  { id: "tablet", Icon: Tablet, label: "Tablet" },
  { id: "mobile", Icon: Smartphone, label: "Mobile" },
];

const menuItem =
  "cursor-pointer text-sm focus:bg-editor-border focus:text-editor-fg";
const menuContent =
  "z-[240] min-w-[12rem] border-editor-border bg-editor-panel text-editor-fg";

export function EditorTopbar() {
  const device = useBuilder((s) => s.device);
  const setDevice = useBuilder((s) => s.setDevice);
  const togglePreview = useBuilder((s) => s.togglePreview);
  const preview = useBuilder((s) => s.preview);
  const undo = useBuilder((s) => s.undo);
  const redo = useBuilder((s) => s.redo);
  const reset = useBuilder((s) => s.reset);
  const doc = useBuilder((s) => s.doc);
  const updateName = useBuilder((s) => s.updateName);
  const canUndo = useBuilder((s) => s.history.length > 0);
  const canRedo = useBuilder((s) => s.future.length > 0);
  const historyLabels = useBuilder((s) => s.historyLabels);
  const futureLabels = useBuilder((s) => s.futureLabels);
  const jumpToHistory = useBuilder((s) => s.jumpToHistory);
  const jumpForward = useBuilder((s) => s.jumpForward);
  const structurePanelOpen = useBuilder((s) => s.structurePanelOpen);
  const toggleStructurePanel = useBuilder((s) => s.toggleStructurePanel);

  const [nameDraft, setNameDraft] = useState(doc.name);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [pagesLibraryOpen, setPagesLibraryOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const [trackingOpen, setTrackingOpen] = useState(false);

  useEffect(() => {
    setNameDraft(doc.name);
  }, [doc.name]);

  const presellEmbed = usePresellBuilderEmbedOptional();

  const commitName = () => {
    const next = nameDraft.trim() || "Presell";
    if (next !== doc.name) updateName(next);
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.name.replace(/\s+/g, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportHtml = () => {
    downloadHtml(doc, slugify(doc.name));
  };

  return (
    <header className="grid h-12 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-editor-border bg-editor-panel px-2 text-editor-fg">
      <div className="flex min-w-0 items-center gap-1.5">
        <input
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
          }}
          aria-label="Nome da página"
          className="h-8 min-w-0 max-w-[220px] flex-1 truncate rounded-md border border-transparent bg-transparent px-2 text-sm font-medium text-editor-fg outline-none hover:border-editor-border focus:border-editor-accent focus:bg-editor-bg"
        />
        <AutosaveStatus />
        <IconBtn label="Desfazer" onClick={undo} disabled={!canUndo}>
          <Undo2 className="h-4 w-4" />
        </IconBtn>
        <IconBtn label="Refazer" onClick={redo} disabled={!canRedo}>
          <Redo2 className="h-4 w-4" />
        </IconBtn>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="Histórico"
              aria-label="Histórico"
              className="flex h-8 w-8 items-center justify-center rounded-md text-editor-fg-muted hover:bg-editor-panel-2 hover:text-editor-fg"
            >
              <History className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={`${menuContent} max-h-72 overflow-y-auto`}>
            {historyLabels.length === 0 && futureLabels.length === 0 ? (
              <DropdownMenuItem disabled className={menuItem}>
                Sem alterações
              </DropdownMenuItem>
            ) : (
              <>
                {[...futureLabels].reverse().map((label, reversedIndex) => {
                  const steps = futureLabels.length - reversedIndex;
                  return (
                    <DropdownMenuItem
                      key={`futuro-${label}-${steps}`}
                      className={`${menuItem} text-editor-fg-muted`}
                      onClick={() => jumpForward(steps)}
                    >
                      {label}
                    </DropdownMenuItem>
                  );
                })}
                {[...historyLabels].reverse().map((label, reversedIndex) => {
                  const keep = historyLabels.length - 1 - reversedIndex;
                  return (
                    <DropdownMenuItem
                      key={`passado-${label}-${keep}`}
                      className={menuItem}
                      onClick={() => jumpToHistory(keep)}
                    >
                      {label}
                    </DropdownMenuItem>
                  );
                })}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-1 rounded-md bg-editor-panel-2 p-1">
        {DEVICES.map(({ id, Icon, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setDevice(id)}
            title={label}
            className={`flex h-7 w-9 items-center justify-center rounded transition-colors ${
              device === id
                ? "bg-editor-accent text-editor-accent-fg"
                : "text-editor-fg-muted hover:text-editor-fg"
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>

      <div className="flex items-center justify-end gap-1">
        <IconBtn label="Templates" onClick={() => setTemplatesOpen(true)}>
          <LayoutTemplate className="h-4 w-4" />
        </IconBtn>
        <IconBtn
          label="Estrutura"
          onClick={() => toggleStructurePanel()}
          active={structurePanelOpen}
        >
          <ListTree className="h-4 w-4" />
        </IconBtn>
        <button
          type="button"
          onClick={togglePreview}
          className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors ${
            preview
              ? "bg-editor-accent text-editor-accent-fg"
              : "bg-editor-panel-2 text-editor-fg hover:bg-editor-border"
          }`}
        >
          <Eye className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">{preview ? "Editar" : "Pré-visualizar"}</span>
        </button>
        {presellEmbed ? (
          <button
            type="button"
            onClick={() => {
              commitName();
              presellEmbed.onRequestSave();
            }}
            disabled={presellEmbed.isSaving || presellEmbed.canSave === false}
            className="flex h-8 items-center gap-1.5 rounded-md bg-editor-accent px-3 text-xs font-semibold text-editor-accent-fg hover:opacity-90 disabled:opacity-50"
          >
            <Globe className="h-3.5 w-3.5" />
            {presellEmbed.isSaving ? "A guardar…" : "Publicar"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setPublishOpen(true)}
            className="flex h-8 items-center gap-1.5 rounded-md bg-editor-accent px-3 text-xs font-semibold text-editor-accent-fg hover:opacity-90"
          >
            <Globe className="h-3.5 w-3.5" />
            Publicar
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-md text-editor-fg-muted transition-colors hover:bg-editor-panel-2 hover:text-editor-fg"
              title="Mais ações"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={menuContent}>
            <DropdownMenuItem className={menuItem} onClick={() => setPagesLibraryOpen(true)}>
              <FolderOpen className="mr-2 h-4 w-4" />
              Páginas guardadas
            </DropdownMenuItem>
            <DropdownMenuItem className={menuItem} onClick={() => setSeoOpen(true)}>
              <Search className="mr-2 h-4 w-4" />
              SEO
            </DropdownMenuItem>
            <DropdownMenuItem className={menuItem} onClick={() => setTrackingOpen(true)}>
              <BarChart3 className="mr-2 h-4 w-4" />
              Tracking da página
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-editor-border" />
            <DropdownMenuItem className={menuItem} onClick={handleExportHtml}>
              <Download className="mr-2 h-4 w-4" />
              Exportar HTML
            </DropdownMenuItem>
            <DropdownMenuItem className={menuItem} onClick={handleExportJson}>
              <FileJson className="mr-2 h-4 w-4" />
              Exportar JSON
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-editor-border" />
            <DropdownMenuItem
              className={menuItem}
              onClick={() => {
                if (confirm("Limpar toda a página?")) reset();
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Limpar página
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <TemplatesModal open={templatesOpen} onClose={() => setTemplatesOpen(false)} />
      <PagesLibraryModal open={pagesLibraryOpen} onClose={() => setPagesLibraryOpen(false)} />
      {!presellEmbed ? <PublishModal open={publishOpen} onClose={() => setPublishOpen(false)} /> : null}
      <SeoModal open={seoOpen} onClose={() => setSeoOpen(false)} />
      <TrackingModal open={trackingOpen} onClose={() => setTrackingOpen(false)} />
    </header>
  );
}

function IconBtn({
  children,
  onClick,
  disabled,
  label,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
        active
          ? "bg-editor-accent text-editor-accent-fg"
          : "text-editor-fg-muted hover:bg-editor-panel-2 hover:text-editor-fg"
      }`}
    >
      {children}
    </button>
  );
}
