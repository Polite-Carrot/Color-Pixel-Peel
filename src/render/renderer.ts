import { type Board, coords, depthAt, idx, topColor } from '../core/board';
import { type ColorId, swatch } from '../core/palette';

export interface Layout {
  tile: number;
  gap: number;
  originX: number;
  originY: number;
  width: number;
  height: number;
}

export interface DrawOptions {
  /** Draw per-color glyphs for color-vision accessibility. */
  symbols: boolean;
  /** Cell currently under the player's finger, highlighted. */
  pressed?: number | null;
}

interface PeelAnim {
  cells: readonly number[];
  color: ColorId;
  start: number;
}

const PEEL_MS = 260;
/** How many layers under the top get a visible offset edge. */
const DEPTH_HINT = 3;
/**
 * Upper bound on tile size in CSS px. Without it a small grid on a
 * tablet renders as a few enormous blocks; capping keeps the board
 * looking like a board and lets it sit centred in the space.
 */
const MAX_TILE = 96;

function computeLayout(board: Board, width: number, height: number): Layout {
  const gap = Math.max(2, Math.round(Math.min(width, height) * 0.012));
  const tile = Math.max(
    4,
    Math.min(
      MAX_TILE,
      Math.floor(
        Math.min(
          (width - gap * (board.cols - 1)) / board.cols,
          (height - gap * (board.rows - 1)) / board.rows,
        ),
      ),
    ),
  );
  const boardW = tile * board.cols + gap * (board.cols - 1);
  const boardH = tile * board.rows + gap * (board.rows - 1);
  return {
    tile,
    gap,
    originX: Math.round((width - boardW) / 2),
    originY: Math.round((height - boardH) / 2),
    width,
    height,
  };
}

/** Rounded-rect path, hand-rolled because ctx.roundRect needs iOS 16+. */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private layout: Layout;
  private anims: PeelAnim[] = [];
  private dpr = 1;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private board: Board,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Renderer: 2d context unavailable');
    this.ctx = ctx;
    this.layout = computeLayout(board, 1, 1);
  }

  /** True while a peel animation is still playing. */
  get busy(): boolean {
    return this.anims.length > 0;
  }

  setBoard(board: Board): void {
    this.board = board;
  }

  /**
   * Matches the backing store to the CSS box and the device pixel ratio.
   * Call on mount, on resize and on orientation change.
   */
  resize(cssWidth: number, cssHeight: number): void {
    // Cap DPR at 3: beyond that the extra pixels cost fill rate without
    // being visible on a phone.
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
    this.canvas.width = Math.max(1, Math.round(cssWidth * this.dpr));
    this.canvas.height = Math.max(1, Math.round(cssHeight * this.dpr));
    this.layout = computeLayout(this.board, cssWidth, cssHeight);
  }

  /** Queues the fly-off animation for a peeled region. */
  addPeel(cells: readonly number[], color: ColorId): void {
    this.anims.push({ cells: cells.slice(), color, start: performance.now() });
  }

  clearAnims(): void {
    this.anims = [];
  }

  /** Maps CSS-pixel canvas coordinates to a cell index, or null. */
  hitTest(x: number, y: number): number | null {
    const { tile, gap, originX, originY } = this.layout;
    const step = tile + gap;
    const col = Math.floor((x - originX) / step);
    const row = Math.floor((y - originY) / step);
    if (col < 0 || row < 0 || col >= this.board.cols || row >= this.board.rows) return null;

    // Reject taps landing in the gap rather than snapping to a neighbour,
    // so a misfire never peels the wrong region.
    const localX = x - originX - col * step;
    const localY = y - originY - row * step;
    if (localX > tile || localY > tile) return null;

    return idx(this.board, col, row);
  }

  cellRect(i: number): { x: number; y: number; size: number } {
    const { tile, gap, originX, originY } = this.layout;
    const { x, y } = coords(this.board, i);
    return { x: originX + x * (tile + gap), y: originY + y * (tile + gap), size: tile };
  }

  draw(options: DrawOptions): void {
    const { ctx } = this;
    const now = performance.now();

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.layout.width, this.layout.height);

    this.anims = this.anims.filter((a) => now - a.start < PEEL_MS);

    // Cells being revealed right now scale up from the peel animation.
    const revealing = new Map<number, number>();
    for (const anim of this.anims) {
      const t = Math.min(1, (now - anim.start) / PEEL_MS);
      for (const cell of anim.cells) revealing.set(cell, t);
    }

    for (let i = 0; i < this.board.cells.length; i++) {
      this.drawCell(i, options, revealing.get(i));
    }

    for (const anim of this.anims) {
      this.drawPeelingLayer(anim, now);
    }
  }

  private drawCell(i: number, options: DrawOptions, revealT: number | undefined): void {
    const { ctx } = this;
    const { x, y, size } = this.cellRect(i);
    const radius = size * 0.22;
    const color = topColor(this.board, i);

    if (color === null) {
      // Hole: a recessed well, so cleared space reads as progress.
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      roundRect(ctx, x, y, size, size, radius);
      ctx.fill();
      return;
    }

    const depth = depthAt(this.board, i);
    const stack = this.board.cells[i] as readonly ColorId[];
    const offset = Math.max(2, size * 0.055);

    // Layers underneath peek out down-right, using their own colors, so
    // the player can read how deep a cell is and plan ahead.
    const hints = Math.min(DEPTH_HINT, depth - 1);
    for (let k = hints; k >= 1; k--) {
      const beneath = stack[depth - 1 - k];
      if (beneath === undefined) continue;
      ctx.fillStyle = swatch(beneath).shadeHex;
      roundRect(ctx, x + k * offset, y + k * offset, size, size, radius);
      ctx.fill();
    }

    let scale = 1;
    if (revealT !== undefined) scale = 0.82 + 0.18 * easeOut(revealT);
    if (options.pressed === i) scale *= 0.94;

    const inset = (size * (1 - scale)) / 2;
    const top = swatch(color);

    ctx.fillStyle = top.hex;
    roundRect(ctx, x + inset, y + inset, size * scale, size * scale, radius * scale);
    ctx.fill();

    // A top-edge highlight gives the tile a slight bevel.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    roundRect(ctx, x + inset, y + inset, size * scale, Math.max(1, size * scale * 0.16), radius * scale);
    ctx.fill();

    if (options.symbols) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.font = `700 ${Math.round(size * 0.42)}px -apple-system, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(top.symbol, x + size / 2, y + size / 2 + size * 0.02);
    }
  }

  /** The layer that just came off, flying outward and fading. */
  private drawPeelingLayer(anim: PeelAnim, now: number): void {
    const { ctx } = this;
    const t = Math.min(1, (now - anim.start) / PEEL_MS);
    const eased = easeOut(t);
    const color = swatch(anim.color);

    ctx.save();
    ctx.globalAlpha = 1 - eased;

    for (const cell of anim.cells) {
      const { x, y, size } = this.cellRect(cell);
      const grow = 1 + 0.4 * eased;
      const drift = size * 0.22 * eased;
      const w = size * grow;
      const inset = (size - w) / 2;

      ctx.fillStyle = color.hex;
      roundRect(ctx, x + inset, y + inset - drift, w, w, size * 0.22 * grow);
      ctx.fill();
    }

    ctx.restore();
  }
}
