// Browser entry. Draws the arena once per resize; there is no match to animate yet.
import { ARENA } from '@factor/content';
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

const arena = new Graphics();
app.stage.addChild(arena);

function layout(): void {
  app.renderer.resize(window.innerWidth, window.innerHeight);
  arena.clear();
  drawArena(arena, arenaScene(ARENA, fitView(ARENA, window.innerWidth, window.innerHeight)));
  app.render();
}

layout();
window.addEventListener('resize', layout);

// `pnpm shots` waits for this before capturing.
document.documentElement.dataset.renderer = app.renderer.name;
document.documentElement.dataset.ready = 'true';
