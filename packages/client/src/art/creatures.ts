// Units that aren't people: the hive's mites, wisps, the harrier (a hawk and its rider), the charger (an
// armored war-ram) and the airship. Each draws itself per facing, animation and frame.
import type { Side } from '@factor/sim';
import { INK, RAMPS, TEAM, shade, type Ramp } from './color.ts';
import { ANIMS, FACINGS, FRAME_COUNT, type Anim, type Facing, type Frame, type UnitFrames } from './frame.ts';
import { ball, capsule, image, line, outline, oval, poly, px, rect, type Img } from './image.ts';
import { drawBomb } from './weapons.ts';

type Draw = (img: Img, facing: Facing, anim: Anim, frame: number, team: Ramp) => void;

/** Every animation and facing of a drawing, outlined, hanging from (ax, ay). */
export function frameSet(width: number, height: number, ax: number, ay: number, side: Side, draw: Draw, options: { outline?: boolean } = {}): UnitFrames {
  const frames = {} as UnitFrames;
  for (const anim of ANIMS) {
    frames[anim] = {} as Record<Facing, Frame[]>;
    for (const facing of FACINGS) {
      frames[anim][facing] = Array.from({ length: FRAME_COUNT[anim] }, (_, frame) => {
        const img = image(width, height);
        draw(img, facing, anim, frame, TEAM[side]);
        if (options.outline !== false) {
          outline(img);
        }
        return { img, ax, ay };
      });
    }
  }
  return frames;
}

const D = Math.PI / 180;

// --- Mite: a beetle the size of a cat, its shell striped in its side's color.

export function miteFrames(side: Side): UnitFrames {
  return frameSet(30, 26, 15, 19, side, (img, facing, anim, frame, team) => {
    const cx = 15;
    const ground = 19;
    const step = anim === 'walk' ? frame % 2 : 0;
    const lunge = anim === 'attack' ? [0, -1, 2, 1][frame] ?? 0 : 0;
    const bob = anim === 'idle' ? frame : 0;
    if (facing === 'side') {
      const by = ground - 4 + bob;
      for (const [i, x] of [-3, 0, 3].entries()) {
        const swing = (i + step) % 2 === 0 ? 1 : -1;
        line(img, cx + x, by + 1, cx + x + swing, ground - 0.5, shade(RAMPS.shell, 1), 1);
      }
      ball(img, cx - 0.5, by, 5.2, 3.4, RAMPS.shell, 0.1);
      line(img, cx - 5, by - 1.5, cx + 3.5, by - 2.5, shade(team, 3), 1);
      ball(img, cx + 5 + lunge, by + 0.5, 2.2, 2, RAMPS.shell, 0.15);
      px(img, cx + 6 + lunge, by, shade(team, 4));
      line(img, cx + 6.5 + lunge, by - 1.5, cx + 9 + lunge, by - 4.5, shade(RAMPS.shell, 2), 1);
      const open = anim === 'attack' && frame === 2 ? 1 : 0;
      px(img, cx + 7.5 + lunge, by + 1.5 + open, shade(RAMPS.bone, 3));
      px(img, cx + 7.5 + lunge, by + 0.5 - open, shade(RAMPS.bone, 3));
      return;
    }
    const front = facing === 'down';
    const by = ground - 5 + bob;
    const headY = front ? by + 4 + lunge : by - 4 - lunge;
    // Legs, three a side, alternating.
    for (const [i, y] of [-2, 0, 2].entries()) {
      const swing = (i + step) % 2 === 0 ? 1 : -1;
      for (const dir of [-1, 1]) {
        line(img, cx + dir * 3, by + y, cx + dir * 6.5, by + y + 1.5 + swing * dir * 0.5, shade(RAMPS.shell, 1), 1);
      }
    }
    if (!front) {
      ball(img, cx, headY, 2.2, 1.8, RAMPS.shell, 0.15);
      line(img, cx - 1, headY - 1, cx - 3, headY - 4, shade(RAMPS.shell, 2), 1);
      line(img, cx + 1, headY - 1, cx + 3, headY - 4, shade(RAMPS.shell, 2), 1);
    }
    ball(img, cx, by, 4.6, 4.2, RAMPS.shell, 0.1);
    // The shell's seam and spots in the team's color.
    line(img, cx, by - 4, cx, by + 3.5, shade(RAMPS.shell, 0), 1);
    px(img, cx - 2, by - 1, shade(team, 4));
    px(img, cx + 2, by - 1, shade(team, 3));
    px(img, cx - 2, by + 1, shade(team, 3));
    px(img, cx + 2, by + 1, shade(team, 2));
    px(img, cx - 2, by - 3, shade(RAMPS.shell, 4));
    if (front) {
      ball(img, cx, headY, 2.4, 2, RAMPS.shell, 0.15);
      px(img, cx - 1, headY, shade(team, 4));
      px(img, cx + 1, headY, shade(team, 4));
      const open = anim === 'attack' && frame === 2 ? 1 : 0;
      px(img, cx - 2 - open, headY + 2, shade(RAMPS.bone, 3));
      px(img, cx + 2 + open, headY + 2, shade(RAMPS.bone, 3));
    }
  });
}

