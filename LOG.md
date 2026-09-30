# LOG

Sculpt log. The **Current state** block is rewritten at the end of every session. Session entries are prepended, so the newest is first. Workflow: CLAUDE.md.

---

## Current state

**Stage:** 1 — Block-in
**Last session:** S13 · 2026-09-30
**Works:**
- A pnpm monorepo with `sim`, `content`, `bot`, `tools` and `client` packages, strict TS 6.0, no build step.
- `pnpm check` is green: typecheck, lint, 302 tests (one of them drives headless Chromium).
- ESLint enforces the sim's hard rules (imports, Math/Date/timers, async, classes, `**`, float literals) in the sim and its tests, and in the bot (which may import only `sim` and `content`).
- Sim: `createMatch(setup)`, pure `step(state, commands)` at a fixed tick, sfc32 RNG in state, `hashState`. `MatchSetup` carries rules, the `ArenaLayout`, tower stats, a card catalog and both decks.
- Players: energy 5 → 10, +1 per 56 ticks, 2× from 2:00 and in overtime. Decks of 8 shuffled from the seed; hand of 4 + queue; plays spend and cycle, with 5 rejection reasons.
- Troops deploy one `Unit` on their own half, wait 20 ticks, then act: lock-on, acquisition in sight (`ground | buildings`), lane and bridge walking (a goal on a bridge is reached over that bridge), hits `firstHitTicks` after locking on and then every `hitTicks`. Towers lock on to the nearest enemy unit in range. All of a tick's hits land together; the dead leave; an Outpost gives 1 star, the Keep brings its destroyer to 3 and ends the match.
- Spells land instantly anywhere: every enemy unit or tower their circle touches takes `damage`, towers only `towerDamageBp` of it.
- Match timer and result: 3:00 regulation, then up to 2:00 overtime while stars are tied.
- Bot: `createRandomBot`/`botTurn` (pure, own seeded rng): a random slot, a 1–4 s wait (`BOT_TUNING` in content), then a play once affordable — troops on a random own-half tile center, spells on a random enemy. `playBotMatch(seed)`.
- Content: `CARDS` (juggernaut, warden, slinger, flare), `TOWER_STATS`, `MATCH_RULES`, `ARENA`, `BOT_TUNING`, `matchSetup(seed, decks?)`, replay v0.
- `pnpm sim match --seed <n>` plays bot vs bot, saves the replay with both bots' commands, and `pnpm sim replay` agrees (seed 42: side 1 wins 0-1 at 3:00, `5d516ada`). 2,000 seeds: 0 invariant violations, 0 replay mismatches, 957/999/44 wins/wins/draws.
- Client: `pnpm dev` runs seed 0 live, human side 0 vs the bot on side 1; the loop records both into `loop.commands`. `?tick=` plays the bot too. `pnpm shots` is `d33ad2f0f71a`.
**Known issues:**
- No formatter configured yet.
- Units don't collide, and they can be deployed on a tower's footprint. No Keep dormancy (Stage 2).
- Hp bars are thin (4 px at phone size). Units are small and low-contrast on the grass. The flare marker's fill is faint.
- The client shows no stars and nothing when the match ends.
- Shots need Playwright's pinned Chromium or `FACTOR_CHROMIUM=<path>`. In the cloud container use `FACTOR_CHROMIUM=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`.
- Replays don't carry rules, layout or stats; a content change silently changes what an old replay plays.
- Context7 isn't reachable from the cloud container; library APIs were checked against the installed type definitions.
- `stepTo` in the client is now used only by tests.
**Golden replays:** none (the RNG sequence and the seed-1234 shuffle are pinned in tests)

**Next cuts** (in order):
1. Stars on the HUD and a win/lose/draw screen; the client auto-saves the replay of a finished match.
2. `?replay=` plays a replay back in the client, and `pnpm shots` learns `?replay=&tick=`.
3. Stage 1 exit review: play a full match against the bot headless and in the browser, then close the stage.
4. `pnpm sim sweep --matches <n>` (the 2,000-seed check from S13 as a real command), ahead of Stage 2's 1,000-match criterion.

