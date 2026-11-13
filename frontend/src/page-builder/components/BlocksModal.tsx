import { useMemo, useState } from "react";
import { fill } from "@/i18n";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import {
  SECTION_BLOCKS,
  SECTION_BLOCK_CATEGORIES,
  buildSectionsFromRecipe,
  type SectionBlockDefinition,
} from "../section-blocks";
import { documentHasImportedFold } from "../pageIdentity";
import { useBuilder } from "../store";
import { TEMPLATES } from "../templates";
import { Blocks, LayoutTemplate, X } from "lucide-react";

export function BlocksModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useAppLocale();
  const [category, setCategory] = useState<SectionBlockDefinition["category"] | "all" | "recipe">(
    "all",
  );
  const [guardMessage, setGuardMessage] = useState<string | null>(null);
  const [replacePending, setReplacePending] = useState(false);
  const appendSections = useBuilder((s) => s.appendSections);
  const replaceSections = useBuilder((s) => s.replaceSections);
  const doc = useBuilder((s) => s.doc);
  const identity = useBuilder((s) => s.pageIdentity);
  const imported = documentHasImportedFold(doc);

  const items = useMemo(() => {
    if (category === "recipe" || category === "all") return SECTION_BLOCKS;
    return SECTION_BLOCKS.filter((b) => b.category === category);
  }, [category]);

  if (!open) return null;

  const insertBlock = (block: SectionBlockDefinition) => {
    appendSections(block.build(identity));
  };

  const applyRecipe = () => {
    const sections = buildSectionsFromRecipe(undefined, identity);
    if (doc.sections.length === 0) replaceSections(sections);
    else appendSections(sections);
    onClose();
  };

  const commitFullTemplate = () => {
    const tpl = TEMPLATES.find((x) => x.id === "presell-dtc-vision");
    if (!tpl) return;
    replaceSections(tpl.build());
    setReplacePending(false);
    setGuardMessage(null);
    onClose();
  };

  const applyFullTemplate = () => {
    const tpl = TEMPLATES.find((x) => x.id === "presell-dtc-vision");
    if (!tpl) return;
    if (imported) {
      setGuardMessage(t("pages.pageBuilder.blocks.importedAlert"));
      return;
    }
    const product = (identity.productName || "").toLowerCase();
    if (product && !product.includes("visivra") && doc.sections.length > 0) {
      setGuardMessage(
        fill(t("pages.pageBuilder.blocks.visivraMismatch"), { product: identity.productName }),
      );
      return;
    }
    if (doc.sections.length > 0) {
      setReplacePending(true);
      return;
    }
    commitFullTemplate();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-editor-border bg-editor-panel text-editor-fg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-editor-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Blocks className="h-5 w-5 text-editor-accent" />
            <div>
              <h2 className="text-base font-semibold">{t("pages.pageBuilder.blocks.title")}</h2>
              <p className="text-[11px] text-editor-fg-muted">
                {t("pages.pageBuilder.blocks.subtitle")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-editor-fg-muted hover:bg-editor-panel-2 hover:text-editor-fg"
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {guardMessage ? (
          <div
            role="status"
            className="mx-4 mt-3 rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-[12px] leading-relaxed text-editor-fg"
          >
            <div className="flex items-start justify-between gap-3">
              <p>{guardMessage}</p>
              <button
                type="button"
                onClick={() => setGuardMessage(null)}
                className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium text-editor-fg-muted hover:bg-editor-panel-2 hover:text-editor-fg"
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1">
          <aside className="w-44 shrink-0 overflow-y-auto border-r border-editor-border p-3">
            <button
              type="button"
              onClick={() => setCategory("all")}
              className={`mb-1 w-full rounded-md px-2 py-1.5 text-left text-xs font-medium ${
                category === "all" ? "bg-editor-accent text-editor-accent-fg" : "hover:bg-editor-panel-2"
              }`}
            >
              {t("pages.pageBuilder.all")}
            </button>
            <button
              type="button"
              onClick={() => setCategory("recipe")}
              className={`mb-2 w-full rounded-md px-2 py-1.5 text-left text-xs font-medium ${
                category === "recipe" ? "bg-editor-accent text-editor-accent-fg" : "hover:bg-editor-panel-2"
              }`}
            >
              {t("pages.pageBuilder.blocks.recipe")}
            </button>
            {SECTION_BLOCK_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`mb-1 w-full rounded-md px-2 py-1.5 text-left text-xs font-medium ${
                  category === cat.id
                    ? "bg-editor-accent text-editor-accent-fg"
                    : "hover:bg-editor-panel-2"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </aside>

          <div className="editor-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
            {category === "recipe" ? (
              <div className="mb-4 space-y-3 rounded-lg border border-editor-border bg-editor-panel-2/40 p-4">
                <h3 className="text-sm font-semibold">{t("pages.pageBuilder.blocks.recipeTitle")}</h3>
                <p className="text-[12px] text-editor-fg-muted">
                  {t("pages.pageBuilder.blocks.recipeBody")}
                  {identity.productName
                    ? fill(t("pages.pageBuilder.blocks.recipeProduct"), { name: identity.productName })
                    : ""}
                  {t("pages.pageBuilder.blocks.recipeEnd")}
                </p>
                <ol className="list-decimal space-y-1 pl-4 text-[12px] text-editor-fg-muted">
                  <li>{t("pages.pageBuilder.blocks.step1")}</li>
                  <li>{t("pages.pageBuilder.blocks.step2")}</li>
                  <li>{t("pages.pageBuilder.blocks.step3")}</li>
                  <li>{t("pages.pageBuilder.blocks.step4")}</li>
                  <li>{t("pages.pageBuilder.blocks.step5")}</li>
                  <li>{t("pages.pageBuilder.blocks.step6")}</li>
                </ol>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={applyRecipe}
                    className="rounded-md bg-editor-accent px-3 py-2 text-xs font-semibold text-editor-accent-fg"
                  >
                    {t("pages.pageBuilder.blocks.insertOrder")}
                  </button>
                  <button
                    type="button"
                    onClick={applyFullTemplate}
                    className="inline-flex items-center gap-1.5 rounded-md border border-editor-border px-3 py-2 text-xs font-medium hover:bg-editor-panel-2"
                  >
                    <LayoutTemplate className="h-3.5 w-3.5" />
                    {t("pages.pageBuilder.blocks.fullTemplate")}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {items.map((block) => (
                <button
                  key={block.id}
                  type="button"
                  onClick={() => insertBlock(block)}
                  className="rounded-lg border border-editor-border bg-editor-panel-2/30 p-4 text-left transition-colors hover:border-editor-accent hover:bg-editor-bg"
                >
                  <p className="text-sm font-semibold">{block.name}</p>
                  <p className="mt-1 text-[11px] leading-snug text-editor-fg-muted">{block.description}</p>
                  <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-editor-accent">
                    {t("pages.pageBuilder.blocks.insertBlock")}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {replacePending ? (
        <div
          className="fixed inset-0 z-[260] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setReplacePending(false)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-editor-border bg-editor-panel p-5 text-editor-fg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-base font-semibold">{t("pages.pageBuilder.blocks.replaceTitle")}</h3>
            <p className="mb-5 text-sm text-editor-fg-muted">
              {t("pages.pageBuilder.blocks.replaceConfirm")}
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={commitFullTemplate}
                className="rounded border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/20"
              >
                {t("pages.pageBuilder.templates.replaceAll")}
              </button>
              <button
                type="button"
                onClick={() => setReplacePending(false)}
                className="rounded px-4 py-2 text-sm text-editor-fg-muted hover:text-editor-fg"
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
