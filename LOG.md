# LOG

Sculpt log. The **Current state** block is rewritten at the end of every session. Session entries are prepended, so the newest is first. Workflow: CLAUDE.md.

---

## Current state

**Stage:** 3 — Detail (Stage 2 — Form closed in S26)
**Last session:** S26 · 2026-10-03
**Works:**
- A pnpm monorepo with `sim`, `content`, `bot`, `tools` and `client` packages, strict TS 6.0, no build step.
- `pnpm check` is green: typecheck, lint, 413 tests (one of them drives headless Chromium), the golden replays included.
- ESLint enforces the sim's hard rules (imports, Math/Date/timers, async, classes, `**`, float literals) in the sim and its tests, and in the bot (which may import only `sim` and `content`).
- Sim: `createMatch(setup)`, pure `step(state, commands)` at a fixed tick, sfc32 RNG in state, `hashState`. `MatchSetup` carries rules, the `ArenaLayout`, tower stats, a card catalog and both decks. Every §4 rule is in and has scenario tests.
- Players: energy 5 → 10, +1 per 56 ticks, 2× from 2:00 and in overtime. Decks of 8 shuffled from the seed; hand of 4 + queue; plays spend and cycle, with 6 rejection reasons. `deployZones` (own half + lanes opened by fallen enemy Outposts) and `placementRejection` (the bot uses both).
- Units (`troops.ts`): `count` per play in a mirrored formation; 1 s deploy delay; lock-on until the target dies or leaves range; acquisition in sight by filter (`ground | air | buildings`; `air` reaches both layers, `buildings` towers and buildings); ground units walk lane and bridge around towers and buildings, `air` units fly straight. `collision.ts`: pushes by mass per layer, out of towers, buildings and the river; slides take the shorter clear way; head-on pairs step aside. `attacks.ts`: melee hits land at once, ranged ones fly as homing projectiles; splash hits what the filter reaches, towers too. Buildings: static units that decay over their lifetime.
- Towers shoot the nearest enemy in range, ground or air, with projectiles. Keeps start dormant and wake when hurt or when an Outpost of theirs falls. Spells hit both layers, towers for `towerDamageBp`. Result: 3:00, overtime while tied, then the weakest-standing-tower tiebreak.
- Content: 8 cards, one per archetype: juggernaut (tank), warden (melee), slinger (ranged), rabble (swarm), harrier (flyer), bombardier (splash), flare (spell), bastion (building). `STARTER_DECK` holds each once.
- Bot: `createRandomBot`/`botTurn` (random legal plays, own seeded rng), `playBotMatch(seed)`.
- Tools: `pnpm sim match`/`replay` (seed 42: side 0 wins 1-0 at 3:00, `8c4bb8f0`); `pnpm sim sweep --matches 1000`: 0 violations, 0 mismatches, ~61 s; `pnpm sim goldens [--update]`; `pnpm shots` (`arena.png` `dae59c9f3cc4`, `end.png` `2aec0a54fe55`); `pnpm playtest` (a full live match in headless Chromium, ~5 min).
- Client (placeholder shapes): flyers lifted over shadows, buildings as squares, shots as dots, splashes as rings, dormant Keeps dimmed with an inner ring, no-deploy shade per closed lane. `?seed=`, *Play again* on a fresh seed, `?replay=`, `?tick=`; the end panel says when the tiebreak decided.
**Known issues:**
- No formatter configured yet. Nothing on screen shows that a tower's footprint refuses troops.
- Steering is local: a unit walled in by its own building between the arena's edge and a tower waits until the building decays. Sweeps take ~61 s.
- The deploy-zone extension is the whole lane of the enemy half (§4 as written); random-bot Keep kills are now 18% of matches. Director to decide whether it should stop short of the Keep.
- Hp bars are thin, units are small and low-contrast, and the flare marker and hollow HUD stars are faint.
- On Windows: pnpm comes through corepack (`corepack pnpm`), and Chromium needs `pnpm --filter @factor/tools exec playwright install --only-shell chromium` once. In the cloud container, `FACTOR_CHROMIUM=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`.
- Replays don't carry rules, layout or stats; a content change silently changes what an old replay plays.
- Context7 isn't reachable; library APIs were checked against the installed type definitions.
**Golden replays:** `goldens/` holds bot-vs-bot replays with a hash every 200 ticks and at the end (`hashes.json`): seed-0, seed-42 and seed-54 always, plus the first seeds that cover a regulation win for each side, an overtime win, a Keep kill and a draw (now seed-3, seed-9, seed-234). The goldens tests read the names from `hashes.json`. After a rule change: re-record (`pnpm sim match --seed <n> --replay goldens/seed-<n>.json` for each) and `--update`.

