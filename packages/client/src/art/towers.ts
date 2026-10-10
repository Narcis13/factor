// Towers: the Outpost (a round stone tower with a heavy crossbow on top) and the Keep (a square castle
// keep with a cannon). Drawn in parts: the body (whole, cracked, or rubble once fallen), the weapon on
// top (which turns to its target and recoils), and a flag that waves; the Keep's cannon sleeps under a
// tarp while it is dormant.
import type { Side, TowerKind } from '@factor/sim';
import { INK, RAMPS, TEAM, mix, shade, type Ramp } from './color.ts';
import { FACINGS, type Facing, type Frame } from './frame.ts';
import { ball, capsule, fill, image, line, litIndex, outline, oval, poly, px, rect, scatter, type Img } from './image.ts';

export interface TowerArt {
  /** Standing, cracked (under half hp), and fallen. Anchored at the footprint's center. */
  body: Frame;
  cracked: Frame;
  rubble: Frame;
  /** The weapon: at rest (by facing) and firing (4 frames by facing). Anchored at its pivot. */
  turret: Record<Facing, Frame>;
  firing: Record<Facing, Frame[]>;
  /** The Keep's weapon under a tarp while it sleeps. */
  asleep: Frame | null;
  /** Where the pivot sits, from the body's anchor. */
  turretAt: [number, number];
  /** Four frames of a waving flag, anchored at the pole's foot, and where it stands. */
  flag: Frame[];
  flagAt: [number, number];
  /** The furled flag of a sleeping Keep. */
  furled: Frame | null;
}

export function towerArt(kind: TowerKind, side: Side): TowerArt {
  return kind === 'keep' ? keepArt(side) : outpostArt(side);
}

function done(img: Img, ax: number, ay: number): Frame {
  outline(img);
  return { img, ax, ay };
}

/** A round wall's shading by its x across it: lit left, shadowed right, courses of stone. */
function roundWall(img: Img, cx: number, top: number, bottom: number, r: number, ramp: Ramp, seed: number): void {
  const rand = scatter(seed);
  const flecks = new Set<number>();
  for (let i = 0; i < 40; i++) {
    flecks.add(Math.floor(rand() * 4096));
  }
  fill(img, cx - r, top, cx + r, bottom, (x, y) => {
    const nx = (x - cx) / r;
    if (Math.abs(nx) > 1) {
      return null;
    }
    // The bottom edge curves with the cylinder.
    if (y > bottom - (1 - Math.sqrt(1 - nx * nx)) * 0 - 3 + Math.sqrt(1 - nx * nx) * 3) {
      return null;
    }
    const course = Math.floor((y - top) / 4);
    const u = Math.asin(nx) / Math.PI + 0.5;
    const brick = Math.floor(u * 14 + (course % 2) * 0.5);
    const mortar = (y - top) % 4 < 1 || Math.abs(u * 14 + (course % 2) * 0.5 - brick) < 0.12;
    const lit = litIndex(ramp, nx, 0, Math.sqrt(1 - nx * nx), 0.05);
    const fleck = flecks.has((Math.floor(x) * 31 + Math.floor(y) * 7) % 4096) ? 1 : 0;
    return shade(ramp, mortar ? lit - 1 : lit + (fleck && lit < ramp.length - 1 ? 0 : 0));
  });
}

