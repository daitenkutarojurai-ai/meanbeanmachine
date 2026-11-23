import {
  CELL_PX,
  COLS,
  DEATH_X,
  DEATH_Y,
  EMPTY,
  FALL_ACCEL,
  FALL_MAX_VEL,
  FALL_START_VEL,
  FAST_SPEED_THRESHOLD,
  GARBAGE,
  GARBAGE_ACC_MAX,
  GARBAGE_COLUMN_ACCEL,
  LOCK_FRAMES,
  MAX_GARBAGE_PER_DROP,
  MAX_LANDINGS,
  MAX_SCORE,
  POP_FLASH_FRAMES,
  POP_WAIT_FRAMES,
  REPEAT_DELAY,
  REPEAT_RATE,
  ROT_DX,
  ROT_DY,
  SOFT_DROP_SPEED,
  SPAWN_X,
  SPAWN_Y,
  TARGET_POINTS,
} from './constants.ts';
import {
  adjacentGarbage,
  colOf,
  countBeans,
  createField,
  type Field,
  findGroups,
  freeCells,
  idx,
  isFree,
  rowOf,
  scoreStep,
  settle,
  type StepScore,
} from './field.ts';
import { EXERCISE_COLOR_ORDER, PairQueue } from './pieces.ts';
import { Rng } from './rng.ts';
import { POST_LOCK_DELAY, type SpeedRule, speedEntry } from './speed.ts';

export const IN_LEFT = 1;
export const IN_RIGHT = 2;
export const IN_DOWN = 4;
export const IN_UP = 8;
export const IN_CW = 16;
export const IN_CCW = 32;

export const Phase = {
  Idle: 0,
  Garbage: 1,
  Spawn: 2,
  Control: 3,
  Settle: 4,
  Check: 5,
  Flash: 6,
  PopWait: 7,
  PostDelay: 8,
  Dead: 9,
} as const;
export type Phase = (typeof Phase)[keyof typeof Phase];

/** Frames a bean squashes after landing before it counts as placed (anim unk_4ED4). */
export const SQUASH_FRAMES = 14;

export interface Piece {
  x: number;
  y: number;
  rot: number;
  /** 16-bit fall accumulator; >= 0x8000 means the pair is drawn flush with its row. */
  sub: number;
  pivot: number;
  child: number;
  lockTimer: number;
  landings: number;
  /** Pixel offset of the sideways slide animation. */
  slide: number;
  /** Previous rotation and frames left of the rotate animation. */
  rotFrom: number;
  rotAnim: number;
  /** Frames since the last landing bounce, for the renderer. */
  bounce: number;
}

export interface Faller {
  x: number;
  toY: number;
  cell: number;
  /** Top of the bean in 1/65536 px from the top of row 0. */
  pos: number;
  vel: number;
  accel: number;
  landed: boolean;
  squash: number;
}

export type SimEvent =
  | { type: 'spawn' }
  | { type: 'move' }
  | { type: 'rotate' }
  | { type: 'land' }
  | { type: 'lock' }
  | { type: 'pop'; chain: number; score: StepScore; cells: { x: number; y: number; color: number }[] }
  | { type: 'popped'; chain: number }
  | { type: 'chainEnd'; chain: number; garbage: number }
  | { type: 'garbageDrop'; count: number }
  | { type: 'levelUp'; speed: number }
  | { type: 'allClear'; bonus: number }
  | { type: 'dead' };

export type PlayerMode = 'versus' | 'scenario' | 'exercise';

export interface PlayerConfig {
  mode: PlayerMode;
  /** Pair list to draw from (ignored in exercise). */
  pairs?: Uint8Array;
  speed: SpeedRule;
  /** VS handicap level 0..4, or exercise start level. Picks the post-lock pause. */
  level: number;
  /** Seed for this player's own randomness: refugee columns, exercise beans. */
  seed: number;
  startGarbage?: number;
  /** Initial velocity of dropped refugee beans in px/frame (3 on scenario Hardest). */
  garbageStartVel?: number;
  startScore?: number;
}

export class PlayerSim {
  readonly field: Field = createField();
  phase: Phase = Phase.Idle;
  frame = 0;
  timer = 0;
  piece: Piece | null = null;
  fallers: Faller[] = [];
  readonly events: SimEvent[] = [];

