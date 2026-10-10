// The art as Pixi textures: atlas pages become canvases, frames become sub-textures that remember their
// anchors. Every texture samples nearest-neighbor, so pixels stay square.
import { CanvasSource, Rectangle, Sprite, Texture } from 'pixi.js';
import { pack, type Atlas } from './art/atlas.ts';
import type { Frame } from './art/frame.ts';
import type { Img } from './art/image.ts';
import { imgCanvas } from './pixel-dom.ts';

/** A texture and the pixel it hangs from. */
export interface SpriteFrame {
  texture: Texture;
  ax: number;
  ay: number;
}

/** A standalone texture of an image. `repeat` lets it tile. */
export function imgTexture(img: Img, repeat = false): Texture {
  const source = new CanvasSource({ resource: imgCanvas(img), scaleMode: 'nearest', addressMode: repeat ? 'repeat' : 'clamp-to-edge' });
  return new Texture({ source });
}

export function frameTexture(frame: Frame): SpriteFrame {
  return { texture: imgTexture(frame.img), ax: frame.ax, ay: frame.ay };
}

/** Frames by key, packed into atlas pages. */
export class SpriteBank {
  private readonly frames = new Map<string, SpriteFrame>();

  constructor(frames: ReadonlyMap<string, Frame>) {
    this.add(pack(frames));
  }

  private add(atlas: Atlas): void {
    const sources = atlas.pages.map((page) => new CanvasSource({ resource: imgCanvas(page), scaleMode: 'nearest' }));
    for (const [key, placement] of atlas.placements) {
      const source = sources[placement.page];
      if (source === undefined) {
        continue;
      }
      const texture = new Texture({ source, frame: new Rectangle(placement.x, placement.y, placement.width, placement.height) });
      this.frames.set(key, { texture, ax: placement.ax, ay: placement.ay });
    }
  }

  has(key: string): boolean {
    return this.frames.has(key);
  }

  get(key: string): SpriteFrame {
    const frame = this.frames.get(key);
    if (frame === undefined) {
      throw new RangeError(`No sprite frame ${key}`);
    }
    return frame;
  }
}

/** Points a sprite at a frame, anchored where the frame hangs from. */
export function show(sprite: Sprite, frame: SpriteFrame): Sprite {
  sprite.texture = frame.texture;
  sprite.anchor.set(frame.ax / frame.texture.width, frame.ay / frame.texture.height);
  return sprite;
}

/**
 * Sprites reused frame to frame: `next` hands out the pool's sprites in order (making more as needed),
 * and `end` hides the ones not used this frame.
 */
export class SpritePool {
  private readonly sprites: Sprite[] = [];
  private used = 0;

  private readonly parent: { addChild: (sprite: Sprite) => unknown };

  constructor(parent: { addChild: (sprite: Sprite) => unknown }) {
    this.parent = parent;
  }

  next(frame: SpriteFrame, x: number, y: number): Sprite {
    let sprite = this.sprites[this.used];
    if (sprite === undefined) {
      sprite = new Sprite();
      this.sprites.push(sprite);
      this.parent.addChild(sprite);
    }
    this.used++;
    show(sprite, frame);
    sprite.visible = true;
    sprite.position.set(Math.round(x), Math.round(y));
    sprite.scale.set(1, 1);
    sprite.alpha = 1;
    sprite.tint = 0xffffff;
    sprite.zIndex = 0;
    sprite.rotation = 0;
    return sprite;
  }

  end(): void {
    for (let i = this.used; i < this.sprites.length; i++) {
      const sprite = this.sprites[i];
      if (sprite !== undefined) {
        sprite.visible = false;
      }
    }
    this.used = 0;
  }
}
