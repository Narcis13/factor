import type { CardId } from '@factor/sim';
import { Container, Graphics, Text } from 'pixi.js';
import type { HudScene, StarPip } from './hud-view.ts';
import { cardColor, SIDE_COLOR } from './palette.ts';

const CARD_EDGE = 0x0d1014;
const SELECTED_EDGE = 0xffd23f;
const BAR_BACK = 0x2a1d33;
const BAR_FILL = 0xc04fd6;
const BAR_TICK = 0x14181d;
const STAR_EDGE = 0x0d1014;
export const FONT = { fontFamily: 'sans-serif', fill: 0xffffff, stroke: { color: 0x000000, width: 3 } } as const;

/** One card's labels. */
interface CardLabels {
  name: Text;
  cost: Text;
}

/** The HUD's retained Pixi objects. Text objects are reused, so they only re-render when their text changes. */
export class HudView {
  readonly root = new Container();
  private readonly shapes = new Graphics();
  private readonly clock = new Text({ text: '', anchor: { x: 1, y: 0 }, style: { ...FONT, fontSize: 22, fontWeight: 'bold' } });
  private readonly energy = new Text({ text: '', anchor: 0.5, style: { ...FONT, fontSize: 18, fontWeight: 'bold' } });
  private readonly hand: CardLabels[] = [];
  /** `next` above the next card, and its name inside. */
  private readonly next = cardLabels(11);

  constructor() {
    this.root.addChild(this.shapes, this.clock, this.energy, this.next.name, this.next.cost);
  }

  draw(scene: HudScene): void {
    const g = this.shapes.clear();
    while (this.hand.length < scene.hand.length) {
      const labels = cardLabels(14);
      this.hand.push(labels);
      this.root.addChild(labels.name, labels.cost);
    }

    this.clock.text = scene.clock;
    this.clock.position.set(scene.clockAt.x, scene.clockAt.y);

    // Energy bar: the fill, then a notch at each whole energy.
    const bar = scene.energyBar;
    g.rect(bar.x, bar.y, bar.width, bar.height).fill({ color: BAR_BACK });
    g.rect(bar.x, bar.y, bar.width * scene.energyFill, bar.height).fill({ color: BAR_FILL });
    for (let notch = 1; notch < scene.energyMax; notch++) {
      g.rect(Math.round(bar.x + (bar.width * notch) / scene.energyMax) - 1, bar.y, 2, bar.height).fill({ color: BAR_TICK });
    }
    this.energy.text = String(scene.energy);
    this.energy.position.set(bar.x - bar.height, bar.y + bar.height / 2);

    for (const [i, face] of scene.hand.entries()) {
      const { x, y, width, height } = face.rect;
      g.roundRect(x, y, width, height, 6).fill({ color: cardColor(face.card), alpha: face.affordable ? 1 : 0.4 });
      g.roundRect(x, y, width, height, 6).stroke(face.selected ? { color: SELECTED_EDGE, width: 4 } : { color: CARD_EDGE, width: 2 });
      const labels = this.hand[i];
      if (labels !== undefined) {
        placeLabels(labels, face.card, face.cost, face.rect);
        labels.name.alpha = labels.cost.alpha = face.affordable ? 1 : 0.6;
      }
    }
    for (const [i, labels] of this.hand.entries()) {
      labels.name.visible = labels.cost.visible = i < scene.hand.length;
    }

    drawStars(g, scene.stars);

    this.next.name.visible = this.next.cost.visible = scene.next !== null;
    if (scene.next !== null) {
      const { x, y, width, height } = scene.next.rect;
      g.roundRect(x, y, width, height, 4).fill({ color: cardColor(scene.next.card), alpha: 0.7 });
      g.roundRect(x, y, width, height, 4).stroke({ color: CARD_EDGE, width: 2 });
      this.next.cost.text = 'next';
      this.next.cost.style.fontSize = 13;
      this.next.cost.position.set(x + width / 2, y - 10);
      this.next.name.text = scene.next.card;
      this.next.name.position.set(x + width / 2, y + height / 2);
    }
  }
}

/** Five-pointed stars: an earned one is filled in its side's color, the rest are dark and ringed in it. */
export function drawStars(g: Graphics, pips: readonly StarPip[]): void {
  for (const { side, x, y, radius, earned } of pips) {
    g.star(x, y, 5, radius, radius * 0.45)
      .fill(earned ? { color: SIDE_COLOR[side] } : { color: STAR_EDGE, alpha: 0.45 })
      .stroke(earned ? { color: STAR_EDGE, width: 2 } : { color: SIDE_COLOR[side], width: 2 });
  }
}

function cardLabels(fontSize: number): CardLabels {
  return {
    name: new Text({ text: '', anchor: 0.5, style: { ...FONT, fontSize } }),
    cost: new Text({ text: '', anchor: 0.5, style: { ...FONT, fontSize: fontSize + 8, fontWeight: 'bold' } }),
  };
}

function placeLabels(labels: CardLabels, card: CardId, cost: number, rect: { x: number; y: number; width: number; height: number }): void {
  labels.name.text = card;
  labels.name.position.set(rect.x + rect.width / 2, rect.y + rect.height - 14);
  labels.cost.text = String(cost);
  labels.cost.position.set(rect.x + rect.width / 2, rect.y + rect.height / 2 - 6);
}
