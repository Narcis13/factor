import { fileURLToPath } from 'node:url';
import { MATCH_RULES, saveReplay, type Replay } from '@factor/content';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { botReplay } from './match.ts';

const CLIENT_ROOT = fileURLToPath(new URL('../../client/', import.meta.url));

/** 9:16, the arena's own shape, so it fills the frame at 30 px per tile. */
export const SHOT_VIEWPORT = { width: 540, height: 960 };

/** The frozen tick the arena shot shows: 4.5 s in, so the clock has moved and the energy bar is part-filled. */
export const SHOT_TICK = 90;

/** Past the longest possible match, so a shot there shows how it ended. */
export const END_TICK = MATCH_RULES.regulationTicks + MATCH_RULES.overtimeTicks;

/** The bot-vs-bot match the end shot shows. */
export const END_SEED = 0;

/** The page-relative URL a shot's replay is served at: `?replay=` names it. */
const REPLAY_URL = 'shot-replay.json';

/** One frame to capture: the client opened frozen at `tick`, live against the bot or playing `replay` back. */
export interface ShotRequest {
  name: string;
  tick: number;
  replay?: Replay;
}

export interface Shot {
  name: string;
  png: Buffer;
  /** The PixiJS renderer that drew the frame, e.g. `webgl`. */
  renderer: string;
}

/** What `pnpm shots` saves: the live arena at `SHOT_TICK`, and the end of a bot-vs-bot replay. */
export function defaultShots(): ShotRequest[] {
  return [
    { name: 'arena', tick: SHOT_TICK },
    { name: 'end', tick: END_TICK, replay: botReplay(END_SEED) },
  ];
}

/** The page's query for a request. */
export function shotQuery(request: ShotRequest): string {
  const tick = `tick=${String(request.tick)}`;
  return request.replay === undefined ? tick : `replay=${REPLAY_URL}&${tick}`;
}

/**
 * Serves the client once, opens each request in headless Chromium (a replay is served to the page at
 * `REPLAY_URL`), and captures each frame once the client says it's drawn.
 */
export async function shoot(requests: readonly ShotRequest[]): Promise<Shot[]> {
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
      const shots: Shot[] = [];
      for (const request of requests) {
        const page = await browser.newPage({ viewport: SHOT_VIEWPORT, deviceScaleFactor: 1 });
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('console', (message) => {
          if (message.type() === 'error') {
            errors.push(message.text());
          }
        });
        const { replay } = request;
        if (replay !== undefined) {
          await page.route(`**/${REPLAY_URL}`, (route) => route.fulfill({ contentType: 'application/json', body: saveReplay(replay) }));
        }
        await page.goto(`${url}?${shotQuery(request)}`);
        try {
          await page.waitForSelector('html[data-ready="true"]', { state: 'attached', timeout: 15_000 });
        } catch (error) {
          const reason = errors.length > 0 ? errors.join('\n') : String(error);
          throw new Error(`The client never finished drawing ${request.name}:\n${reason}`, { cause: error });
        }
        const renderer = (await page.getAttribute('html', 'data-renderer')) ?? 'unknown';
        shots.push({ name: request.name, png: await page.screenshot(), renderer });
        await page.close();
      }
      return shots;
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
  }
}
