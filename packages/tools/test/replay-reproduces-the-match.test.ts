import { loadReplay, REPLAY_VERSION, saveReplay, type Replay } from '@factor/content';
import { hashState } from '@factor/sim';
import { expect, test } from 'vitest';
import { emptyReplay, playReplay } from '../src/index.ts';

const REPLAY: Replay = {
  version: REPLAY_VERSION,
  seed: 1234,
  decks: [[], []],
  commands: [
    { tick: 0, side: 0, handSlot: 0, x: 9000, y: 4000 },
    { tick: 50, side: 1, handSlot: 2, x: 3000, y: 28_000 },
    { tick: 50, side: 0, handSlot: 1, x: 15_000, y: 5000 },
    { tick: 50, side: 0, handSlot: 3, x: 1000, y: 1000 },
    { tick: 5999, side: 1, handSlot: 0, x: 0, y: 0 },
  ],
};

const CHECKPOINTS = [0, 1, 50, 51, 52, 3600, 6000];

function hashesAt(replay: Replay): string[] {
  return CHECKPOINTS.map((tick) => hashState(playReplay(replay, tick)));
}

test('a saved and reloaded replay gives the same hash at every checkpoint', () => {
  const reloaded = loadReplay(saveReplay(REPLAY));
  expect(hashesAt(reloaded)).toEqual(hashesAt(REPLAY));
});

test('each command is fed at its own tick, side 0 first, in order within a side', () => {
  expect(playReplay(REPLAY, 1).rejected.map((r) => r.command)).toEqual([REPLAY.commands[0]]);
  expect(playReplay(REPLAY, 50).rejected).toEqual([]);
  const at51 = playReplay(REPLAY, 51).rejected;
  expect(at51.map((r) => r.command.handSlot)).toEqual([1, 3, 2]);
  expect(at51.every((r) => r.reason === 'empty-slot')).toBe(true);
});

test('playing to the end reaches the result, with the last-tick command applied', () => {
  const state = playReplay(REPLAY);
  expect(state.tick).toBe(6000);
  expect(state.result).toEqual({ winner: null });
  expect(state.rejected.map((r) => r.command)).toEqual([REPLAY.commands[4]]);
});

test('moving one command to another tick changes the hash from that tick on', () => {
  const moved: Replay = {
    ...REPLAY,
    commands: REPLAY.commands.map((command, i) => (i === 3 ? { ...command, tick: 51 } : command)),
  };
  const [original, changed] = [hashesAt(REPLAY), hashesAt(moved)];
  expect(changed.slice(0, 3)).toEqual(original.slice(0, 3));
  expect(changed[3]).not.toBe(original[3]);
});

test('the seed changes every hash; an empty replay is the empty match', () => {
  expect(hashesAt({ ...REPLAY, seed: 1235 })[0]).not.toBe(hashesAt(REPLAY)[0]);
  const empty = emptyReplay(1234);
  expect(hashState(playReplay(empty))).toBe(hashState(playReplay({ ...REPLAY, commands: [] })));
});

test('a replay with commands after the match ended does not belong to it', () => {
  const late: Replay = { ...REPLAY, commands: [{ tick: 6000, side: 0, handSlot: 0, x: 0, y: 0 }] };
  expect(() => playReplay(late)).toThrow('The match ended at tick 6000 with 1 commands unplayed');
  expect(playReplay(late, 100).tick).toBe(100);
});

test('a replay built in code is validated before it plays', () => {
  const unordered: Replay = { ...REPLAY, commands: [REPLAY.commands[1], REPLAY.commands[0]].filter((c) => c !== undefined) };
  expect(() => playReplay(unordered)).toThrow('Commands must be in tick order');
});
