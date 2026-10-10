// Buildings: the bastion (a stone platform with a ballista that turns to its target and recoils as it
// shoots) and the hive (a honeycomb mound that swells as it breeds mites).
import type { Side } from '@factor/sim';
import { INK, RAMPS, shade, type Ramp } from './color.ts';
import type { Facing, UnitFrames } from './frame.ts';
import { ball, capsule, fill, line, litIndex, oval, poly, px, rect, type Img } from './image.ts';
import { frameSet } from './creatures.ts';

/** A stone block seen from above and in front: its top face, then its front face. */
export function stoneBlock(img: Img, x: number, y: number, width: number, depth: number, height: number, top: Ramp, front: Ramp): void {
  // Top face, with mortar lines.
  fill(img, x, y, x + width - 1, y + depth - 1, (px0, py0) => {
    const row = Math.floor((py0 - y) / 3);
    const edge = (py0 - y) % 3 < 1 || (px0 - x + (row % 2) * 2) % 4 < 1;
    return shade(top, edge ? 2 : py0 - y < 2 ? 4 : 3);
  });
  // Front face, darker, with courses of stone.
  fill(img, x, y + depth, x + width - 1, y + depth + height - 1, (px0, py0) => {
    const row = Math.floor((py0 - y - depth) / 3);
    const edge = (py0 - y - depth) % 3 < 1 || (px0 - x + (row % 2) * 3) % 5 < 1;
    const t = (px0 - x) / width;
    return shade(front, edge ? 1 : t < 0.2 ? 3 : 2);
  });
}

// --- Bastion.

export function bastionFrames(side: Side): UnitFrames {
  return frameSet(34, 38, 17, 33, side, (img, facing, anim, frame, team) => {
    const cx = 17;
    // The platform: an octagonal-ish stone drum.
    const top = 18;
    stoneBlock(img, cx - 9, top, 18, 9, 6, RAMPS.stone, RAMPS.stone);
    // Team banners on the front face.
    for (const bx of [cx - 6, cx + 4]) {
      rect(img, bx, top + 9, 3, 5, shade(team, 3));
      px(img, bx + 1, top + 13, shade(team, 2));
      px(img, bx, top + 9, shade(team, 4));
      line(img, bx - 1, top + 9, bx + 3, top + 9, shade(RAMPS.gold, 3), 1);
    }
    // Crenels on the rim.
    for (const mx of [cx - 9, cx - 3, cx + 3]) {
      rect(img, mx, top - 2, 3, 2, shade(RAMPS.stone, 4));
      px(img, mx + 2, top - 1, shade(RAMPS.stone, 2));
    }
    rect(img, cx + 7, top - 2, 2, 2, shade(RAMPS.stone, 3));
    // The ballista on its pivot.
    const pull = anim === 'attack' ? [0, 1, -2, -1][frame] ?? 0 : 0;
    drawBallista(img, cx, top + 3, facing, pull, anim === 'attack' && frame !== 2, team);
  });
}

function drawBallista(img: Img, cx: number, cy: number, facing: Facing, pull: number, loaded: boolean, team: Ramp): void {
  ball(img, cx, cy + 1, 3.5, 2, RAMPS.iron, 0.1);
  if (facing === 'side') {
    // Stock pointing right, bow across it at the front.
    capsule(img, cx - 5 + pull, cy - 2, cx + 6 + pull, cy - 2, 1.3, RAMPS.wood);
    capsule(img, cx + 4 + pull, cy - 7, cx + 4 + pull, cy + 2, 1, RAMPS.wood);
    line(img, cx + 4 + pull, cy - 7, cx - 1 + pull * 2, cy - 2, shade(RAMPS.rope, 3), 1);
    line(img, cx + 4 + pull, cy + 2, cx - 1 + pull * 2, cy - 2, shade(RAMPS.rope, 3), 1);
    if (loaded) {
      line(img, cx - 1 + pull * 2, cy - 2.5, cx + 8 + pull, cy - 2.5, shade(RAMPS.steel, 4), 1);
    }
    px(img, cx - 4 + pull, cy - 3, shade(team, 4));
    return;
  }
  const dir = facing === 'down' ? 1 : -1;
  // Stock pointing toward or away from the viewer: short, foreshortened.
  capsule(img, cx, cy - 2 - dir * pull, cx, cy - 2 + dir * (5 - pull), 1.5, RAMPS.wood);
  const bowY = cy - 2 + dir * (3 - pull);
  capsule(img, cx - 7, bowY - dir, cx + 7, bowY - dir, 1, RAMPS.wood);
  capsule(img, cx - 7, bowY - dir, cx - 8, bowY - dir * 3, 0.8, RAMPS.wood);
  capsule(img, cx + 7, bowY - dir, cx + 8, bowY - dir * 3, 0.8, RAMPS.wood);
  const stringY = bowY - dir * (loaded ? 4 : 1);
  line(img, cx - 8, bowY - dir * 3, cx, stringY, shade(RAMPS.rope, 3), 1);
  line(img, cx + 8, bowY - dir * 3, cx, stringY, shade(RAMPS.rope, 3), 1);
  if (loaded) {
    line(img, cx, stringY, cx, bowY + dir * 3, shade(RAMPS.steel, 4), 1);
  }
  px(img, cx, cy - 2 - dir * pull, shade(team, 4));
}

