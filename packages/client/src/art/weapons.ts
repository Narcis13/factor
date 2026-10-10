// Held things: blades, hafts, slings, shields, and the pale smear a fast swing leaves.
import { RAMPS, mix, shade, type Ramp } from './color.ts';
import { capsule, fill, line, litIndex, poly, px, type Img } from './image.ts';

export type WeaponKind = 'sword' | 'greatsword' | 'axe' | 'greataxe' | 'maul' | 'pitchfork' | 'club' | 'sling' | 'bomb' | 'none';

/** A shaded ellipse turned by `angle` (radians, screen space): an axe head, a maul's block, a wing. */
export function tiltedBall(img: Img, cx: number, cy: number, rx: number, ry: number, angle: number, ramp: Ramp, bias = 0): void {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const r = Math.max(rx, ry);
  fill(img, cx - r, cy - r, cx + r, cy + r, (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const lx = (dx * c + dy * s) / rx;
    const ly = (-dx * s + dy * c) / ry;
    const d = lx * lx + ly * ly;
    if (d > 1) {
      return null;
    }
    // Back to screen space for the light.
    const nx = lx * c - ly * s;
    const ny = lx * s + ly * c;
    return shade(ramp, litIndex(ramp, nx, ny, Math.sqrt(1 - d), bias));
  });
}

/**
 * A weapon held at (hx, hy) pointing along `angle` (radians: 0 right, π/2 down). `size` scales it: 1 for
 * a man-sized unit.
 */
export function drawWeapon(img: Img, kind: WeaponKind, hx: number, hy: number, angle: number, size = 1): void {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const at = (d: number): [number, number] => [hx + dx * d * size, hy + dy * d * size];
  const across = (x: number, y: number, d: number): [number, number, number, number] => [x - dy * d * size, y + dx * d * size, x + dy * d * size, y - dx * d * size];
  switch (kind) {
    case 'sword': {
      const [gx, gy] = at(-1.6);
      capsule(img, gx, gy, hx, hy, 0.6, RAMPS.leather);
      const [tx, ty] = at(9.5);
      const [bx, by] = at(1.4);
      capsule(img, bx, by, tx, ty, 0.85 * size, RAMPS.steel, 0.3);
      const [x0, y0, x1, y1] = across(...at(1), 2);
      line(img, x0, y0, x1, y1, shade(RAMPS.gold, 2), 1);
      px(img, gx, gy, shade(RAMPS.gold, 3));
      return;
    }
    case 'greatsword': {
      const [gx, gy] = at(-2.5);
      capsule(img, gx, gy, hx, hy, 0.7, RAMPS.leather);
      const [bx, by] = at(1.8);
      const [tx, ty] = at(12.5);
      capsule(img, bx, by, tx, ty, 1.3 * size, RAMPS.steel, 0.2);
      // A fuller down the blade's middle.
      const [fx, fy] = at(3);
      const [ex, ey] = at(10);
      line(img, fx, fy, ex, ey, shade(RAMPS.steel, 1), 1, 0.55);
      const [x0, y0, x1, y1] = across(...at(1.3), 3);
      capsule(img, x0, y0, x1, y1, 0.75, RAMPS.gold);
      return;
    }
    case 'axe':
    case 'greataxe': {
      const big = kind === 'greataxe';
      const length = big ? 11 : 8.5;
      const [bx, by] = at(-2);
      const [tx, ty] = at(length);
      capsule(img, bx, by, tx, ty, big ? 0.8 : 0.65, RAMPS.wood);
      // The blade: a crescent off one side of the haft's end.
      const [cx, cy] = at(length - (big ? 2.2 : 1.6));
      const side = big ? 3.4 : 2.6;
      const ox = -dy * side * size;
      const oy = dx * side * size;
      tiltedBall(img, cx + ox, cy + oy, (big ? 2.4 : 1.9) * size, (big ? 4.2 : 3.2) * size, angle, RAMPS.steel, 0.1);
      // Its edge catches the light.
      const [ex0, ey0] = [cx + ox * 1.55 - dx * 2.6 * size, cy + oy * 1.55 - dy * 2.6 * size];
      const [ex1, ey1] = [cx + ox * 1.55 + dx * 2.6 * size, cy + oy * 1.55 + dy * 2.6 * size];
      line(img, ex0, ey0, ex1, ey1, shade(RAMPS.steel, 4), 1, 0.9);
      if (big) {
        // A back spike.
        line(img, cx, cy, cx - ox * 0.7, cy - oy * 0.7, shade(RAMPS.iron, 2), 2);
      }
      return;
    }
    case 'maul': {
      const [bx, by] = at(-2.5);
      const [tx, ty] = at(9.5);
      capsule(img, bx, by, tx, ty, 0.85, RAMPS.wood);
      // A heavy block of iron across the haft's end, banded in bronze, its face lit toward the light.
      const [mx, my] = at(10.5);
      const half = 2.4 * size;
      const long = 4.6 * size;
      const corners: [number, number][] = [
        [mx - dx * half - dy * long, my - dy * half + dx * long],
        [mx + dx * half - dy * long, my + dy * half + dx * long],
        [mx + dx * half + dy * long, my + dy * half - dx * long],
        [mx - dx * half + dy * long, my - dy * half - dx * long],
      ];
      poly(img, corners, (x, y) => {
        const across0 = (x - mx) * -dy + (y - my) * dx;
        const along0 = (x - mx) * dx + (y - my) * dy;
        const lit = -0.5 * (x - mx) - 0.7 * (y - my);
        if (Math.abs(across0) > long - 1.2) {
          return shade(RAMPS.bronze, lit > 0 ? 3 : 2);
        }
        return shade(RAMPS.iron, Math.abs(along0) > half - 1 ? 1 : lit > 1 ? 4 : lit > -1 ? 3 : 2);
      });
      return;
    }
    case 'pitchfork': {
      const [bx, by] = at(-4);
      const [tx, ty] = at(9);
      capsule(img, bx, by, tx, ty, 0.55, RAMPS.wood);
      const [x0, y0, x1, y1] = across(tx, ty, 2);
      line(img, x0, y0, x1, y1, shade(RAMPS.iron, 2), 1);
      for (const offset of [-2, 0, 2]) {
        const sx = tx - dy * offset * size;
        const sy = ty + dx * offset * size;
        line(img, sx, sy, sx + dx * 3 * size, sy + dy * 3 * size, shade(RAMPS.iron, offset === 0 ? 3 : 2), 1);
      }
      return;
    }
    case 'club': {
      const [bx, by] = at(-1);
      const [mx, my] = at(4);
      const [tx, ty] = at(6.5);
      capsule(img, bx, by, mx, my, 0.8, RAMPS.wood);
      capsule(img, mx, my, tx, ty, 1.5 * size, RAMPS.wood, 0.1);
      return;
    }
    case 'sling': {
      const [tx, ty] = at(4.5);
      line(img, hx, hy, tx, ty, shade(RAMPS.rope, 2), 1);
      capsule(img, tx, ty, tx, ty, 1.3, RAMPS.stone, 0.2);
      return;
    }
    case 'bomb':
      drawBomb(img, hx + dx * 1.5, hy + dy * 1.5 - 1, 2.6 * size, 0);
      return;
    case 'none':
      return;
  }
}

