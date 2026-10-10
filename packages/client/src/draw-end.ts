import type { Renderer } from 'pixi.js';
import { Container } from 'pixi.js';
import { INK, RAMPS, TEAM } from './art/color.ts';
import { TINY, goldText, textWidth, WHITE_TEXT } from './art/font.ts';
import { dot, labeledButton, panel, ribbon, starIcon, type IconName } from './art/ui.ts';
import { TextureCache } from './draw-hud.ts';
import type { EndScene, Outcome } from './end-view.ts';
import { PixelLayer } from './pixel-layer.ts';
import type { ScreenLayout } from './screen-layout.ts';
import { SpritePool } from './textures.ts';
import type { ScreenRect } from './arena-view.ts';

const TITLE: Record<Outcome, { text: string; ribbon: readonly number[]; color: readonly number[] }> = {
  victory: { text: 'VICTORY', ribbon: TEAM[0], color: goldText() },
  defeat: { text: 'DEFEAT', ribbon: TEAM[1], color: WHITE_TEXT },
  draw: { text: 'DRAW', ribbon: RAMPS.stone, color: WHITE_TEXT },
};

const BUTTONS: { name: 'again' | 'deck' | 'save'; label: string; icon: IconName; ramp: readonly number[] }[] = [
  { name: 'again', label: 'AGAIN', icon: 'again', ramp: RAMPS.gold },
  { name: 'deck', label: 'DECK', icon: 'deck', ramp: TEAM[0] },
  { name: 'save', label: 'SAVE', icon: 'save', ramp: RAMPS.green },
];

/** The end screen in pixel art, over everything: hidden while the match runs. */
export class EndView {
  private readonly layer = new PixelLayer(false);
  readonly root = this.layer.display;
  private readonly items = new Container();
  private readonly pool = new SpritePool(this.items);
  private readonly cache = new TextureCache();
  private pixel = 1;
  private size = { width: 1, height: 1 };

  constructor() {
    this.layer.scene.addChild(this.items);
    this.root.visible = false;
  }

  resize(layout: ScreenLayout, width: number, height: number, dpr: number): void {
    this.pixel = layout.hud.pixel;
    this.size = this.layer.resize(width, height, this.pixel, dpr);
  }

  private rect(rect: ScreenRect): ScreenRect {
    const u = this.pixel;
    return { x: Math.round(rect.x / u), y: Math.round(rect.y / u), width: Math.floor(rect.width / u), height: Math.floor(rect.height / u) };
  }

  /**
   * Shades the screen and puts the result panel over it. `shown` runs from 0 when the panel first appears
   * to 1 once it has settled: the ribbon drops in, then the stars pop one by one.
   */
  draw(scene: EndScene | null, shown: number): void {
    this.root.visible = scene !== null;
    if (scene === null) {
      return;
    }
    const cache = this.cache;
    const shade = this.pool.next(cache.get('shade', () => dot()), 0, 0);
    shade.width = this.size.width;
    shade.height = this.size.height;
    shade.alpha = 0.55 * Math.min(1, shown * 3);

    const box = this.rect(scene.panel);
    this.pool.next(cache.get(`panel:${String(box.width)}x${String(box.height)}`, () => panel(box.width, box.height, 'slate')), box.x, box.y);

    // The title on its ribbon, dropping in.
    const title = TITLE[scene.outcome];
    const text = cache.text(title.text, { color: title.color, scale: 2, shadow: true });
    const bandWidth = Math.min(box.width + 16, text.texture.width + 34);
    const band = cache.get(`ribbon:${scene.outcome}:${String(bandWidth)}`, () => ribbon(bandWidth, 20, title.ribbon));
    const drop = Math.round((1 - ease(Math.min(1, shown * 2.5))) * 24);
    const ry = Math.round(scene.titleAt.y / this.pixel) - 11 - drop;
    const rx = box.x + Math.round((box.width - band.texture.width) / 2);
    this.pool.next(band, rx, ry);
    this.pool.next(text, box.x + Math.round((box.width - text.texture.width) / 2), ry + 2);

    // Stars: the viewer's on the left, the opponent's on the right, popping in one after another.
    const size = Math.max(11, Math.round((2 * (scene.stars[0]?.radius ?? 0)) / this.pixel) + 2);
    scene.stars.forEach((pip, i) => {
      const at = Math.min(1, Math.max(0, (shown - 0.35 - (i % 3) * 0.12) * 5));
      if (at <= 0) {
        return;
      }
      const star = this.pool.next(cache.get(`star:${String(size)}:${String(pip.side)}:${String(pip.earned)}`, () => starIcon(size, pip.side, pip.earned), (size + 2) / 2, (size + 2) / 2), Math.round(pip.x / this.pixel), Math.round(pip.y / this.pixel));
      const pop = pip.earned ? 1 + 0.4 * Math.sin(at * Math.PI) : 1;
      star.scale.set(pop * at, pop * at);
    });
    const leftStar = scene.stars[0];
    const rightStar = scene.stars[3];
    const below = Math.round((leftStar?.y ?? 0) / this.pixel) + Math.ceil(size / 2) + 3;
    if (scene.note !== null) {
      // The tiebreak note takes the labels' place, on two lines if one won't fit the panel.
      const style = { font: TINY, color: [0x9aa4c0, 0xc8d0e4], outline: INK } as const;
      const whole = scene.note.toUpperCase();
      const lines = textWidth(whole, TINY) + 2 <= box.width - 8 ? [whole] : splitInTwo(whole);
      lines.forEach((text, i) => {
        const note = cache.text(text, style);
        this.pool.next(note, box.x + Math.round((box.width - note.texture.width) / 2), below + i * 7);
      });
    } else if (leftStar !== undefined && rightStar !== undefined) {
      const you = cache.text('YOU', { font: TINY, color: TEAM[0].slice(3), outline: INK });
      const them = cache.text('BOT', { font: TINY, color: TEAM[1].slice(3), outline: INK });
      const step = Math.round(((scene.stars[1]?.x ?? leftStar.x) - leftStar.x) / this.pixel);
      this.pool.next(you, Math.round(leftStar.x / this.pixel) + step - Math.round(you.texture.width / 2), below);
      this.pool.next(them, Math.round(rightStar.x / this.pixel) + step - Math.round(them.texture.width / 2), below);
    }

    for (const spec of BUTTONS) {
      const r = this.rect(scene[spec.name]);
      this.pool.next(cache.get(`button:${spec.name}:${String(r.width)}x${String(r.height)}`, () => labeledButton(r.width, r.height, spec.ramp, spec.icon, spec.label)), r.x, r.y);
    }
    this.pool.end();
  }

  renderTo(renderer: Renderer): void {
    if (this.root.visible) {
      this.layer.render(renderer);
    }
  }
}

/** Text split at the space nearest its middle. */
function splitInTwo(text: string): string[] {
  const middle = text.length / 2;
  let best = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ' ' && (best < 0 || Math.abs(i - middle) < Math.abs(best - middle))) {
      best = i;
    }
  }
  return best < 0 ? [text] : [text.slice(0, best), text.slice(best + 1)];
}

function ease(t: number): number {
  return 1 - (1 - t) * (1 - t) * (1 - t);
}