**Next cuts** (in order):
1. The heuristic bot: defends a threatened lane, counter-pushes, manages energy (Stage 3).
2. Balance sweeps with varied decks: win rate per card, flagging outliers for the director (Stage 3).
3. 8 more cards toward 16, each with scenario tests for its defining behavior (Stage 3).
4. Waiting on the director: art direction for sprites, animations, hit effects and SFX (Stage 3; VISION §11).

---

## Sessions

### S28 · 2026-10-04 · A heuristic bot
**Stage:** 3 — Detail
**Cut:** The Stage 3 bot that defends, counter-pushes and manages energy, reading cards by their stats so it plays any deck; the client now plays against it. Rebased port of `stage-3`'s S26.
**Done:**
- Bot: `heuristic-bot.ts` (`HeuristicBot`, plain JSON, own rng; thinks every 0.5 s, plays at most once a second). Threats are enemies within 2 tiles of the river or over it; it answers when they're worth ≥ 2 energy (or are building-hunters) and outweigh what already stands against them (its units within 5 tiles that can hit them, 1.5 energy per tower in reach). Answers: the spell destroying the most value at one point (≥ 110% of its cost), else the card that can hit the most threat value (bonuses for splash or swarms against a swarm, a building against hunters, less 0.3 per energy); buildings go in front of the Keep, ranged troops by the towers, the rest two tiles in front of the threat. When quiet it finishes a tower a spell can drop, spells clusters worth it, backs up its own pushing units, saves to 8 and pushes the weaker lane with its toughest troop, and never sits at 10. Spots are tile centers checked with the sim's `placementRejection` (plus energy), searched in each side's own frame so both sides choose alike.
- `Bot = RandomBot | HeuristicBot` (`kind`), `createBot`, `botTurn` for either (`randomTurn`, `heuristicTurn`); `playBotMatch(..., kinds)` (random by default, so goldens and sweeps are unchanged). Content: `BotTuning.heuristic`. Client: side 1 is the heuristic bot (`?bot=random` for the old one); the arena shot moved to tick 200, after its first push.
**Verified:** `pnpm check` green (61 files, 448 tests; 12 new: determinism, legal-only play on random 16-card decks, beats the random bot, pulls a tank with a building or meets it, sparks a flight of wisps, answers flyers only with air-hitters, saves then pushes the weaker lane, finishes a tower, < 2% of ticks on full energy). Measured on main's sim over 100 seeds: vs random 98% and 99% by side; heuristic mirror 45/53/2.
**Decisions:** As in `stage-3`: the bot never names a card; its tuning is content.
**Left out / noticed:** **Playtest (director):** is the bot fun to play against?
**Status:** complete

### S27 · 2026-10-04 · Sixteen cards
**Stage:** 3 — Detail
**Cut:** The first Stage 3 criterion: eight more cards for sixteen, each with a scenario test of its defining behavior on the real arena (VISION §7). Rebased port of `stage-3`'s S25 onto main's Stage 2 (S20–S26 here); that branch's own Stage 2 (its S20–S24) was dropped as a duplicate of main's.
**Done:**
- Sim: building cards carry `spawn: { card, everyTicks } | null`. A spawning building deploys its troop card's group just in front of it (formation, toward the enemy) on its first standing tick (age 1) and every `everyTicks` after, ready to act; the spawned card joins the match's catalog with the building (`pickCards`); a spawner must not attack. `bastion` gets `spawn: null`.
- Content: `hive` (5: two `mite`s as it stands and every 5 s, 40 s), `charger` (4: fast building-hunter), `airship` (5: flying building-hunter, a 650 bomb), `wisps` (3: four fragile flyers that hit air), `meteor` (6: 1100 in 1.8 tiles), `spark` (2: 150 in 2 tiles), `reaver` (4: a swing whose splash hits everything round its target), `duelist` (4: 380-damage blows). `mite` is spawn-only: `SPAWN_ONLY`, `DECK_CARD_IDS` (the 16). `STARTER_DECK` is now the eight Stage 2 archetypes, one each (unchanged in practice). Palette colors for all.
- `every-card-does-what-it-says.test.ts`: one scenario per deck card, numbers read from `CARDS`.
**Verified:** `pnpm check` green (60 files, 436 tests; 23 new: 6 for spawning, 17 per card). `pnpm sim sweep --matches 1000`: 0 violations, 0 mismatches, 65 s. Golden hashes refreshed with `--update` (the replays are unchanged; every card now carries `spawn`, so every state hash moved).
**Decisions:** Main's splash rule stands (a splash lands at the target; a `buildings` filter reaches only buildings), so the reaver's swing centers on its target and the airship's bomb hits towers and buildings only. Spawning keys off `age`, so it needs no new state.
**Left out / noticed:** The starter-deck sweep doesn't play the new cards; the balance sweep (S29) will.
**Status:** complete

