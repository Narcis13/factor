import type { HeuristicTuning } from '@factor/content';
import {
  BASIS_POINTS,
  MILLI_PER_TILE,
  nextBelow,
  placementRejection,
  seedRng,
  type CardId,
  type CardStats,
  type Command,
  type Rng,
  type Side,
  type SimState,
  type TargetFilter,
  type Unit,
} from '@factor/sim';

/**
 * The Stage 3 opponent (VISION §8): it defends, counter-pushes and manages energy. Every `thinkTicks` it
 * looks at the field: enemies coming into its half are answered with the best counter it can afford (a
 * spell on a cluster worth it, something that can hit flyers, splash for swarms, a building to pull
 * building-hunters); otherwise it finishes a tower a spell can finish, backs up its own units pushing,
 * or, once it has saved up, starts a push in the weaker lane; and it never sits on full energy. It reads
 * cards by their stats, never by name, so it plays any deck. Plain JSON, with its own rng.
 */
export interface HeuristicBot {
  kind: 'heuristic';
  side: Side;
  rng: Rng;
  /** It looks at the field again no earlier than this tick. */
  readyTick: number;
}

/** What a heuristic bot does at one tick: its next state and the commands for that tick. */
export interface HeuristicTurn {
  bot: HeuristicBot;
  commands: Command[];
}

const UINT32 = 0x100000000;
/** Apart from the random bots' streams and the match's (the golden ratio, as in Fibonacci hashing). */
const SEED_STRIDE = 0x9e3779b9;

export function createHeuristicBot(side: Side, seed: number): HeuristicBot {
  return { kind: 'heuristic', side, rng: seedRng((seed + SEED_STRIDE * (side + 3)) % UINT32), readyTick: 0 };
}

/** The bot's commands for `state.tick`: none, or one legal play. Never mutates `bot` or `state`. */
export function heuristicTurn(bot: HeuristicBot, state: SimState, tuning: HeuristicTuning): HeuristicTurn {
  if (state.result !== null || state.tick < bot.readyTick) {
    return { bot, commands: [] };
  }
  const next: HeuristicBot = { ...bot, rng: { ...bot.rng } };
  const play = decide(next, state, tuning);
  if (play === null) {
    next.readyTick = state.tick + tuning.thinkTicks;
    return { bot: next, commands: [] };
  }
  next.readyTick = state.tick + tuning.playGapTicks;
  return { bot: next, commands: [{ tick: state.tick, side: bot.side, ...play }] };
}

/** A play before it has a tick and side. */
interface Play {
  handSlot: number;
  x: number;
  y: number;
}

/** A card in hand the bot could play now. */
interface HandCard {
  slot: number;
  id: CardId;
  stats: CardStats;
}

/** An enemy on the field as the bot weighs it. */
interface Enemy {
  unit: Unit;
  /** What it's worth, in milli-energy: its card's cost per unit, scaled by the hp it has left. */
  value: number;
  air: boolean;
  /** It only goes for buildings. */
  hunter: boolean;
  radius: number;
}

function decide(bot: HeuristicBot, state: SimState, tuning: HeuristicTuning): Play | null {
  const { side } = bot;
  const player = state.players[side];
  const hand: HandCard[] = [];
  player.hand.forEach((id, slot) => {
    const stats = state.cards[id];
    if (stats !== undefined && stats.cost <= player.energy) {
      hand.push({ slot, id, stats });
    }
  });
  const enemies = state.units.filter((unit) => unit.side !== side).flatMap((unit) => describe(state, unit));
  const threats = enemies.filter((enemy) => depthInto(state, side, enemy.unit.y) > 0 - tuning.threatReach);
  const danger = threats.reduce((sum, enemy) => sum + enemy.value, 0);
  const pressing = danger >= tuning.defendValue || threats.some((enemy) => enemy.hunter);
  if (threats.length > 0 && pressing && danger > guard(state, side, threats, tuning)) {
    // Defend if it can; if it can't afford a good answer yet, save up for one.
    return defend(state, side, hand, threats, tuning);
  }
  return (
    finishTower(state, side, hand) ??
    valueSpell(state, side, hand, enemies, tuning) ??
    support(state, side, hand, tuning) ??
    (player.energy >= tuning.pushEnergy ? push(bot, state, hand) : null) ??
    (player.energy >= state.rules.energy.max ? push(bot, state, hand) : null)
  );
}

