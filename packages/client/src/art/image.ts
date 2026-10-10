// A pixel image and the primitives the art is drawn with. Pure: no DOM, so the art can be generated and
// tested anywhere. Pixels are RGBA bytes, ready to become ImageData.
import { blue, green, INK, mix, red, rgb, shade, type Ramp } from './color.ts';

export interface Img {
  width: number;
  height: number;
  /** RGBA, row by row from the top-left. */
  data: Uint8ClampedArray;
}

export function image(width: number, height: number): Img {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

export function copy(img: Img): Img {
  return { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
}

export function inside(img: Img, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < img.width && y < img.height;
}

/** The pixel's alpha, 0 off the image. */
export function alphaAt(img: Img, x: number, y: number): number {
  return inside(img, x, y) ? (img.data[(y * img.width + x) * 4 + 3] ?? 0) : 0;
}

export function colorAt(img: Img, x: number, y: number): number {
  if (!inside(img, x, y)) {
    return 0;
  }
  const i = (y * img.width + x) * 4;
  return rgb(img.data[i] ?? 0, img.data[i + 1] ?? 0, img.data[i + 2] ?? 0);
}

/** Paints one pixel. With `alpha` below 1 it blends over what is there. */
export function px(img: Img, x: number, y: number, color: number, alpha = 1): void {
  x = Math.floor(x);
  y = Math.floor(y);
  if (!inside(img, x, y) || alpha <= 0) {
    return;
  }
  const i = (y * img.width + x) * 4;
  const d = img.data;
  if (alpha >= 1) {
    d[i] = red(color);
    d[i + 1] = green(color);
    d[i + 2] = blue(color);
    d[i + 3] = 255;
    return;
  }
  const below = (d[i + 3] ?? 0) / 255;
  const out = alpha + below * (1 - alpha);
  const keep = (below * (1 - alpha)) / out;
  d[i] = red(color) * (1 - keep) + (d[i] ?? 0) * keep;
  d[i + 1] = green(color) * (1 - keep) + (d[i + 1] ?? 0) * keep;
  d[i + 2] = blue(color) * (1 - keep) + (d[i + 2] ?? 0) * keep;
  d[i + 3] = out * 255;
}

/** Clears one pixel. */
export function erase(img: Img, x: number, y: number): void {
  if (inside(img, x, y)) {
    img.data[(y * img.width + x) * 4 + 3] = 0;
  }
}

/** Paints only over pixels already drawn (keeps the silhouette). */
export function paintOver(img: Img, x: number, y: number, color: number, alpha = 1): void {
  if (alphaAt(img, Math.floor(x), Math.floor(y)) > 0) {
    px(img, x, y, color, alpha);
  }
}

export function rect(img: Img, x: number, y: number, width: number, height: number, color: number, alpha = 1): void {
  for (let row = Math.round(y); row < Math.round(y + height); row++) {
    for (let col = Math.round(x); col < Math.round(x + width); col++) {
      px(img, col, row, color, alpha);
    }
  }
}

/** Every pixel whose center passes `test`, painted the color `paint` gives it (or skipped for `null`). */
export function fill(img: Img, x0: number, y0: number, x1: number, y1: number, paint: (x: number, y: number) => number | null, alpha = 1): void {
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      const color = paint(x + 0.5, y + 0.5);
      if (color !== null) {
        px(img, x, y, color, alpha);
      }
    }
  }
}

/** A flat ellipse. */
export function oval(img: Img, cx: number, cy: number, rx: number, ry: number, color: number, alpha = 1): void {
  fill(img, cx - rx, cy - ry, cx + rx, cy + ry, (x, y) => (sq((x - cx) / rx) + sq((y - cy) / ry) <= 1 ? color : null), alpha);
}

/** An ellipse's edge, `width` pixels thick. */
export function ring(img: Img, cx: number, cy: number, rx: number, ry: number, width: number, color: number, alpha = 1): void {
  const irx = Math.max(0.01, rx - width);
  const iry = Math.max(0.01, ry - width);
  fill(
    img,
    cx - rx,
    cy - ry,
    cx + rx,
    cy + ry,
    (x, y) => (sq((x - cx) / rx) + sq((y - cy) / ry) <= 1 && sq((x - cx) / irx) + sq((y - cy) / iry) > 1 ? color : null),
    alpha,
  );
}