  score = 0;
  /** Points earned since refugees were last sent; 70 points buy one refugee bean. */
  garbageAcc = 0;
  /** Refugee beans waiting to drop on this player. */
  pending = 0;
  chain = 0;
  maxChain = 0;
  totalCleared = 0;
  piecesPlaced = 0;
  levelups = 0;
  clearedSinceLevel = 0;
  exerciseLevel = 0;
  speed = 0;
  threshold = 0;

  popping: number[] = [];
  lastStep: StepScore | null = null;

  private readonly queue: PairQueue | null;
  private readonly rng: Rng;
  private readonly cfg: PlayerConfig;
  private nextPairs: [number, number][] = [];
  private prevHeld = 0;
  private hDirs = 0;
  private hTimer = 0;
  private afterSettle: Phase = Phase.Check;

  constructor(cfg: PlayerConfig) {
    this.cfg = cfg;
    this.rng = new Rng(cfg.seed);
    this.queue = cfg.mode === 'exercise' || !cfg.pairs ? null : new PairQueue(cfg.pairs);
    this.exerciseLevel = cfg.mode === 'exercise' ? cfg.level : 0;
    this.score = cfg.startScore ?? 0;
    this.pending = cfg.startGarbage ?? 0;
    for (let i = 0; i < 2; i++) this.nextPairs.push(this.drawPair());
    this.applySpeed();
  }

  get mode(): PlayerMode {
    return this.cfg.mode;
  }

  get alive(): boolean {
    return this.phase !== Phase.Dead;
  }

  /** The pair shown in the NEXT window. */
  get nextPair(): [number, number] {
    return this.nextPairs[0];
  }

  /** Upcoming pairs for the AI (index 0 = next). */
  upcoming(n: number): [number, number][] {
    const out = this.nextPairs.slice(0, n);
    if (this.queue) for (let k = out.length; k < n; k++) out.push(this.queue.peek(k - this.nextPairs.length));
    return out;
  }

  start(): void {
    if (this.phase !== Phase.Idle) return;
    this.beginTurn();
  }

  receiveGarbage(amount: number): void {
    if (amount > 0 && this.alive) this.pending = Math.min(0xffff, this.pending + amount);
  }

  /** Advance one frame with the given held-button mask. */
  step(held: number): void {
    if (this.phase === Phase.Idle || this.phase === Phase.Dead) {
      this.prevHeld = held;
      return;
    }
    this.frame++;
    const pressed = held & ~this.prevHeld;
    const repeat = this.updateRepeat(held);
    this.prevHeld = held;

    switch (this.phase) {
      case Phase.Garbage:
        if (this.stepFallers()) this.phase = Phase.Spawn;
        break;
      case Phase.Spawn:
        this.spawn();
        break;
      case Phase.Control:
        this.control(held, pressed, repeat);
        break;
      case Phase.Settle:
        if (this.stepFallers()) this.phase = this.afterSettle;
        if (this.phase === Phase.Check) this.check();
        break;
      case Phase.Check:
        this.check();
        break;
      case Phase.Flash:
        if (--this.timer <= 0) this.pop();
        break;
      case Phase.PopWait:
        if (--this.timer <= 0) this.dropAfterPop();
        break;
      case Phase.PostDelay:
        if (--this.timer <= 0) this.endTurn();
        break;
    }
  }

  // ---------------------------------------------------------------- turn flow

  private beginTurn(): void {
    this.chain = 0;
    if (this.pending > 0 && this.dropGarbage()) this.phase = Phase.Garbage;
    else this.phase = Phase.Spawn;
  }

  private spawn(): void {
    if (this.field[idx(DEATH_X, DEATH_Y)] !== EMPTY) {
      this.phase = Phase.Dead;
      this.piece = null;
      this.events.push({ type: 'dead' });
      return;
    }
    const [pivot, child] = this.nextPairs.shift()!;
    this.nextPairs.push(this.drawPair());
    this.piece = {
      x: SPAWN_X,
      y: SPAWN_Y,
      rot: 0,
      sub: 0,
      pivot,
      child,
      lockTimer: 0,
      landings: 0,
      slide: 0,
      rotFrom: 0,
      rotAnim: 0,
      bounce: 99,
    };
    this.phase = Phase.Control;
    this.events.push({ type: 'spawn' });
  }

