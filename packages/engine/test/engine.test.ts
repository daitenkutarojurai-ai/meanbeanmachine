import { describe, expect, it } from 'vitest';
import {
  AiController,
  AI_PRESETS,
  BLUE,
  COLS,
  EMPTY,
  GARBAGE,
  GREEN,
  IN_CCW,
  IN_CW,
  IN_DOWN,
  IN_LEFT,
  IN_RIGHT,
  InputRecorder,
  InputReplay,
  Match,
  Phase,
  PlayerSim,
  RED,
  ROWS,
  Rng,
  YELLOW,
  type Field,
  findGroups,
  freeCells,
  generatePairLists,
  idx,
  resolveChain,
  scoreStep,
  speedEntry,
  versusConfigs,
} from '../src/index.ts';

function fieldFrom(rows: string[]): Field {
  const map: Record<string, number> = { '.': EMPTY, R: RED, Y: YELLOW, G: GREEN, P: 4, B: BLUE, O: GARBAGE };
  const f = new Uint8Array(COLS * ROWS);
  const top = ROWS - rows.length;
  rows.forEach((r, i) => [...r].forEach((ch, x) => (f[idx(x, top + i)] = map[ch])));
  return f;
}

function vsSim(level = 2, seed = 1234): PlayerSim {
  const sim = new PlayerSim(versusConfigs(seed, [level, level])[0]);
  sim.start();
  return sim;
}

function runUntil(sim: PlayerSim, pred: () => boolean, input = 0, max = 5000): void {
  for (let i = 0; i < max && !pred(); i++) sim.step(input);
}

describe('rng', () => {
  it('is deterministic and bounded', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 1000; i++) {
      const v = a.bound(6);
      expect(v).toBe(b.bound(6));
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
    }
  });

  it('follows the seed * 41 recurrence', () => {
    const r = new Rng(1);
    expect(r.next()).toBe(41);
    expect(r.seed).toBe((41 << 16) | 41);
  });
});

describe('pair lists', () => {
  it('keeps colour counts balanced and shares the first 4 pairs in VS', () => {
    const { primary, versus } = generatePairLists(99, 4, true);
    const counts = [0, 0, 0, 0, 0, 0];
    primary.forEach((c) => counts[c]++);
    expect(counts.slice(1, 5)).toEqual([64, 64, 64, 64]);
    expect([...versus.slice(0, 8)]).toEqual([...primary.slice(0, 8)]);
    expect(versus.slice(8).includes(BLUE)).toBe(true);
  });
});

describe('scoring', () => {
  it('scores a lone group of four as 40', () => {
    expect(scoreStep([{ color: RED, cells: [0, 1, 2, 3] }], 0).points).toBe(40);
  });

  it('applies chain power, colour bonus and group bonus', () => {
    const s = scoreStep(
      [
        { color: RED, cells: [0, 1, 2, 3, 4] },
        { color: BLUE, cells: [5, 6, 7, 8] },
      ],
      1,
    );
    // 10 x 9 beans x (8 chain + 3 two-colour + 2 five-group)
    expect(s.points).toBe(90 * 13);
  });

  it('resolves a two-chain for 360 points', () => {
    const f = fieldFrom(['Y.....', 'RYYY..', 'RRR...']);
    const r = resolveChain(f);
    expect(r.chain).toBe(2);
    expect(r.points).toBe(40 + 40 * 8);
  });

  it('does not connect beans in the hidden row', () => {
    const f = new Uint8Array(COLS * ROWS);
    f[idx(0, 1)] = RED;
    f[idx(0, 2)] = RED;
    f[idx(1, 2)] = RED;
    f[idx(2, 2)] = RED;
    expect(findGroups(f)).toHaveLength(0);
  });

  it('clears refugee beans next to a pop', () => {
    const f = fieldFrom(['O.....', 'RRRRO.']);
    resolveChain(f);
    expect([...f].filter((c) => c !== EMPTY)).toEqual([]);
  });
});

describe('the falling pair', () => {
  it('spawns at column 3 and soft-drops one point per row', () => {
    const sim = vsSim();
    runUntil(sim, () => sim.phase === Phase.Control);
    expect(sim.piece).toMatchObject({ x: 2, y: 2, rot: 0 });
    runUntil(sim, () => sim.phase !== Phase.Control, IN_DOWN);
    expect(sim.score).toBeGreaterThanOrEqual(10);
    expect(sim.score).toBeLessThanOrEqual(13);
  });

  it('kicks off the wall when rotating into it', () => {
    const sim = vsSim();
    runUntil(sim, () => sim.phase === Phase.Control);
    for (let i = 0; i < 40; i++) sim.step(i % 2 ? 0 : IN_LEFT);
    expect(sim.piece!.x).toBe(0);
    sim.step(IN_CCW);
    expect(sim.piece).toMatchObject({ x: 1, rot: 3 });
  });

  it('cannot turn when both sides are blocked', () => {
    const sim = vsSim();
    runUntil(sim, () => sim.phase === Phase.Control);
    for (let y = 3; y < ROWS; y++) {
      sim.field[idx(1, y)] = GARBAGE;
      sim.field[idx(3, y)] = GARBAGE;
    }
    sim.step(0);
    const p = sim.piece!;
    p.y = 6;
    sim.step(IN_CW);
    expect(p.rot).toBe(0);
  });

  it('auto-repeats sideways after 17 frames, then every 4', () => {
    const sim = vsSim();
    runUntil(sim, () => sim.phase === Phase.Control);
    const xs: number[] = [];
    for (let i = 0; i < 22; i++) {
      sim.step(IN_RIGHT);
      xs.push(sim.piece!.x);
    }
    expect(xs[0]).toBe(3);
    expect(xs[15]).toBe(3);
    expect(xs[17]).toBe(4);
    expect(xs[21]).toBe(5);
  });
});

