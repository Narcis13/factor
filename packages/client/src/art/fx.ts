// Effects and shots: hit sparks, death puffs, deploy dust, explosions, the spells (flare, meteor, spark),
// shock rings, scorch marks, muzzle flashes, a sleeping Keep's z's, and every projectile. Frames are
// anchored at their middle (a shot at its point, a meteor's fall at where it lands).
import type { Side } from '@factor/sim';
import { INK, RAMPS, TEAM, shade, type Ramp } from './color.ts';
import type { Frame } from './frame.ts';
import { ball, fill, image, line, outline, oval, px, ring, scatter, type Img } from './image.ts';
import { drawBomb } from './weapons.ts';

const TAU = Math.PI * 2;

function centered(img: Img): Frame {
  return { img, ax: Math.floor(img.width / 2), ay: Math.floor(img.height / 2) };
}

/** A soft round puff of smoke, dithered at its edge so it doesn't read as a hard disc. */
function smoke(img: Img, cx: number, cy: number, r: number, alpha: number, ramp: Ramp = RAMPS.smoke, lift = 0.25): void {
  fill(img, cx - r, cy - r, cx + r, cy + r, (x, y) => {
    const nx = (x - cx) / r;
    const ny = (y - cy) / r;
    const d = nx * nx + ny * ny;
    if (d > 1) {
      return null;
    }
    const light = -nx * 0.5 - ny * 0.7 + Math.sqrt(1 - d) * 0.5 + lift;
    return shade(ramp, light > 0.8 ? 5 : light > 0.45 ? 4 : light > 0.1 ? 3 : 2);
  }, alpha);
}

/** A billow of smoke: a few puffs heaped round (cx, cy), thinning to `alpha`. */
function cloud(img: Img, cx: number, cy: number, r: number, alpha: number, seed: number): void {
  const rand = scatter(seed);
  const puffs: [number, number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + rand() * 0.8;
    const d = r * (0.25 + rand() * 0.45);
    puffs.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7, r * (0.4 + rand() * 0.25)]);
  }
  puffs.sort((p, q) => p[1] - q[1]);
  for (const [x, y, pr] of puffs) {
    smoke(img, x, y, pr, alpha, RAMPS.smoke, -0.15);
  }
}

// --- Hit spark: 4 frames.

export function hitFrames(): Frame[] {
  return [0, 1, 2, 3].map((frame) => {
    const img = image(15, 15);
    const c = 7;
    const reach = [3, 5, 6, 6][frame] ?? 6;
    const core = [0xffffff, 0xfff4a6, 0xf5cf4c, 0xd6962a][frame] ?? 0xffffff;
    if (frame < 2) {
      oval(img, c, c, 2.5 - frame, 2.5 - frame, 0xffffff);
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + (frame % 2) * 0.4 + 0.3;
      const inner = frame >= 2 ? reach - 2 : 1;
      line(img, c + Math.cos(a) * inner, c + Math.sin(a) * inner, c + Math.cos(a) * reach, c + Math.sin(a) * reach, core, 1, frame === 3 ? 0.6 : 1);
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4 + 0.3;
      const r = reach * 0.6;
      px(img, c + Math.cos(a) * r, c + Math.sin(a) * r, core, frame === 3 ? 0.5 : 0.9);
    }
    return centered(img);
  });
}

// --- Death puff: 7 frames of smoke billowing out and thinning, a spirit spark rising from it.

export function puffFrames(size: number, side: Side): Frame[] {
  const team = TEAM[side];
  return [0, 1, 2, 3, 4, 5, 6].map((frame) => {
    const w = Math.ceil(size * 2.6) + 6;
    const img = image(w, w + 6);
    const c = w / 2;
    const t = frame / 6;
    const rand = scatter(91);
    const r = size * (0.5 + t * 0.7);
    for (let i = 0; i < 6; i++) {
      const a = rand() * TAU;
      const d = r * (0.3 + rand() * 0.5);
      smoke(img, c + Math.cos(a) * d, c + 3 + Math.sin(a) * d * 0.6 - t * 3, r * (0.45 + rand() * 0.25) * (1 - t * 0.35), 1 - t * 0.85);
    }
    if (frame < 2) {
      oval(img, c, c + 3, size * 0.6, size * 0.5, 0xffffff, 0.7 - frame * 0.3);
    }
    // A mote of the unit's color floats up out of the smoke.
    if (frame >= 1) {
      const y = c - t * size * 1.4;
      px(img, c, y, shade(team, 5), 1 - t * 0.6);
      px(img, c, y + 1, shade(team, 3), 1 - t * 0.6);
    }
    return centered(img);
  });
}