  private drawPair(): [number, number] {
    if (this.queue) return this.queue.take();
    const colors = this.exerciseLevel === 0 ? 4 : 5;
    const a = EXERCISE_COLOR_ORDER[this.rng.bound(colors)];
    const b = EXERCISE_COLOR_ORDER[this.rng.bound(colors)];
    return [a, b];
  }

  private check(): void {
    const groups = findGroups(this.field);
    if (!groups.length) {
      this.phase = Phase.PostDelay;
      this.timer = POST_LOCK_DELAY[Math.min(this.cfg.level, 4)];
      if (this.timer <= 0) this.endTurn();
      return;
    }
    const mult = this.cfg.mode === 'exercise' ? Math.min(this.exerciseLevel, 99) : 0;
    const s = scoreStep(groups, this.chain, mult);
    this.lastStep = s;
    const popping = groups.flatMap((g) => g.cells);
    this.popping = popping.concat(adjacentGarbage(this.field, popping));
    this.phase = Phase.Flash;
    this.timer = POP_FLASH_FRAMES;
    this.events.push({
      type: 'pop',
      chain: this.chain + 1,
      score: s,
      cells: popping.map((i) => ({ x: colOf(i), y: rowOf(i), color: this.field[i] })),
    });
  }

  private pop(): void {
    const s = this.lastStep!;
    for (const i of this.popping) this.field[i] = EMPTY;
    this.addPoints(s.points);
    this.totalCleared = Math.min(9999, this.totalCleared + s.cleared);
    this.clearedSinceLevel = Math.min(0xffff, this.clearedSinceLevel + s.cleared);
    this.phase = Phase.PopWait;
    this.timer = POP_WAIT_FRAMES;
    this.events.push({ type: 'popped', chain: this.chain + 1 });
  }

  private dropAfterPop(): void {
    this.popping = [];
    const moves = settle(this.field);
    this.fallers = moves.map((m) => this.makeFaller(m.x, m.fromY, m.toY, m.cell, FALL_START_VEL, FALL_ACCEL, true));
    this.afterSettle = Phase.Check;
    this.levelCheck();
    this.chain++;
    this.maxChain = Math.max(this.maxChain, this.chain);
    if (this.fallers.length) this.phase = Phase.Settle;
    else this.check();
  }

  private levelCheck(): void {
    if (this.clearedSinceLevel < this.threshold) return;
    this.clearedSinceLevel = 0;
    this.levelups = (this.levelups + 1) & 0xff;
    if (this.cfg.mode === 'exercise' && (this.levelups & 7) === 0 && this.exerciseLevel < 98) this.exerciseLevel++;
    this.applySpeed();
    this.events.push({ type: 'levelUp', speed: this.speed });
  }

  private applySpeed(): void {
    const [speed, threshold] = speedEntry(this.cfg.speed, this.levelups, this.exerciseLevel);
    this.speed = speed;
    this.threshold = threshold;
  }

  private endTurn(): void {
    if (this.chain > 0) {
      let garbage = 0;
      if (this.cfg.mode !== 'exercise') {
        garbage = Math.floor(this.garbageAcc / TARGET_POINTS);
        this.garbageAcc %= TARGET_POINTS;
      } else if (countBeans(this.field) === 0) {
        const bonus = (this.exerciseLevel + 1) * 500 + 8000;
        this.addPoints(bonus);
        this.events.push({ type: 'allClear', bonus });
      }
      this.events.push({ type: 'chainEnd', chain: this.chain, garbage });
    }
    this.beginTurn();
  }

  private addPoints(points: number): void {
    this.score = Math.min(MAX_SCORE, this.score + points);
    this.garbageAcc = Math.min(GARBAGE_ACC_MAX, this.garbageAcc + points);
  }

  // ---------------------------------------------------------------- refugees

