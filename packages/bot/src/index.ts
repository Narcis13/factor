// The AI opponent: observation → commands, deterministic (VISION §5).
export { botTurn, createBot, type Bot, type BotKind } from './bots.ts';
export { createHeuristicBot, heuristicTurn, type HeuristicBot, type HeuristicTurn } from './heuristic-bot.ts';
export { createRandomBot, randomTurn, type BotTurn, type RandomBot } from './random-bot.ts';
export { playBotMatch, type BotMatch } from './bot-match.ts';
