// The humanoid rig: a chibi figure (big head, short body) drawn from the front, the back and the right
// side, walking, idling and attacking. Each unit is a spec; its swing style says how its attack moves.
import type { Side } from '@factor/sim';
import { INK, RAMPS, TEAM, mix, shade, type Ramp } from './color.ts';
import { ANIMS, FACINGS, FRAME_COUNT, type Anim, type Facing, type Frame, type UnitFrames } from './frame.ts';
import { ball, capsule, image, line, outline, poly, px, type Img } from './image.ts';
import { drawShield, drawSmear, drawWeapon, type WeaponKind } from './weapons.ts';

export type Headgear =
  | { kind: 'greathelm'; ramp: Ramp; plume: boolean }
  | { kind: 'hood'; ramp: Ramp }
  | { kind: 'straw' }
  | { kind: 'horned'; ramp: Ramp }
  | { kind: 'kettle'; ramp: Ramp }
  | { kind: 'bandana'; hair: Ramp }
  | { kind: 'sallet'; ramp: Ramp };

/** How an attack moves: a one-handed cut, a two-handed chop, a wide sweep, a jab, a throw or a sling. */
export type SwingStyle = 'slash' | 'overhead' | 'sweep' | 'thrust' | 'throw' | 'sling';

export interface HumanoidSpec {
  /** The frame's size and the row the feet stand on (the anchor). */
  width: number;
  height: number;
  feet: number;
  head: number;
  torso: { w: number; h: number };
  legs: { h: number; w: number; gap: number };
  arm: { r: number; len: number };
  skin: Ramp;
  body: Ramp;
  sleeve: Ramp;
  legRamp: Ramp;
  boots: Ramp;
  belt: Ramp;
  gear: Headgear;
  tabard: boolean;
  cape: boolean;
  beard?: Ramp;
  pauldrons?: Ramp;
  weapon: WeaponKind;
  shield: boolean;
  style: SwingStyle;
  /** The weapon's scale. */
  weaponSize: number;
  /** Anything else the unit wears, drawn behind the body ('back') or over it ('front'). */
  extra?: (img: Img, body: Body, layer: 'back' | 'front') => void;
}

/** Where the figure's parts are in one frame. */
export interface Body {
  facing: Facing;
  anim: Anim;
  frame: number;
  team: Ramp;
  cx: number;
  feet: number;
  hipY: number;
  torsoTop: number;
  headY: number;
  /** The weapon hand's shoulder and the other one. */
  shoulder: { x: number; y: number };
  offShoulder: { x: number; y: number };
}

/** A weapon pose: the hand relative to its shoulder, the weapon's angle in degrees, and a swing's smear. */
interface Grip {
  hand: [number, number];
  angle: number;
  smear?: [number, number];
  /** Drawn behind the body. */
  behind?: boolean;
  /** Nothing in hand (thrown). */
  empty?: boolean;
}

const D = Math.PI / 180;