const SPARKLE_X = [5, -5, 4, -4];
const SPARKLE_Y = [-4, 2, 4, -5];

// --- Wisps: little spirits of light, blue or ember-red by side, trailing a flame.

export function wispFrames(side: Side): UnitFrames {
  const glow: Ramp = side === 0 ? RAMPS.magic : RAMPS.fire;
  return frameSet(
    20,
    26,
    10,
    23,
    side,
    (img, facing, anim, frame, team) => {
      const cx = 10;
      const cy = 11 + (anim === 'idle' ? frame : anim === 'walk' ? (frame === 1 ? -1 : frame === 3 ? 1 : 0) : 0);
      const flare = anim === 'attack' && frame === 2;
      // The tail streams away from where it's heading.
      const tail: [number, number] = facing === 'down' ? [0, -1] : facing === 'up' ? [0, 1] : [-1, 0];
      for (let i = 4; i >= 1; i--) {
        const wave = Math.sin((frame + i) * 1.7) * 0.9;
        const tx = cx + tail[0] * i * 1.6 + (tail[0] === 0 ? wave : 0);
        const ty = cy + tail[1] * i * 1.6 + (tail[1] === 0 ? wave : 0);
        oval(img, tx, ty, 3.2 - i * 0.55, 3.2 - i * 0.55, shade(glow, 5 - i), 0.55 + 0.1 * (4 - i));
      }
      // A soft halo, then the bright core.
      oval(img, cx, cy, flare ? 6 : 5, flare ? 6 : 5, shade(glow, 3), 0.25);
      ball(img, cx, cy, 3.6, 3.6, glow, 0.35);
      oval(img, cx - 0.8, cy - 0.8, 1.6, 1.6, 0xffffff, 0.85);
      if (facing !== 'up') {
        const look = facing === 'side' ? 1.2 : 0;
        px(img, cx - 1 + look, cy + 0.5, shade(team, 0));
        px(img, cx + 1 + look, cy + 0.5, shade(team, 0));
      }
      if (flare) {
        for (const a of [0, 60, 120, 180, 240, 300]) {
          const dx = Math.cos(a * D);
          const dy = Math.sin(a * D);
          line(img, cx + dx * 5, cy + dy * 5, cx + dx * 7.5, cy + dy * 7.5, shade(glow, 5), 1, 0.9);
        }
      }
      if (anim === 'attack' && frame === 1) {
        oval(img, cx, cy, 5.5, 5.5, shade(glow, 5), 0.35);
      }
      // Sparkles round it.
      const sparkle = (frame * 3 + (anim === 'walk' ? 1 : 0)) % 4;
      px(img, cx + (SPARKLE_X[sparkle] ?? 0), cy + (SPARKLE_Y[sparkle] ?? 0), shade(glow, 5));
    },
    { outline: false },
  );
}

// --- Harrier: a great hawk, a hooded rider on its back throwing darts.

