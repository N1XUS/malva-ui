/**
 * @internal 32-bit FNV-1a over the UTF-16 code units of `text`. Deterministic
 * across engines, so a seed's client id and a peer's default colour are the
 * same on every client and on the server.
 */
export function mlvEditorFnv1a32(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * @internal JSON with object keys sorted at every level, so two structurally
 * equal documents hash the same whatever order their keys were written in.
 * `undefined` members are dropped, as `JSON.stringify` drops them.
 */
export function mlvEditorCanonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => mlvEditorCanonicalJson(item)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const members = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map(
      (key) => `${JSON.stringify(key)}:${mlvEditorCanonicalJson(record[key])}`,
    );
  return `{${members.join(',')}}`;
}
