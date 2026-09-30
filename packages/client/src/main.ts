// Browser entry. Runs a match live at 20 ticks/s; side 0 plays by tapping a card, then the arena,
// against a random bot on side 1. `?tick=<n>` instead plays the match to tick n with no taps and
// freezes it there (for `pnpm shots`). When a live match ends, its replay is saved in localStorage
// and the end screen offers a rematch or the replay as a file.
import { createRandomBot } from '@factor/bot';
import { BOT_TUNING, matchSetup, saveReplay, STARTER_DECKS } from '@factor/content';
import { createMatch } from '@factor/sim';
import { Application, Graphics } from 'pixi.js';
import { blastScene, groundScene, hpBarScene, noDeployRect, toScreen, towerScene, unitScene } from './arena-view.ts';
import { tap, type Controls } from './controls.ts';
import { BACKGROUND, drawArena, drawBlasts, drawHpBars, drawNoDeploy, drawUnits } from './draw-arena.ts';
import { EndView } from './draw-end.ts';
import { HudView } from './draw-hud.ts';
import { endScene } from './end-view.ts';
import { hudScene } from './hud-view.ts';
import { advance, alpha, BLAST_TICKS, createLoop, runTo } from './match-loop.ts';
import { loopReplay, REPLAY_STORAGE_KEY } from './match-replay.ts';
import { layoutScreen, type ScreenLayout } from './screen-layout.ts';

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

const frozenAt = parseTick(new URLSearchParams(window.location.search).get('tick'));
const SEED = 0;
const DECKS = STARTER_DECKS;
const start = createMatch(matchSetup(SEED, DECKS));
const loop = createLoop(start, [createRandomBot(1, SEED, start, BOT_TUNING)]);
if (frozenAt !== null) {
  runTo(loop, frozenAt);
}
const controls: Controls = { side: 0, selected: null };

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

/** Towers, the no-deploy shade while a troop is selected, units, recent spells and hp bars, then the HUD: every frame. */
function render(): void {
  const { previous, current } = loop;
  const t = alpha(loop);
  field.clear();
  drawArena(field, towerScene(current, layout.view));
  const selected = controls.selected === null ? undefined : current.players[controls.side].hand[controls.selected];
  if (selected !== undefined && current.cards[selected]?.type === 'troop') {
    drawNoDeploy(field, toScreen(layout.view, noDeployRect(current.arena, controls.side)));
  }
  const units = unitScene(previous, current, t, layout.view);
  drawUnits(field, units);
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
    if (action === 'again') {
      window.location.reload();
    } else if (action === 'save-replay' && replayText !== null) {
      download(`factor-seed-${String(SEED)}.json`, replayText);
    }
  });
  app.ticker.add((ticker) => {
    advance(loop, ticker.elapsedMS);
    if (loop.current.result !== null && replayText === null) {
      replayText = saveReplay(loopReplay(SEED, DECKS, loop));
      remember(replayText);
    }
    render();
  });
  app.start();
}
render();

// `pnpm shots` waits for this before capturing.
document.documentElement.dataset.renderer = app.renderer.name;
document.documentElement.dataset.ready = 'true';

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

function parseTick(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) {
    return null;
  }
  return Number(value);
}
