// Sprout, the hero: a procedurally animated jelly bean with a sprout on his head.
// Brave, cheerful, a little cheeky. Everything is drawn with vector paths so he stays
// crisp at any size.
import { type SkinDef, skinById } from '../meta/rewards.ts';

export type Mood = 'idle' | 'worried' | 'cheer' | 'sad';
export type Action = 'hop' | 'hurt' | 'wave';

export const LINES = {
  greet: ['Hey! Ready to pop some beans?', "Grimgear won't roast THIS bean!", "Let's goooo!", "I've been practicing my combos!", 'One more game? Okay, five more.'],
  tap: ['Hehe, that tickles!', 'Boop!', "Watch the leaf. It's got style.", "I'm not short, I'm bean-sized!", 'Did somebody say chain?', 'Wanna see a 5-chain? Hit BATTLE!'],
  chain2: ['Nice!', 'Pop!', 'Hup!'],
  chain3: ['Combo!', 'Bean-tastic!', 'Ha-ha!'],
  chain4: ['BOOM!', 'Feel the beans!', 'Unstoppable!'],
  chain5: ['LEGENDARY!', 'Is this a record?!', 'Bean-pocalypse!'],
  hurt: ['Hey! Rude!', 'Oof!', 'Not the refugees!'],
  danger: ['Uh-oh...', 'Too high, too high!', 'Gulp.'],
  win: ['Too easy!', "Who's the bean? I'm the bean!", 'Victory dance!'],
  lose: ["I'll get you next time!", 'That was a warm-up.', 'Okay, okay. Rematch?'],
  chest: ['Ooh, shiny!', "What's inside?!", 'Treasure time!'],
};

export const pick = (list: string[]): string => list[Math.floor(Math.random() * list.length)];

interface Bubble {
  text: string;
  until: number;
  born: number;
}

export class Hero {
  skin: SkinDef;
  mood: Mood = 'idle';
  bubble: Bubble | null = null;
  private t = 0;
  private action: Action | null = null;
  private actionT = 0;
  private y = 0;
  private vy = 0;
  private squash = 0;
  private squashV = 0;
  private leaf = 0;
  private leafV = 0;
  private blinkAt = 1.5 + Math.random() * 2;
  private blink = 0;
  private look = 0;
  private lookTarget = 0;
  private nextLook = 1;
  private arms = [0.25, 0.25];
  private hopTimer = 0;

  constructor(skinId = 'classic') {
    this.skin = skinById(skinId);
  }

  setSkin(id: string): void {
    this.skin = skinById(id);
  }

  setMood(m: Mood): void {
    if (this.mood === m) return;
    this.mood = m;
    this.hopTimer = 0;
  }

  act(a: Action): void {
    this.action = a;
    this.actionT = 0;
    if (a === 'hop') this.jump(2.3);
    if (a === 'hurt') {
      this.squashV -= 5;
    }
  }

  say(text: string, seconds = 2.2): void {
    this.bubble = { text, until: this.t + seconds, born: this.t };
  }

  private jump(v: number): void {
    if (this.y < -0.01) return;
    this.vy = -v;
    this.squashV -= 3;
  }

