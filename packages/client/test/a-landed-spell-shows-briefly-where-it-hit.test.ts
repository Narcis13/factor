import { ARENA, CARDS, matchSetup } from '@factor/content';
import { createMatch } from '@factor/sim';
import { expect, test } from 'vitest';
import { blastScene, fitView } from '../src/index.ts';
import { advance, BLAST_TICKS, createLoop, queuePlay, stepTo, TICK_MS } from '../src/match-loop.ts';

// 540 × 960 fits the arena at 30 px per tile, so 1 tile = 30 px and the arena's top edge is y = 0.
const VIEW = fitView(ARENA, 540, 960);

/** A loop at tick 200 (full energy) whose side 0 has a flare in hand. */
function loopWithFlare() {
  for (let seed = 0; ; seed++) {
    const state = stepTo(createMatch(matchSetup(seed)), 200);
    const slot = state.players[0].hand.indexOf('flare');
    if (slot >= 0) {
      return { loop: createLoop(state), slot };
    }
  }
}

test('a flare lands where it was aimed, as a circle of its radius kept for the screen until its time is up', () => {
  const { loop, slot } = loopWithFlare();
  queuePlay(loop, 0, slot, 4000, 20_000);
  advance(loop, TICK_MS);
  expect(loop.current.rejected).toEqual([]);
  const landed = loop.current.tick;
  expect(loop.blasts).toEqual([{ side: 0, card: 'flare', x: 4000, y: 20_000, tick: landed }]);
  const radius = (CARDS.flare.spell.radius * 30) / 1000;
  expect(blastScene(loop.blasts, loop.current, 0, BLAST_TICKS, VIEW)).toEqual([
    { side: 0, card: 'flare', x: 4 * 30, y: (32 - 20) * 30, radius, fade: 1 },
  ]);
  expect(blastScene(loop.blasts, loop.current, 0.5, BLAST_TICKS, VIEW)[0]?.fade).toBeCloseTo(1 - 0.5 / BLAST_TICKS);
  // Still there one tick before its time is up, gone at it, and dropped from the loop after.
  for (let tick = 1; tick < BLAST_TICKS; tick++) {
    advance(loop, TICK_MS);
  }
  expect(blastScene(loop.blasts, loop.current, 0, BLAST_TICKS, VIEW)[0]?.fade).toBeCloseTo(1 / BLAST_TICKS);
  expect(blastScene(loop.blasts, loop.current, 1, BLAST_TICKS, VIEW)).toEqual([]);
  advance(loop, TICK_MS);
  expect(loop.blasts).toEqual([]);
});
