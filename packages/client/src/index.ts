// The PixiJS view (VISION §5). main.ts is the browser entry; this exports the parts that don't need a browser.
export {
  arenaScene,
  blastScene,
  fitView,
  groundScene,
  hpBarScene,
  noDeployRect,
  pointToScreen,
  projectileScene,
  splashScene,
  toScreen,
  towerScene,
  unitScene,
  type BlastShape,
  type GroundKind,
  type HpBar,
  type ProjectileShape,
  type ScreenRect,
  type Shape,
  type SplashShape,
  type UnitShape,
  type View,
} from './arena-view.ts';
export { REPLAY_STORAGE_KEY } from './match-replay.ts';
export { layoutScreen, toArena, type ScreenLayout, type ScreenPoint } from './screen-layout.ts';