  update(dt: number): void {
    const d = Math.min(dt, 0.05);
    this.t += d;
    this.actionT += d;
    if (this.action === 'hurt' && this.actionT > 0.6) this.action = null;
    if (this.action === 'wave' && this.actionT > 1.6) this.action = null;
    if (this.action === 'hop' && this.actionT > 0.9) this.action = null;
    if (this.bubble && this.t > this.bubble.until) this.bubble = null;

    if (this.mood === 'cheer') {
      this.hopTimer -= d;
      if (this.hopTimer <= 0) {
        this.jump(2.1);
        this.hopTimer = 0.62;
      }
    }

    // Hop physics in body-heights per second.
    if (this.y < 0 || this.vy < 0) {
      this.vy += 11 * d;
      this.y += this.vy * d;
      if (this.y >= 0) {
        this.y = 0;
        this.squashV += Math.min(6, this.vy * 2.5);
        this.vy = 0;
      }
    }
    // Squash spring.
    const breath = this.mood === 'sad' ? 0.06 + Math.sin(this.t * 1.4) * 0.015 : Math.sin(this.t * 2.4) * 0.025;
    const target = this.y < 0 ? -0.06 : breath;
    this.squashV += ((target - this.squash) * 160 - this.squashV * 12) * d;
    this.squash = Math.max(-0.25, Math.min(0.3, this.squash + this.squashV * d));
    // The leaf lags behind the body.
    const leafTarget = Math.sin(this.t * 1.7) * 0.12 + this.vy * 0.18 + (this.mood === 'sad' ? 0.5 : 0);
    this.leafV += ((leafTarget - this.leaf) * 60 - this.leafV * 5) * d;
    this.leaf += this.leafV * d;

    this.blinkAt -= d;
    if (this.blinkAt <= 0) {
      this.blink = 0.14;
      this.blinkAt = 2 + Math.random() * 3;
    }
    this.blink = Math.max(0, this.blink - d);
    this.nextLook -= d;
    if (this.nextLook <= 0) {
      this.lookTarget = Math.random() < 0.4 ? 0 : Math.random() * 2 - 1;
      this.nextLook = 1 + Math.random() * 2.5;
    }
    this.look += (this.lookTarget - this.look) * Math.min(1, d * 8);

    let ta: [number, number] = [0.25 + Math.sin(this.t * 2.4) * 0.06, 0.25 - Math.sin(this.t * 2.4) * 0.06];
    if (this.mood === 'cheer' || this.action === 'hop') ta = [2.5 + Math.sin(this.t * 14) * 0.25, 2.5 - Math.sin(this.t * 14) * 0.25];
    else if (this.mood === 'worried') ta = [1.2, 1.2];
    else if (this.mood === 'sad') ta = [0.05, 0.05];
    if (this.action === 'wave') ta = [ta[0], 2.4 + Math.sin(this.actionT * 14) * 0.45];
    if (this.action === 'hurt') ta = [1.6, 1.6];
    for (const i of [0, 1]) this.arms[i] += (ta[i] - this.arms[i]) * Math.min(1, d * 12);
  }

