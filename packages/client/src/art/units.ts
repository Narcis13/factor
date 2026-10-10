// Every card's look on the field. Humanoids are rig specs (humanoid.ts); creatures, machines and
// buildings have their own drawings (creatures.ts, buildings.ts).
import type { Side } from '@factor/sim';
import { RAMPS, TEAM } from './color.ts';
import type { UnitFrames } from './frame.ts';
import { humanoidFrames, type Body, type HumanoidSpec } from './humanoid.ts';
import { ball, capsule, line, px, type Img } from './image.ts';
import { drawBomb } from './weapons.ts';
import { airshipFrames, chargerFrames, harrierFrames, miteFrames, wispFrames } from './creatures.ts';
import { bastionFrames, hiveFrames } from './buildings.ts';

const MEDIUM = { width: 44, height: 48, feet: 34 };

export const WARDEN: HumanoidSpec = {
  ...MEDIUM,
  head: 4.6,
  torso: { w: 4, h: 7 },
  legs: { h: 4, w: 3, gap: 1 },
  arm: { r: 1.25, len: 5 },
  skin: RAMPS.skin,
  body: RAMPS.steel,
  sleeve: RAMPS.steel,
  legRamp: RAMPS.iron,
  boots: RAMPS.leather,
  belt: RAMPS.leather,
  gear: { kind: 'greathelm', ramp: RAMPS.steel, plume: true },
  tabard: true,
  cape: true,
  weapon: 'sword',
  shield: true,
  style: 'slash',
  weaponSize: 1,
};

export const SLINGER: HumanoidSpec = {
  ...MEDIUM,
  head: 4.3,
  torso: { w: 3.6, h: 6 },
  legs: { h: 4, w: 2.6, gap: 1 },
  arm: { r: 1.05, len: 4.6 },
  skin: RAMPS.skin,
  body: RAMPS.leather,
  sleeve: RAMPS.linen,
  legRamp: RAMPS.cloth,
  boots: RAMPS.leather,
  belt: RAMPS.wood,
  gear: { kind: 'hood', ramp: TEAM[0] },
  tabard: false,
  cape: false,
  weapon: 'sling',
  shield: false,
  style: 'sling',
  weaponSize: 1,
  extra: (img, body, layer) => {
    // A pouch of stones at the hip.
    if (layer === 'front' && body.facing !== 'up') {
      const x = body.facing === 'side' ? body.cx - 2.5 : body.cx + 2.5;
      ball(img, x, body.hipY - 0.5, 1.6, 1.4, RAMPS.leather, 0.1);
    }
    if (layer === 'back' && body.facing === 'up') {
      capsule(img, body.cx + 2, body.torsoTop + 1, body.cx - 2, body.hipY - 1, 0.6, RAMPS.rope);
    }
  },
};

export const RABBLE: HumanoidSpec = {
  width: 36,
  height: 44,
  feet: 25,
  head: 3.5,
  torso: { w: 2.8, h: 4.5 },
  legs: { h: 3, w: 2, gap: 1 },
  arm: { r: 0.85, len: 3.4 },
  skin: RAMPS.skin,
  body: TEAM[0],
  sleeve: RAMPS.linen,
  legRamp: RAMPS.leather,
  boots: RAMPS.wood,
  belt: RAMPS.rope,
  gear: { kind: 'straw' },
  tabard: false,
  cape: false,
  weapon: 'pitchfork',
  shield: false,
  style: 'thrust',
  weaponSize: 0.75,
};

export const BOMBARDIER: HumanoidSpec = {
  ...MEDIUM,
  head: 4.6,
  torso: { w: 4.4, h: 6 },
  legs: { h: 3, w: 3, gap: 1 },
  arm: { r: 1.3, len: 4.4 },
  skin: RAMPS.skin,
  body: RAMPS.leather,
  sleeve: TEAM[0],
  legRamp: RAMPS.cloth,
  boots: RAMPS.iron,
  belt: RAMPS.iron,
  gear: { kind: 'kettle', ramp: RAMPS.iron },
  tabard: false,
  cape: false,
  beard: RAMPS.bronze,
  weapon: 'bomb',
  shield: false,
  style: 'throw',
  weaponSize: 1,
  extra: (img, body, layer) => {
    // A satchel of bombs on the back, seen from behind and the side.
    if (layer === 'back' && body.facing !== 'up') {
      const x = body.facing === 'side' ? body.cx - 4.5 : body.cx + 4.8;
      drawBomb(img, x, body.torsoTop + 3.5, 1.8, body.frame);
    }
    if (layer === 'front' && body.facing === 'up') {
      ball(img, body.cx, body.torsoTop + 3.5, 3.6, 3, RAMPS.leather, 0.1);
      drawBomb(img, body.cx - 1.5, body.torsoTop + 1, 1.6, body.frame);
      drawBomb(img, body.cx + 2, body.torsoTop + 1.5, 1.4, body.frame + 1);
    }
  },
};

