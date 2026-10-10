// The art's palette (VISION §11, D8): every pixel the game draws comes from these ramps. A ramp runs dark
// to light with its hue shifting as it goes (shadows lean cool and purple, highlights warm), which is
// what keeps small sprites from looking flat. Colors are 0xRRGGBB numbers.
import type { Side } from '@factor/sim';

/** Dark to light, at least two colors. */
export type Ramp = readonly number[];

/** The darkest ink: outlines and the deepest shadows lean toward it. */
export const INK = 0x1b1325;
export const WHITE = 0xffffff;

export const RAMPS = {
  skin: [0x5a2f34, 0x8f4c45, 0xc8795c, 0xeeac82, 0xffd9b4],
  skinDark: [0x3a1f28, 0x5e3332, 0x8a5440, 0xb0784f, 0xd09a68],
  steel: [0x262a40, 0x434d68, 0x6d7e9c, 0xa3b5cc, 0xe2ecf5],
  iron: [0x1f1e2c, 0x353548, 0x545668, 0x7c7f8e, 0xaeb0ba],
  gold: [0x5a2f12, 0x985816, 0xd6962a, 0xf5cf4c, 0xfff4a6],
  bronze: [0x3e2014, 0x6e3c1e, 0xa4642e, 0xd09550, 0xf0c88a],
  wood: [0x33201c, 0x5a3626, 0x86573a, 0xb07e52, 0xd6a874],
  leather: [0x2c1a1c, 0x4e2e28, 0x744836, 0x9c6a4a, 0xc29266],
  stone: [0x252331, 0x413f52, 0x646378, 0x8f8f9f, 0xbfbec8, 0xe4e2e6],
  sand: [0x4e3a32, 0x7a5c44, 0xa8835a, 0xcfab78, 0xeed39e],
  grass: [0x183a2c, 0x23553a, 0x357440, 0x4f9346, 0x74b350, 0xa2d468],
  leaf: [0x10261f, 0x1b3e2c, 0x2a5c34, 0x3f7f3a, 0x5fa346, 0x8cc95a],
  dirt: [0x3a2724, 0x5b3d2f, 0x7f5a3e, 0xa27a50, 0xc49d68],
  water: [0x16244c, 0x1d3a72, 0x24589a, 0x2f7cc0, 0x4fa6dc, 0x8fd2f0, 0xdaf6ff],
  cloth: [0x2c2238, 0x4a3a52, 0x726478, 0xa497a6, 0xd9d0d6],
  linen: [0x4a3c40, 0x7c6a62, 0xb09c86, 0xd8c6a6, 0xf5ebd0],
  purple: [0x24163a, 0x3e2560, 0x63398a, 0x8f5cb4, 0xc095da],
  green: [0x15302a, 0x22503a, 0x377446, 0x5a9a4e, 0x8cc266],
  moss: [0x22301e, 0x3a4a26, 0x5a6a30, 0x82903e, 0xb0b858],
  fire: [0x5a1418, 0xa8281e, 0xe8561e, 0xff9a2e, 0xffd25a, 0xfff7c0],
  ember: [0x2a0e14, 0x5c1a18, 0x9c3018, 0xd8601c],
  magic: [0x1e1a4a, 0x2f3c8c, 0x3f72d0, 0x62b4f0, 0xa8e8ff, 0xf2ffff],
  bolt: [0x2a2470, 0x5048d8, 0x8a9cff, 0xc8e4ff, 0xffffff],
  honey: [0x4a2a10, 0x864a14, 0xc47a1c, 0xeeb030, 0xffdc6a, 0xfff2b0],
  shell: [0x15121e, 0x2a2332, 0x463a4c, 0x6a5a6c, 0x958298],
  bone: [0x4a4250, 0x7c7480, 0xb0a8ac, 0xdcd4d0, 0xfaf6ee],
  smoke: [0x2a2630, 0x4a4652, 0x6e6a76, 0x9a96a0, 0xc8c6cc, 0xeeeef0],
  feather: [0x2c1e1c, 0x4c3428, 0x7a5638, 0xa88050, 0xd4b07a, 0xf5e2b6],
  rope: [0x3c2a1c, 0x6a4e2e, 0x9a7a48, 0xc4a468],
} as const satisfies Record<string, Ramp>;

/** Each side's colors: side 0 (the player, at the bottom) blue, side 1 red, as before (VISION §2: readable). */
export const TEAM: Record<Side, Ramp> = {
  0: [0x141c4a, 0x1e3488, 0x2856c8, 0x3d86ee, 0x7cbcff, 0xc8e8ff],
  1: [0x3e0c1c, 0x7a1424, 0xc0262c, 0xec5a3c, 0xff9a6a, 0xffd8bc],
};

/** A team ramp's middle color, for flat marks (hp bars, rings). */
export function teamColor(side: Side): number {
  return TEAM[side][3] ?? 0;
}

export function rgb(r: number, g: number, b: number): number {
  return (clampByte(r) << 16) | (clampByte(g) << 8) | clampByte(b);
}

export function red(color: number): number {
  return (color >> 16) & 0xff;
}

export function green(color: number): number {
  return (color >> 8) & 0xff;
}

export function blue(color: number): number {
  return color & 0xff;
}

/** `t` of the way from `a` to `b`. */
export function mix(a: number, b: number, t: number): number {
  return rgb(red(a) + (red(b) - red(a)) * t, green(a) + (green(b) - green(a)) * t, blue(a) + (blue(b) - blue(a)) * t);
}

/** The ramp's color at `index`, clamped to its ends. */
export function shade(ramp: Ramp, index: number): number {
  const i = Math.max(0, Math.min(ramp.length - 1, Math.round(index)));
  return ramp[i] ?? INK;
}

/** The ramp's color at `t` in [0, 1]: 0 is its darkest, 1 its lightest. */
export function tone(ramp: Ramp, t: number): number {
  return shade(ramp, t * (ramp.length - 1));
}

/** Grey of the same lightness, for a card the player can't afford. */
export function grey(color: number): number {
  const l = 0.3 * red(color) + 0.55 * green(color) + 0.15 * blue(color);
  return rgb(l, l, l * 1.04);
}

export function css(color: number, alpha = 1): string {
  return alpha >= 1 ? `#${color.toString(16).padStart(6, '0')}` : `rgba(${String(red(color))},${String(green(color))},${String(blue(color))},${String(alpha)})`;
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
