export type Ctx = CanvasRenderingContext2D;

/** Shape helpers draw with smooth vector paths; portraits scale them up for any size. */
let outline = 1;

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function ctx2d(c: HTMLCanvasElement): Ctx {
  return c.getContext('2d')!;
}

/** Rim thickness used by the *Outlined helpers, in drawing units. */
export function setOutline(w: number): void {
  outline = w;
}

export function rect(g: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
}

export function ellipse(g: Ctx, cx: number, cy: number, rx: number, ry: number, color: string): void {
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  g.fill();
}

export function ellipseOutlined(g: Ctx, cx: number, cy: number, rx: number, ry: number, fill: string, rim: string): void {
  ellipse(g, cx, cy, rx + outline, ry + outline, rim);
  ellipse(g, cx, cy, rx, ry, fill);
}

export function rectOutlined(g: Ctx, x: number, y: number, w: number, h: number, fill: string, rim: string): void {
  g.fillStyle = rim;
  g.beginPath();
  g.roundRect(x - outline, y - outline, w + outline * 2, h + outline * 2, Math.min(w, h) * 0.18 + outline);
  g.fill();
  g.fillStyle = fill;
  g.beginPath();
  g.roundRect(x, y, w, h, Math.min(w, h) * 0.18);
  g.fill();
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
  g.strokeStyle = color;
  g.lineWidth = w;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
}