// --- Deploy: dust thrown up in a ring and the team's sparkles: 8 frames.

export function deployFrames(radius: number, side: Side): Frame[] {
  const team = TEAM[side];
  return [0, 1, 2, 3, 4, 5, 6, 7].map((frame) => {
    const w = Math.ceil(radius * 3.4) + 8;
    const img = image(w, Math.ceil(w * 0.9));
    const cx = w / 2;
    const cy = img.height / 2 + 2;
    const t = frame / 7;
    const r = radius * (0.7 + t * 0.9);
    ring(img, cx, cy, r, r * 0.45, 1.5, shade(RAMPS.sand, 4), 0.85 * (1 - t));
    const rand = scatter(5 + frame);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + 0.2;
      smoke(img, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.45 - t * 2, 1.6 + (1 - t) * 1.5, 0.7 * (1 - t), RAMPS.sand);
    }
    // A column of light while it lands.
    if (frame < 4) {
      for (let y = 0; y < cy; y++) {
        const a = (1 - y / cy) * 0.15 + 0.35 * (1 - frame / 4) * (y / cy);
        line(img, cx - radius * 0.6, y, cx + radius * 0.6, y, shade(team, 5), 1, a);
      }
    }
    for (let i = 0; i < 5; i++) {
      const sx = cx + (rand() - 0.5) * radius * 2.4;
      const sy = cy - rand() * radius * 2.2 - t * 6;
      const color = shade(team, 5);
      px(img, sx, sy, color, 1 - t);
      if (frame % 2 === 0) {
        px(img, sx - 1, sy, color, 0.6 * (1 - t));
        px(img, sx + 1, sy, color, 0.6 * (1 - t));
        px(img, sx, sy - 1, color, 0.6 * (1 - t));
        px(img, sx, sy + 1, color, 0.6 * (1 - t));
      }
    }
    return centered(img);
  });
}

// --- Explosion: a fireball that blooms, then rolls into smoke, embers flying: 9 frames.

export function explosionFrames(radius: number): Frame[] {
  return [0, 1, 2, 3, 4, 5, 6, 7, 8].map((frame) => {
    const w = Math.ceil(radius * 2.6) + 8;
    const img = image(w, w);
    const c = w / 2;
    const t = frame / 8;
    const rand = scatter(41);
    // A shockwave ring racing out to the blast's reach.
    if (frame <= 4) {
      const r = radius * (0.4 + frame * 0.16);
      ring(img, c, c + 1, r, r * 0.6, 1.5, 0xfff4c0, 0.8 - frame * 0.15);
    }
    if (frame === 0) {
      oval(img, c, c, radius * 0.55, radius * 0.5, 0xffffff);
      oval(img, c, c, radius * 0.75, radius * 0.7, 0xfff7c0, 0.6);
      return centered(img);
    }
    // Smoke takes over as the fire burns down.
    const blobs = 9;
    for (let i = 0; i < blobs; i++) {
      const a = rand() * TAU;
      const d = radius * (0.15 + rand() * 0.45) * (0.6 + t * 0.6);
      const x = c + Math.cos(a) * d;
      const y = c + Math.sin(a) * d * 0.7 - t * radius * 0.35;
      const r = radius * (0.35 + rand() * 0.2) * (1 - t * 0.2);
      if (t > 0.3) {
        smoke(img, x, y, r * (0.8 + t * 0.4), Math.min(1, 1.4 - t), RAMPS.smoke, -0.15 - t * 0.2);
      }
      if (t < 0.75) {
        const fire = RAMPS.fire;
        const heat = 1 - t;
        fill(img, x - r, y - r, x + r, y + r, (px0, py0) => {
          const nx = (px0 - x) / (r * heat);
          const ny = (py0 - y) / (r * heat);
          const d2 = nx * nx + ny * ny;
          if (d2 > 1) {
            return null;
          }
          const level = (1 - d2) * 3 + heat * 2.4 - 0.4 - ny * 0.5;
          return shade(fire, Math.max(1, Math.min(5, level)));
        });
      }
    }
    // Embers.
    for (let i = 0; i < 10; i++) {
      const a = rand() * TAU;
      const d = radius * (0.5 + t * 0.9) * (0.6 + rand() * 0.5);
      if (frame >= 2 && frame <= 7) {
        px(img, c + Math.cos(a) * d, c + Math.sin(a) * d * 0.7 - frame, shade(RAMPS.fire, 4 - Math.floor(t * 3)));
      }
    }
    return centered(img);
  });
}

