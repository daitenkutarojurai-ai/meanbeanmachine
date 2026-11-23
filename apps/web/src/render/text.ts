export const DISPLAY = '"Lilita One", "Arial Rounded MT Bold", system-ui, sans-serif';
export const BODY = 'Nunito, system-ui, sans-serif';

export interface TextStyle {
  size: number;
  color?: string;
  stroke?: string | null;
  font?: string;
  weight?: number | string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
}

/** Chunky outlined game text. */
export function text(g: CanvasRenderingContext2D, str: string, x: number, y: number, s: TextStyle): void {
  g.font = `${s.weight ?? 400} ${s.size}px ${s.font ?? DISPLAY}`;
  g.textAlign = s.align ?? 'center';
  g.textBaseline = s.baseline ?? 'middle';
  g.lineJoin = 'round';
  if (s.stroke !== null) {
    g.strokeStyle = s.stroke ?? '#1a1230';
    g.lineWidth = s.size * 0.18;
    g.strokeText(str, x, y);
  }
  g.fillStyle = s.color ?? '#ffffff';
  g.fillText(str, x, y);
}

/** Big banner text: two-tone vertical gradient, thick outline, drop shadow. */
export function gradientText(g: CanvasRenderingContext2D, str: string, x: number, y: number, size: number, top: string, bottom: string, font = DISPLAY): void {
  g.font = `400 ${size}px ${font}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = size * 0.22;
  g.strokeText(str, x, y + size * 0.08);
  g.strokeStyle = '#1a1230';
  g.lineWidth = size * 0.2;
  g.strokeText(str, x, y);
  const grad = g.createLinearGradient(0, y - size * 0.45, 0, y + size * 0.45);
  grad.addColorStop(0, top);
  grad.addColorStop(0.5, top);
  grad.addColorStop(0.52, bottom);
  grad.addColorStop(1, bottom);
  g.fillStyle = grad;
  g.fillText(str, x, y);
}