/**
 * What already stands against `threats`: the value of its own units and buildings within `guardRadius`
 * of any of them that can hit at least one, plus `towerGuard` for each of its standing towers that one
 * of them is in reach of.
 */
function guard(state: SimState, side: Side, threats: Enemy[], tuning: HeuristicTuning): number {
  let total = 0;
  for (const unit of state.units) {
    const card = state.cards[unit.card];
    if (unit.side !== side || card === undefined || card.type === 'spell') {
      continue;
    }
    const attack = card.unit;
    const near = threats.some((enemy) => {
      const [dx, dy] = [enemy.unit.x - unit.x, enemy.unit.y - unit.y];
      const hits = attack.damage > 0 && attack.targets !== 'buildings' && (!enemy.air || attack.targets === 'air');
      return hits && dx * dx + dy * dy <= tuning.guardRadius * tuning.guardRadius;
    });
    if (near) {
      total += describe(state, unit)[0]?.value ?? 0;
    }
  }
  for (const tower of state.towers) {
    if (tower.side !== side || tower.hp <= 0) {
      continue;
    }
    const reach = state.towerStats[tower.kind].range + Math.floor(tower.size / 2);
    if (threats.some((enemy) => Math.abs(enemy.unit.x - tower.x) <= reach && Math.abs(enemy.unit.y - tower.y) <= reach)) {
      total += tuning.towerGuard;
    }
  }
  return total;
}

/** A field unit's weight to the bot; buildings count, but only once they're on its side of the river. */
function describe(state: SimState, unit: Unit): Enemy[] {
  const card = state.cards[unit.card];
  if (card === undefined || card.type === 'spell') {
    return [];
  }
  const [count, air, hunter, radius] =
    card.type === 'troop'
      ? [card.unit.count, card.unit.layer === 'air', card.unit.targets === 'buildings', card.unit.radius]
      : [1, false, false, card.unit.radius];
  const value = Math.floor((card.cost * 1000 * unit.hp) / (unit.maxHp * count));
  return [{ unit, value, air, hunter, radius }];
}

/**
 * How far `y` is into `side`'s half from the river's near bank, in milli-tiles: positive on its own half,
 * negative across the river.
 */
function depthInto(state: SimState, side: Side, y: number): number {
  const { river } = state.arena;
  return side === 0 ? river.y - y : y - (river.y + river.height);
}

/** A y that lies `depth` into `side`'s half from the river's near bank (negative: across it). */
function atDepth(state: SimState, side: Side, depth: number): number {
  const { river } = state.arena;
  return side === 0 ? river.y - depth : river.y + river.height + depth;
}