/** Attack keyframes (ready, wind-up, strike, follow-through) per style and facing. */
const SWINGS: Record<SwingStyle, Record<Facing, [Grip, Grip, Grip, Grip]>> = {
  slash: {
    down: [
      { hand: [-1, 5], angle: -110 },
      { hand: [-1, -2], angle: -165 },
      { hand: [4, 5], angle: 55, smear: [-165, 55] },
      { hand: [3, 6], angle: 85 },
    ],
    up: [
      { hand: [1, 5], angle: -70, behind: true },
      { hand: [2, -1], angle: -15 },
      { hand: [-4, 1], angle: -160, smear: [-15, -160] },
      { hand: [-4, 3], angle: -175, behind: true },
    ],
    side: [
      { hand: [1, 5], angle: -60 },
      { hand: [-2, -2], angle: -155 },
      { hand: [4, 4], angle: 35, smear: [-155, 35] },
      { hand: [3, 5], angle: 70 },
    ],
  },
  overhead: {
    down: [
      { hand: [3, 6], angle: -120 },
      { hand: [4, -3], angle: -95 },
      { hand: [4, 7], angle: 80, smear: [-95, 80] },
      { hand: [4, 7], angle: 100 },
    ],
    up: [
      { hand: [-3, 6], angle: -60, behind: true },
      { hand: [-3, -2], angle: -30 },
      { hand: [-4, 1], angle: -150, smear: [-30, -150] },
      { hand: [-4, 3], angle: -160, behind: true },
    ],
    side: [
      { hand: [2, 6], angle: -70 },
      { hand: [-1, -3], angle: -150 },
      { hand: [4, 5], angle: 35, smear: [-150, 35] },
      { hand: [4, 6], angle: 65 },
    ],
  },
  sweep: {
    down: [
      { hand: [3, 6], angle: -45 },
      { hand: [6, 3], angle: -5 },
      { hand: [-7, 6], angle: 170, smear: [-5, 175] },
      { hand: [-6, 6], angle: 190 },
    ],
    up: [
      { hand: [-3, 6], angle: -135, behind: true },
      { hand: [-7, 3], angle: 185 },
      { hand: [6, 3], angle: 355, smear: [185, 355] },
      { hand: [6, 4], angle: 15, behind: true },
    ],
    side: [
      { hand: [2, 6], angle: -60 },
      { hand: [-3, 2], angle: -170 },
      { hand: [5, 5], angle: 15, smear: [-170, 15] },
      { hand: [4, 6], angle: 45 },
    ],
  },
  thrust: {
    down: [
      { hand: [0, 5], angle: -95 },
      { hand: [1, 2], angle: -100 },
      { hand: [2, 8], angle: 92, smear: [92, 92] },
      { hand: [1, 6], angle: 100 },
    ],
    up: [
      { hand: [0, 5], angle: -85, behind: true },
      { hand: [0, 7], angle: -88, behind: true },
      { hand: [0, 0], angle: -90 },
      { hand: [0, 3], angle: -88, behind: true },
    ],
    side: [
      { hand: [1, 5], angle: -80 },
      { hand: [-2, 5], angle: -5 },
      { hand: [4, 5], angle: 0, smear: [0, 0] },
      { hand: [2, 5], angle: -10 },
    ],
  },
  throw: {
    down: [
      { hand: [0, 6], angle: 90 },
      { hand: [0, -3], angle: -90 },
      { hand: [3, 5], angle: 80, empty: true, smear: [-120, 70] },
      { hand: [2, 7], angle: 90, empty: true },
    ],
    up: [
      { hand: [0, 6], angle: 90 },
      { hand: [0, 0], angle: -90 },
      { hand: [-1, -3], angle: -90, empty: true, smear: [-60, -120] },
      { hand: [0, 2], angle: -90, empty: true },
    ],
    side: [
      { hand: [1, 6], angle: 90 },
      { hand: [-3, -2], angle: -120 },
      { hand: [4, 2], angle: -10, empty: true, smear: [-150, -10] },
      { hand: [4, 5], angle: 30, empty: true },
    ],
  },
  sling: {
    down: [
      { hand: [0, 6], angle: 100 },
      { hand: [0, -4], angle: -30 },
      { hand: [3, 3], angle: 70, empty: true, smear: [-150, 60] },
      { hand: [2, 6], angle: 95 },
    ],
    up: [
      { hand: [0, 6], angle: 80 },
      { hand: [0, -4], angle: -150 },
      { hand: [-1, -3], angle: -90, empty: true, smear: [-20, -100] },
      { hand: [0, 4], angle: 90 },
    ],
    side: [
      { hand: [1, 6], angle: 100 },
      { hand: [-1, -4], angle: -170 },
      { hand: [4, 1], angle: -20, empty: true, smear: [-170, -20] },
      { hand: [3, 6], angle: 80 },
    ],
  },
};

/** The rest pose of each style while walking or idling, by facing. */
function restGrip(style: SwingStyle, facing: Facing): Grip {
  return SWINGS[style][facing][0];
}

