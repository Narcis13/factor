import { BOT_TUNING, DECK_CARD_IDS, matchSetup, STARTER_DECKS } from '@factor/content';
import { createMatch, nextBelow, seedRng, step, type CardId, type Command, type SimState, type Unit } from '@factor/sim';
import { expect, test } from 'vitest';
import { botTurn, createBot, createHeuristicBot, heuristicTurn, playBotMatch, type Bot } from '../src/index.ts';
import { replayChecked } from './fixtures.ts';

const TUNING = BOT_TUNING.heuristic;

// The arena: the river at y 15000–17000; side 0 holds y below it. Side 0's Outposts stand on
// 2000–5000 and 13000–16000 × 5000–8000, its Keep on 7000–11000 × 1000–5000.

/**
 * A side-0 bot's view: a match on `deck` with side 0 holding `hand` (in that order) and `energy`, and
 * side 1's `enemies` on the field (their cards must be in the deck for the match to know them).
 */
function position(hand: CardId[], energy: number, enemies: Partial<Unit>[] = [], deck: CardId[] = [...hand, ...DECK_CARD_IDS.filter((id) => !hand.includes(id))].slice(0, 8)): SimState {
  const start = createMatch(matchSetup(5, [deck, deck]));
  const queue = deck.filter((id) => !hand.includes(id));
  const units = enemies.map((unit, i): Unit => {
    const card = start.cards[unit.card ?? ''];
    const hp = card === undefined || card.type === 'spell' ? 1 : card.unit.hp;
    return { id: start.nextId + i, side: 1, card: 'warden', x: 9000, y: 20_000, hp, maxHp: hp, deployTicks: 0, age: 0, targetId: null, cooldown: 0, ...unit };
  });
  const players: SimState['players'] = [{ ...start.players[0], hand: [...hand], queue, energy, energyProgress: 0 }, start.players[1]];
  return { ...start, tick: 100, players, units, nextId: start.nextId + units.length };
}

/** The bot's first play within `ticks` of `state`, stepping the match (and the enemies) as it waits. */
function firstPlay(state: SimState, ticks = 40): { command: Command; card: CardId; state: SimState } | null {
  let bot = createHeuristicBot(0, 5);
  let current = state;
  for (let i = 0; i < ticks; i++) {
    const turn = heuristicTurn(bot, current, TUNING);
    bot = turn.bot;
    const [command] = turn.commands;
    if (command !== undefined) {
      return { command, card: current.players[0].hand[command.handSlot] ?? '', state: current };
    }
    current = step(current, []);
  }
  return null;
}

test('the same seed and field give the same plays, and nothing it is handed is changed', () => {
  const a = playBotMatch(21, STARTER_DECKS, BOT_TUNING, ['heuristic', 'heuristic']);
  const b = playBotMatch(21, STARTER_DECKS, BOT_TUNING, ['heuristic', 'heuristic']);
  expect(a.commands).toEqual(b.commands);
  const state = position(['rabble', 'warden', 'slinger', 'bastion'], 10, [{ card: 'juggernaut', x: 3500, y: 15_500 }]);
  const frozen: unknown = JSON.parse(JSON.stringify(state));
  const bot = createHeuristicBot(0, 5);
  heuristicTurn(bot, state, TUNING);
  expect(state).toEqual(frozen);
  expect(bot).toEqual(createHeuristicBot(0, 5));
});

test.each([3, 8, 13])('seed %i: it only ever plays legal moves, on any deck from the sixteen', (seed) => {
  const rng = seedRng(seed);
  const deck = (): CardId[] => {
    const pool = [...DECK_CARD_IDS];
    return Array.from({ length: 8 }, () => pool.splice(nextBelow(rng, pool.length), 1)[0] ?? 'warden');
  };
  const decks = [deck(), deck()] as const;
  const { commands } = playBotMatch(seed, decks, BOT_TUNING, ['heuristic', 'random']);
  const { rejected } = replayChecked(seed, commands, decks);
  expect(commands.filter((command) => command.side === 0).length).toBeGreaterThan(10);
  expect(rejected.filter((reject) => reject.command.side === 0)).toEqual([]);
});

test('it beats the random bot from either side', () => {
  let wins = 0;
  for (let seed = 0; seed < 10; seed++) {
    wins += playBotMatch(seed, STARTER_DECKS, BOT_TUNING, ['heuristic', 'random']).state.result?.winner === 0 ? 1 : 0;
    wins += playBotMatch(seed, STARTER_DECKS, BOT_TUNING, ['random', 'heuristic']).state.result?.winner === 1 ? 1 : 0;
  }
  expect(wins).toBeGreaterThanOrEqual(18);
});

