import { type Board, coords, idx, tileAt } from '../core/board';
import { type ColorId, markInk, swatch } from '../core/palette';

export interface Layout {
  tile: number;
  gap: number;
  /** Border reserved around the grid for the card it is mounted on. */
  pad: number;
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
  cell: number;
  color: ColorId;
  start: number;
}

/**
 * How long one tile's flight lasts. Shorter than the game's interval
 * between tiles, so each is clear of the next.
 *
 * The pacing itself is not here any more. Tiles are taken one at a time
 * by the rules, and this only draws the one that just went — so several
 * blocks draining at once each get their own flights without the
 * renderer having to know they exist.
 */
const TAKE_MS = 380;
const MAX_TILE = 64;

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
  const gap = Math.max(1, Math.round(Math.min(width, height) * 0.006));

  /* The card's border is reserved BEFORE the tiles are sized. Sizing
     tiles to the full box and then drawing a mount around them put the
     mount outside the canvas, where it was clipped. Taken as a share of
     the box rather than of the tile so there is no circularity. */
  const pad = Math.max(6, Math.round(Math.min(width, height) * 0.028));

  const usableW = width - pad * 2;
  const usableH = height - pad * 2;

  /* No floor beyond a readable minimum: a bigger picture makes smaller
     tiles rather than overflowing the card. */
  const tile = Math.max(
    3,
    Math.min(
      MAX_TILE,
      Math.floor(
        Math.min(
          (usableW - gap * (board.cols - 1)) / board.cols,
          (usableH - gap * (board.rows - 1)) / board.rows,
        ),
      ),
    ),
  );

  const boardW = tile * board.cols + gap * (board.cols - 1);
  const boardH = tile * board.rows + gap * (board.rows - 1);

  return {
    tile,
    gap,
    pad,
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

  /** Draws one tile flying off, from the moment it was taken. */
  addTake(cell: number, color: ColorId): void {
    this.anims.push({ cell, color, start: performance.now() });
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

  draw(options: DrawOptions): void {
    const { ctx } = this;
    const now = performance.now();

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.layout.width, this.layout.height);
    ctx.lineJoin = 'round';

    this.anims = this.anims.filter((a) => now - a.start < TAKE_MS);

    this.drawCard();
    for (let i = 0; i < this.board.tiles.length; i++) this.drawTile(i, options);

    for (const anim of this.anims) this.drawTakenTile(anim, now);
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
    const pad = this.layout.pad;
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

  /**
   * A tile that has just been taken, flying toward the panel as it
   * shrinks and turns. One per tile, started when the rules actually
   * removed it, so what is on screen and what the counters say cannot
   * drift apart.
   */
  private drawTakenTile(anim: TakeAnim, now: number): void {
    const { ctx } = this;
    const t = easeOut(Math.min(1, (now - anim.start) / TAKE_MS));
    const { x, y, size } = this.cellRect(anim.cell);

    // Toward the panel, which sits below the picture.
    const toX = this.layout.width / 2;
    const toY = this.layout.height + this.layout.tile * 2;

    const cx = x + size / 2 + (toX - (x + size / 2)) * t * 0.55;
    const cy = y + size / 2 + (toY - (y + size / 2)) * t * 0.55;
    const scale = 1 - 0.55 * t;

    ctx.save();
    ctx.globalAlpha = 1 - t;
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.5);
    ctx.fillStyle = swatch(anim.color).hex;
    roundRect(ctx, (-size * scale) / 2, (-size * scale) / 2, size * scale, size * scale, size * 0.18 * scale);
    ctx.fill();
    ctx.restore();
  }
}
