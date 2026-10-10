// The deck builder (VISION §8, Stage 3): the sixteen cards, the eight in the deck, and Battle. Plain DOM:
// it's a menu, not the arena; every picture in it is pixel art drawn on canvases (D8).
import { CARDS, MATCH_RULES, STARTER_DECK, type ContentCardId } from '@factor/content';
import { INK, RAMPS, TEAM } from './art/color.ts';
import { TINY, goldText, textImage, WHITE_TEXT } from './art/font.ts';
import { blit, image } from './art/image.ts';
import { button, cardFace, greyed, icon, panel, SLATE } from './art/ui.ts';
import { cardSummaries, DECK_STORAGE_KEY, isComplete, matchUrl, storedDeck, toggleCard, type CardSummary } from './deck-builder.ts';
import { dataUrl, pixelCanvas, pixelText } from './pixel-dom.ts';
import { freshSeed } from './url-params.ts';

/** CSS pixels per art pixel in the menu. */
const PX = 2;

function style(): string {
  const slate = dataUrl(panel(24, 24, 'slate'));
  const picked = dataUrl(panel(24, 24, 'slate', { trim: RAMPS.gold }));
  const wood = dataUrl(panel(24, 24, 'wood'));
  const ground = dataUrl(backdrop());
  return `
  html, body { height: 100%; }
  body { background: #17151f url(${ground}) repeat; background-size: ${String(64 * PX)}px; image-rendering: pixelated; }
  .menu { box-sizing: border-box; height: 100%; overflow-y: auto; padding: 16px; max-width: 760px; margin: 0 auto; image-rendering: pixelated; }
  .menu * { image-rendering: pixelated; }
  .head { display: flex; flex-direction: column; align-items: center; gap: 8px; margin: 4px 0 14px; }
  .panel { border-style: solid; border-width: ${String(6 * PX)}px; border-image: url(${slate}) 6 fill / ${String(6 * PX)}px repeat; }
  .wood { border-image-source: url(${wood}); }
  .deck { display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px; justify-items: center; margin-bottom: 10px; }
  .slot { display: flex; align-items: center; justify-content: center; }
  .bar { display: flex; gap: 10px; align-items: center; margin-bottom: 14px; flex-wrap: wrap; }
  .bar .count { flex: 1; }
  .menu button { font: inherit; cursor: pointer; background: none; border: 0; padding: 0; }
  .menu button:disabled { cursor: default; }
  .menu button:focus-visible { outline: 2px solid #f5cf4c; outline-offset: 2px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 8px; }
  .menu .card { text-align: left; display: flex; gap: 10px; align-items: flex-start; border-style: solid; border-width: ${String(6 * PX)}px; border-image: url(${slate}) 6 fill / ${String(6 * PX)}px repeat; }
  .menu .card.in { border-image-source: url(${picked}); }
  .card .text { display: flex; flex-direction: column; gap: 5px; padding-top: 2px; }
  .card:hover .face { transform: translateY(-2px); }
  .face { position: relative; }
  @media (max-width: 640px) { .deck { grid-template-columns: repeat(4, 1fr); row-gap: 8px; } }
  .check { position: absolute; right: -6px; top: -6px; }
`;
}