---

## Sessions

### S13 · 2026-09-30 · A random bot plays side 1
**Stage:** 1 — Block-in
**Cut:** A random-legal-move bot (Next cuts 1) in a new `packages/bot`: it plays side 1 in the client and both sides in `pnpm sim match`, and its commands go into the replay.
**Done:**
- Bot: `random-bot.ts` (`RandomBot` is plain JSON with its own sfc32 rng seeded from the match seed and side; `botTurn` is pure) and `bot-match.ts` (`playBotMatch`). Content: `BOT_TUNING` (1–4 s between plays).
- Tools: `botReplay(seed)`; `match` now plays bot vs bot, saves that replay and plays it back with invariants.
- Client: `MatchLoop.bots`, asked every tick; `tickOnce` is shared by `advance` and the new `runTo`, which `?tick=` uses, so a shot shows what live play would show.
- Sim fix: a unit chasing an enemy that stands on a bridge past the river's middle walked straight through the water. It now goes to that bridge's end on its own bank first (`bridgeEnd`, `bridgeSpan`, `bridgeUnder`). The bot found it: 15 of 1000 seeds broke the river invariant.
**Verified:** `pnpm check` green (40 files, 302 tests; 22 new). Bot scenarios: 7 seeds end with invariants held and zero rejections; troops on own-half tile centers; spells on standing enemies (units too); minimum waits and saving up; the same seed gives the same match; independent rng streams; no mutation; silence after the result. Client: bot commands recorded and replayable alongside taps; `runTo` equals live play. Sim: 3 bridge scenarios, all failing without the fix. 3 bot mutations each caught. A 2,000-seed sweep: 0 violations, 0 mismatches. `match` vs `replay` agree for seeds 42 and 1259. I looked at the shot (`d33ad2f0f71a`, twice): a side-1 juggernaut at 2:56.
**Decisions:** The bot has its own rng, so it never touches the match's. Its pacing is data in `content`. The CLI's match is bot vs bot, and `emptyReplay` remains as a fixture. Seed 42's hash changed from `53f43fdb` on purpose (commands now). The troop-match scenario now ends at tick 774 instead of 760, because of the bridge fix.
**Left out / noticed:** Stars and the end screen (Next cuts 1). The sweep command (Next cuts 4). **Playtest (director):** is the bot a fair sparring partner, and does 1–4 s between plays feel right?
**Status:** complete

### S12 · 2026-09-29 · Flare deals area damage
**Stage:** 1 — Block-in
**Cut:** Give `flare` its effect (Next cuts 1): instant area damage at the aim point, reduced against towers, with a brief marker in the client. The last Stage 1 card that did nothing.
**Done:**
- Sim: `SpellStats` (radius, damage, `towerDamageBp`) on spell cards, validated in `createMatch`. `spells.ts`: `blastHits` (enemy towers whose footprint the circle touches, then enemy units whose circle it touches; squared compares, exact) and `Blast`. `step` collects spell hits while resolving commands and lands them with the fight's. `state.blasts` holds this tick's spells. New: `squaredDistanceToRect`, `BASIS_POINTS`, and a blast invariant. `place`/`runChecked` moved into the fixtures (second use).
- Content: flare is 2.5 tiles, 500 damage, 3000 bp to towers.
- Client: the loop keeps `blasts` for `BLAST_TICKS` (10); `blastScene` and `drawBlasts` draw the area in the card's color, ringed in the caster's, fading out.
**Verified:** `pnpm check` green (36 files, 280 tests; 12 new). Scenarios: circles that exactly touch vs. 1 mm clear, own units and towers spared, the tower share (30 of 100), tower edge touching vs. clear, a flare kill leaving the field, a flare-felled Outpost scoring, energy and cycling, blasts in side order for one tick only, a flare landing on a unit deployed earlier the same tick, and bad spell stats rejected. A scripted troops-and-flares match plays to its end with invariants on, twice to the same hash. 4 mutations were each caught. `pnpm shots` is unchanged (`152f06566ee3`). A live headless run cast a flare on the enemy Outpost: the circle showed, the bar notched, and it was gone 1 s later, with no page errors (looked at both). Seed 42 → `53f43fdb` in both `match` and `replay`.
**Decisions:** A spell picks its victims when its command resolves and its hits land with the fight's, so a unit it kills still acts that tick, as with any hit (pillar 1). Spells hit enemies only. The marker's half-second life is a client display number, so it lives in the client, not in `content`. Seed 42's hash changed from `81d7d01a` on purpose (the state grew).
**Left out / noticed:** Spell hits on towers don't wake anything yet (Keep dormancy, Stage 2). The marker's faint fill is in Known issues. **Playtest (director):** does a flare read at a glance? Are 2.5 tiles and 500 damage (a slinger dies, a warden survives) the right feel?
**Status:** complete

