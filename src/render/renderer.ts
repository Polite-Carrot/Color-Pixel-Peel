import { type Board, coords, depthAt, idx, topColor } from '../core/board';
import { type ColorId, markInk, swatch } from '../core/palette';

export interface Layout {
  tile: number;
  gap: number;
  originX: number;
  originY: number;
  width: number;
  height: number;
}

export interface DrawOptions {
  /** Draw a letter on every color — Color Blind Assist. */
  assist: boolean;
  /** Cell currently under the player's finger. */
  pressed?: number | null;
}

interface PeelAnim {
  cells: readonly number[];
  color: ColorId;
  start: number;
}

const PEEL_MS = 280;
/** How many layers under the top get a visible offset edge. */
const DEPTH_HINT = 3;
/**
 * Upper bound on tile size in CSS px. Without it a small grid on a tablet
 * renders as a few enormous blocks; capping keeps the board looking like a
 * board and lets it sit centred in the space.
 */
const MAX_TILE = 96;

const INK = '#2b2142';
/** Ink at reduced strength, for the socket a cleared cell leaves behind. */
const INK_GHOST = 'rgba(43, 33, 66, .3)';
const GLASS = 'rgba(255, 255, 255, .38)';

function computeLayout(board: Board, width: number, height: number): Layout {
  // Must clear the hard shadow below each tile, or a shadow lands on the
  // tile beneath it.
  const gap = Math.max(6, Math.round(Math.min(width, height) * 0.016));
  // Leave room on the right and bottom for the stack offsets and the hard
  // shadow, which are drawn outside the tile's own box.
  const bleed = 8;
  const tile = Math.max(
    4,
    Math.min(
      MAX_TILE,
      Math.floor(
        Math.min(
          (width - bleed - gap * (board.cols - 1)) / board.cols,
          (height - bleed - gap * (board.rows - 1)) / board.rows,
        ),
      ),
    ),
  );
  const boardW = tile * board.cols + gap * (board.cols - 1);
  const boardH = tile * board.rows + gap * (board.rows - 1);
  return {
    tile,
    gap,
    originX: Math.round((width - boardW - bleed) / 2),
    originY: Math.round((height - boardH - bleed) / 2),
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

  /** Queues the lift-away animation for a peeled region. */
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

    // Reject a tap landing in the gap rather than snapping it to a
    // neighbour, so a misfire never peels the wrong region.
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

  private get stroke(): number {
    return Math.max(2, Math.min(3.5, this.layout.tile * 0.045));
  }

  /** Hard-shadow offset, the tile's equivalent of the CSS --lift. */
  private get lift(): number {
    return Math.max(3, Math.min(5, this.layout.tile * 0.06));
  }

  draw(options: DrawOptions): void {
    const { ctx } = this;
    const now = performance.now();

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.layout.width, this.layout.height);
    ctx.lineJoin = 'round';

    this.anims = this.anims.filter((a) => now - a.start < PEEL_MS);

    // Cells being uncovered right now rise into place.
    const revealing = new Map<number, number>();
    for (const anim of this.anims) {
      const t = Math.min(1, (now - anim.start) / PEEL_MS);
      for (const cell of anim.cells) revealing.set(cell, t);
    }

    for (let i = 0; i < this.board.cells.length; i++) {
      this.drawCell(i, options, revealing.get(i));
    }

    for (const anim of this.anims) {
      this.drawLiftedLayer(anim, now, options);
    }
  }

  private drawCell(i: number, options: DrawOptions, revealT: number | undefined): void {
    const { ctx } = this;
    const { x, y, size } = this.cellRect(i);
    const radius = size * 0.24;
    const stroke = this.stroke;
    const color = topColor(this.board, i);

    if (color === null) {
      // A cleared cell leaves a cool empty socket, the way an emptied jar
      // reads as glass rather than as nothing.
      ctx.fillStyle = GLASS;
      roundRect(ctx, x, y, size, size, radius);
      ctx.fill();
      ctx.lineWidth = stroke * 0.7;
      ctx.strokeStyle = INK_GHOST;
      ctx.stroke();
      return;
    }

    const depth = depthAt(this.board, i);
    const stack = this.board.cells[i] as readonly ColorId[];

    // Pressed tiles sink into the page and lose their shadow — the same
    // gesture the buttons make.
    const lift = this.lift;
    const sunk = options.pressed === i;
    const rise = revealT === undefined ? 0 : (1 - easeOut(revealT)) * size * 0.14;
    const ty = y - rise + (sunk ? lift : 0);

    if (!sunk) {
      // One hard, unblurred shadow straight down, like every raised thing
      // in the house style.
      ctx.fillStyle = INK;
      roundRect(ctx, x, ty + lift, size, size, radius);
      ctx.fill();
    }

    // Depth is drawn as bands inside the tile rather than as tiles peeking
    // out behind it: the layers underneath read the way a jar's bands do,
    // and nothing bleeds into the neighbouring cell.
    const hints = Math.min(DEPTH_HINT, depth - 1);
    const bandH = hints > 0 ? Math.max(5, Math.min(14, size * 0.13)) : 0;
    const topArea = size - hints * bandH;

    ctx.save();
    roundRect(ctx, x, ty, size, size, radius);
    ctx.clip();

    ctx.fillStyle = swatch(color).hex;
    ctx.fillRect(x, ty, size, size);

    for (let k = hints; k >= 1; k--) {
      const beneath = stack[depth - 1 - k];
      if (beneath === undefined) continue;
      const bandTop = ty + size - (hints - k + 1) * bandH;
      ctx.fillStyle = swatch(beneath).hex;
      ctx.fillRect(x, bandTop, size, bandH);
      // A hairline of ink between bands, so two similar colors still part.
      ctx.fillStyle = INK;
      ctx.fillRect(x, bandTop, size, Math.max(1, stroke * 0.5));
    }

    // A soft highlight across the top color only, for a little roundness
    // without blurring the cartoon weight.
    ctx.fillStyle = 'rgba(255, 255, 255, .26)';
    ctx.fillRect(x + stroke, ty + stroke, size - stroke * 2, Math.max(2, topArea * 0.26));

    ctx.restore();

    ctx.lineWidth = stroke;
    ctx.strokeStyle = INK;
    roundRect(ctx, x, ty, size, size, radius);
    ctx.stroke();

    if (options.assist) {
      // Centred in the top colour's own area, clear of the depth bands.
      this.drawMark(color, x + size / 2, ty + topArea / 2, Math.min(size, topArea * 1.6));
    }
  }

  private drawMark(color: ColorId, cx: number, cy: number, size: number): void {
    const { ctx } = this;
    ctx.fillStyle = markInk(color);
    ctx.font = `800 ${Math.round(size * 0.44)}px "Baloo 2", ui-rounded, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(swatch(color).mark, cx, cy + size * 0.03);
  }

  /** The layer that just came off, lifting and tilting away. */
  private drawLiftedLayer(anim: PeelAnim, now: number, options: DrawOptions): void {
    const { ctx } = this;
    const t = Math.min(1, (now - anim.start) / PEEL_MS);
    const eased = easeOut(t);
    const hex = swatch(anim.color).hex;
    const stroke = this.stroke;

    ctx.save();
    ctx.globalAlpha = 1 - eased * eased;

    for (const cell of anim.cells) {
      const { x, y, size } = this.cellRect(cell);
      const radius = size * 0.24;
      const lift = size * 0.34 * eased;
      const grow = 1 + 0.16 * eased;

      // Tilt as it lifts — the same gesture a picked-up jar makes.
      ctx.save();
      ctx.translate(x + size / 2, y + size / 2 - lift);
      ctx.rotate(-0.14 * eased);
      ctx.scale(grow, grow);

      ctx.fillStyle = hex;
      roundRect(ctx, -size / 2, -size / 2, size, size, radius);
      ctx.fill();
      ctx.lineWidth = stroke;
      ctx.strokeStyle = INK;
      ctx.stroke();

      if (options.assist) this.drawMark(anim.color, 0, 0, size);

      ctx.restore();
    }

    ctx.restore();
  }
}