/** A crenellated rim: an ellipse of stone with merlons standing on its back and front edges. */
function parapet(img: Img, cx: number, cy: number, rx: number, ry: number, ramp: Ramp): void {
  // The walkway inside.
  oval(img, cx, cy, rx, ry, shade(ramp, 2));
  oval(img, cx, cy + 0.5, rx - 2.5, ry - 2, shade(ramp, 1));
  // Merlons round the edge: the back ones first.
  const count = 10;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const mx = cx + Math.cos(a) * (rx - 1.5);
    const my = cy + Math.sin(a) * (ry - 1);
    if (Math.sin(a) < 0) {
      rect(img, mx - 1.5, my - 3, 3, 3, shade(ramp, 3));
      px(img, mx - 1.5, my - 3, shade(ramp, 4));
    }
  }
  // The front lip of the parapet, a band of wall.
  fill(img, cx - rx, cy, cx + rx, cy + ry + 3, (x, y) => {
    const nx = (x - cx) / rx;
    if (Math.abs(nx) > 1) {
      return null;
    }
    const edge = cy + Math.sqrt(1 - nx * nx) * ry;
    if (y < edge - 1 || y > edge + 3) {
      return null;
    }
    return shade(ramp, litIndex(ramp, nx, 0.2, Math.sqrt(1 - nx * nx), 0.1));
  });
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + 0.3;
    if (Math.sin(a) <= 0.15) {
      continue;
    }
    const mx = cx + Math.cos(a) * (rx - 1);
    const my = cy + Math.sin(a) * ry;
    rect(img, mx - 1.5, my - 3, 3, 3, shade(ramp, Math.cos(a) < 0 ? 4 : 3));
  }
}

/** A hanging banner in the team's colors with a gold emblem. */
function banner(img: Img, x: number, y: number, width: number, height: number, team: Ramp, emblem: 'crown' | 'chevron'): void {
  poly(img, [[x, y], [x + width, y], [x + width, y + height], [x + width / 2, y + height - 3], [x, y + height]], (bx) => shade(team, bx < x + width * 0.35 ? 4 : bx < x + width * 0.7 ? 3 : 2));
  line(img, x - 1, y, x + width + 1, y, shade(RAMPS.wood, 3), 1);
  const cx = x + width / 2;
  const gold = shade(RAMPS.gold, 3);
  if (emblem === 'crown') {
    rect(img, cx - 2, y + 5, 5, 2, gold);
    px(img, cx - 2, y + 4, gold);
    px(img, cx, y + 3, gold);
    px(img, cx + 2, y + 4, gold);
    px(img, cx, y + 4, shade(RAMPS.gold, 4));
  } else {
    line(img, cx - 2, y + 4, cx, y + 6, gold, 1);
    line(img, cx, y + 6, cx + 2, y + 4, gold, 1);
  }
}

function flagFrames(team: Ramp, length: number): Frame[] {
  return [0, 1, 2, 3].map((frame) => {
    const img = image(length + 6, 20);
    line(img, 1, 19, 1, 1, shade(RAMPS.wood, 3), 1);
    px(img, 1, 0, shade(RAMPS.gold, 4));
    for (let x = 0; x < length; x++) {
      const wave = Math.round(Math.sin((x / length) * Math.PI * 1.6 - frame * (Math.PI / 2)) * 1.2 * (x / length));
      for (let y = 0; y < 6; y++) {
        const tail = x > length - 3 && y >= 2 && y <= 3 && x > length - 2;
        if (!tail) {
          px(img, 2 + x, 2 + y + wave, shade(team, y < 2 ? 4 : y < 4 ? 3 : 2));
        }
      }
    }
    return done(img, 1, 19);
  });
}

function furledFlag(team: Ramp): Frame {
  const img = image(6, 20);
  line(img, 1, 19, 1, 1, shade(RAMPS.wood, 3), 1);
  px(img, 1, 0, shade(RAMPS.gold, 4));
  capsule(img, 2.5, 3, 2.5, 9, 1, team);
  return done(img, 1, 19);
}

/** Cracks over a body: dark zigzags and a few fallen stones. */
function crack(img: Img, seed: number, x0: number, y0: number, x1: number, y1: number): void {
  const rand = scatter(seed);
  for (let n = 0; n < 4; n++) {
    let x = x0 + rand() * (x1 - x0);
    let y = y0 + rand() * (y1 - y0) * 0.5;
    for (let s = 0; s < 6; s++) {
      const nx = x + (rand() - 0.5) * 4;
      const ny = y + 1 + rand() * 2.5;
      if (img.data[(Math.floor(ny) * img.width + Math.floor(nx)) * 4 + 3] === 0) {
        break;
      }
      line(img, x, y, nx, ny, INK, 1, 0.8);
      x = nx;
      y = ny;
    }
  }
}