// --- Hive.

export function hiveFrames(side: Side): UnitFrames {
  return frameSet(40, 48, 20, 42, side, (img, facing, anim, frame, team) => {
    const cx = 20;
    // It swells while idle and pulses hard while breeding (its 'attack').
    const swell = anim === 'attack' ? [0, 1, 2, 1][frame] ?? 0 : anim === 'idle' ? frame : frame % 2;
    const rx = 12 + swell * 0.5;
    const ry = 11 + swell * 0.5;
    const cy = 30 - swell * 0.5;
    // A dark ring of earth it sits in.
    oval(img, cx, 39, 13, 3.5, shade(RAMPS.dirt, 1));
    // The comb: hexagon cells over a shaded dome.
    fill(img, cx - rx, cy - ry, cx + rx, cy + ry + 2, (x, y) => {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      const d = nx * nx + ny * ny * (y > cy ? 0.6 : 1);
      if (d > 1) {
        return null;
      }
      const row = Math.floor((y - cy + 20) / 3);
      const wall = (y - cy + 20) % 3 < 1 || (x - cx + 20 + (row % 2) * 1.5) % 3 < 1;
      const lit = litIndex(RAMPS.honey, nx, ny, Math.sqrt(Math.max(0, 1 - d)), 0.05);
      return shade(RAMPS.honey, wall ? lit - 1 : lit);
    });
    // Bands round the dome.
    for (const by of [-4, 1, 6]) {
      const w = rx * Math.sqrt(Math.max(0, 1 - ((by) / ry) ** 2));
      line(img, cx - w + 1, cy + by, cx + w - 1, cy + by, shade(RAMPS.honey, 1), 1);
    }
    // Entrances: dark holes that glow as it breeds.
    const glow = anim === 'attack' && frame >= 1;
    const holes: [number, number, number][] = facing === 'up' ? [[cx - 5, cy + 3, 1.6], [cx + 6, cy - 1, 1.4]] : [[cx, cy + 5, 3], [cx - 7, cy, 1.6], [cx + 7, cy - 2, 1.5]];
    for (const [hx, hy, r] of holes) {
      oval(img, hx, hy, r, r * 0.8, INK);
      if (glow) {
        oval(img, hx, hy + 0.3, r * 0.5, r * 0.4, shade(RAMPS.fire, 4));
      }
    }
    // Drips of honey.
    px(img, cx - 9, cy + 4 + (frame % 2), shade(RAMPS.honey, 4));
    px(img, cx + 10, cy + 2, shade(RAMPS.honey, 4));
    // The team's pennant on a stick in its top.
    line(img, cx + 2, cy - ry - 1, cx + 2, cy - ry - 9, shade(RAMPS.wood, 2), 1);
    const wave = (frame % 2) * 1;
    poly(img, [[cx + 3, cy - ry - 9], [cx + 10, cy - ry - 7 + wave], [cx + 3, cy - ry - 4]], (x) => shade(team, x < cx + 6 ? 4 : 3));
  });
}
