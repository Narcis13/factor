// The arena in pixel art (VISION §11, D8). Everything is drawn at `PPT` art pixels a tile into a pixel
// layer (see pixel-layer.ts), so pixels stay square at any screen size. Where things are comes from the
// scenes in arena-view.ts, worked out in the art's own pixel grid; this turns them into sprites. Every
// animation runs off the sim's tick, so a frozen shot draws the same pixels every time (VISION §6).
import { MILLI_PER_TILE, type Rect, type SimState } from '@factor/sim';
import { Container, Graphics, Sprite, TilingSprite, type Renderer, type Texture } from 'pixi.js';
import { blastScene, groundScene, hpBarScene, projectileScene, splashScene, towerScene, unitScene, type HpBar, type View } from './arena-view.ts';
import { artPx, FX_FRAMES, key, SHOT_OF, SPELL_OF, SPLASH_OF, worldArt, type WorldArt } from './art/catalog.ts';
import { INK, RAMPS, TEAM, shade, teamColor } from './art/color.ts';
import { TINY, textImage } from './art/font.ts';
import type { Anim, Facing } from './art/frame.ts';
import { SHOT_DIRECTIONS } from './art/fx.ts';
import { image, line, type Img } from './art/image.ts';
import { bridgeImage, groundImage, PPT, surroundImage, WATER_FRAMES, WATER_TICKS, waterImage } from './art/terrain.ts';
import { starIcon } from './art/ui.ts';
import type { Effect } from './effects.ts';
import type { GhostPlan } from './ghost.ts';
import type { StarPip } from './hud-view.ts';
import { BLAST_TICKS, type RecentBlast, type RecentSplash } from './match-loop.ts';
import { PixelLayer } from './pixel-layer.ts';
import { attackFrame, facingTo, restFacing } from './poses.ts';
import type { ScreenLayout } from './screen-layout.ts';
import { imgTexture, SpriteBank, SpritePool, type SpriteFrame } from './textures.ts';

/** Everything the arena shows in one frame. */
export interface WorldInput {
  previous: SimState;
  current: SimState;
  /** How far the display is from `previous` toward `current`, in [0, 1]. */
  alpha: number;
  effects: readonly Effect[];
  blasts: readonly RecentBlast[];
  splashes: readonly RecentSplash[];
  /** Where the selected card can't go, shaded; `null` with nothing selected. */
  noDeploy: readonly Rect[] | null;
  ghost: GhostPlan | null;
  /** Both sides' star slots, in CSS pixels: drawn on the arena by the river. */
  stars: readonly StarPip[];
}

/** How long a unit shows white after a hit, in ticks. */
const FLASH_TICKS = 2;

/** How long each animation plays, in ticks. */
const PLAY_TICKS = { flare: 13, spark: 11, meteorFall: 3, meteorBoom: 14, boom: 13, shock: 9, puff: 10, deploy: 16, fall: 18 } as const;

export class WorldView {
  private readonly layer = new PixelLayer(true);
  /** The upscaled picture: add this to the stage. */
  readonly display = this.layer.display;
  private readonly art: WorldArt;
  private readonly bank: SpriteBank;
  private readonly scene = new Container();
  /** The art's own pixel grid, as a view: 16 pixels a tile, the arena's top-left at (left, top). */
  private view: View = { tilePx: PPT, left: 0, top: 0, arenaHeight: 0 };
  /** CSS pixels per art pixel, and where the picture's top-left sits on the screen. */
  private cssScale = 1;
  private cssOrigin: [number, number] = [0, 0];

  private readonly ground = new Sprite();
  private readonly water = new Sprite();
  private readonly waterFrames: Texture[] = [];
  private readonly bridges = new Container();
  private readonly decals = new Container();
  private readonly shade = new Container();
  private readonly shadows = new Container();
  private readonly bodies = new Container({ sortableChildren: true });
  private readonly shots = new Container();
  private readonly air = new Container({ sortableChildren: true });
  private readonly fx = new Container();
  private readonly bars = new Graphics();
  private readonly labels = new Container();
  private readonly starLayer = new Container();
  private readonly outlines = new Graphics();
  private readonly ghosts = new Container();

