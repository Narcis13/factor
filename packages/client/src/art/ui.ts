// The interface in pixel art: panels, card faces (portrait, frame by card type, cost gem), the energy
// bar's parts, stars, buttons, ribbons and icons. Sizes are in UI pixels; the HUD scales them up whole.
import type { CardId, CardStats, Side } from '@factor/sim';
import { INK, RAMPS, TEAM, grey, mix, shade, type Ramp } from './color.ts';
import { TINY, drawText, textImage, textWidth } from './font.ts';

import { ball, blit, bounds, crop, fill, image, line, outline, oval, poly, px, rect, ring, scatter, type Img } from './image.ts';
import { UNIT_ART } from './units.ts';

/** The energy's color: a deep magenta liquid. */
export const ENERGY: Ramp = [0x2e0c38, 0x5e1468, 0x9a2296, 0xd044c0, 0xf08ae0, 0xffd6f6];
export const SLATE: Ramp = [0x0e0d14, 0x17151f, 0x221f2e, 0x2f2b40, 0x403a56, 0x585075];

/** Integer hash in [0, 1). */
function hash(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export type PanelKind = 'wood' | 'stone' | 'slate';

/** A framed panel: an ink edge, a gold bevel, then its material, with rivets in the corners. */
export function panel(width: number, height: number, kind: PanelKind, options: { trim?: Ramp; rivets?: boolean } = {}): Img {
  const img = image(width, height);
  const trim = options.trim ?? RAMPS.gold;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const edge = Math.min(x, y, width - 1 - x, height - 1 - y);
      // Cut corners, so it reads as a solid object, not a box.
      const corner = (x === 0 || x === width - 1) && (y === 0 || y === height - 1);
      if (corner) {
        continue;
      }
      let color: number;
      if (edge === 0) {
        color = INK;
      } else if (edge === 1) {
        color = x === 1 || y === 1 ? shade(trim, 3) : shade(trim, 1);
      } else if (edge === 2) {
        color = x === 2 || y === 2 ? mix(material(kind, x, y), INK, 0.55) : mix(material(kind, x, y), 0xffffff, 0.08);
      } else {
        color = material(kind, x, y);
      }
      px(img, x, y, color);
    }
  }
  if (options.rivets !== false && width >= 14 && height >= 14) {
    for (const [x, y] of [[4, 4], [width - 6, 4], [4, height - 6], [width - 6, height - 6]] as const) {
      px(img, x, y, shade(trim, 4));
      px(img, x + 1, y, shade(trim, 2));
      px(img, x, y + 1, shade(trim, 2));
      px(img, x + 1, y + 1, shade(trim, 1));
    }
  }
  return img;
}

function material(kind: PanelKind, x: number, y: number): number {
  if (kind === 'wood') {
    const plank = Math.floor(y / 6);
    const row = y % 6;
    const grain = hash(Math.floor((x + plank * 13) / 5), plank, 3);
    const base = row === 0 ? 3 : row === 5 ? 0 : grain > 0.6 ? 2 : 1;
    let color = shade(RAMPS.wood, base);
    if (row !== 0 && row !== 5 && hash(x, y, 4) > 0.93) {
      color = shade(RAMPS.wood, Math.max(0, base - 1));
    }
    // Plank joints, staggered.
    if ((x + plank * 17) % 40 === 0 && row !== 0) {
      color = shade(RAMPS.wood, 0);
    }
    return color;
  }
  if (kind === 'stone') {
    const course = Math.floor(y / 5);
    const mortar = y % 5 === 4 || (x + (course % 2) * 5) % 10 === 9;
    const n = hash(Math.floor((x + (course % 2) * 5) / 10), course, 5);
    return shade(RAMPS.stone, mortar ? 1 : n > 0.66 ? 3 : 2);
  }
  const n = hash(x >> 1, y >> 1, 6);
  return shade(SLATE, n > 0.85 ? 3 : 2);
}

