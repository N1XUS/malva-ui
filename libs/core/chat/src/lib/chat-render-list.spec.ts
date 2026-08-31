import { buildChatRenderList } from './chat-render-list';
import type { MlvChatMessageData } from './chat.types';

const msg = (id: string, authorId: string, iso: string): MlvChatMessageData => ({
  id,
  authorId,
  text: id,
  timestamp: new Date(iso),
});

describe('buildChatRenderList', () => {
  it('groups consecutive same-author messages within the gap window', () => {
    const items = buildChatRenderList(
      [msg('a', 'u1', '2026-07-27T10:00:00'), msg('b', 'u1', '2026-07-27T10:01:00')],
      'me',
      5,
      false,
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'group', authorId: 'u1', own: false });
    const group = items[0] as Extract<(typeof items)[number], { kind: 'group' }>;
    expect(group.messages.map((m) => m.position)).toEqual(['first', 'last']);
  });

  it('marks a lone message as single', () => {
    const items = buildChatRenderList([msg('a', 'u1', '2026-07-27T10:00:00')], 'me', 5, false);
    const group = items[0] as Extract<(typeof items)[number], { kind: 'group' }>;
    expect(group.messages[0].position).toBe('single');
  });

  it('assigns middle to inner messages', () => {
    const items = buildChatRenderList(
      [
        msg('a', 'u1', '2026-07-27T10:00:00'),
        msg('b', 'u1', '2026-07-27T10:01:00'),
        msg('c', 'u1', '2026-07-27T10:02:00'),
      ],
      'me',
      5,
      false,
    );
    const group = items[0] as Extract<(typeof items)[number], { kind: 'group' }>;
    expect(group.messages.map((m) => m.position)).toEqual(['first', 'middle', 'last']);
  });

  it('breaks groups on author change', () => {
    const items = buildChatRenderList(
      [msg('a', 'u1', '2026-07-27T10:00:00'), msg('b', 'u2', '2026-07-27T10:00:30')],
      'me',
      5,
      false,
    );
    expect(items).toHaveLength(2);
  });

  it('breaks groups when the gap exceeds groupWindow minutes', () => {
    const items = buildChatRenderList(
      [msg('a', 'u1', '2026-07-27T10:00:00'), msg('b', 'u1', '2026-07-27T10:06:01')],
      'me',
      5,
      false,
    );
    expect(items).toHaveLength(2);
  });

  it('keeps one group when the gap equals groupWindow minutes', () => {
    const items = buildChatRenderList(
      [msg('a', 'u1', '2026-07-27T10:00:00'), msg('b', 'u1', '2026-07-27T10:05:00')],
      'me',
      5,
      false,
    );
    expect(items).toHaveLength(1);
  });

  it('inserts a date item and breaks the group at day boundaries', () => {
    const items = buildChatRenderList(
      [msg('a', 'u1', '2026-07-27T23:59:00'), msg('b', 'u1', '2026-07-28T00:01:00')],
      'me',
      5,
      true,
    );
    expect(items.map((i) => i.kind)).toEqual(['date', 'group', 'date', 'group']);
  });

  it('omits date items when dateSeparators is false', () => {
    const items = buildChatRenderList(
      [msg('a', 'u1', '2026-07-27T23:59:00'), msg('b', 'u1', '2026-07-28T00:01:00')],
      'me',
      5,
      false,
    );
    expect(items.map((i) => i.kind)).toEqual(['group', 'group']);
  });

  it('flags own groups via selfId', () => {
    const items = buildChatRenderList([msg('a', 'me', '2026-07-27T10:00:00')], 'me', 5, false);
    const group = items[0] as Extract<(typeof items)[number], { kind: 'group' }>;
    expect(group.own).toBe(true);
  });

  it('produces stable ids (date-YYYY-M-D, group-<first message id>)', () => {
    const items = buildChatRenderList([msg('a', 'u1', '2026-07-27T10:00:00')], 'me', 5, true);
    expect(items[0].id).toBe('date-2026-6-27');
    expect(items[1].id).toBe('group-a');
  });

  it('accepts number and string timestamps', () => {
    const items = buildChatRenderList(
      [
        { id: 'a', authorId: 'u1', timestamp: new Date('2026-07-27T10:00:00').getTime() },
        { id: 'b', authorId: 'u1', timestamp: '2026-07-27T10:01:00' },
      ],
      'me',
      5,
      false,
    );
    expect(items).toHaveLength(1);
  });

  it('returns an empty list for no messages', () => {
    expect(buildChatRenderList([], 'me', 5, true)).toEqual([]);
  });
});