/** The direction light comes from: up, left and toward the viewer. */
const LIGHT = normalize(-0.5, -0.68, 0.55);

/**
 * How lit a surface with normal (nx, ny, nz) is, as a ramp index: mostly the middle, a highlight up
 * and to the left, shadow down and to the right.
 */
export function litIndex(ramp: Ramp, nx: number, ny: number, nz: number, bias = 0): number {
  const n = normalize(nx, ny, nz);
  const light = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2] + bias;
  const top = ramp.length - 1;
  // Thresholds keep the highlight a small spot and the core shadow a band, like hand-shaded pixels.
  const t = light < -0.3 ? 0 : light < 0.12 ? 0.25 : light < 0.55 ? 0.5 : light < 0.86 ? 0.75 : 1;
  return Math.round(t * top);
}

/** A shaded ellipsoid: a head, a belly, a boulder. */
export function ball(img: Img, cx: number, cy: number, rx: number, ry: number, ramp: Ramp, bias = 0): void {
  fill(img, cx - rx, cy - ry, cx + rx, cy + ry, (x, y) => {
    const nx = (x - cx) / rx;
    const ny = (y - cy) / ry;
    const d = nx * nx + ny * ny;
    return d > 1 ? null : shade(ramp, litIndex(ramp, nx, ny, Math.sqrt(1 - d), bias));
  });
}

/** A shaded rod with round ends from (x0, y0) to (x1, y1): limbs, handles, torsos. */
export function capsule(img: Img, x0: number, y0: number, x1: number, y1: number, radius: number, ramp: Ramp, bias = 0): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const length2 = dx * dx + dy * dy || 1;
  fill(img, Math.min(x0, x1) - radius, Math.min(y0, y1) - radius, Math.max(x0, x1) + radius, Math.max(y0, y1) + radius, (x, y) => {
    const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / length2));
    const vx = (x - (x0 + dx * t)) / radius;
    const vy = (y - (y0 + dy * t)) / radius;
    const d = vx * vx + vy * vy;
    return d > 1 ? null : shade(ramp, litIndex(ramp, vx, vy, Math.sqrt(1 - d), bias));
  });
}

/** A flat rod from (x0, y0) to (x1, y1), `width` pixels thick. */
export function line(img: Img, x0: number, y0: number, x1: number, y1: number, color: number, width = 1, alpha = 1): void {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  const seen = new Set<number>();
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps;
    const y = y0 + ((y1 - y0) * i) / steps;
    const half = (width - 1) / 2;
    for (let oy = -Math.floor(half); oy <= Math.ceil(half); oy++) {
      for (let ox = -Math.floor(half); ox <= Math.ceil(half); ox++) {
        const key = (Math.floor(y + oy) + 4096) * 8192 + Math.floor(x + ox) + 4096;
        if (!seen.has(key)) {
          seen.add(key);
          px(img, x + ox, y + oy, color, alpha);
        }
      }
    }
  }
}

/** A filled polygon (even-odd), its points in pixel coordinates. */
export function poly(img: Img, points: readonly (readonly [number, number])[], color: number | ((x: number, y: number) => number | null), alpha = 1): void {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  fill(
    img,
    Math.min(...xs),
    Math.min(...ys),
    Math.max(...xs),
    Math.max(...ys),
    (x, y) => {
      let inPoly = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i] ?? [0, 0];
        const [xj, yj] = points[j] ?? [0, 0];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
          inPoly = !inPoly;
        }
      }
      if (!inPoly) {
        return null;
      }
      return typeof color === 'number' ? color : color(x, y);
    },
    alpha,
  );
}

/**
 * An outline round everything drawn: each empty pixel touching a drawn one (side by side, or also
 * corner to corner with `corners`) takes that neighbor's color darkened most of the way to ink.
 */
export function outline(img: Img, options: { ink?: number; strength?: number; corners?: boolean } = {}): void {
  const ink = options.ink ?? INK;
  const strength = options.strength ?? 0.82;
  const near = options.corners === true ? NEIGHBORS_8 : NEIGHBORS_4;
  const marks: [number, number, number][] = [];
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (alphaAt(img, x, y) > 0) {
        continue;
      }
      for (const [ox, oy] of near) {
        if (alphaAt(img, x + ox, y + oy) > 128) {
          marks.push([x, y, mix(colorAt(img, x + ox, y + oy), ink, strength)]);
          break;
        }
      }
    }
  }
  for (const [x, y, color] of marks) {
    px(img, x, y, color);
  }
}

