import type { App, Session } from '../app.ts';
import { beanSprite } from '../render/beans.ts';
import { drawText } from '../render/font.ts';
import { portrait } from '../render/portraits.ts';
import { H, W } from '../render/renderer.ts';
import { CAST, HERO } from './characters.ts';

interface Drop {
  x: number;
  y: number;
  v: number;
  color: number;
  connect: number;
}

/** Beans raining behind menus, with an optional title logo. */
export class MenuBackdrop implements Session {
  private frame = 0;
  private drops: Drop[] = [];
  private last = 0;
  private readonly app: App;
  private readonly logo: boolean;
  private readonly bg: [string, string];

  constructor(app: App, opts: { logo?: boolean; bg?: [string, string] } = {}) {
    this.app = app;
    this.logo = opts.logo ?? false;
    this.bg = opts.bg ?? ['#2a1050', '#0a0418'];
    for (let i = 0; i < 26; i++) this.spawn(Math.random() * H);
  }

  private spawn(y = -16): void {
    this.drops.push({
      x: Math.floor(Math.random() * 20) * 16,
      y,
      v: 0.4 + Math.random() * 0.9,
      color: 1 + Math.floor(Math.random() * 5),
      connect: 0,
    });
  }

  update(now: number): void {
    if (now - this.last < 1000 / 60 - 1) return;
    this.last = now;
    this.frame++;
    for (const d of this.drops) d.y += d.v;
    this.drops = this.drops.filter((d) => d.y < H + 16);
    while (this.drops.length < 26) this.spawn();
  }

  render(): void {
    const r = this.app.renderer;
    r.draw({ layout: 'none', boards: [], frame: this.frame, bg: this.bg, panels: [], info: [], banners: [] });
    const g = r.g;
    g.globalAlpha = 0.55;
    for (const d of this.drops) g.drawImage(beanSprite(d.color, d.connect, false, this.frame % 120 < 6 ? 'closed' : 'open'), d.x, Math.round(d.y));
    g.globalAlpha = 1;
    if (this.logo) {
      const bob = Math.round(Math.sin(this.frame / 20) * 2);
      drawText(g, "GRIMGEAR'S", W / 2, 14 + bob, { color: '#c0b0ff', outline: '#000', align: 'center', scale: 2 });
      drawText(g, 'BEAN MACHINE', W / 2, 34 + bob, { color: '#ffe040', outline: '#000', align: 'center', scale: 3 });
      drawText(g, 'NEW CAST - CLASSIC 1993 RULES', W / 2, 62, { color: '#c8c0f0', outline: '#000', align: 'center' });
      g.drawImage(portrait(HERO, this.frame % 200 < 100 ? 'idle' : 'happy'), 10, 150);
      g.drawImage(portrait(CAST[CAST.length - 1], 'happy'), W - 74, 150);
    }
  }

  dispose(): void {}
}
