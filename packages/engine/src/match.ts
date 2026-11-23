import { generatePairLists } from './pieces.ts';
import { type PlayerConfig, PlayerSim, type SimEvent } from './player.ts';
import { deriveSeed } from './rng.ts';
import { type Difficulty, VERSUS_START_GARBAGE } from './speed.ts';

/** 1P vs 2P: each player picks a handicap level 0..4 (shown as 1..5). */
export function versusConfigs(seed: number, levels: readonly number[]): PlayerConfig[] {
  const lists = generatePairLists(seed, 4, true);
  return levels.map((level, i) => ({
    mode: 'versus',
    pairs: level === 0 ? lists.primary : lists.versus,
    speed: { kind: 'versus', level },
    level,
    seed: deriveSeed(seed, i + 1),
    startGarbage: VERSUS_START_GARBAGE[level],
  }));
}

/** Scenario stage (0-based, 13 stages): human is player 0, the computer is player 1. */
export function scenarioConfigs(seed: number, stage: number, difficulty: Difficulty): PlayerConfig[] {
  const lists = generatePairLists(seed, 5, false);
  return [0, 1].map((i) => ({
    mode: 'scenario',
    pairs: lists.primary,
    speed: { kind: 'scenario', stage, difficulty },
    level: 0,
    seed: deriveSeed(seed, i + 1),
    garbageStartVel: difficulty === 'hardest' ? 3 : 0,
  }));
}

/** Exercise start levels as offered by the game: easy 0, normal 2, hard 4. */
export function exerciseConfig(seed: number, level: number): PlayerConfig {
  const startScore = level >= 4 ? 90000 : level >= 2 ? 40000 : 0;
  return { mode: 'exercise', speed: { kind: 'exercise' }, level, seed: deriveSeed(seed, 1), startScore };
}

export type MatchResult = { winner: number } | { draw: true };

/** Two boards wired together on one machine: refugees from one chain land on the other. */
export class Match {
  readonly sims: PlayerSim[];
  frame = 0;
  result: MatchResult | null = null;
  /** Events produced during the last step, per player. */
  events: SimEvent[][];

  constructor(configs: PlayerConfig[]) {
    this.sims = configs.map((c) => new PlayerSim(c));
    this.events = this.sims.map(() => []);
  }

  start(): void {
    for (const s of this.sims) s.start();
  }

  step(inputs: readonly number[]): void {
    if (this.result) return;
    this.frame++;
    this.sims.forEach((s, i) => s.step(inputs[i] ?? 0));
    this.events = this.sims.map((s) => s.events.splice(0));
    this.events.forEach((evs, i) => {
      for (const e of evs) {
        if (e.type === 'chainEnd' && e.garbage > 0) {
          this.sims.forEach((other, j) => {
            if (j !== i) other.receiveGarbage(e.garbage);
          });
        }
      }
    });
    const alive = this.sims.map((s) => s.alive);
    if (this.sims.length > 1) {
      const living = alive.filter(Boolean).length;
      if (living === 0) this.result = { draw: true };
      else if (living === 1) this.result = { winner: alive.indexOf(true) };
    } else if (!alive[0]) {
      this.result = { winner: -1 };
    }
  }
}