/** A rounded, beveled button in `ramp`'s colors; pressed, it sinks a pixel. */
export function button(width: number, height: number, ramp: Ramp, pressed = false): Img {
  const img = image(width, height);
  const top = pressed ? 2 : 0;
  // Its base, the darker lip under it.
  fill(img, 0, 2, width - 1, height - 1, (x, y) => (roundedIn(x, y - 2, width, height - 2, 2) ? INK : null));
  fill(img, 0, top, width - 1, height - 3 + top, (x, y) => {
    const ly = y - top;
    if (!roundedIn(x, ly, width, height - 2, 2)) {
      return null;
    }
    const edge = !roundedIn(x - 1, ly, width, height - 2, 2) || !roundedIn(x + 1, ly, width, height - 2, 2) || !roundedIn(x, ly - 1, width, height - 2, 2) || !roundedIn(x, ly + 1, width, height - 2, 2);
    if (edge) {
      return INK;
    }
    const t = ly / (height - 2);
    if (ly <= 2) {
      return shade(ramp, ramp.length - 1);
    }
    return shade(ramp, t < 0.5 ? ramp.length - 2 : t < 0.85 ? ramp.length - 3 : ramp.length - 4);
  });
  if (!pressed) {
    fill(img, 1, height - 3, width - 2, height - 2, (x) => (x > 1 && x < width - 2 ? shade(ramp, 1) : null));
  }
  return img;
}

function roundedIn(x: number, y: number, width: number, height: number, r: number): boolean {
  if (x < 0 || y < 0 || x >= width || y >= height) {
    return false;
  }
  const cx = x < r ? r : x > width - 1 - r ? width - 1 - r : x;
  const cy = y < r ? r : y > height - 1 - r ? height - 1 - r : y;
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.5;
}

/** The energy drop: the cost badge on a card and the energy bar's icon. */
export function energyGem(width: number, height: number): Img {
  const img = image(width, height);
  const cx = (width - 1) / 2;
  const r = width / 2 - 0.5;
  const cy = height - r - 1;
  fill(img, 0, 0, width - 1, height - 1, (x, y) => {
    const dx = x - 0.5 - cx;
    const dy = y - 0.5 - cy;
    const inBall = dx * dx + dy * dy <= r * r;
    // The point above the ball narrows to the top.
    const t = (y - 0.5) / Math.max(1, cy);
    const inPoint = y - 0.5 < cy && Math.abs(dx) <= r * t * 1.05;
    if (!inBall && !inPoint) {
      return null;
    }
    const lit = -dx / r * 0.5 - dy / height * 1.2;
    return shade(ENERGY, lit > 0.5 ? 5 : lit > 0.15 ? 4 : lit > -0.2 ? 3 : 2);
  });
  px(img, Math.round(cx - r * 0.4), Math.round(cy - r * 0.35), 0xffffff);
  outline(img, { strength: 0.9 });
  return img;
}

/** A five-pointed star `size` pixels across: earned, the side's color with a gold rim; else a dark slot. */
export function starIcon(size: number, side: Side, earned: boolean): Img {
  const img = image(size + 2, size + 2);
  const c = (size + 2) / 2;
  const outer = size / 2;
  const inner = outer * 0.48;
  const points: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? outer : inner;
    points.push([c + Math.cos(a) * r, c + 0.6 + Math.sin(a) * r]);
  }
  const team = TEAM[side];
  if (earned) {
    poly(img, points, (x, y) => {
      const t = (y - (c - outer)) / (outer * 2);
      const lit = t - (x - c) / (outer * 3);
      return shade(team, lit < 0.3 ? 5 : lit < 0.55 ? 4 : lit < 0.8 ? 3 : 2);
    });
    // A gold rim.
    const ringed = image(img.width, img.height);
    blit(ringed, img, 0, 0);
    outline(img, { ink: shade(RAMPS.gold, 3), strength: 1 });
    outline(img);
    px(img, c - outer * 0.2, c - outer * 0.25, 0xffffff);
  } else {
    poly(img, points, (x, y) => (y < c ? shade(SLATE, 1) : shade(SLATE, 0)));
    outline(img, { ink: shade(team, 2), strength: 1 });
    outline(img);
  }
  return img;
}

