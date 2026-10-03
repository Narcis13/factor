import type { BotTuning } from '@factor/content';
import {
  deployZone,
  MILLI_PER_TILE,
  nextBelow,
  placementRejection,
  seedRng,
  type CardStats,
  type Command,
  type Rng,
  type Side,
  type SimState,
} from '@factor/sim';

/**
 * The Stage 1 opponent (VISION §8): it picks a random hand slot, waits a random while and until it can
 * afford that card, then plays it at a random legal point. Plain JSON, like the sim state, with its
 * own rng so it never draws from the match's.
 */
export interface RandomBot {
  side: Side;
  rng: Rng;
  /** The hand slot it will play next. */
  slot: number;
  /** It plays no earlier than this tick. */
  readyTick: number;
}

/** What a bot does at one tick: its next state and the commands for that tick. */
export interface BotTurn {
  bot: RandomBot;
  commands: Command[];
}

const UINT32 = 0x100000000;
/** Spreads the two sides' bots, and the match's own rng, apart in seed space (the golden ratio, as in Fibonacci hashing). */
const SEED_STRIDE = 0x9e3779b9;

/** A bot for `side` of the match `state` starts, seeded from the match seed so a seed replays the same bot match. */
export function createRandomBot(side: Side, seed: number, state: SimState, tuning: BotTuning): RandomBot {
  const bot: RandomBot = { side, rng: seedRng((seed + SEED_STRIDE * (side + 1)) % UINT32), slot: 0, readyTick: 0 };
  pickNext(bot, state, tuning);
  return bot;
}

/**
 * The bot's commands for `state.tick`: none, or one legal play. Never mutates `bot` or `state`.
 * Once the match has ended it does nothing.
 */
export function botTurn(bot: RandomBot, state: SimState, tuning: BotTuning): BotTurn {
  const { side, slot } = bot;
  const card = state.players[side].hand[slot];
  const stats = card === undefined ? undefined : state.cards[card];
  if (state.result !== null || state.tick < bot.readyTick || stats === undefined || state.players[side].energy < stats.cost) {
    return { bot, commands: [] };
  }
  const next: RandomBot = { ...bot, rng: { ...bot.rng } };
  const [x, y] = aim(next.rng, state, side, stats);
  pickNext(next, state, tuning);
  return { bot: next, commands: [{ tick: state.tick, side, handSlot: slot, x, y }] };
}

/** Picks the next slot and how long to wait before playing it. */
function pickNext(bot: RandomBot, state: SimState, { minWaitTicks, maxWaitTicks }: BotTuning): void {
  bot.slot = nextBelow(bot.rng, state.rules.handSize);
  bot.readyTick = state.tick + minWaitTicks + nextBelow(bot.rng, maxWaitTicks - minWaitTicks + 1);
}

/**
 * A troop goes on the center of a random tile of its side's deploy zone where it may go (not on a
 * standing tower). A spell goes on a random
 * standing enemy tower or deployed enemy unit, so it is never wasted on empty grass.
 */
function aim(rng: Rng, state: SimState, side: Side, stats: CardStats): [number, number] {
  if (stats.type === 'troop') {
    const zone = deployZone(state.arena, side);
    const half = MILLI_PER_TILE / 2;
    const spots: [number, number][] = [];
    for (let row = 0; row < Math.floor(zone.height / MILLI_PER_TILE); row++) {
      for (let column = 0; column < Math.floor(zone.width / MILLI_PER_TILE); column++) {
        const [x, y] = [zone.x + column * MILLI_PER_TILE + half, zone.y + row * MILLI_PER_TILE + half];
        if (placementRejection(state, side, stats, x, y) === null) {
          spots.push([x, y]);
        }
      }
    }
    const spot = spots[nextBelow(rng, spots.length)];
    if (spot === undefined) {
      throw new RangeError(`Side ${String(side)} has nowhere to deploy`);
    }
    return spot;
  }
  const targets = [
    ...state.towers.filter((tower) => tower.side !== side && tower.hp > 0),
    ...state.units.filter((unit) => unit.side !== side),
  ];
  const target = targets[nextBelow(rng, targets.length)];
  if (target === undefined) {
    throw new RangeError(`Side ${String(side)} has no enemy left to aim at`);
  }
  return [target.x, target.y];
}
