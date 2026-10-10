import type { CardId, CardStats } from '@factor/sim';
import { Container, Sprite, type Renderer, type Texture } from 'pixi.js';
import { INK } from './art/color.ts';
import { TINY, WHITE_TEXT, textImage, type TextStyle } from './art/font.ts';
import type { Img } from './art/image.ts';
import { bandImage, cardFace, costBadge, doubleBadge, energyColumn, energyGem, energyGlint, energyTrack, greyed, icon, nameplate, nameTag, notchImage, selectionGlow, timerPanel, TRACK_INSET } from './art/ui.ts';
import type { HudScene } from './hud-view.ts';
import { PixelLayer } from './pixel-layer.ts';
import type { ScreenRect } from './arena-view.ts';
import type { ScreenLayout } from './screen-layout.ts';
import { imgTexture, SpritePool, type SpriteFrame } from './textures.ts';

/** Textures made once and kept by name: card faces, labels, panels. */
export class TextureCache {
  private readonly textures = new Map<string, SpriteFrame>();

  get(name: string, make: () => Img, ax = 0, ay = 0): SpriteFrame {
    let frame = this.textures.get(name);
    if (frame === undefined) {
      frame = { texture: imgTexture(make()), ax, ay };
      this.textures.set(name, frame);
    }
    return frame;
  }

  /** Text as a texture, anchored at its top-left. */
  text(text: string, style: TextStyle = {}): SpriteFrame {
    const color = style.color === undefined ? 'w' : typeof style.color === 'number' ? String(style.color) : style.color.join(',');
    return this.get(`text:${text}:${style.font === TINY ? 't' : 'f'}:${color}:${String(style.scale ?? 1)}:${String(style.shadow === true)}`, () => textImage(text, style));
  }
}

/** Who is playing what: the labels the HUD needs beyond the match state. */
export interface HudExtras {
  /** The match's tick plus alpha: animations run off it. */
  now: number;
  /** Shown top left: the opponent. */
  opponent: string;
  cards: Readonly<Record<CardId, CardStats>>;
}

/**
 * The HUD in pixel art: the wooden band under the arena holding the hand, the next card and the energy
 * bar; the opponent's plate and the timer above the arena.
 */
export class HudView {
  private readonly layer = new PixelLayer(false);
  readonly root = this.layer.display;
  private readonly back = new Sprite();
  private readonly items = new Container();
  private readonly pool = new SpritePool(this.items);
  private readonly cache = new TextureCache();
  private pixel = 1;
  private backTexture: Texture | null = null;

  constructor() {
    this.layer.scene.addChild(this.back, this.items);
  }

  resize(layout: ScreenLayout, width: number, height: number, dpr: number): void {
    this.pixel = layout.hud.pixel;
    this.layer.resize(width, height, this.pixel, dpr);
    const band = this.rect(layout.hud.band);
    this.backTexture?.destroy(true);
    this.backTexture = imgTexture(bandImage(band.width + 2, band.height + 4));
    this.back.texture = this.backTexture;
    this.back.position.set(band.x - 1, band.y - 2);
  }

  /** A CSS rectangle in UI pixels. */
  private rect(rect: ScreenRect): ScreenRect {
    const u = this.pixel;
    return { x: Math.round(rect.x / u), y: Math.round(rect.y / u), width: Math.floor(rect.width / u), height: Math.floor(rect.height / u) };
  }

