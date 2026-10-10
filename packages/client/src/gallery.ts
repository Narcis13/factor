// `?gallery`: every piece of art the game draws, laid out for a look (a sense, VISION §6). `pnpm shots
// --gallery` captures it. `&section=<name>` shows one section; `&scale=<n>` zooms (default 3).
import { ARENA, CARDS, DECK_CARD_IDS } from '@factor/content';
import type { Side } from '@factor/sim';
import { worldArt } from './art/catalog.ts';
import { RAMPS, TEAM } from './art/color.ts';
import { FONT, goldText, textImage, TINY, WHITE_TEXT } from './art/font.ts';
import { ANIMS, FACINGS, type Frame } from './art/frame.ts';
import { blit, crop, image, type Img } from './art/image.ts';
import { bridgeImage, groundImage, surroundImage, WATER_FRAMES, waterImage } from './art/terrain.ts';
import { towerArt, type TowerArt } from './art/towers.ts';
import { bandImage, button, cardFace, costBadge, doubleBadge, energyColumn, energyGem, energyGlint, energyTrack, greyed, icon, labeledButton, nameplate, nameTag, notchImage, panel, ribbon, selectionGlow, spellEmblem, starIcon, timerPanel } from './art/ui.ts';
import { UNIT_ART } from './art/units.ts';

const params = new URLSearchParams(window.location.search);
const SCALE = Number(params.get('scale') ?? 3);
const unitOnly = params.get('unit');
const only = params.get('section') ?? (unitOnly === null ? null : 'units');
/** Only rows whose name holds this. */
const match = params.get('match');

document.body.style.cssText = 'margin:0;background:#2a2f3a;color:#e8eaed;font:12px monospace;overflow:auto;height:auto';
document.documentElement.style.cssText = 'overflow:auto;height:auto';
const root = document.createElement('div');
root.style.cssText = 'padding:12px;display:flex;flex-direction:column;gap:12px';
document.body.append(root);

