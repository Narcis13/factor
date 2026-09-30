import { botTurn, createRandomBot, playBotMatch } from '@factor/bot';
import { BOT_TUNING, matchSetup, REPLAY_VERSION, STARTER_DECKS, type Replay } from '@factor/content';
import { createMatch, step, type Command } from '@factor/sim';
import { expect, test } from 'vitest';
import { defaultShots, END_TICK, shoot, SHOT_TICK, SHOT_VIEWPORT, shotQuery } from '../src/shots.ts';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Width and height from the IHDR chunk, which always comes first. */
function pngSize(png: Buffer) {
  expect(png.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
  expect(png.toString('latin1', 12, 16)).toBe('IHDR');
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

/**
 * The live client's match to `SHOT_TICK` (seed 0, the bot on side 1, no taps) as a replay. A bot-vs-bot
 * match can't stand in: side 0's plays change what side 1's bot does.
 */
function liveReplay(): Replay {
  let state = createMatch(matchSetup(0));
  let bot = createRandomBot(1, 0, state, BOT_TUNING);
  const commands: Command[] = [];
  while (state.tick < SHOT_TICK) {
    const turn = botTurn(bot, state, BOT_TUNING);
    bot = turn.bot;
    commands.push(...turn.commands);
    state = step(state, turn.commands);
  }
  expect(commands.length).toBeGreaterThan(0);
  return { version: REPLAY_VERSION, seed: 0, decks: [[...STARTER_DECKS[0]], [...STARTER_DECKS[1]]], commands };
}

test('the default shots are the live arena at tick 90 and the end of a bot-vs-bot replay', () => {
  const [arena, end] = defaultShots();
  expect(shotQuery(arena ?? { name: '', tick: 0 })).toBe('tick=90');
  expect(end?.tick).toBe(END_TICK);
  expect(end?.replay?.commands).toEqual(playBotMatch(0).commands);
  expect(shotQuery(end ?? { name: '', tick: 0 })).toBe(`replay=shot-replay.json&tick=${String(END_TICK)}`);
});

// Needs Chromium: pnpm --filter @factor/tools exec playwright install --only-shell chromium
test('shots repeat to the same PNGs, and a replay shows exactly what live play showed', { timeout: 90_000 }, async () => {
  const replayed = { name: 'replayed', tick: SHOT_TICK, replay: liveReplay() };
  const [arena, end, again] = await shoot([...defaultShots(), replayed]);
  const [arena2, end2] = await shoot(defaultShots());
  for (const shot of [arena, end, again]) {
    expect(pngSize(shot?.png ?? Buffer.alloc(0))).toEqual(SHOT_VIEWPORT);
    expect(shot?.renderer).toBe('webgl');
  }
  expect(arena2?.png.equals(arena?.png ?? Buffer.alloc(0))).toBe(true);
  expect(end2?.png.equals(end?.png ?? Buffer.alloc(0))).toBe(true);
  expect(end?.png.equals(arena?.png ?? Buffer.alloc(0))).toBe(false);
  expect(again?.png.equals(arena?.png ?? Buffer.alloc(0))).toBe(true);
});
