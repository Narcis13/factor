// Every frame the arena draws, by key. Which art a card uses (its unit, its shot, its spell, its splash)
// is decided here; how big an effect is comes from the card's numbers in content.
import { MILLI_PER_TILE, type CardId, type CardStats, type Side, type TowerKind } from '@factor/sim';
import { ANIMS, FACINGS, FRAME_COUNT, type Anim, type Facing, type Frame } from './frame.ts';
import { deployFrames, explosionFrames, flareFrames, hitFrames, meteorFallFrames, muzzleFrames, puffFrames, scorchImage, shadowImage, shockFrames, shotFrames, sparkFrames, zzzFrames, type ShotKind } from './fx.ts';
import { silhouette } from './image.ts';
import { PPT } from './terrain.ts';
import { towerArt } from './towers.ts';
import { UNIT_ART } from './units.ts';

export const SIDES: readonly Side[] = [0, 1];
export const TOWER_KINDS: readonly TowerKind[] = ['keep', 'outpost'];

/** What a shot looks like, by who fired it. */
export const SHOT_OF: Record<string, ShotKind> = {
  outpost: 'bolt',
  keep: 'cannonball',
  bastion: 'bolt',
  slinger: 'stone',
  harrier: 'dart',
  wisps: 'orb',
  bombardier: 'bomb',
};
export const SHOT_KINDS: readonly ShotKind[] = ['bolt', 'cannonball', 'stone', 'dart', 'orb', 'bomb'];

/** How a card's splash lands: a fiery blast or a shock of dust. */
export const SPLASH_OF: Record<string, 'boom' | 'shock'> = { bombardier: 'boom', airship: 'boom', reaver: 'shock' };

/** How a spell looks when it lands. */
export const SPELL_OF: Record<string, 'flare' | 'meteor' | 'spark'> = { flare: 'flare', meteor: 'meteor', spark: 'spark' };

/** A length in milli-tiles as whole art pixels. */
export function artPx(milli: number): number {
  return Math.max(1, Math.round((milli * PPT) / MILLI_PER_TILE));
}

export const key = {
  unit: (card: CardId, side: Side, anim: Anim, facing: Facing, frame: number) => `u:${card}:${String(side)}:${anim}:${facing}:${String(frame)}`,
  flash: (card: CardId, anim: Anim, facing: Facing, frame: number) => `w:${card}:${anim}:${facing}:${String(frame)}`,
  tower: (kind: TowerKind, side: Side, part: string) => `t:${kind}:${String(side)}:${part}`,
  fx: (name: string, frame: number) => `fx:${name}:${String(frame)}`,
  shot: (kind: ShotKind, side: Side, frame: number) => `s:${kind}:${String(side)}:${String(frame)}`,
  shadow: (radius: number) => `sh:${String(radius)}`,
};

/** Frame counts of the effects, so the renderer can play them. */
export const FX_FRAMES = { hit: 4, puff: 7, deploy: 8, boom: 9, flare: 9, meteorFall: 4, spark: 7, shock: 6, muzzle: 3, zzz: 4 } as const;

/** Where a tower's weapon and flag sit, from its body's anchor (the footprint's center). */
export interface TowerLayout {
  turretAt: [number, number];
  flagAt: [number, number];
  /** How high above the anchor the body's top is: where its hp bar goes. */
  top: number;
}

export interface WorldArt {
  frames: Map<string, Frame>;
  towers: Record<TowerKind, TowerLayout>;
  /** How far above its feet each unit's drawing reaches, in art pixels: where its hp bar goes. */
  heights: Record<string, number>;
}

