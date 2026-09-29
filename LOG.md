# LOG

Sculpt log. The **Current state** block is rewritten at the end of every session. Session entries are prepended, so the newest is first. Workflow: CLAUDE.md.

---

## Current state

**Stage:** 1 — Block-in (just started; Stage 0 complete in S6)
**Last session:** S6 · 2026-09-29
**Works:**
- A pnpm monorepo with `sim`, `content`, `tools` and `client` packages, strict TS 6.0, no build step.
- `pnpm check` is green: typecheck, lint, 126 tests (one of them drives headless Chromium).
- ESLint enforces the sim's hard rules (imports, Math/Date/timers, async, classes, `**`, float literals), in sim tests too.
- Sim: `createMatch({ seed, rules })`, pure `step(state, commands)` at a fixed tick, sfc32 RNG in state, `hashState` (FNV-1a over canonical JSON). Commands are validated; with hands still empty, every one is rejected and recorded.
- Match timer and result: 3:00 regulation, then up to 2:00 overtime while stars are tied; any star lead wins after regulation, still tied at the end is a draw.
- Replay v0 (`content`): `{ version: 0, seed, decks, commands }`, zod-validated on load and save (strict objects, integers, tick order). `playReplay` (tools) validates, feeds each command at its tick, checks invariants every tick, and fails if commands are left unplayed.
- `pnpm sim match --seed <n>` saves `replays/seed-<n>.json` (gitignored); `pnpm sim replay <file>` plays it back to the same hash. Both take `--dump <tick>`.
- `content` exports `ARENA` (D7) and `towerFootprint`. The sim doesn't read the arena yet.
- Client (Vite 8 + PixiJS 8.21, WebGL): `pnpm dev` draws `ARENA` once per resize, side 0 at the bottom. `pnpm shots` saves a byte-identical `shots/arena.png`.
**Known issues:**
- No formatter configured yet (the code follows the existing style by convention).
- Nothing earns stars yet (no towers); the end-of-match scenarios set stars directly.
- Shots need Playwright's pinned Chromium (`pnpm --filter @factor/tools exec playwright install --only-shell chromium`) or `FACTOR_CHROMIUM=<path>`. The cloud container has only build 1194: use `FACTOR_CHROMIUM=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`.
- If the client throws before drawing, `pnpm shots` reports the page error only after its 15 s ready timeout.
- Replays don't carry `MATCH_RULES`; a content change silently changes what an old replay plays (goldens will catch this).
**Golden replays:** none (the RNG sequence is pinned in `rng-sequence-is-fixed-per-seed.test.ts`)

**Next cuts** (in order):
1. Towers become sim entities: `ARENA`'s sites reach the sim through `MatchSetup` (D7), tower hp in `content`; the client draws towers from sim state.
2. Energy, a hand of 4 plus next, and a deck shuffled from the seed (replay `decks` become real, via `MatchSetup`); a played card spends energy and cycles (still no units).
3. The client runs the sim live at 20 ticks/s, interpolating between ticks, and shows the timer; `?replay=` plays a replay back, and `pnpm shots` learns `?replay=&tick=`.
4. The 4 Stage 1 cards as colored shapes: units spawn, cross bridges, fight; towers shoot and fall, earning stars.
5. A random-legal-move bot; `pnpm sim match` plays bot vs bot and records its commands into the replay.

---

## Sessions

### S6 · 2026-09-29 · Replay format v0
**Stage:** 0 — Armature
**Cut:** Replay format v0 with a save/load round trip and zod validation of anything loaded from outside, played back headless: the last Stage 0 criterion.
**Done:**
- Content: `replay.ts` with `REPLAY_VERSION`, `Replay`, `parseReplay`, `loadReplay` and `saveReplay`, and `zod` 4.6 as a dependency. The command schema is typed as the sim's `Command`.
- Tools: `emptyReplay` and `playReplay` replace `runMatch`. `match` saves its replay (`--replay <file>`), and a new `replay <file> [--dump]` command plays one. Bad input gets a clean one-line error.
- Shots: the `FACTOR_CHROMIUM` env var overrides the browser (this container's Playwright build didn't match).
**Verified:** `pnpm check` green (21 files, 126 tests; the shots test needed `FACTOR_CHROMIUM` here). Round trip: save → load gives an equal replay with identical text. A reloaded replay with commands at ticks 0, 50 (both sides) and 5999 gives the same hash at 7 checkpoints. Moving one command changes the hash from its tick on. 15 kinds of malformed replay are each rejected with their path. CLI: match → replay prints the same summary. 4 mutations were each caught (non-strict command object, off-by-one order check, commands fed a tick late, unplayed commands ignored). Seed 42 still hashes `330933a4`.
**Decisions:** Command objects are strict, because rejected commands are copied into the state, so an extra key would change the hash. Replays keep VISION's four fields and carry no rules. `playReplay` validates in-code replays too, since out-of-order commands otherwise stall playback. Decks are free-form string arrays until cards exist.
**Left out / noticed:** Client `?replay=` playback (Next cuts 3). Recording bot commands (Next cuts 5). Rules missing from replays went to Known issues. Node here is 22.22 while `engines` asks for ≥24; it works, with a warning.
**Status:** complete (Stage 0 complete)