export function humanoidFrames(spec: HumanoidSpec, side: Side): UnitFrames {
  const frames = {} as UnitFrames;
  for (const anim of ANIMS) {
    frames[anim] = {} as Record<Facing, Frame[]>;
    for (const facing of FACINGS) {
      frames[anim][facing] = Array.from({ length: FRAME_COUNT[anim] }, (_, frame) => drawHumanoid(spec, side, facing, anim, frame));
    }
  }
  return frames;
}

export function drawHumanoid(spec: HumanoidSpec, side: Side, facing: Facing, anim: Anim, frame: number): Frame {
  const img = image(spec.width, spec.height);
  const team = TEAM[side];
  const cx = Math.floor(spec.width / 2);
  const feet = spec.feet;
  // Bob: up a pixel mid-stride, down one on the idle's out-breath, and down into the strike.
  const bob = anim === 'walk' ? (frame % 2 === 1 ? -1 : 0) : anim === 'idle' ? frame : frame === 2 ? 1 : 0;
  const hipY = feet - spec.legs.h;
  const torsoTop = hipY - spec.torso.h + bob;
  const headY = torsoTop - spec.head * 0.62;
  const side3 = facing === 'side';
  const tw = side3 ? spec.torso.w * 0.78 : spec.torso.w;
  const weaponLeft = facing === 'down';
  const shoulderY = torsoTop + 1.6;
  const shoulder = side3 ? { x: cx + 0.5, y: shoulderY } : { x: weaponLeft ? cx - tw - 0.3 : cx + tw + 0.3, y: shoulderY };
  const offShoulder = side3 ? { x: cx - 1.5, y: shoulderY } : { x: weaponLeft ? cx + tw + 0.3 : cx - tw - 0.3, y: shoulderY };
  const body: Body = { facing, anim, frame, team, cx, feet, hipY, torsoTop, headY, shoulder, offShoulder };

  const grip = anim === 'attack' ? (SWINGS[spec.style][facing][frame] ?? restGrip(spec.style, facing)) : restGrip(spec.style, facing);
  // Mirror the grip's x for the back view's right-hand weapon, which the tables already give in screen terms.
  const swing = anim === 'walk' ? (frame === 0 ? 1 : frame === 2 ? -1 : 0) : 0;
  const hand = { x: shoulder.x + grip.hand[0], y: shoulder.y + grip.hand[1] + (anim === 'walk' ? -swing * 0.8 : 0) };
  const offHand = side3
    ? { x: offShoulder.x - 1 + swing, y: offShoulder.y + spec.arm.len - 1 }
    : { x: offShoulder.x + (weaponLeft ? 1 : -1), y: offShoulder.y + spec.arm.len - 1 + (anim === 'walk' ? swing * 0.8 : 0) };
  const angle = grip.angle * D;
  const weaponSize = spec.weaponSize;
  // A pitchfork is carried in one hand and thrust with both.
  const twoHanded = spec.style === 'overhead' || spec.style === 'sweep' || (spec.style === 'thrust' && anim === 'attack' && frame > 0);

  const drawHeld = (): void => {
    if (grip.empty !== true || spec.style === 'sling') {
      drawWeapon(img, grip.empty === true ? 'none' : spec.weapon, hand.x, hand.y, angle, weaponSize);
    }
  };
  const drawSmearIfAny = (): void => {
    if (grip.smear !== undefined && grip.smear[0] !== grip.smear[1]) {
      const reach = spec.arm.len + 3.5 * weaponSize;
      drawSmear(img, shoulder.x, shoulder.y, reach, grip.smear[0] * D, grip.smear[1] * D, team[4] ?? 0xffffff, 2);
    } else if (grip.smear !== undefined) {
      // A jab: speed lines along the thrust.
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      for (const offset of [-2, 2]) {
        const sx = hand.x - dy * offset;
        const sy = hand.y + dx * offset;
        line(img, sx - dx * 4, sy - dy * 4, sx + dx * 2, sy + dy * 2, 0xffffff, 1, 0.6);
      }
    }
  };

  // --- Behind the body.
  if (spec.cape && facing !== 'up') {
    drawCape(img, body, spec, 'peek');
  }
  spec.extra?.(img, body, 'back');
  if (grip.behind === true) {
    drawHeld();
  }
  if (side3) {
    // The far arm, in shadow, and its shield held out ahead: the body hides its near half.
    capsule(img, offShoulder.x, offShoulder.y, offHand.x, offHand.y, spec.arm.r, darker(spec.sleeve));
    ball(img, offHand.x, offHand.y, spec.arm.r + 0.2, spec.arm.r + 0.2, darker(spec.skin));
    if (spec.shield) {
      drawShield(img, cx + tw * 0.7 + 1, offHand.y - 1.5, 'front', team, spec.torso.h / 7, 0.6);
    }
  }
  if (anim === 'attack' && frame === 2 && facing !== 'down') {
    drawSmearIfAny();
  }

  // --- Legs.
  drawLegs(img, spec, body);

  // --- Torso.
  ball(img, cx + (side3 ? -0.3 : 0), torsoTop + spec.torso.h / 2 + 0.5, tw + 0.5, spec.torso.h / 2 + 1, spec.body, 0.05);
  if (spec.tabard && facing !== 'up') {
    drawTabard(img, body, spec, tw);
  }
  // Belt.
  const beltY = hipY - 1 + Math.max(0, bob);
  line(img, cx - tw + (side3 ? 0 : 0.5), beltY, cx + tw - (side3 ? 1 : 0.5), beltY, shade(spec.belt, 1), 1);
  if (facing === 'down') {
    px(img, cx, beltY, shade(RAMPS.gold, 3));
  }
  if (spec.cape && facing === 'up') {
    drawCape(img, body, spec, 'full');
  }

  // --- Arms (the off arm, then the weapon arm over the weapon in front).
  if (!side3) {
    capsule(img, offShoulder.x, offShoulder.y, offHand.x, offHand.y, spec.arm.r, spec.sleeve);
    ball(img, offHand.x, offHand.y, spec.arm.r + 0.3, spec.arm.r + 0.3, spec.shield ? spec.sleeve : spec.skin);
  }
  if (spec.pauldrons !== undefined) {
    ball(img, offShoulder.x, offShoulder.y - 0.5, spec.arm.r + 1.4, spec.arm.r + 1, spec.pauldrons, 0.1);
  }
  if (spec.shield && !side3) {
    drawShield(img, offHand.x + (weaponLeft ? 1 : -1), offHand.y - 1, facing === 'down' ? 'front' : 'back', team, spec.torso.h / 7);
  }

  // --- Head.
  drawHead(img, spec, body);
  spec.extra?.(img, body, 'front');

  // --- Weapon arm and weapon.
  if (anim === 'attack' && frame === 2 && facing === 'down') {
    drawSmearIfAny();
  }
  if (twoHanded && !side3) {
    // Both hands on the haft: the off arm reaches across.
    capsule(img, offShoulder.x, offShoulder.y, hand.x + (weaponLeft ? 1 : -1), hand.y, spec.arm.r, spec.sleeve);
  }
  if (grip.behind !== true) {
    drawHeld();
  }
  capsule(img, shoulder.x, shoulder.y, hand.x, hand.y, spec.arm.r, spec.sleeve);
  ball(img, hand.x, hand.y, spec.arm.r + 0.35, spec.arm.r + 0.35, spec.skin);
  if (spec.pauldrons !== undefined) {
    ball(img, shoulder.x, shoulder.y - 0.5, spec.arm.r + 1.4, spec.arm.r + 1, spec.pauldrons, 0.1);
  }
  if (spec.style === 'sling' && anim === 'attack' && frame === 1) {
    // The sling whirls over the head.
    drawSmear(img, hand.x, hand.y - 2, 4, -200 * D, 100 * D, 0xffffff, 1);
    capsule(img, hand.x + 3, hand.y - 4, hand.x + 3, hand.y - 4, 1.3, RAMPS.stone, 0.2);
  }

  outline(img);
  return { img, ax: cx, ay: feet };
}