export function harrierFrames(side: Side): UnitFrames {
  return frameSet(40, 36, 20, 33, side, (img, facing, anim, frame, team) => {
    const cx = 20;
    const flap = anim === 'attack' ? [1, 0, 2, 1][frame] ?? 1 : anim === 'walk' ? frame : frame * 2;
    // Wing tip height by flap phase: up, level, down, level.
    const tip = [-6, -1, 4, -1][flap % 4] ?? 0;
    const cy = 16 + (anim === 'walk' ? (flap % 4 === 2 ? 1 : 0) : 0);
    const feather = RAMPS.feather;
    const wing = (dir: number, far: boolean): void => {
      const ramp = far ? ([feather[0], ...feather.slice(0, -1)] as Ramp) : feather;
      const root: [number, number] = [cx + dir * 2.5, cy - 1];
      const elbow: [number, number] = [cx + dir * 9, cy - 2 + tip * 0.5];
      const end: [number, number] = [cx + dir * 15, cy + tip];
      poly(img, [root, elbow, end, [cx + dir * 12, cy + 3 + tip * 0.6], [cx + dir * 4, cy + 3]], (x, y) => {
        const along = Math.abs(x - cx) / 15;
        return shade(ramp, along > 0.75 ? 1 : y < cy + tip * 0.5 ? 4 : 3);
      });
      // Flight feathers: dark bands toward the tip.
      for (let i = 0; i < 3; i++) {
        const fx = cx + dir * (10 + i * 2);
        line(img, fx, cy + tip * (0.6 + i * 0.15), fx - dir * 1, cy + 3 + tip * 0.6, shade(ramp, 1), 1);
      }
      // A band of the team's color across the wing.
      line(img, root[0] + dir * 3, root[1] + 1, elbow[0], elbow[1] + 1, shade(team, 3), 1);
    };
    if (facing === 'side') {
      wing(-1, true);
      ball(img, cx - 1, cy + 1, 7, 4, feather, 0.1);
      // Tail.
      poly(img, [[cx - 6, cy], [cx - 12, cy - 2], [cx - 12, cy + 3], [cx - 6, cy + 3]], shade(feather, 2));
      // Head and hooked beak.
      const lean = anim === 'attack' && frame === 2 ? 2 : 0;
      ball(img, cx + 6 + lean, cy - 2, 3, 2.8, RAMPS.linen, 0.1);
      poly(img, [[cx + 8.5 + lean, cy - 3], [cx + 11.5 + lean, cy - 1.5], [cx + 9 + lean, cy]], shade(RAMPS.gold, 3));
      px(img, cx + 7 + lean, cy - 3, INK);
      drawRider(img, cx - 1, cy - 4, 'side', anim, frame, team);
      wing(1, false);
      line(img, cx, cy + 5, cx + 1, cy + 7, shade(RAMPS.gold, 2), 1);
      return;
    }
    const front = facing === 'down';
    wing(-1, false);
    wing(1, false);
    if (front) {
      poly(img, [[cx - 3, cy - 3], [cx + 3, cy - 3], [cx + 4, cy - 9], [cx - 4, cy - 9]], shade(feather, 2));
      ball(img, cx, cy, 5, 5.5, feather, 0.1);
      drawRider(img, cx, cy - 4, 'down', anim, frame, team);
      const lean = anim === 'attack' && frame === 2 ? 1 : 0;
      ball(img, cx, cy + 4 + lean, 3, 2.7, RAMPS.linen, 0.1);
      px(img, cx - 1.5, cy + 3.5 + lean, INK);
      px(img, cx + 1.5, cy + 3.5 + lean, INK);
      poly(img, [[cx - 1.2, cy + 5 + lean], [cx + 1.2, cy + 5 + lean], [cx, cy + 7.5 + lean]], shade(RAMPS.gold, 3));
    } else {
      ball(img, cx, cy - 4, 2.6, 2.3, RAMPS.linen, 0.1);
      ball(img, cx, cy, 5, 5.5, feather, 0.1);
      poly(img, [[cx - 3, cy + 3], [cx + 3, cy + 3], [cx + 4.5, cy + 10], [cx - 4.5, cy + 10]], (x) => shade(feather, x < cx ? 3 : 2));
      line(img, cx, cy + 4, cx, cy + 9, shade(feather, 1), 1);
      drawRider(img, cx, cy - 2, 'up', anim, frame, team);
    }
  });
}

/** A small hooded rider in the team's colors, throwing a dart on the strike. */
function drawRider(img: Img, x: number, y: number, facing: Facing, anim: Anim, frame: number, team: Ramp): void {
  ball(img, x, y + 1, 2.6, 2.2, team, 0.05);
  ball(img, x + (facing === 'side' ? 0.5 : 0), y - 2.2, 2.4, 2.3, team, 0.1);
  if (facing === 'down') {
    ball(img, x, y - 1.6, 1.5, 1.2, RAMPS.skin, -0.1);
    px(img, x - 0.6, y - 1.6, INK);
    px(img, x + 0.8, y - 1.6, INK);
  } else if (facing === 'side') {
    ball(img, x + 1.6, y - 1.8, 0.9, 1.2, RAMPS.skin, -0.1);
  }
  const raise = anim === 'attack' && frame === 1;
  const thrown = anim === 'attack' && frame >= 2;
  const hand: [number, number] = facing === 'side' ? (raise ? [x - 1, y - 4] : [x + 3, y]) : raise ? [x + 3, y - 4] : [x + 3, y + 1];
  capsule(img, x + 1.5, y, hand[0], hand[1], 0.7, team);
  if (!thrown) {
    const angle = facing === 'side' ? (raise ? -150 : -30) : raise ? -80 : -60;
    line(img, hand[0], hand[1], hand[0] + Math.cos(angle * D) * 4, hand[1] + Math.sin(angle * D) * 4, shade(RAMPS.wood, 3), 1);
    px(img, hand[0] + Math.cos(angle * D) * 4.5, hand[1] + Math.sin(angle * D) * 4.5, shade(RAMPS.steel, 4));
  }
}

