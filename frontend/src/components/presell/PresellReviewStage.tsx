import { useEffect, useRef, useState } from "react";
import { Check, Copy, Megaphone, Monitor, Pencil, Smartphone, Tablet, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { presellService } from "@/services/presellService";
import { parsePresellBuilderPageDocument } from "@/lib/presellBuilderContent";
import { buildEditablePageDocument } from "@/lib/presellVisualEdit";
import { exportPageToHtml } from "@/page-builder/export-html";
import "@/page-builder/page-builder-theme.css";
import {
  applyEditorChromeTheme,
  clearEditorChromeThemeAttr,
  readStoredEditorChromeTheme,
} from "@/page-builder/editorChromeTheme";

type Device = "desktop" | "tablet" | "mobile";

const FRAME: Record<Device, { w: number; h: number; label: string }> = {
  desktop: { w: 1280, h: 800, label: "Computador" },
  tablet: { w: 834, h: 1112, label: "Tablet" },
  mobile: { w: 390, h: 844, label: "Telemóvel" },
};

const DEVICES: Array<{ id: Device; Icon: typeof Monitor }> = [
  { id: "desktop", Icon: Monitor },
  { id: "tablet", Icon: Tablet },
  { id: "mobile", Icon: Smartphone },
];

type Props = {
  pageId: string;
  pageIdB?: string | null;
  variant: "a" | "b";
  onVariant: (v: "a" | "b") => void;
  published: boolean;
  adUrl?: string | null;
  copied: boolean;
  onCopy: () => void;
  onEdit: () => void;
  onAdvertise?: () => void;
  onClose: () => void;
};

/**
 * Revisão em ecrã inteiro: a página pública dentro de um viewport real
 * (1280 / 834 / 390), à escala do espaço disponível.
 */
export function PresellReviewStage({
  pageId,
  pageIdB,
  variant,
  onVariant,
  published,
  adUrl,
  copied,
  onCopy,
  onEdit,
  onAdvertise,
  onClose,
}: Props) {
  const [device, setDevice] = useState<Device>("desktop");
  const [draftSrc, setDraftSrc] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const activeId = variant === "b" && pageIdB ? pageIdB : pageId;
  const frame = FRAME[device];

  useEffect(() => {
    if (published) {
      setDraftSrc(null);
      return;
    }
    let cancelled = false;
    let objectUrl = "";
    void presellService.getById(activeId).then(({ data }) => {
      if (cancelled || !data) return;
      const stored = parsePresellBuilderPageDocument(data.content);
      const doc =
        stored ??
        buildEditablePageDocument({
          title: data.title,
          type: data.type,
          videoUrl: data.video_url,
          content: data.content || {},
        });
      const html = exportPageToHtml(doc, data.language);
      objectUrl = URL.createObjectURL(new Blob([html], { type: "text/html" }));
      setDraftSrc(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [published, activeId]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const measure = () => {
      const pad = 40;
      const w = el.clientWidth - pad;
      const h = el.clientHeight - pad;
      const next = Math.min(1, w / frame.w, h / frame.h);
      setScale(next > 0.2 ? next : 0.2);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [frame.w, frame.h]);

  const previewPath = published ? `/p/${activeId}` : draftSrc || "";
  const showFrame = published || Boolean(draftSrc);
  const editorTheme = readStoredEditorChromeTheme();

  useEffect(() => {
    applyEditorChromeTheme(editorTheme);
    return () => clearEditorChromeThemeAttr();
  }, [editorTheme]);

  return (
    <div
      className="page-builder-scope fixed inset-0 z-[200] flex flex-col bg-editor-bg text-editor-fg"
      data-editor-theme={editorTheme}
    >
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-editor-border bg-editor-panel px-2">
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 items-center gap-1 rounded-md px-2 text-xs text-editor-fg-muted hover:bg-editor-panel-2 hover:text-editor-fg"
        >
          <X className="h-3.5 w-3.5" />
          Fechar
        </button>
        <p className="hidden text-sm font-medium sm:block">Rever página</p>
        {pageIdB ? (
          <div className="ml-1 flex rounded-md border border-editor-border p-0.5">
            {(["a", "b"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onVariant(id)}
                className={cn(
                  "h-7 rounded px-2.5 text-xs font-medium",
                  variant === id ? "bg-editor-accent text-editor-accent-fg" : "text-editor-fg-muted",
                )}
              >
                {id === "a" ? "Versão A" : "Versão B"}
              </button>
            ))}
          </div>
        ) : null}
        <div className="mx-auto flex items-center gap-0.5 rounded-md border border-editor-border bg-editor-bg p-0.5">
          {DEVICES.map(({ id, Icon }) => (
            <button
              key={id}
              type="button"
              aria-label={FRAME[id].label}
              title={FRAME[id].label}
              onClick={() => setDevice(id)}
              className={cn(
                "flex h-7 w-9 items-center justify-center rounded",
                device === id ? "bg-editor-accent text-editor-accent-fg" : "text-editor-fg-muted hover:text-editor-fg",
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
        <span
          className={cn(
            "hidden rounded-full px-2 py-0.5 text-[11px] font-medium md:inline",
            published ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-200",
          )}
        >
          {published ? "Publicada" : "Rascunho"}
        </span>
        <button
          type="button"
          onClick={onCopy}
          disabled={!published || !adUrl}
          title={adUrl || undefined}
          className="flex h-8 max-w-[min(100%,14rem)] items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-40"
        >
          {copied ? <Check className="h-3.5 w-3.5 shrink-0" /> : <Copy className="h-3.5 w-3.5 shrink-0" />}
          <span className="truncate">{copied ? "URL copiada" : "Copiar URL para o Ads"}</span>
        </button>
        {onAdvertise ? (
          <button
            type="button"
            onClick={onAdvertise}
            className="flex h-8 items-center gap-1.5 rounded-md border border-editor-border px-2.5 text-xs font-medium text-editor-fg hover:bg-editor-panel-2"
          >
            <Megaphone className="h-3.5 w-3.5" />
            Anunciar no Google Ads
          </button>
        ) : null}
        <button
          type="button"
          onClick={onEdit}
          className="flex h-8 items-center gap-1.5 rounded-md bg-editor-accent px-3 text-xs font-semibold text-editor-accent-fg"
        >
          <Pencil className="h-3.5 w-3.5" />
          Editar
        </button>
      </header>

      {adUrl ? (
        <div className="flex shrink-0 flex-col gap-2 border-b border-editor-border bg-editor-panel px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-editor-fg-muted">
              URL final (presell + rastreamento)
            </p>
            <p className="mt-0.5 truncate font-mono text-[11px] text-editor-fg" title={adUrl}>
              {adUrl}
            </p>
          </div>
          <button
            type="button"
            onClick={onCopy}
            disabled={!published}
            className="flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copiada" : "Copiar URL completa"}
          </button>
        </div>
      ) : null}

      <div ref={canvasRef} className="relative min-h-0 flex-1 overflow-hidden bg-editor-canvas">
        {showFrame && previewPath ? (
          <div className="flex h-full items-center justify-center">
            <div style={{ width: Math.round(frame.w * scale), height: Math.round(frame.h * scale) }}>
              <div
                className={cn(
                  "origin-top-left overflow-hidden bg-white shadow-2xl",
                  device === "mobile" ? "rounded-[2rem] border-[10px] border-zinc-900" : "rounded-xl border border-black/10",
                )}
                style={{
                  width: frame.w,
                  height: frame.h,
                  transform: `scale(${scale})`,
                }}
              >
                {device !== "mobile" ? (
                  <div className="flex h-9 items-center gap-1.5 border-b border-zinc-200 bg-zinc-100 px-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
                    <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
                    <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
                    <div className="ml-2 min-w-0 flex-1 truncate rounded-md bg-white px-2 py-0.5 text-[11px] text-zinc-500">
                      {published ? adUrl || `/p/${activeId}` : "Rascunho — ainda não está no ar"}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-6 items-end justify-center bg-white">
                    <span className="h-1 w-16 rounded-full bg-zinc-200" />
                  </div>
                )}
                <iframe
                  title={variant === "b" ? "Pré-visualização da versão B" : "Pré-visualização da presell"}
                  src={previewPath}
                  className="w-full border-0 bg-white"
                  style={{ height: frame.h - (device === "mobile" ? 24 : 36) }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center px-6">
            <p className="max-w-md text-center text-sm leading-relaxed text-zinc-600">A preparar a página…</p>
          </div>
        )}
      </div>
    </div>
  );
}