function drawLegs(img: Img, spec: HumanoidSpec, body: Body): void {
  const { cx, feet, hipY, facing, anim, frame } = body;
  const { w, gap } = spec.legs;
  const r = w / 2;
  if (facing === 'side') {
    const stride = anim === 'walk' ? [2, 0, -2, 0][frame] ?? 0 : anim === 'attack' && frame >= 2 ? 1.5 : 0;
    // Far leg first, darker.
    const legs: [number, Ramp, Ramp][] = [
      [-stride, darker(spec.legRamp), darker(spec.boots)],
      [stride, spec.legRamp, spec.boots],
    ];
    for (const [dx, ramp, boots] of legs) {
      const lift = anim === 'walk' && dx < 0 && frame !== 1 && frame !== 3 ? 0 : 0;
      capsule(img, cx - 0.5, hipY, cx - 0.5 + dx * 0.8, feet - 1.5 - lift, r, ramp);
      ball(img, cx + dx * 0.8 + 0.4, feet - 1.2 - lift, r + 0.8, 1.3, boots);
    }
    return;
  }
  for (const which of [-1, 1] as const) {
    const x = cx + which * (gap / 2 + r) - (which === 1 ? 0 : 0);
    // Mid-stride, one foot is up a pixel.
    const lifted = anim === 'walk' && ((frame === 0 && which === 1) || (frame === 2 && which === -1)) ? 1 : 0;
    capsule(img, x, hipY, x, feet - 1.5 - lifted, r, spec.legRamp);
    ball(img, x + which * 0.2, feet - 1.1 - lifted, r + 0.4, 1.3, spec.boots);
  }
}