// --- Charger: an armored war-ram that runs down buildings.

export function chargerFrames(side: Side): UnitFrames {
  return frameSet(54, 44, 27, 35, side, (img, facing, anim, frame, team) => {
    const cx = 27;
    const ground = 35;
    const wool = RAMPS.linen;
    const legs = RAMPS.skinDark.slice(0, 4);
    const farLegs = RAMPS.skinDark.slice(0, 3);
    const gallop = anim === 'walk' ? frame : 0;
    const butt = anim === 'attack' ? ([0, -2, 3, 1][frame] ?? 0) : 0;
    const bob = anim === 'walk' ? (gallop % 2 === 1 ? -1 : 0) : anim === 'idle' ? frame : 0;
    const by = ground - 10 + bob;
    const hoof = (x: number, y: number, far: boolean): void => {
      rect(img, x - 1, y - 1, 3, 2, shade(RAMPS.wood, far ? 0 : 1));
    };
    if (facing === 'side') {
      // Legs: the far pair darker, galloping in a four-beat.
      const reach = ([[3, -3], [0, 0], [-3, 3], [0, 0]] as const)[gallop] ?? [0, 0];
      const placed: [number, number, boolean][] = [
        [cx - 7, -reach[0], true],
        [cx + 5, -reach[1], true],
        [cx - 6, reach[0], false],
        [cx + 6, reach[1], false],
      ];
      for (const [x, swing, far] of placed) {
        capsule(img, x, by + 3, x + swing, ground - 1.5, 1.4, far ? farLegs : legs);
        hoof(x + swing, ground - 1, far);
      }
      // A woolly body, the team's barding over its back trimmed in gold, and a steel saddle plate.
      woolly(img, cx - 1, by, 10, 6.2, wool);
      poly(img, [[cx - 8, by - 5], [cx + 6, by - 5.5], [cx + 7.5, by + 3.5], [cx - 9, by + 3.5]], (x, y) => shade(team, y < by - 3 ? 4 : x < cx ? 3 : 2));
      line(img, cx - 9, by + 3.5, cx + 7.5, by + 3.5, shade(RAMPS.gold, 3), 1);
      for (const tx of [cx - 6, cx - 1, cx + 4]) {
        poly(img, [[tx - 1.5, by + 3.5], [tx + 1.5, by + 3.5], [tx, by + 5.5]], shade(team, 2));
      }
      ball(img, cx - 1, by - 5.5, 3.2, 1.6, RAMPS.steel, 0.2);
      woolly(img, cx - 11, by - 2, 2, 2.2, wool);
      // The head: low and forward, a long bony muzzle, and a great curled horn.
      const hx = cx + 11 + butt;
      const hy = by + 1 + (butt > 0 ? 1 : 0);
      ball(img, hx + 1, hy + 1.5, 3.6, 2.4, RAMPS.bone, 0.1);
      ball(img, hx - 1, hy - 0.5, 3.4, 3.2, RAMPS.bone, 0.1);
      px(img, hx + 4, hy + 2, INK);
      px(img, hx, hy - 1, INK);
      line(img, hx - 2, hy - 3.5, hx + 2.5, hy - 1, shade(RAMPS.steel, 4), 1);
      curl(img, hx - 2.5, hy - 1, 1, 3.6);
      if (anim === 'attack' && frame === 2) {
        for (const dy of [-4, 0, 4]) {
          line(img, hx + 7, hy + dy, hx + 10, hy + dy * 1.3, 0xffffff, 1, 0.8);
        }
      }
      return;
    }
    const legSwing = anim === 'walk' ? (gallop % 2 === 0 ? 1 : -1) : 0;
    if (facing === 'down') {
      // Hind legs peeking out behind, the body, then the front legs, and the head before it all.
      for (const dir of [-1, 1]) {
        capsule(img, cx + dir * 6, by, cx + dir * 6, ground - 2.5 - (dir === legSwing ? 1 : 0), 1.3, farLegs);
      }
      woolly(img, cx, by - 3, 9, 6, wool);
      // Barding over the shoulders, falling down both flanks.
      poly(img, [[cx - 9, by - 5], [cx + 9, by - 5], [cx + 9.5, by + 1], [cx + 6, by + 2.5], [cx - 6, by + 2.5], [cx - 9.5, by + 1]], (x, y) => shade(team, y < by - 3 ? 4 : x < cx ? 3 : 2));
      line(img, cx - 9.5, by + 1, cx - 6, by + 2.5, shade(RAMPS.gold, 3), 1);
      line(img, cx + 9.5, by + 1, cx + 6, by + 2.5, shade(RAMPS.gold, 3), 1);
      ball(img, cx, by - 7, 3, 1.4, RAMPS.steel, 0.2);
      for (const dir of [-1, 1]) {
        const lift = dir === -legSwing ? 1 : 0;
        capsule(img, cx + dir * 3.5, by + 2, cx + dir * 3.5, ground - 1.5 - lift, 1.5, legs);
        hoof(cx + dir * 3.5, ground - 1 - lift, false);
      }
      const hy = by + 1 + butt;
      ball(img, cx, hy, 3.6, 3.4, RAMPS.bone, 0.1);
      ball(img, cx, hy + 3.2, 2.6, 2, RAMPS.bone, 0.15);
      px(img, cx - 1, hy + 4.5, INK);
      px(img, cx + 1, hy + 4.5, INK);
      px(img, cx - 2, hy, INK);
      px(img, cx + 2, hy, INK);
      line(img, cx, hy - 3, cx, hy - 0.5, shade(RAMPS.steel, 4), 1);
      curl(img, cx - 3.5, hy - 1.5, -1, 3.4);
      curl(img, cx + 3.5, hy - 1.5, 1, 3.4);
      if (anim === 'attack' && frame === 2) {
        for (const dx of [-5, 0, 5]) {
          line(img, cx + dx, hy + 7, cx + dx * 1.3, hy + 10, 0xffffff, 1, 0.8);
        }
      }
      return;
    }
    // From behind: horns over the back, the barded rump, the tail and the hind legs.
    const hy = by - 8 - butt;
    ball(img, cx, hy, 3.2, 2.6, RAMPS.bone, 0.1);
    curl(img, cx - 3, hy, -1, 3);
    curl(img, cx + 3, hy, 1, 3);
    for (const dir of [-1, 1]) {
      const lift = dir === legSwing ? 1 : 0;
      capsule(img, cx + dir * 5, by + 2, cx + dir * 5, ground - 1.5 - lift, 1.5, legs);
      hoof(cx + dir * 5, ground - 1 - lift, false);
    }
    woolly(img, cx, by - 1, 8.5, 6.5, wool);
    poly(img, [[cx - 7.5, by - 6], [cx + 7.5, by - 6], [cx + 8.5, by + 2], [cx - 8.5, by + 2]], (x, y) => shade(team, y < by - 3 ? 4 : x < cx ? 3 : 2));
    line(img, cx - 8.5, by + 2, cx + 8.5, by + 2, shade(RAMPS.gold, 3), 1);
    ball(img, cx, by - 6, 3, 1.4, RAMPS.steel, 0.2);
    woolly(img, cx, by + 4, 2, 2, wool);
  });
}