/** Renders the deck builder into the page. Battle saves the deck and opens a live match on a fresh seed. */
export function showMenu(): void {
  const sheet = document.createElement('style');
  sheet.textContent = style();
  document.head.append(sheet);
  const root = document.createElement('div');
  root.className = 'menu';
  document.body.append(root);
  let draft = storedDeck(read());
  const summaries = cardSummaries();

  const render = (): void => {
    root.replaceChildren(header(), deckRow(draft), controls(), grid());
  };

  const controls = (): HTMLElement => {
    const bar = document.createElement('div');
    bar.className = 'bar panel wood';
    const count = document.createElement('div');
    count.className = 'count';
    const average = averageCost(draft, summaries);
    count.append(
      pixelText(`${String(draft.length)}/${String(MATCH_RULES.deckSize)} CARDS`, { color: isComplete(draft) ? goldText() : WHITE_TEXT, shadow: true }, PX),
      spacer(4),
      pixelText(`AVERAGE COST ${average}`, { font: TINY, color: [0x9aa4c0, 0xc8d0e4], outline: INK }, PX),
    );
    const starter = pixelButton('STARTER DECK', 'deck', TEAM[0], false, () => {
      draft = [...STARTER_DECK];
      render();
    });
    const complete = isComplete(draft);
    const battle = pixelButton('BATTLE', 'swords', RAMPS.gold, !complete, () => {
      write(JSON.stringify(draft));
      window.location.assign(matchUrl(freshSeed(Math.random)));
    });
    battle.disabled = !complete;
    battle.dataset.action = 'battle';
    bar.append(count, starter, battle);
    return bar;
  };

  const grid = (): HTMLElement => {
    const cards = document.createElement('div');
    cards.className = 'cards';
    for (const summary of summaries) {
      const picked = draft.includes(summary.id);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `card${picked ? ' in' : ''}`;
      card.dataset.card = summary.id;
      card.setAttribute('aria-pressed', String(picked));
      card.setAttribute('aria-label', `${summary.name}, ${summary.kind}, cost ${String(summary.cost)}: ${summary.facts.join(', ')}`);
      card.addEventListener('click', () => {
        draft = toggleCard(draft, summary.id);
        render();
      });
      const face = document.createElement('div');
      face.className = 'face';
      face.append(pixelCanvas(cardFace(summary.id, CARDS[summary.id], 36, 46), PX));
      if (picked) {
        const check = pixelCanvas(checkBadge(), PX);
        check.className = 'check';
        face.append(check);
      }
      const text = document.createElement('div');
      text.className = 'text';
      text.append(
        pixelText(summary.name.toUpperCase(), { color: picked ? goldText() : WHITE_TEXT, shadow: true }, PX),
        pixelText(summary.kind.toUpperCase(), { font: TINY, color: kindColor(summary.kind), outline: INK }, PX),
        ...summary.facts.flatMap(wrapFact).map((fact) => pixelText(fact.toUpperCase(), { font: TINY, color: [0xb8bed0, 0xe8ecf4], outline: INK }, PX)),
      );
      card.append(face, text);
      cards.append(card);
    }
    return cards;
  };

  render();
  document.documentElement.dataset.ready = 'true';
}

function header(): HTMLElement {
  const head = document.createElement('div');
  head.className = 'head';
  const logo = image(textImage('FACTOR', { scale: 3 }).width + 26, 30);
  blit(logo, icon('crown', 13), 0, 6);
  blit(logo, textImage('FACTOR', { color: goldText(), scale: 3, shadow: true }), 15, 2);
  blit(logo, icon('crown', 13), logo.width - 13, 6);
  head.append(
    pixelCanvas(logo, PX),
    pixelText(`PICK ${String(MATCH_RULES.deckSize)} CARDS, THEN BATTLE THE BOT.`, { font: TINY, color: [0x9aa4c0, 0xc8d0e4, 0xffffff], outline: INK }, PX),
    pixelText('TAP A CARD TO ADD OR REMOVE IT.', { font: TINY, color: [0x9aa4c0, 0xc8d0e4, 0xffffff], outline: INK }, PX),
  );
  head.firstElementChild?.setAttribute('aria-label', 'Factor');
  return head;
}

function deckRow(draft: readonly ContentCardId[]): HTMLElement {
  const row = document.createElement('div');
  row.className = 'deck panel';
  for (let i = 0; i < MATCH_RULES.deckSize; i++) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    const card = draft[i];
    if (card === undefined) {
      slot.append(pixelCanvas(emptySlot(), PX));
    } else {
      slot.title = card;
      slot.append(pixelCanvas(cardFace(card, CARDS[card], 36, 46), PX));
    }
    row.append(slot);
  }
  return row;
}