  private readonly decalPool = new SpritePool(this.decals);
  private readonly shadowPool = new SpritePool(this.shadows);
  private readonly bodyPool = new SpritePool(this.bodies);
  private readonly shotPool = new SpritePool(this.shots);
  private readonly airPool = new SpritePool(this.air);
  private readonly fxPool = new SpritePool(this.fx);
  private readonly labelPool = new SpritePool(this.labels);
  private readonly starPool = new SpritePool(this.starLayer);
  private readonly ghostPool = new SpritePool(this.ghosts);
  private readonly hatches: TilingSprite[] = [];
  private readonly hatch: Texture;
  private readonly digits: SpriteFrame[];
  private readonly starTextures = new Map<string, SpriteFrame>();

  constructor(cards: SimState['cards']) {
    this.art = worldArt(cards);
    this.bank = new SpriteBank(this.art.frames);
    this.hatch = imgTexture(hatchImage(), true);
    this.digits = Array.from({ length: 10 }, (_, d) => {
      const img = textImage(String(d), { font: TINY, color: [0xc8d0e4, 0xffffff], outline: INK });
      return { texture: imgTexture(img), ax: 0, ay: 0 };
    });
    this.layer.scene.addChild(this.scene);
    this.scene.addChild(this.ground, this.water, this.bridges, this.decals, this.shade, this.shadows, this.bodies, this.shots, this.air, this.fx, this.bars, this.labels, this.starLayer, this.outlines, this.ghosts);
  }

  /** Lays the picture out for a new screen size and redraws the ground. */
  resize(layout: ScreenLayout, terrain: SimState['arena'], towers: SimState['towers'], width: number, height: number, dpr: number): void {
    const { view } = layout;
    const s = view.tilePx / PPT;
    const ox = Math.ceil(view.left / s);
    const oy = Math.ceil(view.top / s);
    const originX = view.left - ox * s;
    const originY = view.top - oy * s;
    const { width: w, height: h } = this.layer.resize(width, height, s, dpr, originX, originY);
    this.view = { tilePx: PPT, left: ox, top: oy, arenaHeight: terrain.height };
    this.cssScale = s;
    this.cssOrigin = [originX, originY];

    // The ground: the surround, then the arena's turf over it.
    const arenaW = (terrain.width * PPT) / MILLI_PER_TILE;
    const arenaH = (terrain.height * PPT) / MILLI_PER_TILE;
    const ground = surroundImage(w, h, ox, oy, arenaW, arenaH);
    const turf = groundImage(terrain, towers);
    for (let y = 0; y < arenaH; y++) {
      if (oy + y < 0 || oy + y >= h) {
        continue;
      }
      const from = y * arenaW * 4;
      ground.data.set(turf.data.subarray(from, from + Math.min(arenaW, w - ox) * 4), ((oy + y) * w + ox) * 4);
    }
    this.ground.texture.destroy(true);
    this.ground.texture = imgTexture(ground);

    if (this.waterFrames.length === 0) {
      for (let frame = 0; frame < WATER_FRAMES; frame++) {
        this.waterFrames.push(imgTexture(waterImage(terrain, frame)));
      }
    }
    this.bridges.removeChildren().forEach((child) => {
      child.destroy();
    });
    for (const shape of groundScene(terrain, this.view)) {
      const { x, y, width: rw, height: rh } = shape.rect;
      if (shape.kind === 'river') {
        this.water.position.set(Math.round(x), Math.round(y));
        continue;
      }
      const { img, ox: bx, oy: by } = bridgeImage(Math.round(rw), Math.round(rh));
      const sprite = new Sprite(imgTexture(img));
      sprite.position.set(Math.round(x) - bx, Math.round(y) - by);
      this.bridges.addChild(sprite);
    }
  }

  /** Arena milli-tiles to art pixels (unrounded). */
  private at(x: number, y: number): [number, number] {
    return [this.view.left + (x * PPT) / MILLI_PER_TILE, this.view.top + ((this.view.arenaHeight - y) * PPT) / MILLI_PER_TILE];
  }

