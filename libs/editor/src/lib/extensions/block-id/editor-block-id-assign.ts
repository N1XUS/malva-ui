import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';
import type { Mapping } from '@tiptap/pm/transform';
import { AttrStep } from '@tiptap/pm/transform';

/**
 * @internal A changed region of the final document, `[from, to]`. A point
 * (`from === to`) is a deletion.
 */
export type MlvBlockIdRange = readonly [number, number];

/** @internal One block-ID write: set `blockId` of the node at `pos`. */
export interface MlvBlockIdAssignment {
  readonly pos: number;
  readonly id: string;
}

/** @internal Input of {@link planBlockIds}. */
export interface MlvBlockIdPlanInput {
  /** The document the plan writes into. */
  readonly doc: ProseMirrorNode;
  /** Node type names that carry the attribute. */
  readonly types: ReadonlySet<string>;
  /**
   * Changed regions in `doc` coordinates, or `null` for a whole-document
   * normalization (`ensureBlockIds`, `onCreate`): every holder counts as
   * changed, duplicates keep their first holder, nothing transfers.
   */
  readonly ranges: readonly MlvBlockIdRange[] | null;
  /** The document before the changes, for the split transfer. */
  readonly before?: ProseMirrorNode;
  /** Maps `before` positions onto `doc`; built only when a transfer is needed. */
  readonly mapping?: () => Mapping;
  /** Mints a new ID. Collisions are retried. */
  readonly generateId: () => string;
}

/** @private A node that carries the attribute, with where it sits. */
interface Holder {
  readonly pos: number;
  readonly node: ProseMirrorNode;
  readonly id: string | null;
  readonly changed: boolean;
}

/** @private Reads a node's ID; an empty string counts as missing. */
const readId = (node: ProseMirrorNode): string | null => {
  const id: unknown = node.attrs['blockId'];
  return typeof id === 'string' && id !== '' ? id : null;
};

/**
 * @private Whether `[start, end]` meets a changed range. Strict, so a block
 * inserted next to another does not mark its neighbour changed; a deletion
 * point counts only strictly inside the node.
 */
const touches = (
  ranges: readonly MlvBlockIdRange[],
  start: number,
  end: number,
): boolean =>
  ranges.some(([from, to]) =>
    from === to ? from > start && from < end : from < end && to > start,
  );

/**
 * @private Every holder in document order. Descends only into block
 * containers: a textblock's inline content cannot hold a configured block.
 */
const collectHolders = (
  doc: ProseMirrorNode,
  types: ReadonlySet<string>,
  ranges: readonly MlvBlockIdRange[] | null,
): Holder[] => {
  const holders: Holder[] = [];
  doc.descendants((node, pos) => {
    if (types.has(node.type.name)) {
      holders.push({
        pos,
        node,
        id: readId(node),
        changed: ranges === null || touches(ranges, pos, pos + node.nodeSize),
      });
    }
    return !node.isTextblock;
  });
  return holders;
};

/**
 * @internal The changed regions of the relevant transactions, mapped onto the
 * final document. A transaction that is not relevant still moves the ranges
 * recorded before it. An `AttrStep` has an empty step map, so it contributes
 * the start of the node it wrote.
 */
export const changedRanges = (
  trs: readonly Transaction[],
  relevant: (tr: Transaction) => boolean,
): MlvBlockIdRange[] => {
  let ranges: MlvBlockIdRange[] = [];
  for (const tr of trs) {
    const isRelevant = relevant(tr);
    for (const step of tr.steps) {
      const map = step.getMap();
      ranges = ranges.map(([from, to]) => [map.map(from, -1), map.map(to, 1)]);
      if (!isRelevant) continue;
      if (step instanceof AttrStep) {
        ranges.push([step.pos, step.pos + 1]);
        continue;
      }
      map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
        ranges.push([newStart, newEnd]);
      });
    }
  }
  return ranges;
};

/**
 * @private Position of a block's first inline content: the content start of
 * its first textblock. `null` when that textblock is empty or the block holds
 * no textblock (an image, a rule): an empty block has no "first content" to
 * follow, so a split keeps its ID upstairs.
 */
const firstContentPos = (node: ProseMirrorNode, pos: number): number | null => {
  if (node.isTextblock) return node.content.size > 0 ? pos + 1 : null;
  if (node.isLeaf) return null;
  let found: number | null = null;
  let done = false;
  node.descendants((child, childPos) => {
    if (done) return false;
    if (child.isTextblock) {
      done = true;
      found = child.content.size > 0 ? pos + 1 + childPos + 1 : null;
      return false;
    }
    return !child.isLeaf;
  });
  return found;
};

/**
 * @private The holder that receives the original block's ID after a split:
 * the nearest ancestor of the mapped first-content position with the
 * original's type, else (for a textblock whose type changed) the textblock
 * holding the position.
 */
const transferTarget = (
  doc: ProseMirrorNode,
  pos: number,
  original: ProseMirrorNode,
  byPos: ReadonlyMap<number, number>,
): number | undefined => {
  const $pos = doc.resolve(pos);
  for (let depth = $pos.depth; depth > 0; depth--) {
    if ($pos.node(depth).type === original.type) {
      return byPos.get($pos.before(depth));
    }
  }
  if (original.isTextblock && $pos.depth > 0 && $pos.parent.isTextblock) {
    return byPos.get($pos.before());
  }
  return undefined;
};

