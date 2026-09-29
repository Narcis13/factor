import { TICKS_PER_SECOND } from '@factor/sim';

const USAGE = `factor sim (${String(TICKS_PER_SECOND)} ticks/s)

Usage: pnpm sim <command>

No commands yet.`;

const [command] = process.argv.slice(2);

if (command === undefined || command === 'help') {
  console.log(USAGE);
} else {
  console.error(`Unknown command: ${command}\n\n${USAGE}`);
  process.exitCode = 1;
}
