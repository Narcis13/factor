import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const CLIENT_ROOT = fileURLToPath(new URL('../../client/', import.meta.url));

/** 9:16, the arena's own shape, so it fills the frame at 30 px per tile. */
export const SHOT_VIEWPORT = { width: 540, height: 960 };

export interface Shot {
  png: Buffer;
  /** The PixiJS renderer that drew the frame, e.g. `webgl`. */
  renderer: string;
}

/** Serves the client, opens it in headless Chromium, and captures the frame once the client says it's drawn. */
export async function shootArena(): Promise<Shot> {
  const server = await createServer({
    configFile: false,
    root: CLIENT_ROOT,
    logLevel: 'error',
    clearScreen: false,
    // A one-off server: any free port, no file watching, no hot reload.
    server: { port: 0, strictPort: true, watch: null, hmr: false },
  });
  try {
    await server.listen();
    const url = server.resolvedUrls?.local[0];
    if (url === undefined) {
      throw new Error('The Vite server has no local URL');
    }
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: SHOT_VIEWPORT, deviceScaleFactor: 1 });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') {
          errors.push(message.text());
        }
      });
      await page.goto(url);
      try {
        await page.waitForSelector('html[data-ready="true"]', { state: 'attached', timeout: 15_000 });
      } catch (error) {
        const reason = errors.length > 0 ? errors.join('\n') : String(error);
        throw new Error(`The client never finished drawing:\n${reason}`, { cause: error });
      }
      const renderer = (await page.getAttribute('html', 'data-renderer')) ?? 'unknown';
      return { png: await page.screenshot(), renderer };
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
  }
}
