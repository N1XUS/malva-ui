import type { MlvTaskboardKey } from './taskboard.types';

/**
 * Canonical lookup token for a board key. The value's runtime type is part of
 * the token, so the number `1` and the string `'1'` never collide in a map or
 * compare equal — board identifiers are matched, never coerced.
 */
export function mlvTaskboardKeyToken(key: MlvTaskboardKey | undefined): string {
  return key === undefined ? 'undefined' : `${typeof key}:${String(key)}`;
}

/** Whether two board keys denote the same column, swimlane, group, or card. */
export function sameMlvTaskboardKey(
  left: MlvTaskboardKey | undefined,
  right: MlvTaskboardKey | undefined,
): boolean {
  return mlvTaskboardKeyToken(left) === mlvTaskboardKeyToken(right);
}

/**
 * Composite lookup token for one board bucket. Omitting `swimlaneId` addresses
 * the whole column; passing it narrows to a single column/swimlane cell.
 */
export function mlvTaskboardBucketToken(
  columnId: MlvTaskboardKey,
  swimlaneId?: MlvTaskboardKey,
): string {
  return `${mlvTaskboardKeyToken(columnId)}|${mlvTaskboardKeyToken(swimlaneId)}`;
}
