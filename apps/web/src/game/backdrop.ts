import type { App, Session } from '../app.ts';
import { beanSprite } from '../render/beans.ts';
import { drawText, fancyText } from '../render/font.ts';
import { portrait } from '../render/portraits.ts';
import { H, W } from '../render/renderer.ts';
import type { SceneKind } from '../render/scenes.ts';
import { CAST, HERO } from './characters.ts';

interface Drop {
  x: number;
  y: number;
  v: number;
  spin: number;
  color: number;
}

/** Beans tumbling past Grimgear's lab behind menus, with an optional title logo. */
export class MenuBackdrop implements Session {
  readonly kind = 'menu';
  private frame = 0;
  private drops: Drop[] = [];
  private last = 0;
  private readonly app: App;
  private readonly logo: boolean;
  private readonly scene: SceneKind;

  constructor(app: App, opts: { logo?: boolean; scene?: SceneKind } = {}) {
    this.app = app;
    this.logo = opts.logo ?? false;
    this.scene = opts.scene ?? 'lab';
    for (let i = 0; i < 18; i++) this.spawn(Math.random() * H);
  }

  private spawn(y = -16): void {
    this.drops.push({ x: Math.random() * (W - 16), y, v: 0.35 + Math.random() * 0.8, spin: (Math.random() - 0.5) * 0.06, color: 1 + Math.floor(Math.random() * 5) });
  }

  update(now: number): void {
    if (now - this.last < 1000 / 60 - 1) return;
    this.last = now;
    this.frame++;
    for (const d of this.drops) d.y += d.v;
    this.drops = this.drops.filter((d) => d.y < H + 16);
    while (this.drops.length < 18) this.spawn();
  }

  render(): void {
    const r = this.app.renderer;
    r.draw({ layout: 'none', boards: [], frame: this.frame, scene: this.scene, panels: [], info: [], banners: [] });
    const g = r.g;
    g.globalAlpha = 0.7;
    for (const d of this.drops) {
      g.save();
      g.translate(Math.round(d.x + 8), Math.round(d.y + 8));
      g.rotate(this.frame * d.spin);
      g.drawImage(beanSprite(d.color, 0, false, (this.frame + d.color * 40) % 150 < 6 ? 'blink' : 'open'), -8, -8);
      g.restore();
    }
    g.globalAlpha = 1;
    if (!this.logo) return;
    const bob = Math.round(Math.sin(this.frame / 20) * 2);
    const top = fancyText("GRIMGEAR'S", 2, '#e8dcff', '#9a7aff');
    const main = fancyText('BEAN MACHINE', 3, '#fff27a', '#ff8a1a');
    g.drawImage(top, Math.round(W / 2 - top.width / 2), 10 + bob);
    const mx = Math.round(W / 2 - main.width / 2);
    const my = 30 + bob;
    g.drawImage(main, mx, my);
    // A glint sweeping across the logo every few seconds.
    const sweep = (this.frame % 240) * 3 - 60;
    if (sweep < main.width + 40) {
      g.save();
      g.beginPath();
      g.rect(mx, my, main.width, main.height);
      g.clip();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath();
      g.moveTo(mx + sweep, my);
      g.lineTo(mx + sweep + 10, my);
      g.lineTo(mx + sweep - 4, my + main.height);
      g.lineTo(mx + sweep - 14, my + main.height);
      g.fill();
      g.restore();
    }
    drawText(g, 'NEW CAST - CLASSIC 1993 RULES', W / 2, 62, { color: '#d8d0ff', outline: '#000', align: 'center' });
    const heroBob = Math.round(Math.sin(this.frame / 14) * 2);
    g.drawImage(portrait(HERO, this.frame % 200 < 100 ? 'idle' : 'happy'), 10, 150 + heroBob);
    g.drawImage(portrait(CAST[CAST.length - 1], this.frame % 260 < 8 ? 'blink' : 'happy'), W - 74, 150);
  }

  dispose(): void {}
}
