# VISION

> Foundational document. Read at the start of every session. Changes only with the director's approval, recorded in §10 Decisions.

**Codename:** Factor (working title — see §11)
**Last revised:** 2026-09-29

---

## 1. What we are building

A real-time, 1v1, two-lane card battler for mobile-first web: each player deploys troops, spells and buildings from a rotating hand, spending a regenerating energy bar, to destroy the opponent's towers within a three-minute match. The genre is the one Clash Royale defined. We clone the **mechanics**, never the art, names, characters or branding. Everything visible is original.

It is built by an AI coding agent working in sessions, directed by a human. The architecture is designed around what the agent can verify on its own: game logic as text, matches reproducible from a seed, and still images captured at exact moments.

### Who does what

| Human (director) | Agent (builder) |
|---|---|
| Vision, priorities, taste | Code, tests, tools, refactors |
| Game feel and fun: playtesting on real devices | Scenario tests, invariants, determinism |
| Art direction, asset choices | Balance data from headless sweeps |
| Approving changes to this document | Proposing the next cut, logging each session |

## 2. Experience pillars

Every feature is judged against these. When two conflict, the earlier one wins.

1. **Fair.** Same inputs, same outcome. No hidden randomness decides a fight.
2. **Readable.** A glance explains any fight: who targets whom, why a tower fell.
3. **Tense.** A meaningful decision every few seconds; energy is always scarce.
4. **Snappy.** Deploy feedback under 100 ms. Hits land with weight.

## 3. Scope

**v1 (stages 0–4):** single-player against a bot, in the browser, installable on phones via Capacitor. 16 cards, one arena, deck builder, replays.

**Post-v1 (stage 5):** online PvP with a server-authoritative sim.

**Non-goals until the director says otherwise:** monetization, loot boxes, card levels and progression grind, accounts, clans, chat, 3D, native engines, and any Supercell asset, name or trademark.

## 4. Core rules

The rules are the spec. Numbers are initial values. They live in `content/`, not in code, and are tuned from data and playtests.

**Arena.** Portrait, 18 × 32 tiles. A river crosses the middle and can only be crossed at two bridges, one per lane (flying units ignore the river). Each side has a **Keep** at the back center and two **Outposts** in front of it, one per lane.

**Towers.** Outposts are active from the start. The Keep is dormant until it takes damage or one of its own Outposts falls. Towers attack the nearest enemy in range, ground or air.

**Energy.** Start with 5, max 10, +1 every 2.8 s. Regeneration is 2× in the final 60 s and in overtime.

**Deck and hand.** A deck has 8 cards, shuffled from the match seed. The player holds 4 cards and can see the next one. Playing a card needs energy ≥ its cost and a legal position. The played card goes to the back of the queue and the next card enters the hand.

**Deploy zone.** Troops and buildings deploy only on your own half. Destroying an enemy Outpost extends your zone into that lane's side of the enemy half. Spells can target anywhere.

**Card types.**
- **Troop:** spawns N units after a 1 s deploy delay.
- **Spell:** an instant area effect at a point. It deals reduced damage to towers.
- **Building:** static and targetable. Its HP decays over its lifetime.

**Unit stats:** hp, damage, hit interval, first-hit delay, range, sight range, move speed, target filter (`ground | air | buildings`), layer (`ground | air`), radius, mass, count, splash radius, projectile speed (none = melee).

**Targeting.** A unit acquires the nearest valid target within sight range. With no target in sight, it follows its lane toward the nearest enemy tower. While attacking it stays locked on, and retargets only when the target dies or leaves range.

**Movement.** A unit follows its lane (chosen by its x position) across that lane's bridge, then moves toward its target. Units are circles and push each other based on mass. Flying units ignore ground collision and the river.

**Winning.** Destroying an Outpost earns 1 star. Destroying the Keep earns 3 stars and ends the match. After 3:00, the player with more stars wins. If stars are tied, overtime runs up to 2:00 and the first star wins. If still tied, the side whose lowest-HP tower has less HP loses. An exact tie is a draw.

## 5. Architecture

TypeScript everywhere. pnpm workspaces monorepo.

```
packages/
  sim/      deterministic rules engine. Zero runtime dependencies.
  content/  cards, units, arena as data + zod schemas.
  bot/      AI opponent: observation → commands. Deterministic.
  client/   Vite + PixiJS v8. Renders sim state; turns input into commands.
  server/   (stage 5) Node, runs the same sim authoritatively.
  tools/    CLI: match, replay, sweep, shots.
```

Dependencies point one way: `sim ← content ← bot ← {client, server, tools}`. Nothing in `sim` imports from anywhere else in the project.

**Sim contract.**
- `step(state, commands) → state` advances exactly one tick. It is a deterministic function of its inputs.
- **20 ticks/s.** All time is measured in ticks.
- **Integers only.** Positions are in milli-tiles (1 tile = 1000). Percentages are in basis points. There is no trigonometry; directions come from integer vectors and integer square roots.
- **Seeded RNG** is stored in the state. There is no `Math.random`, no `Date`, no timers, no async, and no DOM.
- **State is plain JSON:** no classes or Maps. Entities are iterated in ascending id order.
- **State hash per tick** (FNV-1a over a canonical serialization). It is used for golden tests and later for desync detection.
- **Commands** are `{ tick, side, handSlot, x, y }`. The sim validates them. Invalid commands do nothing and are recorded.

**Client.** It runs the sim locally in v1. It renders by interpolating between the previous and current tick, at the display's refresh rate. It never writes to sim state.