  /** SpawnGarbage: up to 30 beans, dealt one at a time round a shuffled column order. */
  private dropGarbage(): boolean {
    const order = [0, 1, 2, 3, 4, 5];
    for (let i = 5; i >= 0; i--) {
      const j = this.rng.bound(6);
      const t = order[j];
      order[j] = order[i];
      order[i] = t;
    }
    const free = order.map(() => 0);
    for (let x = 0; x < COLS; x++) free[x] = freeCells(this.field, x);
    const counts = [0, 0, 0, 0, 0, 0];
    const n = Math.min(this.pending, MAX_GARBAGE_PER_DROP);
    let placed = 0;
    for (let k = 0, o = 0; k < n; k++) {
      const x = order[o];
      if (counts[x] < free[x]) {
        counts[x]++;
        placed++;
      }
      o = (o + 1) % 6;
    }
    this.pending -= placed;
    if (!placed) return false;

    this.fallers = [];
    const startVel = (this.cfg.garbageStartVel ?? 0) * 0x10000;
    for (let x = 0; x < COLS; x++) {
      if (!counts[x]) continue;
      // Columns are always settled, so the empty cells are rows 1..free[x].
      const top = free[x];
      for (let i = 0; i < counts[x]; i++) {
        const toY = top - i;
        this.field[idx(x, toY)] = GARBAGE;
        this.fallers.push(this.makeFaller(x, 1 - i, toY, GARBAGE, startVel, GARBAGE_COLUMN_ACCEL[x], false));
      }
    }
    this.events.push({ type: 'garbageDrop', count: placed });
    return true;
  }

  // ---------------------------------------------------------------- falling beans

  private makeFaller(
    x: number,
    fromY: number,
    toY: number,
    cell: number,
    vel: number,
    accel: number,
    squash: boolean,
  ): Faller {
    return {
      x,
      toY,
      cell,
      pos: fromY * CELL_PX * 0x10000,
      vel,
      accel,
      landed: fromY >= toY,
      squash: fromY >= toY && squash ? SQUASH_FRAMES : 0,
    };
  }

  /** Returns true once every faller has landed and finished squashing. */
  private stepFallers(): boolean {
    let busy = false;
    let landedNow = false;
    for (const f of this.fallers) {
      if (!f.landed) {
        f.pos += f.vel;
        f.vel = Math.min(f.vel + f.accel, FALL_MAX_VEL);
        const target = f.toY * CELL_PX * 0x10000;
        if (f.pos >= target) {
          f.pos = target;
          f.landed = true;
          landedNow = true;
          if (f.cell !== GARBAGE) f.squash = SQUASH_FRAMES;
        }
        busy = true;
      } else if (f.squash > 0) {
        f.squash--;
        busy = true;
      }
    }
    if (landedNow) this.events.push({ type: 'land' });
    if (!busy) this.fallers = [];
    return !busy;
  }

  // ---------------------------------------------------------------- the pair

  private updateRepeat(held: number): number {
    const dirs = held & (IN_LEFT | IN_RIGHT);
    if (dirs !== this.hDirs) {
      this.hDirs = dirs;
      this.hTimer = REPEAT_DELAY;
      return dirs;
    }
    if (this.hTimer > 0) {
      this.hTimer--;
      return 0;
    }
    this.hTimer = REPEAT_RATE;
    return dirs;
  }

  private childFree(x: number, y: number, rot: number): boolean {
    return isFree(this.field, x + ROT_DX[rot], y + ROT_DY[rot]);
  }

  private control(held: number, pressed: number, repeat: number): void {
    const p = this.piece!;
    if (p.rotAnim > 0) p.rotAnim--;
    if (p.bounce < 99) p.bounce++;

    // Sideways (sub_5060): one frame of slide animation blocks the next step.
    if (p.slide !== 0) p.slide = 0;
    else if (repeat & (IN_LEFT | IN_RIGHT)) {
      const dx = repeat & IN_LEFT ? -1 : 1;
      if (isFree(this.field, p.x + dx, p.y) && this.childFree(p.x + dx, p.y, p.rot)) {
        p.x += dx;
        p.slide = -dx * 8;
        this.events.push({ type: 'move' });
      }
    }

    // Rotation (sub_5384): kick away from a blocked side, no flip when both sides are blocked.
    const turn = pressed & IN_CCW ? -1 : pressed & IN_CW ? 1 : 0;
    if (turn) {
      const rot = (p.rot + turn) & 3;
      let ok = this.childFree(p.x, p.y, rot);
      if (!ok && this.childFree(p.x, p.y, rot ^ 2)) {
        p.x -= ROT_DX[rot];
        p.y -= ROT_DY[rot];
        if (ROT_DY[rot] !== 0) p.sub = 0x7ffe;
        ok = true;
      }
      if (ok) {
        p.rotFrom = p.rot;
        p.rot = rot;
        p.rotAnim = 4;
        this.events.push({ type: 'rotate' });
      }
    }

    if (this.fall(held)) this.lock();
  }