export const REAVER: HumanoidSpec = {
  width: 62,
  height: 52,
  feet: 37,
  head: 4.7,
  torso: { w: 4.9, h: 8 },
  legs: { h: 4.5, w: 3.2, gap: 1 },
  arm: { r: 1.55, len: 5.4 },
  skin: RAMPS.skin,
  body: RAMPS.leather,
  sleeve: RAMPS.skin,
  legRamp: TEAM[0],
  boots: RAMPS.wood,
  belt: RAMPS.iron,
  gear: { kind: 'bandana', hair: RAMPS.leather },
  tabard: false,
  cape: false,
  beard: RAMPS.leather,
  weapon: 'greataxe',
  shield: false,
  style: 'sweep',
  weaponSize: 1,
  extra: (img, body, layer) => {
    if (layer !== 'front' || body.facing === 'side') {
      return;
    }
    // A fur collar over the vest, and a bone toggle.
    const top = body.torsoTop + 1;
    ball(img, body.cx, top - 0.3, 5.2, 1.8, RAMPS.feather, 0.15);
    if (body.facing === 'down') {
      line(img, body.cx, top + 1.5, body.cx, body.hipY - 1.5, 0x2c1a1c, 1);
      px(img, body.cx + 1, top + 3, 0xdcd4d0);
    }
  },
};

export const DUELIST: HumanoidSpec = {
  ...MEDIUM,
  head: 4.5,
  torso: { w: 4, h: 7 },
  legs: { h: 4, w: 2.8, gap: 1 },
  arm: { r: 1.2, len: 5 },
  skin: RAMPS.skin,
  body: RAMPS.steel,
  sleeve: TEAM[0],
  legRamp: RAMPS.cloth,
  boots: RAMPS.leather,
  belt: RAMPS.leather,
  gear: { kind: 'sallet', ramp: RAMPS.steel },
  tabard: false,
  cape: true,
  weapon: 'greatsword',
  shield: false,
  style: 'overhead',
  weaponSize: 1,
};

export const JUGGERNAUT: HumanoidSpec = {
  width: 72,
  height: 70,
  feet: 53,
  head: 5.4,
  torso: { w: 7, h: 10 },
  legs: { h: 6, w: 4.6, gap: 1.6 },
  arm: { r: 2.3, len: 6.2 },
  skin: RAMPS.iron,
  body: RAMPS.iron,
  sleeve: RAMPS.iron,
  legRamp: RAMPS.iron,
  boots: RAMPS.iron,
  belt: RAMPS.bronze,
  gear: { kind: 'horned', ramp: RAMPS.iron },
  tabard: true,
  cape: false,
  pauldrons: RAMPS.bronze,
  weapon: 'maul',
  shield: false,
  style: 'overhead',
  weaponSize: 1.35,
  extra: (img, body, layer) => {
    if (layer === 'back') {
      // A war banner in the team's colors on a pole across his back, seen from every side.
      const poleX = body.cx + (body.facing === 'side' ? -4 : body.facing === 'down' ? 4 : -4);
      const top = body.headY - 13;
      line(img, poleX, body.torsoTop + 4, poleX, top, 0x5a3626, 2);
      px(img, poleX, top - 1, 0xf5cf4c);
      const dir = body.facing === 'up' ? 1 : -1;
      for (let y = 0; y < 7; y++) {
        const wave = body.anim === 'walk' && body.frame % 2 === 1 && y > 3 ? 1 : 0;
        for (let x = 0; x < 5 - Math.max(0, y - 4); x++) {
          px(img, poleX + dir * (1 + x + wave), top + 1 + y, body.team[x < 2 ? 4 : 3] ?? 0);
        }
      }
    }
    if (layer === 'front' && body.facing !== 'down') {
      // Rivets down the back plate.
      for (let y = body.torsoTop + 2; y < body.hipY - 1; y += 3) {
        px(img, body.cx + (body.facing === 'side' ? -3 : 0), y, 0xaeb0ba);
      }
    }
  },
};

/** Specs are drawn in side 0's colors; any part in them (body, sleeves, legs, belt, hood) takes the side's own. */
function forSide(spec: HumanoidSpec, side: Side): HumanoidSpec {
  const team = TEAM[side];
  const swap = (ramp: readonly number[]) => (ramp === TEAM[0] ? team : ramp);
  const gear = spec.gear.kind === 'hood' ? { ...spec.gear, ramp: swap(spec.gear.ramp) } : spec.gear;
  return { ...spec, sleeve: swap(spec.sleeve), body: swap(spec.body), legRamp: swap(spec.legRamp), belt: swap(spec.belt), gear };
}

const HUMANOIDS: Record<string, HumanoidSpec> = {
  warden: WARDEN,
  slinger: SLINGER,
  rabble: RABBLE,
  bombardier: BOMBARDIER,
  reaver: REAVER,
  duelist: DUELIST,
  juggernaut: JUGGERNAUT,
};

/** Every card that puts something on the field, with how to draw it. */
export const UNIT_ART: Record<string, (side: Side) => UnitFrames> = {
  ...Object.fromEntries(Object.entries(HUMANOIDS).map(([card, spec]) => [card, (side: Side) => humanoidFrames(forSide(spec, side), side)])),
  harrier: harrierFrames,
  wisps: wispFrames,
  mite: miteFrames,
  charger: chargerFrames,
  airship: airshipFrames,
  bastion: bastionFrames,
  hive: hiveFrames,
};

export type { Body };
export type DrawExtra = (img: Img, body: Body, layer: 'back' | 'front') => void;
