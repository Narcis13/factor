import { expect, test } from 'vitest';
import { loadReplay, parseReplay, REPLAY_VERSION } from '../src/index.ts';

const COMMAND = { tick: 10, side: 0, handSlot: 1, x: 9000, y: 4000 };
const VALID = { version: REPLAY_VERSION, seed: 42, decks: [[], []], commands: [COMMAND] };

test('a valid replay parses', () => {
  expect(parseReplay(VALID)).toEqual(VALID);
});

test.each([
  ['another version', { ...VALID, version: 1 }, 'version'],
  ['a missing field', { version: 0, seed: 42, decks: [[], []] }, 'commands'],
  ['an unknown top-level field', { ...VALID, extra: true }, 'Unrecognized key: "extra"'],
  ['a seed above uint32', { ...VALID, seed: 0x1_0000_0000 }, 'seed'],
  ['a fractional seed', { ...VALID, seed: 1.5 }, 'seed'],
  ['three decks', { ...VALID, decks: [[], [], []] }, 'decks'],
  ['a card id that is not a string', { ...VALID, decks: [[7], []] }, 'decks[0][0]'],
  ['a fractional position', { ...VALID, commands: [{ ...COMMAND, x: 9000.5 }] }, 'commands[0].x'],
  ['a numeric string', { ...VALID, commands: [{ ...COMMAND, y: '4000' }] }, 'commands[0].y'],
  ['side 2', { ...VALID, commands: [{ ...COMMAND, side: 2 }] }, 'commands[0].side'],
  ['a negative tick', { ...VALID, commands: [{ ...COMMAND, tick: -1 }] }, 'commands[0].tick'],
  ['an unsafe integer', { ...VALID, commands: [{ ...COMMAND, handSlot: 2 ** 53 }] }, 'commands[0].handSlot'],
  ['a missing command field', { ...VALID, commands: [{ tick: 1, side: 0, x: 0, y: 0 }] }, 'commands[0].handSlot'],
  // Rejected commands are copied into the state, so an extra key would change the hash.
  ['an unknown command field', { ...VALID, commands: [{ ...COMMAND, note: 'hi' }] }, '"note"\n  → at commands[0]'],
  [
    'commands out of tick order',
    { ...VALID, commands: [COMMAND, { ...COMMAND, tick: 9 }] },
    'commands[1].tick',
  ],
])('rejects %s, naming where', (_, json, where) => {
  expect(() => parseReplay(json)).toThrow(where.includes('"') ? where : `→ at ${where}`);
});

test('reports every problem at once', () => {
  const json = { ...VALID, seed: -1, commands: [{ ...COMMAND, side: 2 }] };
  expect(() => parseReplay(json)).toThrow(/at seed[\s\S]*at commands\[0\]\.side/);
});

test.each([null, [], 'replay', 42])('rejects %j as a whole', (json) => {
  expect(() => parseReplay(json)).toThrow('Invalid replay');
});

test('rejects text that is not JSON', () => {
  expect(() => loadReplay('{"version": 0,')).toThrow('Invalid replay: not JSON');
});

test('commands on the same tick are in order', () => {
  const json = { ...VALID, commands: [COMMAND, { ...COMMAND, side: 1 }, { ...COMMAND, side: 0 }] };
  expect(parseReplay(json).commands).toHaveLength(3);
});
