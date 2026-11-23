// Rules constants for Dr. Robotnik's Mean Bean Machine (Mega Drive, 1993), which runs
// the original 1992 Puyo Puyo ruleset. Values were read from the game's disassembly
// (github.com/Scrambled-Beans/drmbm-md-disasm); see docs/MECHANICS.md for the routine
// each one comes from.

export const COLS = 6;
/** Row 0 is above the hidden row, row 1 is the hidden row, rows 2..13 are visible. */
export const ROWS = 14;
export const VISIBLE_TOP = 2;
export const VISIBLE_ROWS = ROWS - VISIBLE_TOP;

export const SPAWN_X = 2;
export const SPAWN_Y = 2;
/** A bean in this cell when a new pair is due ends the game. */
export const DEATH_X = 2;
export const DEATH_Y = 2;

export const EMPTY = 0;
export const RED = 1;
export const YELLOW = 2;
export const GREEN = 3;
export const PURPLE = 4;
export const BLUE = 5;
export const GARBAGE = 6;
export type Cell = number;

/** Bean colours in the order the game cycles them when building the pair list. */
export const COLOR_ORDER = [RED, YELLOW, GREEN, PURPLE, BLUE] as const;

export const POP_SIZE = 4;

/** Chain power by chain step (0 = first pop). Steps past 8 reuse the last entry. */
export const CHAIN_POWER = [0, 8, 16, 32, 64, 128, 256, 512, 1024] as const;
/** Colour bonus by number of distinct colours popped in one step. */
export const COLOR_BONUS = [0, 0, 3, 6, 12, 24, 48] as const;
/** Group bonus by group size; sizes of 11 or more use the last entry. */
export const GROUP_BONUS = [0, 0, 0, 0, 0, 2, 3, 4, 5, 6, 7, 10] as const;
export const MAX_BONUS = 999;
export const MAX_SCORE = 99_999_999;

/** Points per refugee bean sent. The arcade's time-based table is dummied out on Mega Drive. */
export const TARGET_POINTS = 70;
export const MAX_GARBAGE_PER_DROP = 30;
export const GARBAGE_ACC_MAX = 0xffff;

/** Fall speeds are added to a 16-bit accumulator each frame; overflow moves the pair one row. */
export const SOFT_DROP_SPEED = 0x8000;
export const FAST_SPEED_THRESHOLD = 0x8001;
export const LOCK_FRAMES = 32;
export const MAX_LANDINGS = 8;

export const POP_FLASH_FRAMES = 24;
export const POP_WAIT_FRAMES = 24;

/** Falling beans: velocity and acceleration in 1/65536 px per frame, 16 px cells. */
export const CELL_PX = 16;
export const FALL_START_VEL = 0x10000;
export const FALL_ACCEL = 0x3000;
export const FALL_MAX_VEL = 0x80000;
/** Per-column acceleration of dropping refugee beans, so columns land out of step. */
export const GARBAGE_COLUMN_ACCEL = [0x2400, 0x2600, 0x2000, 0x2a00, 0x2200, 0x2800] as const;

/** Joypad auto-repeat: first repeat after 17 frames, then every 4. */
export const REPEAT_DELAY = 16;
export const REPEAT_RATE = 3;

/** Rotation offsets of the second bean around the pivot: up, right, down, left. */
export const ROT_DX = [0, 1, 0, -1] as const;
export const ROT_DY = [-1, 0, 1, 0] as const;

export const FPS = 60;