  draw(input: WorldInput): void {
    const { current, alpha } = input;
    const now = current.tick + alpha;
    this.water.texture = this.waterFrames[Math.floor(now / WATER_TICKS) % WATER_FRAMES] ?? this.water.texture;
    this.bars.clear();
    this.outlines.clear();
    const [sx, sy] = this.shake(input, now);
    this.scene.position.set(sx, sy);

    this.drawSpells(input);
    this.drawShade(input.noDeploy);
    this.drawTowers(current, now);
    this.drawUnits(input, now);
    this.drawShots(input, now);
    this.drawEffects(input, now);
    this.drawGhost(input, now);
    this.drawStars(input.stars);

    for (const pool of [this.decalPool, this.shadowPool, this.bodyPool, this.shotPool, this.airPool, this.fxPool, this.labelPool, this.starPool, this.ghostPool]) {
      pool.end();
    }
  }

  /** Renders the scene into the layer: call before the stage is drawn. */
  renderTo(renderer: Renderer): void {
    this.layer.render(renderer);
  }

  /** A short shudder when a tower falls or a meteor lands. */
  private shake(input: WorldInput, now: number): [number, number] {
    let strength = 0;
    for (const effect of input.effects) {
      if (effect.kind === 'fall') {
        strength = Math.max(strength, 3 * (1 - (now - effect.tick) / 10));
      }
    }
    for (const blast of input.blasts) {
      if (SPELL_OF[blast.card] === 'meteor') {
        strength = Math.max(strength, 2 * (1 - (now - blast.tick - PLAY_TICKS.meteorFall) / 8));
      }
    }
    if (strength <= 0) {
      return [0, 0];
    }
    const t = Math.floor(now);
    return [Math.round(Math.sin(t * 2.3) * strength), Math.round(Math.cos(t * 3.1) * strength * 0.6)];
  }

  private frame(name: string): SpriteFrame {
    return this.bank.get(name);
  }

  /** One frame of effect `name`, `age` ticks into its `frames`-frame animation over `ticks`; nothing once it's over. */
  private play(name: string, frames: number, age: number, ticks: number, x: number, y: number): void {
    const frame = Math.floor((age / ticks) * frames);
    if (frame >= 0 && frame < frames && this.bank.has(key.fx(name, frame))) {
      this.fxPool.next(this.frame(key.fx(name, frame)), x, y);
    }
  }

  /** Spells where they landed (a meteor leaves a scorch on the ground) and splashes where they hit. */
  private drawSpells(input: WorldInput): void {
    for (const blast of blastScene(input.blasts, input.current, input.alpha, BLAST_TICKS, this.view)) {
      const r = Math.round(blast.radius);
      const age = (1 - blast.fade) * BLAST_TICKS;
      const look = SPELL_OF[blast.card] ?? 'flare';
      if (look !== 'meteor') {
        this.play(`${look}:${String(r)}`, look === 'flare' ? FX_FRAMES.flare : FX_FRAMES.spark, age, PLAY_TICKS[look], blast.x, blast.y);
      } else if (age < PLAY_TICKS.meteorFall) {
        this.play('meteorFall', FX_FRAMES.meteorFall, age, PLAY_TICKS.meteorFall, blast.x, blast.y);
      } else {
        this.decalPool.next(this.frame(key.fx(`scorch:${String(r)}`, 0)), blast.x, blast.y).alpha = Math.max(0, Math.min(1, 1.6 - age / 25));
        this.play(`boom:${String(r)}`, FX_FRAMES.boom, age - PLAY_TICKS.meteorFall, PLAY_TICKS.meteorBoom, blast.x, blast.y - r * 0.3);
      }
    }
    for (const splash of splashScene(input.splashes, input.current, input.alpha, BLAST_TICKS, this.view)) {
      const r = Math.round(splash.radius);
      const age = (1 - splash.fade) * BLAST_TICKS;
      const card = Object.entries(input.current.cards).find(([, stats]) => stats.type !== 'spell' && stats.unit.splash > 0 && artPx(stats.unit.splash) === r)?.[0];
      const look = SPLASH_OF[card ?? ''] ?? 'boom';
      this.play(`${look}:${String(r)}`, look === 'boom' ? FX_FRAMES.boom : FX_FRAMES.shock, age, PLAY_TICKS[look], splash.x, splash.y - (look === 'boom' ? r * 0.3 : 0));
    }
  }

