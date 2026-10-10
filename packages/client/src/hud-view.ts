import { TICKS_PER_SECOND, type CardId, type Side, type SimState } from '@factor/sim';
import type { ScreenRect } from './arena-view.ts';
import type { HudLayout, ScreenPoint } from './screen-layout.ts';

/** A card in the hand as the player sees it. */
export interface CardFace {
  slot: number;
  card: CardId;
  cost: number;
  rect: ScreenRect;
  /** Enough energy to play it now. */
  affordable: boolean;
  /** How far the energy has come toward its cost, in [0, 1]: 1 once affordable. */
  progress: number;
  selected: boolean;
}

/** A star slot: drawn in its side's color once earned, hollow until then. */
export interface StarPip {
  side: Side;
  x: number;
  y: number;
  radius: number;
  earned: boolean;
}

/** Everything the HUD shows for one side, placed on the screen. */
export interface HudScene {
  /** Time left: `m:ss` in regulation, `OT m:ss` in overtime. */
  clock: string;
  /** The last ten seconds of a period: the clock turns red. */
  urgent: boolean;
  /** Energy comes twice as fast (the final minute, and overtime). */
  double: boolean;
  /** Top-right corner of the clock text. */
  clockAt: { x: number; y: number };
  /** The band above the arena: the opponent's plate sits at its left. */
  top: ScreenRect;
  /** Whole energy. */
  energy: number;
  /** The most energy a side can hold: the bar's notch count. */
  energyMax: number;
  /** How full the bar is, in [0, 1], including the regeneration toward the next energy. */
  energyFill: number;
  energyBar: ScreenRect;
  hand: CardFace[];
  next: { card: CardId; rect: ScreenRect } | null;
  /** Both sides' stars, side 0's first: they matter to both players. */
  stars: StarPip[];
}

/**
 * The HUD for `side`, from the two states the display sits between (`alpha` of the way from
 * `previous` to `current`). Only the energy bar is interpolated; everything else shows `current`.
 */
export function hudScene(
  previous: SimState,
  current: SimState,
  alpha: number,
  layout: HudLayout,
  side: Side,
  selected: number | null,
): HudScene {
  const player = current.players[side];
  const { max } = current.rules.energy;
  const level = lerp(energyLevel(previous, side), energyLevel(current, side), alpha);
  const fill = level / max;
  const hand = player.hand.map((card, slot): CardFace => {
    const cost = cardCost(current, card);
    const rect = layout.slots[slot];
    if (rect === undefined) {
      throw new RangeError(`The layout has no rect for hand slot ${String(slot)}`);
    }
    const affordable = player.energy >= cost;
    return { slot, card, cost, rect, affordable, progress: affordable ? 1 : Math.min(1, level / Math.max(1, cost)), selected: slot === selected };
  });
  const next = player.queue[0];
  return {
    clock: formatClock(current),
    urgent: current.result === null && secondsLeft(current) <= 10,
    double: current.result === null && current.tick >= current.rules.energy.doubleFromTick,
    clockAt: layout.timer,
    top: layout.top,
    energy: player.energy,
    energyMax: max,
    energyFill: Math.min(1, Math.max(0, fill)),
    energyBar: layout.energyBar,
    hand,
    next: next === undefined ? null : { card: next, rect: layout.next },
    stars: [...starPips(current, 0, layout.stars[0], layout.starRadius), ...starPips(current, 1, layout.stars[1], layout.starRadius)],
  };
}

/** `side`'s star slots at `points`, the first `stars[side]` of them earned. */
export function starPips(state: Pick<SimState, 'stars'>, side: Side, points: readonly ScreenPoint[], radius: number): StarPip[] {
  return points.map((point, i) => ({ side, x: point.x, y: point.y, radius, earned: i < state.stars[side] }));
}

/** Energy as a real number: whole energy plus the progress toward the next one. */
export function energyLevel(state: SimState, side: Side): number {
  const { energy, energyProgress } = state.players[side];
  return energy + energyProgress / state.rules.energy.ticksPerEnergy;
}

/**
 * Time left in the current period, rounded up to whole seconds, so `0:00` only shows at its end.
 * A match decided when regulation runs out stays at `0:00`: overtime starts only if stars are tied.
 */
export function formatClock(state: Pick<SimState, 'tick' | 'rules' | 'result'>): string {
  const overtime = inOvertime(state);
  const seconds = secondsLeft(state);
  const clock = `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`;
  return overtime ? `OT ${clock}` : clock;
}

function inOvertime(state: Pick<SimState, 'tick' | 'rules' | 'result'>): boolean {
  const { regulationTicks } = state.rules;
  return state.tick > regulationTicks || (state.tick === regulationTicks && state.result === null);
}

/** Whole seconds left in the current period, rounded up. */
function secondsLeft(state: Pick<SimState, 'tick' | 'rules' | 'result'>): number {
  const { regulationTicks, overtimeTicks } = state.rules;
  const end = inOvertime(state) ? regulationTicks + overtimeTicks : regulationTicks;
  return Math.ceil(Math.max(0, end - state.tick) / TICKS_PER_SECOND);
}

function cardCost(state: SimState, card: CardId): number {
  const stats = Object.hasOwn(state.cards, card) ? state.cards[card] : undefined;
  if (stats === undefined) {
    throw new RangeError(`Unknown card: ${card}`);
  }
  return stats.cost;
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}