### S26 · 2026-10-03 · Stage 2 exit review
**Stage:** 2 — Form → 3 — Detail
**Cut:** Check every Stage 2 exit criterion end to end, in the browser too, and finish the client readability left over (dormant Keeps, a fresh seed per match, why a tied match was won).
**Done:**
- Client: dormant Keeps drawn dimmed with an inner ring until they wake; `?seed=<n>` (0 by default) and *Play again* on a fresh random seed (`url-params.ts`); the end panel says "Stars tied: decided on tower hp" when the tiebreak decided.
- Sim tests: a unit stays locked on when a nearer enemy arrives, and retargets when its target dies or leaves range (towers had this; units didn't).
- Stage 2 criteria: every §4 rule implemented and covered (target filters, flyers, lock-on/retarget, collision and pushing, deploy delay, Keep activation, deploy-zone extension, 2× energy, overtime, tiebreak); 8 archetype cards; goldens in place; `pnpm sim sweep --matches 1000` (S25, sim unchanged since): 0 violations, 0 mismatches.
**Verified:** `pnpm check` green (59 files, 413 tests; 7 new). `pnpm playtest`: a full live match in headless Chromium, seed 0, side 0 won on the tiebreak at 5:00 (1-1), 45 plays taken, 29 refused for energy, no page errors, the `?replay=last` end screen pixel-identical. A scripted 60 s live session on seed 7, every hand slot and both lanes: no errors; looked at frames (shots in flight, flyers, the bot's bastion, units crossing). `pnpm dev` in the app's browser pane at phone size: the hand, the selection and the shade for a closed lane, a rabble deployed; the pane was hidden, so frames didn't advance there. Looked at `arena.png` (dimmed Keeps) and the tiebreak note.
**Decisions:** Stage 2 is complete. *Play again* uses the client's own randomness for the seed (never the sim's); the first match stays seed 0 so `pnpm shots` and `pnpm playtest` are unchanged.
**Left out / noticed:** Feel can't be signed off by the agent. **Playtest (director):** play a few matches on a phone. Do flyers, buildings and splash read at a glance? Is the opened lane after an Outpost falls too strong? Does the bastion stall pushes too long?
**Status:** complete

### S25 · 2026-10-02 · Deploy zone extension and the tiebreak
**Stage:** 2 — Form
**Cut:** The last two §4 rules: a fallen enemy Outpost opens that lane's side of the enemy half for deploys, and stars tied at the end of overtime go to the tower-hp tiebreak.
**Done:**
- Sim: `deployZones(state, side)` replaces `deployZone`: the home half, then each lane (split down the middle) of the enemy half whose enemy Outpost has fallen. `placementRejection` checks all of them; the river never opens and standing towers stay `occupied`. `decideResult`: at the end of overtime with stars tied, the side whose weakest standing tower has less hp loses; equal hp is a draw. With no overtime the tiebreak comes at the end of regulation.
- Bot: picks among legal tiles of every zone. Client: `noDeployRects` shades the river and each closed lane of the enemy half (an opened lane is left clear).
**Verified:** `pnpm check` green (57 files, 406 tests; 8 new): zones for each side and lane, the opener's opponent gains nothing, both lanes open; deploys in the opened lane (on rubble too), refused in the closed lane, the river and the Keep; tiebreak wins either way, a Keep counting, weakest not total, fallen Outposts not counted as 0, an even tiebreak a draw, no tiebreak at the end of regulation when overtime follows; the shade with a lane opened. `pnpm sim sweep --matches 1000`: 1000 healthy, 0 violations, 0 mismatches, 61 s; draws 147 → 1, Keep kills ~0 → 18%; one bot play refused as `occupied` (both sides aimed the same spot of an opened lane on one tick; side 0 resolves first).
**Decisions:** The extension is the whole lane side of the enemy half, as §4 reads, so a fallen Outpost lets troops land beside the Keep; that makes Keep kills common for the random bot. **For the director:** should the opened zone stop short of the Keep (a content number for its depth)? The tiebreak compares standing towers only, as fallen ones would make every star-tied match with lost Outposts a draw. Goldens re-recorded on purpose (seed 42 → `8c4bb8f0`).
**Left out / noticed:** The shade for an opened lane can't be seen in a deterministic shot (it shows only while a card is selected); the browser review will check it.
**Status:** complete

### S24 · 2026-10-02 · Buildings
**Stage:** 2 — Form
**Cut:** The building card type: static, targetable, its hp decaying over its lifetime (§4 Card types), with the building archetype card, the last Stage 2 card.
**Done:**
- Sim: `CardStats` gains `building` (`unit` stats with speed 0, ground, count 1, plus `lifetimeTicks`; `createMatch` enforces it). A building is a `Unit` that never moves: it locks on to what comes within sight and never falls back to walking at a tower. `Unit.age` counts ticks acted; a building loses `maxHp / lifetimeTicks` a tick (remainders spread exactly) with the tick's hits. `canTarget` takes whether the target is a building: `buildings` filters now take towers and buildings in sight. Ground units walk around buildings and are pushed out of them (`Obstacle` = rect + `pad`; a building is its center padded by its radius); buildings aren't pushed. Placement: a building must be on its side's half, clear of standing towers and other buildings, and wholly inside the arena.
- Steering fixes found by a new stuck-unit probe (units with no target standing still): a unit beside the bank was sent straight across into the water; a unit pressed into a face spent its whole step snapping back; slides could pick an end blocked by another obstacle or the arena edge; corner tangents fought face slides; near head-on pairs (two buildings-only units on a bridge) pushed forever, so pairs in a column now also step aside; a crossing unit now aims a radius past the far bank. Stuck time fell from ~10% of juggernaut ticks to ~0.5% (what remains is a unit walled in by its own building).
- Content: `bastion`, 4 energy, 1100 hp, a 5.5-tile turret hitting air and ground for 30 s. `STARTER_DECK` is now the 8 cards once each. Client: buildings drawn as squares.
**Verified:** `pnpm check` green (56 files, 400 tests; 7 new): a building stands, waits its delay, decays 2 a tick and falls at exactly its lifetime; it shoots in range and waits otherwise; a buildings-only unit and a walker both go for a building in sight; a walker gets around a friendly building in its lane while it stands; placement on towers, buildings and the edge refused; troops may still be played on a building; bad building stats refused; plus a head-on step-aside push test. `pnpm sim sweep --matches 1000`: 1000 healthy, 0 violations, 0 mismatches, 67 s. Looked at seed 42 at tick 396 (side 1's bastion, a square with its hp running down).
**Decisions:** A building is a unit with speed 0 rather than a new entity, so targeting, projectiles, spells and invariants cover it unchanged. Its decay is not damage from anyone, so it never wakes a Keep or scores. Goldens re-recorded on purpose (seed 42 → `c77fa690`); the goldens tests no longer assume names are padded to 7 characters.
**Left out / noticed:** Draws rose to 15% of random-bot matches: the tiebreak is next.
**Status:** complete

### S23 · 2026-10-02 · Projectiles and splash
**Stage:** 2 — Form
**Cut:** Ranged hits fly as projectiles and hits can splash (§4 unit stats: projectile speed, splash radius), with the splash archetype card, a Stage 2 rule and card.
**Done:**
- Sim: `AttackStats.splash` and `projectileSpeed` (towers and units; 0 means a single target, landing at once). `attacks.ts`: towers and units now emit `Strike`s; `resolveStrikes` lands a melee one at once or launches a `Projectile` (ids from the shared sequence); `flyProjectiles`, first thing in `fight`, homes each shot on its target, keeps the last spot once the target falls, and lands it on arrival. A splash hits every enemy tower its circle touches and every enemy unit its attacker's filter reaches (towers' reach both layers), at full damage. `SimState.projectiles` and `splashes` (this tick's, for the client). Invariants for both; `createMatch` checks the new stats.
- Content: towers shoot 16 tiles/s; slinger 10, harrier 12 tiles/s. `bombardier`, the splash unit: 4 energy, 650 hp, 4.5-tile range, shells at 8 tiles/s that splash 1.2 tiles, ground only.
- Client: shots as dots in their side's color with a light rim, interpolated by id (splash shells bigger); landed splashes as fading rings, kept by the loop like blasts.
**Verified:** `pnpm check` green (54 files, 393 tests; 11 new): a shot appears at tick 6 and lands 4 ticks later; it homes on a moved target; a shot whose target fell lands harmlessly, a splash there still hits; a splash hits enemies its filter reaches and towers, not friends or flyers; a melee splash lands at once; a tower's projectile; bad stats refused and a stray projectile breaks an invariant; client scenes for shots and splashes. Fixture towers and troops stay instant, so older scenarios keep their timings. `pnpm sim sweep --matches 1000`: 1000 healthy, 0 violations, 0 mismatches, 36 s. Looked at seed 42 at tick 852 (a bombardier's splash ring on an Outpost, a tower's shot in flight).
**Decisions:** Strikes resolve after everyone acts and new shots start flying next tick, so order within a tick never decides who hits first. Splash isn't reduced on towers (only spells are, per §4). The golden-test "extra" seed is now any seed that isn't a golden. Goldens re-recorded on purpose (seed 42 → `a98d2a0f`).
**Left out / noticed:** The client test for the bot now asks for ≥ 2 plays in 20 s (pricier cards in the deck).
**Status:** complete

### S22 · 2026-10-02 · Swarm: a troop spawns its count of units
**Stage:** 2 — Form
**Cut:** A troop play spawns `count` units (§4 Card types, unit stats), with the swarm archetype card, a Stage 2 rule and card.
**Done:**
- Sim: `UnitStats.count` (1–30, checked by `createMatch`). `formation` lays a play's units out in rows of up to ⌈√count⌉, a diameter apart, each row centered, the front row toward the enemy (mirrored for side 1), kept inside the arena; the end-of-tick push takes care of towers and the river. Ids are consecutive in formation order. One play still costs and cycles once.
- Content: `rabble`, the swarm (3 energy, 4 units of 230 hp, radius 300). Every other card has `count: 1`. Purple in the client.
**Verified:** `pnpm check` green (52 files, 382 tests; 6 new): a 2×2 formation with consecutive ids and one cost paid; side 1's formation mirrors side 0's; a short last row is centered and a count of 1 lands on the aim; swarms aimed at a corner, the riverbank or a bridge's bank stay healthy (on the bank where there's no bridge); swarm units fight and fall one by one; a count of 0 is refused. The sweep test counts one play per side and card a tick, not one per unit. `pnpm sim sweep --matches 1000`: 1000 healthy, 0 violations, 0 mismatches, 36 s. Looked at seed 42 at tick 91 (the rabble's 2×2 by side 0's Keep).
**Decisions:** Formation offsets are whole radii, so the units of a swarm start touching, not overlapping. Goldens re-recorded on purpose (seed 42 → `164828ef`).
**Left out / noticed:** Swarm units are small on a 24 px tile (7 px radius); fine for placeholders, a sprite question for Stage 3.
**Status:** complete

### S21 · 2026-10-02 · Flying units and the `air` target filter
**Stage:** 2 — Form
**Cut:** Flying units and the `air` target filter (§4 Card types, Targeting, Movement), with the flyer archetype card, a Stage 2 rule and card.
**Done:**
- Sim: `UnitStats.layer` (`ground | air`); `TargetFilter` gains `air`, which reaches both layers (`canTarget`). An `air`-layer unit flies straight at its goal, over towers and the river; acquisition skips units its filter can't reach. `separate` runs per layer (flyers only stay inside the arena). The river invariant applies to ground units only. `createMatch` refuses an unknown layer or filter.
- Content: `harrier`, the flyer (4 energy, 750 hp, `air` filter). `slinger` now targets `air`, so the ranged unit answers flyers; warden and juggernaut can't. `STARTER_DECK` cycles the catalog to 8 cards.
- Client: flyers drawn lifted (0.9 radius) over a dark shadow, after ground units; their hp bar rides above them. Harrier is yellow.
**Verified:** `pnpm check` green (51 files, 376 tests; 7 new): a flyer crosses the river off the bridges and locks on to the nearest Outpost; ground and air units pass through each other while flyers push flyers; a flyer isn't pushed out of a tower or the river; a ground-only unit ignores a flyer 100 away while an `air` unit locks on; a flyer hits ground units and towers shoot flyers; a spell hits flyers; a bad layer or filter is refused. Sweep and card-list tests now read `CARD_IDS`. `pnpm sim sweep --matches 1000`: 1000 healthy, 0 violations, 0 mismatches, 29 s. Looked at a seed-42 frame at tick 432 (harrier over its shadow, zoomed) and `arena.png` (the bot's harrier; the new card in the hand).
**Decisions:** `air` as a filter means "air and ground", as the ranged and anti-air units need; there's no air-only filter until a card wants one. Goldens re-recorded on purpose (seed 42 → `5b809008`).
**Left out / noticed:** Nothing.
**Status:** complete

