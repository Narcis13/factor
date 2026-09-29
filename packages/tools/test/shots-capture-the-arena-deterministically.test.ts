import { expect, test } from 'vitest';
import { SHOT_VIEWPORT, shootArena } from '../src/shots.ts';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Width and height from the IHDR chunk, which always comes first. */
function pngSize(png: Buffer) {
  expect(png.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
  expect(png.toString('latin1', 12, 16)).toBe('IHDR');
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

// Needs Chromium: pnpm --filter @factor/tools exec playwright install --only-shell chromium
test('two shots of the arena are the same PNG, at the viewport size, drawn with WebGL', { timeout: 60_000 }, async () => {
  const first = await shootArena();
  const second = await shootArena();
  expect(pngSize(first.png)).toEqual(SHOT_VIEWPORT);
  expect(first.renderer).toBe('webgl');
  expect(second.png.equals(first.png)).toBe(true);
});
