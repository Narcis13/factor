import { checkInvariants, createMatch, step, type Command, type SimState, type Unit } from '@factor/sim';
import { expect, test } from 'vitest';
import { CARDS, DECK_CARD_IDS, matchSetup, type ContentCardId } from '../src/index.ts';

// Each card's defining behavior (VISION §7), on the real arena and numbers. The arena: 18 × 32 tiles,
// the river at y 15000–17000, bridges at x 2000–5000 and 13000–16000. Side 0's Keep stands on 7000–11000 ×
// 1000–5000, its Outposts on 2000–5000 and 13000–16000 × 5000–8000; side 1's mirror them (Keep on y
// 27000–31000, Outposts on y 24000–27000). Tower ids: 0–2 side 0 (Keep, left, right), 3–5 side 1.
// Numbers come from CARDS, so tuning them keeps these true; what each test pins is the behavior.

const OUTPOST_HP = 2500;

/** What a spell does to a tower: its damage less the towers' reduction. */
function towerShare(card: 'flare' | 'meteor' | 'spark'): number {
  const { damage, towerDamageBp } = CARDS[card].spell;
  return Math.floor((damage * towerDamageBp) / 10_000);
}

/** A match where both decks hold every deck card it needs (the rest of the deck is filler). */
function match(...cards: ContentCardId[]): SimState {
  const deck = [...cards, ...DECK_CARD_IDS.filter((id) => !cards.includes(id))].slice(0, 8);
  return createMatch(matchSetup(11, [deck, deck]));
}

type Placement = Pick<Unit, 'side' | 'card' | 'x' | 'y'> & Partial<Unit>;

/** Puts units (or buildings) straight onto the field, ready to act unless told otherwise. */
function place(state: SimState, ...placements: Placement[]): SimState {
  const units = placements.map((placement, i): Unit => {
    const hp = state.cards[placement.card]?.type === 'spell' ? 1 : (state.cards[placement.card] as { unit: { hp: number } } | undefined)?.unit.hp ?? 1;
    return { id: state.nextId + i, hp, maxHp: hp, deployTicks: 0, age: 0, targetId: null, cooldown: 0, ...placement };
  });
  return { ...state, units: [...state.units, ...units], nextId: state.nextId + units.length };
}

/** Steps `ticks` times (with `commands` on the first), checking invariants on every state. */
function run(state: SimState, ticks: number, commands: Command[] = []): SimState[] {
  const states = [state];
  for (let i = 0; i < ticks && states.at(-1)?.result === null; i++) {
    const next = step(states.at(-1) ?? state, i === 0 ? commands : []);
    expect(checkInvariants(next)).toEqual([]);
    states.push(next);
  }
  return states;
}

function unit(state: SimState | undefined, id: number): Unit | undefined {
  return state?.units.find((candidate) => candidate.id === id);
}

/** A side's play of `card` at (x, y), from whichever hand slot holds it, with energy topped up. */
function cast(state: SimState, side: 0 | 1, card: ContentCardId, x: number, y: number): { state: SimState; command: Command } {
  let current = state;
  for (let cycle = 0; cycle < 8 && !current.players[side].hand.includes(card); cycle++) {
    const player = current.players[side];
    const [first, ...rest] = player.hand;
    const queue = [...player.queue];
    const next = queue.shift();
    if (first === undefined || next === undefined) {
      break;
    }
    const players: SimState['players'] = [current.players[0], current.players[1]];
    players[side] = { ...player, hand: [next, ...rest], queue: [...queue, first] };
    current = { ...current, players };
  }
  const players: SimState['players'] = [current.players[0], current.players[1]];
  players[side] = { ...current.players[side], energy: 10, energyProgress: 0 };
  current = { ...current, players };
  const handSlot = current.players[side].hand.indexOf(card);
  expect(handSlot).toBeGreaterThanOrEqual(0);
  return { state: current, command: { tick: current.tick, side, handSlot, x, y } };
}

test('every deck card is a legal card of some kind, at a playable cost', () => {
  expect(DECK_CARD_IDS).toHaveLength(16);
  for (const id of DECK_CARD_IDS) {
    expect(() => match(id)).not.toThrow();
  }
});

test('juggernaut walks past enemy troops and only hits buildings', () => {
  const start = place(match('juggernaut', 'warden'), { side: 0, card: 'juggernaut', x: 3500, y: 18_000 }, { side: 1, card: 'warden', x: 3500, y: 20_500, deployTicks: 20 });
  const states = run(start, 200);
  expect(states.some((state) => unit(state, 6)?.targetId === 4)).toBe(true);
  expect(states.every((state) => unit(state, 6)?.targetId !== 7)).toBe(true);
});