// --- Flare: a blossom of flame across the whole area, tongues licking outward: 9 frames.

export function flareFrames(radius: number): Frame[] {
  const fire = RAMPS.fire;
  return [0, 1, 2, 3, 4, 5, 6, 7, 8].map((frame) => {
    const w = Math.ceil(radius * 2.3) + 8;
    const tall = Math.ceil(radius * 1.2);
    const img = image(w, w + tall);
    const c = w / 2;
    const cy = w / 2 + tall;
    const t = frame / 8;
    const rand = scatter(17);
    // The ground glows where the fire has passed.
    const reach = radius * Math.min(1, 0.3 + t * 1.6);
    oval(img, c, cy, reach, reach * 0.6, shade(fire, 2), 0.35 * (1 - t));
    oval(img, c, cy, reach * 0.7, reach * 0.42, shade(fire, 3), 0.3 * (1 - t));
    // A fireball rising out of the middle, rolling into smoke.
    const rise = t * radius * 0.8;
    const ball0 = radius * (0.45 - t * 0.15);
    if (t > 0.35) {
      cloud(img, c, cy - rise - ball0 * 0.4, ball0 * (0.8 + t * 0.5), Math.min(0.9, 1.5 - t), 23);
    }
    if (t < 0.7) {
      fill(img, c - ball0, cy - rise - ball0, c + ball0, cy - rise + ball0, (x, y) => {
        const dx = (x - c) / ball0;
        const dy = (y - (cy - rise)) / ball0;
        const d = dx * dx + dy * dy;
        if (d > 1) {
          return null;
        }
        return shade(fire, Math.min(5, (1 - d) * 4 + (1 - t) * 1.6 - dy * 0.6));
      });
    }
    // Tongues of flame licking up all round the sweeping edge, back ones first.
    const tongues = 16;
    const order = Array.from({ length: tongues }, (_, i) => (i / tongues) * TAU + rand() * 0.2).sort((a, b) => Math.sin(a) - Math.sin(b));
    for (const a of order) {
      const height = radius * (0.35 + rand() * 0.25) * Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.95 + 0.15);
      if (height < 2) {
        continue;
      }
      flameTongue(img, c + Math.cos(a) * reach, cy + Math.sin(a) * reach * 0.6, height, 2.2 + radius * 0.06, frame + Math.round(a * 3));
    }
    // Embers drifting up.
    for (let i = 0; i < 16; i++) {
      const a = rand() * TAU;
      const d = rand() * reach;
      px(img, c + Math.cos(a) * d, cy + Math.sin(a) * d * 0.6 - t * radius * 0.7 - rand() * 6, shade(fire, 3 + (i % 3)), 1 - t * 0.6);
    }
    if (frame === 0) {
      oval(img, c, cy, radius * 0.55, radius * 0.38, 0xffffff, 0.95);
      oval(img, c, cy - 4, radius * 0.3, radius * 0.4, 0xfff7c0, 0.9);
    }
    return { img, ax: Math.floor(c), ay: Math.floor(cy) };
  });
}

