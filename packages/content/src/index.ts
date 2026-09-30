// Card, unit and arena definitions live here as data (VISION §5).
export { ARENA, towerFootprint } from './arena.ts';
export { BOT_TUNING, type BotTuning } from './bot.ts';
export { CARD_IDS, CARDS, STARTER_DECK, type ContentCardId } from './cards.ts';
export { MATCH_RULES } from './match.ts';
export { matchSetup, STARTER_DECKS } from './setup.ts';
export { TOWER_STATS } from './towers.ts';
export { loadReplay, parseReplay, REPLAY_VERSION, saveReplay, type Replay } from './replay.ts';