  /** `size` is the body height in pixels; (cx, footY) is where he stands. */
  draw(g: CanvasRenderingContext2D, cx: number, footY: number, size: number): void {
    const S = size;
    const [light, base, dark] = this.skin.body;
    const sq = this.squash;
    const H = S * (1 - sq);
    const W = S * 0.84 * (1 + sq * 0.9);
    const lift = this.y * S;
    const shake = this.action === 'hurt' ? Math.sin(this.actionT * 60) * S * 0.03 * (1 - this.actionT / 0.6) : this.mood === 'worried' ? Math.sin(this.t * 45) * S * 0.006 : 0;
    const bx = cx + shake;
    const by = footY + lift - H / 2 - S * 0.05;
    const id = this.skin.id;

    // Shadow shrinks as he jumps.
    const air = Math.min(1, -this.y * 2);
    g.fillStyle = `rgba(0,0,0,${0.28 * (1 - air * 0.6)})`;
    g.beginPath();
    g.ellipse(cx, footY + S * 0.02, W * 0.42 * (1 - air * 0.4), S * 0.06, 0, 0, Math.PI * 2);
    g.fill();

    if (id === 'royal') this.cape(g, bx, by, W, H, S);

    // Feet.
    for (const s of [-1, 1]) {
      g.fillStyle = dark;
      g.beginPath();
      g.ellipse(bx + s * W * 0.22, footY + lift - S * 0.03, W * 0.17, S * 0.075, 0, 0, Math.PI * 2);
      g.fill();
    }

    // Arms behind the body edge.
    for (const s of [-1, 1]) {
      const a = this.arms[s < 0 ? 0 : 1];
      g.save();
      g.translate(bx + s * W * 0.43, by + H * 0.08);
      g.rotate(s * a);
      g.fillStyle = base;
      g.strokeStyle = dark;
      g.lineWidth = S * 0.022;
      g.beginPath();
      g.roundRect(-S * 0.045, -S * 0.02, S * 0.09, S * 0.2, S * 0.045);
      g.fill();
      g.stroke();
      g.restore();
    }

    // Body.
    const body = new Path2D();
    body.moveTo(bx, by - H / 2);
    body.bezierCurveTo(bx + W * 0.42, by - H / 2, bx + W / 2, by - H * 0.16, bx + W / 2, by + H * 0.12);
    body.bezierCurveTo(bx + W / 2, by + H * 0.42, bx + W * 0.3, by + H / 2, bx, by + H / 2);
    body.bezierCurveTo(bx - W * 0.3, by + H / 2, bx - W / 2, by + H * 0.42, bx - W / 2, by + H * 0.12);
    body.bezierCurveTo(bx - W / 2, by - H * 0.16, bx - W * 0.42, by - H / 2, bx, by - H / 2);
    const grad = g.createRadialGradient(bx - W * 0.18, by - H * 0.25, S * 0.05, bx, by, S * 0.62);
    grad.addColorStop(0, light);
    grad.addColorStop(0.5, base);
    grad.addColorStop(1, dark);
    g.fillStyle = grad;
    g.fill(body);
    g.strokeStyle = dark;
    g.lineWidth = S * 0.028;
    g.stroke(body);
    g.save();
    g.clip(body);
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.beginPath();
    g.ellipse(bx, by + H * 0.24, W * 0.3, H * 0.2, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.beginPath();
    g.ellipse(bx - W * 0.22, by - H * 0.3, W * 0.11, H * 0.06, -0.6, 0, Math.PI * 2);
    g.fill();

    this.neckwear(g, bx, by, W, H, S);
    this.face(g, bx, by, W, H, S);
    this.headwear(g, bx, by, W, H, S);
    if (this.bubble) {
      const age = this.t - this.bubble.born;
      const left = this.bubble.until - this.t;
      speechBubble(g, bx + W * 0.3, by - H * 0.42, this.bubble.text, Math.max(12, S * 0.12), Math.min(1, age * 6, left * 4));
    }
  }

  private face(g: CanvasRenderingContext2D, bx: number, by: number, W: number, H: number, S: number): void {
    const ink = '#1c1430';
    const mood = this.mood;
    const hurt = this.action === 'hurt';
    const air = this.y < -0.05;
    const happyEyes = (mood === 'cheer' && air) || (this.action === 'hop' && air);
    const ey = by - H * 0.1;
    const erx = W * 0.125;
    const ery = H * 0.13;
    const lid = this.blink > 0 ? 0.1 : mood === 'sad' ? 0.55 : 1;
    for (const s of [-1, 1]) {
      const ex = bx + s * W * 0.18;
      if (happyEyes) {
        g.strokeStyle = ink;
        g.lineWidth = S * 0.035;
        g.lineCap = 'round';
        g.beginPath();
        g.arc(ex, ey + ery * 0.4, erx * 0.75, Math.PI * 1.15, Math.PI * 1.85);
        g.stroke();
        continue;
      }
      if (this.skin.id === 'pirate' && s < 0) {
        g.fillStyle = '#141018';
        g.beginPath();
        g.ellipse(ex, ey, erx * 1.05, ery * 0.95, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#141018';
        g.lineWidth = S * 0.018;
        g.beginPath();
        g.moveTo(ex - erx, ey - ery * 0.6);
        g.lineTo(bx + W * 0.45, by - H * 0.38);
        g.stroke();
        continue;
      }
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.ellipse(ex, ey, erx, ery * lid, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.3)';
      g.lineWidth = S * 0.01;
      g.stroke();
      if (lid > 0.2) {
        const py = mood === 'worried' ? -ery * 0.35 : ery * 0.1;
        const px = this.look * erx * 0.35;
        const pr = erx * (hurt ? 0.35 : 0.55);
        g.save();
        g.beginPath();
        g.ellipse(ex, ey, erx, ery * lid, 0, 0, Math.PI * 2);
        g.clip();
        g.fillStyle = ink;
        g.beginPath();
        g.arc(ex + px, ey + py, pr, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.arc(ex + px - pr * 0.35, ey + py - pr * 0.4, pr * 0.38, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.arc(ex + px + pr * 0.35, ey + py + pr * 0.35, pr * 0.16, 0, Math.PI * 2);
        g.fill();
        g.restore();
      } else {
        g.strokeStyle = ink;
        g.lineWidth = S * 0.025;
        g.beginPath();
        g.moveTo(ex - erx, ey);
        g.lineTo(ex + erx, ey);
        g.stroke();
      }
      // Eyebrows carry most of the emotion.
      const tilt = hurt ? 0.45 : mood === 'worried' ? -0.4 : mood === 'sad' ? -0.3 : mood === 'cheer' ? -0.15 : -0.05;
      g.strokeStyle = ink;
      g.lineWidth = S * 0.03;
      g.lineCap = 'round';
      const bh = ey - ery * 1.35 - (mood === 'cheer' ? S * 0.025 : 0);
      // Positive tilt drops the inner ends (angry), negative raises them (worried).
      const inX = ex - s * erx * 0.65;
      const outX = ex + s * erx * 0.75;
      const inY = bh + tilt * erx * 0.8;
      const outY = bh - tilt * erx * 0.4;
      g.beginPath();
      g.moveTo(inX, inY);
      g.quadraticCurveTo((inX + outX) / 2, Math.min(inY, outY) - erx * (tilt > 0.2 ? 0.05 : 0.35), outX, outY);
      g.stroke();
    }
    // Cheeks.
    g.fillStyle = 'rgba(255,110,140,0.45)';
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(bx + s * W * 0.31, by + H * 0.03, W * 0.07, H * 0.035, 0, 0, Math.PI * 2);
      g.fill();
    }
    // Mouth.
    const mx = bx;
    const my = by + H * 0.08;
    const talking = this.bubble !== null && Math.floor(this.t * 9) % 2 === 0;
    g.strokeStyle = ink;
    g.fillStyle = ink;
    g.lineWidth = S * 0.03;
    g.lineCap = 'round';
    g.beginPath();
    if (hurt || talking) {
      g.ellipse(mx, my + S * 0.01, S * 0.035, S * (hurt ? 0.05 : 0.035), 0, 0, Math.PI * 2);
      g.fill();
    } else if (mood === 'cheer' || this.action === 'hop') {
      g.moveTo(mx - S * 0.075, my - S * 0.01);
      g.quadraticCurveTo(mx, my + S * 0.11, mx + S * 0.075, my - S * 0.01);
      g.closePath();
      g.fill();
      g.fillStyle = '#ff7a96';
      g.beginPath();
      g.ellipse(mx, my + S * 0.04, S * 0.032, S * 0.018, 0, 0, Math.PI * 2);
      g.fill();
    } else if (mood === 'worried') {
      g.moveTo(mx - S * 0.05, my + S * 0.015);
      g.quadraticCurveTo(mx - S * 0.025, my - S * 0.01, mx, my + S * 0.015);
      g.quadraticCurveTo(mx + S * 0.025, my + S * 0.04, mx + S * 0.05, my + S * 0.015);
      g.stroke();
    } else if (mood === 'sad') {
      g.arc(mx, my + S * 0.05, S * 0.045, Math.PI * 1.2, Math.PI * 1.8);
      g.stroke();
    } else {
      // A cheeky lopsided smile.
      g.moveTo(mx - S * 0.055, my - S * 0.005);
      g.quadraticCurveTo(mx, my + S * 0.05, mx + S * 0.065, my - S * 0.02);
      g.stroke();
    }
    if (mood === 'worried') {
      const k = (this.t * 0.8) % 1;
      g.fillStyle = `rgba(120,200,255,${1 - k})`;
      g.beginPath();
      const sx = bx + W * 0.42;
      const sy = by - H * 0.3 + k * S * 0.15;
      g.moveTo(sx, sy - S * 0.04);
      g.quadraticCurveTo(sx + S * 0.03, sy + S * 0.01, sx, sy + S * 0.02);
      g.quadraticCurveTo(sx - S * 0.03, sy + S * 0.01, sx, sy - S * 0.04);
      g.fill();
    }
    if (mood === 'sad') {
      const k = (this.t * 0.6) % 1;
      g.fillStyle = `rgba(120,200,255,${0.9 - k * 0.6})`;
      g.beginPath();
      g.ellipse(bx - W * 0.2, ey + ery + k * S * 0.12, S * 0.012, S * 0.022, 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  private sprout(g: CanvasRenderingContext2D, x: number, y: number, S: number): void {
    g.save();
    g.translate(x, y);
    g.rotate(this.leaf);
    if (this.skin.id === 'lava') {
      for (let i = 0; i < 3; i++) {
        const f = Math.sin(this.t * 12 + i * 2) * 0.15 + 1;
        const ox = (i - 1) * S * 0.07;
        g.fillStyle = ['#ff6a1a', '#ffb020', '#fff070'][i];
        g.beginPath();
        g.moveTo(ox - S * 0.06, 0);
        g.quadraticCurveTo(ox - S * 0.07, -S * 0.12 * f, ox + (i - 1) * S * 0.02, -S * 0.24 * f);
        g.quadraticCurveTo(ox + S * 0.07, -S * 0.12 * f, ox + S * 0.06, 0);
        g.fill();
      }
      g.restore();
      return;
    }
    g.strokeStyle = '#2a7a2a';
    g.lineWidth = S * 0.028;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(S * 0.02, -S * 0.09, 0, -S * 0.16);
    g.stroke();
    for (const s of [-1, 1]) {
      g.save();
      g.translate(0, -S * 0.15);
      g.rotate(s * 0.75 + Math.sin(this.t * 3 + s) * 0.06);
      const lg = g.createLinearGradient(0, 0, s * S * 0.18, 0);
      lg.addColorStop(0, '#3fb84a');
      lg.addColorStop(1, '#9af07a');
      g.fillStyle = lg;
      g.beginPath();
      g.ellipse(s * S * 0.09, 0, S * 0.1, S * 0.048, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#1f7a2e';
      g.lineWidth = S * 0.012;
      g.stroke();
      g.restore();
    }
    g.restore();
  }

  private headwear(g: CanvasRenderingContext2D, bx: number, by: number, W: number, H: number, S: number): void {
    const top = by - H / 2;
    const id = this.skin.id;
    if (id === 'sunny') {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + this.t * 0.4;
        g.fillStyle = i % 2 ? '#ffd23a' : '#ffae1a';
        g.beginPath();
        g.ellipse(bx + Math.cos(a) * S * 0.08, top + S * 0.01 + Math.sin(a) * S * 0.05, S * 0.05, S * 0.022, a, 0, Math.PI * 2);
        g.fill();
      }
    }
    if (id === 'astro') {
      g.strokeStyle = '#cfd8ff';
      g.lineWidth = S * 0.02;
      g.beginPath();
      g.moveTo(bx + W * 0.2, top + S * 0.05);
      g.lineTo(bx + W * 0.32, top - S * 0.14);
      g.stroke();
      g.fillStyle = Math.floor(this.t * 2) % 2 ? '#ff4a6a' : '#ff9ab0';
      g.beginPath();
      g.arc(bx + W * 0.32, top - S * 0.15, S * 0.03, 0, Math.PI * 2);
      g.fill();
    }
    if (id === 'candy') this.candy(g, bx, by, W, H, S);
    if (id === 'robo') this.robo(g, bx, by, W, H, S);
    if (id === 'cozy') this.beanie(g, bx, by, W, H, S);
    if (id !== 'pirate' && id !== 'royal' && id !== 'candy' && id !== 'robo' && id !== 'cozy') this.sprout(g, bx, top + S * 0.02, S);
    if (id === 'pirate') {
      this.sprout(g, bx, top - S * 0.02, S * 0.8);
      g.fillStyle = '#3a2418';
      g.beginPath();
      g.moveTo(bx - W * 0.55, top + S * 0.08);
      g.quadraticCurveTo(bx, top - S * 0.32, bx + W * 0.55, top + S * 0.08);
      g.quadraticCurveTo(bx, top - S * 0.02, bx - W * 0.55, top + S * 0.08);
      g.fill();
      g.strokeStyle = '#d8a84a';
      g.lineWidth = S * 0.018;
      g.stroke();
      g.fillStyle = '#f4f0e0';
      g.beginPath();
      g.arc(bx, top - S * 0.07, S * 0.035, 0, Math.PI * 2);
      g.fill();
    }
    if (id === 'royal') {
      this.sprout(g, bx + S * 0.12, top + S * 0.04, S * 0.8);
      g.fillStyle = '#ffd23a';
      g.strokeStyle = '#b07a00';
      g.lineWidth = S * 0.015;
      g.beginPath();
      const cw = W * 0.5;
      const cy = top + S * 0.04;
      g.moveTo(bx - cw / 2, cy);
      g.lineTo(bx - cw / 2, cy - S * 0.12);
      g.lineTo(bx - cw / 4, cy - S * 0.05);
      g.lineTo(bx, cy - S * 0.16);
      g.lineTo(bx + cw / 4, cy - S * 0.05);
      g.lineTo(bx + cw / 2, cy - S * 0.12);
      g.lineTo(bx + cw / 2, cy);
      g.closePath();
      g.fill();
      g.stroke();
      for (const [dx, col] of [[-0.25, '#ff3a6a'], [0, '#3ad0ff'], [0.25, '#3ae07a']] as const) {
        g.fillStyle = col;
        g.beginPath();
        g.arc(bx + dx * cw, cy - S * 0.04, S * 0.018, 0, Math.PI * 2);
        g.fill();
      }
    }
    if (id === 'ninja') {
      const hy = by - H * 0.27;
      g.fillStyle = '#e8303a';
      g.beginPath();
      g.roundRect(bx - W * 0.47, hy - S * 0.035, W * 0.94, S * 0.07, S * 0.03);
      g.fill();
      for (const k of [0, 1]) {
        const wave = Math.sin(this.t * 9 + k) * S * 0.03;
        g.beginPath();
        g.moveTo(bx + W * 0.45, hy);
        g.quadraticCurveTo(bx + W * 0.65, hy + wave, bx + W * 0.8, hy + S * (0.05 + k * 0.06) + wave);
        g.lineTo(bx + W * 0.76, hy + S * (0.09 + k * 0.06) + wave);
        g.quadraticCurveTo(bx + W * 0.6, hy + S * 0.05, bx + W * 0.45, hy + S * 0.03);
        g.fill();
      }
      g.fillStyle = '#f4f4f4';
      g.beginPath();
      g.roundRect(bx - S * 0.03, hy - S * 0.025, S * 0.06, S * 0.05, S * 0.01);
      g.fill();
    }
    if (id === 'frost') {
      g.strokeStyle = '#5ab8ff';
      g.lineWidth = S * 0.03;
      g.beginPath();
      g.arc(bx, by - H * 0.05, W * 0.5, Math.PI * 1.1, Math.PI * 1.9);
      g.stroke();
      for (const s of [-1, 1]) {
        g.fillStyle = '#f4fbff';
        g.beginPath();
        g.arc(bx + s * W * 0.48, by - H * 0.08, S * 0.07, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#9ad8ff';
        g.lineWidth = S * 0.015;
        g.stroke();
      }
    }
    if (id === 'astro') {
      g.fillStyle = 'rgba(200,230,255,0.16)';
      g.strokeStyle = 'rgba(220,240,255,0.85)';
      g.lineWidth = S * 0.02;
      g.beginPath();
      g.ellipse(bx, by - H * 0.12, W * 0.62, H * 0.5, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.beginPath();
      g.ellipse(bx - W * 0.3, by - H * 0.38, W * 0.08, H * 0.12, -0.5, 0, Math.PI * 2);
      g.fill();
    }
  }

  /** Candy Sprout: sprinkles all over and a swirly lollipop where the leaf would be. */
  private candy(g: CanvasRenderingContext2D, bx: number, by: number, W: number, H: number, S: number): void {
    const sprinkles: [number, number, number, string][] = [
      [-0.3, 0.12, 0.6, '#ffffff'], [0.28, 0.1, -0.4, '#7ae0ff'], [-0.12, 0.3, 1.2, '#ffe14a'],
      [0.16, 0.32, 0.3, '#ffffff'], [-0.34, -0.3, -0.9, '#7ae0ff'], [0.33, -0.28, 0.8, '#ffe14a'], [0.02, -0.4, 0.1, '#ffffff'],
    ];
    for (const [dx, dy, rot, col] of sprinkles) {
      g.save();
      g.translate(bx + dx * W, by + dy * H);
      g.rotate(rot);
      g.fillStyle = col;
      g.beginPath();
      g.roundRect(-S * 0.025, -S * 0.009, S * 0.05, S * 0.018, S * 0.009);
      g.fill();
      g.restore();
    }
    const top = by - H / 2;
    g.save();
    g.translate(bx + S * 0.02, top + S * 0.02);
    g.rotate(this.leaf * 0.6 + 0.12);
    g.strokeStyle = '#f4f0f8';
    g.lineWidth = S * 0.024;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(0, -S * 0.15);
    g.stroke();
    const r = S * 0.085;
    g.translate(0, -S * 0.15 - r * 0.8);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fill();
    g.rotate(this.t * 1.5);
    g.strokeStyle = '#ff4aa0';
    g.lineWidth = r * 0.28;
    g.beginPath();
    for (let a = 0; a < Math.PI * 5; a += 0.2) {
      const rr = (a / (Math.PI * 5)) * r * 0.85;
      if (a === 0) g.moveTo(0, 0);
      else g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.stroke();
    g.rotate(-this.t * 1.5);
    g.strokeStyle = '#a8286a';
    g.lineWidth = S * 0.012;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  }

  /** Robo Sprout: one of Grimgear's robots that switched sides. */
  private robo(g: CanvasRenderingContext2D, bx: number, by: number, W: number, H: number, S: number): void {
    const top = by - H / 2;
    // Panel seam and rivets.
    g.strokeStyle = 'rgba(40,52,70,0.45)';
    g.lineWidth = S * 0.012;
    g.beginPath();
    g.moveTo(bx - W * 0.4, by - H * 0.3);
    g.quadraticCurveTo(bx, by - H * 0.38, bx + W * 0.4, by - H * 0.3);
    g.stroke();
    for (const k of [-0.24, 0, 0.24]) {
      g.fillStyle = '#c8d4e4';
      g.beginPath();
      g.arc(bx + k * W, by - H * 0.34 - (k === 0 ? S * 0.012 : 0), S * 0.013, 0, Math.PI * 2);
      g.fill();
    }
    // Bolts on the sides.
    for (const s of [-1, 1]) {
      g.fillStyle = '#5a6a80';
      g.strokeStyle = '#2a3444';
      g.lineWidth = S * 0.012;
      g.beginPath();
      g.roundRect(bx + s * W * 0.5 - S * 0.03, by - H * 0.12, S * 0.06, S * 0.09, S * 0.015);
      g.fill();
      g.stroke();
    }
    // Chest screen with a beating heart: proof he's on our side now.
    const pw = W * 0.42;
    const ph = H * 0.19;
    const py = by + H * 0.26;
    g.fillStyle = '#16222e';
    g.strokeStyle = '#3a4a5e';
    g.lineWidth = S * 0.014;
    g.beginPath();
    g.roundRect(bx - pw / 2, py - ph / 2, pw, ph, S * 0.03);
    g.fill();
    g.stroke();
    const beat = 1 + Math.max(0, Math.sin(this.t * 6)) ** 4 * 0.25;
    const hs = S * 0.032 * beat;
    g.save();
    g.translate(bx, py + hs * 0.1);
    g.fillStyle = '#ff5a8a';
    g.shadowColor = '#ff5a8a';
    g.shadowBlur = S * 0.05;
    g.beginPath();
    g.moveTo(0, hs * 0.9);
    g.bezierCurveTo(-hs * 1.6, -hs * 0.2, -hs * 0.7, -hs * 1.3, 0, -hs * 0.45);
    g.bezierCurveTo(hs * 0.7, -hs * 1.3, hs * 1.6, -hs * 0.2, 0, hs * 0.9);
    g.fill();
    g.restore();
    // Antenna with a blinking bulb, wobbling like a leaf.
    g.save();
    g.translate(bx, top + S * 0.01);
    g.rotate(this.leaf * 0.8);
    g.strokeStyle = '#3a4658';
    g.lineWidth = S * 0.022;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(0, -S * 0.15);
    g.stroke();
    const on = Math.floor(this.t * 2.5) % 2 === 0;
    g.fillStyle = on ? '#4affb0' : '#1a9a6a';
    g.shadowColor = '#4affb0';
    g.shadowBlur = on ? S * 0.08 : 0;
    g.beginPath();
    g.arc(0, -S * 0.17, S * 0.04, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  /** Cozy Sprout: a knitted bobble hat for cold days. */
  private beanie(g: CanvasRenderingContext2D, bx: number, by: number, W: number, H: number, S: number): void {
    const top = by - H / 2;
    const band = by - H * 0.3;
    g.fillStyle = '#e8343e';
    g.strokeStyle = '#8a1420';
    g.lineWidth = S * 0.016;
    g.beginPath();
    g.moveTo(bx - W * 0.46, band);
    g.bezierCurveTo(bx - W * 0.46, top - S * 0.06, bx + W * 0.46, top - S * 0.06, bx + W * 0.46, band);
    g.closePath();
    g.fill();
    g.stroke();
    // Knit ribs.
    g.strokeStyle = 'rgba(120,10,24,0.35)';
    g.lineWidth = S * 0.01;
    for (const k of [-0.24, 0, 0.24]) {
      g.beginPath();
      g.moveTo(bx + k * W, band);
      g.quadraticCurveTo(bx + k * W * 0.7, top + S * 0.02, bx + k * W * 0.3, top - S * 0.02);
      g.stroke();
    }
    g.fillStyle = '#f8f4ec';
    g.strokeStyle = '#b8b0a0';
    g.lineWidth = S * 0.012;
    g.beginPath();
    g.roundRect(bx - W * 0.5, band - S * 0.05, W, S * 0.09, S * 0.04);
    g.fill();
    g.stroke();
    // Pompom bounces a little behind the hop.
    const bob = Math.sin(this.t * 4) * S * 0.008 - this.y * S * 0.04;
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(bx + this.leaf * S * 0.2, top - S * 0.06 + bob, S * 0.065, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }

  private neckwear(g: CanvasRenderingContext2D, bx: number, by: number, W: number, H: number, S: number): void {
    const id = this.skin.id;
    if (id !== 'classic' && id !== 'frost' && id !== 'cozy') return;
    const col = id === 'classic' ? '#ff4a4a' : id === 'cozy' ? '#3fae5a' : '#f4fbff';
    const shade = id === 'classic' ? '#b81e2a' : id === 'cozy' ? '#1f7a3a' : '#9ad0ef';
    const ny = by + H * 0.22;
    g.fillStyle = col;
    g.strokeStyle = shade;
    g.lineWidth = S * 0.015;
    g.beginPath();
    g.moveTo(bx - W * 0.46, ny - S * 0.03);
    g.quadraticCurveTo(bx, ny + S * 0.05, bx + W * 0.46, ny - S * 0.03);
    g.lineTo(bx + W * 0.44, ny + S * 0.04);
    g.quadraticCurveTo(bx, ny + S * 0.12, bx - W * 0.44, ny + S * 0.04);
    g.closePath();
    g.fill();
    g.stroke();
    // Knot and a tail that flaps when he moves.
    const flap = Math.sin(this.t * 7) * S * 0.02 + this.vy * S * 0.03;
    g.beginPath();
    g.moveTo(bx + W * 0.18, ny + S * 0.06);
    g.quadraticCurveTo(bx + W * 0.34, ny + S * 0.16 + flap, bx + W * 0.28, ny + S * 0.24 + flap);
    g.lineTo(bx + W * 0.16, ny + S * 0.2 + flap);
    g.quadraticCurveTo(bx + W * 0.2, ny + S * 0.12, bx + W * 0.1, ny + S * 0.07);
    g.closePath();
    g.fill();
    g.stroke();
    g.beginPath();
    g.arc(bx + W * 0.15, ny + S * 0.065, S * 0.035, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }

  private cape(g: CanvasRenderingContext2D, bx: number, by: number, W: number, H: number, S: number): void {
    const flap = Math.sin(this.t * 3) * S * 0.04;
    g.fillStyle = '#c81e3a';
    g.strokeStyle = '#7a0a1e';
    g.lineWidth = S * 0.015;
    g.beginPath();
    g.moveTo(bx - W * 0.35, by - H * 0.05);
    g.quadraticCurveTo(bx - W * 0.7 - flap, by + H * 0.3, bx - W * 0.6, by + H * 0.55);
    g.lineTo(bx + W * 0.6, by + H * 0.55);
    g.quadraticCurveTo(bx + W * 0.7 + flap, by + H * 0.3, bx + W * 0.35, by - H * 0.05);
    g.closePath();
    g.fill();
    g.stroke();
  }
}

/** Rounded speech bubble with a tail pointing down-left to the speaker. */
export function speechBubble(g: CanvasRenderingContext2D, x: number, y: number, text: string, fontPx: number, alpha = 1): void {
  if (alpha <= 0) return;
  g.save();
  g.globalAlpha = Math.max(0, Math.min(1, alpha));
  g.font = `800 ${fontPx}px Nunito, system-ui, sans-serif`;
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  const maxW = fontPx * 10;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  lines.push(line);
  const tw = Math.max(...lines.map((l) => g.measureText(l).width));
  const pad = fontPx * 0.6;
  const bw = tw + pad * 2;
  const bh = lines.length * fontPx * 1.2 + pad * 1.4;
  // Keep the bubble on the canvas; the tail still points at the speaker.
  const t = g.getTransform();
  const viewW = g.canvas.width / (t.a || 1) - t.e / (t.a || 1);
  const left = Math.max(4 - t.e / (t.a || 1), Math.min(x - bw * 0.2, viewW - bw - 4));
  const topY = Math.max(4 - t.f / (t.d || 1), y - bh);
  y = topY + bh;
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#1c1430';
  g.lineWidth = Math.max(1.5, fontPx * 0.12);
  g.beginPath();
  g.roundRect(left, topY, bw, bh, fontPx * 0.7);
  const tx = Math.max(left + fontPx, Math.min(x, left + bw - fontPx));
  g.moveTo(tx - fontPx * 0.4, y - 1);
  g.lineTo(tx - fontPx * 0.9, y + fontPx * 0.8);
  g.lineTo(tx + fontPx * 0.4, y - 1);
  g.fill();
  g.stroke();
  g.fillStyle = '#ffffff';
  g.fillRect(tx - fontPx * 0.35, y - g.lineWidth * 1.5, fontPx * 0.7, g.lineWidth * 2);
  g.fillStyle = '#1c1430';
  g.textBaseline = 'top';
  g.textAlign = 'left';
  lines.forEach((l, i) => g.fillText(l, left + pad, topY + pad * 0.7 + i * fontPx * 1.2));
  g.restore();
}