  draw(scene: HudScene, extras: HudExtras): void {
    const { now } = extras;
    const u = this.pixel;
    const cache = this.cache;

    // The opponent's plate, top left.
    const top = { x: Math.round(scene.clockAt.x / u), y: Math.round(scene.clockAt.y / u) };
    const name = extras.opponent.toUpperCase();
    const plate = cache.get(`plate:${name}`, () => nameplate(name));
    this.pool.next(plate, Math.round(scene.top.x / u), top.y);

    // The timer, top right: a clock and the time left, red in a period's last ten seconds.
    const color = scene.urgent ? [0x8a1e2a, 0xec5a3c, 0xffc29a] : WHITE_TEXT;
    const clock = cache.text(scene.clock, { color, shadow: true });
    const clockWidth = clock.texture.width;
    const timer = cache.get(`timer:${String(clockWidth)}`, () => timerPanel(clockWidth));
    const tx = top.x - timer.texture.width;
    this.pool.next(timer, tx, top.y);
    this.pool.next(clock, tx + 12, top.y + 2);
    // The urgent clock throbs.
    if (scene.urgent && Math.floor(now / 5) % 2 === 0) {
      this.pool.next(cache.get('timer-flash', () => icon('clock', 9)), tx + 2, top.y + 2).tint = 0xff8a6a;
    }

    // The hand.
    for (const face of scene.hand) {
      const r = this.rect(face.rect);
      const lift = face.selected ? 3 : 0;
      const y = r.y - lift;
      const stats = extras.cards[face.card];
      if (stats === undefined) {
        continue;
      }
      if (face.selected) {
        const glow = cache.get(`glow:${String(r.width)}x${String(r.height)}:${String(Math.floor(now / 4) % 2)}`, () => selectionGlow(r.width, r.height, Math.floor(now / 4) % 2));
        this.pool.next(glow, r.x - 2, y - 2);
      }
      const art = cache.get(`face:${face.card}:${String(r.width)}x${String(r.height)}:${face.affordable ? 'on' : 'off'}`, () => {
        const img = cardFace(face.card, stats, r.width, r.height, { cost: false });
        return face.affordable ? img : greyed(img);
      });
      this.pool.next(art, r.x, y);
      if (!face.affordable) {
        // Energy filling up toward its cost, from the bottom.
        const inner = r.height - 6;
        const filled = Math.round(inner * face.progress);
        if (filled > 0) {
          const liquid = this.pool.next(cache.get('cardfill', () => energyColumn(8)), r.x + 3, y + 3 + inner - filled);
          liquid.width = r.width - 6;
          liquid.height = filled;
          liquid.alpha = 0.4;
        }
      }
      const gem = this.pool.next(cache.get(`cost:${String(face.cost)}`, () => costBadge(face.cost)), r.x - 2, y - 2);
      gem.alpha = face.affordable ? 1 : 0.85;
      if (face.selected) {
        // The card's name over it.
        const label = cache.get(`tag:${face.card}`, () => nameTag(face.card));
        this.pool.next(label, r.x + Math.round((r.width - label.texture.width) / 2), y - label.texture.height - 3);
      }
    }

    // The next card, smaller, with its label.
    if (scene.next !== null) {
      const r = this.rect(scene.next.rect);
      const stats = extras.cards[scene.next.card];
      if (stats !== undefined) {
        const card = scene.next.card;
        this.pool.next(cache.get(`face:${card}:${String(r.width)}x${String(r.height)}:next`, () => cardFace(card, stats, r.width, r.height, { cost: false })), r.x, r.y);
        const label = cache.text('NEXT', { font: TINY, color: [0xd6962a, 0xf5cf4c, 0xfff4a6], outline: INK });
        this.pool.next(label, r.x + Math.round((r.width - label.texture.width) / 2), r.y - label.texture.height - 1);
      }
    }

    // The energy bar: a trough, the liquid, a glint running along it, and the count in a gem.
    const bar = this.rect(scene.energyBar);
    this.pool.next(cache.get(`track:${String(bar.width)}x${String(bar.height)}`, () => energyTrack(bar.width, bar.height)), bar.x, bar.y);
    const inset = TRACK_INSET;
    const depth = bar.height - inset * 2;
    const inner = bar.width - inset * 2;
    const filled = Math.round(inner * scene.energyFill);
    if (filled > 0) {
      const liquid = this.pool.next(cache.get(`col:${String(depth)}`, () => energyColumn(depth)), bar.x + inset, bar.y + inset);
      liquid.width = filled;
      const sweep = Math.floor(now * 1.5) % (inner + 40);
      if (sweep < filled - 2) {
        this.pool.next(cache.get(`glint:${String(depth)}`, () => energyGlint(depth)), bar.x + inset + sweep, bar.y + inset);
      }
    }
    // A notch at every whole energy.
    for (let i = 1; i < scene.energyMax; i++) {
      const x = Math.round(bar.x + inset + (inner * i) / scene.energyMax);
      this.pool.next(cache.get(`notch:${String(depth)}`, () => notchImage(depth)), x, bar.y + inset).alpha = 0.85;
    }
    const gem = cache.get('gem:big', () => energyGem(15, 19));
    const gx = bar.x - gem.texture.width;
    const gy = bar.y + bar.height - gem.texture.height + 2;
    this.pool.next(gem, gx, gy);
    const count = cache.text(String(scene.energy), { color: WHITE_TEXT });
    this.pool.next(count, gx + Math.round((gem.texture.width - count.texture.width) / 2), gy + 8);
    if (scene.double) {
      const badge = cache.get('double', () => doubleBadge());
      const pulse = this.pool.next(badge, bar.x + bar.width - badge.texture.width + 2, bar.y - badge.texture.height + 2);
      pulse.alpha = 0.75 + 0.25 * Math.sin(now / 3);
    }
    this.pool.end();
  }

  renderTo(renderer: Renderer): void {
    this.layer.render(renderer);
  }
}
