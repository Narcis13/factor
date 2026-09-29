# LOG

Sculpt log. The **Current state** block is rewritten at the end of every session. Session entries are prepended, so the newest is first. Workflow: CLAUDE.md.

---

## Current state

**Stage:** 0 — Armature (in progress: exit criteria 2 of 5 met)
**Last session:** S2 · 2026-09-29
**Works:**
- A pnpm monorepo with `sim`, `content`, `tools` and `client` packages, strict TS 6.0, no build step.
- `pnpm check` is green: typecheck, lint, 37 tests.
- ESLint enforces the sim's hard rules (imports, Math/Date/timers, async, classes, `**`, float literals), in sim tests too.
- Sim: `createMatch({ seed })`, pure `step(state, commands)` at a fixed tick, sfc32 RNG in state, `hashState` (FNV-1a over canonical JSON, 8 hex digits). Commands are validated; with hands still empty, every one is rejected and recorded in the next state.
- `pnpm sim` runs the tools CLI stub directly under Node 24.
**Known issues:**
- No formatter configured yet (the code follows the existing style by convention).
**Golden replays:** none (the RNG sequence is pinned in `rng-sequence-is-fixed-per-seed.test.ts`)

**Next cuts** (in order):
1. Match timer and end-of-match result in the sim, with the match length passed in from `content` through `MatchSetup` (the sim can't import content). `pnpm sim match --seed <n> [--dump <tick>]` runs an empty match headless and prints the result and final hash.
2. Client skeleton: Vite + PixiJS v8 draws the arena (tiles, river, bridges, towers as shapes) from sim constants; `pnpm shots` saves a PNG.
3. Replay format v0 with a save/load round-trip test; zod-validate commands loaded from outside (the sim trusts `Command` field types).

---

## Sessions

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
