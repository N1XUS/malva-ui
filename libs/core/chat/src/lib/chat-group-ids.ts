import type { MlvChatRenderItem } from './chat.types';

/**
 * Carries each author group's track id over from the previous render list, so
 * a group keeps its DOM node when its first message leaves the render window.
 *
 * `buildChatRenderList` ids a group by its first message (`group-<id>`). When
 * the window moves past that message — the pinned window sliding on an
 * arrival, a re-pin trimming it back — that id changes, and `@for` destroys
 * the group and re-creates every bubble in it: focus inside it is lost, audio
 * stops, and each live message replays its enter animation (#354). Here a
 * group takes, in order:
 *
 * 1. its own id, when a previous group already carried it — it kept its first
 *    message, the common case;
 * 2. the previous id of its oldest message that had one, unless another group
 *    already took it — its first message left, the rest stayed;
 * 3. its own id — a new group.
 *
 * Ids stay unique. Steps 1 and 2 only hand out ids a previous group carried,
 * each at most once. A group reaching step 3 has an id no previous group
 * carried (step 1 would have taken it), and no two groups share a first
 * message. An id never moves to another author: every message of a group has
 * the group's author.
 *
 * Not exported from the barrel; `buildChatRenderList` keeps its documented ids.
 *
 * @param items Output of `buildChatRenderList` for the current render window.
 * @param previous The previous result of this function; empty on first render.
 * @returns `items`, with the id of each carried-over group replaced.
 */
export function stabilizeChatGroupIds(
  items: MlvChatRenderItem[],
  previous: readonly MlvChatRenderItem[],
): MlvChatRenderItem[] {
  const previousGroupOf = new Map<string, string>();
  for (const item of previous) {
    if (item.kind !== 'group') continue;
    for (const { message } of item.messages) {
      previousGroupOf.set(message.id, item.id);
    }
  }
  if (!previousGroupOf.size) return items;

  const previousIds = new Set(previousGroupOf.values());
  const taken = new Set<string>();
  for (const item of items) {
    if (item.kind === 'group' && previousIds.has(item.id)) taken.add(item.id);
  }

  return items.map((item) => {
    if (item.kind !== 'group' || previousIds.has(item.id)) return item;
    for (const { message } of item.messages) {
      const id = previousGroupOf.get(message.id);
      if (id === undefined || taken.has(id)) continue;
      taken.add(id);
      return { ...item, id };
    }
    return item;
  });
}
