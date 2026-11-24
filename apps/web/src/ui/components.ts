import { audio } from '../audio.ts';
import type { Character } from '../game/characters.ts';
import { CHESTS, type ChestType } from '../meta/rewards.ts';
import { Hero, type Mood } from '../render/hero.ts';
import { type Expression, portrait } from '../render/portraits.ts';

export const overlay = (): HTMLElement => document.getElementById('overlay')!;

type Child = Node | string | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Omit<HTMLElementTagNameMap[K], 'style'>> & { class?: string; style?: string; html?: string } = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  const { class: cls, style, html, ...rest } = props;
  if (cls) node.className = cls;
  if (style) node.setAttribute('style', style);
  if (html) node.innerHTML = html;
  Object.assign(node, rest);
  for (const c of children) if (c !== null && c !== undefined && c !== false) node.append(c);
  return node;
}

export function svg(markup: string, cls = ''): HTMLElement {
  const span = document.createElement('span');
  span.innerHTML = markup.trim();
  const node = span.firstElementChild as HTMLElement;
  if (cls) node.classList.add(cls);
  return node;
}

const STROKE = 'stroke="#1a1230" stroke-width="2.5" stroke-linejoin="round"';

export const ICONS = {
  coin: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="#ffd23a" ${STROKE}/><circle cx="16" cy="16" r="9" fill="#ffb31a"/><rect x="11.5" y="10" width="9" height="12" rx="4.5" fill="#ffe680" stroke="#c47f00" stroke-width="1.4"/><circle cx="14.5" cy="15" r="1" fill="#8a5400"/><circle cx="17.5" cy="15" r="1" fill="#8a5400"/><path d="M8 11a10 10 0 0 1 6-5" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none" opacity=".7"/></svg>`,
  gem: `<svg viewBox="0 0 32 32"><path d="M9 6h14l6 8-13 14L3 14z" fill="#e04aff" ${STROKE}/><path d="M9 6l3 8h8l3-8M3 14h26M12 14l4 14 4-14" fill="none" stroke="#7a1aa8" stroke-width="1.6"/><path d="M11 9l2 4" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".8"/></svg>`,
  trophy: `<svg viewBox="0 0 32 32"><path d="M9 4h14v8a7 7 0 0 1-14 0z" fill="#ffd23a" ${STROKE}/><path d="M9 7H4c0 5 3 7 5 7M23 7h5c0 5-3 7-5 7" fill="none" ${STROKE}/><path d="M13 19h6l1 5h-8z" fill="#f0a000" ${STROKE}/><rect x="9" y="24" width="14" height="5" rx="2" fill="#a86a00" ${STROKE}/><path d="M12 7v4" stroke="#fff6c0" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  shop: `<svg viewBox="0 0 32 32"><path d="M6 11h20l-2 17H8z" fill="#ff8a3a" ${STROKE}/><path d="M11 13V9a5 5 0 0 1 10 0v4" fill="none" ${STROKE}/><path d="M9 16h14" stroke="#ffd0a0" stroke-width="2" stroke-linecap="round"/></svg>`,
  cards: `<svg viewBox="0 0 32 32"><rect x="4" y="7" width="15" height="20" rx="3" fill="#7aa6ff" transform="rotate(-10 11 17)" ${STROKE}/><rect x="12" y="5" width="15" height="20" rx="3" fill="#3fd06a" transform="rotate(8 19 15)" ${STROKE}/><circle cx="19.5" cy="14" r="3.5" fill="#fff"/></svg>`,
  swords: `<svg viewBox="0 0 32 32"><path d="M6 4l15 15-3 3L3 7V4z" fill="#dfe6f6" ${STROKE}/><path d="M26 4L11 19l3 3L29 7V4z" fill="#dfe6f6" ${STROKE}/><path d="M9 20l3 3-4 4-3-3zM23 20l-3 3 4 4 3-3z" fill="#ffd23a" ${STROKE}/></svg>`,
  map: `<svg viewBox="0 0 32 32"><path d="M4 8l7-3 10 3 7-3v19l-7 3-10-3-7 3z" fill="#7ae07a" ${STROKE}/><path d="M11 5v19M21 8v19" stroke="#1a1230" stroke-width="2"/><path d="M14 13l3 3m0-3l-3 3" stroke="#e02a44" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  user: `<svg viewBox="0 0 32 32"><circle cx="16" cy="11" r="6" fill="#ffd0a8" ${STROKE}/><path d="M5 28c1-7 5-10 11-10s10 3 11 10z" fill="#7aa6ff" ${STROKE}/></svg>`,
  scroll: `<svg viewBox="0 0 32 32"><path d="M8 5h16v20a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-2h4z" fill="#ffe6a8" ${STROKE}/><path d="M12 11h8M12 15h8M12 19h5" stroke="#a86a00" stroke-width="2" stroke-linecap="round"/></svg>`,
  close: `<svg viewBox="0 0 20 20"><path d="M4 4l12 12M16 4L4 16" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/></svg>`,
  pause: `<svg viewBox="0 0 24 24"><rect x="5" y="4" width="5" height="16" rx="1.5" fill="#fff"/><rect x="14" y="4" width="5" height="16" rx="1.5" fill="#fff"/></svg>`,
  gear: `<svg viewBox="0 0 32 32"><path d="M16 3l3 3 4-1 1 4 4 1-1 4 3 3-3 3 1 4-4 1-1 4-4-1-3 3-3-3-4 1-1-4-4-1 1-4-3-3 3-3-1-4 4-1 1-4 4 1z" fill="#c8d0e8" ${STROKE}/><circle cx="16" cy="16" r="5" fill="#6a7290" ${STROKE}/></svg>`,
  lock: `<svg viewBox="0 0 32 32"><rect x="7" y="14" width="18" height="14" rx="3" fill="#c8d0e8" ${STROKE}/><path d="M11 14v-3a5 5 0 0 1 10 0v3" fill="none" ${STROKE}/></svg>`,
  star: `<svg viewBox="0 0 32 32"><path d="M16 3l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z" fill="#ffd23a" ${STROKE}/></svg>`,
  modes: `<svg viewBox="0 0 32 32"><rect x="4" y="4" width="10" height="10" rx="3" fill="#ffd23a" ${STROKE}/><rect x="18" y="4" width="10" height="10" rx="3" fill="#7aa6ff" ${STROKE}/><rect x="4" y="18" width="10" height="10" rx="3" fill="#3fd06a" ${STROKE}/><rect x="18" y="18" width="10" height="10" rx="3" fill="#ff6a7a" ${STROKE}/></svg>`,
  globe: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="#5ab0ff" ${STROKE}/><path d="M6 12c4 1 6-2 9 0s1 6 5 6 6-3 6-3M10 25c1-3 4-4 5-7" fill="none" stroke="#2ec450" stroke-width="3" stroke-linecap="round"/></svg>`,
  share: `<svg viewBox="0 0 32 32"><path d="M6 16v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V16" fill="none" stroke="#1a1230" stroke-width="6" stroke-linecap="round"/><path d="M6 16v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V16" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M16 3l8 8h-5v9h-6v-9H8z" fill="#fff" ${STROKE}/></svg>`,
  people: `<svg viewBox="0 0 32 32"><circle cx="11" cy="11" r="5" fill="#ffd0a8" ${STROKE}/><circle cx="22" cy="12" r="4" fill="#ffd0a8" ${STROKE}/><path d="M2 27c1-6 4-9 9-9s8 3 9 9z" fill="#7aa6ff" ${STROKE}/><path d="M18 26c0-5 2-8 5-8s6 3 7 8z" fill="#3fd06a" ${STROKE}/></svg>`,
  dumbbell: `<svg viewBox="0 0 32 32"><rect x="3" y="11" width="6" height="10" rx="2" fill="#6a7290" ${STROKE}/><rect x="23" y="11" width="6" height="10" rx="2" fill="#6a7290" ${STROKE}/><rect x="8" y="14" width="16" height="4" fill="#c8d0e8" ${STROKE}/></svg>`,
  keyboard: `<svg viewBox="0 0 32 32"><rect x="3" y="9" width="26" height="15" rx="3" fill="#c8d0e8" ${STROKE}/><path d="M8 14h2M13 14h2M18 14h2M23 14h1M9 19h14" stroke="#1a1230" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  play: `<svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z" fill="#fff" stroke="#1a1230" stroke-width="2" stroke-linejoin="round"/></svg>`,
  clock: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="#fff" ${STROKE}/><path d="M16 9v7l5 3" stroke="#1a1230" stroke-width="2.6" stroke-linecap="round" fill="none"/></svg>`,
  road: `<svg viewBox="0 0 32 32"><path d="M10 29L14 3h4l4 26z" fill="#8a94b8" ${STROKE}/><path d="M16 6v4M16 14v4M16 22v4" stroke="#ffd23a" stroke-width="2.4" stroke-linecap="round"/></svg>`,
};

export function chestSvg(type: ChestType, open = false): string {
  const [a, b, c] = CHESTS[type].colors;
  const id = `ch${type}${open ? 'o' : ''}`;
  const lid = open
    ? `<path d="M14 40 L30 8 L106 8 L118 40 Z" fill="url(#${id}l)" ${STROKE} transform="rotate(-28 20 40) translate(-6 -18)"/>`
    : `<path d="M10 52 Q10 18 60 18 Q110 18 110 52 Z" fill="url(#${id}l)" ${STROKE}/><path d="M16 46 Q18 26 60 25" stroke="#fff" stroke-width="4" fill="none" opacity=".45" stroke-linecap="round"/>`;
  return `<svg viewBox="0 0 120 112"><defs>
    <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
    <linearGradient id="${id}l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs>
    <rect x="10" y="50" width="100" height="52" rx="8" fill="url(#${id}b)" ${STROKE}/>
    ${open ? `<ellipse cx="60" cy="52" rx="44" ry="8" fill="#fff6c0"/><g fill="#ffd23a" ${STROKE}><circle cx="44" cy="48" r="7"/><circle cx="60" cy="44" r="8"/><circle cx="76" cy="49" r="7"/></g>` : ''}
    ${lid}
    <rect x="22" y="50" width="12" height="52" fill="${c}" opacity=".6"/><rect x="86" y="50" width="12" height="52" fill="${c}" opacity=".6"/>
    ${open ? '' : `<rect x="50" y="44" width="20" height="22" rx="4" fill="#ffd23a" ${STROKE}/><circle cx="60" cy="53" r="3" fill="#1a1230"/>`}
  </svg>`;
}

export const fmt = (n: number): string => Math.floor(n).toLocaleString('en-US');

export function fmtTime(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  if (s >= 60) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${s}s`;
}

