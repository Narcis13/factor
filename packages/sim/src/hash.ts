/**
 * Canonical JSON: object keys sorted, no whitespace. Throws on anything that isn't
 * plain JSON with safe integers, so a float, `undefined`, Map or class instance
 * in sim state fails loudly the first time the state is hashed.
 */
export function canonicalJson(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      if (!Number.isSafeInteger(value)) {
        throw new TypeError(`State numbers must be safe integers, got ${String(value)}`);
      }
      return String(value);
    case 'string':
      return JSON.stringify(value);
    case 'object': {
      if (Array.isArray(value)) {
        return `[${value.map(canonicalJson).join(',')}]`;
      }
      const proto: unknown = Object.getPrototypeOf(value);
      if (proto !== Object.prototype && proto !== null) {
        throw new TypeError('State objects must be plain objects');
      }
      const record = value as Record<string, unknown>;
      const fields = Object.keys(record)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`);
      return `{${fields.join(',')}}`;
    }
    default:
      throw new TypeError(`State values must be plain JSON, got ${typeof value}`);
  }
}

/**
 * 32-bit FNV-1a over the UTF-16 code units of `text`.
 * For ASCII text this equals standard FNV-1a over the UTF-8 bytes.
 */
export function fnv1a32(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** The hash of a canonical serialization, as 8 hex digits. */
export function hashJson(value: unknown): string {
  return fnv1a32(canonicalJson(value)).toString(16).padStart(8, '0');
}