/** Darkens the drawn pixels that border empty ones inside the image's lower right: a soft rim shadow. */
export function innerShadow(img: Img, amount = 0.35): void {
  const marks: [number, number, number][] = [];
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (alphaAt(img, x, y) > 128 && (alphaAt(img, x + 1, y) === 0 || alphaAt(img, x, y + 1) === 0)) {
        marks.push([x, y, mix(colorAt(img, x, y), INK, amount)]);
      }
    }
  }
  for (const [x, y, color] of marks) {
    px(img, x, y, color);
  }
}

/** Draws `src` onto `dst` with its top-left at (x, y), blending by alpha. */
export function blit(dst: Img, src: Img, x: number, y: number, options: { flip?: boolean; alpha?: number } = {}): void {
  const alpha = options.alpha ?? 1;
  for (let sy = 0; sy < src.height; sy++) {
    for (let sx = 0; sx < src.width; sx++) {
      const a = alphaAt(src, sx, sy);
      if (a > 0) {
        const fromX = options.flip === true ? src.width - 1 - sx : sx;
        const color = colorAt(src, fromX, sy);
        px(dst, Math.round(x) + sx, Math.round(y) + sy, color, (alphaAt(src, fromX, sy) / 255) * alpha);
      }
    }
  }
}

export function flipX(img: Img): Img {
  const out = image(img.width, img.height);
  blit(out, img, 0, 0, { flip: true });
  return out;
}

/** The same shape in one flat color (a hit flash, a silhouette). */
export function silhouette(img: Img, color: number): Img {
  const out = copy(img);
  for (let i = 0; i < out.data.length; i += 4) {
    if ((out.data[i + 3] ?? 0) > 0) {
      out.data[i] = red(color);
      out.data[i + 1] = green(color);
      out.data[i + 2] = blue(color);
    }
  }
  return out;
}

/** Every drawn pixel's color passed through `map`. */
export function recolor(img: Img, map: (color: number) => number): Img {
  const out = copy(img);
  for (let i = 0; i < out.data.length; i += 4) {
    if ((out.data[i + 3] ?? 0) > 0) {
      const color = map(rgb(out.data[i] ?? 0, out.data[i + 1] ?? 0, out.data[i + 2] ?? 0));
      out.data[i] = red(color);
      out.data[i + 1] = green(color);
      out.data[i + 2] = blue(color);
    }
  }
  return out;
}

/** The smallest rectangle holding every drawn pixel, or `null` for an empty image. */
export function bounds(img: Img): { x: number; y: number; width: number; height: number } | null {
  let x0 = img.width;
  let y0 = img.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (alphaAt(img, x, y) > 0) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

export function crop(img: Img, x: number, y: number, width: number, height: number): Img {
  const out = image(width, height);
  for (let row = 0; row < height; row++) {
    const from = ((y + row) * img.width + x) * 4;
    out.data.set(img.data.subarray(from, from + width * 4), row * width * 4);
  }
  return out;
}

/** How many pixels are drawn. */
export function drawnCount(img: Img): number {
  let count = 0;
  for (let i = 3; i < img.data.length; i += 4) {
    if ((img.data[i] ?? 0) > 0) {
      count++;
    }
  }
  return count;
}

/** 4×4 ordered dither threshold in [0, 1) for a pixel. */
export function bayer(x: number, y: number): number {
  const m = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  return ((m[(((y % 4) + 4) % 4) * 4 + (((x % 4) + 4) % 4)] ?? 0) + 0.5) / 16;
}

/** A small seeded random generator for the art's scatter (grass tufts, rubble): same seed, same picture. */
export function scatter(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

export function sq(value: number): number {
  return value * value;
}

function normalize(x: number, y: number, z: number): [number, number, number] {
  const length = Math.sqrt(x * x + y * y + z * z) || 1;
  return [x / length, y / length, z / length];
}

const NEIGHBORS_4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
const NEIGHBORS_8 = [...NEIGHBORS_4, [1, 1], [-1, -1], [1, -1], [-1, 1]] as const;
