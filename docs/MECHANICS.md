# Rules reference

*Dr. Robotnik's Mean Bean Machine* (Mega Drive, 1993) is Compile's 1992 *Puyo Puyo* with a new cast. Its rules are **Puyo Puyo 1 rules**, which differ from the later "Tsu" rules most modern clones use (no offsetting, different chain power, no all-clear bonus in battle).

Every number below was read from the game's 68000 disassembly ([Scrambled-Beans/drmbm-md-disasm](https://github.com/Scrambled-Beans/drmbm-md-disasm), file `drmbm.asm`). Routine and table labels are given so each value can be checked. The engine in `packages/engine` implements them, and `packages/engine/test` checks them.

## The well

| Rule | Value | Source |
|---|---|---|
| Size | 6 columns × 14 rows: row 0 (never holds beans), row 1 (hidden), rows 2–13 visible | `PUYO_FIELD_ROWS`, `pPlaceablePuyos` |
| Spawn | pivot at column 3, top visible row; second bean above it in the hidden row | `sub_4E24` (`$1A=2`, `$1C=2`) |
| Game over | a bean in column 3, top visible row, when the next pair is due | `sub_4E24`: `tst.b $1C(a2)` |
| Popping | 4+ same-colour beans joined up/down/left/right. **Only the 12 visible rows connect**; the hidden row never pops | `sub_5960` scans `pVisiblePuyos` only |
| Refugee beans | removed when next to a popping group (visible rows only); never pop by themselves | `sub_58C8` |
| Colours | red, yellow, green, purple, blue | `PuyoColors` |

## The falling pair

| Rule | Value | Source |
|---|---|---|
| Fall | speed added to a 16-bit accumulator each frame; overflow = one row down. The pair is drawn half a row up until the accumulator passes 0x8000, so it moves in half-cell steps | `sub_50DA`, `sub_543C` |
| Soft drop | hold Down (without Left/Right): speed becomes 0x8000 (one row per 2 frames) and you earn **1 point every 2 frames** (1 per row) | `sub_50DA` sets bit 3 → `loc_3E8A` adds 1 |
| Lock delay | 32 frames from first touching down, never reset (sliding off a ledge pauses it). Holding Down while resting locks at once. 8 separate landings lock immediately | `sub_51DA`, `loc_5194`, `$26 ≥ 8` |
| Fast speeds | above 0x8000 the half-step check is skipped | `loc_5222` |
| Rotation | second bean goes up → right → down → left. If the target cell is blocked and the opposite side is free, the pair is pushed away (wall/floor kick). If both sides are blocked the turn fails: **no 180° flip** | `sub_5384` |
| Sideways | first step on press, repeat after 17 frames, then every 4 frames | `CtrlHorizTimes` (`pressed_time=$10`, `unpressed_time=3`) |
| Order per frame | move, then rotate, then fall | `loc_4F06` |
| After locking | each bean squashes for 14 frames (unsupported half of a pair drops first), then a pause of 12/8/4/2/0 frames by level | `unk_4ED4`, `word_3B58` |

## Pair sequence

256 colour slots are filled by cycling the colours, then shuffled with the game's RNG (`seed × 41`, halves summed). Both players draw from **the same list**, so both get the same pairs. In 1P vs 2P, level 1 uses a 4-colour list; levels 2–5 use a 5-colour list whose first 4 pairs are copied from the 4-colour one. (`GenPuyoOrder`, `sub_43EA`, `Random`)

## Scoring

```
points = (10 × beans popped) × max(1, chain power + colour bonus + group bonus)   (bonus capped at 999)
```

| Chain step | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9+ |
|---|---|---|---|---|---|---|---|---|---|
| Chain power (`unk_9ADC`) | 0 | 8 | 16 | 32 | 64 | 128 | 256 | 512 | 1024 |

| Colours in one step | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Colour bonus (`unk_9B26`) | 0 | 3 | 6 | 12 | 24 |

| Group size | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11+ |
|---|---|---|---|---|---|---|---|---|
| Group bonus (`unk_9B66`) | 0 | 2 | 3 | 4 | 5 | 6 | 7 | 10 |

Each step: beans blink for 24 frames, pop, 24 more frames, then the beans above fall (start 1 px/frame, +0x3000/65536 px/frame², max 8 px/frame). The score window shows `base × bonus` while a chain runs, as on the cartridge. Score caps at 99,999,999.

## Refugee beans (garbage)

| Rule | Value | Source |
|---|---|---|
| Rate | **1 refugee per 70 points**, remainder carried over. The arcade's rising rate over time is dummied out on Mega Drive | `sub_99AA` (`move.w #$46,d1`) |
| What counts | every point earned since the last send, **including soft-drop points** | `sub_9C64` |
| When sent | when your whole chain ends (after the post-lock pause) | `sub_998A` |
| Offsetting | **none**: refugees aimed at you always land; your chains can't cancel them | — |
| When they land | before your next pair appears, at most **30 per turn**; the rest wait | `SpawnGarbage`, `SetGarbageCounts` |
| Placement | a random column order is shuffled, then beans are dealt one per column round-robin (30 = 5 rows of 6; 4 = four different columns). Full columns are skipped and those beans stay queued | `SetGarbageOrder`, `GetGarbageFreeSpace` |
| Queue icons | small = 1, big = 6, crowned = 30 | |

## Speeds

Fall speeds come in tables of `[speed, beans to clear before the next entry]`. The cleared count resets at each step up.

**1P vs 2P** (`unk_9E24`, index `(steps & 7) | (level×4 & 0x18)`):

| Level | Colours | Refugees at start (`unk_9C04`) | Speeds (beans per step) |
|---|---|---|---|
| 1 | 4 | 0 | 0x1000 → 0x1600 → 0x1A00 → 0x2000 → 0x2500 → 0x3000 → 0x3400 → 0x4000 (32) |
| 2 | 5 | 0 | same as level 1 |
| 3 | 5 | 0 | 0x2000 → 0x2500 → 0x3000 → 0x3400 → 0x4000 → 0x6000 → 0x8000 (32) |
| 4 | 5 | 18 | same as level 3 |
| 5 | 5 | 30 | 0x2500 → 0x3000 → 0x3400 → 0x4000 → 0x6000 → 0x8000 (16) — starts one entry into its set, as in the ROM |

**Scenario** (`unk_9DC4`): start index per stage `8, 9, 10, 11, 12, 13, 14, 15, 17, 17, 18, 18, 19` (`unk_3F84`), minus 6/4/2/0 for Easy/Normal/Hard/Hardest. Normal stage 1 starts at 0x0600 (about one row per 43 frames); Hardest stage 13 climbs to 0xFE00. On Hardest, refugees start falling at 3 px/frame.

**Exercise** (`unk_9E7C`): Easy/Normal/Hard start at level 0/2/4 (Normal starts with 40,000 points, Hard with 90,000). The level rises every 8 speed steps and multiplies chain scores by (level + 1). Level 1 uses 4 colours. Clearing the whole board gives `(level + 1) × 500 + 8000` points (`sub_9332`).

## Not reproduced (yet)

- Exercise mode's helper items (the "Big Bean" and the Has Bean pal). Speed, scoring and levels are in.
- The computer players' original routines. The AI here is new: it searches placements and chain potential, tuned per opponent from "drops things anywhere" to "builds 6-chains".
- The 4-bean password system (progress is saved in the browser instead).