/** A heap of broken stone and beams where a tower stood, the team's banner torn in it. */
function rubble(width: number, height: number, ax: number, ay: number, span: number, team: Ramp, seed: number): Frame {
  const img = image(width, height);
  const rand = scatter(seed);
  oval(img, ax, ay + 2, span, span * 0.55, shade(RAMPS.dirt, 1));
  oval(img, ax, ay + 2, span - 3, span * 0.55 - 3, shade(RAMPS.dirt, 0));
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * span * 0.8;
    const x = ax + Math.cos(a) * d;
    const y = ay + Math.sin(a) * d * 0.5 - (1 - d / span) * 6;
    const r = 1.5 + rand() * 3;
    ball(img, x, y, r * 1.2, r, RAMPS.stone, 0.1);
  }
  // A broken beam and the torn banner.
  capsule(img, ax - span * 0.5, ay - 2, ax + span * 0.2, ay - 8, 1.2, RAMPS.wood);
  poly(img, [[ax + 2, ay - 5], [ax + 8, ay - 6], [ax + 7, ay - 1], [ax + 3, ay]], (x) => shade(team, x < ax + 5 ? 3 : 2));
  return done(img, ax, ay);
}

// --- Outpost: footprint 48 × 48 art pixels.

function outpostArt(side: Side): TowerArt {
  const team = TEAM[side];
  const W = 60;
  const H = 88;
  const ax = 30;
  const ay = 62;
  const body = image(W, H);
  // A ring of flagstones it stands on.
  oval(body, ax, ay + 8, 22, 11, shade(RAMPS.stone, 1));
  oval(body, ax, ay + 7, 20, 9.5, shade(RAMPS.stone, 2));
  // The tower: a stone drum.
  const r = 15;
  const wallTop = 30;
  const wallBottom = ay + 12;
  roundWall(body, ax, wallTop, wallBottom, r, RAMPS.stone, side + 7);
  // A plinth course at its foot.
  fill(body, ax - r - 1, wallBottom - 6, ax + r + 1, wallBottom, (x, y) => {
    const nx = (x - ax) / (r + 1);
    if (Math.abs(nx) > 1 || y > wallBottom - 3 + Math.sqrt(1 - nx * nx) * 3) {
      return null;
    }
    return shade(RAMPS.stone, Math.max(1, litIndex(RAMPS.stone, nx, 0.3, Math.sqrt(1 - nx * nx)) - 1));
  });
  // The door and an arrow slit.
  poly(body, [[ax - 4, wallBottom - 2], [ax - 4, wallBottom - 10], [ax, wallBottom - 13], [ax + 4, wallBottom - 10], [ax + 4, wallBottom - 2]], (x, y) => (y > wallBottom - 11 && Math.round(x - ax) % 3 === 0 ? shade(RAMPS.wood, 1) : shade(RAMPS.wood, 2)));
  px(body, ax + 2, wallBottom - 6, shade(RAMPS.gold, 3));
  rect(body, ax - 1, wallTop + 12, 2, 5, INK);
  // A banner down the front.
  banner(body, ax - 9, wallTop + 3, 6, 15, team, 'chevron');
  banner(body, ax + 4, wallTop + 3, 6, 15, team, 'chevron');
  // The parapet.
  parapet(body, ax, wallTop - 1, r + 4, 7, RAMPS.stone);
  // Corbels under the parapet.
  for (let x = ax - r; x <= ax + r; x += 3) {
    const nx = (x - ax) / (r + 4);
    const y = wallTop - 1 + Math.sqrt(Math.max(0, 1 - nx * nx)) * 7 + 3;
    px(body, x, y, shade(RAMPS.stone, 1));
  }
  const cracked = copyFrame(body);
  crack(cracked, side * 13 + 1, ax - r + 2, wallTop + 4, ax + r - 2, wallBottom - 4);
  const turret = {} as Record<Facing, Frame>;
  const firing = {} as Record<Facing, Frame[]>;
  for (const facing of FACINGS) {
    turret[facing] = crossbow(facing, 0, team);
    firing[facing] = [0, 1, 2, 3].map((frame) => crossbow(facing, frame, team));
  }
  return {
    body: done(body, ax, ay),
    cracked: done(cracked, ax, ay),
    rubble: rubble(W, H, ax, ay, 22, team, side + 3),
    turret,
    firing,
    asleep: null,
    turretAt: [0, wallTop - 1 - ay],
    flag: flagFrames(team, 9),
    flagAt: [r + 1, wallTop - 1 - ay],
    furled: null,
  };
}

