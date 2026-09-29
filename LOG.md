# LOG

Sculpt log. The **Current state** block is rewritten at the end of every session. Session entries are prepended, so the newest is first. Workflow: CLAUDE.md.

---

## Current state

**Stage:** 0 — Armature (in progress: exit criterion 1 of 5 met)
**Last session:** S1 · 2026-09-29
**Works:**
- A pnpm monorepo with `sim`, `content`, `tools` and `client` packages, strict TS 6.0, no build step.
- `pnpm check` is green: typecheck, lint, 5 tests.
- ESLint enforces the sim's hard rules (imports, Math/Date/timers, async, classes, `**`, float literals).
- `pnpm sim` runs the tools CLI stub directly under Node 24.
**Known issues:** No formatter configured yet (the code follows the existing style by convention).
**Golden replays:** none

**Next cuts** (in order):
1. Sim skeleton: state type, seeded RNG in state, fixed-tick `step`, canonical state hash, and a determinism test (same seed → same hash at tick 1000). Add a JSON round-trip test for state (VISION §5: plain JSON).
2. Match timer and end-of-match result in the sim; `pnpm sim match` runs an empty match headless and prints the result.
3. Client skeleton: Vite + PixiJS v8 draws the arena (tiles, river, bridges, towers as shapes) from sim constants; `pnpm shots` saves a PNG.
4. Replay format v0 with a save/load round-trip test.

---

## Sessions

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
