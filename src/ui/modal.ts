/**
 * Dialog plumbing shared by every overlay.
 *
 * `open` exists because of a real interaction between two reasonable
 * things: a dialog focuses a control when it opens, and the panel scrolls
 * when its copy is taller than the phone. Focusing a control inside a
 * scrolling panel makes the browser scroll that control into view — and if
 * the focused control is near the bottom, the dialog opens partway down
 * itself, past its own title. So the panel is put back to the top and the
 * focus is taken without scrolling. Every dialog goes through here, so one
 * that grows long later cannot quietly reintroduce it.
 */
export function open(overlay: HTMLElement, focusTarget?: HTMLElement | null): void {
  overlay.hidden = false;
  const panel = overlay.querySelector('.modal');
  if (panel) panel.scrollTop = 0;
  focusTarget?.focus({ preventScroll: true });
}

export function close(overlay: HTMLElement): void {
  overlay.hidden = true;
}

export function isOpen(overlay: HTMLElement): boolean {
  return !overlay.hidden;
}

/**
 * Dismisses the top-most open dialog on Escape. `handlers` is consulted in
 * order, so the list doubles as the stacking order.
 */
export function onEscape(handlers: readonly { overlay: HTMLElement; dismiss(): void }[]): void {
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    for (const handler of handlers) {
      if (isOpen(handler.overlay)) {
        event.preventDefault();
        handler.dismiss();
        return;
      }
    }
  });
}