### S20 · 2026-10-02 · Collision and pushing by mass; no deploys on towers
**Stage:** 2 — Form
**Cut:** Units are circles that push each other by mass, walk around towers, and can't be deployed on one (§4 Movement, Next cuts 1), a Stage 2 rule.
**Done:**
- Sim: `collision.ts`. `walk` steps a unit toward its goal, sliding along a standing tower's face the shorter way round, or along the tangent at a corner (the tower it is going for doesn't block it). `separate`, at the end of `fight`, pushes overlapping pairs apart in id order by the other's share of the mass (rounded down, so equal masses stay mirror-exact), then out of standing towers, then keeps ground units in the arena (by their radius) and off the river except over a bridge. `UnitStats.mass` (juggernaut 18, warden 6, slinger 4). `footprint` moved to `arena.ts`.
- Rule: a troop aimed inside a standing tower's footprint is refused as `occupied`; rubble is fine, spells go anywhere. `placementRejection(state, side, stats, x, y)` holds the spot rules; `step` and the bot use it (the bot picks among legal tiles only).
- Tools: `pnpm sim match` prints the replay path with `/` on every OS (a Windows test failed on `\`).
**Verified:** `pnpm check` green (50 files, 369 tests; 9 new): a mass-weighted push, a diagonal push between enemies, two units on one point split along x, a crowd of 8 spreads out, pushed toward the river a unit stops on the bank or the bridge's edge, pushed into a tower it's pushed back out, a unit walks around its own Outpost and crosses, a unit going for a tower stops touching it, troops refused on towers but allowed on rubble. Tests that deployed on a footprint moved to open grass; tools tests now derive seed numbers from the goldens and the match instead of literals. `pnpm sim sweep --matches 1000`: 1000 healthy, 0 violations, 0 mismatches, no rejections, 23 s. Shots looked at (`end.png`: Victory 2-1 in overtime; units side by side, none overlapping).
**Decisions:** One separation pass per tick (a crowd settles over a few ticks) and an overlap of 1 milli-tile is left alone, so melee units that touch stay in range. Goldens re-recorded on purpose; the set is now seeds 0, 42, 54 plus the first seeds covering each kind of ending (`hashes.json` lists them). Seed 42 → `112655d8`.
**Left out / noticed:** The client doesn't shade tower footprints as no-deploy. Units of every layer push alike until flying units exist.
**Status:** complete

### S19 · 2026-09-30 · Keep dormancy
**Stage:** 2 — Form
**Cut:** The Keep starts dormant and wakes when it takes damage or one of its own Outposts falls (§4, Next cuts 1), a Stage 2 rule.
**Done:**
- Sim: `Tower.dormant` (true for Keeps at the start). A dormant tower doesn't act. At the end of `fight`, after hits land and fallen towers score, a dormant Keep with hp below max or a fallen Outpost of its own wakes; it locks on from the next tick. New invariant: only a Keep can be dormant, and only while unhurt, with its Outposts standing and no target.
- Goldens re-recorded under the new rule. Seed 0 now ends 1-2 and seed 101 no longer ends in a Keep kill, so seed-101 was replaced by seed-24 (a Keep kill) and seed-4 (a side 0 regulation win) was added. The coverage test now checks kinds of ending, not seeds.
**Verified:** `pnpm check` green (49 files, 360 tests; 11 new). Scenarios: dormant at the start; a dormant Keep ignores an enemy in range while an Outpost locks on; zero-damage hits don't wake it; a unit's hit wakes it on that tick and it locks on the next and fires 5 later; a spell on the Keep wakes it, a dud or a spell on an Outpost doesn't; its own Outpost falling wakes it unhurt, the enemy Keep sleeps on. 5 invariant cases. 6 mutations were each caught. `pnpm sim sweep --matches 1000`: 0 violations, 0 mismatches; stars 1584 → 2419 and the shortest match 2:16 → 1:01 (undefended Keeps fall sooner). Seed 42 → `14d647f7`. Shots: `arena.png` unchanged, `end.png` → `e680085d8eeb` (Defeat 1-2; I looked at it).
**Decisions:** "Takes damage" means hp below max: hits for 0 don't wake it, and nothing heals. The Keep wakes at the end of the tick, so it acts from the next one, the same for both sides (pillar 1). The goldens changed on purpose: the state gained `dormant` and Keeps no longer shoot at first.
**Left out / noticed:** No visual cue for a dormant Keep (Next cuts 4). **Playtest (director):** with the Keep asleep, is a push that takes an Outpost now too decisive?
**Status:** complete

### S18 · 2026-09-30 · Golden replays
**Stage:** 2 — Form
**Cut:** Golden replays checked in `pnpm check` (Next cuts 1), a Stage 2 exit criterion, in place before the Stage 2 rules start changing the sim.
**Done:**
- `goldens/`: 5 bot-vs-bot replays (seeds 0, 27, 42, 54, 101: regulation wins for each side, an overtime star, a Keep kill, a draw) and `hashes.json` (a hash every `GOLDEN_EVERY` = 200 ticks and at the end).
- Tools: `goldens.ts` (`goldenHashes`, `readGoldens`, `readGoldenHashes`, `checkGoldens`, `updateGoldens`). A golden fails at its first differing checkpoint, compared in tick order, or if its replay no longer plays; a replay with no hashes and hashes with no replay fail too. `pnpm sim goldens [--update] [--dir]`.
**Verified:** `pnpm check` green (48 files, 349 tests; 10 new): the real goldens pass and cover the 5 endings, checkpoint ticks and the final hash, tampered hashes fail at the right tick (in numeric order), a shorter match, missing and stale entries, a replay that no longer plays, `--update`, and the CLI. 7 mutations were each caught (1 only after I added a test). By hand: slinger damage 90 → 91 failed all 5 goldens at tick 200; tower share +1 in `spells.ts` failed them at ticks 400–1000, each at its first divergence; both reverted to green.
**Decisions:** Goldens are stored replays, not seeds, so a bot change doesn't move them; only the sim and content do. The state carries stats, so any content change fails at tick 200 even if the number never matters, which is intended. Hashes go every 200 ticks, not every tick, to keep `hashes.json` small (56 KB for 5).
**Left out / noticed:** Cross-machine and browser hashing (the client could check `hashes.json` too). The tiebreak isn't implemented: seed-54 is a draw at 2-2 (Next cuts 4).
**Status:** complete

### S17 · 2026-09-30 · `pnpm sim sweep`: bot-vs-bot matches by the thousand
**Stage:** 2 — Form
**Cut:** `pnpm sim sweep --matches <n> [--from <seed>]` (Next cuts 1): Stage 2 needs a 1,000-match sweep with zero violations and zero mismatches, and §6 lists headless sweeps as a sense.
**Done:**
- Tools: `sweep.ts` (`sweep(from, matches, onMatch?)` → `SweepReport`, `describeSweep`). Each seed is played live, then played back from its replay with invariants every tick; the final hashes must agree. It tallies wins/draws, length and overtime, stars, tower damage per side, plays per card (a taken play's card is at the back of its queue) and rejections by reason. A failing seed is recorded as a violation or mismatch, and the sweep goes on. The CLI prints progress every 100 matches to stderr and exits 1 on any failure.
- `match.ts`: `InvariantError` (so the sweep tells a broken invariant from a replay that doesn't fit) and `playBotReplay` (the live end state as well as the replay; `botReplay` uses it).
**Verified:** `pnpm check` green (47 files, 339 tests; 17 new): tallies equal the same 6 seeds played one by one, plays per card equal the troops deployed plus the spells landed, determinism, report lines, the CLI and 5 usage errors. With `playReplay`/`playBotReplay` mocked: an invariant break, a hash mismatch and a replay that doesn't fit are each recorded while the sweep goes on, refused commands count by reason and not as plays, and failures stay out of the tallies. 6 mutations were each caught (2 only after I added tests). `pnpm sim sweep --matches 1000` twice, the same output both times: 0 violations, 0 mismatches, side 0 469 · side 1 507 · 24 draws, mean 3:18, 486 to overtime, ~42 s. Seed 42 still `5d516ada`.
**Decisions:** A sweep is bot vs bot on the starter decks, so each failure is reproduced by `pnpm sim match --seed <n>`. It's not in `pnpm check` (45 s); the tests sweep 6 seeds.
**Left out / noticed:** Win rate per card needs varied decks (Stage 3 balance). Half of the random-bot matches go to overtime. Goldens next.
**Status:** complete

### S16 · 2026-09-30 · Stage 1 exit review: a full match in the browser
**Stage:** 1 — Block-in → 2 — Form
**Cut:** Check every Stage 1 exit criterion end to end, make "a human plays a full match in the browser" repeatable as `pnpm playtest`, then close the stage (Next cuts 1).
**Done:**
- Tools: `playtest.ts` (`playtest()`, `playtestTaps`): real-time headless Chromium, a scripted side 0 taps a card and a spot every 4 s until the client saves its replay. It then plays that replay back with invariants on, watches `?replay=last` to its end, and compares the pixels. `pnpm playtest [--out]`. `browser.ts` (`withClient`, `pageErrors`, `waitForReady`) extracted from `shots.ts` (second use). `playReplay` takes an optional `onStep`.
- Client: exports `layoutScreen`, `toArena`, `REPLAY_STORAGE_KEY`; tools now depends on `@factor/client`.
- Stage 1 criteria, one by one: live play to the end (playtest ×2); energy, hand + next, cycling, timer, stars and the result screen (looked at both end shots); the 4 archetype cards (`cards.ts`); towers fall (an Outpost each run); the bot; `?replay=` playback; headless bot vs bot (`sim match`/`replay`, seed 42).
**Verified:** `pnpm check` green (45 files, 322 tests; 2 new: the taps hit the hand slots in turn and side 0's deploy zone in line with alternating bridges, and never hit the end buttons). That second test failed on my first spot (1.5 tiles short of the river), which sat on *Play again*/*Save replay* at 24 px/tile. `pnpm playtest` twice (~190 s each): side 0 won 1-0 at 3:00 both times (`f761b337`, `035ebc8d`), 22–23 plays taken, the rest refused for energy, no page errors, and the live and `?replay=last` end screens pixel-identical. Seed 42 still `5d516ada`; shots unchanged (`586a9e3247b1`, `bb2a0544d547`).
**Decisions:** `playtest` runs in real time: under Playwright's fake clock a match took ~11 min, because software WebGL draws a frame in ~54 ms at 540×960. At 3 min it's a tool, not part of `pnpm check`, and its match varies with tap timing. Stage 1 is complete.
**Left out / noticed:** The scripted player spends ~half its taps without the energy. The sweep command, goldens and Stage 2 rules (Next cuts). **Playtest (director):** Stage 1 closes on the agent's checks. Please play one full match on a phone and say whether the loop is fun enough to refine.
**Status:** complete

### S15 · 2026-09-30 · Replays play back in the client
**Stage:** 1 — Block-in
**Cut:** `?replay=` plays a replay back in the client (`last` from localStorage, or a URL), freezable with `?tick=`, and `pnpm shots` shoots replays and an end screen (Next cuts 1): the last unmet Stage 1 criterion.
**Done:**
- Client: `MatchLoop.feed` (a replay's commands, sent on their own ticks in recorded order; `createLoop(state, bots, feed)`). `readReplay(name, sources)` in `match-replay.ts`. `Controls.watching`: taps can't select or play, the end screen still answers. `main.ts` plays a replay with no bot, doesn't overwrite the stored replay with it, sends *Play again* to a fresh live match, and shows why on the page if the replay is missing or invalid.
- Tools: `shoot(requests)` (one server and browser for many shots; a replay is served to the page via `page.route`), `defaultShots` (`arena` at tick 90, `end` of bot-vs-bot seed 0 at `END_TICK`), `shots --replay <file> [--tick <n>]` and `--tick <n>`. `readReplayFile` extracted (second use).
**Verified:** `pnpm check` green (44 files, 320 tests; 7 new): a 40-tap live match fed back state-for-state at every checkpoint and to the same end, hash and command log; real-time playback matches jumping; the feed is copied; watching blocks taps; `last` vs URL, and missing/invalid replays refused with a reason. The browser test shows a replay frozen at tick 90 is pixel-identical to the live `?tick=90` shot, and shots repeat. 4 mutations were each caught (one only by that pixel test). `pnpm shots` twice gave `586a9e3247b1`/`bb2a0544d547`. I looked at `end.png` (Victory 1-0), a seed-42 replay at 2:00, and both error pages. In the browser, `?replay=last` from localStorage draws the same pixels as the same replay by URL. Vite serves `replays/` files via `/@fs/`. Seed 42 still hashes `5d516ada`.
**Decisions:** A replay is watched from side 0's seat. In replay mode *Play again* starts a live match, and *Save replay* downloads what was watched. The dev server's HTML fallback for unknown paths counts as a missing replay.
**Left out / noticed:** Debug overlays (Next cuts 4); pause and seek. Units walk under the HUD stars on the right bank (the stars stay on top). **Playtest (director):** open `?replay=last` after a match on your phone. Does watching it back read clearly?
**Status:** complete

### S14 · 2026-09-30 · Stars, the end screen, and the client saves its replay
**Stage:** 1 — Block-in
**Cut:** Show both sides' stars on the HUD, a win/lose/draw screen when the match ends, and auto-save the finished match's replay in the browser (Next cuts 1). The client showed neither stars nor an ending.
**Done:**
- Sim: `MAX_STARS` (3) replaces the hard-coded 3 in `step` and the invariants, and is exported (third use: the HUD). No behavior change; seed 42 still hashes `5d516ada`.
- Client: `ScreenLayout` gains `hud.stars` (per side, a column in the last tile column right of the bridge, growing away from the river) and `end` (panel, title, star groups, two buttons). `HudScene.stars`/`starPips`, `drawStars` (Pixi `star`). `end-view.ts` (`endScene`, `outcome`: victory/defeat/draw per side, viewer's stars left) and `draw-end.ts` (`EndView`: shade, panel, title, stars, *Play again*, *Save replay*). `tap` returns an `EndAction` once the match is over, and nothing else answers then. `match-replay.ts` (`loopReplay`, `REPLAY_STORAGE_KEY`). `main.ts` saves the replay to localStorage on the tick the result appears (and sets `data-replay-saved`), reloads on *Play again*, downloads `factor-seed-0.json` on *Save replay*.
- Fix: a match decided as regulation runs out showed `OT 2:00`; the clock now stays at `0:00` unless overtime really starts.
**Verified:** `pnpm check` green (43 files, 313 tests; 11 new): pips earned from `current`, both players see the same stars, star columns on their bank and clear of the bridge (phone and desktop), outcomes for both sides and draws, the panel and buttons inside the arena and apart, taps after the end answer only the buttons and play nothing, buttons dead while the match runs, a 40-tap live match vs the bot saved → loaded → replayed to the same tick, result and hash, the replay is a copy, and the clock at a decided 3:00. 4 mutations were each caught. `pnpm shots` twice gave `586a9e3247b1` (stars added); I looked at it. Headless `?tick=99999`: Defeat 0-2 panel (looked at it). A live headless run with a faked clock: one tap, the match ran to its end, the replay was in localStorage, and `pnpm sim`'s `playReplay` played it back with invariants (side 1 wins 0-2 at 3:00). *Save replay* downloaded `factor-seed-0.json`, byte-identical to the stored replay; *Play again* reloaded to a fresh match; the clock read `0:00` (looked at it); no page errors.
**Decisions:** Stars read the same for both players, by side color: side 0's below the river, side 1's above. *Play again* reloads the page (a new seed is Next cuts 4). The replay is saved only in live play, never in `?tick=` mode, so a shot doesn't overwrite a real match. `MAX_STARS` is a rule constant in the sim, not content (like `TICKS_PER_SECOND`).
**Left out / noticed:** `?replay=` and an end-screen shot (Next cuts 1). A fresh seed per match (Next cuts 4). Faint hollow stars (Known issues). **Playtest (director):** are the stars readable at a glance on a phone? Does the end panel feel like an ending? Is *Save replay* a useful way to hand over a match?
**Status:** complete

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
