import { useState } from "react";
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
  FolderOpen,
  ChevronDown,
  FileJson,
} from "lucide-react";
import type { DeviceType } from "../types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

export function EditorTopbar() {
  const device = useBuilder((s) => s.device);
  const setDevice = useBuilder((s) => s.setDevice);
  const togglePreview = useBuilder((s) => s.togglePreview);
  const preview = useBuilder((s) => s.preview);
  const undo = useBuilder((s) => s.undo);
  const redo = useBuilder((s) => s.redo);
  const reset = useBuilder((s) => s.reset);
  const doc = useBuilder((s) => s.doc);
  const canUndo = useBuilder((s) => s.history.length > 0);
  const canRedo = useBuilder((s) => s.future.length > 0);
  const structurePanelOpen = useBuilder((s) => s.structurePanelOpen);
  const toggleStructurePanel = useBuilder((s) => s.toggleStructurePanel);

  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [pagesLibraryOpen, setPagesLibraryOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const [trackingOpen, setTrackingOpen] = useState(false);

  const presellEmbed = usePresellBuilderEmbedOptional();

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
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-editor-border bg-editor-panel px-3 text-editor-fg">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 items-center gap-2 pr-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-editor-accent text-xs font-bold text-editor-accent-fg">
            L
          </div>
          <span className="truncate text-sm font-medium">{doc.name}</span>
        </div>
        <AutosaveStatus />
        <div className="h-6 w-px bg-editor-border" />
        <div className="flex items-center gap-1">
          <IconBtn label="Desfazer" onClick={undo} disabled={!canUndo}>
            <Undo2 className="h-4 w-4" />
          </IconBtn>
          <IconBtn label="Refazer" onClick={redo} disabled={!canRedo}>
            <Redo2 className="h-4 w-4" />
          </IconBtn>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setPagesLibraryOpen(true)}
          className="flex h-8 items-center gap-1.5 rounded border border-editor-border bg-editor-panel-2 px-3 text-xs font-medium text-editor-fg transition-colors hover:bg-editor-border"
          title="Páginas guardadas, importar e exportar"
        >
          <FolderOpen className="h-3.5 w-3.5" />
          Páginas
        </button>

        <button
          type="button"
          onClick={() => setTemplatesOpen(true)}
          className="flex h-8 items-center gap-1.5 rounded bg-editor-panel-2 px-3 text-xs font-medium text-editor-fg transition-colors hover:bg-editor-border"
          title="Biblioteca de templates"
        >
          <LayoutTemplate className="h-3.5 w-3.5" />
          Templates
        </button>

        <button
          type="button"
          onClick={() => toggleStructurePanel()}
          className={`flex h-8 items-center gap-1.5 rounded px-3 text-xs font-medium transition-colors ${
            structurePanelOpen
              ? "bg-editor-accent text-editor-accent-fg"
              : "bg-editor-panel-2 text-editor-fg hover:bg-editor-border"
          }`}
          title="Árvore da página: secções, colunas e widgets"
        >
          <ListTree className="h-3.5 w-3.5" />
          Estrutura
        </button>

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
      </div>

      <div className="flex items-center gap-2">
        <IconBtn label="Configurações de SEO" onClick={() => setSeoOpen(true)}>
          <Search className="h-4 w-4" />
        </IconBtn>
        <IconBtn label="Tracking & Analytics" onClick={() => setTrackingOpen(true)}>
          <BarChart3 className="h-4 w-4" />
        </IconBtn>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-8 items-center gap-1 rounded px-2 text-xs font-medium text-editor-fg-muted transition-colors hover:bg-editor-panel-2 hover:text-editor-fg"
              title="Exportar ficheiro"
            >
              <Download className="h-4 w-4" />
              <ChevronDown className="h-3 w-3 opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="z-[220] min-w-[12rem] border-editor-border bg-editor-panel text-editor-fg"
          >
            <DropdownMenuItem
              className="cursor-pointer text-sm focus:bg-editor-border focus:text-editor-fg"
              onClick={handleExportHtml}
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar HTML completo
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer text-sm focus:bg-editor-border focus:text-editor-fg"
              onClick={handleExportJson}
            >
              <FileJson className="mr-2 h-4 w-4" />
              Exportar JSON
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <IconBtn
          label="Limpar página"
          onClick={() => {
            if (confirm("Limpar toda a página?")) reset();
          }}
        >
          <Trash2 className="h-4 w-4" />
        </IconBtn>
        <button
          type="button"
          onClick={togglePreview}
          className={`flex h-8 items-center gap-1.5 rounded px-3 text-xs font-medium transition-colors ${
            preview
              ? "bg-editor-accent text-editor-accent-fg"
              : "bg-editor-panel-2 text-editor-fg hover:bg-editor-border"
          }`}
        >
          <Eye className="h-3.5 w-3.5" />
          {preview ? "Editar" : "Pré-visualizar"}
        </button>
        {presellEmbed ? (
          <button
            type="button"
            onClick={() => presellEmbed.onRequestSave()}
            disabled={presellEmbed.isSaving || presellEmbed.canSave === false}
            className="flex h-8 items-center gap-1.5 rounded bg-editor-accent px-3 text-xs font-medium text-editor-accent-fg hover:opacity-90 disabled:opacity-50"
          >
            <Globe className="h-3.5 w-3.5" />
            {presellEmbed.isSaving ? "A guardar…" : "Guardar na conta"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setPublishOpen(true)}
            className="flex h-8 items-center gap-1.5 rounded bg-editor-accent px-3 text-xs font-medium text-editor-accent-fg hover:opacity-90"
          >
            <Globe className="h-3.5 w-3.5" />
            Publicar
          </button>
        )}
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
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded text-editor-fg-muted transition-colors hover:bg-editor-panel-2 hover:text-editor-fg disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
