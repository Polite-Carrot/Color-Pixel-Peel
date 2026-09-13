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
  /** How many tiles of a color are reachable right now. */
  reachable(block: Block): number;
  /** False once the level is over. */
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
          const chip = document.createElement('span');
          chip.className = 'chip chip--slot';
          this.paint(chip, slot.block);
          const owed = document.createElement('span');
          owed.className = 'chip__owed';
          owed.textContent = String(slot.remaining);
          chip.append(owed);
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

        const reach = model.reachable(front);
        if (reach === 0) button.classList.add('is-stranded');

        button.setAttribute(
          'aria-label',
          `${swatch(front.color).name} ${front.count}` +
            (reach === 0
              ? ' — nothing showing, it will wait in the panel'
              : ` — ${reach} showing`) +
            `, ${column.length - 1} behind it`,
        );
        button.addEventListener('click', () => this.onPlay(i));
        col.append(button);
        return col;
      }),
    );
  }
}