  private drawShade(rects: readonly Rect[] | null): void {
    const list = rects ?? [];
    while (this.hatches.length < list.length) {
      const sprite = new TilingSprite({ texture: this.hatch, width: 1, height: 1 });
      this.hatches.push(sprite);
      this.shade.addChild(sprite);
    }
    this.hatches.forEach((sprite, i) => {
      const rect = list[i];
      sprite.visible = rect !== undefined;
      if (rect !== undefined) {
        const [x, y] = this.at(rect.x, rect.y + rect.height);
        sprite.position.set(Math.round(x), Math.round(y));
        sprite.width = artPx(rect.width);
        sprite.height = artPx(rect.height);
      }
    });
  }

  private drawTowers(state: SimState, now: number): void {
    const shapes = towerScene(state, this.view);
    state.towers.forEach((tower, i) => {
      const shape = shapes[i];
      if (shape === undefined) {
        return;
      }
      const tx = Math.round(shape.rect.x + shape.rect.width / 2);
      const ty = Math.round(shape.rect.y + shape.rect.height / 2);
      if (shape.fallen) {
        this.bodyPool.next(this.frame(key.tower(tower.kind, tower.side, 'rubble')), tx, ty).zIndex = ty - 40;
        return;
      }
      const layout = this.art.towers[tower.kind];
      this.bodyPool.next(this.frame(key.tower(tower.kind, tower.side, tower.hp * 2 < tower.maxHp ? 'cracked' : 'body')), tx, ty).zIndex = ty;
      const turretX = tx + layout.turretAt[0];
      const turretY = ty + layout.turretAt[1];
      const flagX = tx + layout.flagAt[0];
      const flagY = ty + layout.flagAt[1];
      if (shape.dormant) {
        this.bodyPool.next(this.frame(key.tower(tower.kind, tower.side, 'asleep')), turretX, turretY).zIndex = ty + 0.1;
        this.bodyPool.next(this.frame(key.fx('zzz', Math.floor(now / 8) % FX_FRAMES.zzz)), turretX + 6, turretY - 6).zIndex = ty + 0.3;
        this.bodyPool.next(this.frame(key.tower(tower.kind, tower.side, 'furled')), flagX, flagY).zIndex = ty + 0.05;
        return;
      }
      const target = tower.targetId === null ? null : position(state, tower.targetId);
      const [facing, flip] = target === null ? [restFacing(tower.side), false] : facingTo(target.x - tower.x, target.y - tower.y);
      const frame = target === null ? -1 : attackFrame(tower.cooldown, state.towerStats[tower.kind].hitTicks);
      const turret = this.bodyPool.next(this.frame(key.tower(tower.kind, tower.side, frame < 0 ? `turret:${facing}` : `fire:${facing}:${String(frame)}`)), turretX, turretY);
      turret.zIndex = ty + 0.1;
      turret.scale.x = flip ? -1 : 1;
      this.bodyPool.next(this.frame(key.tower(tower.kind, tower.side, `flag:${String((Math.floor(now / 5) + tower.id) % 4)}`)), flagX, flagY).zIndex = ty + 0.05;
    });
  }

