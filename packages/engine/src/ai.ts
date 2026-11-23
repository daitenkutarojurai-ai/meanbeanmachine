import { COLS, DEATH_X, DEATH_Y, EMPTY, ROT_DX, ROT_DY, ROWS, SPAWN_Y, VISIBLE_TOP } from './constants.ts';
import { columnHeight, type Field, findGroups, idx, isColor, resolveChain } from './field.ts';
import { IN_CCW, IN_CW, IN_DOWN, IN_LEFT, IN_RIGHT, Phase, type PlayerSim } from './player.ts';
import { Rng } from './rng.ts';

/** How a computer opponent thinks and plays. */
export interface AiProfile {
  /** Frames to wait after a pair appears before acting. */
  thinkFrames: number;
  /** Frames between button taps. */
  tapInterval: number;
  /** Hold down once lined up. */
  softDrop: boolean;
  /** Also consider the NEXT pair when choosing. */
  lookahead: boolean;
  /** Smallest chain worth firing when not in danger. */
  chainTarget: number;
  /** Chance per pair of picking a weaker placement. */
  mistakeRate: number;
  /** Random jitter added to every evaluation. */
  noise: number;
  /** Weight on building future chains versus keeping the board tidy. */
  ambition: number;
}

export const AI_PRESETS: Record<string, AiProfile> = {
  rookie: { thinkFrames: 40, tapInterval: 10, softDrop: false, lookahead: false, chainTarget: 1, mistakeRate: 0.3, noise: 60, ambition: 0.3 },
  easy: { thinkFrames: 30, tapInterval: 8, softDrop: false, lookahead: false, chainTarget: 2, mistakeRate: 0.18, noise: 40, ambition: 0.6 },
  normal: { thinkFrames: 20, tapInterval: 6, softDrop: true, lookahead: false, chainTarget: 3, mistakeRate: 0.1, noise: 25, ambition: 1 },
  hard: { thinkFrames: 12, tapInterval: 4, softDrop: true, lookahead: true, chainTarget: 4, mistakeRate: 0.05, noise: 12, ambition: 1.3 },
  expert: { thinkFrames: 6, tapInterval: 3, softDrop: true, lookahead: true, chainTarget: 5, mistakeRate: 0.02, noise: 5, ambition: 1.6 },
};

export interface Placement {
  x: number;
  rot: number;
}

const PLACEMENTS: Placement[] = (() => {
  const out: Placement[] = [];
  for (let rot = 0; rot < 4; rot++)
    for (let x = 0; x < COLS; x++) {
      const cx = x + ROT_DX[rot];
      if (cx >= 0 && cx < COLS) out.push({ x, rot });
    }
  return out;
})();

/** Columns the pair can slide through from the spawn point without hitting a stack. */
function reachable(field: Field, p: Placement): boolean {
  const lo = Math.min(p.x, p.x + ROT_DX[p.rot], 2);
  const hi = Math.max(p.x, p.x + ROT_DX[p.rot], 2);
  for (let x = lo; x <= hi; x++) if (field[idx(x, SPAWN_Y)] !== EMPTY) return false;
  return true;
}

/** Drops a pair straight down; returns false if a bean would land above the hidden row. */
function dropPair(field: Field, p: Placement, pivot: number, child: number): boolean {
  const drop = (x: number, cell: number): boolean => {
    for (let y = ROWS - 1; y >= 1; y--) {
      if (field[idx(x, y)] === EMPTY) {
        field[idx(x, y)] = cell;
        return true;
      }
    }
    return false;
  };
  if (ROT_DY[p.rot] === 1) return drop(p.x, child) && drop(p.x, pivot);
  if (ROT_DY[p.rot] === -1) return drop(p.x, pivot) && drop(p.x, child);
  return drop(p.x, pivot) && drop(p.x + ROT_DX[p.rot], child);
}

interface Outcome {
  field: Field;
  chain: number;
  points: number;
  dead: boolean;
}

function simulate(field: Field, p: Placement, pivot: number, child: number): Outcome | null {
  if (!reachable(field, p)) return null;
  const f = field.slice();
  if (!dropPair(f, p, pivot, child)) return null;
  const r = resolveChain(f);
  return { field: f, chain: r.chain, points: r.points, dead: f[idx(DEATH_X, DEATH_Y)] !== EMPTY };
}

/** Tidiness: reward same-colour neighbours, punish height near the spawn column. */
function shape(field: Field): number {
  let v = 0;
  for (const g of findGroups(field, 2)) v += g.cells.length === 2 ? 6 : 18;
  let total = 0;
  let bump = 0;
  let prev = -1;
  for (let x = 0; x < COLS; x++) {
    const h = columnHeight(field, x);
    total += h;
    if (prev >= 0) bump += Math.abs(h - prev);
    prev = h;
    const danger = x === 2 ? 7 : x === 1 || x === 3 ? 9 : 10;
    if (h > danger) v -= (h - danger) * (x === 2 ? 220 : 80);
  }
  return v - total * 1.5 - bump * 3;
}

