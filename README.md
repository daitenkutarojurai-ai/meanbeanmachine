# Grimgear's Bean Machine

A falling-bean puzzle battler that plays by the **exact rules of *Dr. Robotnik's Mean Bean Machine*** (Mega Drive, 1993) with an all-new cast, playable in the browser, against the computer, on one keyboard, or **online**.

**Play:** https://daitenkutarojurai-ai.github.io/meanbeanmachine/

Professor Grimgear has built a Bean Machine to turn the beans of Beanbury into robots. Sprout, a brave little bean with a red neckerchief (and a lot of opinions), stops him one chain at a time.

## What's in it

- **Exact original rules.** Every timing and table (fall speeds, lock delay, scoring, 70 points per refugee, 30-per-turn drops, no offsetting, the death square, the rotation kicks) comes from the 1993 game's disassembly. See [docs/MECHANICS.md](docs/MECHANICS.md). Only the rules are classic; the look and sound are modern.
- **One-tap play, Clash-style home.** A big BATTLE button matches you with a robot from your arena. Win trophies to climb 13 themed arenas (meadow, junkyard, pirate cove, frosty peaks, candy factory, lava forge and more), each with its own three robots and a boss who challenges you every fourth battle for a bigger chest. Earn chests that unlock over time, open them for coins, gems and skins, finish daily quests, collect Trophy Road rewards, and spend in a daily shop. Everything you earn is cosmetic or currency: matches are always fair.
- **Sprout, animated.** A vector character with squash and stretch, a bouncy leaf, blinking, eyebrows and moods (cheering on chains, sweating when the stack is high, flinching when refugees land, sulking when he loses), speech bubbles with his own voice, and 11 skins (Ninja, Captain, Astro, Candy, Robo, King…).
- **Modes:** ranked battles, online battles and private rooms (best of 1–7), two players on one device, endless practice. Everyone plays on the same standard board: no difficulty or handicap menus.
- **Easy to share and keep.** Invite a friend with a link that drops them straight into your room, share your wins, and install the game to your home screen (Android one-tap, iOS via Share). Once loaded it plays offline against robots. If nobody is online for a quick match, a robot steps in after 10 seconds.
- **Modern presentation:** sharp at any screen resolution, glossy jelly beans with faces, animated arena backdrops, glowing effects, a light synthesised soundtrack (9 tracks) and juicy sound effects: pops that climb the scale with each chain step, coin clinks, chest fanfares. Landscape layout on desktop, portrait layout with swipe controls on phones.

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

The client is static; the multiplayer server is the same code packaged three ways:

| Host | Command / setup | Notes |
|---|---|---|
| **Cloudflare Workers** (current live site) | `npm run build && npx wrangler deploy` | `wrangler.jsonc`: static assets + one Durable Object running the lobby. No connection time limit; free tier is plenty. |
| **Any Node host** (Render, Fly.io, VPS, Docker) | `npm run build && npm start`, or the `Dockerfile` / `render.yaml` | One process serves the client and `/ws`. |
| **Vercel** | import the repo; `vercel.json` is included | `api/ws.js` (bundled by `npm run bundle:api`) runs the server as a Function. Vercel caps connections at 5 min and may split players across instances, so the session-resume protocol matters there and a shared store would be needed at scale. |
| **GitHub Pages** (mirror) | `.github/workflows/pages.yml` on every push | Static only; set the repository variable `SERVER_URL` (e.g. `wss://host/ws`) to use a multiplayer server. |

A copy of the client can also be pointed at any server with `?server=wss://host/ws`. If you host the client separately from the server, set `ALLOWED_ORIGINS` on a Node server to your site's origin.

**Dropped connections:** the protocol has sessions. The server numbers its messages and keeps a player's seat for 15 s; the client reconnects on its own, receives what it missed and resends its inputs, so a network blip doesn't end the match.

## Roadmap

1. **Web app with multiplayer**: done. Then a modern redesign with a progression loop: done.
2. **Mobile app**: wrap the same client with Capacitor for Android/iOS (the engine and renderer are already DOM-light and the touch pad is in), add haptics, offline play and store builds.
3. **More game**: accounts and ranked matchmaking (the server already judges results authoritatively), XP and unlockable characters/boards, daily challenges, replays (input logs are already recorded), tournaments.

## Credits

- Rules research: [Scrambled-Beans/drmbm-md-disasm](https://github.com/Scrambled-Beans/drmbm-md-disasm) and [DevsArchive/mean-bean-machine-disassembly](https://github.com/DevsArchive/mean-bean-machine-disassembly), plus the [Puyo Nexus wiki](https://puyonexus.com/wiki/).
- Other open-source clones looked at: [WillFlame/jspuyo](https://github.com/WillFlame/jspuyo), [puyonexus/puyovs](https://github.com/puyonexus/puyovs), [gelavolt](https://github.com/doczi-dominik/gelavolt).
- Font: Press Start 2P (SIL Open Font License).

This is a non-commercial fan project. *Mean Bean Machine*, *Puyo Puyo* and *Sonic* are trademarks of SEGA; no SEGA characters, graphics, music or code are included.