function defend(state: SimState, side: Side, hand: HandCard[], threats: Enemy[], tuning: HeuristicTuning): Play | null {
  const spell = bestSpell(state, side, hand, threats, tuning);
  if (spell !== null) {
    return spell;
  }
  // The threat nearest its towers leads; the answer is chosen against all of them.
  const lead = threats.reduce((best, enemy) => (depthInto(state, side, enemy.unit.y) > depthInto(state, side, best.unit.y) ? enemy : best));
  const swarm = threats.filter((enemy) => !enemy.air).length >= 3;
  let best: { card: HandCard; score: number } | null = null;
  for (const card of hand) {
    if (card.stats.type === 'spell') {
      continue;
    }
    const attack = card.stats.unit;
    if (attack.targets === 'buildings' || attack.damage === 0) {
      // Hunters don't defend; a spawner does, through what it spawns.
      if (card.stats.type !== 'building' || card.stats.spawn === null) {
        continue;
      }
    }
    const reach: TargetFilter = card.stats.type === 'building' && card.stats.spawn !== null ? 'ground' : attack.targets;
    const answered = threats.filter((enemy) => !enemy.air || reach === 'air').reduce((sum, enemy) => sum + enemy.value, 0);
    if (answered === 0) {
      continue;
    }
    let score = answered;
    if (swarm && (attack.splash > 0 || (card.stats.type === 'troop' && card.stats.unit.count >= 3))) {
      score += tuning.splashBonus;
    }
    if (card.stats.type === 'building' && threats.some((enemy) => enemy.hunter)) {
      score += tuning.pullBonus;
    }
    score -= card.stats.cost * tuning.costWeight;
    if (best === null || score > best.score) {
      best = { card, score };
    }
  }
  if (best === null) {
    return null;
  }
  const { card } = best;
  const width = state.arena.width;
  if (card.stats.type === 'building') {
    // In front of the Keep, leaning toward the threat: building-hunters turn to it on their way in.
    const x = Math.floor((lead.unit.x + Math.floor(width / 2)) / 2);
    return spot(state, side, card.slot, x, atDepth(state, side, tuning.pullDepth));
  }
  const ranged = card.stats.type === 'troop' && card.stats.unit.range >= tuning.rangedRange;
  if (ranged) {
    // Back by its towers in the threat's lane, where the towers help.
    return spot(state, side, card.slot, lead.unit.x, atDepth(state, side, tuning.rangedDepth));
  }
  // Up close: a couple of tiles from the threat on its way in, but on its own half.
  const depth = Math.max(MILLI_PER_TILE, depthInto(state, side, lead.unit.y) + tuning.meetAhead);
  return spot(state, side, card.slot, lead.unit.x, atDepth(state, side, depth));
}

/**
 * The spell in hand that destroys the most value at one point among `targets`' positions, if that is at
 * least `spellValueBp` of what it costs.
 */
function bestSpell(state: SimState, side: Side, hand: HandCard[], targets: Enemy[], tuning: HeuristicTuning): Play | null {
  let best: { play: Play; value: number } | null = null;
  for (const card of hand) {
    if (card.stats.type !== 'spell') {
      continue;
    }
    const { radius, damage } = card.stats.spell;
    for (const aim of targets) {
      let value = 0;
      for (const enemy of targets) {
        const [dx, dy] = [enemy.unit.x - aim.unit.x, enemy.unit.y - aim.unit.y];
        const reach = radius + enemy.radius;
        if (dx * dx + dy * dy <= reach * reach) {
          value += Math.floor((enemy.value * Math.min(damage, enemy.unit.hp)) / enemy.unit.hp);
        }
      }
      const worth = Math.floor((card.stats.cost * 1000 * tuning.spellValueBp) / BASIS_POINTS);
      if (value >= worth && (best === null || value > best.value)) {
        const play = { handSlot: card.slot, x: aim.unit.x, y: aim.unit.y };
        if (legal(state, side, play)) {
          best = { play, value };
        }
      }
    }
  }
  return best?.play ?? null;
}

/** A spell that would bring down an enemy tower, aimed at it. */
function finishTower(state: SimState, side: Side, hand: HandCard[]): Play | null {
  for (const card of hand) {
    if (card.stats.type !== 'spell') {
      continue;
    }
    const towerDamage = Math.floor((card.stats.spell.damage * card.stats.spell.towerDamageBp) / BASIS_POINTS);
    for (const tower of state.towers) {
      if (tower.side !== side && tower.hp > 0 && tower.hp <= towerDamage) {
        return { handSlot: card.slot, x: tower.x, y: tower.y };
      }
    }
  }
  return null;
}

/** A spell on enemies anywhere, if they are worth it. */
function valueSpell(state: SimState, side: Side, hand: HandCard[], enemies: Enemy[], tuning: HeuristicTuning): Play | null {
  return bestSpell(state, side, hand, enemies, tuning);
}

/**
 * Backs up its own units already pushing (past the middle of its half, or across): a troop that isn't
 * a building-hunter, a couple of tiles behind the frontmost of them, if it keeps `reserveEnergy` after.
 */
