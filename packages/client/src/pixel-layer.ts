import { Container, RenderTexture, Sprite, type Renderer } from 'pixi.js';

/**
 * A layer drawn in art pixels and shown on the screen with its pixels square at any size: the scene
 * renders into a small texture, which is scaled up nearest-neighbor by a whole number, then smoothly
 * down by the last fraction ("sharp bilinear"). Add `display` to the stage and call `render` before
 * the stage is drawn.
 */
export class PixelLayer {
  /** What the layer draws, in art pixels from its top-left corner. */
  readonly scene = new Container();
  readonly display = new Sprite();
  private readonly upscale = new Sprite();
  private low: RenderTexture | null = null;
  private high: RenderTexture | null = null;
  private readonly opaque: boolean;

  /** An opaque layer clears to black; a transparent one shows what is under it. */
  constructor(opaque: boolean) {
    this.opaque = opaque;
  }

  /**
   * Covers a `width` × `height` CSS-pixel screen with pixels `scale` CSS pixels big, the layer's top-left
   * at (originX, originY) (at or above and left of the screen's). Returns its size in art pixels.
   */
  resize(width: number, height: number, scale: number, dpr: number, originX = 0, originY = 0): { width: number; height: number } {
    const w = Math.max(1, Math.ceil((width - originX) / scale));
    const h = Math.max(1, Math.ceil((height - originY) / scale));
    this.low?.destroy(true);
    this.high?.destroy(true);
    this.low = RenderTexture.create({ width: w, height: h, scaleMode: 'nearest' });
    const k = Math.max(1, Math.ceil(scale * dpr));
    this.high = RenderTexture.create({ width: w * k, height: h * k, scaleMode: 'linear' });
    this.upscale.texture = this.low;
    this.upscale.scale.set(k);
    this.display.texture = this.high;
    this.display.position.set(originX, originY);
    this.display.scale.set(scale / k);
    return { width: w, height: h };
  }

  render(renderer: Renderer): void {
    if (this.low === null || this.high === null) {
      return;
    }
    renderer.render({ container: this.scene, target: this.low, clear: true, clearColor: this.opaque ? [0, 0, 0, 1] : [0, 0, 0, 0] });
    renderer.render({ container: this.upscale, target: this.high, clear: true, clearColor: [0, 0, 0, 0] });
  }
}