### S11 · 2026-09-29 · Units and towers fight
**Stage:** 1 — Block-in
**Cut:** First slice of Fighting (Next cuts 1, split): targeting, lock-on and hits for units and towers, deaths, stars, and the Keep ending the match, with hp bars in the client. `flare` is the next slice.
**Done:**
- Sim: `AttackStats` (damage, hitTicks, firstHitTicks, range) on `TowerStats` and `UnitStats` (plus sight and `targets`). `Tower`/`Unit` gain `targetId` and `cooldown`; the state gains `towerStats`. `troops.ts`: `actUnit` (lock-on, acquisition, goal-based bridge routing), `actTower`, `Hit`. `step` gains `fight`: towers then units act, hits land together, the dead leave, fallen towers score. `decideResult`: a fallen Keep ends the match. New invariants: stars ≤ 3, a fallen Keep has a result, and attack fields are integers.
- Content: fighting stats for the three troops and both towers.
- Client: `hpBarScene`, `drawHpBars`, rubble for fallen towers; `UnitShape` carries hp.
**Verified:** `pnpm check` green (34 files, 268 tests; 16 new). Scenarios cover: tower lock-on and hit timing (ticks 6, 16), nearest target and staying locked, retargeting when out of range, a walker duel falling together at tick 96, a dying archer still landing its hit, sight before the tower, buildings-only ignoring units, an Outpost star, a Keep ending the match at tick 56 with 3 stars, and a double Keep draw. Mirror fights end on the same tick; the scripted match plays to a Keep kill (tick 760) with invariants on. With content numbers, a one-sided push takes an Outpost at ~1:20 and the Keep at 2:40. 7 mutations were each caught. The shot is `152f06566ee3` (tower bars); a live headless run showed a damaged Outpost bar and no page errors (looked at both). Seed 42 → `81d7d01a` in both `match` and `replay`.
**Decisions:** Hits are decided first and land together, so no side hits first (pillar 1). The Keep sets its destroyer's stars to 3; stars never exceed 3. Ranged units check range before walking, which fixes the far-bank stop. Movement tests use a no-damage `walkMatch`. Seed 42's hash changed from `551f99dc` on purpose (the state grew).
**Left out / noticed:** Flare (Next cuts 1). Keep dormancy, collision and air are Stage 2. Hp bar size and unit contrast are in Known issues. **Playtest (director):** do fights read at a glance? Do wardens and slingers survive long enough under an Outpost? Are hp bars visible on a phone?
**Status:** complete

