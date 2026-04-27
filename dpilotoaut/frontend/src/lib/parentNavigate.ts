/** Pedido ao parent Clickora para mudar de rota (só dentro de iframe com `clickora_parent` definido). */
export function navigateClickoraParent(path: string): void {
  if (typeof window === "undefined" || window.parent === window) return;
  if (!path.startsWith("/")) return;
  const parentOrigin = new URLSearchParams(window.location.search).get("clickora_parent");
  if (!parentOrigin) return;
  window.parent.postMessage({ type: "clickora:navigate", path }, parentOrigin);
}
