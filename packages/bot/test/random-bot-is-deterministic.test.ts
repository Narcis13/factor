import { BOT_TUNING, matchSetup } from '@factor/content';
import { createMatch, hashState, step } from '@factor/sim';
import { expect, test } from 'vitest';
import { botTurn, createRandomBot, playBotMatch } from '../src/index.ts';

test('the same seed plays the same bot match; another seed plays another', () => {
  const first = playBotMatch(99);
  const again = playBotMatch(99);
  expect(again.commands).toEqual(first.commands);
  expect(hashState(again.state)).toBe(hashState(first.state));
  expect(playBotMatch(100).commands).not.toEqual(first.commands);
});

test('the two sides’ bots draw from different streams, and neither from the match rng', () => {
  const state = createMatch(matchSetup(8));
  const [a, b] = [createRandomBot(0, 8, state, BOT_TUNING), createRandomBot(1, 8, state, BOT_TUNING)];
  expect(a.rng).not.toEqual(b.rng);
  expect(a.rng).not.toEqual(state.rng);
  expect(b.rng).not.toEqual(state.rng);
});

test('a turn mutates neither the bot nor the state', () => {
  let state = createMatch(matchSetup(4));
  let bot = createRandomBot(1, 4, state, BOT_TUNING);
  let played = 0;
  while (played < 5) {
    const [botText, stateText] = [JSON.stringify(bot), JSON.stringify(state)];
    const turn = botTurn(bot, state, BOT_TUNING);
    expect(JSON.stringify(bot)).toBe(botText);
    expect(JSON.stringify(state)).toBe(stateText);
    played += turn.commands.length;
    if (turn.commands.length === 0) {
      expect(turn.bot).toBe(bot);
    }
    bot = turn.bot;
    state = step(state, turn.commands);
  }
});

test('a bot plays nothing once the match has ended', () => {
  const { state } = playBotMatch(11);
  const bot = { ...createRandomBot(0, 11, state, BOT_TUNING), readyTick: 0 };
  const rich = { ...state, players: state.players.map((player) => ({ ...player, energy: 10 })) as typeof state.players };
  expect(botTurn(bot, rich, BOT_TUNING).commands).toEqual([]);
  expect(botTurn(bot, { ...rich, result: null }, BOT_TUNING).commands).toHaveLength(1);
});