/** A pixel button with an icon and a label; greyed while disabled. */
function pixelButton(label: string, mark: 'deck' | 'swords', ramp: readonly number[], disabled: boolean, onClick: () => void): HTMLButtonElement {
  const text = textImage(label, { color: WHITE_TEXT, shadow: true });
  const img = button(text.width + 26, 20, ramp);
  blit(img, icon(mark, 11), 5, 3);
  blit(img, text, 19, 3);
  const element = document.createElement('button');
  element.type = 'button';
  element.setAttribute('aria-label', label.charAt(0) + label.slice(1).toLowerCase());
  element.append(pixelCanvas(disabled ? greyed(img) : img, PX));
  element.addEventListener('click', onClick);
  return element;
}

/** An empty deck slot: a dark recess with a faint plus. */
function emptySlot() {
  const img = panel(36, 46, 'slate', { rivets: false, trim: SLATE });
  for (let d = -3; d <= 3; d++) {
    img.data.set([0x58, 0x50, 0x75, 255], ((23 + d) * 36 + 18) * 4);
    img.data.set([0x58, 0x50, 0x75, 255], (23 * 36 + 18 + d) * 4);
  }
  return img;
}

/** A gold check mark in a dark circle: this card is in the deck. */
function checkBadge() {
  const img = image(11, 11);
  for (let y = 0; y < 11; y++) {
    for (let x = 0; x < 11; x++) {
      const d = (x - 5) ** 2 + (y - 5) ** 2;
      if (d <= 26) {
        img.data.set(d > 18 ? [0x1b, 0x13, 0x25, 255] : [0x2f, 0x2b, 0x40, 255], (y * 11 + x) * 4);
      }
    }
  }
  for (const [x, y] of [[3, 5], [4, 6], [5, 7], [6, 6], [7, 5], [8, 4], [4, 5], [5, 6], [6, 5], [7, 4], [8, 3]] as const) {
    img.data.set([0xf5, 0xcf, 0x4c, 255], (y * 11 + x) * 4);
  }
  return img;
}

/** A tile of the cobbled courtyard the menu stands on. */
function backdrop() {
  const img = image(64, 64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const course = Math.floor(y / 8);
      const mortar = y % 8 === 7 || (x + (course % 2) * 8) % 16 === 15;
      const n = ((x * 7 + y * 13 + course * 5) % 11) / 11;
      const c = (mortar ? SLATE[0] : n > 0.8 ? SLATE[2] : SLATE[1]) ?? 0;
      img.data.set([(c >> 16) & 255, (c >> 8) & 255, c & 255, 255], (y * 64 + x) * 4);
    }
  }
  return img;
}

/** A fact too long for a card's line, split at its dots. */
function wrapFact(fact: string): string[] {
  const parts = fact.split(' · ');
  const lines: string[] = [];
  for (const part of parts) {
    const last = lines[lines.length - 1];
    if (last !== undefined && last.length + part.length + 3 <= 26) {
      lines[lines.length - 1] = `${last} · ${part}`;
    } else {
      lines.push(part);
    }
  }
  return lines;
}

function kindColor(kind: CardSummary['kind']): readonly number[] {
  return kind === 'Spell' ? [0x8f5cb4, 0xc095da] : kind === 'Building' ? [0xa4642e, 0xf0c88a] : [0x6d7e9c, 0xa3b5cc];
}

function spacer(height: number): HTMLElement {
  const element = document.createElement('div');
  element.style.height = `${String(height)}px`;
  return element;
}

function averageCost(draft: readonly ContentCardId[], summaries: readonly CardSummary[]): string {
  if (draft.length === 0) {
    return '-';
  }
  const total = draft.reduce((sum, id) => sum + (summaries.find((summary) => summary.id === id)?.cost ?? 0), 0);
  return (total / draft.length).toFixed(1);
}

/** The kept deck's text. Storage can be blocked; then there is none. */
function read(): string | null {
  try {
    return window.localStorage.getItem(DECK_STORAGE_KEY);
  } catch {
    return null;
  }
}

function write(text: string): void {
  try {
    window.localStorage.setItem(DECK_STORAGE_KEY, text);
  } catch (error) {
    console.warn('The deck could not be saved in localStorage', error);
  }
}

