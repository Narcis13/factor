// The deck builder (VISION §8, Stage 3): the sixteen cards, the eight in the deck, and Battle. Plain DOM:
// it's a menu, not the arena. Placeholder look until art direction is decided (VISION §11).
import { MATCH_RULES, STARTER_DECK, type ContentCardId } from '@factor/content';
import { cardSummaries, DECK_STORAGE_KEY, isComplete, matchUrl, storedDeck, toggleCard, type CardSummary } from './deck-builder.ts';
import { freshSeed } from './url-params.ts';
import { cardColor } from './palette.ts';

const STYLE = `
  .menu { box-sizing: border-box; height: 100%; overflow-y: auto; padding: 16px; color: #e8eaed; font: 14px/1.3 sans-serif; max-width: 720px; margin: 0 auto; }
  .menu h1 { margin: 4px 0 2px; font-size: 28px; letter-spacing: 1px; }
  .menu p { margin: 0 0 12px; color: #9aa3ad; }
  .deck { display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px; margin-bottom: 10px; }
  .slot { aspect-ratio: 4 / 5; border-radius: 6px; border: 2px dashed #3a4a5c; display: flex; align-items: flex-end; justify-content: center; font-size: 10px; padding: 2px; overflow: hidden; }
  .slot.filled { border-style: solid; border-color: #0d1014; text-shadow: 0 0 3px #000; }
  .slot span { font-size: 9px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar { display: flex; gap: 8px; align-items: center; margin-bottom: 14px; flex-wrap: wrap; }
  .bar .count { flex: 1; color: #9aa3ad; }
  .menu button { font: inherit; cursor: pointer; }
  .battle { background: #ffd23f; color: #14181d; border: none; border-radius: 8px; padding: 10px 22px; font-weight: bold; font-size: 16px; }
  .battle:disabled { background: #3a4a5c; color: #9aa3ad; cursor: default; }
  .plain { background: #1d2733; color: #e8eaed; border: 1px solid #3a4a5c; border-radius: 8px; padding: 9px 14px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
  .card { text-align: left; background: #1d2733; color: #e8eaed; border: 2px solid #0d1014; border-radius: 8px; padding: 8px; display: grid; grid-template-columns: 34px 1fr; gap: 2px 8px; }
  .card.in { border-color: #ffd23f; background: #26323f; }
  .card .swatch { grid-row: span 3; width: 34px; height: 42px; border-radius: 5px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; color: #fff; text-shadow: 0 0 3px #000; }
  .card .name { font-weight: bold; }
  .card .kind { color: #9aa3ad; font-size: 12px; }
  .card .facts { grid-column: 1 / -1; color: #c5cbd2; font-size: 12px; margin-top: 4px; }
`;

/** Renders the deck builder into the page. Battle saves the deck and opens a live match on a fresh seed. */
export function showMenu(): void {
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.append(style);
  const root = document.createElement('div');
  root.className = 'menu';
  document.body.append(root);
  let draft = storedDeck(read());
  const summaries = cardSummaries();

  const render = (): void => {
    root.replaceChildren();
    const title = document.createElement('h1');
    title.textContent = 'Factor';
    const blurb = document.createElement('p');
    blurb.textContent = `Pick ${String(MATCH_RULES.deckSize)} cards, then battle the bot. Tap a card to add or remove it.`;
    root.append(title, blurb, deckRow(draft), controls(), grid());
  };

  const controls = (): HTMLElement => {
    const bar = document.createElement('div');
    bar.className = 'bar';
    const count = document.createElement('span');
    count.className = 'count';
    count.textContent = `${String(draft.length)}/${String(MATCH_RULES.deckSize)} cards · average cost ${averageCost(draft, summaries)}`;
    const starter = button('Starter deck', 'plain', () => {
      draft = [...STARTER_DECK];
      render();
    });
    const battle = button('Battle', 'battle', () => {
      write(JSON.stringify(draft));
      window.location.assign(matchUrl(freshSeed(Math.random)));
    });
    battle.disabled = !isComplete(draft);
    battle.dataset.action = 'battle';
    bar.append(count, starter, battle);
    return bar;
  };

  const grid = (): HTMLElement => {
    const cards = document.createElement('div');
    cards.className = 'cards';
    for (const summary of summaries) {
      const card = button('', `card${draft.includes(summary.id) ? ' in' : ''}`, () => {
        draft = toggleCard(draft, summary.id);
        render();
      });
      card.dataset.card = summary.id;
      card.append(swatch(summary), text('name', summary.name), text('kind', summary.kind), text('facts', summary.facts.join('\n')));
      cards.append(card);
    }
    return cards;
  };

  render();
  document.documentElement.dataset.ready = 'true';
}

function deckRow(draft: readonly ContentCardId[]): HTMLElement {
  const row = document.createElement('div');
  row.className = 'deck';
  for (let i = 0; i < MATCH_RULES.deckSize; i++) {
    const slot = document.createElement('div');
    const card = draft[i];
    slot.className = card === undefined ? 'slot' : 'slot filled';
    if (card !== undefined) {
      slot.style.background = hex(cardColor(card));
      const label = document.createElement('span');
      label.textContent = card;
      slot.title = card;
      slot.append(label);
    }
    row.append(slot);
  }
  return row;
}

function swatch(summary: CardSummary): HTMLElement {
  const element = document.createElement('div');
  element.className = 'swatch';
  element.style.background = hex(cardColor(summary.id));
  element.textContent = String(summary.cost);
  return element;
}

function text(className: string, content: string): HTMLElement {
  const element = document.createElement('div');
  element.className = className;
  element.style.whiteSpace = 'pre-line';
  element.textContent = content;
  return element;
}

function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = label;
  element.addEventListener('click', onClick);
  return element;
}

function averageCost(draft: readonly ContentCardId[], summaries: readonly CardSummary[]): string {
  if (draft.length === 0) {
    return '-';
  }
  const total = draft.reduce((sum, id) => sum + (summaries.find((summary) => summary.id === id)?.cost ?? 0), 0);
  return (total / draft.length).toFixed(1);
}

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
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