function support(state: SimState, side: Side, hand: HandCard[], tuning: HeuristicTuning): Play | null {
  const pushing = state.units.filter((unit) => unit.side === side && state.cards[unit.card]?.type === 'troop' && depthInto(state, side, unit.y) < tuning.pushingDepth);
  if (pushing.length === 0) {
    return null;
  }
  const front = pushing.reduce((best, unit) => (depthInto(state, side, unit.y) < depthInto(state, side, best.y) ? unit : best));
  const energy = state.players[side].energy;
  const backers = hand.filter((card) => card.stats.type === 'troop' && card.stats.unit.targets !== 'buildings' && energy - card.stats.cost >= tuning.reserveEnergy);
  const card = backers.find((candidate) => candidate.stats.type === 'troop' && (candidate.stats.unit.range >= tuning.rangedRange || candidate.stats.unit.splash > 0)) ?? backers[0];
  if (card === undefined) {
    return null;
  }
  const depth = depthInto(state, side, front.y) + tuning.supportBehind;
  return spot(state, side, card.slot, front.x, atDepth(state, side, Math.max(MILLI_PER_TILE, depth)));
}

/**
 * Starts a push at the bridge of the lane whose enemy Outpost is weaker (a fallen one first), leading
 * with the toughest troop in hand, building-hunters first.
 */
function push(bot: HeuristicBot, state: SimState, hand: HandCard[]): Play | null {
  const troops = hand.filter((card) => card.stats.type === 'troop');
  if (troops.length === 0) {
    return null;
  }
  const lead = troops.reduce((best, card) => (toughness(card) > toughness(best) ? card : best));
  const outposts = state.towers.filter((tower) => tower.side !== bot.side && tower.kind === 'outpost');
  const [left, right] = [outposts.find((tower) => tower.lane === 'left'), outposts.find((tower) => tower.lane === 'right')];
  const lane = left === undefined || right === undefined ? 'left' : left.hp === right.hp ? (nextBelow(bot.rng, 2) === 0 ? 'left' : 'right') : left.hp < right.hp ? 'left' : 'right';
  const bridge = state.arena.bridges.find((candidate) => candidate.lane === lane);
  const x = bridge === undefined ? Math.floor(state.arena.width / 2) : bridge.x + Math.floor(bridge.width / 2);
  return spot(state, bot.side, lead.slot, x, atDepth(state, bot.side, MILLI_PER_TILE + MILLI_PER_TILE / 2));
}

/** How much a troop can take, building-hunters counted double: what leads a push. */
function toughness(card: HandCard): number {
  if (card.stats.type !== 'troop') {
    return 0;
  }
  const { hp, count, targets } = card.stats.unit;
  return hp * count * (targets === 'buildings' ? 2 : 1);
}

/**
 * The legal spot nearest (x, y) for the card in `slot`: the tile center there, or the first that the
 * sim takes in rings of tiles around it (up to 6 tiles out), each ring in a fixed order: side 1's is
 * side 0's turned through the arena's center, so both sides choose alike (pillar 1).
 */
function spot(state: SimState, side: Side, slot: number, x: number, y: number): Play | null {
  const half = MILLI_PER_TILE / 2;
  const { width, height } = state.arena;
  // Tiles are counted in the side's own frame (side 1's turned through the center), so a point on a tile
  // boundary snaps the same way for both.
  const toWorld = (point: number, size: number) => (side === 0 ? point : size - point);
  const column = Math.floor(toWorld(x, width) / MILLI_PER_TILE);
  const row = Math.floor(toWorld(y, height) / MILLI_PER_TILE);
  for (let ring = 0; ring <= SEARCH_RINGS; ring++) {
    for (let dy = 0 - ring; dy <= ring; dy++) {
      for (let dx = 0 - ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) {
          continue;
        }
        const own = { x: (column + dx) * MILLI_PER_TILE + half, y: (row + dy) * MILLI_PER_TILE + half };
        const play = { handSlot: slot, x: toWorld(own.x, width), y: toWorld(own.y, height) };
        if (legal(state, side, play)) {
          return play;
        }
      }
    }
  }
  return null;
}

const SEARCH_RINGS = 6;

/** Whether the sim would take `play` from `side` now: the card is in hand, affordable, and the spot is a legal one for it. */
function legal(state: SimState, side: Side, play: Play): boolean {
  const player = state.players[side];
  const id = player.hand[play.handSlot];
  const stats = id === undefined ? undefined : state.cards[id];
  return stats !== undefined && stats.cost <= player.energy && placementRejection(state, side, stats, play.x, play.y) === null;
}
