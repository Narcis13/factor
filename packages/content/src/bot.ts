import { TICKS_PER_SECOND } from '@factor/sim';

/** How the random bot paces itself. Ticks. */
export interface BotTuning {
  /** After a play (and at the start), the bot waits at least this long before its next one... */
  minWaitTicks: number;
  /** ...and at most this long, plus however long it takes to afford the card it picked. */
  maxWaitTicks: number;
}

/** The Stage 1 random bot: 1 to 4 s between plays, so it spends about as fast as energy comes in. */
export const BOT_TUNING: BotTuning = {
  minWaitTicks: TICKS_PER_SECOND,
  maxWaitTicks: 4 * TICKS_PER_SECOND,
};