/** A ribbon banner `width` wide, its ends folded back: the end screen's title. */
export function ribbon(width: number, height: number, ramp: Ramp): Img {
  const img = image(width, height + 3);
  const tail = Math.max(6, Math.round(height * 0.6));
  // The folded tails behind, darker.
  for (const [x0, dir] of [[0, 1], [width - tail - 4, -1]] as const) {
    poly(img, [[x0, 3], [x0 + tail + 4, 3], [x0 + tail + 4, height + 3], [x0, height + 3], [x0 + (dir > 0 ? tail * 0.5 : tail * 0.5 + 4), height / 2 + 3]], shade(ramp, 1));
  }
  // The front band.
  fill(img, tail, 0, width - tail - 1, height - 1, (x, y) => {
    const t = y / height;
    return shade(ramp, t < 0.2 ? 4 : t < 0.6 ? 3 : t < 0.85 ? 2 : 1);
  });
  line(img, tail, 1, width - tail - 1, 1, mix(shade(ramp, 4), 0xffffff, 0.4), 1);
  // The fold shadows where the band meets the tails.
  line(img, tail, height, tail + 3, height + 2, INK, 1);
  line(img, width - tail - 1, height, width - tail - 4, height + 2, INK, 1);
  outline(img);
  return img;
}

export type IconName = 'again' | 'deck' | 'save' | 'swords' | 'clock' | 'crown';

/** A small icon, `size` pixels square, light on dark. */
export function icon(name: IconName, size = 11): Img {
  const img = image(size, size);
  const c = (size - 1) / 2;
  const light = 0xffffff;
  const gold = shade(RAMPS.gold, 3);
  switch (name) {
    case 'again': {
      ring(img, c + 0.5, c + 0.5, size / 2 - 0.5, size / 2 - 0.5, 2, light);
      // A gap in the top right, and an arrowhead at it.
      for (let y = 0; y < c; y++) {
        for (let x = Math.ceil(c) + 1; x < size; x++) {
          img.data[(y * size + x) * 4 + 3] = 0;
        }
      }
      poly(img, [[c, -0.5], [c + 4, 2.5], [c, 5.5]], light);
      break;
    }
    case 'deck': {
      rect(img, 1, 3, size - 4, size - 4, shade(RAMPS.steel, 2));
      rect(img, 3, 1, size - 4, size - 4, light);
      rect(img, 5, 3, size - 8, size - 8, shade(RAMPS.gold, 3));
      break;
    }
    case 'save': {
      rect(img, Math.round(c) - 1, 0, 3, size - 5, light);
      poly(img, [[c - 4, size - 6], [c + 5, size - 6], [c + 0.5, size - 1.5]], light);
      rect(img, 0, size - 2, size, 2, gold);
      break;
    }
    case 'swords': {
      // Two swords crossed, points up: blade, crossguard, grip and pommel each.
      const s = size - 1;
      for (const flip of [false, true]) {
        const x = (v: number): number => (flip ? s - v : v);
        line(img, x(s * 0.1), s * 0.1, x(s * 0.62), s * 0.62, flip ? shade(RAMPS.steel, 3) : light, 1);
        line(img, x(s * 0.18), s * 0.1, x(s * 0.66), s * 0.58, shade(RAMPS.steel, 2), 1);
        line(img, x(s * 0.48), s * 0.8, x(s * 0.8), s * 0.48, gold, 1);
        line(img, x(s * 0.7), s * 0.7, x(s * 0.86), s * 0.86, shade(RAMPS.leather, 3), 1);
        px(img, x(s * 0.94), s * 0.94, gold);
      }
      break;
    }
    case 'clock': {
      oval(img, c + 0.5, c + 0.5, size / 2, size / 2, light);
      oval(img, c + 0.5, c + 0.5, size / 2 - 1.5, size / 2 - 1.5, shade(SLATE, 3));
      line(img, c, c, c, 2, light, 1);
      line(img, c, c, c + 2.5, c + 1.5, gold, 1);
      break;
    }
    case 'crown': {
      poly(img, [[0, 2], [3, 5], [c + 0.5, 0], [size - 4, 5], [size - 1, 2], [size - 2, size - 2], [1, size - 2]], gold);
      rect(img, 1, size - 3, size - 2, 2, shade(RAMPS.gold, 2));
      px(img, c, 5, shade(TEAM[1], 3));
      break;
    }
  }
  outline(img, { strength: 0.95 });
  return img;
}

// --- Card faces.

/** What kind of frame a card gets. */
function frameRamp(stats: CardStats): Ramp {
  return stats.type === 'spell' ? RAMPS.purple : stats.type === 'building' ? RAMPS.bronze : RAMPS.steel;
}