function drawTabard(img: Img, body: Body, spec: HumanoidSpec, tw: number): void {
  const { cx, torsoTop, hipY, team, facing } = body;
  const half = facing === 'side' ? 1 : Math.max(1, Math.round(tw * 0.42));
  const x0 = facing === 'side' ? cx + tw * 0.3 - 1 : cx - half;
  for (let y = Math.round(torsoTop + 1); y <= hipY + 1; y++) {
    for (let x = Math.round(x0); x <= Math.round(x0 + half * 2 - 1); x++) {
      const t = (x - x0) / Math.max(1, half * 2 - 1);
      px(img, x, y, shade(team, t < 0.34 ? 4 : t < 0.7 ? 3 : 2));
    }
  }
  // A gold trim at its hem.
  line(img, x0, hipY + 1, x0 + half * 2 - 1, hipY + 1, shade(RAMPS.gold, 2), 1);
}

/** A cape: hanging full down the back seen from behind, or peeking out round the body from the front and side. */
function drawCape(img: Img, body: Body, spec: HumanoidSpec, how: 'full' | 'peek'): void {
  const { cx, torsoTop, feet, team, facing, anim, frame } = body;
  const sway = anim === 'walk' ? (frame % 2 === 0 ? 1 : 0) : 0;
  const top = torsoTop + 0.5;
  const bottom = feet - 2 + sway;
  if (facing === 'side') {
    const back = cx - spec.torso.w * 0.7;
    poly(img, [
      [cx - 1, top],
      [back - 3 - sway, bottom],
      [back + 2, bottom],
      [cx + 1, top + 2],
    ], (x, y) => shade(team, x < back - 1 ? 1 : (y - top) / (bottom - top) < 0.3 ? 3 : 2));
    return;
  }
  const halfTop = spec.torso.w + 0.5;
  const halfBottom = spec.torso.w + 2.5;
  const shape: [number, number][] = [
    [cx - halfTop, top],
    [cx + halfTop, top],
    [cx + halfBottom, bottom],
    [cx - halfBottom, bottom],
  ];
  if (how === 'peek') {
    poly(img, shape, (x) => shade(team, x < cx ? 2 : 1));
    return;
  }
  poly(img, shape, (x, y) => {
    // Folds: darker bands, lit from the left.
    const fold = Math.floor((x - (cx - halfBottom)) / 2.5) % 2 === 0;
    const t = (x - (cx - halfBottom)) / (halfBottom * 2);
    const base = t < 0.3 ? 4 : t < 0.65 ? 3 : 2;
    return shade(team, fold ? base : base - 1) + (y < 0 ? 0 : 0);
  });
  // A dark hem and a clasp line at the shoulders.
  line(img, cx - halfBottom + 0.5, bottom, cx + halfBottom - 0.5, bottom, shade(team, 1), 1);
  line(img, cx - halfTop, top, cx + halfTop, top, shade(RAMPS.gold, 2), 1);
}