/** A lick of flame standing on (x, y): white-hot at its root, red at its flickering tip. */
function flameTongue(img: Img, x: number, y: number, height: number, width: number, seed: number): void {
  const fire = RAMPS.fire;
  const sway = ((seed % 5) - 2) * 0.25;
  for (let dy = 0; dy <= height; dy++) {
    const u = dy / height;
    const half = width * Math.pow(1 - u, 0.8) * (u < 0.15 ? 0.7 + u * 2 : 1);
    const cx = x + sway * dy * 0.5 + Math.sin(u * 6 + seed) * 0.6;
    for (let dx = -Math.ceil(half); dx <= Math.ceil(half); dx++) {
      if (Math.abs(dx) > half) {
        continue;
      }
      const edge = Math.abs(dx) / Math.max(0.5, half);
      const heat = (1 - u) * 4.4 - edge * 1.6 + 0.6;
      px(img, cx + dx, y - dy, shade(fire, Math.max(1, Math.min(5, heat))));
    }
  }
}

// --- Meteor: a burning rock falls in from the upper right (4 frames), then a heavy impact (9 frames).

export function meteorFallFrames(): Frame[] {
  return [0, 1, 2, 3].map((frame) => {
    const img = image(80, 96);
    // Anchor at the landing point, bottom-left of the image.
    const ax = 16;
    const ay = 88;
    const t = (frame + 1) / 5;
    const x = ax + (1 - t) * 52;
    const y = ay - (1 - t) * 78;
    // The trail: fire thinning to smoke behind.
    for (let i = 10; i >= 0; i--) {
      const tx = x + i * 4;
      const ty = y - i * 6;
      if (i > 6) {
        smoke(img, tx, ty, 3 + i * 0.25, 0.5 - (i - 6) * 0.1);
      } else {
        oval(img, tx, ty, 4.5 - i * 0.4, 4.5 - i * 0.4, shade(RAMPS.fire, 5 - Math.floor(i / 2)), 0.9);
      }
    }
    ball(img, x, y, 5, 5, RAMPS.stone, -0.1);
    ball(img, x - 1, y + 1, 3, 3, RAMPS.ember, 0.4);
    px(img, x - 2, y - 2, shade(RAMPS.fire, 5));
    outline(img, { strength: 0.6 });
    return { img, ax, ay };
  });
}

/** A burnt patch where something landed hard; the renderer fades it out. */
export function scorchImage(radius: number): Frame {
  const w = Math.ceil(radius * 2) + 4;
  const img = image(w, Math.ceil(w * 0.75));
  const cx = w / 2;
  const cy = img.height / 2;
  const rand = scatter(radius);
  fill(img, 0, 0, w - 1, img.height - 1, (x, y) => {
    const dx = (x - cx) / radius;
    const dy = (y - cy) / (radius * 0.7);
    const d = Math.sqrt(dx * dx + dy * dy) + (rand() - 0.5) * 0.15;
    if (d > 1) {
      return null;
    }
    return d < 0.35 ? 0x1c1414 : d < 0.7 ? 0x2c2018 : 0x3e3020;
  });
  for (let i = 0; i < 6; i++) {
    px(img, cx + (rand() - 0.5) * radius, cy + (rand() - 0.5) * radius * 0.6, shade(RAMPS.fire, 3));
  }
  return { img, ax: Math.floor(cx), ay: Math.floor(cy) };
}

// --- Spark: lightning strikes all over the area, crackling arcs: 7 frames.

