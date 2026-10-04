// The match view (main.ts routes here for `?play`, `?replay=` and `?tick=`). Runs a match live at 20
// ticks/s; side 0 plays the deck kept by the deck builder (the starter deck if none) by tapping a card,
// then the arena, against a deck dealt from the seed,
// against the heuristic bot on side 1 (`?bot=random` for the random one). `?replay=<url>` (or `?replay=last`) plays a replay back instead,
// from side 0's seat, with the hand shown but not playable. `?seed=<n>` picks the live match's seed
// (0 by default). `?tick=<n>` plays either to tick n with no taps and freezes it there (for
// `pnpm shots`). When a live match ends, its replay is saved in localStorage; every end screen offers
// a new live match on a fresh seed, or the replay as a file.
import { createBot, type BotKind } from '@factor/bot';
import { BOT_TUNING, dealDeck, matchSetup, saveReplay, type ContentCardId, type Replay } from '@factor/content';
import { createMatch } from '@factor/sim';
import { Application, Graphics } from 'pixi.js';
import { blastScene, groundScene, hpBarScene, noDeployRects, projectileScene, splashScene, toScreen, towerScene, unitScene } from './arena-view.ts';
import { tap, type Controls } from './controls.ts';
import { BACKGROUND, drawArena, drawBlasts, drawHpBars, drawNoDeploy, drawProjectiles, drawSplashes, drawUnits } from './draw-arena.ts';
import { EndView } from './draw-end.ts';
import { HudView } from './draw-hud.ts';
import { endScene } from './end-view.ts';
import { hudScene } from './hud-view.ts';
import { advance, alpha, BLAST_TICKS, createLoop, runTo } from './match-loop.ts';
import { loopReplay, readReplay, REPLAY_STORAGE_KEY } from './match-replay.ts';
import { layoutScreen, type ScreenLayout } from './screen-layout.ts';
import { DECK_STORAGE_KEY, matchUrl, storedDeck } from './deck-builder.ts';
import { freshSeed, parseSeed, parseTick } from './url-params.ts';

const app = new Application();
await app.init({
  width: window.innerWidth,
  height: window.innerHeight,
  background: BACKGROUND,
  antialias: true,
  resolution: window.devicePixelRatio,
  autoDensity: true,
  autoStart: false,
});
document.body.appendChild(app.canvas);

const params = new URLSearchParams(window.location.search);
const frozenAt = parseTick(params.get('tick'));
const replayName = params.get('replay');
const watched: Replay | null = replayName === null ? null : await readReplay(replayName, { stored, fetchText }).catch(showError);
const SEED = watched?.seed ?? parseSeed(params.get('seed')) ?? 0;
const DECKS: [ContentCardId[], ContentCardId[]] = watched?.decks ?? [storedDeck(storedText(DECK_STORAGE_KEY)), dealDeck(SEED)];
const start = createMatch(matchSetup(SEED, DECKS));
const BOT: BotKind = params.get('bot') === 'random' ? 'random' : 'heuristic';
const loop = watched === null ? createLoop(start, [createBot(BOT, 1, SEED, start, BOT_TUNING)]) : createLoop(start, [], watched.commands);
if (frozenAt !== null) {
  runTo(loop, frozenAt);
}
const controls: Controls = { side: 0, selected: null, watching: watched !== null };

const ground = new Graphics();
const field = new Graphics();
const hud = new HudView();
const end = new EndView();
app.stage.addChild(ground, field, hud.root, end.root);
let layout: ScreenLayout = resize();

/** Lays the screen out again and redraws the ground, which only changes with the screen size. */
function resize(): ScreenLayout {
  app.renderer.resize(window.innerWidth, window.innerHeight);
  const next = layoutScreen(loop.current.arena, loop.current.rules.handSize, window.innerWidth, window.innerHeight);
  ground.clear();
  drawArena(ground, groundScene(loop.current.arena, next.view));
  return next;
}

