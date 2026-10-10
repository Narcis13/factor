// The ground: a checker of mown grass with tufts and flowers, dirt paths from each Keep to its Outposts and
// on to the bridges, banks along the river, the river's animated water, the wooden bridges, and a wooded
// surround for whatever of the screen the arena doesn't cover. Drawn at `PPT` pixels a tile.
import { MILLI_PER_TILE, type Terrain } from '@factor/sim';
import { INK, RAMPS, mix, shade } from './color.ts';
import { ball, capsule, fill, image, oval, px, rect, scatter, type Img } from './image.ts';

/** Art pixels per tile (VISION §5's arena is 18 × 32 tiles: 288 × 512 pixels). */
export const PPT = 16;

/** How many frames the water's loop has, and how many ticks each shows. */
export const WATER_FRAMES = 8;
export const WATER_TICKS = 3;

/** Integer hash of a pixel and a salt, in [0, 1). */
function hash(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Arena milli-tiles to art pixels, y down (side 0 at the bottom). */
function toArt(terrain: Terrain, x: number, y: number): [number, number] {
  return [(x * PPT) / MILLI_PER_TILE, ((terrain.height - y) * PPT) / MILLI_PER_TILE];
}

interface Segment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  width: number;
}

/** The paths, in art pixels: each Keep to its Outposts, and each Outpost down its lane to the river. */
function paths(terrain: Terrain, towers: readonly { kind: string; side: number; x: number; y: number }[]): Segment[] {
  const segments: Segment[] = [];
  const riverEdge = (side: number): number => (side === 0 ? terrain.river.y : terrain.river.y + terrain.river.height);
  for (const keep of towers.filter((tower) => tower.kind === 'keep')) {
    const [kx, ky] = toArt(terrain, keep.x, keep.y);
    for (const outpost of towers.filter((tower) => tower.kind === 'outpost' && tower.side === keep.side)) {
      const [ox, oy] = toArt(terrain, outpost.x, outpost.y);
      segments.push({ x0: kx, y0: ky, x1: ox, y1: oy, width: PPT * 1.1 });
      const [, ry] = toArt(terrain, outpost.x, riverEdge(outpost.side));
      segments.push({ x0: ox, y0: oy, x1: ox, y1: ry, width: PPT * 1.25 });
    }
  }
  return segments;
}