export function button(label: string, opts: { cls?: string; icon?: string; onClick?: () => void; disabled?: boolean; sound?: boolean } = {}): HTMLButtonElement {
  const b = el('button', { class: `btn ${opts.cls ?? ''}`, type: 'button', disabled: !!opts.disabled });
  if (opts.icon) b.append(svg(opts.icon));
  if (label) b.append(el('span', {}, label));
  b.addEventListener('click', () => {
    if (b.disabled) return;
    audio.unlock();
    if (opts.sound !== false) audio.sfx('select');
    opts.onClick?.();
  });
  return b;
}

export function price(p: { coins?: number; gems?: number }): HTMLElement {
  const span = el('span', { class: 'price' });
  if (p.coins) span.append(svg(ICONS.coin), fmt(p.coins));
  if (p.gems) span.append(svg(ICONS.gem), fmt(p.gems));
  if (!p.coins && !p.gems) span.append('FREE');
  return span;
}

export interface ModalHandle {
  close(): void;
  body: HTMLElement;
}

export function modal(title: string, content: Child[], opts: { onClose?: () => void; closable?: boolean; cls?: string } = {}): ModalHandle {
  const box = el('div', { class: `modal ${opts.cls ?? ''}` });
  if (title) box.append(el('h2', { class: 'outline' }, title));
  const body = el('div', { class: 'stack' }, ...content);
  box.append(body);
  const back = el('div', { class: 'modal-back' }, box);
  const close = (): void => {
    back.remove();
    window.removeEventListener('keydown', onKey);
    opts.onClose?.();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && opts.closable !== false && overlay().lastElementChild === back) close();
  };
  if (opts.closable !== false) {
    const x = el('button', { class: 'close', type: 'button' }, svg(ICONS.close));
    x.setAttribute('aria-label', 'Close');
    x.addEventListener('click', () => {
      audio.sfx('back');
      close();
    });
    box.append(x);
    back.addEventListener('pointerdown', (e) => {
      if (e.target === back) close();
    });
  }
  window.addEventListener('keydown', onKey);
  overlay().append(back);
  return { close, body };
}

