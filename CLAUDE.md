# CLAUDE.md

We build **Factor**, a real-time lane-battler card game, by **sculpt coding**: rough out the whole figure first, then refine it everywhere, one cut per session. The game must run at the end of every session. Each session starts by reading where the sculpture stands and ends by writing that down.

Two files carry the project across sessions:

- **VISION.md**: what we are building. It is stable, it is the source of truth, and it is imported below, so it is always in context.
- **LOG.md**: what exists, what happened, and what comes next. It changes every session.

@VISION.md

---

## The session loop

This loop applies to coding sessions. If the director only asks a question or wants to discuss something, just answer.

### 1. Orient

1. VISION.md is already loaded above. Locate the current stage's exit criteria in §8.
2. Read LOG.md: the **Current state** block and the 3 most recent session entries. Read older entries only when they are relevant.
3. Check reality: run `git status`, `git log --oneline -10`, and `pnpm check` (once it exists). **If the log and the code disagree, the code wins.** Note the mismatch in this session's entry.

### 2. Choose the cut

Pick **exactly one** cut. Apply these rules in order:

1. **Broken build first.** If `pnpm check` fails, or the last entry is marked `incomplete`, the cut is to fix or finish it.
2. **Director's request.** If the director asked for something, do it. First check it against VISION.md and say so if it conflicts.
3. **Next cuts.** Otherwise, take the top item from *Next cuts* in LOG.md, or derive a cut from the current stage's unmet exit criteria.
4. **Whole before parts.** Prefer the cut that makes the whole figure more complete over one that perfects a single part. Don't add detail beyond the current stage.
5. **Size.** A cut must be finishable and verifiable in one session. If it isn't, split it and take the first slice.

Before writing code, tell the director in 3–5 lines: **the cut**, **why it's next**, **how you'll verify it**, and **what's out of scope**. Then proceed, unless the cut would change VISION.md or the architecture. In that case, wait for approval.

### 3. Carve

- Stay inside the cut. Anything else you notice goes into *Next cuts* or *Known issues*; don't fix it now.
- For sim work, write the scenario test alongside the code, not after it.
- Before using PixiJS, Vite, Vitest, Playwright, zod or Capacitor APIs, look up current docs via Context7. PixiJS v8 differs a lot from v7.
- Refine; don't rebuild. Only rewrite a part when the log records why.
- Extract an abstraction when its second use appears, not before.

### 4. Verify

A cut is done when all of the following hold:

- `pnpm check` is green (typecheck, lint, tests).
- **Sim changes:** a scenario test covers the new behavior, and a headless bot-vs-bot match runs to completion with invariants on.
- **Golden replays:** hashes still match. If a change is intentional, regenerate the goldens and record the reason in the log.
- **Visual changes:** capture a deterministic screenshot and actually look at it.
- **Feel changes:** list what the director should playtest. The agent can't sign off on feel.

If verification fails and can't be fixed within this session, revert to green and log the cut as `incomplete`.

### 5. Record

1. **Prepend** a session entry to LOG.md using the template below.
2. **Rewrite** the *Current state* block so it's true right now: stage, what works, known issues, and the ordered *Next cuts* (3–5 items).
3. If a stage's exit criteria are all met, mark the stage complete and move to the next one.
4. Commit: `S<n>: <cut title>`.

### Session entry template

```markdown
### S<n> · YYYY-MM-DD · <cut title>
**Stage:** <n — name>
**Cut:** <one sentence: what and why>
**Done:** <bullets: what now exists>
**Verified:** <commands run, tests added, screenshots taken>
**Decisions:** <any, with reason — or "none">
**Left out / noticed:** <moved to Next cuts or Known issues>
**Status:** complete | incomplete (<what remains>)
```

Keep entries under ~15 lines and the *Current state* block under ~30 lines. The log is memory; it isn't a diary.

---

## Hard rules

These come from VISION.md §5. Breaking any of them breaks determinism, replays and PvP.

- `packages/sim` imports nothing from the project and has zero runtime dependencies.
- The sim never uses floats in state, `Math.random`, `Date`, timers, async, the DOM, classes or Maps in state, or unordered iteration.
- The client never writes to sim state. All input becomes commands.
- Game numbers live in `packages/content`, never hard-coded in the sim or the client.
- Every match can be reproduced from its replay.
- Never edit VISION.md without the director's approval. Propose the change in chat; once it's accepted, edit the file and add a row to §10 Decisions.
- Original names and assets only (VISION.md §1).

