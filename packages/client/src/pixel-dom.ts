// Pixel art in the page itself (the deck builder is plain DOM): images on canvases scaled up whole with
// square pixels, pixel lettering, and tiles for CSS backgrounds.
import { textImage, type TextStyle } from './art/font.ts';
import type { Img } from './art/image.ts';

/** An image on a canvas of its own size. */
export function imgCanvas(img: Img): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  return canvas;
}

/** An image on a canvas shown `scale` CSS pixels per pixel, unsmoothed. */
export function pixelCanvas(img: Img, scale: number): HTMLCanvasElement {
  const canvas = imgCanvas(img);
  canvas.style.width = `${String(img.width * scale)}px`;
  canvas.style.height = `${String(img.height * scale)}px`;
  canvas.style.imageRendering = 'pixelated';
  canvas.style.display = 'block';
  return canvas;
}

/** Pixel lettering on a canvas; the text also goes in its label, for screen readers. */
export function pixelText(text: string, style: TextStyle, scale: number): HTMLCanvasElement {
  const canvas = pixelCanvas(textImage(text, style), scale);
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', text);
  return canvas;
}

/** An image as a data URL, for a CSS background. */
export function dataUrl(img: Img): string {
  return imgCanvas(img).toDataURL('image/png');
}

/** The page's tab icon: a gold crown in pixels. */
export function setFavicon(img: Img): void {
  const link = document.createElement('link');
  link.rel = 'icon';
  link.href = dataUrl(img);
  document.head.append(link);
}