/** A card's art cut to fit `width` × `height`: the unit standing on its patch of grass, or the spell's emblem. */
export function portrait(card: CardId, stats: CardStats, width: number, height: number): Img {
  const img = image(width, height);
  if (stats.type === 'spell') {
    // A dusky arcane backdrop with motes.
    fill(img, 0, 0, width - 1, height - 1, (x, y) => {
      const d = Math.hypot((x - width / 2) / width, (y - height / 2) / height);
      return shade(RAMPS.purple, d < 0.2 ? 2 : d < 0.42 ? 1 : 0);
    });
    const rand = scatter(card.length * 7);
    for (let i = 0; i < 8; i++) {
      px(img, rand() * width, rand() * height, shade(RAMPS.magic, 4), 0.8);
    }
    blit(img, spellEmblem(card, Math.min(width, height) - 4), Math.round((width - (Math.min(width, height) - 4)) / 2), Math.round((height - (Math.min(width, height) - 4)) / 2));
    return img;
  }
  // Sky over a grassy rise.
  const horizon = Math.round(height * 0.62);
  fill(img, 0, 0, width - 1, height - 1, (x, y) => {
    if (y < horizon + Math.round(Math.sin(x / 5) * 1.2)) {
      const t = y / horizon;
      return t < 0.4 ? 0x7cc4f0 : t < 0.75 ? 0x9fd6f4 : 0xc6e8f6;
    }
    const n = hash(x, y, 8);
    return shade(RAMPS.grass, y < horizon + 3 ? 4 : n > 0.9 ? 4 : 3);
  });
  // Far hills.
  for (let x = 0; x < width; x++) {
    const hill = horizon - 3 - Math.round(Math.abs(Math.sin(x / 7 + card.length)) * 3);
    for (let y = hill; y < horizon; y++) {
      px(img, x, y, mix(shade(RAMPS.leaf, 3), 0x9fd6f4, 0.45));
    }
  }
  const art = UNIT_ART[card];
  if (art === undefined) {
    return img;
  }
  const frame = art(0).idle.down[0];
  if (frame === undefined) {
    return img;
  }
  const box = bounds(frame.img);
  if (box === null) {
    return img;
  }
  const figure = crop(frame.img, box.x, box.y, box.width, box.height);
  // Feet a few pixels above the bottom (a flyer hovers two above its shadow); a figure too tall shows
  // from its top down.
  const feet = Math.min(frame.ay - box.y, figure.height + 2);
  const x = Math.round((width - figure.width) / 2);
  const y = Math.max(1, height - 3 - feet);
  // A card that sends several shows a little crowd: two behind, one in front.
  if (stats.unit.count > 1) {
    const spread = Math.min(Math.round(figure.width * 0.7), Math.floor((width - figure.width) / 2) + 2);
    for (const dx of [-spread, spread]) {
      oval(img, width / 2 + dx, height - 6, figure.width / 2, 1.5, INK, 0.25);
      blit(img, figure, x + dx, y - 3);
    }
  }
  oval(img, width / 2, height - 3, Math.min(width / 2 - 2, figure.width / 2 + 1), 2, INK, 0.3);
  blit(img, figure, x, y);
  return img;
}

/** A spell's emblem: a fireball, a meteor, a bolt. */
export function spellEmblem(card: CardId, size: number): Img {
  const img = image(size, size);
  const c = size / 2;
  if (card === 'spark') {
    oval(img, c, c, size * 0.42, size * 0.42, shade(RAMPS.bolt, 1), 0.45);
    const zig: [number, number][] = [
      [c + size * 0.12, 1],
      [c - size * 0.22, c + 1],
      [c - 0.5, c + 1],
      [c - size * 0.14, size - 2],
      [c + size * 0.26, c - 2],
      [c + 0.5, c - 2],
    ];
    poly(img, zig, (x, y) => (x + y < size * 0.9 ? 0xffffff : shade(RAMPS.bolt, 3)));
  } else if (card === 'meteor') {
    for (let i = 5; i >= 0; i--) {
      oval(img, c + 2 + i * 2.2, c - 2 - i * 2.2, size * 0.2 - i * 0.6, size * 0.2 - i * 0.6, shade(RAMPS.fire, 5 - Math.floor(i * 0.9)), 0.9);
    }
    ball(img, c - 1, c + 1, size * 0.26, size * 0.26, RAMPS.stone, -0.1);
    ball(img, c - 2, c + 2, size * 0.13, size * 0.13, RAMPS.ember, 0.4);
  } else {
    // Flare: a swirling ball of flame.
    fill(img, 0, 0, size - 1, size - 1, (x, y) => {
      const dx = (x - c) / (size * 0.42);
      const dy = (y - c - 1) / (size * 0.42);
      const a = Math.atan2(dy, dx);
      const d = Math.hypot(dx, dy) - Math.sin(a * 5) * 0.08 + (dy < 0 ? dy * 0.25 : 0);
      if (d > 1) {
        return null;
      }
      return shade(RAMPS.fire, d < 0.3 ? 5 : d < 0.55 ? 4 : d < 0.8 ? 3 : 2);
    });
  }
  outline(img, { strength: 0.8 });
  return img;
}