  private drawUnits(input: WorldInput, now: number): void {
    const { previous, current, alpha } = input;
    const before = new Map(previous.units.map((unit) => [unit.id, unit]));
    const states = new Map(current.units.map((unit) => [unit.id, unit]));
    const flashed = new Map<number, number>();
    for (const effect of input.effects) {
      if (effect.kind === 'flash') {
        flashed.set(effect.id, now - effect.tick);
      }
    }
    const shapes = unitScene(previous, current, alpha, this.view);
    for (const shape of shapes) {
      const unit = states.get(shape.id);
      const stats = current.cards[shape.card];
      if (unit === undefined || stats === undefined || stats.type === 'spell') {
        continue;
      }
      const from = before.get(unit.id) ?? unit;
      const ux = Math.round(shape.x);
      const uy = Math.round(shape.y);
      const moved = from.x !== unit.x || from.y !== unit.y;
      const target = unit.targetId === null ? null : position(current, unit.targetId);
      let facing: Facing = restFacing(unit.side);
      let flip = false;
      if (moved && !shape.building) {
        [facing, flip] = facingTo(unit.x - from.x, unit.y - from.y);
      } else if (target !== null) {
        [facing, flip] = facingTo(target.x - unit.x, target.y - unit.y);
      }
      let anim: Anim = 'idle';
      let frame = (Math.floor(now / 12) + unit.id) % 2;
      if (shape.deploying) {
        frame = 0;
      } else if (stats.type === 'building' && stats.spawn !== null) {
        // A hive swells before it breeds and heaves as the mites come out.
        const every = stats.spawn.everyTicks;
        const phase = (unit.age - 1 + every) % every;
        if (phase >= every - 6 || phase < 4) {
          anim = 'attack';
          frame = phase < 4 ? 3 : phase >= every - 3 ? 2 : 1;
        }
      } else if (target !== null && !moved) {
        anim = 'attack';
        frame = attackFrame(unit.cooldown, stats.unit.hitTicks);
      } else if (moved) {
        anim = 'walk';
        const perFrame = Math.max(2, Math.round(160 / Math.max(1, stats.unit.speed)));
        frame = (Math.floor(now / perFrame) + unit.id) % 4;
      }
      const bob = shape.flying ? Math.round(Math.sin(now / 6 + unit.id) * 1.2) : 0;
      const shadow = this.shadowPool.next(this.frame(key.shadow(artPx(stats.unit.radius))), ux, uy);
      if (shape.flying) {
        shadow.alpha = 0.55;
        shadow.scale.set(0.8, 0.8);
      }
      const pool = shape.flying ? this.airPool : this.bodyPool;
      const y = uy - shape.lift - bob;
      const sprite = pool.next(this.frame(key.unit(unit.card, unit.side, anim, facing, frame)), ux, y);
      sprite.zIndex = uy;
      sprite.scale.x = flip ? -1 : 1;
      if (shape.deploying) {
        sprite.alpha = 0.55 + 0.45 * (1 - unit.deployTicks / Math.max(1, current.rules.deployDelayTicks));
      }
      const age = flashed.get(unit.id);
      if (age !== undefined && age < FLASH_TICKS) {
        const white = pool.next(this.frame(key.flash(unit.card, anim, facing, frame)), ux, y);
        white.zIndex = uy + 0.01;
        white.scale.x = flip ? -1 : 1;
        // A building is a big block of white; it flashes softer.
        white.alpha = (shape.building ? 0.45 : 0.8) * (1 - age / FLASH_TICKS);
      }
    }
    // Hp bars, towers' first, each with its hp over it.
    const heights = { tower: (kind: 'keep' | 'outpost') => this.art.towers[kind].top, unit: (card: string) => this.art.heights[card] ?? PPT };
    const standing = current.towers.filter((tower) => tower.hp > 0);
    hpBarScene(current, shapes, this.view, heights).forEach((bar, i) => {
      this.hpBar(bar);
      const tower = standing[i];
      if (tower !== undefined) {
        this.number(tower.hp, bar.rect.x + bar.rect.width / 2, bar.rect.y - 7);
      }
    });
  }

  private drawShots(input: WorldInput, now: number): void {
    const { current } = input;
    const flying = new Map(current.projectiles.map((shot) => [shot.id, shot]));
    const fired = new Map<number, Effect>();
    for (const effect of input.effects) {
      if (effect.kind === 'shot') {
        fired.set(effect.id, effect);
      }
    }
    for (const shape of projectileScene(input.previous, current, input.alpha, this.view)) {
      const shot = flying.get(shape.id);
      if (shot === undefined) {
        continue;
      }
      const origin = fired.get(shot.id);
      const kind = SHOT_OF[origin?.card ?? ''] ?? (shot.splash > 0 ? 'bomb' : 'bolt');
      let lift = 0;
      if (kind === 'bomb' && origin !== undefined) {
        // A lobbed bomb arcs: highest halfway, a third of its whole flight high.
        const [ox, oy] = this.at(origin.x, origin.y);
        const [gx, gy] = this.at(shot.toX, shot.toY);
        const total = Math.hypot(gx - ox, gy - oy);
        const t = total === 0 ? 1 : Math.min(1, Math.hypot(shape.x - ox, shape.y - oy) / total);
        lift = (4 * t * (1 - t) * total) / 3;
        this.shadowPool.next(this.frame(key.shadow(3)), shape.x, shape.y).alpha = 0.6;
      }
      let frame: number;
      if (kind === 'bolt' || kind === 'arrow' || kind === 'dart') {
        const angle = Math.atan2(-(shot.toY - shot.y), shot.toX - shot.x);
        frame = ((Math.round((angle / (Math.PI * 2)) * SHOT_DIRECTIONS) % SHOT_DIRECTIONS) + SHOT_DIRECTIONS) % SHOT_DIRECTIONS;
      } else {
        frame = Math.floor(now / 2) % (kind === 'bomb' ? 4 : kind === 'cannonball' ? 1 : 2);
      }
      // A shot flies at chest height, not along the ground.
      this.shotPool.next(this.frame(key.shot(kind, shot.side, frame)), shape.x, shape.y - 6 - lift);
    }
  }