/** Biggest chain reachable by adding two beans of one colour to one column. */
function potential(field: Field): number {
  let best = 0;
  const colors = new Set<number>();
  for (let i = VISIBLE_TOP * COLS; i < field.length; i++) if (isColor(field[i])) colors.add(field[i]);
  for (const c of colors)
    for (let x = 0; x < COLS; x++) {
      const f = field.slice();
      if (!dropPair(f, { x, rot: 0 }, c, c)) continue;
      const r = resolveChain(f);
      if (r.chain > best) best = r.chain;
    }
  return best;
}

function inDanger(field: Field, pending: number): boolean {
  return columnHeight(field, 2) >= 8 || Math.max(...[0, 1, 3, 4, 5].map((x) => columnHeight(field, x))) >= 11 || pending >= 6;
}

export function choosePlacement(
  sim: PlayerSim,
  pair: [number, number],
  next: [number, number] | null,
  profile: AiProfile,
  rng: Rng,
  opponentPending = 0,
): Placement {
  const field = sim.field;
  const danger = inDanger(field, sim.pending);
  const scored: { p: Placement; v: number }[] = [];
  for (const p of PLACEMENTS) {
    const o = simulate(field, p, pair[0], pair[1]);
    if (!o) continue;
    let v = 0;
    if (o.dead) v -= 100000;
    if (o.chain > 0) {
      const fire = o.chain >= profile.chainTarget || danger || (opponentPending === 0 && o.chain >= profile.chainTarget - 1 && sim.pending > 0);
      v += fire ? 2000 * o.chain + o.points / 20 : o.points / 200 - (profile.chainTarget - o.chain) * 150;
    }
    let future = shape(o.field) + profile.ambition * 120 * potential(o.field);
    if (profile.lookahead && next && !o.dead) {
      let best2 = -Infinity;
      for (const p2 of PLACEMENTS) {
        const o2 = simulate(o.field, p2, next[0], next[1]);
        if (!o2 || o2.dead) continue;
        const v2 = (o2.chain >= profile.chainTarget ? 1500 * o2.chain : 0) + shape(o2.field);
        if (v2 > best2) best2 = v2;
      }
      if (best2 > -Infinity) future = Math.max(future, best2 * 0.9);
    }
    v += future + (rng.next() / 0xffff) * profile.noise;
    scored.push({ p, v });
  }
  if (!scored.length) return { x: 2, rot: 0 };
  scored.sort((a, b) => b.v - a.v);
  if (scored.length > 1 && rng.next() / 0xffff < profile.mistakeRate) {
    return scored[1 + rng.bound(Math.min(4, scored.length - 1))].p;
  }
  return scored[0].p;
}

/** Turns a chosen placement into button presses through the same input path as a human. */
export class AiController {
  profile: AiProfile;
  private rng: Rng;
  private target: Placement | null = null;
  private pieceKey = -1;
  private wait = 0;
  private lastTap = false;
  private stuck = 0;

  constructor(profile: AiProfile, seed: number) {
    this.profile = profile;
    this.rng = new Rng(seed);
  }

  input(sim: PlayerSim, opponent?: PlayerSim): number {
    const p = sim.piece;
    if (sim.phase !== Phase.Control || !p) {
      this.target = null;
      return 0;
    }
    if (this.pieceKey !== sim.piecesPlaced || !this.target) {
      this.pieceKey = sim.piecesPlaced;
      const upcoming = sim.upcoming(1);
      this.target = choosePlacement(
        sim,
        [p.pivot, p.child],
        this.profile.lookahead ? upcoming[0] ?? null : null,
        this.profile,
        this.rng,
        opponent?.pending ?? 0,
      );
      this.wait = this.profile.thinkFrames;
      this.stuck = 0;
      this.lastTap = false;
    }
    if (this.wait > 0) {
      this.wait--;
      return 0;
    }
    const t = this.target!;
    if (this.lastTap) {
      // Release so the next tap registers as a fresh press.
      this.lastTap = false;
      this.wait = Math.max(0, this.profile.tapInterval - 1);
      return 0;
    }
    // A blocked rotation or move would otherwise be retried forever.
    if (this.stuck < 10) {
      if (p.rot !== t.rot) {
        this.lastTap = true;
        this.stuck++;
        return ((t.rot - p.rot) & 3) === 3 ? IN_CCW : IN_CW;
      }
      if (p.x !== t.x) {
        this.lastTap = true;
        this.stuck++;
        return p.x < t.x ? IN_RIGHT : IN_LEFT;
      }
    }
    return this.profile.softDrop ? IN_DOWN : 0;
  }
}