function distanceToSegment(x: number, y: number, s: Segment): number {
  const dx = s.x1 - s.x0;
  const dy = s.y1 - s.y0;
  const t = Math.max(0, Math.min(1, ((x - s.x0) * dx + (y - s.y0) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - (s.x0 + dx * t), y - (s.y0 + dy * t));
}

/** The arena's ground, without the water and bridges. */
export function groundImage(terrain: Terrain, towers: readonly { kind: string; side: number; x: number; y: number }[]): Img {
  const width = (terrain.width * PPT) / MILLI_PER_TILE;
  const height = (terrain.height * PPT) / MILLI_PER_TILE;
  const img = image(width, height);
  const segments = paths(terrain, towers);
  const grass = RAMPS.grass;
  const dirt = RAMPS.dirt;
  const [, riverTop] = toArt(terrain, 0, terrain.river.y + terrain.river.height);
  const [, riverBottom] = toArt(terrain, 0, terrain.river.y);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const col = Math.floor(x / PPT);
      const row = Math.floor(y / PPT);
      const light = (col + row) % 2 === 0;
      // Mown stripes: a checker of two greens, barely apart.
      let color = light ? mix(shade(grass, 3), shade(grass, 4), 0.3) : shade(grass, 3);
      const n = hash(x, y);
      if (n < 0.06) {
        color = mix(color, shade(grass, 2), 0.6);
      } else if (n > 0.95) {
        color = mix(color, shade(grass, 4), 0.7);
      }
      // A path, with a ragged edge.
      const wobble = (hash(Math.floor(x / 3), Math.floor(y / 3), 7) - 0.5) * 3;
      let near = Infinity;
      let width0 = 0;
      for (const segment of segments) {
        const d = distanceToSegment(x + 0.5, y + 0.5, segment);
        if (d - segment.width / 2 < near - width0 / 2) {
          near = d;
          width0 = segment.width;
        }
      }
      const edge = near - width0 / 2 + wobble;
      if (edge < 0) {
        const pebble = hash(x, y, 3);
        color = edge > -1.5 ? shade(dirt, 2) : pebble < 0.05 ? shade(dirt, 4) : pebble > 0.93 ? shade(dirt, 1) : mix(shade(dirt, 3), shade(dirt, 2), hash(x >> 1, y >> 1, 5) * 0.4);
      } else if (edge < 1.5) {
        // Grass shadow where the turf meets the path.
        color = mix(color, shade(grass, 1), 0.45);
      }
      // The river's banks: darker earth, then the turf's lip.
      if (y >= riverTop - 3 && y < riverTop) {
        color = y === riverTop - 1 ? shade(dirt, 1) : mix(shade(dirt, 2), color, hash(x, y, 9) * 0.5);
      }
      if (y >= riverBottom && y < riverBottom + 3) {
        color = y === riverBottom ? shade(dirt, 3) : mix(shade(dirt, 2), color, 0.3 + hash(x, y, 9) * 0.5);
      }
      px(img, x, y, color);
    }
  }
  // Tufts, flowers and stones on the grass, away from the paths and banks.
  const rand = scatter(1234);
  for (let i = 0; i < (width * height) / 180; i++) {
    const x = Math.floor(rand() * width);
    const y = Math.floor(rand() * height);
    const kind = rand();
    if (y > riverTop - 6 && y < riverBottom + 6) {
      continue;
    }
    const onPath = segments.some((segment) => distanceToSegment(x, y, segment) < segment.width / 2 + 2);
    if (onPath) {
      if (kind < 0.15) {
        px(img, x, y, shade(dirt, 4));
        px(img, x + 1, y, shade(dirt, 1));
      }
      continue;
    }
    if (kind < 0.55) {
      // A tuft: two or three blades.
      px(img, x, y, shade(grass, 5));
      px(img, x - 1, y + 1, shade(grass, 4));
      px(img, x + 1, y + 1, shade(grass, 4));
      px(img, x, y + 1, shade(grass, 2));
    } else if (kind < 0.7) {
      const petal = [0xfff4f0, 0xffd84a, 0xf28aa0, 0xb8d8ff][Math.floor(rand() * 4)] ?? 0xffffff;
      px(img, x, y, petal);
      px(img, x + 1, y, mix(petal, INK, 0.3));
      px(img, x, y + 1, shade(grass, 2));
    } else if (kind < 0.78) {
      ball(img, x, y, 1.6, 1.1, RAMPS.stone, 0.1);
    }
  }
  return img;
}

/** One frame of the river's water, the river's whole width and height. */
export function waterImage(terrain: Terrain, frame: number): Img {
  const width = (terrain.width * PPT) / MILLI_PER_TILE;
  const height = (terrain.river.height * PPT) / MILLI_PER_TILE;
  const img = image(width, height);
  const water = RAMPS.water;
  const period = 32;
  const shift = (frame * period) / WATER_FRAMES;
  for (let y = 0; y < height; y++) {
    const depth = 1 - Math.abs(y - height / 2) / (height / 2);
    for (let x = 0; x < width; x++) {
      let index = depth > 0.55 ? 2 : 3;
      // Ripple bands drifting with the current, and glints on their crests.
      const u = (x + shift + Math.sin((y + x * 0.15) * 0.7) * 3) % period;
      const wave = Math.sin(((u + y * 2.3) / period) * Math.PI * 2 + y * 0.9);
      if (wave > 0.86 && hash(Math.floor((x + shift) / 2), y, 11) > 0.3) {
        index += 1;
      }
      if (wave > 0.97) {
        index = 5;
      }
      let color = shade(water, index);
      // The near bank shades the water under it; foam lips the far bank.
      if (y < 3) {
        color = mix(color, shade(water, 0), y === 0 ? 0.65 : y === 1 ? 0.45 : 0.25);
      }
      if (y >= height - 2) {
        const foam = hash(Math.floor((x + shift * 0.5) / 2), y, 13) > 0.45;
        color = foam ? shade(water, y === height - 1 ? 6 : 5) : color;
      }
      px(img, x, y, color);
    }
  }
  return img;
}

