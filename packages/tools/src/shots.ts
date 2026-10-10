import { MATCH_RULES, saveReplay, type Replay } from '@factor/content';
import { CLIENT_VIEWPORT, pageErrors, waitForReady, withClient } from './browser.ts';
import { botReplay } from './match.ts';

export const SHOT_VIEWPORT = CLIENT_VIEWPORT;

/** The gallery is wide, so whole animations fit on a row. */
export const GALLERY_VIEWPORT = { width: 1600, height: 900 };

/** The frozen tick the arena shot shows: 10 s in, once the heuristic bot has saved up and started a push. */
export const SHOT_TICK = 200;

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
  /** Instead of a match: the art gallery (`?gallery&<query>`), captured whole. */
  gallery?: string;
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
  if (request.gallery !== undefined) {
    return request.gallery === '' ? 'gallery' : `gallery&${request.gallery}`;
  }
  const tick = `tick=${String(request.tick)}`;
  return request.replay === undefined ? tick : `replay=${REPLAY_URL}&${tick}`;
}

/**
 * Serves the client once, opens each request in headless Chromium (a replay is served to the page at
 * `REPLAY_URL`), and captures each frame once the client says it's drawn.
 */
export async function shoot(requests: readonly ShotRequest[]): Promise<Shot[]> {
  return withClient(async (url, browser) => {
    const shots: Shot[] = [];
    for (const request of requests) {
      const page = await browser.newPage({ viewport: request.gallery === undefined ? SHOT_VIEWPORT : GALLERY_VIEWPORT, deviceScaleFactor: 1 });
      const errors = pageErrors(page);
      const { replay } = request;
      if (replay !== undefined) {
        await page.route(`**/${REPLAY_URL}`, (route) => route.fulfill({ contentType: 'application/json', body: saveReplay(replay) }));
      }
      await page.goto(`${url}?${shotQuery(request)}`);
      await waitForReady(page, request.name, errors);
      const renderer = (await page.getAttribute('html', 'data-renderer')) ?? 'unknown';
      shots.push({ name: request.name, png: await page.screenshot({ fullPage: request.gallery !== undefined }), renderer });
      await page.close();
    }
    return shots;
  });
}