  private drawEffects(input: WorldInput, now: number): void {
    const { current } = input;
    const units = new Map(current.units.map((unit) => [unit.id, unit]));
    for (const effect of input.effects) {
      const age = now - effect.tick;
      const [ex, ey] = this.at(effect.x, effect.y);
      const r = artPx(effect.radius);
      switch (effect.kind) {
        case 'flash': {
          // A spark where the blow landed: on a unit round its middle, on a tower somewhere on its face.
          const frame = Math.floor(age * 1.5);
          if (frame >= FX_FRAMES.hit) {
            break;
          }
          const unit = units.get(effect.id);
          if (current.towers.some((tower) => tower.id === effect.id)) {
            this.fxPool.next(this.frame(key.fx('hit', frame)), ex + ((effect.tick * 7) % 11) - 5, ey - 14 - ((effect.tick * 5) % 9));
          } else if (unit !== undefined) {
            const stats = current.cards[unit.card];
            const flies = stats !== undefined && stats.type !== 'spell' && stats.unit.layer === 'air';
            const [ux, uy] = this.at(unit.x, unit.y);
            const lift = flies ? Math.round(artPx(stats.unit.radius) * 1.4 + PPT / 5) : 0;
            this.fxPool.next(this.frame(key.fx('hit', frame)), ux, uy - lift - (this.art.heights[unit.card] ?? PPT) / 2);
          }
          break;
        }
        case 'death':
          this.play(`puff:${String(r)}:${String(effect.side)}`, FX_FRAMES.puff, age, PLAY_TICKS.puff, ex, ey - r);
          break;
        case 'deploy':
          this.play(`deploy:${String(r)}:${String(effect.side)}`, FX_FRAMES.deploy, age, PLAY_TICKS.deploy, ex, ey - 2);
          break;
        case 'fall': {
          const size = effect.card === 'keep' ? 34 : 26;
          this.play(`boom:${String(size)}`, FX_FRAMES.boom, age, PLAY_TICKS.fall, ex, ey - size * 0.6);
          break;
        }
        case 'shot': {
          // A tower's weapon flashes as it fires.
          const tower = current.towers.find((candidate) => candidate.kind === effect.card && candidate.side === effect.side && candidate.x === effect.x && candidate.y === effect.y);
          const frame = Math.floor(age);
          if (tower !== undefined && frame < FX_FRAMES.muzzle) {
            const layout = this.art.towers[tower.kind];
            this.fxPool.next(this.frame(key.fx('muzzle', frame)), ex + layout.turretAt[0], ey + layout.turretAt[1] - 3);
          }
          break;
        }
      }
    }
  }