  private landedBelow(p: Piece): boolean {
    return !isFree(this.field, p.x, p.y + 1) || !this.childFree(p.x, p.y + 1, p.rot);
  }

  /** sub_50DA. Returns true when the pair locks. */
  private fall(held: number): boolean {
    const p = this.piece!;
    const downOnly = (held & (IN_DOWN | IN_LEFT | IN_RIGHT)) === IN_DOWN;

    if (this.speed >= FAST_SPEED_THRESHOLD) {
      const old = p.sub;
      const next = p.sub + this.speed;
      p.sub = next & 0xffff;
      if (next <= 0xffff) return false;
      if (!this.landedBelow(p)) {
        p.y++;
        return false;
      }
      if (old !== 0xffff) {
        this.landing(p);
        if (p.landings >= MAX_LANDINGS) return true;
      }
      p.sub = 0xffff;
      return this.lockCountdown(p, downOnly);
    }

    let speed = this.speed;
    if (downOnly) {
      speed = SOFT_DROP_SPEED;
      if (this.frame & 1) this.addPoints(1);
    }
    const next = p.sub + speed;
    if (next > 0xffff) {
      if (!this.landedBelow(p)) {
        p.sub = 0;
        p.y++;
        return false;
      }
      return this.lockCountdown(p, downOnly);
    }
    const crossed = ((p.sub ^ next) & 0x8000) !== 0;
    p.sub = next;
    if (crossed && this.landedBelow(p)) {
      this.landing(p);
      if (p.landings >= MAX_LANDINGS) return true;
    }
    return false;
  }

  private landing(p: Piece): void {
    p.landings++;
    p.bounce = 0;
    this.events.push({ type: 'land' });
  }

  private lockCountdown(p: Piece, downOnly: boolean): boolean {
    if (p.lockTimer === 0) {
      p.lockTimer = LOCK_FRAMES;
      return false;
    }
    if (--p.lockTimer === 0) return true;
    return downOnly;
  }

  private lock(): void {
    const p = this.piece!;
    this.piece = null;
    this.piecesPlaced++;
    const cx = p.x + ROT_DX[p.rot];
    const cy = p.y + ROT_DY[p.rot];
    const placed: { x: number; y: number; cell: number }[] = [];
    if (p.y >= 1) placed.push({ x: p.x, y: p.y, cell: p.pivot });
    if (cy >= 1) placed.push({ x: cx, y: cy, cell: p.child });
    for (const b of placed) this.field[idx(b.x, b.y)] = b.cell;

    const moves = settle(this.field);
    this.fallers = placed.map((b) => {
      const m = moves.find((mv) => mv.x === b.x && mv.fromY === b.y);
      return this.makeFaller(b.x, b.y, m ? m.toY : b.y, b.cell, FALL_START_VEL, FALL_ACCEL, true);
    });
    this.afterSettle = Phase.Check;
    this.phase = Phase.Settle;
    this.events.push({ type: 'lock' });
  }

  // ---------------------------------------------------------------- netplay helpers

  /** Cheap state hash for desync detection. */
  checksum(): number {
    let h = 2166136261 >>> 0;
    const mix = (v: number): void => {
      h = Math.imul(h ^ (v & 0xff), 16777619) >>> 0;
      h = Math.imul(h ^ ((v >>> 8) & 0xff), 16777619) >>> 0;
      h = Math.imul(h ^ ((v >>> 16) & 0xff), 16777619) >>> 0;
      h = Math.imul(h ^ (v >>> 24), 16777619) >>> 0;
    };
    for (let i = 0; i < this.field.length; i++) mix(this.field[i]);
    mix(this.score);
    mix(this.pending);
    mix(this.phase);
    mix(this.frame);
    if (this.piece) {
      mix(this.piece.x);
      mix(this.piece.y);
      mix(this.piece.rot);
      mix(this.piece.sub);
    }
    return h;
  }
}