/** The Outpost's heavy crossbow and its crewman's helmet, by facing, on frame 0 (rest) to 3 of a shot. */
function crossbow(facing: Facing, frame: number, team: Ramp): Frame {
  const img = image(28, 26);
  const cx = 14;
  const cy = 16;
  const recoil = [0, 0, 2, 1][frame] ?? 0;
  const loaded = frame !== 2 && frame !== 3;
  // The pivot post.
  ball(img, cx, cy + 2, 3, 1.8, RAMPS.iron, 0.1);
  if (facing === 'side') {
    capsule(img, cx - 6 - recoil, cy - 1, cx + 6 - recoil, cy - 1, 1.4, RAMPS.wood);
    capsule(img, cx + 5 - recoil, cy - 6, cx + 5 - recoil, cy + 3, 1, RAMPS.steel);
    const sx = loaded ? cx - 2 - recoil : cx + 4 - recoil;
    line(img, cx + 5 - recoil, cy - 6, sx, cy - 1, shade(RAMPS.rope, 3), 1);
    line(img, cx + 5 - recoil, cy + 3, sx, cy - 1, shade(RAMPS.rope, 3), 1);
    if (loaded) {
      line(img, sx, cy - 1.5, cx + 9 - recoil, cy - 1.5, shade(RAMPS.steel, 4), 1);
    }
    if (frame === 2) {
      ball(img, cx + 11, cy - 1.5, 2, 1.5, RAMPS.fire, 0.4);
    }
    return done(img, cx, cy);
  }
  const dir = facing === 'down' ? 1 : -1;
  capsule(img, cx, cy - 1 - dir * (3 + recoil), cx, cy - 1 + dir * (4 - recoil), 1.6, RAMPS.wood);
  const bowY = cy - 1 + dir * (2 - recoil);
  capsule(img, cx - 7, bowY, cx + 7, bowY, 1, RAMPS.steel);
  const stringY = bowY - dir * (loaded ? 4 : 1);
  line(img, cx - 7, bowY, cx, stringY, shade(RAMPS.rope, 3), 1);
  line(img, cx + 7, bowY, cx, stringY, shade(RAMPS.rope, 3), 1);
  if (loaded) {
    line(img, cx, stringY, cx, bowY + dir * 3, shade(RAMPS.steel, 4), 1);
  }
  // A team pennant on the stock.
  px(img, cx, cy - 1 - dir * (3 + recoil), shade(team, 4));
  if (frame === 2) {
    ball(img, cx, bowY + dir * 5, 2, 2, RAMPS.fire, 0.4);
  }
  return done(img, cx, cy);
}

// --- Keep: footprint 64 × 64 art pixels.

