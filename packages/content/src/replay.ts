import type { Command } from '@factor/sim';
import { z } from 'zod';

/** Bumped whenever the replay format changes. Loading any other version fails. */
export const REPLAY_VERSION = 0;

// Annotated so a replay's commands are exactly what the sim steps with.
const CommandSchema: z.ZodType<Command> = z.strictObject({
  tick: z.int().nonnegative(),
  side: z.literal([0, 1]),
  handSlot: z.int(),
  x: z.int(),
  y: z.int(),
});

/** Card ids. Decks stay empty until cards exist (Stage 1). */
const DeckSchema = z.array(z.string());

/**
 * `{ version, seed, decks, commands }` (VISION §5). The sim trusts `Command` field types, so anything
 * loaded from outside goes through here: strict objects (an extra key would end up in the state hash),
 * integers only, and commands in tick order.
 */
const ReplaySchema = z.strictObject({
  version: z.literal(REPLAY_VERSION),
  seed: z.uint32(),
  decks: z.tuple([DeckSchema, DeckSchema]),
  commands: z.array(CommandSchema).superRefine((commands, ctx) => {
    for (let i = 1; i < commands.length; i++) {
      const [previous, current] = [commands[i - 1], commands[i]];
      if (previous !== undefined && current !== undefined && current.tick < previous.tick) {
        ctx.addIssue({
          code: 'custom',
          message: `Commands must be in tick order: tick ${String(current.tick)} follows tick ${String(previous.tick)}`,
          path: [i, 'tick'],
        });
      }
    }
  }),
});

/** A seed plus the command log: enough to reproduce a match exactly. */
export type Replay = z.infer<typeof ReplaySchema>;

/** Validates untrusted JSON as a replay. Throws with every problem and where it is. */
export function parseReplay(json: unknown): Replay {
  const parsed = ReplaySchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`Invalid replay:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

/** Parses and validates a replay file's text. */
export function loadReplay(text: string): Replay {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid replay: not JSON (${String(error)})`, { cause: error });
  }
  return parseReplay(json);
}

/** The text of a replay file. Validates first, so nothing is saved that can't be loaded back. */
export function saveReplay(replay: Replay): string {
  return `${JSON.stringify(parseReplay(replay), null, 2)}\n`;
}