test('warden fights the nearest ground enemy and ignores a flyer over it', () => {
  const start = place(match('warden', 'harrier'), { side: 0, card: 'warden', x: 9000, y: 12_000 }, { side: 1, card: 'harrier', x: 9000, y: 12_900, deployTicks: 20 }, { side: 1, card: 'warden', x: 9000, y: 14_000, deployTicks: 20 });
  const states = run(start, 30);
  expect(states.some((state) => unit(state, 6)?.targetId === 8)).toBe(true);
  expect(states.every((state) => unit(state, 6)?.targetId !== 7)).toBe(true);
});

test('slinger shoots a flyer from range with shots that fly', () => {
  const start = place(match('slinger', 'harrier'), { side: 0, card: 'slinger', x: 9000, y: 10_000 }, { side: 1, card: 'harrier', x: 9000, y: 14_500, deployTicks: 20 });
  const states = run(start, 30);
  expect(states.some((state) => state.projectiles.length > 0)).toBe(true);
  expect(unit(states.at(-1), 7)?.hp).toBeLessThan(CARDS.harrier.unit.hp);
});

test('flare burns every enemy in its circle for its full damage, a tower for its share', () => {
  const field = place(match('flare', 'rabble'), { side: 1, card: 'warden', x: 3500, y: 22_000, deployTicks: 20 }, { side: 1, card: 'bombardier', x: 4500, y: 21_000, deployTicks: 20 });
  const { state, command } = cast(field, 0, 'flare', 3500, 22_500);
  const after = run(state, 1, [command]).at(-1);
  expect(unit(after, 6)?.hp).toBe(CARDS.warden.unit.hp - CARDS.flare.spell.damage);
  expect(unit(after, 7)?.hp).toBe(CARDS.bombardier.unit.hp - CARDS.flare.spell.damage);
  expect(after?.towers[4]?.hp).toBe(OUTPOST_HP - towerShare('flare'));
});

test('rabble is a group from one play', () => {
  const { state, command } = cast(match('rabble'), 0, 'rabble', 9000, 12_500);
  const after = run(state, 1, [command]).at(-1);
  expect(after?.units.filter((candidate) => candidate.card === 'rabble')).toHaveLength(CARDS.rabble.unit.count);
});

test('harrier flies straight over the water to a tower, ignoring the bridges', () => {
  const states = run(place(match('harrier'), { side: 0, card: 'harrier', x: 9000, y: 12_000 }), 200);
  expect(states.some((state) => {
    const harrier = unit(state, 6);
    return harrier !== undefined && harrier.y >= 15_000 && harrier.y < 17_000 && harrier.x > 5000 && harrier.x < 13_000;
  })).toBe(true);
});

test('bombardier’s lob hits a whole group at once', () => {
  const field = place(match('bombardier', 'rabble'), { side: 0, card: 'bombardier', x: 9000, y: 10_000 }, ...[0, 1, 2, 3].map((i) => ({ side: 1 as const, card: 'rabble', x: 8400 + i * 400, y: 13_500, deployTicks: 20 })));
  const states = run(field, 40);
  const firstHit = states.find((state) => state.units.some((candidate) => candidate.card === 'rabble' && candidate.hp < CARDS.rabble.unit.hp));
  const left = CARDS.rabble.unit.hp - CARDS.bombardier.unit.damage;
  expect(firstHit?.units.filter((candidate) => candidate.card === 'rabble' && candidate.hp === left).length).toBeGreaterThanOrEqual(3);
});

test('bastion shoots air and ground, and is gone after its lifetime on its own', () => {
  const start = place(match('bastion', 'harrier'), { side: 0, card: 'bastion', x: 9000, y: 9000 }, { side: 1, card: 'harrier', x: 9000, y: 13_000, deployTicks: 20 });
  const states = run(start, 20);
  expect(states.some((state) => unit(state, 6)?.targetId === 7)).toBe(true);
  const life = CARDS.bastion.lifetimeTicks;
  const alone = run(place(match('bastion'), { side: 0, card: 'bastion', x: 9000, y: 9000 }), life + 1);
  expect(unit(alone[life - 1], 6)).toBeDefined();
  expect(unit(alone[life], 6)).toBeUndefined();
});

test('hive sends out two mites as it stands, then two more every 5 s', () => {
  const { state, command } = cast(match('hive'), 0, 'hive', 9000, 9000);
  const states = run(state, 141, [command]);
  const mites = (at: number) => states[at]?.units.filter((candidate) => candidate.card === 'mite').length ?? 0;
  // Placed on tick 1, it stands from tick 21 (a 1 s deploy), and spawns then.
  expect(mites(20)).toBe(0);
  expect(mites(21)).toBe(2);
  expect(mites(120)).toBe(2);
  expect(mites(121)).toBe(4);
});

