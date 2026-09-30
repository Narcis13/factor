import { createRandomBot } from '@factor/bot';
import { ARENA, BOT_TUNING, matchSetup, saveReplay, STARTER_DECKS } from '@factor/content';
import { createMatch, hashState, type Command, type SimState } from '@factor/sim';
import { expect, test } from 'vitest';
import type { ScreenRect } from '../src/arena-view.ts';
import { tap, type Controls } from '../src/controls.ts';
import { advance, createLoop, queuePlay, runTo, TICK_MS, type MatchLoop } from '../src/match-loop.ts';
import { loopReplay, readReplay, type ReplaySources } from '../src/match-replay.ts';
import { layoutScreen } from '../src/screen-layout.ts';

const SEED = 9;
const START = createMatch(matchSetup(SEED));
const PHONE = layoutScreen(ARENA, 4, 540, 960);

function center(rect: ScreenRect | undefined): [number, number] {
  if (rect === undefined) {
    throw new Error('no rect');
  }
  return [rect.x + rect.width / 2, rect.y + rect.height / 2];
}

/** A live match against the bot with a tap every 3 s, played to its end; every 500th state kept. */
function liveMatch(): { loop: MatchLoop; checkpoints: Map<number, SimState> } {
  const loop = createLoop(START, [createRandomBot(1, SEED, START, BOT_TUNING)]);
  const checkpoints = new Map<number, SimState>();
  for (let i = 0; loop.current.result === null; i++) {
    runTo(loop, loop.current.tick + 60);
    queuePlay(loop, 0, i % 4, 3500 + (i % 2) * 11000, 3000 + (i % 7) * 1000);
    advance(loop, TICK_MS);
    if (loop.current.tick % 500 < 61) {
      checkpoints.set(loop.current.tick, loop.current);
    }
  }
  return { loop, checkpoints };
}

test('a replay fed to the loop plays the recorded match back state for state', () => {
  const { loop: live, checkpoints } = liveMatch();
  expect(live.commands.filter((command) => command.side === 0).length).toBeGreaterThan(30);
  const watch = createLoop(START, [], live.commands);
  for (const [tick, state] of checkpoints) {
    runTo(watch, tick);
    expect(hashState(watch.current)).toBe(hashState(state));
  }
  runTo(watch, Number.MAX_SAFE_INTEGER);
  expect(watch.current.tick).toBe(live.current.tick);
  expect(watch.current.result).toEqual(live.current.result);
  expect(hashState(watch.current)).toBe(hashState(live.current));
  // The watched loop records what it sent, so saving it again gives the same file.
  expect(watch.commands).toEqual(live.commands);
  expect(watch.feed).toEqual([]);
  expect(saveReplay(loopReplay(SEED, STARTER_DECKS, watch))).toBe(saveReplay(loopReplay(SEED, STARTER_DECKS, live)));
});

test('in real time, playback matches jumping straight to a tick', () => {
  const { loop: live } = liveMatch();
  const realTime = createLoop(START, [], live.commands);
  for (let frame = 0; frame < 60 * 40; frame++) {
    advance(realTime, 1000 / 60);
  }
  const jumped = createLoop(START, [], live.commands);
  runTo(jumped, realTime.current.tick);
  expect(realTime.current.tick).toBeGreaterThan(790);
  expect(hashState(realTime.current)).toBe(hashState(jumped.current));
  expect(realTime.blasts).toEqual(jumped.blasts);
});

test('the loop copies the feed, so the replay it came from is left alone', () => {
  const commands: Command[] = [{ tick: 0, side: 0, handSlot: 0, x: 9000, y: 4500 }];
  const loop = createLoop(START, [], commands);
  runTo(loop, 5);
  expect(commands).toHaveLength(1);
  expect(loop.feed).toEqual([]);
  expect(loop.current.units).toHaveLength(1);
});

test('while watching, taps neither select nor play; the end screen still answers', () => {
  const loop = createLoop(START);
  const controls: Controls = { side: 0, selected: null, watching: true };
  expect(tap(controls, loop, PHONE, ...center(PHONE.hud.slots[0]))).toBeNull();
  expect(controls.selected).toBeNull();
  controls.selected = 1;
  expect(tap(controls, loop, PHONE, 270, 700)).toBeNull();
  expect(loop.queued).toEqual([]);
  const ended = createLoop({ ...START, result: { winner: 0 } });
  expect(tap(controls, ended, PHONE, ...center(PHONE.end.again))).toBe('again');
  expect(tap(controls, ended, PHONE, ...center(PHONE.end.save))).toBe('save-replay');
});

function sources(stored: string | null, files: Record<string, string> = {}): ReplaySources & { fetched: string[] } {
  const fetched: string[] = [];
  return {
    fetched,
    stored: () => stored,
    fetchText: (url) => {
      fetched.push(url);
      const text = files[url];
      return text === undefined ? Promise.reject(new Error(`404 ${url}`)) : Promise.resolve(text);
    },
  };
}

test('?replay=last reads the replay kept in this browser; any other name is fetched', async () => {
  const replay = loopReplay(SEED, STARTER_DECKS, createLoop(START, [], [{ tick: 3, side: 1, handSlot: 2, x: 9000, y: 27500 }]));
  const text = saveReplay(replay);
  const kept = sources(text);
  expect(await readReplay('last', kept)).toEqual(replay);
  expect(kept.fetched).toEqual([]);
  const served = sources(null, { 'replays/seed-9.json': text });
  expect(await readReplay('replays/seed-9.json', served)).toEqual(replay);
  expect(served.fetched).toEqual(['replays/seed-9.json']);
});

test('a missing or invalid replay is refused with a reason', async () => {
  await expect(readReplay('last', sources(null))).rejects.toThrow(/No replay is saved/);
  await expect(readReplay('nope.json', sources(null))).rejects.toThrow(/404 nope.json/);
  await expect(readReplay('last', sources('{"version":0}'))).rejects.toThrow(/Invalid replay/);
  await expect(readReplay('bad.json', sources(null, { 'bad.json': 'not json' }))).rejects.toThrow(/not JSON/);
});