/** A round black bomb with a lit fuse; `spark` picks the fuse's flicker frame. */
export function drawBomb(img: Img, cx: number, cy: number, r: number, spark: number): void {
  capsule(img, cx, cy, cx, cy, r, RAMPS.iron, 0.05);
  px(img, cx - r * 0.45, cy - r * 0.45, shade(RAMPS.steel, 4));
  // The cap and fuse.
  px(img, cx + r * 0.3, cy - r - 0.2, shade(RAMPS.bronze, 3));
  px(img, cx + r * 0.6, cy - r - 1.2, shade(RAMPS.rope, 2));
  const flicker = spark % 2 === 0;
  px(img, cx + r * 0.9, cy - r - 2.1, shade(RAMPS.fire, flicker ? 5 : 4));
  px(img, cx + r * 0.9 + (flicker ? 1 : -1), cy - r - 2.6, shade(RAMPS.fire, 3), 0.8);
}

/** A heater shield held at (cx, cy) as seen from `view`, in its side's colors. */
export function drawShield(img: Img, cx: number, cy: number, view: 'front' | 'back', team: Ramp, size = 1, narrow = 1): void {
  const w = 3.2 * size * narrow;
  const h = 4.2 * size;
  const inShield = (x: number, y: number): boolean => {
    const top = cy - h;
    if (y < top || y > cy + h) {
      return false;
    }
    // Straight sides down to the middle, then curving to a point.
    const t = (y - cy) / h;
    const half = t <= 0 ? w : w * Math.sqrt(Math.max(0, 1 - t * t * 1.1));
    return Math.abs(x - cx) <= half;
  };
  const ramp = view === 'front' ? team : RAMPS.wood;
  fill(img, cx - w - 1, cy - h - 1, cx + w + 1, cy + h + 1, (x, y) => {
    if (!inShield(x, y)) {
      return null;
    }
    const rim = !inShield(x - 1.1, y) || !inShield(x + 1.1, y) || !inShield(x, y - 1.1) || !inShield(x, y + 1.1);
    if (rim) {
      return shade(view === 'front' ? RAMPS.gold : RAMPS.iron, x < cx ? 3 : 2);
    }
    const nx = (x - cx) / w;
    const ny = (y - cy) / (h * 1.6);
    return shade(ramp, litIndex(ramp, nx * 0.9, ny, 0.8, 0.05));
  });
  if (view === 'front') {
    // A chevron emblem.
    const color = shade(RAMPS.gold, 3);
    line(img, cx - w * 0.55, cy - 0.4 * size, cx, cy + 1.3 * size, color, 1);
    line(img, cx, cy + 1.3 * size, cx + w * 0.55, cy - 0.4 * size, color, 1);
  } else {
    line(img, cx - w + 1, cy - 1, cx + w - 1, cy - 1, shade(RAMPS.leather, 1), 1);
  }
}

/**
 * The smear a swing leaves: an arc round (cx, cy) at `radius`, from angle `from` to `to`, thick and pale
 * at its leading end and thinning behind.
 */
export function drawSmear(img: Img, cx: number, cy: number, radius: number, from: number, to: number, tint: number, width = 2): void {
  const steps = Math.max(8, Math.ceil(Math.abs(to - from) * radius * 1.5));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = from + (to - from) * t;
    const thick = 0.4 + width * t;
    for (let r = radius - thick; r <= radius + 0.5; r += 0.5) {
      const color = mix(tint, 0xffffff, r > radius - 0.8 ? 0.85 : 0.35);
      px(img, cx + Math.cos(a) * r, cy + Math.sin(a) * r, color, 0.35 + 0.6 * t);
    }
  }
}
