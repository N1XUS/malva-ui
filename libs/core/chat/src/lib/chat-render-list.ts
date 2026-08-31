import type { MlvChatMessageData, MlvChatRenderItem, MlvChatRenderMessage } from './chat.types';

/** Normalizes the {@link MlvChatMessageData.timestamp} union to a Date. */
export function toChatDate(timestamp: Date | number | string): Date {
  return timestamp instanceof Date ? timestamp : new Date(timestamp);
}

/** True when both dates fall on the same calendar day (local time). */
export function isSameChatDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Flattens an oldest→newest message array into date separators + author groups.
 * A group breaks on author change, on a gap larger than `groupWindowMinutes`,
 * and always at a calendar-day boundary.
 *
 * @param messages Messages ordered oldest → newest.
 * @param selfId Current user id; groups authored by it are flagged `own`.
 * @param groupWindowMinutes Maximum gap between consecutive messages of one group.
 * @param dateSeparators Whether `kind: 'date'` items are emitted at day boundaries.
 */
export function buildChatRenderList(
  messages: readonly MlvChatMessageData[],
  selfId: string,
  groupWindowMinutes: number,
  dateSeparators: boolean,
): MlvChatRenderItem[] {
  const items: MlvChatRenderItem[] = [];
  let pending: MlvChatMessageData[] = [];
  let prevDate: Date | null = null;

  const flush = (): void => {
    if (!pending.length) return;
    const rendered: MlvChatRenderMessage[] = pending.map((message, i) => ({
      message,
      position:
        pending.length === 1 ? 'single' : i === 0 ? 'first' : i === pending.length - 1 ? 'last' : 'middle',
    }));
    items.push({
      kind: 'group',
      id: `group-${pending[0].id}`,
      authorId: pending[0].authorId,
      own: pending[0].authorId === selfId,
      messages: rendered,
    });
    pending = [];
  };

  for (const message of messages) {
    const date = toChatDate(message.timestamp);
    const dayBreak = prevDate === null || !isSameChatDay(prevDate, date);
    const gapBreak = prevDate !== null && date.getTime() - prevDate.getTime() > groupWindowMinutes * 60_000;
    const authorBreak = pending.length > 0 && pending[0].authorId !== message.authorId;

    if (dayBreak || gapBreak || authorBreak) flush();
    if (dayBreak && dateSeparators) {
      items.push({ kind: 'date', id: `date-${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`, date });
    }
    pending.push(message);
    prevDate = date;
  }
  flush();
  return items;
}
