
export interface Settings {
  sfx: number;
  music: number;
  name: string;
  games: number;
  touch: 'auto' | 'on' | 'off';
  crt: boolean;
  /** Colour-blind mode: a shape on every bean. */
  symbols: boolean;
}

export interface Progress {
  exerciseBest: number[];
  wins: number;
  losses: number;
  bestChain: number;
}

const DEFAULT_SETTINGS: Settings = {
  sfx: 0.8,
  music: 0.5,
  name: '',
  games: 3,
  touch: 'auto',
  crt: false,
  symbols: false,
};

const DEFAULT_PROGRESS: Progress = {
  exerciseBest: [0, 0, 0],
  wins: 0,
  losses: 0,
  bestChain: 0,
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return structuredClone(fallback);
    return { ...structuredClone(fallback), ...JSON.parse(raw) };
  } catch {
    return structuredClone(fallback);
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or storage full: progress just won't persist.
  }
}

export const settings: Settings = read('bm.settings', DEFAULT_SETTINGS);
export const progress: Progress = read('bm.progress', DEFAULT_PROGRESS);

export const saveSettings = (): void => write('bm.settings', settings);
export const saveProgress = (): void => write('bm.progress', progress);