/** An image on a canvas, `scale` times, over a background so outlines show. */
export function canvasOf(img: Img, scale: number, background: string | null = '#5a9a4a'): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  canvas.style.imageRendering = 'pixelated';
  const context = canvas.getContext('2d');
  if (context === null) {
    return canvas;
  }
  const small = document.createElement('canvas');
  small.width = img.width;
  small.height = img.height;
  small.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  if (background !== null) {
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.imageSmoothingEnabled = false;
  context.drawImage(small, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function section(title: string): HTMLElement {
  const box = document.createElement('section');
  box.style.cssText = 'display:flex;flex-direction:column;gap:4px';
  const heading = document.createElement('div');
  heading.textContent = title;
  heading.style.cssText = 'font-weight:bold;color:#ffd23f';
  box.append(heading);
  root.append(box);
  return box;
}

function row(parent: HTMLElement, label: string, frames: readonly (Frame | Img)[], scale = SCALE, background: string | null = '#5a9a4a'): void {
  if (match !== null && !label.includes(match)) {
    return;
  }
  const line = document.createElement('div');
  line.style.cssText = 'display:flex;gap:4px;align-items:flex-end';
  const name = document.createElement('span');
  name.textContent = label;
  name.style.cssText = 'width:110px;flex:none';
  line.append(name);
  for (const frame of frames) {
    const img = 'img' in frame ? withAnchor(frame) : frame;
    line.append(canvasOf(img, scale, background));
  }
  parent.append(line);
}

/** A frame with its anchor marked by a faint dot below it, so placement can be checked. */
function withAnchor(frame: Frame): Img {
  const out = image(frame.img.width, frame.img.height);
  out.data.set(frame.img.data);
  return out;
}

if (only === null || only === 'units') {
  for (const [card, art] of Object.entries(UNIT_ART)) {
    if (unitOnly !== null && unitOnly !== card) {
      continue;
    }
    const box = section(card);
    for (const side of [0, 1] as Side[]) {
      const frames = art(side);
      for (const facing of FACINGS) {
        row(box, `${String(side)} ${facing}`, ANIMS.flatMap((anim) => frames[anim][facing]));
      }
    }
  }
}

/** A tower as the game stacks it: body, then weapon, then flag. */
function composeTower(art: TowerArt, part: 'body' | 'cracked' | 'rubble', turret: Frame | null, flag: Frame | null): Img {
  const body = art[part];
  const out = image(body.img.width, body.img.height + 12);
  const ox = 0;
  const oy = 12;
  blit(out, body.img, ox, oy);
  if (turret !== null) {
    blit(out, turret.img, ox + body.ax + art.turretAt[0] - turret.ax, oy + body.ay + art.turretAt[1] - turret.ay);
  }
  if (flag !== null) {
    blit(out, flag.img, ox + body.ax + art.flagAt[0] - flag.ax, oy + body.ay + art.flagAt[1] - flag.ay);
  }
  return out;
}

if (only === null || only === 'towers') {
  const box = section('towers');
  for (const kind of ['outpost', 'keep'] as const) {
    for (const side of [0, 1] as Side[]) {
      const art = towerArt(kind, side);
      const views: Img[] = [
        composeTower(art, 'body', art.turret.down, art.flag[0] ?? null),
        composeTower(art, 'body', art.turret.side, art.flag[1] ?? null),
        composeTower(art, 'cracked', art.turret.up, art.flag[2] ?? null),
        ...(art.asleep === null ? [] : [composeTower(art, 'body', art.asleep, art.furled)]),
        composeTower(art, 'rubble', null, null),
      ];
      row(box, `${kind} ${String(side)}`, views, 3);
      row(box, `${kind} ${String(side)} fire`, FACINGS.flatMap((facing) => art.firing[facing]), 3);
    }
  }
}

// Effects and shots: every one the arena uses, from the same catalog, in the sizes the cards call for.
if (only === null || only === 'fx' || only === 'shots') {
  const { frames } = worldArt(CARDS);
  const groups = new Map<string, Frame[]>();
  for (const [name, frame] of frames) {
    const fx = /^fx:(.+):\d+$/.exec(name);
    const shot = /^s:(.+):\d+$/.exec(name);
    const group = fx?.[1] !== undefined && only !== 'shots' ? `fx ${fx[1]}` : shot?.[1] !== undefined && only !== 'fx' ? `shot ${shot[1]}` : name.startsWith('sh:') && only !== 'shots' ? 'shadows' : null;
    if (group !== null) {
      groups.set(group, [...(groups.get(group) ?? []), frame]);
    }
  }
  const box = section(only ?? 'fx and shots');
  for (const [name, list] of groups) {
    row(box, name, list, SCALE, '#3f7a33');
  }
}

if (only === null || only === 'terrain') {
  const box = section('terrain');
  const towers = ARENA.towers.map((tower) => ({ ...tower }));
  row(box, 'ground', [groundImage(ARENA, towers)], 2);
  row(box, 'water', Array.from({ length: WATER_FRAMES }, (_, frame) => crop(waterImage(ARENA, frame), 0, 0, 96, 32)), 4);
  row(box, 'bridge', [bridgeImage(48, 32).img], 4);
  row(box, 'surround', [surroundImage(160, 120, 40, 30, 80, 60)], 3);
}

if (only === null || only === 'ui') {
  const box = section('ui');
  const deck = DECK_CARD_IDS;
  row(box, 'cards', deck.map((card) => cardFace(card, CARDS[card], 36, 46)), 3, null);
  row(box, 'unaffordable', deck.slice(0, 8).map((card) => greyed(cardFace(card, CARDS[card], 36, 46, { cost: false }))), 3, null);
  row(box, 'small cards', deck.slice(0, 8).map((card) => cardFace(card, CARDS[card], 21, 27, { cost: false })), 3, null);
  row(box, 'panels', [panel(60, 30, 'wood'), panel(60, 30, 'stone'), panel(60, 30, 'slate'), bandImage(80, 30)], 3, null);
  row(box, 'buttons', [labeledButton(30, 16, RAMPS.gold, 'again', 'AGAIN'), labeledButton(30, 16, TEAM[0], 'deck', 'DECK'), labeledButton(30, 16, RAMPS.green, 'save', 'SAVE'), button(40, 16, RAMPS.gold, true)], 4, null);
  row(box, 'icons', (['again', 'deck', 'save', 'swords', 'clock', 'crown'] as const).map((name) => icon(name, 11)), 4, '#2f2b40');
  row(box, 'energy', [energyGem(15, 19), costBadge(3), costBadge(10), energyTrack(80, 8), energyColumn(6), energyGlint(6), notchImage(6), doubleBadge()], 4, '#2f2b40');
  row(box, 'stars', [starIcon(12, 0, true), starIcon(12, 0, false), starIcon(12, 1, true), starIcon(12, 1, false), starIcon(9, 0, true), starIcon(9, 1, false)], 4, '#3f7a33');
  row(box, 'ribbons', [ribbon(110, 20, TEAM[0]), ribbon(110, 20, TEAM[1]), ribbon(110, 20, RAMPS.stone)], 3, '#2f2b40');
  row(box, 'labels', [nameplate('BOT'), timerPanel(textImage('2:50').width), nameTag('bombardier'), selectionGlow(36, 46, 0)], 4, '#3f7a33');
  row(box, 'spells', (['flare', 'meteor', 'spark'] as const).map((card) => spellEmblem(card, 30)), 4, '#2f2b40');
  const glyphs = (font: typeof FONT): string => Object.keys(font.glyphs).join('');
  row(box, 'font', [textImage(glyphs(FONT).slice(0, 26), { color: goldText(), shadow: true }), textImage(glyphs(FONT).slice(26)), textImage(glyphs(TINY), { font: TINY })], 3, '#2f2b40');
  row(box, 'titles', [textImage('VICTORY', { color: goldText(), scale: 2, shadow: true }), textImage('DEFEAT', { color: WHITE_TEXT, scale: 2, shadow: true })], 3, '#2f2b40');
}

document.documentElement.dataset.ready = 'true';