function drawHead(img: Img, spec: HumanoidSpec, body: Body): void {
  const { cx, headY, facing, team } = body;
  const r = spec.head;
  const side3 = facing === 'side';
  const hx = cx + (side3 ? 0.8 : 0);
  const gear = spec.gear;
  const eyes = (color = INK): void => {
    if (facing === 'down') {
      px(img, hx - r * 0.42, headY + 0.6, color);
      px(img, hx - r * 0.42, headY + 1.6, color);
      px(img, hx + r * 0.36, headY + 0.6, color);
      px(img, hx + r * 0.36, headY + 1.6, color);
    } else if (side3) {
      px(img, hx + r * 0.5, headY + 0.6, color);
      px(img, hx + r * 0.5, headY + 1.6, color);
    }
  };
  const skinHead = (): void => {
    ball(img, hx, headY, r, r * 0.95, spec.skin, 0.05);
    if (facing === 'down') {
      // Rosy cheeks.
      px(img, hx - r * 0.65, headY + 2.2, mix(shade(spec.skin, 3), 0xe0605a, 0.45));
      px(img, hx + r * 0.6, headY + 2.2, mix(shade(spec.skin, 2), 0xe0605a, 0.45));
    }
  };
  const beard = (): void => {
    if (spec.beard === undefined || facing === 'up') {
      return;
    }
    const bx = side3 ? hx + r * 0.35 : hx;
    ball(img, bx, headY + r * 0.75, side3 ? r * 0.55 : r * 0.8, r * 0.6, spec.beard);
  };
  switch (gear.kind) {
    case 'greathelm': {
      ball(img, hx, headY, r + 0.4, r + 0.2, gear.ramp, 0.08);
      if (facing === 'down') {
        line(img, hx - r * 0.65, headY + 0.6, hx + r * 0.6, headY + 0.6, INK, 1);
        line(img, hx, headY + 0.6, hx, headY + 2.8, INK, 1);
        px(img, hx - r * 0.5, headY - 0.4, shade(gear.ramp, 4));
      } else if (side3) {
        line(img, hx + 0.5, headY + 0.6, hx + r + 0.4, headY + 0.6, INK, 1);
        line(img, hx + r * 0.55, headY + 1.6, hx + r * 0.9, headY + 1.6, shade(gear.ramp, 1), 1);
      } else {
        line(img, hx, headY - r, hx, headY + r * 0.6, shade(gear.ramp, 1), 1);
      }
      // A rim at the neck.
      line(img, hx - r * 0.7, headY + r * 0.85, hx + r * 0.7, headY + r * 0.85, shade(gear.ramp, 1), 1);
      if (gear.plume) {
        const tilt = side3 ? -1.6 : 0;
        ball(img, hx + tilt, headY - r - 1.2, 1.5, 2.6, team, 0.1);
        ball(img, hx + tilt * 1.8, headY - r - 0.2, 1.3, 1.8, team, -0.05);
      }
      return;
    }
    case 'sallet': {
      skinHead();
      eyes();
      beard();
      // A rounded helmet down to the brow, a tail at the back, and a tall plume.
      ball(img, hx - (side3 ? 0.6 : 0), headY - r * 0.35, r + 0.6, r * 0.75, gear.ramp, 0.08);
      line(img, hx - r - 0.2, headY + 0.2, hx + r + 0.2, headY + 0.2, shade(gear.ramp, 1), 1);
      const lean = side3 ? -2 : facing === 'up' ? 0 : 0.5;
      ball(img, hx + lean, headY - r - 1.8, 1.6, 3, team, 0.1);
      ball(img, hx + lean * 2, headY - r - 4, 1.1, 1.8, team, 0.15);
      return;
    }
    case 'hood': {
      ball(img, hx, headY - 0.3, r + 0.7, r + 0.5, gear.ramp, 0.06);
      if (facing === 'down') {
        ball(img, hx, headY + 0.9, r * 0.72, r * 0.62, spec.skin, -0.25);
        // The hood's brow shades the eyes.
        line(img, hx - r * 0.65, headY - 0.1, hx + r * 0.65, headY - 0.1, shade(gear.ramp, 1), 1);
        eyes();
      } else if (side3) {
        ball(img, hx + r * 0.55, headY + 0.9, r * 0.45, r * 0.6, spec.skin, -0.2);
        px(img, hx + r * 0.65, headY + 0.6, INK);
      } else {
        // The hood's point, falling down the back.
        capsule(img, hx, headY + r * 0.4, hx, headY + r + 2, 1.4, gear.ramp);
      }
      return;
    }
    case 'straw': {
      skinHead();
      eyes();
      beard();
      const brimY = headY - r * 0.35;
      ball(img, hx, brimY, r + 3, side3 ? 1.3 : 1.7, RAMPS.sand, 0.1);
      ball(img, hx, brimY - 1.6, r * 0.75, r * 0.6, RAMPS.sand, 0.05);
      // Its band is the team's.
      line(img, hx - r * 0.72, brimY - 0.9, hx + r * 0.72, brimY - 0.9, shade(team, 3), 1);
      return;
    }
    case 'horned': {
      ball(img, hx, headY, r + 0.4, r + 0.2, gear.ramp, 0.08);
      for (const dir of side3 ? [1] : [-1, 1]) {
        const bx = hx + dir * r * (side3 ? 0.2 : 0.75);
        capsule(img, bx, headY - r * 0.4, bx + dir * 2.2, headY - r - 1.2, 1.1, RAMPS.bone, 0.1);
        capsule(img, bx + dir * 2.2, headY - r - 1.2, bx + dir * 2.6, headY - r - 3, 0.6, RAMPS.bone, 0.2);
      }
      if (facing === 'down') {
        // A glowing visor slit.
        line(img, hx - r * 0.55, headY + 0.8, hx + r * 0.55, headY + 0.8, INK, 2);
        px(img, hx - r * 0.35, headY + 0.8, shade(RAMPS.fire, 4));
        px(img, hx + r * 0.3, headY + 0.8, shade(RAMPS.fire, 4));
      } else if (side3) {
        line(img, hx + 0.5, headY + 0.8, hx + r + 0.4, headY + 0.8, INK, 2);
        px(img, hx + r * 0.65, headY + 0.8, shade(RAMPS.fire, 4));
      }
      return;
    }
    case 'kettle': {
      skinHead();
      eyes();
      beard();
      const brimY = headY - r * 0.2;
      ball(img, hx, brimY, r + 2, 1.3, gear.ramp, 0.12);
      ball(img, hx, brimY - 1.5, r * 0.85, r * 0.65, gear.ramp, 0.05);
      if (facing !== 'up') {
        // Goggles pushed up on the brim.
        const gx = side3 ? hx + r * 0.4 : hx;
        ball(img, gx - (side3 ? 0 : 1.3), brimY - 0.4, 1.1, 1, RAMPS.magic, 0.3);
        if (!side3) {
          ball(img, gx + 1.3, brimY - 0.4, 1.1, 1, RAMPS.magic, 0.3);
        }
      }
      return;
    }
    case 'bandana': {
      skinHead();
      if (facing === 'up') {
        ball(img, hx, headY - 0.2, r, r * 0.9, gear.hair, 0);
      }
      eyes();
      beard();
      ball(img, hx, headY - r * 0.45, r + 0.3, r * 0.55, team, 0.05);
      if (facing !== 'down') {
        // The knot's tails.
        const kx = side3 ? hx - r : hx;
        capsule(img, kx, headY - r * 0.3, kx - 2, headY + 1.5, 0.7, team);
      }
      return;
    }
  }
}

/** One step darker along the same ramp, for parts in shadow. */
function darker(ramp: Ramp): Ramp {
  return [ramp[0] ?? INK, ...ramp.slice(0, -1)];
}