/** @private The first holder of every ID in `doc`, in document order. */
const firstHolders = (
  doc: ProseMirrorNode,
  types: ReadonlySet<string>,
): Map<string, Holder> => {
  const first = new Map<string, Holder>();
  for (const holder of collectHolders(doc, types, null)) {
    if (holder.id !== null && !first.has(holder.id))
      first.set(holder.id, holder);
  }
  return first;
};

/**
 * @private Where each split original's ID goes. Considered only for IDs that
 * no holder outside the changed ranges keeps, that are still held inside the
 * ranges or no longer held at all (a type change), and whose original had
 * first content. The target must be inside the changed ranges and hold
 * either nothing or that ID; the first ID to claim a target wins it.
 */
const planTransfers = (
  input: MlvBlockIdPlanInput,
  holders: readonly Holder[],
  outside: ReadonlySet<string>,
  inRange: ReadonlyMap<string, number>,
  used: ReadonlySet<string>,
): Map<string, number> => {
  const transfers = new Map<string, number>();
  if (!input.before || !input.mapping) return transfers;
  const byPos = new Map(holders.map((holder, index) => [holder.pos, index]));
  const claimed = new Set<number>();
  const mapping = input.mapping();
  for (const [id, original] of firstHolders(input.before, input.types)) {
    if (outside.has(id) || (!inRange.has(id) && used.has(id))) continue;
    const start = firstContentPos(original.node, original.pos);
    if (start === null) continue;
    const mapped = mapping.mapResult(start, 1);
    if (mapped.deleted) continue;
    const target = transferTarget(input.doc, mapped.pos, original.node, byPos);
    if (target === undefined || claimed.has(target)) continue;
    const holder = holders[target];
    if (!holder.changed || (holder.id !== null && holder.id !== id)) continue;
    transfers.set(id, target);
    claimed.add(target);
  }
  return transfers;
};

/**
 * @internal The writes that leave every holder with a unique ID:
 * - **Missing:** a holder with no ID gets a new one, wherever it is.
 * - **Duplicate:** a holder outside the changed ranges keeps its ID; inside
 *   them, the first in document order keeps it and the rest get new ones.
 * - **Split:** when an ID's original block had first content, the holder that
 *   content ended up in keeps (or receives) the ID.
 * New IDs are minted in document order and never collide.
 */
export const planBlockIds = (
  input: MlvBlockIdPlanInput,
): MlvBlockIdAssignment[] => {
  const holders = collectHolders(input.doc, input.types, input.ranges);
  const used = new Set<string>();
  const outside = new Set<string>();
  const inRange = new Map<string, number>();
  let missing = false;
  let changedMissing = false;
  for (const holder of holders) {
    if (holder.id === null) {
      missing = true;
      changedMissing ||= holder.changed;
      continue;
    }
    used.add(holder.id);
    if (!holder.changed) outside.add(holder.id);
    else inRange.set(holder.id, (inRange.get(holder.id) ?? 0) + 1);
  }
  let duplicate = false;
  let splitDuplicate = false;
  for (const [id, count] of inRange) {
    if (outside.has(id) || count > 1) duplicate = true;
    if (!outside.has(id) && count > 1) splitDuplicate = true;
  }
  if (!missing && !duplicate) return [];

  const transfers =
    input.ranges !== null && (changedMissing || splitDuplicate)
      ? planTransfers(input, holders, outside, inRange, used)
      : new Map<string, number>();
  const receiving = new Map<number, string>();
  for (const [id, target] of transfers) receiving.set(target, id);

  const kept = new Set<string>();
  const assignments: MlvBlockIdAssignment[] = [];
  holders.forEach((holder, index) => {
    const received = receiving.get(index);
    if (received !== undefined) {
      if (holder.id !== received)
        assignments.push({ pos: holder.pos, id: received });
      return;
    }
    const id = holder.id;
    const keeps =
      id !== null &&
      (!holder.changed ||
        (!outside.has(id) && !transfers.has(id) && !kept.has(id)));
    if (keeps) {
      if (holder.changed) kept.add(id);
      return;
    }
    assignments.push({ pos: holder.pos, id: mint(input.generateId, used) });
  });
  return assignments;
};

/** @private Mints an ID not in `used` and records it. */
const mint = (generateId: () => string, used: Set<string>): string => {
  let id = generateId();
  for (let attempt = 0; used.has(id) && attempt < 32; attempt++)
    id = generateId();
  for (let suffix = 1; used.has(id); suffix++) id = `${generateId()}-${suffix}`;
  used.add(id);
  return id;
};

/**
 * @internal Writes a plan through `setNodeAttribute` only (an `AttrStep`,
 * whose step map is empty, so no AI suggestion range or mapped position
 * moves) and re-pins the stored marks, which every step clears.
 */
export const applyBlockIds = (
  tr: Transaction,
  assignments: readonly MlvBlockIdAssignment[],
): Transaction => {
  const storedMarks = tr.storedMarks;
  for (const { pos, id } of assignments)
    tr.setNodeAttribute(pos, 'blockId', id);
  if (storedMarks) tr.setStoredMarks(storedMarks);
  return tr;
};