test('charger outruns a juggernaut to the same tower and hits it hard', () => {
  const start = place(match('charger', 'juggernaut'), { side: 0, card: 'charger', x: 3500, y: 12_000 }, { side: 0, card: 'juggernaut', x: 4500, y: 12_000 });
  const states = run(start, 160);
  const firstLock = (id: number) => states.findIndex((state) => unit(state, id)?.targetId === 4);
  expect(firstLock(6)).toBeGreaterThan(0);
  expect(firstLock(6)).toBeLessThan(firstLock(7) < 0 ? Number.MAX_SAFE_INTEGER : firstLock(7));
  expect(states.at(-1)?.towers[4]?.hp).toBeLessThanOrEqual(OUTPOST_HP - CARDS.charger.unit.damage);
});

test('airship flies over the river to a tower and drops a heavy bomb on it', () => {
  const states = run(place(match('airship'), { side: 0, card: 'airship', x: 9000, y: 12_000 }), 400);
  expect(states.some((state) => (unit(state, 6)?.y ?? 0) > 15_000 && (unit(state, 6)?.y ?? 0) < 17_000 && (unit(state, 6)?.x ?? 0) > 5000)).toBe(true);
  const bombed = states.find((state) => state.towers.some((tower) => tower.side === 1 && tower.hp < tower.maxHp));
  expect(bombed?.towers.filter((tower) => tower.side === 1).map((tower) => tower.maxHp - tower.hp)).toContain(CARDS.airship.unit.damage);
});

test('wisps are a flight of fragile flyers that shoot other flyers', () => {
  const { state, command } = cast(place(match('wisps', 'harrier'), { side: 1, card: 'harrier', x: 9000, y: 14_000, deployTicks: 20 }), 0, 'wisps', 9000, 12_500);
  const states = run(state, 40, [command]);
  expect(states[1]?.units.filter((candidate) => candidate.card === 'wisps')).toHaveLength(CARDS.wisps.unit.count);
  expect(unit(states.at(-1), 6)?.hp).toBeLessThan(CARDS.harrier.unit.hp);
});

test('meteor kills a slinger and a bombardier outright, and hits a tower for its share', () => {
  const field = place(match('meteor', 'slinger'), { side: 1, card: 'slinger', x: 3000, y: 22_000, deployTicks: 20 }, { side: 1, card: 'bombardier', x: 4000, y: 22_500, deployTicks: 20 });
  const { state, command } = cast(field, 0, 'meteor', 3500, 22_800);
  const after = run(state, 1, [command]).at(-1);
  expect(after?.units).toEqual([]);
  expect(after?.towers[4]?.hp).toBe(OUTPOST_HP - towerShare('meteor'));
});

test('spark wipes out a flight of wisps for 2 energy, and barely scratches a warden', () => {
  const field = place(match('spark', 'wisps'), ...[0, 1, 2, 3].map((i) => ({ side: 1 as const, card: 'wisps', x: 8400 + i * 400, y: 20_000, deployTicks: 20 })), { side: 1, card: 'warden', x: 9000, y: 21_000, deployTicks: 20 });
  const { state, command } = cast(field, 0, 'spark', 9000, 20_200);
  const after = run(state, 1, [command]).at(-1);
  expect(CARDS.spark.spell.damage).toBeGreaterThanOrEqual(CARDS.wisps.unit.hp);
  expect(after?.units.map((candidate) => [candidate.card, candidate.hp])).toEqual([['warden', CARDS.warden.unit.hp - CARDS.spark.spell.damage]]);
  expect(CARDS.spark.cost).toBe(2);
});

test('reaver’s swing hits every ground enemy round its target at once', () => {
  const field = place(
    match('reaver', 'rabble'),
    { side: 0, card: 'reaver', x: 9000, y: 12_000 },
    { side: 1, card: 'rabble', x: 9000, y: 13_200, deployTicks: 20 },
    { side: 1, card: 'rabble', x: 9700, y: 13_400, deployTicks: 20 },
    { side: 1, card: 'rabble', x: 8300, y: 13_400, deployTicks: 20 },
  );
  const states = run(field, 15);
  const swung = states.find((state) => state.units.some((candidate) => candidate.card === 'rabble' && candidate.hp < CARDS.rabble.unit.hp));
  const left = CARDS.rabble.unit.hp - CARDS.reaver.unit.damage;
  expect(swung?.units.filter((candidate) => candidate.card === 'rabble' && candidate.hp === left)).toHaveLength(3);
});

test('duelist takes a warden down in four blows', () => {
  const start = place(match('duelist', 'warden'), { side: 0, card: 'duelist', x: 9000, y: 12_000 }, { side: 1, card: 'warden', x: 9000, y: 13_200, deployTicks: 20 });
  const states = run(start, 20);
  expect(unit(states.find((state) => (unit(state, 7)?.hp ?? 1200) < 1200), 7)?.hp).toBe(CARDS.warden.unit.hp - CARDS.duelist.unit.damage);
  expect(Math.ceil(CARDS.warden.unit.hp / CARDS.duelist.unit.damage)).toBe(4);
});