export function toast(message: string): void {
  const t = el('div', { class: 'toast outline' }, message);
  overlay().append(t);
  setTimeout(() => t.remove(), 2300);
}

/** A canvas with Sprout animating in it until it leaves the page. */
export function heroCanvas(opts: { skin: string; size: number; mood?: Mood; onTap?: (h: Hero) => void; background?: (g: CanvasRenderingContext2D, w: number, h: number, t: number) => void; foot?: number; scale?: number }): { canvas: HTMLCanvasElement; hero: Hero } {
  const canvas = el('canvas');
  const hero = new Hero(opts.skin);
  if (opts.mood) hero.setMood(opts.mood);
  let last = performance.now();
  const start = last;
  const loop = (now: number): void => {
    if (!canvas.isConnected) {
      if (now - start > 3000) return;
      requestAnimationFrame(loop);
      return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const w = canvas.clientWidth || opts.size;
    const h = canvas.clientHeight || opts.size;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    hero.update((now - last) / 1000);
    last = now;
    const g = canvas.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    if (opts.background) opts.background(g, canvas.width, canvas.height, (now - start) / 1000);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const size = Math.min(w, h) * (opts.scale ?? 0.55);
    hero.draw(g, w / 2, h * (opts.foot ?? 0.86), size);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  if (opts.onTap) {
    canvas.style.cursor = 'pointer';
    canvas.addEventListener('pointerdown', () => opts.onTap!(hero));
  }
  return { canvas, hero };
}

/** A still image of a robot opponent. */
export function robotCanvas(ch: Character, expr: Expression, px: number): HTMLCanvasElement {
  const src = portrait(ch, expr, px * Math.min(window.devicePixelRatio || 1, 2));
  const c = el('canvas', { width: src.width, height: src.height });
  c.getContext('2d')!.drawImage(src, 0, 0);
  return c;
}

/** Animates a number from `from` to `to` inside an element. */
export function countUp(node: HTMLElement, from: number, to: number, ms = 900, prefix = ''): void {
  const start = performance.now();
  const step = (now: number): void => {
    const t = Math.min(1, (now - start) / ms);
    const e = 1 - (1 - t) ** 3;
    node.textContent = prefix + fmt(from + (to - from) * e);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