function keepArt(side: Side): TowerArt {
  const team = TEAM[side];
  const W = 80;
  const H = 104;
  const ax = 40;
  const ay = 72;
  const body = image(W, H);
  oval(body, ax, ay + 12, 33, 13, shade(RAMPS.stone, 1));
  oval(body, ax, ay + 11, 31, 11.5, shade(RAMPS.stone, 2));
  const left = ax - 24;
  const right = ax + 24;
  const roofTop = 26;
  const roofDepth = 20;
  const wallBottom = ay + 18;
  // Front wall: courses of dressed stone, lit from the left.
  fill(body, left, roofTop + roofDepth, right - 1, wallBottom - 1, (x, y) => {
    const course = Math.floor((y - roofTop - roofDepth) / 4);
    const mortar = (y - roofTop - roofDepth) % 4 < 1 || (x - left + (course % 2) * 3) % 6 < 1;
    const t = (x - left) / (right - left);
    return shade(RAMPS.stone, (mortar ? -1 : 0) + (t < 0.15 ? 4 : t < 0.8 ? 3 : 2));
  });
  // A plinth.
  rect(body, left - 1, wallBottom - 5, right - left + 2, 5, shade(RAMPS.stone, 2));
  line(body, left - 1, wallBottom - 5, right, wallBottom - 5, shade(RAMPS.stone, 4), 1);
  // Corner towers, round, standing proud of the wall.
  for (const tx of [left + 1, right - 1]) {
    roundWall(body, tx, roofTop + 8, wallBottom + 1, 6, RAMPS.stone, tx);
  }
  // The gate: an arch with a portcullis.
  poly(body, [[ax - 8, wallBottom - 4], [ax - 8, wallBottom - 16], [ax - 4, wallBottom - 20], [ax + 4, wallBottom - 20], [ax + 8, wallBottom - 16], [ax + 8, wallBottom - 4]], shade(RAMPS.stone, 0));
  poly(body, [[ax - 6, wallBottom - 4], [ax - 6, wallBottom - 15], [ax - 3, wallBottom - 18], [ax + 3, wallBottom - 18], [ax + 6, wallBottom - 15], [ax + 6, wallBottom - 4]], INK);
  for (let x = ax - 5; x <= ax + 5; x += 2) {
    line(body, x, wallBottom - 17, x, wallBottom - 5, shade(RAMPS.iron, 2), 1);
  }
  for (let y = wallBottom - 15; y <= wallBottom - 6; y += 3) {
    line(body, ax - 5, y, ax + 5, y, shade(RAMPS.iron, 2), 1);
  }
  // Keystone and banners either side of the gate.
  rect(body, ax - 1, wallBottom - 22, 3, 3, shade(RAMPS.gold, 3));
  banner(body, left + 9, roofTop + roofDepth + 3, 8, 20, team, 'crown');
  banner(body, right - 17, roofTop + roofDepth + 3, 8, 20, team, 'crown');
  // The roof: a flagstone deck, then crenels all round.
  fill(body, left, roofTop, right - 1, roofTop + roofDepth - 1, (x, y) => {
    const tile = (Math.floor((x - left) / 5) + Math.floor((y - roofTop) / 4)) % 2;
    return shade(RAMPS.stone, tile === 0 ? 2 : 1);
  });
  for (let x = left; x < right; x += 6) {
    rect(body, x, roofTop - 3, 4, 3, shade(RAMPS.stone, 3));
    px(body, x, roofTop - 3, shade(RAMPS.stone, 4));
  }
  line(body, left, roofTop, right - 1, roofTop, shade(RAMPS.stone, 0), 1);
  for (let x = left; x < right; x += 6) {
    rect(body, x, roofTop + roofDepth - 3, 4, 3, shade(RAMPS.stone, 4));
  }
  rect(body, left, roofTop + roofDepth, right - left, 2, shade(RAMPS.stone, 4));
  for (const y of [roofTop + 2, roofTop + 8, roofTop + 14]) {
    rect(body, left - 1, y, 3, 3, shade(RAMPS.stone, 4));
    rect(body, right - 2, y, 3, 3, shade(RAMPS.stone, 3));
  }
  // Corner tower caps: little cones in the team's color.
  for (const tx of [left + 1, right - 1]) {
    oval(body, tx, roofTop + 8, 6.5, 3, shade(RAMPS.stone, 3));
    poly(body, [[tx - 7, roofTop + 8], [tx, roofTop - 6], [tx + 7, roofTop + 8]], (x) => shade(team, x < tx - 1 ? 4 : x < tx + 2 ? 3 : 2));
    line(body, tx - 7, roofTop + 8, tx + 7, roofTop + 8, shade(RAMPS.gold, 2), 1);
    px(body, tx, roofTop - 7, shade(RAMPS.gold, 4));
  }
  const cracked = copyFrame(body);
  crack(cracked, side * 17 + 5, left + 2, roofTop + roofDepth + 2, right - 2, wallBottom - 6);
  const turret = {} as Record<Facing, Frame>;
  const firing = {} as Record<Facing, Frame[]>;
  for (const facing of FACINGS) {
    turret[facing] = cannon(facing, 0);
    firing[facing] = [0, 1, 2, 3].map((frame) => cannon(facing, frame));
  }
  return {
    body: done(body, ax, ay),
    cracked: done(cracked, ax, ay),
    rubble: rubble(W, H, ax, ay, 30, team, side + 11),
    turret,
    firing,
    asleep: sleepingCannon(team),
    turretAt: [0, roofTop + roofDepth / 2 - ay],
    flag: flagFrames(team, 11),
    flagAt: [-6, roofTop + 4 - ay],
    furled: furledFlag(team),
  };
}