### S5 · 2026-09-29 · The client draws the arena; `pnpm shots`
**Stage:** 0 — Armature
**Cut:** Draw `ARENA` in the browser with Vite + PixiJS v8, and let the agent see it through a deterministic PNG (Stage 0 criterion 4).
**Done:**
- Client: `arena-view.ts` (pure: `fitView`, `toScreen` with the y-flip, `arenaScene` → screen-space `Shape`s, back to front), `draw-arena.ts` (Pixi `Graphics`, placeholder palette), `main.ts`, `index.html`. `pnpm dev` serves it.
- Tools: `shots.ts` (Vite dev server on a free port + Playwright headless shell, waits for `html[data-ready]`, collects page errors) and a `shots [--out <dir>]` CLI command, loaded lazily. `pnpm shots` prints the PNG's sha256.
- Content: `towerFootprint(site)` (second use: the map test and the client).
**Verified:** `pnpm check` green (17 files, 84 tests). The scene test rasterizes the on-screen shapes back to S4's ASCII map at 540×960 and a letterboxed 600×1000. The shots test takes two shots in one process and checks that they're identical, 540×960 and drawn with WebGL. `pnpm shots` gave the same hash in separate processes (`fe618e00cf92`). I looked at the PNG: it matches the map. Mutations caught: no y-flip, towers drawn under the ground, a client that throws. `pnpm sim match --seed 42` still hashes `330933a4`.
**Decisions:** The client draws on demand (`autoStart: false`) and sets `data-ready`, so a shot captures one exact frame. There's no `vite.config.ts` because the defaults suffice. The browser test runs inside `pnpm check` so the sense stays working. Chromium headless shell only (Playwright 1.63 → revision 1243).
**Left out / noticed:** Replay URLs for shots wait for replays (Next cuts 1, 3). The slow failure when the client throws went to Known issues.
**Status:** complete

