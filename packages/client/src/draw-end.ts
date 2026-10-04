import { Container, Graphics, Text } from 'pixi.js';
import type { ScreenRect } from './arena-view.ts';
import { drawStars, FONT } from './draw-hud.ts';
import type { EndScene, Outcome } from './end-view.ts';

const SHADE = 0x000000;
const PANEL = 0x1d2733;
const PANEL_EDGE = 0x0d1014;
const BUTTON = 0x3a4a5c;
const TITLE: Record<Outcome, { text: string; color: number }> = {
  victory: { text: 'Victory', color: 0xffd23f },
  defeat: { text: 'Defeat', color: 0xd9d9d9 },
  draw: { text: 'Draw', color: 0xd9d9d9 },
};

/** The end screen's retained Pixi objects: hidden while the match runs. */
export class EndView {
  readonly root = new Container();
  private readonly shapes = new Graphics();
  private readonly title = new Text({ text: '', anchor: 0.5, style: { ...FONT, fontSize: 40, fontWeight: 'bold', stroke: { color: 0x000000, width: 5 } } });
  private readonly again = new Text({ text: 'Play again', anchor: 0.5, style: { ...FONT, fontSize: 15, fontWeight: 'bold' } });
  private readonly deck = new Text({ text: 'Deck', anchor: 0.5, style: { ...FONT, fontSize: 15, fontWeight: 'bold' } });
  private readonly save = new Text({ text: 'Save replay', anchor: 0.5, style: { ...FONT, fontSize: 15, fontWeight: 'bold' } });
  private readonly note = new Text({ text: '', anchor: 0.5, style: { ...FONT, fontSize: 14, fill: 0xd9d9d9 } });

  constructor() {
    this.root.addChild(this.shapes, this.title, this.note, this.again, this.deck, this.save);
    this.root.visible = false;
  }

  /** Shades the whole `screen` and puts the result panel over it. */
  draw(scene: EndScene | null, screen: { width: number; height: number }): void {
    this.root.visible = scene !== null;
    if (scene === null) {
      return;
    }
    const g = this.shapes.clear();
    g.rect(0, 0, screen.width, screen.height).fill({ color: SHADE, alpha: 0.5 });
    const { x, y, width, height } = scene.panel;
    g.roundRect(x, y, width, height, 12).fill({ color: PANEL }).stroke({ color: PANEL_EDGE, width: 3 });
    const title = TITLE[scene.outcome];
    this.title.text = title.text;
    this.title.style.fill = title.color;
    this.title.position.set(scene.titleAt.x, scene.titleAt.y);
    drawStars(g, scene.stars);
    this.note.visible = scene.note !== null;
    this.note.text = scene.note ?? '';
    this.note.position.set(scene.noteAt.x, scene.noteAt.y);
    button(g, this.again, scene.again);
    button(g, this.deck, scene.deck);
    button(g, this.save, scene.save);
  }
}

function button(g: Graphics, label: Text, rect: ScreenRect): void {
  g.roundRect(rect.x, rect.y, rect.width, rect.height, 8).fill({ color: BUTTON }).stroke({ color: PANEL_EDGE, width: 2 });
  label.position.set(rect.x + rect.width / 2, rect.y + rect.height / 2);
}
