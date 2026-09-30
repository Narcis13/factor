import { hashState, type CardId, type RejectReason, type SimState } from '@factor/sim';
import { formatClock, InvariantError, playBotReplay, playReplay } from './match.ts';

/** A seed whose match went wrong, and how. */
export interface SweepFailure {
  seed: number;
  message: string;
}

/** What a sweep of bot-vs-bot matches found. The tallies cover the matches that played back healthy. */
export interface SweepReport {
  /** The first seed; the sweep plays `from` to `from + matches - 1`. */
  from: number;
  matches: number;
  /** Matches won, indexed by `Side`. */
  wins: [number, number];
  draws: number;
  /** Matches that went past regulation. */
  overtime: number;
  /** Match length in ticks. */
  shortest: number;
  longest: number;
  totalTicks: number;
  /** Stars earned, indexed by `Side`. */
  stars: [number, number];
  /** Hp taken off the enemy's towers, indexed by the `Side` that took it. */
  towerDamage: [number, number];
  /** Plays the sim took, by card, both sides together. */
  plays: Record<CardId, number>;
  /** Plays the sim refused, by reason. */
  rejected: Partial<Record<RejectReason, number>>;
  /** Matches whose playback broke an invariant. */
  violations: SweepFailure[];
  /** Matches whose playback didn't reproduce the live match: another final hash, or a replay that didn't fit. */
  mismatches: SweepFailure[];
}

/**
 * Plays `matches` bot-vs-bot matches on consecutive seeds from `from` (VISION §6 headless sweeps). Each is
 * played live, then played back from its replay with invariants checked every tick, and the two final
 * hashes must agree. A failing match is recorded and the sweep goes on. `onMatch` hears each finished seed.
 */
export function sweep(from: number, matches: number, onMatch?: (seed: number) => void): SweepReport {
  const report: SweepReport = {
    from,
    matches,
    wins: [0, 0],
    draws: 0,
    overtime: 0,
    shortest: 0,
    longest: 0,
    totalTicks: 0,
    stars: [0, 0],
    towerDamage: [0, 0],
    plays: {},
    rejected: {},
    violations: [],
    mismatches: [],
  };
  let healthy = 0;
  for (let seed = from; seed < from + matches; seed++) {
    const match = sweepMatch(seed);
    if ('failure' in match) {
      (match.failure === 'violation' ? report.violations : report.mismatches).push({ seed, message: match.message });
    } else {
      tally(report, match, healthy === 0);
      healthy++;
    }
    onMatch?.(seed);
  }
  return report;
}

interface MatchTally {
  state: SimState;
  plays: Record<CardId, number>;
  rejected: Partial<Record<RejectReason, number>>;
}

type MatchOutcome = MatchTally | { failure: 'violation' | 'mismatch'; message: string };

function sweepMatch(seed: number): MatchOutcome {
  const live = playBotReplay(seed);
  const { commands } = live.replay;
  const plays: Record<CardId, number> = {};
  const rejected: Partial<Record<RejectReason, number>> = {};
  let next = 0;
  // A taken play sends its card to the back of the queue, so a side's last `taken` queue cards are its plays.
  const countPlays = (state: SimState): void => {
    const taken: [number, number] = [0, 0];
    for (let command = commands[next]; command?.tick === state.tick - 1; command = commands[++next]) {
      taken[command.side]++;
    }
    for (const { command, reason } of state.rejected) {
      taken[command.side]--;
      rejected[reason] = (rejected[reason] ?? 0) + 1;
    }
    for (const side of [0, 1] as const) {
      const { queue } = state.players[side];
      for (const card of queue.slice(queue.length - taken[side])) {
        plays[card] = (plays[card] ?? 0) + 1;
      }
    }
  };
  let state: SimState;
  try {
    state = playReplay(live.replay, undefined, countPlays);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { failure: error instanceof InvariantError ? 'violation' : 'mismatch', message };
  }
  const [liveHash, playedHash] = [hashState(live.state), hashState(state)];
  if (liveHash !== playedHash) {
    return { failure: 'mismatch', message: `live match hashed ${liveHash}, its replay ${playedHash}` };
  }
  return { state, plays, rejected };
}

function tally(report: SweepReport, { state, plays, rejected }: MatchTally, first: boolean): void {
  const { result, tick, rules, stars, towers } = state;
  if (result === null || result.winner === null) {
    report.draws++;
  } else {
    report.wins[result.winner]++;
  }
  if (tick > rules.regulationTicks) {
    report.overtime++;
  }
  report.shortest = first ? tick : Math.min(report.shortest, tick);
  report.longest = Math.max(report.longest, tick);
  report.totalTicks += tick;
  for (const side of [0, 1] as const) {
    report.stars[side] += stars[side];
  }
  for (const tower of towers) {
    report.towerDamage[tower.side === 0 ? 1 : 0] += tower.maxHp - tower.hp;
  }
  for (const [card, count] of Object.entries(plays)) {
    report.plays[card] = (report.plays[card] ?? 0) + count;
  }
  for (const [reason, count] of Object.entries(rejected) as [RejectReason, number][]) {
    report.rejected[reason] = (report.rejected[reason] ?? 0) + count;
  }
}

/** The report as aligned lines; failures last, each with the command that reproduces it. */
export function describeSweep(report: SweepReport): string {
  const { from, matches, wins, draws, overtime, shortest, longest, totalTicks, stars, towerDamage } = report;
  const { violations, mismatches } = report;
  const healthy = matches - violations.length - mismatches.length;
  const bySide = ([a, b]: [number, number]): string => `side 0 ${String(a)} · side 1 ${String(b)}`;
  const byKey = (counts: Record<string, number | undefined>): string => {
    const keys = Object.keys(counts).sort();
    return keys.length === 0 ? 'none' : keys.map((key) => `${key} ${String(counts[key])}`).join(' · ');
  };
  const length =
    healthy === 0
      ? 'none'
      : `shortest ${formatClock(shortest)} · mean ${formatClock(Math.round(totalTicks / healthy))} · longest ${formatClock(longest)} · ${String(overtime)} to overtime`;
  const lines = [
    `seeds       ${String(from)}..${String(from + matches - 1)} (${String(matches)} matches, ${String(healthy)} healthy)`,
    `results     ${bySide(wins)} · draw ${String(draws)}`,
    `length      ${length}`,
    `stars       ${bySide(stars)}`,
    `tower dmg   ${bySide(towerDamage)}`,
    `plays       ${byKey(report.plays)}`,
    `rejected    ${byKey(report.rejected)}`,
    `violations  ${String(violations.length)}`,
    `mismatches  ${String(mismatches.length)}`,
  ];
  for (const [kind, failures] of [
    ['violation', violations],
    ['mismatch', mismatches],
  ] as const) {
    for (const { seed, message } of failures) {
      lines.push(`\n${kind} at seed ${String(seed)} (pnpm sim match --seed ${String(seed)}):\n  ${message.replaceAll('\n', '\n  ')}`);
    }
  }
  return lines.join('\n');
}
