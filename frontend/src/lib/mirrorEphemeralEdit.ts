/** Estilos injectados só em runtime no iframe de edição (não vão para a BD). */
export const MIRROR_EPHEMERAL_EDIT_STYLE = `
.editable-element { cursor: text; outline: 1px dashed rgba(59, 130, 246, 0.35); outline-offset: 2px; }
.editable-element:focus { outline-color: rgba(59, 130, 246, 0.85); }
`;

const TEXT_SELECTOR = "h1,h2,h3,h4,h5,h6,p,li,span";

const SKIP_ANCESTOR = "a,button,[role=button],input,select,textarea,label";

function isOfferControl(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === "button") return true;
  if (tag === "a") {
    const label = `${el.textContent || ""} ${el.className || ""}`.toLowerCase();
    return /buy now|order now|shop now|checkout|comprar|claim|get started|official/.test(label);
  }
  return false;
}

/** Modo edição visual efémero — só no dashboard; o backend remove marcas ao guardar. */
export function applyMirrorEphemeralEditMode(doc: Document): void {
  if (!doc.head.querySelector('style[data-clickora-mirror-edit="1"]')) {
    const style = doc.createElement("style");
    style.setAttribute("data-clickora-mirror-edit", "1");
    style.textContent = MIRROR_EPHEMERAL_EDIT_STYLE;
    doc.head.appendChild(style);
  }

  doc.querySelectorAll(TEXT_SELECTOR).forEach((el) => {
    if (el.nodeType !== 1) return;
    if (el.closest(SKIP_ANCESTOR)) return;
    if (isOfferControl(el)) return;
    if (el.querySelector("a,button")) return;
    (el as HTMLElement).setAttribute("contenteditable", "true");
    el.classList.add("editable-element");
  });
}