describe('refugees', () => {
  it('drops 30 as five per column on an empty board', () => {
    const sim = new PlayerSim({ ...versusConfigs(5, [2, 2])[0], startGarbage: 30 });
    sim.start();
    expect(sim.phase).toBe(Phase.Garbage);
    for (let x = 0; x < COLS; x++) expect(freeCells(sim.field, x)).toBe(13 - 5);
  });

  it('spreads fewer than six across different columns', () => {
    const sim = new PlayerSim({ ...versusConfigs(6, [2, 2])[0], startGarbage: 4 });
    sim.start();
    const used = [0, 1, 2, 3, 4, 5].filter((x) => freeCells(sim.field, x) === 12);
    expect(used).toHaveLength(4);
  });

  it('carries over refugees beyond 30', () => {
    const sim = new PlayerSim({ ...versusConfigs(7, [2, 2])[0], startGarbage: 40 });
    sim.start();
    expect(sim.pending).toBe(10);
  });

  it('sends one refugee per 70 points at the end of a chain', () => {
    const m = new Match(versusConfigs(11, [2, 2]));
    m.start();
    const [a, b] = m.sims;
    a.field.set(fieldFrom(['Y.....', 'RYYY..', 'RRR...']));
    a.field.fill(EMPTY, 0, idx(0, 2));
    // Make the first pair irrelevant by forcing a check right away.
    a.phase = Phase.Check;
    for (let i = 0; i < 400 && b.pending === 0; i++) m.step([0, 0]);
    expect(b.pending).toBe(5);
    expect(a.garbageAcc).toBe(360 % 70);
  });
});

describe('game over', () => {
  it('ends when the third column is filled to the top', () => {
    const sim = vsSim();
    for (let y = 2; y < ROWS; y++) sim.field[idx(2, y)] = GARBAGE;
    runUntil(sim, () => !sim.alive);
    expect(sim.phase).toBe(Phase.Dead);
  });
});

describe('speed tables', () => {
  it('matches the VS sets, including level 5 starting one entry late', () => {
    expect(speedEntry({ kind: 'versus', level: 0 }, 0, 0)[0]).toBe(0x1000);
    expect(speedEntry({ kind: 'versus', level: 2 }, 0, 0)[0]).toBe(0x2000);
    expect(speedEntry({ kind: 'versus', level: 4 }, 0, 0)[0]).toBe(0x2500);
  });

  it('offsets scenario speed by difficulty', () => {
    expect(speedEntry({ kind: 'scenario', stage: 0, difficulty: 'normal' }, 0, 0)[0]).toBe(0x0600);
    expect(speedEntry({ kind: 'scenario', stage: 12, difficulty: 'hardest' }, 4, 0)[0]).toBe(0xfe00);
  });
});

describe('netplay', () => {
  it('replays a recorded game exactly, including refugee credits', () => {
    const cfg = versusConfigs(77, [2, 2])[0];
    const local = new PlayerSim(cfg);
    local.start();
    const rec = new InputRecorder();
    const replay = new InputReplay(cfg);
    const rng = new Rng(5);
    const buttons = [0, IN_LEFT, IN_RIGHT, IN_DOWN, IN_CW, IN_CCW];
    for (let f = 0; f < 3000 && local.alive; f++) {
      if (f % 400 === 200) {
        local.receiveGarbage(7);
        rec.ack(7);
      }
      const input = buttons[rng.bound(buttons.length)];
      local.step(input);
      rec.record(input);
      const batch = rec.takeBatch();
      if (batch) {
        expect(replay.push(batch)).toBe(true);
        replay.advance();
      }
    }
    const last = rec.takeBatch(true);
    if (last) replay.push(last);
    replay.advance();
    expect(replay.sim.checksum()).toBe(local.checksum());
  });

  it('rejects out-of-order batches', () => {
    const replay = new InputReplay(versusConfigs(1, [2, 2])[0]);
    expect(replay.push({ from: 3, inputs: [0], acks: [] })).toBe(false);
  });
});

describe('computer opponents', () => {
  it('finishes an AI vs AI match with a winner', () => {
    const m = new Match(versusConfigs(2024, [2, 2]));
    m.start();
    const ais = [new AiController(AI_PRESETS.hard, 1), new AiController(AI_PRESETS.easy, 2)];
    for (let f = 0; f < 60 * 60 * 10 && !m.result; f++) {
      m.step([ais[0].input(m.sims[0], m.sims[1]), ais[1].input(m.sims[1], m.sims[0])]);
    }
    expect(m.result).not.toBeNull();
    expect(Math.max(m.sims[0].maxChain, m.sims[1].maxChain)).toBeGreaterThanOrEqual(2);
  });
});
