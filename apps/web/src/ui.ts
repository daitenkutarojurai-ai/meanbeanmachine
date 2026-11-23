import { audio } from './audio.ts';
import type { Input, MenuAction } from './input.ts';

export const overlay = document.getElementById('overlay') as HTMLDivElement;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {},
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  const { class: cls, ...rest } = props;
  if (cls) node.className = cls;
  Object.assign(node, rest);
  for (const c of children) if (c !== null && c !== undefined && c !== false) node.append(c);
  return node;
}

export function clearOverlay(): void {
  overlay.replaceChildren();
}

export interface MenuItem {
  label: string;
  action?: () => void;
  /** Option items show a value and cycle it with left/right. */
  value?: () => string;
  change?: (dir: -1 | 1) => void;
  disabled?: boolean;
}

export interface MenuHandle {
  close(): void;
  refresh(): void;
  root: HTMLElement;
}

let input: Input;
export function initUi(i: Input): void {
  input = i;
}

/** A keyboard/gamepad/mouse navigable menu inside a layer. */
export function showMenu(opts: {
  title?: string;
  subtitle?: string;
  items: MenuItem[];
  onBack?: () => void;
  footer?: string;
  dim?: boolean;
  position?: 'center' | 'bottom';
  before?: Node[];
  focus?: number;
}): MenuHandle {
  const layer = el('div', { class: `layer${opts.dim === false ? '' : ' dim'}${opts.position === 'bottom' ? ' bottom' : ''}` });
  const panel = el('div', { class: 'panel' });
  if (opts.title) panel.append(el('h2', {}, opts.title));
  if (opts.subtitle) panel.append(el('p', { class: 'muted' }, opts.subtitle));
  for (const n of opts.before ?? []) panel.append(n);
  const list = el('div', { class: 'menu' });
  panel.append(list);
  if (opts.footer) panel.append(el('p', { class: 'hint' }, opts.footer));
  layer.append(panel);
  overlay.append(layer);

  let focus = opts.focus ?? opts.items.findIndex((i) => !i.disabled);
  const buttons: HTMLButtonElement[] = [];

  const render = (): void => {
    opts.items.forEach((item, i) => {
      const b = buttons[i];
      b.replaceChildren(el('span', {}, item.label));
      if (item.value) b.append(el('span', { class: 'val' }, `◀ ${item.value()} ▶`));
      b.disabled = !!item.disabled;
      b.classList.toggle('focus', i === focus);
    });
  };

  opts.items.forEach((item, i) => {
    const b = el('button', { type: 'button' });
    b.addEventListener('click', (e) => {
      if (item.disabled) return;
      focus = i;
      if (item.change && !item.action) {
        const rect = b.getBoundingClientRect();
        item.change(e.clientX < rect.left + rect.width / 2 ? -1 : 1);
        audio.sfx('menu');
      } else {
        audio.sfx('select');
        item.action?.();
      }
      render();
    });
    b.addEventListener('pointerenter', () => {
      if (item.disabled || focus === i) return;
      focus = i;
      render();
    });
    buttons.push(b);
    list.append(b);
  });
  render();

  const move = (dir: number): void => {
    const n = opts.items.length;
    for (let k = 1; k <= n; k++) {
      const j = (focus + dir * k + n * k) % n;
      if (!opts.items[j].disabled) {
        focus = j;
        break;
      }
    }
    audio.sfx('menu');
    render();
  };

  const off = input.onMenu((a: MenuAction) => {
    if (!layer.isConnected) return;
    if (overlay.lastElementChild !== layer) return;
    const item = opts.items[focus];
    if (a === 'up') move(-1);
    else if (a === 'down') move(1);
    else if ((a === 'left' || a === 'right') && item?.change) {
      item.change(a === 'left' ? -1 : 1);
      audio.sfx('menu');
      render();
    } else if (a === 'confirm' && item && !item.disabled) {
      if (item.action) {
        audio.sfx('select');
        item.action();
      } else if (item.change) {
        item.change(1);
        audio.sfx('menu');
      }
      render();
    } else if (a === 'back' && opts.onBack) {
      audio.sfx('back');
      opts.onBack();
    }
  });

  return {
    root: panel,
    refresh: render,
    close: () => {
      off();
      layer.remove();
    },
  };
}

/** A free-form layer that closes on back. */
export function showLayer(content: Node[], opts: { onBack?: () => void; onConfirm?: () => void; dim?: boolean; position?: 'center' | 'bottom' } = {}): { close(): void; layer: HTMLElement } {
  const layer = el('div', { class: `layer${opts.dim === false ? '' : ' dim'}${opts.position === 'bottom' ? ' bottom' : ''}` }, ...content);
  overlay.append(layer);
  const off = input.onMenu((a) => {
    if (overlay.lastElementChild !== layer) return;
    if (a === 'back') opts.onBack?.();
    if (a === 'confirm') opts.onConfirm?.();
  });
  return {
    layer,
    close: () => {
      off();
      layer.remove();
    },
  };
}

export const pad = (n: number, width = 8): string => String(Math.max(0, Math.floor(n))).padStart(width, '0');