/** Wool: a shaded ellipse with a curly, bumpy edge. */
function woolly(img: Img, cx: number, cy: number, rx: number, ry: number, ramp: Ramp): void {
  ball(img, cx, cy, rx, ry, ramp, 0.1);
  const bumps = Math.max(6, Math.round(rx * 1.4));
  for (let i = 0; i < bumps; i++) {
    const a = (i / bumps) * Math.PI * 2;
    ball(img, cx + Math.cos(a) * rx * 0.85, cy + Math.sin(a) * ry * 0.85, 1.7, 1.5, ramp, 0.15);
  }
}

/** A ram's horn curling round from (x, y) toward `dir` (1 right, -1 left), `size` pixels across. */
function curl(img: Img, x: number, y: number, dir: number, size: number): void {
  let prev: [number, number] | null = null;
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const a = -Math.PI / 2 + t * Math.PI * 1.7;
    const r = size * (1 - t * 0.55);
    const point: [number, number] = [x + dir * (Math.cos(a) * r + size * 0.6), y + Math.sin(a) * r];
    if (prev !== null) {
      capsule(img, prev[0], prev[1], point[0], point[1], 1.4 - t * 0.6, RAMPS.bronze, 0.15);
    }
    prev = point;
  }
}

// --- Airship: a striped balloon over a wooden gondola, a propeller astern, bombs in the hold.

