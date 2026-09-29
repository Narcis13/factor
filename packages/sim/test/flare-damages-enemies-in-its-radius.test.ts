import { expect, test } from 'vitest';
import { checkInvariants, createMatch, hashState, step, type CardId, type CardStats, type Command, type SimState, type SpellStats } from '../src/index.ts';
import { matchSetup, place, TOWER_STATS, TROOPS } from './fixtures.ts';

// Fixture arena: side 1's left Outpost (id 4) stands on 1000–3000 × 14000–16000, its Keep (id 3) on
// 4000–6000 × 17000–19000. A walker has radius 500 and 500 hp; an Outpost 200 hp. Units get ids from 6.

/** A 2-tile flare for 100 damage, 30% of it (30) against towers. */
const FLARE: CardStats = { cost: 1, type: 'spell', spell: { radius: 2000, damage: 100, towerDamageBp: 3000 } };
const CARDS: Record<CardId, CardStats> = { ...TROOPS, flare: FLARE };
const FLARES: CardId[] = Array.from({ length: 8 }, () => 'flare');

/**
 * Towers deal nothing, so every hp change comes from the flare. The state knows the troops too, so
 * units can be placed whatever the decks hold.
 */
function flareMatch(decks: [CardId[], CardId[]] = [FLARES, FLARES]): SimState {
  const towerStats = { keep: { ...TOWER_STATS.keep, damage: 0 }, outpost: { ...TOWER_STATS.outpost, damage: 0 } };
  const state = createMatch({ ...matchSetup(5), towerStats, cards: CARDS, decks });
  return { ...state, cards: { ...CARDS, ...state.cards } };
}

const flare = (state: SimState, side: 0 | 1, x: number, y: number): Command => ({ tick: state.tick, side, handSlot: 0, x, y });
const hpOf = (state: SimState, id: number) => state.units.find((unit) => unit.id === id)?.hp;
const towerHp = (state: SimState, id: number) => state.towers.find((tower) => tower.id === id)?.hp;

function play(state: SimState, commands: Command[]): SimState {
  const next = step(state, commands);
  expect(checkInvariants(next)).toEqual([]);
  expect(next.rejected).toEqual([]);
  return next;
}

test('a flare hits every enemy unit its circle touches, for its full damage, and spares its own side', () => {
  const start = place(
    flareMatch(),
    { side: 1, card: 'walker', x: 5000, y: 15_500 }, // centers 2500 apart: the circles just touch
    { side: 1, card: 'walker', x: 2499, y: 13_000 }, // 2501 apart: just clear
    { side: 0, card: 'walker', x: 5000, y: 13_000 }, // dead center, but its own
  );
  const next = play(start, [flare(start, 0, 5000, 13_000)]);
  expect([hpOf(next, 6), hpOf(next, 7), hpOf(next, 8)]).toEqual([400, 500, 500]);
});

test('a flare hits a tower its circle touches for the tower share only', () => {
  const start = flareMatch();
  // 2000 below the Outpost's footprint: touching. The Keep is far off.
  const touching = play(start, [flare(start, 0, 2000, 12_000)]);
  expect([towerHp(touching, 4), towerHp(touching, 3)]).toEqual([170, 300]);
  // 2001 below: clear.
  const clear = play(start, [flare(start, 0, 2000, 11_999)]);
  expect(towerHp(clear, 4)).toBe(200);
  // Its own Outposts take nothing, even dead center.
  const own = play(start, [flare(start, 0, 2000, 5000)]);
  expect(own.towers.map((tower) => tower.hp)).toEqual(start.towers.map((tower) => tower.hp));
});

test('a flare that finishes a unit takes it off the field, and one that fells an Outpost scores a star', () => {
  const weak = place(flareMatch(), { side: 1, card: 'walker', x: 5000, y: 13_000, hp: 100 });
  const low = { ...weak, towers: weak.towers.map((tower) => (tower.id === 4 ? { ...tower, hp: 30 } : tower)) };
  const next = play(low, [flare(low, 0, 3000, 13_000)]);
  expect(next.units).toEqual([]);
  expect(towerHp(next, 4)).toBe(0);
  expect(next.stars).toEqual([1, 0]);
});

test('a flare costs its energy, cycles like any card, and is recorded as a blast for that tick only', () => {
  const start = flareMatch();
  const next = play(start, [flare(start, 1, 4000, 6000), flare(start, 0, 5000, 13_000)]);
  // Side 0 resolves first, whatever order the commands came in.
  expect(next.blasts).toEqual([
    { side: 0, card: 'flare', x: 5000, y: 13_000 },
    { side: 1, card: 'flare', x: 4000, y: 6000 },
  ]);
  expect(next.players.map((player) => player.energy)).toEqual([4, 4]);
  expect(step(next, []).blasts).toEqual([]);
});

test('a flare lands on a unit deployed earlier in the same tick', () => {
  const mixed: CardId[] = ['walker', 'walker', 'walker', 'walker', 'walker', 'walker', 'walker', 'walker'];
  const start = flareMatch([mixed, FLARES]);
  const next = play(start, [flare(start, 1, 5000, 3000), { tick: 0, side: 0, handSlot: 0, x: 5000, y: 3000 }]);
  expect(hpOf(next, 6)).toBe(400);
});

test.each<{ label: string; spell: SpellStats }>([
  { label: 'a negative radius', spell: { radius: -1, damage: 100, towerDamageBp: 3000 } },
  { label: 'a fractional damage', spell: { radius: 2000, damage: 3 / 2, towerDamageBp: 3000 } },
  { label: 'a tower share above 100%', spell: { radius: 2000, damage: 100, towerDamageBp: 10_001 } },
])('a spell with $label is rejected', ({ spell }) => {
  const cards: Record<CardId, CardStats> = { ...CARDS, flare: { cost: 1, type: 'spell', spell } };
  expect(() => createMatch({ ...matchSetup(5), cards, decks: [FLARES, FLARES] })).toThrow(/flare/);
});

test('a scripted match of troops and flares plays to its end with invariants on, the same every time', () => {
  const deck: CardId[] = ['walker', 'archer', 'flare', 'walker', 'archer', 'flare', 'walker', 'flare'];
  const setup = { ...matchSetup(9), cards: CARDS, decks: [deck, deck] as [CardId[], CardId[]] };
  const playOut = () => {
    let state = createMatch(setup);
    let blasts = 0;
    while (state.result === null) {
      const commands: Command[] = [];
      if (state.tick % 40 === 0) {
        // Troops land on their own half in the left lane; flares aim at the enemy's left Outpost.
        for (const side of [0, 1] as const) {
          const hand = state.players[side].hand;
          const slot = (state.tick / 40) % hand.length;
          const spell = hand[slot] === 'flare';
          const y = side === 0 ? (spell ? 14_000 : 7000) : spell ? 6000 : 13_000;
          commands.push({ tick: state.tick, side, handSlot: slot, x: 2000, y });
        }
      }
      state = step(state, commands);
      blasts += state.blasts.length;
      expect(checkInvariants(state)).toEqual([]);
    }
    return { hash: hashState(state), tick: state.tick, blasts };
  };
  const first = playOut();
  expect(first.blasts).toBeGreaterThan(0);
  expect(playOut()).toEqual(first);
});