export function sparkFrames(radius: number): Frame[] {
  return [0, 1, 2, 3, 4, 5, 6].map((frame) => {
    const w = Math.ceil(radius * 2.3) + 8;
    const top = 40;
    const img = image(w, w + top);
    const c = w / 2;
    const cy = c + top;
    const t = frame / 6;
    const bolt = RAMPS.bolt;
    const rand = scatter(frame < 3 ? 3 : 4);
    // The area lights up blue.
    oval(img, c, cy, radius * (0.8 + t * 0.25), radius * 0.62 * (0.8 + t * 0.25), shade(bolt, 2), 0.35 * (1 - t));
    ring(img, c, cy, radius * (0.75 + t * 0.3), radius * 0.6 * (0.75 + t * 0.3), 1, shade(bolt, 3), 0.9 * (1 - t));
    // Bolts from the sky to points in the area.
    if (frame < 5) {
      const strikes = 4;
      for (let s = 0; s < strikes; s++) {
        const a = (s / strikes) * TAU + (frame >= 3 ? 0.7 : 0) + rand() * 0.6;
        const d = s === 0 ? 0 : radius * (0.35 + rand() * 0.45);
        const gx = c + Math.cos(a) * d;
        const gy = cy + Math.sin(a) * d * 0.62;
        let x = gx + (rand() - 0.5) * 8;
        let y = 0;
        while (y < gy) {
          const nx = gx + (x - gx) * 0.6 + (rand() - 0.5) * 7;
          const ny = Math.min(gy, y + 5 + rand() * 6);
          line(img, x, y, nx, ny, shade(bolt, 3), 3, 0.5);
          line(img, x, y, nx, ny, frame % 2 === 0 ? 0xffffff : shade(bolt, 4), 1);
          x = nx;
          y = ny;
        }
        oval(img, gx, gy, 3, 2, 0xffffff, 0.9);
        // Little arcs crackling off the strike.
        for (let k = 0; k < 3; k++) {
          const b = rand() * TAU;
          line(img, gx, gy, gx + Math.cos(b) * 5, gy + Math.sin(b) * 3, shade(bolt, 4), 1);
        }
      }
    }
    return { img, ax: Math.floor(c), ay: Math.floor(cy) };
  });
}

// --- Shock: a ground-shaking ring of dust, for a heavy melee splash: 6 frames.

export function shockFrames(radius: number): Frame[] {
  return [0, 1, 2, 3, 4, 5].map((frame) => {
    const w = Math.ceil(radius * 2.3) + 8;
    const img = image(w, Math.ceil(w * 0.8));
    const c = w / 2;
    const cy = img.height / 2;
    const t = frame / 5;
    const r = radius * (0.4 + t * 0.6);
    ring(img, c, cy, r, r * 0.55, 2, shade(RAMPS.sand, 4), 0.9 * (1 - t));
    ring(img, c, cy, r - 2, r * 0.55 - 1.5, 1, 0xffffff, 0.7 * (1 - t));
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      smoke(img, c + Math.cos(a) * r, cy + Math.sin(a) * r * 0.55 - t * 3, 2 + t * 2, 0.6 * (1 - t), RAMPS.sand);
    }
    return centered(img);
  });
}

// --- Muzzle flash: 3 frames.

export function muzzleFrames(): Frame[] {
  return [0, 1, 2].map((frame) => {
    const img = image(13, 13);
    const r = [5, 4, 3][frame] ?? 3;
    oval(img, 6, 6, r, r, shade(RAMPS.fire, 4 - frame), 0.95);
    oval(img, 6, 6, r - 2, r - 2, 0xfff7c0);
    if (frame > 0) {
      smoke(img, 6, 5, r, 0.5);
    }
    return centered(img);
  });
}

// --- A sleeping Keep's z's, drifting up: 4 frames.

export function zzzFrames(): Frame[] {
  return [0, 1, 2, 3].map((frame) => {
    const img = image(16, 22);
    const z = (x: number, y: number, size: number, alpha: number): void => {
      line(img, x, y, x + size, y, 0xffffff, 1, alpha);
      line(img, x + size, y, x, y + size, 0xffffff, 1, alpha);
      line(img, x, y + size, x + size, y + size, 0xffffff, 1, alpha);
    };
    z(2 + frame * 0.5, 16 - frame * 2, 3, 1 - frame * 0.2);
    z(7 + frame * 0.5, 10 - frame * 2, 4, frame < 3 ? 0.9 : 0.4);
    outline(img, { strength: 0.9 });
    return { img, ax: 2, ay: 20 };
  });
}