  /** The deploy ghost: the card's units where they would stand, pulsing, white if the sim takes it, red if not, gold while energy is short. */
  private drawGhost(input: WorldInput, now: number): void {
    const { ghost, current } = input;
    const stats = ghost === null ? undefined : current.cards[ghost.card];
    if (ghost === null || stats === undefined) {
      return;
    }
    const color = ghost.status === 'ok' ? 0xffffff : ghost.status === 'refused' ? 0xff5a4a : 0xffd23f;
    const g = this.outlines;
    if (stats.type === 'spell') {
      const [cx, cy] = this.at(ghost.x, ghost.y);
      const r = artPx(stats.spell.radius);
      g.ellipse(Math.round(cx), Math.round(cy), r, r).fill({ color, alpha: 0.16 }).stroke({ color, width: 1, alpha: 0.9 });
      return;
    }
    const r = artPx(stats.unit.radius);
    const pulse = 0.6 + 0.15 * Math.sin(now / 3);
    for (const spot of ghost.spots) {
      const [sx, sy] = this.at(spot.x, spot.y).map(Math.round) as [number, number];
      if (stats.type === 'building') {
        g.rect(sx - r, sy - Math.round(r * 0.6), r * 2, Math.round(r * 1.2)).fill({ color, alpha: 0.18 }).stroke({ color, width: 1, alpha: 0.8 });
      } else {
        g.ellipse(sx, sy, r, Math.max(2, Math.round(r * 0.55))).fill({ color, alpha: 0.18 }).stroke({ color, width: 1, alpha: 0.8 });
      }
      const lift = stats.unit.layer === 'air' ? Math.round(r * 1.4 + PPT / 5) : 0;
      const sprite = this.ghostPool.next(this.frame(key.unit(ghost.card, ghost.side, 'idle', restFacing(ghost.side), 0)), sx, sy - lift);
      sprite.alpha = pulse;
      sprite.tint = ghost.status === 'ok' ? 0xffffff : color;
    }
  }

  /** The star slots: earned ones in their side's color, the rest dark. */
  private drawStars(stars: readonly StarPip[]): void {
    for (const pip of stars) {
      const size = Math.max(9, Math.round((2 * pip.radius) / this.cssScale) + 1);
      const name = `${String(size)}:${String(pip.side)}:${String(pip.earned)}`;
      let frame = this.starTextures.get(name);
      if (frame === undefined) {
        frame = { texture: imgTexture(starIcon(size, pip.side, pip.earned)), ax: (size + 2) / 2, ay: (size + 2) / 2 };
        this.starTextures.set(name, frame);
      }
      this.starPool.next(frame, (pip.x - this.cssOrigin[0]) / this.cssScale, (pip.y - this.cssOrigin[1]) / this.cssScale);
    }
  }

  /** A framed bar in its side's color: an ink frame, a dark track, a lit top row. */
  private hpBar({ side, rect, fraction }: HpBar): void {
    const g = this.bars;
    const { x, y, width, height } = rect;
    const fill = Math.max(0, Math.min(width, Math.round(width * fraction)));
    g.rect(x - 1, y - 1, width + 2, height + 2).fill({ color: INK });
    g.rect(x, y, width, height).fill({ color: shade(RAMPS.stone, 0) });
    if (fill > 0) {
      const team = TEAM[side];
      g.rect(x, y, fill, height).fill({ color: teamColor(side) });
      g.rect(x, y, fill, 1).fill({ color: shade(team, 5) });
      if (height > 2) {
        g.rect(x, y + height - 1, fill, 1).fill({ color: shade(team, 2) });
      }
    }
  }

  /** A whole number in the tiny font, centered on x, its top at y. */
  private number(value: number, x: number, y: number): void {
    const text = String(Math.max(0, Math.round(value)));
    let cursor = Math.round(x - (text.length * 4 - 1) / 2) - 1;
    for (const char of text) {
      const digit = this.digits[Number(char)];
      if (digit !== undefined) {
        this.labelPool.next(digit, cursor, Math.round(y));
      }
      cursor += 4;
    }
  }
}

function position(state: SimState, id: number): { x: number; y: number } | null {
  return state.units.find((unit) => unit.id === id) ?? state.towers.find((tower) => tower.id === id) ?? null;
}

/** Red diagonal stripes over a dark wash, for ground the selected card can't take. */
function hatchImage(): Img {
  const img = image(8, 8);
  for (let i = -8; i < 16; i += 4) {
    line(img, i, 8, i + 8, 0, 0xc0262c, 1, 0.7);
  }
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if ((img.data[(y * 8 + x) * 4 + 3] ?? 0) === 0) {
        img.data.set([16, 8, 20, 96], (y * 8 + x) * 4);
      }
    }
  }
  return img;
}
