import { expect, test } from 'vitest';
import { loadReplay, REPLAY_VERSION, saveReplay, STARTER_DECK, type Replay } from '../src/index.ts';

const REPLAY: Replay = {
  version: REPLAY_VERSION,
  seed: 0xffffffff,
  decks: [STARTER_DECK, ['flare', 'flare', 'flare', 'flare', 'warden', 'warden', 'slinger', 'juggernaut']],
  commands: [
    { tick: 0, side: 1, handSlot: 0, x: 0, y: 31_999 },
    { tick: 0, side: 0, handSlot: 3, x: 17_500, y: 500 },
    { tick: 1200, side: 0, handSlot: -1, x: -5, y: 40_000 },
  ],
};

test('a saved replay loads back equal, and saves to the same text again', () => {
  const text = saveReplay(REPLAY);
  const loaded = loadReplay(text);
  expect(loaded).toEqual(REPLAY);
  expect(saveReplay(loaded)).toBe(text);
});

test('a replay with no commands round-trips', () => {
  const empty: Replay = { version: REPLAY_VERSION, seed: 0, decks: [STARTER_DECK, STARTER_DECK], commands: [] };
  expect(loadReplay(saveReplay(empty))).toEqual(empty);
});

test('the saved file is plain JSON with the fields in format order', () => {
  const json = JSON.parse(saveReplay(REPLAY)) as Record<string, unknown>;
  expect(Object.keys(json)).toEqual(['version', 'seed', 'decks', 'commands']);
  expect(json.version).toBe(0);
});

test('loading keeps command order, including within a tick', () => {
  expect(loadReplay(saveReplay(REPLAY)).commands.map((command) => command.side)).toEqual([1, 0, 0]);
});

test('an invalid replay is never saved', () => {
  const bad = { ...REPLAY, seed: -1 };
  expect(() => saveReplay(bad)).toThrow(/seed/);
});
