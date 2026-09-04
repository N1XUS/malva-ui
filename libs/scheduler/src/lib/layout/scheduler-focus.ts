import type { MlvDateAdapter } from '@malva-ui/core/date';

/**
 * The chip element rendering `id`, or `null`. Attribute comparison, so ids
 * need no escaping.
 *
 * A multi-day event renders one chip per day and every one of them carries the
 * same `data-event-id`, so `dayIndex` picks the segment: the chip whose owning
 * cell or column declares that `data-day-index`. It is a preference, not a
 * filter — an index no chip claims any more (the segment was resized away, or
 * the change scrolled the range) falls back to the first chip of `id`, which
 * is the pre-`dayIndex` behaviour.
 */
export function findEventElement(
  root: HTMLElement,
  id: string,
  dayIndex?: number,
): HTMLElement | null {
  let first: HTMLElement | null = null;
  for (const element of Array.from(
    root.querySelectorAll<HTMLElement>('[data-event-id]'),
  )) {
    if (element.getAttribute('data-event-id') !== id) continue;
    if (dayIndex === undefined) return element;
    first ??= element;
    const owner = element.closest<HTMLElement>('[data-day-index]');
    if (owner && Number(owner.dataset['dayIndex']) === dayIndex) return element;
  }
  return first;
}

/**
 * The focusable cell for a day (`minutes === null`: a month cell or all-day
 * cell, `data-minutes="all-day"`) or a time slot (`data-minutes="<n>"`).
 */
export function findCellElement(
  root: HTMLElement,
  dayIndex: number,
  minutes: number | null,
): HTMLElement | null {
  const minutesAttr = minutes === null ? 'all-day' : String(minutes);
  return root.querySelector<HTMLElement>(
    `[data-day-index="${dayIndex}"][data-minutes="${minutesAttr}"]`,
  );
}

/** The next calendar day in `direction` that is not a hidden weekday (at most 7 steps away). */
export function nextVisibleDate<D>(
  adapter: MlvDateAdapter<D>,
  from: D,
  direction: -1 | 1,
  hiddenDays: readonly number[],
): D {
  let date = adapter.addCalendarDays(from, direction);
  for (
    let step = 0;
    step < 7 && hiddenDays.includes(adapter.getDayOfWeek(date));
    step++
  ) {
    date = adapter.addCalendarDays(date, direction);
  }
  return date;
}
