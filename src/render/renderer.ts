import { type Board, coords, idx, tileAt } from '../core/board';
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
  /** Dim everything but this color, so the player can pick it out. */
  highlight?: ColorId | null;
}

interface TakeAnim {
  cells: readonly number[];
  color: ColorId;
  start: number;
}

const TAKE_MS = 300;
const MAX_TILE = 64;

const INK = '#2b2142';
/**
 * The card the picture is mounted on. Cool grey rather than paper white
 * on purpose: `white` is a playable color, and on a white card the dog's
 * muzzle was invisible — the tiles and the mount were the same value.
 */
const CARD = '#e7edf5';
const CARD_EDGE = 'rgba(43, 33, 66, .16)';
/** Where a tile has been taken away, the card shows through, a shade
 *  darker so progress is visible against the mount. */
const EMPTY = 'rgba(43, 33, 66, .07)';

function computeLayout(board: Board, width: number, height: number): Layout {
  const gap = Math.max(2, Math.round(Math.min(width, height) * 0.008));
  // Room on the right and bottom for the hard shadow under a raised tile.
  const bleed = 6;
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
  private anims: TakeAnim[] = [];
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

  get busy(): boolean {
    return this.anims.length > 0;
  }

  setBoard(board: Board): void {
    this.board = board;
  }

  resize(cssWidth: number, cssHeight: number): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
    this.canvas.width = Math.max(1, Math.round(cssWidth * this.dpr));
    this.canvas.height = Math.max(1, Math.round(cssHeight * this.dpr));
    this.layout = computeLayout(this.board, cssWidth, cssHeight);
  }

  /** Queues the pop-away animation for tiles just taken. */
  addTake(cells: readonly number[], color: ColorId): void {
    if (cells.length === 0) return;
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
    return Math.max(1.5, Math.min(3, this.layout.tile * 0.055));
  }

  draw(options: DrawOptions): void {
    const { ctx } = this;
    const now = performance.now();

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.layout.width, this.layout.height);
    ctx.lineJoin = 'round';

    this.anims = this.anims.filter((a) => now - a.start < TAKE_MS);

    this.drawCard();
    for (let i = 0; i < this.board.tiles.length; i++) this.drawTile(i, options);

    for (const anim of this.anims) this.drawTakenTiles(anim, now);
  }

  /**
   * The picture is mounted on a card, the way the artwork in the
   * reference sits in a white frame. It also gives a cleared tile
   * somewhere to show through to, so taking one reads as an absence
   * rather than as a hole in the page.
   */
  private drawCard(): void {
    const { ctx } = this;
    const { tile, gap, originX, originY } = this.layout;
    const pad = Math.max(8, tile * 0.5);
    const w = tile * this.board.cols + gap * (this.board.cols - 1);
    const h = tile * this.board.rows + gap * (this.board.rows - 1);

    ctx.fillStyle = CARD;
    roundRect(ctx, originX - pad, originY - pad, w + pad * 2, h + pad * 2, pad * 0.8);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = CARD_EDGE;
    ctx.stroke();
  }

  private drawTile(i: number, options: DrawOptions): void {
    const { ctx } = this;
    const { x, y, size } = this.cellRect(i);
    const radius = size * 0.18;
    const color = tileAt(this.board, i);

    if (color === null) {
      // A faint print of where the tile was, so progress is visible.
      ctx.fillStyle = EMPTY;
      roundRect(ctx, x, y, size, size, radius);
      ctx.fill();
      return;
    }

    /* Flat fills, no outline and no shadow. An earlier version raised
       every reachable tile with an ink outline, which worked on a board
       of five big blocks and destroyed the artwork here — a picture this
       size stops reading as a picture the moment each tile is drawn as a
       separate object. Reachability is told through the tray instead,
       where a block whose color has nothing showing is dimmed. */
    const dimmed = options.highlight != null && options.highlight !== color;

    ctx.save();
    if (dimmed) ctx.globalAlpha = 0.22;

    ctx.fillStyle = swatch(color).hex;
    roundRect(ctx, x, y, size, size, radius);
    ctx.fill();

    if (options.assist && size >= 14) {
      ctx.fillStyle = markInk(color);
      ctx.font = `800 ${Math.round(size * 0.62)}px "Baloo 2", ui-rounded, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(swatch(color).mark, x + size / 2, y + size / 2 + size * 0.04);
    }

    ctx.restore();
  }

  /** Tiles a block just took, popping away. */
  private drawTakenTiles(anim: TakeAnim, now: number): void {
    const { ctx } = this;
    const t = Math.min(1, (now - anim.start) / TAKE_MS);
    const eased = easeOut(t);
    const hex = swatch(anim.color).hex;

    ctx.save();
    ctx.globalAlpha = 1 - eased;

    for (const cell of anim.cells) {
      const { x, y, size } = this.cellRect(cell);
      const grow = 1 + 0.5 * eased;
      const w = size * grow;
      const inset = (size - w) / 2;

      ctx.fillStyle = hex;
      roundRect(ctx, x + inset, y + inset - size * 0.3 * eased, w, w, size * 0.22 * grow);
      ctx.fill();
      ctx.lineWidth = this.stroke;
      ctx.strokeStyle = INK;
      ctx.stroke();
    }

    ctx.restore();
  }
}