### S10 · 2026-09-29 · Troops deploy and walk
**Stage:** 1 — Block-in
**Cut:** First slice of the Stage 1 cards: troop/spell types, the own-half deploy zone, units that wait out a 1 s deploy delay and walk their lane over the bridge to the nearest enemy tower, drawn interpolated in the client. Fighting is the next slice.
**Done:**
- Sim: `CardStats` is a `troop` (with `UnitStats`) / `spell` union; `MatchRules.deployDelayTicks`; the state gains `units` and `nextId`. `geometry.ts` (`isqrt`, `divRound`, `distanceToRect`, `moveToward`), `troops.ts` (`Unit`, `deployZone`, `actUnit`). New rejection `outside-deploy-zone`; non-integer aims are `out-of-bounds`. Unit invariants: ids, hp, deploy ticks, inside the arena, never in the river off a bridge, from a known troop.
- Content: unit stats for juggernaut/warden/slinger, flare is a spell, `deployDelayTicks: 20`.
- Client: `groundScene`/`towerScene`/`unitScene`/`noDeployRect`, `palette.ts`; the ground is drawn per resize and the field every frame.
**Verified:** `pnpm check` green (32 files, 252 tests; 32 new). Scenario tests: the spawn (id, hp, delay), shared id order, the deploy zone on both sides at its edges, spells anywhere, fractional aims, still for 20 ticks then walking, a melee walk arriving at tick 210 exactly, an off-lane unit using only the bridge, the middle column going right, a ranged stop, both sides mirroring tick for tick over 500 ticks, and a 300+-troop scripted match with invariants every tick and a repeatable hash. 6 mutations were each caught. `pnpm sim match --seed 42` → `replay`: `551f99dc` both. `pnpm shots` is unchanged (`cbb808843d3f`). A live headless run with plays: units walk both lanes and cross; the shade shows; an enemy-half aim is refused; no page errors (looked at it).
**Decisions:** One unit per troop until the swarm card needs `count`. A unit's stats stay on its card in `state.cards`. Movement: the entrance is the bridge's near bank, straight ahead where the unit's radius fits; after the far bank, straight at the nearest enemy tower's center (ties go to the lower id). Commands resolve before units act, so a new unit's delay counts down in the tick it appears. Seed 42's hash changed from `dacd0676` on purpose (the state grew).
**Left out / noticed:** Fighting and spells (Next cuts 1); collision, tower-footprint deploys, the ranged bank stop, unit contrast (Known issues). **Playtest (director):** do unit speeds and the 1 s delay feel right, and are units readable at phone size?
**Status:** complete