test('a tank coming over the bridge is answered on its own half, with a building to pull it if it holds one', () => {
  const play = firstPlay(position(['bastion', 'warden', 'slinger', 'rabble'], 7, [{ card: 'juggernaut', x: 3500, y: 16_500 }]));
  expect(play?.card).toBe('bastion');
  // In front of the Keep, between it and the lane the tank comes down.
  expect(play?.command.y).toBeLessThan(15_000);
  expect(play?.command.y).toBeGreaterThan(5000);
  expect(play?.command.x).toBeGreaterThan(3500);
  expect(play?.command.x).toBeLessThan(11_000);
});

test('without a building, a tank is met by the fighter that answers it best, between it and the towers', () => {
  const play = firstPlay(position(['warden', 'rabble', 'flare', 'harrier'], 7, [{ card: 'juggernaut', x: 3500, y: 16_500 }]));
  expect(['warden', 'rabble', 'harrier']).toContain(play?.card);
  expect(play?.command.y).toBeLessThan(15_000);
  expect(Math.abs((play?.command.x ?? 0) - 3500)).toBeLessThanOrEqual(2000);
});

test('a swarm worth more than the spell gets the spell', () => {
  const wisps = [0, 1, 2, 3].map((i) => ({ card: 'wisps', x: 2800 + i * 400, y: 13_000 }));
  const deck = ['spark', 'juggernaut', 'charger', 'airship', 'wisps', 'warden', 'slinger', 'flare'];
  const play = firstPlay(position(['spark', 'juggernaut', 'charger', 'airship'], 5, wisps, deck));
  expect(play?.card).toBe('spark');
  expect(Math.abs((play?.command.x ?? 0) - 3400)).toBeLessThanOrEqual(1000);
  expect(play?.command.y).toBe(13_000);
});

test('flyers are only answered with cards that can hit them', () => {
  const deck = ['warden', 'rabble', 'slinger', 'juggernaut', 'airship', 'flare', 'bastion', 'harrier'];
  const play = firstPlay(position(['warden', 'rabble', 'slinger', 'juggernaut'], 9, [{ card: 'airship', x: 3500, y: 13_000 }], deck));
  expect(play?.card).toBe('slinger');
});

test('with the field quiet it saves up, then pushes the weaker lane with its toughest troop at the bridge', () => {
  const quiet = position(['juggernaut', 'slinger', 'warden', 'flare'], 6);
  expect(firstPlay(quiet, 10)).toBeNull();
  // Side 1's right Outpost (tower 5) is hurt, so the right lane is the weaker.
  const ready = position(['juggernaut', 'slinger', 'warden', 'flare'], 9);
  const hurt = { ...ready, towers: ready.towers.map((tower) => (tower.id === 5 ? { ...tower, hp: 1000 } : tower)) };
  const play = firstPlay(hurt, 5);
  expect(play?.card).toBe('juggernaut');
  expect(play?.command).toMatchObject({ x: 14_500, y: 13_500 });
});

test('it finishes a tower a spell can bring down', () => {
  const ready = position(['flare', 'juggernaut', 'warden', 'slinger'], 4);
  const weak = { ...ready, towers: ready.towers.map((tower) => (tower.id === 4 ? { ...tower, hp: 120 } : tower)) };
  const play = firstPlay(weak, 5);
  expect(play?.card).toBe('flare');
  expect(play?.command).toMatchObject({ x: 3500, y: 25_500 });
});

test('it never sits on full energy for long', () => {
  let full = 0;
  let total = 0;
  for (let seed = 0; seed < 4; seed++) {
    let state = createMatch(matchSetup(seed));
    const bots: Bot[] = [createBot('heuristic', 0, seed, state, BOT_TUNING), createBot('random', 1, seed, state, BOT_TUNING)];
    while (state.result === null) {
      const commands: Command[] = [];
      bots.forEach((bot, side) => {
        const turn = botTurn(bot, state, BOT_TUNING);
        bots[side] = turn.bot;
        commands.push(...turn.commands);
      });
      state = step(state, commands);
      total++;
      full += state.players[0].energy === state.rules.energy.max ? 1 : 0;
    }
  }
  // Under 2% of the match.
  expect(full * 50).toBeLessThan(total);
});
