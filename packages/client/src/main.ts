// Browser entry. Draws a fresh match's state once per resize; nothing steps the match yet.
import { matchSetup } from '@factor/content';
import { createMatch } from '@factor/sim';
import { Application, Graphics } from 'pixi.js';
import { arenaScene, fitView } from './arena-view.ts';
import { BACKGROUND, drawArena } from './draw-arena.ts';

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

const match = createMatch(matchSetup(0));
const arena = new Graphics();
app.stage.addChild(arena);

function layout(): void {
  app.renderer.resize(window.innerWidth, window.innerHeight);
  arena.clear();
  drawArena(arena, arenaScene(match, fitView(match.arena, window.innerWidth, window.innerHeight)));
  app.render();
}

layout();
window.addEventListener('resize', layout);

// `pnpm shots` waits for this before capturing.
document.documentElement.dataset.renderer = app.renderer.name;
document.documentElement.dataset.ready = 'true';
