import { expect, test } from 'vitest';
import { checkInvariants, step, type MatchRules, type SimState } from '../src/index.ts';
import { idle, newMatch, RULES } from './fixtures.ts';

const SHORT: MatchRules = { ...RULES, regulationTicks: 100, overtimeTicks: 40 };

/** Stars can't be earned until towers exist, so these scenarios set them directly. */
function withStars(state: SimState, blue: number, red: number): SimState {
  return { ...state, stars: [blue, red] };
}

test('an empty match plays through overtime and ends in a draw when the timer runs out', () => {
  let state = newMatch(21);
  const end = RULES.regulationTicks + RULES.overtimeTicks;
  while (state.tick < end) {
    expect(state.result).toBeNull();
    state = step(state, []);
    expect(checkInvariants(state)).toEqual([]);
  }
  expect(state.tick).toBe(6000);
  expect(state.result).toEqual({ winner: null });
});

test('more stars when regulation runs out wins on that exact tick', () => {
  const lastRegulationTick = idle(newMatch(1, SHORT), 99);
  const ended = step(withStars(lastRegulationTick, 0, 1), []);
  expect(ended.tick).toBe(100);
  expect(ended.result).toEqual({ winner: 1 });
});

test('a star lead during regulation does not end the match early', () => {
  let state = withStars(newMatch(1, SHORT), 2, 1);
  state = idle(state, 99);
  expect(state.result).toBeNull();
});

test('tied stars when regulation runs out go to overtime', () => {
  const state = idle(withStars(newMatch(1, SHORT), 1, 1), 100);
  expect(state.result).toBeNull();
});

test('the first star in overtime wins at once', () => {
  const overtime = idle(newMatch(1, SHORT), 110);
  const ended = step(withStars(overtime, 1, 0), []);
  expect(ended.tick).toBe(111);
  expect(ended.result).toEqual({ winner: 0 });
});

test('stars and every tower still even when overtime runs out is a draw', () => {
  const lastOvertimeTick = idle(withStars(newMatch(1, SHORT), 2, 2), 139);
  expect(lastOvertimeTick.result).toBeNull();
  expect(step(lastOvertimeTick, []).result).toEqual({ winner: null });
});

/** Sets towers' hp by id. */
function withHp(state: SimState, hp: Record<number, number>): SimState {
  return { ...state, towers: state.towers.map((tower) => ({ ...tower, hp: hp[tower.id] ?? tower.hp })) };
}

test('stars tied when overtime runs out: the side whose weakest standing tower has less hp loses', () => {
  // Fixture towers: Keeps 300 hp, Outposts 200. Side 0's left Outpost (1) is down to 150, side 1's
  // right Outpost (5) to 120: side 1's weakest is weaker, so side 0 wins.
  const last = idle(newMatch(1, SHORT), 139);
  expect(step(withHp(last, { 1: 150, 5: 120 }), []).result).toEqual({ winner: 0 });
  expect(step(withHp(last, { 1: 100, 5: 120 }), []).result).toEqual({ winner: 1 });
  // A Keep counts too, and the weakest decides, not the total.
  expect(step(withHp(last, { 0: 90, 4: 100, 5: 100 }), []).result).toEqual({ winner: 1 });
  expect(step(withHp(last, { 2: 77, 3: 77 }), []).result).toEqual({ winner: null });
});

test('the tiebreak counts standing towers only: a fallen Outpost is not a weakest tower of 0', () => {
  // Each side lost an Outpost (one star each); side 1's standing towers are the weaker.
  const last = withStars(idle(newMatch(1, SHORT), 139), 1, 1);
  expect(step(withHp(last, { 1: 0, 4: 0, 2: 180, 5: 170 }), []).result).toEqual({ winner: 0 });
});

test('the tiebreak is only for the end of overtime: tied stars at the end of regulation still go on', () => {
  const lastRegulationTick = idle(newMatch(1, SHORT), 99);
  expect(step(withHp(lastRegulationTick, { 1: 10 }), []).result).toBeNull();
});

test('with no overtime, tied stars when regulation runs out go straight to the tiebreak', () => {
  const state = idle(newMatch(1, { ...RULES, regulationTicks: 100, overtimeTicks: 0 }), 100);
  expect(state.result).toEqual({ winner: null });
  const weak = withHp(idle(newMatch(1, { ...RULES, regulationTicks: 100, overtimeTicks: 0 }), 99), { 2: 50 });
  expect(step(weak, []).result).toEqual({ winner: 1 });
});

test('stepping a match that has ended throws', () => {
  const ended = idle(newMatch(1, SHORT), 140);
  expect(() => step(ended, [])).toThrow(/already ended at tick 140/);
});

test.each([
  { regulationTicks: 0, overtimeTicks: 40 },
  { regulationTicks: 3 / 2, overtimeTicks: 40 },
  { regulationTicks: 100, overtimeTicks: -1 },
  { regulationTicks: 100, overtimeTicks: Number.NaN },
])('rules $regulationTicks + $overtimeTicks are rejected', (timer) => {
  expect(() => newMatch(1, { ...RULES, ...timer })).toThrow(RangeError);
});
