import type { MatchResult, Side, SimState } from '@factor/sim';
import type { ScreenRect } from './arena-view.ts';
import { starPips, type StarPip } from './hud-view.ts';
import type { EndLayout, ScreenPoint } from './screen-layout.ts';

/** How the match ended for one side. */
export type Outcome = 'victory' | 'defeat' | 'draw';

/** What a tap on the end screen asks for. */
export type EndAction = 'again' | 'deck' | 'save-replay';

/** The result panel as one side sees it. */
export interface EndScene {
  outcome: Outcome;
  panel: ScreenRect;
  titleAt: ScreenPoint;
  /** The viewer's stars on the left, the opponent's on the right. */
  stars: StarPip[];
  /** Why the match was decided, when the stars don't say: the tower-hp tiebreak (VISION §4). `null` otherwise. */
  note: string | null;
  /** The center of the note, between the stars and the buttons. */
  noteAt: ScreenPoint;
  again: ScreenRect;
  deck: ScreenRect;
  save: ScreenRect;
}

/** The end screen for `side`, or `null` while the match runs. */
export function endScene(state: Pick<SimState, 'result' | 'stars'>, side: Side, layout: EndLayout): EndScene | null {
  if (state.result === null) {
    return null;
  }
  const opponent = side === 0 ? 1 : 0;
  const starsBottom = (layout.stars.left[0]?.y ?? layout.title.y) + layout.starRadius;
  const tiebreak = state.result.winner !== null && state.stars[0] === state.stars[1];
  return {
    outcome: outcome(state.result, side),
    panel: layout.panel,
    titleAt: layout.title,
    stars: [...starPips(state, side, layout.stars.left, layout.starRadius), ...starPips(state, opponent, layout.stars.right, layout.starRadius)],
    note: tiebreak ? 'Stars tied: decided on tower hp' : null,
    noteAt: { x: layout.title.x, y: Math.round((starsBottom + layout.again.y) / 2) },
    again: layout.again,
    deck: layout.deck,
    save: layout.save,
  };
}

export function outcome(result: MatchResult, side: Side): Outcome {
  if (result.winner === null) {
    return 'draw';
  }
  return result.winner === side ? 'victory' : 'defeat';
}