/** The Keep's cannon on its carriage, by facing, recoiling over a shot's frames. */
function cannon(facing: Facing, frame: number): Frame {
  const img = image(32, 30);
  const cx = 16;
  const cy = 17;
  const recoil = [0, 0, 3, 1][frame] ?? 0;
  // Carriage.
  rect(img, cx - 6, cy - 1, 12, 5, shade(RAMPS.wood, 2));
  line(img, cx - 6, cy - 1, cx + 5, cy - 1, shade(RAMPS.wood, 4), 1);
  for (const wx of [cx - 6, cx + 5]) {
    ball(img, wx, cy + 3, 2.2, 2.2, RAMPS.wood, 0.1);
    px(img, wx, cy + 3, shade(RAMPS.iron, 1));
  }
  if (facing === 'side') {
    capsule(img, cx - 4 - recoil, cy - 2, cx + 7 - recoil, cy - 3, 2.6, RAMPS.iron, 0.1);
    ball(img, cx + 8 - recoil, cy - 3, 1.5, 2.6, RAMPS.iron, 0);
    oval(img, cx + 9 - recoil, cy - 3, 0.8, 1.6, INK);
    line(img, cx - 1 - recoil, cy - 5.5, cx - 1 - recoil, cy - 0.5, shade(RAMPS.gold, 2), 1);
    if (frame === 2) {
      ball(img, cx + 12, cy - 3, 3, 3, RAMPS.fire, 0.4);
    }
    return done(img, cx, cy);
  }
  const dir = facing === 'down' ? 1 : -1;
  const mouthY = cy - 2 + dir * (5 - recoil);
  capsule(img, cx, cy - 3 - dir * (3 + recoil), cx, mouthY, 3, RAMPS.iron, 0.1);
  ball(img, cx, mouthY, 3, 2, RAMPS.iron, 0);
  if (facing === 'down') {
    oval(img, cx, mouthY, 1.7, 1.2, INK);
  }
  line(img, cx - 2.5, cy - 2, cx + 2.5, cy - 2, shade(RAMPS.gold, 2), 1);
  if (frame === 2) {
    ball(img, cx, mouthY + dir * 4, 3, 3, RAMPS.fire, 0.4);
  }
  return done(img, cx, cy);
}

/** The cannon under a tarp in the team's color: the Keep sleeps. */
function sleepingCannon(team: Ramp): Frame {
  const img = image(32, 30);
  const cx = 16;
  const cy = 17;
  ball(img, cx, cy, 9, 6, team.map((c) => mix(c, 0x6a6470, 0.35)), 0.1);
  for (const x of [cx - 4, cx, cx + 4]) {
    line(img, x, cy - 5, x + 1, cy + 4, mix(shade(team, 1), INK, 0.3), 1);
  }
  line(img, cx - 8, cy + 2, cx + 8, cy + 2, shade(RAMPS.rope, 2), 1);
  return done(img, cx, cy);
}

function copyFrame(img: Img): Img {
  const out = image(img.width, img.height);
  out.data.set(img.data);
  return out;
}
