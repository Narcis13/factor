import { ARENA } from '@factor/content';
import { expect, test } from 'vitest';
import { arenaScene, fitView, type ScreenRect, type Shape } from '../src/index.ts';

// The screen as side 0's player sees it: side 1 (lowercase) at the top, side 0 (uppercase) at the bottom.
// K/k: Keep. O/o: Outpost. ~: river. =: bridge.
const SCREEN = `
..................
.......kkkk.......
.......kkkk.......
.......kkkk.......
.......kkkk.......
..ooo........ooo..
..ooo........ooo..
..ooo........ooo..
..................
..................
..................
..................
..................
..................
..................
~~===~~~~~~~~===~~
~~===~~~~~~~~===~~
..................
..................
..................
..................
..................
..................
..................
..OOO........OOO..
..OOO........OOO..
..OOO........OOO..
.......KKKK.......
.......KKKK.......
.......KKKK.......
.......KKKK.......
..................
`.trim();

function contains(rect: ScreenRect, x: number, y: number): boolean {
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
}

function mark(shape: Shape): string {
  switch (shape.kind) {
    case 'tile-light':
    case 'tile-dark':
      return '.';
    case 'river':
      return '~';
    case 'bridge':
      return '=';
    case 'keep':
    case 'outpost': {
      const letter = shape.kind === 'keep' ? 'K' : 'O';
      return shape.side === 0 ? letter : letter.toLowerCase();
    }
  }
}

/** One character per on-screen tile, top row first: whatever is drawn last at the tile's center. */
function rasterize(width: number, height: number): string {
  const view = fitView(ARENA, width, height);
  const shapes = arenaScene(ARENA, view);
  const rows: string[] = [];
  for (let row = 0; row < 32; row++) {
    let line = '';
    for (let col = 0; col < 18; col++) {
      const x = view.left + (col + 0.5) * view.tilePx;
      const y = view.top + (row + 0.5) * view.tilePx;
      const top = shapes.findLast((shape) => contains(shape.rect, x, y));
      line += top === undefined ? ' ' : mark(top);
    }
    rows.push(line);
  }
  return rows.join('\n');
}

test('the arena fills a 9:16 screen at a whole number of pixels per tile', () => {
  expect(fitView(ARENA, 540, 960)).toEqual({ tilePx: 30, left: 0, top: 0, arenaHeight: ARENA.height });
});

test('on any other shape of screen the arena is centered, never cropped', () => {
  // 600 / 18 = 33.3 and 1000 / 32 = 31.25 px per tile: height limits it to 31.
  expect(fitView(ARENA, 600, 1000)).toMatchObject({ tilePx: 31, left: 21, top: 4 });
  // A landscape desktop window: 1080 / 32 = 33.75.
  expect(fitView(ARENA, 1920, 1080)).toMatchObject({ tilePx: 33, left: 663, top: 12 });
});

test('the screen shows side 1 at the top and side 0 at the bottom, towers over the ground', () => {
  expect(rasterize(540, 960)).toBe(SCREEN);
  expect(rasterize(600, 1000)).toBe(SCREEN);
});

test('every shape stays inside the arena on screen', () => {
  const view = fitView(ARENA, 600, 1000);
  const arena = { x: view.left, y: view.top, width: 18 * view.tilePx, height: 32 * view.tilePx };
  for (const { rect } of arenaScene(ARENA, view)) {
    expect(rect.x).toBeGreaterThanOrEqual(arena.x);
    expect(rect.y).toBeGreaterThanOrEqual(arena.y);
    expect(rect.x + rect.width).toBeLessThanOrEqual(arena.x + arena.width);
    expect(rect.y + rect.height).toBeLessThanOrEqual(arena.y + arena.height);
  }
});

test('the ground is a checkerboard of whole tiles', () => {
  const view = fitView(ARENA, 540, 960);
  const tiles = arenaScene(ARENA, view).filter((shape) => shape.kind === 'tile-light' || shape.kind === 'tile-dark');
  expect(tiles).toHaveLength(18 * 32);
  for (const { kind, rect } of tiles) {
    expect(rect.width).toBe(30);
    expect(rect.height).toBe(30);
    const parity = (rect.x / 30 + rect.y / 30) % 2;
    // Arena tile (0, 0) is dark, and it sits at the bottom-left of the screen: column 0, row 31.
    expect(kind).toBe(parity === 1 ? 'tile-dark' : 'tile-light');
  }
});
