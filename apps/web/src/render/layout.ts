// Screen layouts in "layout units"; the renderer scales them to the real canvas.

export interface Box {
  x: number;
  y: number;
  cell: number;
}

export interface Layout {
  mode: 'landscape' | 'portrait';
  vw: number;
  vh: number;
  boards: Box[];
  next: (Box | null)[];
  /** Where the hero stands (feet) and his body height. */
  hero: { x: number; y: number; size: number };
  /** Opponent card: top-left and size. */
  foe: { x: number; y: number; size: number };
  /** Name + score blocks per board. */
  panels: { x: number; y: number; w: number }[];
  info: { x: number; y: number };
}

export function computeLayout(w: number, h: number, boards: number): Layout {
  const landscape = w >= h * 0.95;
  if (landscape) {
    const vw = 1280;
    const vh = 720;
    if (boards === 1) {
      return {
        mode: 'landscape',
        vw,
        vh,
        boards: [{ x: 490, y: 100, cell: 50 }],
        next: [{ x: 830, y: 120, cell: 48 }],
        hero: { x: 330, y: 650, size: 170 },
        foe: { x: 1060, y: 460, size: 170 },
        panels: [{ x: 830, y: 300, w: 230 }],
        info: { x: 945, y: 560 },
      };
    }
    return {
      mode: 'landscape',
      vw,
      vh,
      boards: [
        { x: 250, y: 100, cell: 50 },
        { x: 730, y: 100, cell: 50 },
      ],
      next: [
        { x: 568, y: 120, cell: 44 },
        { x: 650, y: 120, cell: 44 },
      ],
      hero: { x: 128, y: 660, size: 150 },
      foe: { x: 1052, y: 470, size: 170 },
      panels: [
        { x: 562, y: 290, w: 156 },
        { x: 562, y: 380, w: 156 },
      ],
      info: { x: 640, y: 520 },
    };
  }
  const vw = 720;
  const vh = 1280;
  if (boards === 1) {
    return {
      mode: 'portrait',
      vw,
      vh,
      boards: [{ x: 24, y: 200, cell: 64 }],
      next: [{ x: 470, y: 200, cell: 58 }],
      hero: { x: 150, y: 1235, size: 165 },
      foe: { x: 520, y: 760, size: 150 },
      panels: [{ x: 452, y: 400, w: 240 }],
      info: { x: 572, y: 640 },
    };
  }
  return {
    mode: 'portrait',
    vw,
    vh,
    boards: [
      { x: 24, y: 200, cell: 64 },
      { x: 466, y: 500, cell: 38 },
    ],
    next: [{ x: 452, y: 200, cell: 52 }, null],
    hero: { x: 150, y: 1235, size: 165 },
    foe: { x: 560, y: 200, size: 136 },
    panels: [
      { x: 330, y: 1010, w: 366 },
      { x: 466, y: 386, w: 228 },
    ],
    info: { x: 360, y: 70 },
  };
}
