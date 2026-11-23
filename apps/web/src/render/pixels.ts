export type Ctx = CanvasRenderingContext2D;

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function ctx2d(c: HTMLCanvasElement): Ctx {
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  return g;
}

export function rect(g: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  g.fillStyle = color;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** Pixel-exact filled ellipse (no anti-aliasing). */
export function ellipse(g: Ctx, cx: number, cy: number, rx: number, ry: number, color: string): void {
  g.fillStyle = color;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    const dy = (y + 0.5 - cy) / ry;
    if (Math.abs(dy) > 1) continue;
    const half = rx * Math.sqrt(1 - dy * dy);
    const x0 = Math.round(cx - half);
    const x1 = Math.round(cx + half);
    if (x1 > x0) g.fillRect(x0, y, x1 - x0, 1);
  }
}

/** Ellipse with a 1px darker rim. */
export function ellipseOutlined(g: Ctx, cx: number, cy: number, rx: number, ry: number, fill: string, rim: string): void {
  ellipse(g, cx, cy, rx + 1, ry + 1, rim);
  ellipse(g, cx, cy, rx, ry, fill);
}

export function rectOutlined(g: Ctx, x: number, y: number, w: number, h: number, fill: string, rim: string): void {
  rect(g, x - 1, y - 1, w + 2, h + 2, rim);
  rect(g, x, y, w, h, fill);
}

export function triangle(g: Ctx, ax: number, ay: number, bx: number, by: number, cx: number, cy: number, color: string): void {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(ax, ay);
  g.lineTo(bx, by);
  g.lineTo(cx, cy);
  g.closePath();
  g.fill();
}

export function line(g: Ctx, x0: number, y0: number, x1: number, y1: number, color: string, w = 1): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  g.fillStyle = color;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    g.fillRect(Math.round(x0 + (x1 - x0) * t - (w - 1) / 2), Math.round(y0 + (y1 - y0) * t - (w - 1) / 2), w, w);
  }
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const c = (x: number, y: number): number => Math.round(x + (y - x) * t);
  return `rgb(${c(ar, br)},${c(ag, bg)},${c(ab, bb)})`;
}
