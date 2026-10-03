import { expect, test } from 'vitest';
import { freshSeed, parseSeed, parseTick } from '../src/url-params.ts';

test('?tick= and ?seed= take plain whole numbers only', () => {
  expect(parseTick('600')).toBe(600);
  expect(parseTick(null)).toBeNull();
  for (const bad of ['', '-1', '1.5', '6e2', ' 600', 'abc']) {
    expect(parseTick(bad)).toBeNull();
  }
  expect(parseSeed('0')).toBe(0);
  expect(parseSeed('4294967295')).toBe(4_294_967_295);
  expect(parseSeed('4294967296')).toBeNull();
});

test('a fresh seed is a uint32 drawn from the client’s randomness', () => {
  expect(freshSeed(() => 0)).toBe(0);
  expect(freshSeed(() => 0.5)).toBe(2_147_483_648);
  expect(freshSeed(() => 0.999_999_999_999)).toBeLessThan(4_294_967_296);
});