/** Towers, the no-deploy shade while a troop is selected, units, shots, recent splashes and spells, and hp bars, then the HUD: every frame. */
function render(): void {
  const { previous, current } = loop;
  const t = alpha(loop);
  field.clear();
  drawArena(field, towerScene(current, layout.view));
  const selected = controls.selected === null ? undefined : current.players[controls.side].hand[controls.selected];
  const selectedType = selected === undefined ? undefined : current.cards[selected]?.type;
  if (selectedType === 'troop' || selectedType === 'building') {
    for (const rect of noDeployRects(current, controls.side)) {
      drawNoDeploy(field, toScreen(layout.view, rect));
    }
  }
  const units = unitScene(previous, current, t, layout.view);
  drawUnits(field, units);
  drawProjectiles(field, projectileScene(previous, current, t, layout.view));
  drawSplashes(field, splashScene(loop.splashes, current, t, BLAST_TICKS, layout.view));
  drawBlasts(field, blastScene(loop.blasts, current, t, BLAST_TICKS, layout.view));
  drawHpBars(field, hpBarScene(current, units, layout.view));
  hud.draw(hudScene(previous, current, t, layout.hud, controls.side, controls.selected));
  end.draw(endScene(current, controls.side, layout.end), app.screen);
  app.render();
}

window.addEventListener('resize', () => {
  layout = resize();
  render();
});

if (frozenAt === null) {
  let replayText: string | null = null;
  app.canvas.addEventListener('pointerdown', (event) => {
    const action = tap(controls, loop, layout, event.clientX, event.clientY);
    if (action === 'deck') {
      window.location.assign(window.location.pathname);
    } else if (action === 'again') {
      // A fresh live match on a new seed (new shuffles, a new bot), even after watching a replay.
      window.location.assign(`${window.location.pathname}${matchUrl(freshSeed(Math.random))}`);
    } else if (action === 'save-replay' && replayText !== null) {
      download(`factor-seed-${String(SEED)}.json`, replayText);
    }
  });
  app.ticker.add((ticker) => {
    advance(loop, ticker.elapsedMS);
    if (loop.current.result !== null && replayText === null) {
      replayText = saveReplay(loopReplay(SEED, DECKS, loop));
      // A watched replay is already saved somewhere; only a new match becomes the last one.
      if (watched === null) {
        remember(replayText);
      }
    }
    render();
  });
  app.start();
}
render();

// `pnpm shots` waits for this before capturing.
document.documentElement.dataset.renderer = app.renderer.name;
document.documentElement.dataset.ready = 'true';

/** Puts why the page can't go on where the player sees it, then fails as before (so `pnpm shots` reports it too). */
function showError(error: unknown): never {
  const message = document.createElement('pre');
  message.style.cssText = 'color:#fff;padding:16px;white-space:pre-wrap;font:14px sans-serif';
  message.textContent = error instanceof Error ? error.message : String(error);
  app.canvas.remove();
  document.body.append(message);
  throw error;
}

function stored(): string | null {
  return storedText(REPLAY_STORAGE_KEY);
}

/** What the browser keeps under `key`; nothing if storage is blocked. */
function storedText(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not fetch the replay ${url}: ${String(response.status)} ${response.statusText}`);
  }
  // The dev server answers an unknown path with the page itself.
  if (response.headers.get('content-type')?.includes('text/html') === true) {
    throw new Error(`Could not fetch the replay ${url}: there is no such file`);
  }
  return response.text();
}

/** Keeps the replay as the last finished match's. Storage can be full or blocked; the match is over either way. */
function remember(replay: string): void {
  try {
    window.localStorage.setItem(REPLAY_STORAGE_KEY, replay);
    document.documentElement.dataset.replaySaved = 'true';
  } catch (error) {
    console.warn('The replay could not be saved in localStorage', error);
  }
}

/** Hands `text` to the browser as a file download. */
function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