// --- Shots. Directional ones come in 16 angles, 0 pointing right and going clockwise.

export const SHOT_DIRECTIONS = 16;

export type ShotKind = 'bolt' | 'arrow' | 'stone' | 'dart' | 'orb' | 'cannonball' | 'bomb';

/** A shot's frames: one per direction for a directional shot, else its animation frames. */
export function shotFrames(kind: ShotKind, side: Side): Frame[] {
  const team = TEAM[side];
  switch (kind) {
    case 'bolt':
    case 'arrow':
    case 'dart':
      return Array.from({ length: SHOT_DIRECTIONS }, (_, i) => arrow(kind, (i / SHOT_DIRECTIONS) * TAU, team));
    case 'stone':
      return [0, 1].map((frame) => {
        const img = image(7, 7);
        ball(img, 3, 3, 1.8, 1.6, RAMPS.stone, frame * 0.2);
        outline(img, { strength: 0.7 });
        return centered(img);
      });
    case 'cannonball':
      return [0].map(() => {
        const img = image(9, 9);
        ball(img, 4, 4, 2.6, 2.6, RAMPS.iron, 0.15);
        px(img, 3, 3, shade(RAMPS.steel, 4));
        outline(img);
        return centered(img);
      });
    case 'orb':
      return [0, 1].map((frame) => {
        const glow = side === 0 ? RAMPS.magic : RAMPS.fire;
        const img = image(11, 11);
        oval(img, 5, 5, 4.5, 4.5, shade(glow, 3), 0.35);
        ball(img, 5, 5, 2.4 + frame * 0.3, 2.4 + frame * 0.3, glow, 0.5);
        px(img, 4, 4, 0xffffff);
        return centered(img);
      });
    case 'bomb':
      return [0, 1, 2, 3].map((frame) => {
        const img = image(13, 15);
        drawBomb(img, 6, 9, 3, frame);
        outline(img);
        return { img, ax: 6, ay: 9 };
      });
  }
}

function arrow(kind: 'bolt' | 'arrow' | 'dart', angle: number, team: Ramp): Frame {
  const length = kind === 'bolt' ? 9 : kind === 'arrow' ? 8 : 6;
  const img = image(19, 19);
  const c = 9;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const tail: [number, number] = [c - (dx * length) / 2, c - (dy * length) / 2];
  const head: [number, number] = [c + (dx * length) / 2, c + (dy * length) / 2];
  // A faint streak behind it.
  line(img, tail[0] - dx * 4, tail[1] - dy * 4, tail[0], tail[1], 0xffffff, 1, 0.25);
  line(img, tail[0], tail[1], head[0], head[1], shade(kind === 'bolt' ? RAMPS.iron : RAMPS.wood, 3), kind === 'bolt' ? 2 : 1);
  px(img, head[0], head[1], shade(RAMPS.steel, 4));
  px(img, head[0] - dx, head[1] - dy, shade(RAMPS.steel, 3));
  // Fletching in the team's color.
  const fx = tail[0] + dx;
  const fy = tail[1] + dy;
  px(img, fx - dy, fy + dx, shade(team, 4));
  px(img, fx + dy, fy - dx, shade(team, 3));
  px(img, tail[0], tail[1], shade(team, 3));
  outline(img, { strength: 0.75 });
  return centered(img);
}

/** A ground shadow for something `radius` pixels round: a soft dark ellipse. */
export function shadowImage(radius: number): Frame {
  const rx = Math.max(2, radius);
  const ry = Math.max(1.5, radius * 0.45);
  const img = image(Math.ceil(rx * 2) + 2, Math.ceil(ry * 2) + 2);
  const cx = img.width / 2;
  const cy = img.height / 2;
  oval(img, cx, cy, rx, ry, INK, 0.3);
  oval(img, cx, cy, rx * 0.75, ry * 0.7, INK, 0.2);
  return { img, ax: Math.floor(cx), ay: Math.floor(cy) };
}

