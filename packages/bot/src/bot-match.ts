import { BOT_TUNING, matchSetup, STARTER_DECKS, type BotTuning } from '@factor/content';
import { createMatch, step, type CardId, type Command, type SimState } from '@factor/sim';
import { botTurn, createBot, type Bot, type BotKind } from './bots.ts';

/** A finished bot-vs-bot match: its last state and every command both bots sent, in order. */
export interface BotMatch {
  state: SimState;
  commands: Command[];
}

/**
 * Plays a whole match with a bot on each side: random bots unless `kinds` says otherwise. The seed decides
 * everything, the bots included.
 */
export function playBotMatch(
  seed: number,
  decks: readonly [readonly CardId[], readonly CardId[]] = STARTER_DECKS,
  tuning: BotTuning = BOT_TUNING,
  kinds: readonly [BotKind, BotKind] = ['random', 'random'],
): BotMatch {
  let state = createMatch(matchSetup(seed, decks));
  const bots: Bot[] = [createBot(kinds[0], 0, seed, state, tuning), createBot(kinds[1], 1, seed, state, tuning)];
  const commands: Command[] = [];
  while (state.result === null) {
    const tickCommands: Command[] = [];
    bots.forEach((bot, side) => {
      const turn = botTurn(bot, state, tuning);
      bots[side] = turn.bot;
      tickCommands.push(...turn.commands);
    });
    commands.push(...tickCommands);
    state = step(state, tickCommands);
  }
  return { state, commands };
}