/** Every frame of the arena for these cards' stats. */
export function worldArt(cards: Readonly<Record<CardId, CardStats>>): WorldArt {
  const frames = new Map<string, Frame>();
  const heights: Record<string, number> = {};
  const radii = new Set<number>();
  for (const [card, stats] of Object.entries(cards)) {
    if (stats.type === 'spell') {
      const r = artPx(stats.spell.radius);
      const look = SPELL_OF[card] ?? 'flare';
      addAll(frames, look === 'meteor' ? `boom:${String(r)}` : `${look}:${String(r)}`, look === 'flare' ? flareFrames(r) : look === 'spark' ? sparkFrames(r) : explosionFrames(r));
      if (look === 'meteor') {
        addAll(frames, 'meteorFall', meteorFallFrames());
        frames.set(key.fx(`scorch:${String(r)}`, 0), scorchImage(r));
      }
      continue;
    }
    const draw = UNIT_ART[card];
    if (draw === undefined) {
      throw new RangeError(`No art for the card ${card}`);
    }
    for (const side of SIDES) {
      const art = draw(side);
      for (const anim of ANIMS) {
        for (const facing of FACINGS) {
          for (let i = 0; i < FRAME_COUNT[anim]; i++) {
            const frame = art[anim][facing][i];
            if (frame === undefined) {
              continue;
            }
            frames.set(key.unit(card, side, anim, facing, i), frame);
            if (side === 0) {
              frames.set(key.flash(card, anim, facing, i), { ...frame, img: silhouette(frame.img, 0xffffff) });
            }
          }
        }
      }
      if (side === 0) {
        heights[card] = drawnHeight(art.idle.down[0]);
      }
    }
    const r = artPx(stats.unit.radius);
    radii.add(r);
    for (const side of SIDES) {
      addAll(frames, `puff:${String(r)}:${String(side)}`, puffFrames(r, side));
      addAll(frames, `deploy:${String(r)}:${String(side)}`, deployFrames(r, side));
    }
    if (stats.unit.splash > 0) {
      const s = artPx(stats.unit.splash);
      const look = SPLASH_OF[card] ?? 'boom';
      addAll(frames, `${look}:${String(s)}`, look === 'boom' ? explosionFrames(s) : shockFrames(s));
    }
  }
  const towers = {} as Record<TowerKind, TowerLayout>;
  for (const kind of TOWER_KINDS) {
    for (const side of SIDES) {
      const art = towerArt(kind, side);
      frames.set(key.tower(kind, side, 'body'), art.body);
      frames.set(key.tower(kind, side, 'cracked'), art.cracked);
      frames.set(key.tower(kind, side, 'rubble'), art.rubble);
      if (art.asleep !== null) {
        frames.set(key.tower(kind, side, 'asleep'), art.asleep);
      }
      if (art.furled !== null) {
        frames.set(key.tower(kind, side, 'furled'), art.furled);
      }
      for (const facing of FACINGS) {
        frames.set(key.tower(kind, side, `turret:${facing}`), art.turret[facing]);
        art.firing[facing].forEach((frame, i) => frames.set(key.tower(kind, side, `fire:${facing}:${String(i)}`), frame));
      }
      art.flag.forEach((frame, i) => frames.set(key.tower(kind, side, `flag:${String(i)}`), frame));
      towers[kind] = { turretAt: art.turretAt, flagAt: art.flagAt, top: drawnHeight(art.body) };
    }
    // A fallen tower's blast.
    addAll(frames, `boom:${String(kind === 'keep' ? 34 : 26)}`, explosionFrames(kind === 'keep' ? 34 : 26));
  }
  addAll(frames, 'hit', hitFrames());
  addAll(frames, 'muzzle', muzzleFrames());
  addAll(frames, 'zzz', zzzFrames());
  for (const kind of SHOT_KINDS) {
    for (const side of SIDES) {
      shotFrames(kind, side).forEach((frame, i) => frames.set(key.shot(kind, side, i), frame));
    }
  }
  for (const r of [...radii, 3, 5, 8, 12]) {
    frames.set(key.shadow(r), shadowImage(r));
  }
  return { frames, towers, heights };
}

function addAll(frames: Map<string, Frame>, name: string, list: readonly Frame[]): void {
  list.forEach((frame, i) => frames.set(key.fx(name, i), frame));
}

/** How many pixels a frame's drawing reaches above its anchor. */
function drawnHeight(frame: Frame | undefined): number {
  if (frame === undefined) {
    return 0;
  }
  const { img, ay } = frame;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if ((img.data[(y * img.width + x) * 4 + 3] ?? 0) > 0) {
        return ay - y;
      }
    }
  }
  return 0;
}
