# Grimgear's Bean Machine

A falling-bean puzzle battler that plays by the **exact rules of *Dr. Robotnik's Mean Bean Machine*** (Mega Drive, 1993) with an all-new cast, playable in the browser, against the computer, on one keyboard, or **online**.

Professor Grimgear has built a Bean Machine to turn the beans of Beanbury into robots. Sprout, a small green bean, fights through 12 of his machines and then the Professor himself.

## What's in it

- **Original rules, from the original code.** Every timing and table (fall speeds, lock delay, scoring, 70 points per refugee, 30-per-turn drops, no offsetting, the death square, the rotation kicks) was read from the game's disassembly. See [docs/MECHANICS.md](docs/MECHANICS.md) for each value and the ROM routine it comes from.
- **Scenario mode**: 13 stages, four difficulties, story scenes, continues, saved progress.
- **Online battle**: quick match or private rooms with a 4-letter code, best of 1–15, handicap levels 1–5.
- **1P vs 2P** on one keyboard or two gamepads; **vs Computer** against any opponent you've reached; **Exercise** (endless solo).
- New characters with expressive portraits that react to the match, procedural pixel art, synthesised chiptune music and sound. No Sega assets are used.
- Keyboard, gamepad and on-screen touch controls.

## Play locally

Needs Node.js 22.18 or newer (the server runs its TypeScript directly with Node's built-in type stripping).

```bash
npm install
npm run build        # build the web client
npm start            # serve game + multiplayer on http://localhost:8787
```

For development with hot reload, run these in two terminals:

```bash
npm run dev:server   # multiplayer server on :8787
npm run dev          # web client on http://localhost:5173 (proxies /ws to the server)
```

Open two browser windows and pick **Online Battle → Quick Match** in both to try multiplayer.

### Controls

| | Solo / online | 1P (shared keyboard) | 2P (shared keyboard) |
|---|---|---|---|
| Move | ← → or A D | A D | ← → |
| Drop faster | ↓ or S | S | ↓ |
| Turn | X/K or ↑ (clockwise), Z/J (counter) | G or W / F | L or ↑ / K |
| Pause | Esc or P | Esc | Esc |

Gamepads: D-pad or stick to move, A/Y turn clockwise, B/X turn counter-clockwise.

## How it's built

```
packages/engine   Rules engine in plain TypeScript: no DOM, deterministic, frame-stepped at 60 Hz.
                  Board simulation, the game's RNG and pair lists, scoring, refugees, speed tables,
                  computer AI, and the netplay replay helpers. Shared by the client and the server.
apps/web          Browser client: Vite + Canvas 2D at the Mega Drive's 320×224, scaled up.
apps/server       Node server: static hosting + WebSocket rooms and matchmaking.
docs/             Rules reference.
```

**Online play** works like this: each player's board runs locally from their own inputs, so controls feel instant. Inputs stream to the server every 3 frames. The server replays both boards with the same engine, so it decides how many refugees each chain sends and who topped out first (by game frame, not by whose message arrived first), and it forfeits clients that send impossible input or ignore refugees. Each client rebuilds the opponent's board from the relayed inputs.

## Tests

```bash
npm test             # engine rules + a full online match between two bots over a laggy connection
npm run typecheck
```

## Deploy

The server is one Node process that serves the built client and the WebSocket endpoint, so any host with WebSocket support works (Render, Fly.io, Railway, a VPS). A `Dockerfile` and a `render.yaml` blueprint are included.

- **Render**: New → Blueprint → pick this repo. Free tier works (it sleeps when idle).
- **Docker**: `docker build -t bean-machine . && docker run -p 8787:8787 bean-machine`
- **Static client elsewhere** (e.g. Vercel, GitHub Pages): build with `VITE_SERVER_URL=wss://your-server/ws npm run build`, and set `ALLOWED_ORIGINS=https://your-site` on the server. You can also point any copy of the client at a server with `?server=wss://host/ws`.

## Roadmap

1. **Web app with multiplayer**: this release.
2. **Mobile app**: wrap the same client with Capacitor for Android/iOS (the engine and renderer are already DOM-light and the touch pad is in), add haptics, offline play and store builds.
3. **More game**: accounts and ranked matchmaking (the server already judges results authoritatively), XP and unlockable characters/boards, daily challenges, replays (input logs are already recorded), tournaments.

## Credits

- Rules research: [Scrambled-Beans/drmbm-md-disasm](https://github.com/Scrambled-Beans/drmbm-md-disasm) and [DevsArchive/mean-bean-machine-disassembly](https://github.com/DevsArchive/mean-bean-machine-disassembly), plus the [Puyo Nexus wiki](https://puyonexus.com/wiki/).
- Other open-source clones looked at: [WillFlame/jspuyo](https://github.com/WillFlame/jspuyo), [puyonexus/puyovs](https://github.com/puyonexus/puyovs), [gelavolt](https://github.com/doczi-dominik/gelavolt).
- Font: Press Start 2P (SIL Open Font License).

This is a non-commercial fan project. *Mean Bean Machine*, *Puyo Puyo* and *Sonic* are trademarks of SEGA; no SEGA characters, graphics, music or code are included.