/** A wooden bridge across the river: planks across, rails along both sides, piles in the water. */
export function bridgeImage(widthPx: number, lengthPx: number): { img: Img; ox: number; oy: number } {
  const over = 4;
  const img = image(widthPx + 6, lengthPx + over * 2 + 4);
  const ox = 3;
  const oy = over;
  // Shadow on the water, cast down and to the right.
  rect(img, ox + 3, oy + 3, widthPx, lengthPx, INK, 0.35);
  // Piles.
  for (const x of [ox + 1, ox + widthPx - 3]) {
    for (const y of [oy + 6, oy + lengthPx - 8]) {
      rect(img, x, y, 3, 6, shade(RAMPS.wood, 1));
    }
  }
  // The deck: planks running across.
  const deckLeft = ox + 2;
  const deckRight = ox + widthPx - 2;
  for (let y = -over; y < lengthPx + over; y++) {
    const plank = Math.floor((y + over) / 4);
    const seam = (y + over) % 4 === 3;
    for (let x = deckLeft; x < deckRight; x++) {
      const grain = hash(x >> 2, plank, 21);
      let color = shade(RAMPS.wood, seam ? 1 : (y + over) % 4 === 0 ? 4 : grain > 0.5 ? 3 : 2);
      if (!seam && hash(x, y, 23) > 0.94) {
        color = shade(RAMPS.wood, 2);
      }
      // Nails at the plank ends.
      if (!seam && (y + over) % 4 === 1 && (x === deckLeft + 1 || x === deckRight - 2)) {
        color = shade(RAMPS.iron, 3);
      }
      px(img, x, oy + y, color);
    }
  }
  // Rails and posts.
  for (const x of [ox, ox + widthPx - 2]) {
    rect(img, x, oy - over, 2, lengthPx + over * 2, shade(RAMPS.wood, x === ox ? 4 : 2));
    for (let y = -over; y <= lengthPx + over - 3; y += 8) {
      rect(img, x - 1, oy + y, 4, 3, shade(RAMPS.wood, 3));
      px(img, x - 1, oy + y, shade(RAMPS.wood, 4));
    }
  }
  return { img, ox, oy };
}

/**
 * The world beyond the arena, `width` × `height` art pixels with the arena's top-left at (left, top):
 * a stone wall hugging the arena's edge, then darker turf under trees.
 */
export function surroundImage(width: number, height: number, left: number, top: number, arenaWidth: number, arenaHeight: number): Img {
  const img = image(width, height);
  const outside = (x: number, y: number): boolean => x < left || y < top || x >= left + arenaWidth || y >= top + arenaHeight;
  fill(img, 0, 0, width - 1, height - 1, (x, y) => {
    if (!outside(Math.floor(x), Math.floor(y))) {
      return null;
    }
    const n = hash(Math.floor(x), Math.floor(y), 31);
    return mix(shade(RAMPS.leaf, 1), shade(RAMPS.leaf, 2), n > 0.8 ? 0.6 : n < 0.1 ? 0 : 0.25);
  });
  // A low wall round the arena.
  const wall = 5;
  for (let y = top - wall; y < top + arenaHeight + wall; y++) {
    for (let x = left - wall; x < left + arenaWidth + wall; x++) {
      if (!outside(x, y)) {
        continue;
      }
      const course = Math.floor((y - top) / 3);
      const mortar = (y - top + 30) % 3 === 0 || (x - left + (course % 2) * 2 + 40) % 5 === 0;
      const lit = y < top || x < left ? 3 : 2;
      px(img, x, y, shade(RAMPS.stone, mortar ? lit - 1 : lit));
    }
  }
  // Trees: round canopies, darkest first, scattered outside the wall.
  const rand = scatter(77);
  const trees: [number, number, number][] = [];
  for (let i = 0; i < (width * height) / 260; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const r = 5 + rand() * 6;
    const clear = x + r < left - wall - 1 || x - r > left + arenaWidth + wall + 1 || y + r < top - wall - 1 || y - r > top + arenaHeight + wall + 1;
    if (clear) {
      trees.push([x, y, r]);
    }
  }
  trees.sort((a, b) => a[1] - b[1]);
  for (const [x, y, r] of trees) {
    oval(img, x + 2, y + r * 0.6, r, r * 0.5, INK, 0.35);
    capsule(img, x, y + r * 0.3, x, y + r * 0.8, 1.2, RAMPS.wood);
    ball(img, x, y, r, r * 0.9, RAMPS.leaf, 0.12);
    ball(img, x - r * 0.3, y - r * 0.35, r * 0.45, r * 0.4, RAMPS.leaf, 0.35);
  }
  return img;
}
