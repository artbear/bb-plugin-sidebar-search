/** BB 0.47 sidebar DOM integration; no private BB imports or synthetic shortcuts. */
// The header test id changed in BB 0.47; its semantic attribute stayed stable.
const HEADER = '[data-testid="app-sidebar-top-reserve-row"] [data-sidebar-header-slot]';
const SEARCH = '[data-nav-rail-item="__bb__/search-threads"] button';
const MARKER = "data-sidebar-search-button";

export function mountHeaderSearch(doc: Document, signal: AbortSignal): () => void {
  const buttons = new Map<HTMLElement, HTMLButtonElement>();

  const reconcile = () => {
    if (signal.aborted) return;
    const source = doc.querySelector<HTMLButtonElement>(SEARCH);
    for (const [header, button] of buttons) {
      if (!header.isConnected || !source) {
        button.remove();
        buttons.delete(header);
      }
    }
    if (!source) return;

    for (const header of doc.querySelectorAll<HTMLElement>(HEADER)) {
      let button = buttons.get(header);
      if (!button) {
        button = doc.createElement("button");
        button.type = "button";
        button.className = "bb-sidebar-search-button";
        button.setAttribute(MARKER, "");
        button.setAttribute("aria-label", "Поиск тредов");
        const icon = source.querySelector("svg");
        if (icon) button.append(icon.cloneNode(true));
        button.addEventListener("click", () => {
          doc.querySelector<HTMLButtonElement>(SEARCH)?.click();
        }, { signal });
        buttons.set(header, button);
        header.append(button);
      }
      if (button.parentElement !== header) header.append(button);
      const title = source.getAttribute("aria-label") ?? "Поиск тредов";
      if (button.title !== title) button.title = title;
      if (button.disabled !== source.disabled) button.disabled = source.disabled;
      const shortcut = source.getAttribute("aria-keyshortcuts");
      if (button.getAttribute("aria-keyshortcuts") !== shortcut) {
        if (shortcut) button.setAttribute("aria-keyshortcuts", shortcut);
        else button.removeAttribute("aria-keyshortcuts");
      }
    }
  };

  const observer = new MutationObserver(reconcile);
  const dispose = () => {
    observer.disconnect();
    for (const button of buttons.values()) button.remove();
    buttons.clear();
    signal.removeEventListener("abort", dispose);
  };
  if (!signal.aborted) {
    observer.observe(doc.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled", "aria-label", "aria-keyshortcuts"],
    });
    signal.addEventListener("abort", dispose, { once: true });
    reconcile();
  }
  return dispose;
}
