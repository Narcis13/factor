import { CARD_IDS, CARDS } from '@factor/content';
import { expect, test } from 'vitest';
import { pack } from '../src/art/atlas.ts';
import { FX_FRAMES, key, SHOT_KINDS, SIDES, TOWER_KINDS, worldArt } from '../src/art/catalog.ts';
import { ANIMS, FACINGS, FRAME_COUNT } from '../src/art/frame.ts';
import { bounds, drawnCount, type Img } from '../src/art/image.ts';
import { SHOT_DIRECTIONS } from '../src/art/fx.ts';

const ART = worldArt(CARDS);

function frame(name: string) {
  const found = ART.frames.get(name);
  if (found === undefined) {
    throw new Error(`missing frame ${name}`);
  }
  return found;
}

/** Two images' pixels are the same. */
function same(a: Uint8ClampedArray, b: Uint8ClampedArray): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

/** No drawn pixel on the image's edge: nothing was cut off by its frame. */
function clearOfEdges(img: Img): boolean {
  const box = bounds(img);
  return box !== null && box.x > 0 && box.y > 0 && box.x + box.width < img.width && box.y + box.height < img.height;
}

test('every card on the field has every animation, from every side and facing, for both sides', () => {
  for (const card of CARD_IDS) {
    if (CARDS[card].type === 'spell') {
      continue;
    }
    for (const side of SIDES) {
      for (const anim of ANIMS) {
        for (const facing of FACINGS) {
          for (let i = 0; i < FRAME_COUNT[anim]; i++) {
            const { img } = frame(key.unit(card, side, anim, facing, i));
            expect(drawnCount(img), `${card} ${String(side)} ${anim} ${facing} ${String(i)}`).toBeGreaterThan(40);
            expect(clearOfEdges(img), `${card} ${anim} ${facing} ${String(i)} is cut off by its frame`).toBe(true);
          }
        }
      }
    }
    expect(ART.heights[card]).toBeGreaterThan(0);
  }
});

test('the two sides are told apart by color in every frame', () => {
  for (const card of CARD_IDS) {
    if (CARDS[card].type === 'spell') {
      continue;
    }
    for (const anim of ANIMS) {
      for (const facing of FACINGS) {
        const blue = frame(key.unit(card, 0, anim, facing, 0)).img.data;
        const red = frame(key.unit(card, 1, anim, facing, 0)).img.data;
        expect(same(blue, red), `${card} ${anim} ${facing}`).toBe(false);
      }
    }
  }
});

test('frames move: each animation’s frames differ from one another', () => {
  for (const card of CARD_IDS) {
    if (CARDS[card].type === 'spell') {
      continue;
    }
    // Buildings stand: only their attack moves.
    for (const anim of CARDS[card].type === 'building' ? (['attack'] as const) : (['walk', 'attack'] as const)) {
      const frames = Array.from({ length: FRAME_COUNT[anim] }, (_, i) => frame(key.unit(card, 0, anim, 'down', i)).img.data);
      expect(frames.some((data) => !same(data, frames[0] ?? data)), `${card} ${anim}`).toBe(true);
    }
  }
});

test('every spell and splash has its animation, sized to its radius', () => {
  for (const card of CARD_IDS) {
    const stats = CARDS[card];
    if (stats.type === 'spell') {
      const names = [...ART.frames.keys()].filter((name) => name.startsWith('fx:') && name.endsWith(':0'));
      expect(names.some((name) => name.includes(`:${String(Math.round((stats.spell.radius * 16) / 1000))}:`)), card).toBe(true);
    } else if (stats.unit.splash > 0) {
      const r = Math.round((stats.unit.splash * 16) / 1000);
      expect([...ART.frames.keys()].some((name) => name === `fx:boom:${String(r)}:0` || name === `fx:shock:${String(r)}:0`), card).toBe(true);
    }
  }
});

test('towers have a body, cracks, rubble, a weapon that turns and fires, and a waving flag', () => {
  for (const kind of TOWER_KINDS) {
    for (const side of SIDES) {
      for (const part of ['body', 'cracked', 'rubble', 'flag:0', 'flag:3', ...FACINGS.map((facing) => `turret:${facing}`), ...FACINGS.map((facing) => `fire:${facing}:2`)]) {
        expect(drawnCount(frame(key.tower(kind, side, part)).img), `${kind} ${part}`).toBeGreaterThan(10);
      }
    }
    expect(ART.towers[kind].top).toBeGreaterThan(40);
  }
  // Only the Keep sleeps.
  expect(ART.frames.has(key.tower('keep', 0, 'asleep'))).toBe(true);
  expect(ART.frames.has(key.tower('outpost', 0, 'asleep'))).toBe(false);
});

test('shots come in every direction, and effects have all their frames', () => {
  for (const kind of SHOT_KINDS) {
    expect(ART.frames.has(key.shot(kind, 1, 0)), kind).toBe(true);
  }
  for (let i = 0; i < SHOT_DIRECTIONS; i++) {
    expect(ART.frames.has(key.shot('bolt', 0, i))).toBe(true);
  }
  for (const [name, count] of [['hit', FX_FRAMES.hit], ['muzzle', FX_FRAMES.muzzle], ['zzz', FX_FRAMES.zzz], ['meteorFall', FX_FRAMES.meteorFall]] as const) {
    for (let i = 0; i < count; i++) {
      expect(ART.frames.has(key.fx(name, i)), `${name} ${String(i)}`).toBe(true);
    }
  }
});

test('the art is the same every time it is drawn', () => {
  const again = worldArt(CARDS);
  for (const [name, { img, ax, ay }] of ART.frames) {
    const other = again.frames.get(name);
    expect(other?.ax).toBe(ax);
    expect(other?.ay).toBe(ay);
    expect(same(other?.img.data ?? new Uint8ClampedArray(), img.data), name).toBe(true);
  }
});

test('the atlas holds every frame, apart, inside its pages, anchors kept', () => {
  const atlas = pack(ART.frames);
  expect(atlas.placements.size).toBe(ART.frames.size);
  // Every page pixel belongs to at most one frame.
  const taken = atlas.pages.map((page) => new Uint8Array(page.width * page.height));
  for (const placement of atlas.placements.values()) {
    const page = atlas.pages[placement.page];
    const cells = taken[placement.page];
    expect(page).toBeDefined();
    expect(placement.x + placement.width).toBeLessThanOrEqual(page?.width ?? 0);
    expect(placement.y + placement.height).toBeLessThanOrEqual(page?.height ?? 0);
    let clash = false;
    for (let y = placement.y; y < placement.y + placement.height; y++) {
      for (let x = placement.x; x < placement.x + placement.width; x++) {
        const i = y * (page?.width ?? 0) + x;
        clash ||= cells?.[i] === 1;
        if (cells !== undefined) {
          cells[i] = 1;
        }
      }
    }
    expect(clash).toBe(false);
  }
  // A trimmed frame keeps its anchor on the same drawn pixel.
  const warden = atlas.placements.get(key.unit('warden', 0, 'idle', 'down', 0));
  const original = frame(key.unit('warden', 0, 'idle', 'down', 0));
  const box = bounds(original.img);
  expect(warden).toMatchObject({ ax: original.ax - (box?.x ?? 0), ay: original.ay - (box?.y ?? 0), width: box?.width, height: box?.height });
});
