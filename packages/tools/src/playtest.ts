import { layoutScreen, pointToScreen, REPLAY_STORAGE_KEY, type ScreenLayout, type ScreenPoint } from '@factor/client';
import { ARENA, loadReplay, MATCH_RULES, type Replay } from '@factor/content';
import { MILLI_PER_TILE, TICKS_PER_SECOND, type RejectReason, type SimState, type Terrain } from '@factor/sim';
import { CLIENT_VIEWPORT, pageErrors, waitForReady, withClient } from './browser.ts';
import { playReplay } from './match.ts';
import { END_TICK } from './shots.ts';

/** How often the scripted player taps a card and then a spot: about as often as energy allows a play. */
export const TAP_INTERVAL_MS = 4000;

/** The longest possible match (5:00) in real time, plus a minute for a slow machine. */
const MATCH_TIMEOUT_MS = (END_TICK * 1000) / TICKS_PER_SECOND + 60_000;

/** How far short of the river the scripted player taps: clear of the end screen, which covers the river. */
const SPOT_TILES = 5;

/**
 * The scripted player's `i`th play, as two taps: the center of hand slot `i mod hand size`, then a spot
 * `SPOT_TILES` short of the river on side 0's half, in line with the left bridge on even plays and the
 * right one on odd plays. A troop lands on its own half there; a spell catches whatever has crossed.
 */
export function playtestTaps(layout: ScreenLayout, arena: Terrain, i: number): [ScreenPoint, ScreenPoint] {
  const slot = layout.hud.slots[i % layout.hud.slots.length];
  const bridge = arena.bridges[i % arena.bridges.length];
  if (slot === undefined || bridge === undefined) {
    throw new Error('The playtest needs a hand and a bridge');
  }
  const card = { x: slot.x + Math.floor(slot.width / 2), y: slot.y + Math.floor(slot.height / 2) };
  const spot = pointToScreen(layout.view, bridge.x + bridge.width / 2, arena.river.y - SPOT_TILES * MILLI_PER_TILE);
  return [card, { x: Math.round(spot.x), y: Math.round(spot.y) }];
}

export interface PlaytestReport {
  /** The replay the client saved in localStorage when the match ended. */
  replay: Replay;
  /** That replay played back headless with invariants checked every tick. */
  final: SimState;
  /** Plays the scripted player (side 0) made: each one a card tap and a spot tap. */
  taps: number;
  /** Side 0's commands the sim took, and the ones it rejected, by reason. */
  accepted: number;
  rejected: Partial<Record<RejectReason, number>>;
  /** Commands the bot (side 1) sent. */
  botPlays: number;
  /** The live end screen, and the same match watched back with `?replay=last`. */
  live: Buffer;
  watched: Buffer;
  /** Uncaught errors and console errors from either page. */
  errors: string[];
  seconds: number;
}

/**
 * Plays one live match in the client in headless Chromium, in real time: side 0 taps a card and a spot
 * every `TAP_INTERVAL_MS` (`playtestTaps`) against the bot, until the client saves the finished match's
 * replay. Then it plays that replay back headless, and watches it in the client with `?replay=last`.
 * Real time, not a fake clock: software WebGL draws a frame in about 50 ms, so the match takes its
 * full length (3–5 minutes).
 */
export async function playtest(): Promise<PlaytestReport> {
  const began = Date.now();
  const layout = layoutScreen(ARENA, MATCH_RULES.handSize, CLIENT_VIEWPORT.width, CLIENT_VIEWPORT.height);
  return withClient(async (url, browser) => {
    const context = await browser.newContext({ viewport: CLIENT_VIEWPORT, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = pageErrors(page);
    await page.goto(url);
    await waitForReady(page, 'the live match', errors);
    let taps = 0;
    for (;;) {
      await page.waitForTimeout(TAP_INTERVAL_MS);
      // Checked just before tapping, so taps stop once the end screen is up.
      if ((await page.getAttribute('html', 'data-replay-saved')) === 'true') {
        break;
      }
      if (Date.now() - began > MATCH_TIMEOUT_MS) {
        throw new Error(`The live match hadn't ended after ${String(MATCH_TIMEOUT_MS / 1000)} s:\n${errors.join('\n')}`);
      }
      for (const point of playtestTaps(layout, ARENA, taps)) {
        await page.mouse.click(point.x, point.y);
      }
      taps++;
    }
    const live = await page.screenshot();
    const stored = (await context.storageState()).origins.flatMap((origin) => origin.localStorage);
    const text = stored.find((item) => item.name === REPLAY_STORAGE_KEY)?.value;
    if (text === undefined) {
      throw new Error('The client said it saved the replay, but localStorage has none');
    }
    const replay = loadReplay(text);

    const watching = await context.newPage();
    const watchingErrors = pageErrors(watching);
    await watching.goto(`${url}?replay=last&tick=${String(END_TICK)}`);
    await waitForReady(watching, 'the replay', watchingErrors);
    const watched = await watching.screenshot();
    await context.close();
    errors.push(...watchingErrors);

    let accepted = replay.commands.filter((command) => command.side === 0).length;
    const rejected: Partial<Record<RejectReason, number>> = {};
    const final = playReplay(replay, undefined, (state) => {
      for (const { command, reason } of state.rejected) {
        if (command.side === 0) {
          accepted--;
          rejected[reason] = (rejected[reason] ?? 0) + 1;
        }
      }
    });
    const botPlays = replay.commands.filter((command) => command.side === 1).length;
    return { replay, final, taps, accepted, rejected, botPlays, live, watched, errors, seconds: (Date.now() - began) / 1000 };
  });
}
