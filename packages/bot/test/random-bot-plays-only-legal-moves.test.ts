import { BOT_TUNING, STARTER_DECK } from '@factor/content';
import { deployZones, MILLI_PER_TILE } from '@factor/sim';
import { expect, test } from 'vitest';
import { playBotMatch } from '../src/index.ts';
import { replayChecked } from './fixtures.ts';

const SEEDS = [0, 1, 2, 3, 42, 1234, 0xffffffff];

test.each(SEEDS)('seed %i: a bot-vs-bot match ends with invariants held and no command rejected', (seed) => {
  const { state, commands } = playBotMatch(seed);
  expect(state.result).not.toBeNull();
  const { states, rejected } = replayChecked(seed, commands);
  expect(rejected).toEqual([]);
  expect(states.at(-1)).toEqual(state);
  // Both sides play all match long, not just once.
  for (const side of [0, 1] as const) {
    expect(commands.filter((command) => command.side === side).length).toBeGreaterThan(10);
  }
});

test('troops and buildings land on tile centers of their own side’s deploy zones', () => {
  const { commands } = playBotMatch(7);
  const { states } = replayChecked(7, commands);
  let troops = 0;
  for (const command of commands) {
    const before = states[command.tick];
    const card = before?.players[command.side].hand[command.handSlot];
    const type = card === undefined ? undefined : before?.cards[card]?.type;
    if (before === undefined || type === undefined || type === 'spell') {
      continue;
    }
    troops++;
    expect(command.x % MILLI_PER_TILE).toBe(MILLI_PER_TILE / 2);
    expect(command.y % MILLI_PER_TILE).toBe(MILLI_PER_TILE / 2);
    const inZone = deployZones(before, command.side).some((zone) => command.x > zone.x && command.x < zone.x + zone.width && command.y > zone.y && command.y < zone.y + zone.height);
    expect(inZone).toBe(true);
  }
  expect(troops).toBeGreaterThan(10);
});

test('spells aim at the center of a standing enemy tower or an enemy unit', () => {
  const flares = Array.from({ length: 8 }, () => 'flare');
  const decks = [flares, [...STARTER_DECK]] as const;
  const { commands } = playBotMatch(5, decks);
  const { states } = replayChecked(5, commands, decks);
  const casts = commands.filter((command) => command.side === 0);
  expect(casts.length).toBeGreaterThan(10);
  for (const { tick, x, y } of casts) {
    const before = states[tick];
    const enemies = [...(before?.towers ?? []).filter((tower) => tower.side === 1 && tower.hp > 0), ...(before?.units ?? []).filter((unit) => unit.side === 1)];
    expect(enemies.some((enemy) => enemy.x === x && enemy.y === y)).toBe(true);
  }
  // Some of them land on units, not only on towers.
  expect(casts.some(({ tick, x, y }) => states[tick]?.units.some((unit) => unit.x === x && unit.y === y))).toBe(true);
});

test('a bot waits its minimum between plays, and waits for energy', () => {
  const { commands } = playBotMatch(3);
  const { states } = replayChecked(3, commands);
  for (const side of [0, 1] as const) {
    const ticks = commands.filter((command) => command.side === side).map((command) => command.tick);
    expect(ticks[0]).toBeGreaterThanOrEqual(BOT_TUNING.minWaitTicks);
    for (let i = 1; i < ticks.length; i++) {
      expect((ticks[i] ?? 0) - (ticks[i - 1] ?? 0)).toBeGreaterThanOrEqual(BOT_TUNING.minWaitTicks);
    }
  }
  // It sometimes saves up: some plays happen with energy to spare beyond the card's cost, others at the exact cost.
  const spare = commands.map(({ tick, side, handSlot }) => {
    const player = states[tick]?.players[side];
    const card = player?.hand[handSlot];
    return (player?.energy ?? 0) - (card === undefined ? 0 : (states[tick]?.cards[card]?.cost ?? 0));
  });
  expect(spare.every((energy) => energy >= 0)).toBe(true);
  expect(spare.some((energy) => energy === 0)).toBe(true);
  expect(spare.some((energy) => energy > 0)).toBe(true);
});
