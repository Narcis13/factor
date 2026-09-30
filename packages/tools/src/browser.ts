import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer } from 'vite';

const CLIENT_ROOT = fileURLToPath(new URL('../../client/', import.meta.url));

/** 9:16, the arena's own shape, so it fills the frame at 30 px per tile. */
export const CLIENT_VIEWPORT = { width: 540, height: 960 };

/**
 * Serves the client once on a free port, launches headless Chromium, and hands both to `use`; both
 * are closed afterwards, whatever happens.
 */
export async function withClient<T>(use: (url: string, browser: Browser) => Promise<T>): Promise<T> {
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
    // FACTOR_CHROMIUM points at a Chromium to use instead of the one Playwright pins (e.g. a preinstalled older build).
    const executablePath = process.env.FACTOR_CHROMIUM;
    const browser = await chromium.launch(executablePath === undefined ? {} : { executablePath });
    try {
      return await use(url, browser);
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
  }
}

/** Collects the page's uncaught errors and console errors from now on. */
export function pageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  return errors;
}

/** Waits until the client says it has drawn; if it never does, fails with the page's errors. */
export async function waitForReady(page: Page, name: string, errors: readonly string[]): Promise<void> {
  try {
    await page.waitForSelector('html[data-ready="true"]', { state: 'attached', timeout: 15_000 });
  } catch (error) {
    const reason = errors.length > 0 ? errors.join('\n') : String(error);
    throw new Error(`The client never finished drawing ${name}:\n${reason}`, { cause: error });
  }
}
