export interface PointerHandlers {
  /** Finger went down on a cell (or on empty space: `null`). */
  onPress(cell: number | null): void;
  /** Finger lifted on the same cell it pressed. */
  onTap(cell: number): void;
  /** Gesture aborted — dragged too far, or cancelled by the system. */
  onCancel(): void;
}

/** A drag beyond this many CSS px is a scroll attempt, not a tap. */
const SLOP_PX = 14;

/**
 * Wires pointer events on the canvas to cell taps.
 *
 * Pointer Events cover touch, pen and mouse with one code path. A tap
 * only fires when press and release land on the same cell and the finger
 * stayed within the slop radius, so a clumsy swipe never peels something
 * the player did not aim at.
 *
 * Returns a teardown function.
 */
export function attachPointer(
  canvas: HTMLCanvasElement,
  resolveCell: (x: number, y: number) => number | null,
  handlers: PointerHandlers,
): () => void {
  let activeId: number | null = null;
  let startCell: number | null = null;
  let startX = 0;
  let startY = 0;

  const localCoords = (event: PointerEvent): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const reset = (): void => {
    activeId = null;
    startCell = null;
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (activeId !== null) return; // ignore extra fingers
    // Stops the synthetic mouse events and double-tap zoom that would
    // otherwise follow a touch.
    event.preventDefault();

    activeId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;

    const { x, y } = localCoords(event);
    startCell = resolveCell(x, y);
    handlers.onPress(startCell);

    // Keeps delivering events to the canvas even if the finger slides
    // outside it.
    if (canvas.setPointerCapture) {
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // Capture is best-effort; the pointerup path works without it.
      }
    }
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== activeId) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (dx * dx + dy * dy > SLOP_PX * SLOP_PX) {
      reset();
      handlers.onCancel();
    }
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== activeId) return;
    event.preventDefault();

    const { x, y } = localCoords(event);
    const endCell = resolveCell(x, y);
    const pressed = startCell;
    reset();
    handlers.onCancel();

    if (pressed !== null && endCell === pressed) handlers.onTap(pressed);
  };

  const onPointerCancel = (event: PointerEvent): void => {
    if (event.pointerId !== activeId) return;
    reset();
    handlers.onCancel();
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);

  return () => {
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerCancel);
  };
}
