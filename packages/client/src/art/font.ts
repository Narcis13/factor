// The game's lettering, as pixel glyphs: a 5×7 face for everything you read, a 3×5 one for small numbers
// (tower hp, card costs). Capitals only; lowercase is set in capitals. Text is drawn with a vertical
// gradient, an outline and a drop shadow, so it reads over anything.
import { INK, shade, type Ramp } from './color.ts';
import { image, px, type Img } from './image.ts';

export interface Font {
  height: number;
  /** Space between letters. */
  spacing: number;
  /** A space's width. */
  space: number;
  glyphs: Record<string, readonly string[]>;
}

const g = (rows: string): string[] => rows.trim().split(/\s+/);

export const FONT: Font = {
  height: 7,
  spacing: 1,
  space: 3,
  glyphs: {
    A: g('.###. #...# #...# ##### #...# #...# #...#'),
    B: g('####. #...# #...# ####. #...# #...# ####.'),
    C: g('.###. #...# #.... #.... #.... #...# .###.'),
    D: g('####. #...# #...# #...# #...# #...# ####.'),
    E: g('##### #.... #.... ####. #.... #.... #####'),
    F: g('##### #.... #.... ####. #.... #.... #....'),
    G: g('.###. #...# #.... #.### #...# #...# .####'),
    H: g('#...# #...# #...# ##### #...# #...# #...#'),
    I: g('### .#. .#. .#. .#. .#. ###'),
    J: g('..### ...#. ...#. ...#. #..#. #..#. .##..'),
    K: g('#...# #..#. #.#.. ##... #.#.. #..#. #...#'),
    L: g('#.... #.... #.... #.... #.... #.... #####'),
    M: g('#...# ##.## #.#.# #.#.# #...# #...# #...#'),
    N: g('#...# ##..# #.#.# #..## #...# #...# #...#'),
    O: g('.###. #...# #...# #...# #...# #...# .###.'),
    P: g('####. #...# #...# ####. #.... #.... #....'),
    Q: g('.###. #...# #...# #...# #.#.# #..#. .##.#'),
    R: g('####. #...# #...# ####. #.#.. #..#. #...#'),
    S: g('.#### #.... #.... .###. ....# ....# ####.'),
    T: g('##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..'),
    U: g('#...# #...# #...# #...# #...# #...# .###.'),
    V: g('#...# #...# #...# #...# #...# .#.#. ..#..'),
    W: g('#...# #...# #...# #.#.# #.#.# #.#.# .#.#.'),
    X: g('#...# #...# .#.#. ..#.. .#.#. #...# #...#'),
    Y: g('#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..'),
    Z: g('##### ....# ...#. ..#.. .#... #.... #####'),
    '0': g('.###. #...# #..## #.#.# ##..# #...# .###.'),
    '1': g('.#. ##. .#. .#. .#. .#. ###'),
    '2': g('.###. #...# ....# ...#. ..#.. .#... #####'),
    '3': g('####. ....# ....# .###. ....# ....# ####.'),
    '4': g('...#. ..##. .#.#. #..#. ##### ...#. ...#.'),
    '5': g('##### #.... ####. ....# ....# #...# .###.'),
    '6': g('.###. #.... #.... ####. #...# #...# .###.'),
    '7': g('##### ....# ...#. ..#.. .#... .#... .#...'),
    '8': g('.###. #...# #...# .###. #...# #...# .###.'),
    '9': g('.###. #...# #...# .#### ....# ....# .###.'),
    ':': g('. # . . . # .'),
    '.': g('. . . . . . #'),
    ',': g('.. .. .. .. .. .# #.'),
    '!': g('# # # # # . #'),
    '?': g('.###. #...# ....# ...#. ..#.. ..... ..#..'),
    "'": g('# # . . . . .'),
    '-': g('.... .... .... #### .... .... ....'),
    '+': g('..... ..#.. ..#.. ##### ..#.. ..#.. .....'),
    '/': g('....# ...#. ...#. ..#.. .#... .#... #....'),
    '%': g('##..# ##.#. ...#. ..#.. .#... .#.## #..##'),
    '×': g('..... ..... #...# .#.#. ..#.. .#.#. #...#'),
    '·': g('. . . # . . .'),
    '(': g('.# #. #. #. #. #. .#'),
    ')': g('#. .# .# .# .# .# #.'),
  },
};