/** A card as the hand shows it: frame (steel troop, bronze building, purple spell), portrait, cost gem. */
export function cardFace(card: CardId, stats: CardStats, width: number, height: number, options: { cost?: boolean } = {}): Img {
  const img = image(width, height);
  const ramp = frameRamp(stats);
  // The frame.
  fill(img, 0, 0, width - 1, height - 1, (x, y) => {
    const corner = (x === 0 || x === width - 1) && (y === 0 || y === height - 1);
    if (corner) {
      return null;
    }
    const edge = Math.min(x, y, width - 1 - x, height - 1 - y);
    if (edge === 0) {
      return INK;
    }
    return edge === 1 ? shade(ramp, x === 1 || y === 1 ? 4 : 2) : shade(ramp, x === 2 || y === 2 ? 3 : 1);
  });
  const art = portrait(card, stats, width - 6, height - 6);
  blit(img, art, 3, 3);
  // An inner shadow along the window's top and left.
  line(img, 3, 3, width - 4, 3, INK, 1, 0.35);
  line(img, 3, 4, 3, height - 4, INK, 1, 0.35);
  if (options.cost !== false) {
    drawCost(img, stats.cost, 0, 0);
  }
  return img;
}

/** The cost badge, its top-left at (x, y). */
export function drawCost(img: Img, cost: number, x: number, y: number): void {
  const gem = energyGem(11, 13);
  blit(img, gem, x, y);
  const text = String(cost);
  drawText(img, text, x + Math.round((11 - textWidth(text, TINY)) / 2), y + 5, { font: TINY, color: 0xffffff, outline: INK });
}

/** The card dimmed and greyed: not enough energy for it yet. */
export function greyed(img: Img): Img {
  const out = image(img.width, img.height);
  out.data.set(img.data);
  for (let i = 0; i < out.data.length; i += 4) {
    const r = out.data[i] ?? 0;
    const g = out.data[i + 1] ?? 0;
    const b = out.data[i + 2] ?? 0;
    const color = mix(grey((r << 16) | (g << 8) | b), SLATE[1] ?? INK, 0.35);
    out.data[i] = (color >> 16) & 0xff;
    out.data[i + 1] = (color >> 8) & 0xff;
    out.data[i + 2] = color & 0xff;
  }
  return out;
}

/** The selected card's glowing gold border, `width` × `height` with a pixel to spare all round. */
export function selectionGlow(width: number, height: number, phase: number): Img {
  const img = image(width + 4, height + 4);
  const glow = phase % 2 === 0 ? shade(RAMPS.gold, 4) : 0xffffff;
  for (let y = 0; y < height + 4; y++) {
    for (let x = 0; x < width + 4; x++) {
      const edge = Math.min(x, y, width + 3 - x, height + 3 - y);
      if (edge === 0) {
        px(img, x, y, shade(RAMPS.gold, 2), 0.7);
      } else if (edge === 1 || edge === 2) {
        px(img, x, y, edge === 1 ? shade(RAMPS.gold, 3) : glow);
      }
    }
  }
  return img;
}

/** The energy bar's empty track: a slate trough with a gold rim, notched at every whole energy. */
export function energyTrack(width: number, height: number): Img {
  const img = image(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const corner = (x === 0 || x === width - 1) && (y === 0 || y === height - 1);
      if (corner) {
        continue;
      }
      const edge = Math.min(x, y, width - 1 - x, height - 1 - y);
      // An ink rim, a gold lip on top, and a dark trough with its upper edge in shadow.
      px(img, x, y, edge === 0 ? (y === 0 ? shade(RAMPS.gold, 2) : INK) : y === 1 ? shade(SLATE, 0) : shade(SLATE, 1));
    }
  }
  return img;
}

/** How far in from the track's edge the liquid starts. */
export const TRACK_INSET = 1;

