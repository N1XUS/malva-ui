import { buildChatRenderList } from './chat-render-list';
import { stabilizeChatGroupIds } from './chat-group-ids';
import type { MlvChatMessageData, MlvChatRenderItem } from './chat.types';

const msg = (
  id: string,
  authorId: string,
  minute: number,
): MlvChatMessageData => ({
  id,
  authorId,
  text: id,
  timestamp: new Date(2026, 6, 27, 10, minute),
});

/** Groups `messages` the way `mlv-chat` does, with date separators on. */
const build = (messages: MlvChatMessageData[]): MlvChatRenderItem[] =>
  buildChatRenderList(messages, 'me', 5, true);

/** `[group id, message ids]` of every group, in order. */
const groups = (items: MlvChatRenderItem[]): [string, string[]][] =>
  items.flatMap((item) =>
    item.kind === 'group'
      ? [[item.id, item.messages.map(({ message }) => message.id)]]
      : [],
  );

describe('stabilizeChatGroupIds', () => {
  const a1 = msg('a1', 'u1', 0);
  const a2 = msg('a2', 'u1', 1);
  const a3 = msg('a3', 'u1', 2);
  const b1 = msg('b1', 'u2', 3);
  const b2 = msg('b2', 'u2', 4);

  it('leaves a first render as built', () => {
    const items = build([a1, a2, b1]);
    expect(stabilizeChatGroupIds(items, [])).toBe(items);
  });

  it('keeps the id of a group whose first message left the window', () => {
    const before = stabilizeChatGroupIds(build([a1, a2, a3, b1]), []);
    const after = stabilizeChatGroupIds(build([a2, a3, b1]), before);

    expect(groups(after)).toEqual([
      ['group-a1', ['a2', 'a3']],
      ['group-b1', ['b1']],
    ]);
  });

  it('keeps the id across repeated trims', () => {
    let items = stabilizeChatGroupIds(build([a1, a2, a3]), []);
    items = stabilizeChatGroupIds(build([a2, a3]), items);
    items = stabilizeChatGroupIds(build([a3]), items);

    expect(groups(items)).toEqual([['group-a1', ['a3']]]);
  });

  it('keeps the id when the window grows back over the first message', () => {
    const trimmed = stabilizeChatGroupIds(
      build([a2, a3]),
      stabilizeChatGroupIds(build([a1, a2, a3]), []),
    );
    const regrown = stabilizeChatGroupIds(build([a1, a2, a3]), trimmed);

    expect(groups(regrown)).toEqual([['group-a1', ['a1', 'a2', 'a3']]]);
  });

  it('keeps the id when an earlier message joins the group', () => {
    const before = stabilizeChatGroupIds(build([a2, a3]), []);
    const after = stabilizeChatGroupIds(build([a1, a2, a3]), before);

    expect(groups(after)).toEqual([['group-a2', ['a1', 'a2', 'a3']]]);
  });

  it('gives an appended group its own id', () => {
    const before = stabilizeChatGroupIds(build([a1, a2]), []);
    const after = stabilizeChatGroupIds(build([a1, a2, b1, b2]), before);

    expect(groups(after)).toEqual([
      ['group-a1', ['a1', 'a2']],
      ['group-b1', ['b1', 'b2']],
    ]);
  });

  it('hands a carried id to one group only when a group splits', () => {
    const before = stabilizeChatGroupIds(build([a1, a2, a3]), []);
    // A tighter group window splits `[a2, a3]` into two single groups.
    const split = buildChatRenderList([a2, a3], 'me', 0, true);
    const after = stabilizeChatGroupIds(split, before);

    expect(groups(after)).toEqual([
      ['group-a1', ['a2']],
      ['group-a3', ['a3']],
    ]);
  });

  it('lets a group headed by a message keep that id before any carry-over', () => {
    // `group-a1` was carried over to [a2, a3] after `a1` left the window…
    const carried = stabilizeChatGroupIds(
      build([a2, a3]),
      stabilizeChatGroupIds(build([a1, a2, a3]), []),
    );
    // …then `a1` comes back as a group of its own (a tighter window).
    const regrouped = buildChatRenderList([a1, a2, a3], 'me', 0, true);
    const after = stabilizeChatGroupIds(regrouped, carried);

    const ids = groups(after).map(([id]) => id);
    expect(groups(after)).toEqual([
      ['group-a1', ['a1']],
      ['group-a2', ['a2']],
      ['group-a3', ['a3']],
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('passes date separators through untouched', () => {
    const before = stabilizeChatGroupIds(build([a1, a2]), []);
    const after = stabilizeChatGroupIds(build([a2]), before);

    expect(after[0]).toEqual({
      kind: 'date',
      id: 'date-2026-6-27',
      date: a2.timestamp,
    });
  });
});