export const TINY: Font = {
  height: 5,
  spacing: 1,
  space: 2,
  glyphs: {
    '0': g('### #.# #.# #.# ###'),
    '1': g('.#. ##. .#. .#. ###'),
    '2': g('### ..# ### #.. ###'),
    '3': g('### ..# .## ..# ###'),
    '4': g('#.# #.# ### ..# ..#'),
    '5': g('### #.. ### ..# ###'),
    '6': g('### #.. ### #.# ###'),
    '7': g('### ..# .#. .#. .#.'),
    '8': g('### #.# ### #.# ###'),
    '9': g('### #.# ### ..# ###'),
    A: g('.#. #.# ### #.# #.#'),
    B: g('##. #.# ##. #.# ##.'),
    C: g('.## #.. #.. #.. .##'),
    D: g('##. #.# #.# #.# ##.'),
    E: g('### #.. ##. #.. ###'),
    F: g('### #.. ##. #.. #..'),
    G: g('.## #.. #.# #.# .##'),
    H: g('#.# #.# ### #.# #.#'),
    I: g('### .#. .#. .#. ###'),
    J: g('..# ..# ..# #.# .#.'),
    K: g('#.# #.# ##. #.# #.#'),
    L: g('#.. #.. #.. #.. ###'),
    M: g('#.# ### ### #.# #.#'),
    N: g('##. #.# #.# #.# #.#'),
    O: g('.#. #.# #.# #.# .#.'),
    P: g('##. #.# ##. #.. #..'),
    Q: g('.#. #.# #.# ##. .##'),
    R: g('##. #.# ##. #.# #.#'),
    S: g('.## #.. .#. ..# ##.'),
    T: g('### .#. .#. .#. .#.'),
    U: g('#.# #.# #.# #.# ###'),
    V: g('#.# #.# #.# #.# .#.'),
    W: g('#.# #.# ### ### #.#'),
    X: g('#.# #.# .#. #.# #.#'),
    Y: g('#.# #.# .#. .#. .#.'),
    Z: g('### ..# .#. #.. ###'),
    ':': g('. # . # .'),
    '.': g('. . . . #'),
    ',': g('.. .. .. .# #.'),
    "'": g('# # . . .'),
    '-': g('... ... ### ... ...'),
    '+': g('... .#. ### .#. ...'),
    '×': g('... #.# .#. #.# ...'),
    '/': g('..# ..# .#. #.. #..'),
    '%': g('#.. ..# .#. #.. ..#'),
    '!': g('# # # . #'),
    '?': g('## ..# .#. ... .#.'),
    '·': g('. . # . .'),
  },
};

function glyph(font: Font, char: string): readonly string[] | undefined {
  return font.glyphs[char.toUpperCase()];
}

/** The width of `text` set in `font`, in pixels, without outline. */
export function textWidth(text: string, font: Font = FONT): number {
  let width = 0;
  for (const char of text) {
    const rows = glyph(font, char);
    width += (rows === undefined ? font.space : (rows[0]?.length ?? 0)) + font.spacing;
  }
  return Math.max(0, width - font.spacing);
}

export interface TextStyle {
  font?: Font;
  /** A ramp runs light at the top to darker at the bottom; a number is one flat color. */
  color?: Ramp | number;
  /** Outline color, or `null` for none. */
  outline?: number | null;
  /** A drop shadow one pixel down. */
  shadow?: boolean;
  /** Each glyph pixel drawn this many pixels square. */
  scale?: number;
}

/** Draws `text` with its top-left at (x, y) (the outline sits a pixel outside that). */
export function drawText(img: Img, text: string, x: number, y: number, style: TextStyle = {}): void {
  const font = style.font ?? FONT;
  const scale = style.scale ?? 1;
  const color = style.color ?? 0xffffff;
  const outline = style.outline === undefined ? INK : style.outline;
  const pixels: [number, number, number][] = [];
  let cursor = 0;
  for (const char of text) {
    const rows = glyph(font, char);
    if (rows === undefined) {
      cursor += font.space + font.spacing;
      continue;
    }
    rows.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) {
        if (row[rx] === '#') {
          const fill = typeof color === 'number' ? color : rampAt(color, ry / Math.max(1, font.height - 1));
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              pixels.push([x + (cursor + rx) * scale + sx, y + ry * scale + sy, fill]);
            }
          }
        }
      }
    });
    cursor += (rows[0]?.length ?? 0) + font.spacing;
  }
  const lit = new Set(pixels.map(([px0, py0]) => `${String(px0)},${String(py0)}`));
  if (outline !== null) {
    if (style.shadow === true) {
      for (const [px0, py0] of pixels) {
        for (const [ox, oy] of [[0, 2], [1, 2], [-1, 2], [1, 1], [-1, 1]]) {
          if (!lit.has(`${String(px0 + (ox ?? 0))},${String(py0 + (oy ?? 0))}`)) {
            px(img, px0 + (ox ?? 0), py0 + (oy ?? 0), outline);
          }
        }
      }
    }
    for (const [px0, py0] of pixels) {
      for (const [ox, oy] of NEIGHBORS) {
        if (!lit.has(`${String(px0 + ox)},${String(py0 + oy)}`)) {
          px(img, px0 + ox, py0 + oy, outline);
        }
      }
    }
  } else if (style.shadow === true) {
    for (const [px0, py0] of pixels) {
      if (!lit.has(`${String(px0)},${String(py0 + 1)}`)) {
        px(img, px0, py0 + 1, INK, 0.6);
      }
    }
  }
  for (const [px0, py0, fill] of pixels) {
    px(img, px0, py0, fill);
  }
}

/** `text` alone on an image just big enough for it, its outline and shadow. */
export function textImage(text: string, style: TextStyle = {}): Img {
  const font = style.font ?? FONT;
  const scale = style.scale ?? 1;
  const pad = style.outline === null ? 0 : 1;
  const extra = style.shadow === true ? 2 : 0;
  const img = image(textWidth(text, font) * scale + pad * 2, font.height * scale + pad * 2 + extra);
  drawText(img, text, pad, pad, style);
  return img;
}

/** A ramp's color `t` of the way down a glyph: the top two-fifths lightest. */
function rampAt(ramp: Ramp, t: number): number {
  const top = ramp.length - 1;
  return shade(ramp, t < 0.4 ? top : t < 0.75 ? top - 1 : top - 2);
}

/** Gold lettering, for titles. */
export function goldText(): Ramp {
  return [0x985816, 0xd6962a, 0xf5cf4c, 0xfff4a6, 0xffffff];
}

/** White lettering, faintly cool at its foot. */
export const WHITE_TEXT: Ramp = [0x9aa4c0, 0xc8d0e4, 0xffffff];

const NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
] as const;

