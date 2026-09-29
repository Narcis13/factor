import { expect, test } from 'vitest';
import { canonicalJson, fnv1a32, hashJson } from '../src/index.ts';

test.each([
  { text: '', expected: 0x811c9dc5 },
  { text: 'a', expected: 0xe40c292c },
  { text: 'foobar', expected: 0xbf9cf968 },
])('fnv1a32("$text") matches the published FNV-1a vector', ({ text, expected }) => {
  expect(fnv1a32(text)).toBe(expected);
});

test('key insertion order does not change the serialization or the hash', () => {
  const p = { b: 1, a: { d: [3, 2], c: 'x' } };
  const q = { a: { c: 'x', d: [3, 2] }, b: 1 };
  expect(canonicalJson(p)).toBe('{"a":{"c":"x","d":[3,2]},"b":1}');
  expect(canonicalJson(q)).toBe(canonicalJson(p));
  expect(hashJson(q)).toBe(hashJson(p));
});

test('array order changes the hash', () => {
  expect(hashJson([1, 2])).not.toBe(hashJson([2, 1]));
});

test('the hash is 8 hex digits', () => {
  expect(hashJson({})).toMatch(/^[0-9a-f]{8}$/);
});

test.each([
  { label: 'a float', value: { x: 3 / 2 } },
  { label: 'NaN', value: [Number.NaN] },
  { label: 'an unsafe integer', value: Number.MAX_SAFE_INTEGER + 1 },
  { label: 'undefined', value: { hp: undefined } },
  { label: 'a Map', value: new Map() },
  { label: 'a class instance', value: new Error('boom') },
  { label: 'a function', value: () => 0 },
])('state containing $label cannot be hashed', ({ value }) => {
  expect(() => hashJson(value)).toThrow(TypeError);
});