### S4 · 2026-09-29 · Arena layout in content
**Stage:** 0 — Armature
**Cut:** Put the arena layout in `content` as data, as the director decided, so the client has something to draw next.
**Done:**
- `content/src/arena.ts`: `ArenaLayout`, `Rect`, `Bridge`, `Lane`, `TowerSite`, and `ARENA`, written in tiles via a `tiles()` helper that refuses fractional milli-tiles.
- VISION.md: Stage 0 now says "from the arena layout in `content`", and D7 is added (the director approved in chat).
**Verified:** `pnpm check` green (15 files, 78 tests). An ASCII map test renders one character per tile. Property tests cover integer measurements, a full-width river at the middle, one bridge per lane spanning it, the Keep at back center, one Outpost per lane, mirror symmetry, towers on whole tiles on their own half, and no overlaps. 4 layout mutations were each caught.
**Decisions:** D7. Side 0 holds the low-y half (as S2's test commands already assumed). The layout types live in `content` for now: the sim will define what it needs when it consumes the layout.
**Left out / noticed:** Deploy zones and their extension, tower stats, and passing the layout into the sim are left for Stage 1+ (Next cuts 4).
**Status:** complete

### S3 · 2026-09-29 · Match timer and result
**Stage:** 0 — Armature
**Cut:** Give the match an end (a timer, overtime and a result) with the length coming from `content`, and add `pnpm sim match` to play one headless.
**Done:**
- Sim: `MatchRules` in `MatchSetup` and state, `stars`, `result`, `decideResult`, `checkInvariants`. Sim tests share a `fixtures.ts`.
- Content: `MATCH_RULES` (3600 + 2400 ticks). Tools: `runMatch`, `describeResult`, and the `match` command with `--seed` and `--dump`.
**Verified:** `pnpm check` green (13 files, 69 tests). Scenario tests: more stars at 3:00 wins on that tick, a lead mid-regulation doesn't end it, tied → overtime, first overtime star wins, tied at the end → draw, zero overtime, stepping an ended match throws, bad rules rejected. Each invariant is shown to fire. The CLI prints the same hash in separate processes (seed 42 → `330933a4`). 6 hand mutations (off-by-one end, no overtime, wrong winner, …) were each caught.
**Decisions:** The rules live in the state, so `step(state, commands)` keeps its signature and the hash covers them. Stepping an ended match throws instead of silently doing nothing. One rule covers both ways to win on stars: after regulation, any star lead wins. The tower-HP tiebreak waits for towers, so for now tied stars are always a draw. Content writes times as `seconds * TICKS_PER_SECOND`.
**Left out / noticed:** The question of where the arena lives (content or sim) went into Next cuts. There's no bot yet, so the "bot-vs-bot with invariants" check ran as an empty match.
**Status:** complete

### S2 · 2026-09-29 · Sim skeleton
**Stage:** 0 — Armature
**Cut:** Give the sim its state, seeded RNG, fixed tick and state hash, and prove that the same seed and commands reproduce the same hash at tick 1000.
**Done:**
- `rng.ts` (sfc32, seeded as PractRand does), `hash.ts` (canonical JSON + FNV-1a), `state.ts` (`SimState`, `Command`, `createMatch`, `hashState`), `step.ts`.
- 5 scenario test files: determinism to tick 1000, JSON round-trip and resume, no input mutation (deep-frozen), canonical hash and FNV vectors, RNG golden sequence, command rejection and side order.
**Verified:** `pnpm check` green (9 files, 37 tests). sfc32 cross-checked against an independent Python implementation on 4 seeds. Mutation check: sharing `rng` between states and dropping the side sort each failed one test. Found a mismatch: LOG said S1 was complete, but git had no commits because no identity is configured.
**Decisions:** `step` builds a fresh state and never mutates its inputs, so the client can keep the previous tick for interpolation. Canonical JSON throws on floats, `undefined`, Maps and class instances, so the "plain JSON, integers only" rule fails loudly. `state.rejected` holds only the last step's rejections, because the replay already holds every command. Commands resolve side 0 first; order within a side is kept. Git author is set repo-local to `Narcis13`; S1 was committed first on its own.
**Left out / noticed:** Match timer and result, arena constants, invariants and bot matches (no match exists to run yet) are in Next cuts. How content numbers reach the sim (through `MatchSetup`) is settled in the next cut.
**Status:** complete

### S1 · 2026-09-29 · Scaffold the monorepo
**Stage:** 0 — Armature
**Cut:** Give every later cut somewhere to live and a definition of green.
**Done:**
- Ran `git init` (branch `main`); pnpm 11 workspace with `packages/{sim,content,tools,client}`, each exporting `./src/index.ts`.
- `tsconfig.base.json`: strict, `nodenext`, `erasableSyntaxOnly`, `.ts` imports. The sim and content packages get no DOM or Node types.
- `eslint.config.js`: `strictTypeChecked` plus sim-only guardrails for determinism and imports.
- Vitest 5 with each package as a project; smoke tests prove workspace resolution and that Node runs the CLI's `.ts` directly.
**Verified:** `pnpm check` green (4 files, 5 tests). Linted a throwaway file of sim violations: all 13 were caught; file removed. Ran `pnpm sim` (exit 0) and `pnpm sim nope` (exit 1).
**Decisions:** TypeScript pinned to `~6.0` because typescript-eslint 8 supports only TS below 6.1, and 7.0 is the latest. No build step; Node 24 strips types natively.
**Left out / noticed:** Prettier and other formatters (Known issues). The `bot` package gets created in Stage 1, when it's needed. pnpm 12 is available; we stay on 11.0.8, which is pinned via `packageManager`.
**Status:** complete

### S0 · 2026-09-29 · Vision and workflow
**Stage:** pre-0
**Cut:** Set the foundation before any code: what we build, and how each session works.
**Done:**
- VISION.md: product, rules spec, architecture, the agent's senses, quality bar, stages 0–5, decisions D1–D6.
- CLAUDE.md: the sculpt coding session loop; VISION.md is imported so it's always in context.
- LOG.md: this file.
**Verified:** n/a (docs only).
**Decisions:** D1–D6 (see VISION.md §10).
**Left out / noticed:** The open questions in VISION.md §11 (title, art direction, target device, PvP in v1) are waiting on the director.
**Status:** complete
