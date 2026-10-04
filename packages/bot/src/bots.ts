import type { BotTuning } from '@factor/content';
import type { Command, Side, SimState } from '@factor/sim';
import { createHeuristicBot, heuristicTurn, type HeuristicBot } from './heuristic-bot.ts';
import { createRandomBot, randomTurn, type RandomBot } from './random-bot.ts';

/** Either opponent, as plain JSON. */
export type Bot = RandomBot | HeuristicBot;

/** Which opponent: the Stage 1 random-legal-move bot, or the Stage 3 heuristic one. */
export type BotKind = Bot['kind'];

/** A bot of `kind` for `side` of the match `state` starts, seeded from the match seed. */
export function createBot(kind: BotKind, side: Side, seed: number, state: SimState, tuning: BotTuning): Bot {
  return kind === 'random' ? createRandomBot(side, seed, state, tuning) : createHeuristicBot(side, seed);
}

/** A bot's commands for `state.tick`, and its next state. Never mutates `bot` or `state`. */
export function botTurn<B extends Bot>(bot: B, state: SimState, tuning: BotTuning): { bot: B; commands: Command[] };
export function botTurn(bot: Bot, state: SimState, tuning: BotTuning): { bot: Bot; commands: Command[] } {
  return bot.kind === 'random' ? randomTurn(bot, state, tuning) : heuristicTurn(bot, state, tuning.heuristic);
}
