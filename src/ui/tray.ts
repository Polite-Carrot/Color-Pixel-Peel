import type { Block } from '../core/blocks';
import type { Slot } from '../core/game';
import { solidInk, swatch } from '../core/palette';

function required<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`tray: missing #${id}`);
  return el as T;
}

export interface TrayModel {
  tray: readonly Block[];
  slots: readonly Slot[];
  /** How many tiles of a color are reachable right now. */
  reachable(block: Block): number;
  /** False once the level is over. */
  playable: boolean;
}

/**
 * The tray of numbered blocks and the panel they are played into.
 *
 * Plain DOM rather than canvas: these are buttons and they should behave
 * like the game's other buttons — focusable, house-styled, and sized by
 * the same tokens.
 */
export class Tray {
  private readonly panel = required('panel');
  private readonly tray = required('tray');

  constructor(private readonly onPlay: (trayIndex: number) => void) {}

  private chip(block: Block, extraClass: string): HTMLElement {
    const el = document.createElement('span');
    el.className = `chip ${extraClass}`;
    el.style.background = swatch(block.color).hex;
    el.style.color = solidInk(block.color);
    el.textContent = String(block.count);
    return el;
  }

  render(model: TrayModel): void {
    this.panel.replaceChildren(
      ...model.slots.map((slot, i) => {
        const cell = document.createElement('div');
        cell.className = slot.block ? 'slot is-filled' : 'slot';
        cell.setAttribute('aria-label', slot.block ? `Slot ${i + 1}: ${swatch(slot.block.color).name}, ${slot.remaining} to go` : `Slot ${i + 1}, empty`);

        if (slot.block) {
          const chip = this.chip(slot.block, 'chip--slot');
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
      ...model.tray.map((block, i) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'chip';
        button.style.background = swatch(block.color).hex;
        button.style.color = solidInk(block.color);
        button.textContent = String(block.count);
        button.disabled = !model.playable;

        const reach = model.reachable(block);
        if (reach === 0) button.classList.add('is-stranded');

        button.setAttribute(
          'aria-label',
          `${swatch(block.color).name} ${block.count}` +
            (reach === 0
              ? ' — nothing showing, it will wait in the panel'
              : ` — ${reach} showing`),
        );
        button.addEventListener('click', () => this.onPlay(i));
        return button;
      }),
    );
  }
}