### S9 · 2026-09-29 · The client plays the match live
**Stage:** 1 — Block-in
**Cut:** Run the sim live in the client at 20 ticks/s with a HUD (clock, energy, hand, next), and turn "tap a card, then the arena" into commands (Next cuts 1).
**Done:**
- Client: `match-loop.ts` (fixed-step loop, a 5-tick cap per frame, previous/current + `alpha`, plays stamped with the tick they're stepped on and recorded, `stepTo`); `screen-layout.ts` (arena above a phone-width HUD band, `toArena` for taps); `hud-view.ts` (pure HUD model: clock, interpolated energy fill, card faces, next); `controls.ts` (`tap`); `draw-hud.ts` (retained Pixi Graphics + Text). `main.ts` wires them together; `?tick=<n>` freezes the match there.
- Tools: `pnpm shots` opens `?tick=90` (`SHOT_TICK`).
**Verified:** `pnpm check` green (29 files, 220 tests; 19 new). Tests cover: frame-rate independence at 60/144 Hz, sub-tick frames and alpha, the stall cap, the loop matching direct stepping by hash, command stamping and recording, stopping at the result, the clock (regulation, rounding up, overtime), energy interpolation, affordability and selection, per-side HUDs, layout without overlaps on a phone and centered on desktop, screen → arena mapping at tile centers and edges, and tap/select/deselect/play. `pnpm shots` twice gave `cbb808843d3f` both times; I looked at it (2:56, energy 6.6, hand, next). A live headless run: select warden → yellow edge; tap the arena → energy 6 → 3, slinger takes the slot, flare is next; no page errors.
**Decisions:** The client doesn't pre-validate plays; the sim decides, and rejected plays stay in `state.rejected`. A tap clears the selection even if the play gets rejected. Frame-time floats are fine in the client; only the sim is integer-only. The shot moved from tick 0 to 90 on purpose, so the HUD shows motion.
**Left out / noticed:** Stars, end screen and bot moved into Next cuts. The static arena redraw is a Known issue. **Playtest (director):** on a phone via `pnpm dev --host`: are the cards big enough to hit, and does select-then-tap feel right?
**Status:** complete

### S8 · 2026-09-29 · Energy, hand and deck cycling
**Stage:** 1 — Block-in
**Cut:** Give each side energy, a deck shuffled from the seed, and a hand of 4 plus next, so a played card spends energy and cycles (Next cuts 1). Units wait for cut 3.
**Done:**
- Sim: `cards.ts` (`CardStats`, `EnergyRules`, `Player`, deal/play/regenerate), `nextBelow` (rejection sampling) and `shuffle` (Fisher–Yates) in `rng.ts`. `MatchRules` gains `deckSize`, `handSize` and `energy`; `MatchSetup` gains `cards` and `decks`; the state gains `cards` and `players`. `step` resolves plays, then regenerates. New invariants: energy range, progress, hand/queue sizes, known cards.
- Content: `cards.ts` (`CARDS`, `CARD_IDS`, `STARTER_DECK`), energy and deck rules in `MATCH_RULES`, `matchSetup(seed, decks = STARTER_DECKS)`, and replay decks validated as 8 known ids. Tools play a replay's own decks.
**Verified:** `pnpm check` green (26 files, 201 tests). Scenario tests: 56-tick regen, the cap at 10 with no build-up, 28 ticks from 2:00 and in overtime, overshoot carried unless the bar fills, a play spending and cycling, exact-cost plays, same-tick plays seeing each other, per-side isolation, slot-0 cycling in a lap of 5, each rejection reason, a per-seed pinned shuffle, uniform first cards over 8000 seeds, and bad setups rejected. Determinism test now covers legal plays. 7 mutations were each caught (one only after adding the overshoot test). `pnpm sim match --seed 42` → `replay` both hash `dacd0676`. `pnpm shots` is byte-identical to HEAD before the cut.
**Decisions:** Energy is whole `energy` plus `energyProgress` in normal-rate ticks, which is exact where milli-energy would round 1000/56. Deck and hand sizes and energy numbers are rules from `content`. The state carries only the stats of cards in the decks. Commands resolve in order against the state they build on; regeneration comes after them. Stage 1 card names are original placeholders; with 4 cards, the starter deck holds each twice. Replays stay version 0 (the shape didn't change; no saved replays are kept). Seed 42's hash changed from `1076eaf6` on purpose.
**Left out / noticed:** Deploy zones and aim positions wait for card types and units (Known issues). The client shows none of this yet (Next cuts 1). Moved `?replay=` in the client behind the bot, since a replay has nothing to show until units exist.
**Status:** complete

### S7 · 2026-09-29 · Towers become sim entities
**Stage:** 1 — Block-in
**Cut:** Pass the arena layout and tower hp into the sim through `MatchSetup` (D7), make towers entities in the state, and let the client draw them from that state, so later cuts have something to shoot at.
**Done:**
- Sim: `arena.ts` holds the layout types that moved from `content` (`Rect`, `Lane`, `Bridge`, `TowerSite`, `ArenaLayout`), plus `Terrain`, `TowerKind`, `TowerStats` and `Tower`. `createMatch` copies the terrain field by field and builds towers with ids in layout order, rejecting bad hp. `step` copies them. Tower invariants added.
- Content: `TOWER_STATS` and `matchSetup(seed)`. Tools' `playReplay` uses it.
- Client: `arenaScene(state, view)` draws the terrain and towers from sim state; `main.ts` draws `createMatch(matchSetup(0))`.
**Verified:** `pnpm check` green (22 files, 142 tests). Scenario tests: towers stand at their sites with full hp by kind, stay untouched for a whole idle match, share nothing with the setup, get fresh copies each step, and change the hash; bad hp is rejected. 5 new invariant cases. A client test drops a tower from the state and it vanishes from the picture. `pnpm shots` is byte-identical to before this cut (looked at it). 4 mutations were each caught. `pnpm sim match --seed 42` → `replay` both hash `1076eaf6`.
**Decisions:** The sim owns the layout types, because it consumes them now (as S4 planned); `content` only fills them. The state keeps the terrain but not the tower sites: towers carry their own site, so positions live in one place. Seed 42's final hash changed from `330933a4` on purpose (the state grew); there are no goldens yet.
**Left out / noticed:** Keep dormancy, tower damage/range, and hp bars wait for towers that shoot (Next cuts 3).
**Status:** complete

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
