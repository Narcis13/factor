// Packs frames into a few large pages, so the renderer draws them in big batches. Pure: the pages are
// images, the placements plain numbers.
import type { Frame } from './frame.ts';
import { blit, bounds, crop, image, type Img } from './image.ts';

export const PAGE_SIZE = 2048;
const PAD = 1;

/** Where a frame landed: its page, its rectangle there, and its anchor inside that rectangle. */
export interface Placement {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  ax: number;
  ay: number;
}

export interface Atlas {
  pages: Img[];
  placements: Map<string, Placement>;
}

/** A frame cut down to its drawn pixels, its anchor moved to match. An empty frame keeps one pixel. */
export function trim(frame: Frame): Frame {
  const box = bounds(frame.img);
  if (box === null) {
    return { img: image(1, 1), ax: frame.ax, ay: frame.ay };
  }
  return { img: crop(frame.img, box.x, box.y, box.width, box.height), ax: frame.ax - box.x, ay: frame.ay - box.y };
}

/** Shelf-packs every frame (trimmed), tallest first, onto as many pages as it takes. */
export function pack(frames: ReadonlyMap<string, Frame>): Atlas {
  const items = [...frames].map(([key, frame]) => ({ key, frame: trim(frame) }));
  items.sort((a, b) => b.frame.img.height - a.frame.img.height || b.frame.img.width - a.frame.img.width || (a.key < b.key ? -1 : 1));
  const pages: Img[] = [];
  const placements = new Map<string, Placement>();
  let page: Img | null = null;
  let x = 0;
  let y = 0;
  let shelf = 0;
  for (const { key, frame } of items) {
    const { width, height } = frame.img;
    if (width + PAD > PAGE_SIZE || height + PAD > PAGE_SIZE) {
      throw new RangeError(`${key} is ${String(width)}×${String(height)}: too big for an atlas page`);
    }
    if (page === null || x + width + PAD > PAGE_SIZE) {
      x = 0;
      y += shelf;
      shelf = 0;
    }
    if (page === null || y + height + PAD > PAGE_SIZE) {
      page = image(PAGE_SIZE, PAGE_SIZE);
      pages.push(page);
      x = 0;
      y = 0;
      shelf = 0;
    }
    blit(page, frame.img, x, y);
    placements.set(key, { page: pages.length - 1, x, y, width, height, ax: frame.ax, ay: frame.ay });
    x += width + PAD;
    shelf = Math.max(shelf, height + PAD);
  }
  return { pages: trimPages(pages, placements), placements };
}

/** The last page only as tall as it is used. */
function trimPages(pages: Img[], placements: Map<string, Placement>): Img[] {
  const last = pages.length - 1;
  if (last < 0) {
    return pages;
  }
  let used = 1;
  for (const placement of placements.values()) {
    if (placement.page === last) {
      used = Math.max(used, placement.y + placement.height + PAD);
    }
  }
  const page = pages[last];
  if (page !== undefined) {
    pages[last] = crop(page, 0, 0, page.width, used);
  }
  return pages;
}