**Replay.** `{ version, seed, decks, commands[] }`. A seed plus the command log reproduces the match exactly.

## 6. The agent's senses

These tools exist so the agent can see what it builds. They are first-class features, built early and kept working.

| Sense | What it gives |
|---|---|
| State dump | `pnpm sim match … --dump 600` prints the full state at tick 600 as JSON |
| Replays | Every match auto-saves one; any bug becomes a reproducible test |
| Scenario tests | "Tank + ranged on the left lane → Outpost HP at tick 600 == X" |
| Golden replays | Stored hash per checkpoint tick; any unintended rule change fails loudly |
| Invariants | Checked every tick in dev and tests: hp ≤ max, energy in [0, 10], nothing outside the arena, ids unique |
| Headless sweeps | Thousands of bot-vs-bot matches → win rate per card, match length, tower damage |
| Deterministic shots | Playwright opens `?replay=…&tick=…&debug=1` → PNG with ranges, targets and paths drawn |
| Dev panel | Tunables hot-reloaded from `content/`, so the director can tune feel live |

## 7. Quality bar

- Zero nondeterminism: identical hashes across runs, machines and browsers.
- Every card has scenario tests for its defining behavior.
- Zero invariant violations across a 1,000-match sweep.
- 60 fps with 60 units plus effects on a mid-range 2021 phone (target device: §11).
- Cold load under 3 s on 4G. No known crash.
- `pnpm check` is green at the end of every session.

## 8. Stages

We work like a sculptor: rough out the whole figure first, then refine it everywhere. Never detail one part while the whole is still a lump. Each stage has exit criteria, and a stage is done only when all of them hold.

**Stage 0 — Armature** (skeleton and senses)
- Monorepo, TS strict, and `pnpm check` (typecheck + lint + tests) all green.
- Sim: state, seeded RNG, fixed tick, and state hash. A test proves that the same seed and commands give the same hash at tick 1000.
- `pnpm sim match` runs an empty match to the end of the timer and prints the result.
- The client draws the arena (tiles, river, bridges, towers as shapes) from sim constants, and `pnpm shots` saves a PNG.
- Replay format v0 with a save/load round-trip test.

**Stage 1 — Block-in** (the whole match loop, crude)
- A human can play a full match in the browser against a bot, from start to finish.
- Energy, hand of 4 plus next, card cycling, timer, stars, and a win/lose/draw screen.
- 4 cards drawn as colored shapes: a building-targeting tank, a melee unit, a ranged unit, and a damage spell.
- Towers shoot and fall. Units cross bridges and fight (crude pathing and targeting are fine).
- A random-legal-move bot. Replays auto-save and play back in the client via `?replay=`.
- The headless CLI plays bot vs bot to completion.

**Stage 2 — Form** (the rules correct)
- Every rule in §4 is implemented and covered by scenario tests: target filters, flying units, lock-on/retarget, collision and pushing, deploy delay, Keep activation, deploy zone extension, 2× energy, overtime, tiebreak.
- 8 cards covering the archetypes: tank, melee, ranged, swarm, flyer, splash, spell, building.
- Golden replays in place. A 1,000-match sweep shows zero invariant violations and zero hash mismatches.

**Stage 3 — Detail** (content and feel)
- 16 cards. A heuristic bot that defends, counter-pushes, and manages energy.
- Balance sweeps flag outliers, and the director reviews them.
- Sprites, animations, hit effects, SFX. UI: deck builder, hand, energy bar, timer, results.
- The director signs off on game feel after playing on a real phone.

**Stage 4 — Polish** (shippable v1)
- The §7 performance and load targets are met on the target device.
- A tutorial match, menus, and settings. Capacitor builds for iOS and Android. No known crashes.

**Stage 5 — Online** (post-v1)
- Server-authoritative PvP over WebSocket, running the same sim. Hash-based desync detection, reconnect, and simple matchmaking.

## 9. Glossary

**Arena**: the 18 × 32 tile field. **Lane**: the left or right half of the arena, each with one bridge. **Keep**: the central tower. **Outpost**: a lane tower. **Star**: the scoring unit. **Energy**: the resource used to play cards. **Tick**: one sim step (50 ms). **Command**: a player action at a tick. **Replay**: seed + decks + commands. **Scenario**: a scripted sim test. **Golden**: a stored hash that locks behavior. **Cut**: one session's unit of work (see CLAUDE.md).

## 10. Decisions

| # | Date | Decision | Why |
|---|---|---|---|
| D1 | 2026-09-29 | Own deterministic sim + PixiJS v8 as the renderer; no full game engine | Custom code goes where the agent can verify it (logic); borrowed code goes where it can't (rendering, input, platform quirks) |
| D2 | 2026-09-29 | Integer-only sim at 20 ticks/s | Determinism across JS engines. Replays, goldens and PvP all depend on it |
| D3 | 2026-09-29 | TypeScript end to end, pnpm monorepo | The agent's strongest ecosystem; client and server share the sim |
| D4 | 2026-09-29 | Single-player vs bot first, PvP later | Fun gets proven before netcode; the architecture stays PvP-ready |
| D5 | 2026-09-29 | Original names and assets only | The mechanics are fair game; the IP isn't |
| D6 | 2026-09-29 | Sculpt coding: one cut per session, logged in LOG.md | Keeps the whole working and gives each new session its context back |

## 11. Open questions (director to decide)

- Final title and setting/theme.
- Art direction: geometric placeholders until stage 3, then which style, and where the assets come from.
- Target test device for the §7 performance bar.
- Whether PvP moves into v1.