## Commands

Update this table when a command is added or changes.

| Command | Status | Purpose |
|---|---|---|
| `pnpm check` | ✅ | typecheck + lint + all tests (the definition of green) |
| `pnpm typecheck` | ✅ | `tsc` on the root config files, then on every package |
| `pnpm lint` | ✅ | ESLint, zero warnings allowed |
| `pnpm test` | ✅ | Vitest, every package as a project; `pnpm test packages/sim` for one |
| `pnpm sim` | ✅ | tools CLI (`node packages/tools/src/cli.ts`); prints usage |
| `pnpm sim match --seed <n> [--dump <tick>] [--replay <file>]` | ✅ | headless random bot vs random bot on the starter decks (the seed decides it all), replayed with invariants checked every tick; prints result + final hash and saves the replay (default `replays/seed-<n>.json`), or prints the state at `<tick>` as JSON |
| `pnpm sim replay <file> [--dump <tick>]` | ✅ | validates a replay file and plays it back; same output as `match` |
| `pnpm sim sweep --matches <n> [--from <seed>]` | ✅ | plays n headless bot-vs-bot matches on consecutive seeds (default from 0), each live and then played back from its replay with invariants every tick, and the two final hashes must agree. Prints results, length, stars, tower damage, plays per card and rejections, then each failing seed with the `match` command that reproduces it; exits non-zero if any failed. 1,000 matches take ~45 s |
| `pnpm sim goldens [--update] [--dir <dir>]` | ✅ | plays every golden replay in `goldens/` with invariants every tick and compares its state hash every 200 ticks and at its end with `goldens/hashes.json`; prints each golden and the first tick that differs, and exits non-zero if any does (`pnpm check` runs the same check). `--update` stores fresh hashes: only after an intended change, logged with its reason. Add a golden with `pnpm sim match --seed <n> --replay goldens/seed-<n>.json`, then `--update` |
| `pnpm dev [--host]` | ✅ | client dev server (Vite); `--host` exposes it to a phone on the LAN. Plays seed 0 (or `?seed=<n>`) live as side 0 against the random bot on side 1. At the end it shows the result, keeps the replay in localStorage (`factor.lastReplay`), and offers *Play again* (a fresh random seed) and *Save replay* (a JSON download). `?replay=last` plays that replay back, and `?replay=<url>` plays a file (a saved match: `?replay=/@fs/<absolute path>/replays/seed-42.json`). `?tick=<n>` plays either to tick n with no taps and freezes it there |
| `pnpm playtest [--out <dir>]` | ✅ | plays one live match in the client in headless Chromium in real time (3–5 min): side 0 taps a card, then a spot 5 tiles short of the river in line with a bridge, every 4 s against the bot. Then it plays the saved replay back headless with invariants on, watches it with `?replay=last`, and checks that both end screens are the same pixels. Prints the result, plays taken and rejected, and errors; saves `playtest-live.png` and `playtest-replay.png` in `<dir>` (default `shots`) and `replays/playtest.json`. Exits non-zero on a page error or a mismatch. Needs Chromium, like `shots` |
| `pnpm shots [--out <dir>] [--replay <file>] [--tick <n>]` | ✅ | headless Chromium saves the client frozen at tick 90 (the bot has played once) as `shots/arena.png` and the end of bot-vs-bot seed 0, played back via `?replay=`, as `shots/end.png`, and prints their sha256. `--replay <file>` shoots that replay at `--tick` (default: its end); `--tick` alone shoots the live match. A fresh machine first needs `pnpm --filter @factor/tools exec playwright install --only-shell chromium`, or `FACTOR_CHROMIUM=<path>` to use another Chromium build |

## Conventions

- TypeScript strict, ESM, no `any`, no non-null `!` in the sim.
- No build step: packages export `./src/index.ts`, and Node runs `.ts` directly. So use only erasable syntax (no `enum`, `namespace` or parameter properties; `erasableSyntaxOnly` enforces this), and relative imports end in `.ts`.
- TypeScript is pinned to `~6.0`: typescript-eslint doesn't support 7 yet. Check its peer range before upgrading.
- ESLint enforces the sim's hard rules (`eslint.config.js`). Don't disable those rules inline; if one blocks legitimate work, raise it with the director.
- The sim and content packages have no DOM or Node types (`types: []`), so browser and Node APIs don't typecheck there.
- Use the terms from VISION.md §9 in code, tests and UI.
- Name tests after the behavior: `outpost-targets-nearest-enemy.test.ts`.