/** One column of the energy liquid, `height` tall: stretched across to fill the bar. */
export function energyColumn(height: number, ramp: Ramp = ENERGY): Img {
  const img = image(1, height);
  for (let y = 0; y < height; y++) {
    const t = y / Math.max(1, height - 1);
    px(img, 0, y, shade(ramp, t < 0.2 ? 5 : t < 0.45 ? 4 : t < 0.8 ? 3 : 2));
  }
  return img;
}

/** A glint that runs along the energy liquid. */
export function energyGlint(height: number): Img {
  const img = image(3, height);
  for (let y = 0; y < height; y++) {
    px(img, 1, y, 0xffffff, 0.55);
    px(img, 0, y, 0xffffff, 0.2);
    px(img, 2, y, 0xffffff, 0.2);
  }
  return img;
}


// --- The HUD's and end screen's pieces.

/** The wooden band behind the hand, with a gold-trimmed top edge. */
export function bandImage(width: number, height: number): Img {
  return panel(width, height, 'wood', { rivets: false });
}

/** The opponent's plate: a slate tag, its edge in their red, a crown and their name. */
export function nameplate(name: string): Img {
  const label = textImage(name, { font: TINY, color: [0xffc29a, 0xffd8bc, 0xffffff], outline: null });
  const img = panel(label.width + 18, 11, 'slate', { trim: TEAM[1], rivets: false });
  blit(img, icon('crown', 9), 3, 1);
  blit(img, label, 13, 3);
  return img;
}

/** The timer's slate pill, wide enough for a clock icon and `clockWidth` of time. */
export function timerPanel(clockWidth: number): Img {
  const img = panel(clockWidth + 15, 13, 'slate', { rivets: false });
  blit(img, icon('clock', 9), 2, 2);
  return img;
}

/** A card's cost: the energy gem with the number on it. */
export function costBadge(cost: number): Img {
  const img = image(12, 14);
  drawCost(img, cost, 0, 0);
  return img;
}

/** A slate tag with a card's name, over the selected card. */
export function nameTag(card: CardId): Img {
  const text = card.toUpperCase();
  const img = panel(textWidth(text, TINY) + 8, 11, 'slate', { rivets: false });
  blit(img, textImage(text, { font: TINY, color: [0xd6962a, 0xf5cf4c, 0xfff4a6], outline: null }), 4, 3);
  return img;
}

/** A thin dark line marking one whole energy. */
export function notchImage(height: number): Img {
  const img = image(1, height);
  for (let y = 0; y < height; y++) {
    img.data.set([0x22, 0x10, 0x26, 255], y * 4);
  }
  return img;
}

/** "×2" in gold on a small slate badge: energy is coming twice as fast. */
export function doubleBadge(): Img {
  const text = textImage('×2', { color: [0xd6962a, 0xf5cf4c, 0xfff4a6], outline: null });
  const img = panel(text.width + 6, text.height + 5, 'slate', { trim: ENERGY, rivets: false });
  blit(img, text, 3, 3);
  return img;
}

/** One ink pixel, stretched to dim the screen. */
export function dot(): Img {
  const img = image(1, 1);
  img.data.set([0x0b, 0x08, 0x12, 255]);
  return img;
}

/** A button with its icon above its label. */
export function labeledButton(width: number, height: number, ramp: readonly number[], name: IconName, label: string): Img {
  const img = button(width, height, ramp);
  // The face is the button less its two-pixel lip. A tall face stacks the icon over the label; a
  // short one sets them side by side, or the label alone if the icon won't fit.
  const face = height - 2;
  const text = textImage(label, { font: TINY, color: 0xffffff, outline: INK });
  if (face >= 18) {
    const mark = icon(name, 9);
    const top = Math.max(0, Math.floor((face - (mark.height + text.height - 1)) / 2));
    blit(img, text, Math.round((width - text.width) / 2), top + mark.height - 1);
    blit(img, mark, Math.round((width - mark.width) / 2), top);
    return img;
  }
  const mark = icon(name, 7);
  const both = mark.width + text.width - 1;
  const textTop = Math.floor((face - text.height) / 2) + 1;
  if (both <= width - 4) {
    const left = Math.round((width - both) / 2);
    blit(img, mark, left, Math.floor((face - mark.height) / 2) + 1);
    blit(img, text, left + mark.width - 1, textTop);
  } else {
    blit(img, text, Math.round((width - text.width) / 2), textTop);
  }
  return img;
}
