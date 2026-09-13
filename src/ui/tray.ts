import type { Block } from '../core/blocks';
import type { Slot } from '../core/game';
import { solidInk, swatch } from '../core/palette';

function required<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`tray: missing #${id}`);
  return el as T;
}

export interface TrayModel {
  columns: readonly (readonly Block[])[];
  slots: readonly Slot[];
  /** False once the level is over, or while a play is still animating. */
  playable: boolean;
}

/** How many blocks behind the front one are drawn. */
const PEEK = 3;

/**
 * The hand and the panel it is played into.
 *
 * The hand is columns, and only the front block of each can be played —
 * so the ones behind are drawn smaller above it. Seeing what is coming is
 * the whole of the planning: a block you cannot reach yet is exactly the
 * thing you need to make room for.
 *
 * Plain DOM rather than canvas: these are buttons and should behave like
 * the game's other buttons — focusable, house-styled, sized by the same
 * tokens.
 */
export class Tray {
  private readonly panel = required('panel');
  private readonly tray = required('tray');

  constructor(private readonly onPlay: (column: number) => void) {}

  private paint(el: HTMLElement, block: Block): void {
    el.style.background = swatch(block.color).hex;
    el.style.color = solidInk(block.color);
    el.textContent = String(block.count);
  }

  /**
   * Just one slot's number. Blocks tick down twice a second, and
   * rebuilding the whole hand for each tick would throw away focus and
   * cost a DOM rebuild for nothing.
   */
  setSlotCount(slot: number, n: number): void {
    const chip = this.panel.children[slot]?.querySelector('.chip--slot');
    if (chip) chip.textContent = String(n);
  }

  render(model: TrayModel): void {
    this.panel.replaceChildren(
      ...model.slots.map((slot, i) => {
        const cell = document.createElement('div');
        cell.className = slot.block ? 'slot is-filled' : 'slot';
        cell.setAttribute(
          'aria-label',
          slot.block
            ? `Slot ${i + 1}: ${swatch(slot.block.color).name}, ${slot.remaining} still to take`
            : `Slot ${i + 1}, empty`,
        );

        if (slot.block) {
          /* The number ON the block is what is left to take, so the block
             itself is the countdown. It used to show the block's original
             value with a small badge counting down beside it, which put
             the number that mattered in the smaller of the two. */
          const chip = document.createElement('span');
          chip.className = 'chip chip--slot';
          chip.style.background = swatch(slot.block.color).hex;
          chip.style.color = solidInk(slot.block.color);
          chip.textContent = String(slot.remaining);
          cell.append(chip);
        }
        return cell;
      }),
    );

    this.tray.replaceChildren(
      ...model.columns.map((column, i) => {
        const col = document.createElement('div');
        col.className = 'column';

        // What is waiting behind, furthest back first and smallest.
        const queue = document.createElement('div');
        queue.className = 'column__queue';
        const behind = column.slice(1, 1 + PEEK).reverse();
        for (const b of behind) {
          const peek = document.createElement('span');
          peek.className = 'chip chip--peek';
          this.paint(peek, b);
          queue.append(peek);
        }
        col.append(queue);

        const hidden = Math.max(0, column.length - 1 - PEEK);
        if (hidden > 0) {
          const more = document.createElement('span');
          more.className = 'column__more';
          more.textContent = `+${hidden}`;
          more.setAttribute('aria-label', `${hidden} more behind`);
          queue.prepend(more);
        }

        const front = column[0];
        if (!front) {
          const spent = document.createElement('span');
          spent.className = 'chip chip--spent';
          spent.setAttribute('aria-label', `Column ${i + 1} is empty`);
          col.append(spent);
          return col;
        }

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'chip chip--front';
        this.paint(button, front);
        button.disabled = !model.playable;

        /* Deliberately says nothing about whether this block has anything
           to take. Working that out from the picture is the game; marking
           the answer on the button would play it for them. The label is
           silent about it too, so a screen reader is not told what a
           sighted player has to judge. */
        button.setAttribute(
          'aria-label',
          `${swatch(front.color).name} ${front.count}, ${column.length - 1} behind it`,
        );
        button.addEventListener('click', () => this.onPlay(i));
        col.append(button);
        return col;
      }),
    );
  }
}
