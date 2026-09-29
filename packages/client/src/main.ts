// Browser entry. Runs a match live at 20 ticks/s; side 0 plays by tapping a card, then the arena.
// `?tick=<n>` instead steps the match to tick n with no commands and freezes it there (for `pnpm shots`).
import { matchSetup } from '@factor/content';
import { createMatch } from '@factor/sim';
import { Application, Graphics } from 'pixi.js';
import { blastScene, groundScene, hpBarScene, noDeployRect, toScreen, towerScene, unitScene } from './arena-view.ts';
import { tap, type Controls } from './controls.ts';
import { BACKGROUND, drawArena, drawBlasts, drawHpBars, drawNoDeploy, drawUnits } from './draw-arena.ts';
import { HudView } from './draw-hud.ts';
import { hudScene } from './hud-view.ts';
import { advance, alpha, BLAST_TICKS, createLoop, stepTo } from './match-loop.ts';
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
const start = createMatch(matchSetup(0));
const loop = createLoop(frozenAt === null ? start : stepTo(start, frozenAt));
const controls: Controls = { side: 0, selected: null };

const ground = new Graphics();
const field = new Graphics();
const hud = new HudView();
app.stage.addChild(ground, field, hud.root);
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
  app.render();
}

window.addEventListener('resize', () => {
  layout = resize();
  render();
});

if (frozenAt === null) {
  app.canvas.addEventListener('pointerdown', (event) => {
    tap(controls, loop, layout, event.clientX, event.clientY);
  });
  app.ticker.add((ticker) => {
    advance(loop, ticker.elapsedMS);
    render();
  });
  app.start();
}
render();

// `pnpm shots` waits for this before capturing.
document.documentElement.dataset.renderer = app.renderer.name;
document.documentElement.dataset.ready = 'true';

function parseTick(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) {
    return null;
  }
  return Number(value);
}