export function airshipFrames(side: Side): UnitFrames {
  return frameSet(48, 52, 24, 49, side, (img, facing, anim, frame, team) => {
    const cx = 24;
    const bob = anim === 'idle' ? frame : anim === 'walk' ? (frame === 1 || frame === 2 ? 1 : 0) : 0;
    const gy = 33 + bob;
    const by = 15 + bob;
    const prop = frame % 2;
    // Rigging.
    for (const dx of [-6, -2, 2, 6]) {
      line(img, cx + dx * 1.5, by + 8, cx + dx, gy - 2, shade(RAMPS.rope, 1), 1);
    }
    const propeller = (x: number, y: number, vertical: boolean): void => {
      ball(img, x, y, 1.4, 1.4, RAMPS.iron, 0.1);
      if (vertical) {
        line(img, x, y - 4 + prop * 2, x, y + 4 - prop * 2, shade(RAMPS.wood, 3), 2, 0.85);
      } else {
        line(img, x - 4 + prop * 2, y, x + 4 - prop * 2, y, shade(RAMPS.wood, 3), 2, 0.85);
      }
    };
    if (facing === 'up') {
      propeller(cx, gy + 4, false);
    }
    // Gondola.
    const long = facing === 'side';
    const half = long ? 9 : 6.5;
    poly(img, [[cx - half - 1, gy - 2], [cx + half + 1, gy - 2], [cx + half - 1, gy + 3], [cx - half + 1, gy + 3]], (x, y) => shade(RAMPS.wood, y < gy ? 4 : x < cx ? 3 : 2));
    line(img, cx - half - 1, gy - 2, cx + half + 1, gy - 2, shade(RAMPS.wood, 1), 1);
    line(img, cx - half + 1, gy + 1, cx + half - 1, gy + 1, shade(team, 3), 1);
    if (long) {
      propeller(cx - half - 3, gy, true);
      // A tail fin.
      poly(img, [[cx - 12, by + 1], [cx - 17, by - 4], [cx - 17, by + 5]], (x) => shade(team, x < cx - 15 ? 2 : 3));
    }
    // The hold opens and a bomb drops.
    if (anim === 'attack' && frame >= 1) {
      const drop = [0, 2, 7, 12][frame] ?? 0;
      if (frame < 3) {
        drawBomb(img, cx, gy + 4 + drop, 2.3, frame);
      } else {
        oval(img, cx, gy + 4, 2.5, 1, INK, 0.7);
      }
    }
    // The balloon: the team's stripes, lit from the left.
    const rx = long ? 15 : 12;
    const ry = 10;
    ball(img, cx, by, rx, ry, RAMPS.linen, 0.05);
    const stripes = 5;
    for (let y = Math.floor(by - ry); y <= by + ry; y++) {
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - by) / ry;
        if (nx * nx + ny * ny > 1) {
          continue;
        }
        // Stripes run pole to pole, bending with the balloon's curve.
        const u = Math.asin(Math.max(-1, Math.min(1, nx / Math.sqrt(Math.max(0.05, 1 - ny * ny)))));
        const band = Math.floor(((u / Math.PI + 0.5) * stripes * 2)) % 2;
        if (band === 0) {
          const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
          const lit = -0.5 * nx - 0.6 * ny + 0.6 * nz;
          px(img, x, y, shade(team, lit > 0.75 ? 5 : lit > 0.4 ? 4 : lit > 0 ? 3 : 2));
        }
      }
    }
    // A highlight and the load ring at its bottom.
    oval(img, cx - rx * 0.45, by - ry * 0.5, 2, 1.5, 0xffffff, 0.6);
    line(img, cx - rx * 0.55, by + ry - 1.5, cx + rx * 0.55, by + ry - 1.5, shade(RAMPS.rope, 2), 1);
    if (facing === 'down') {
      propeller(cx, gy - 5, false);
    }
  });
}
