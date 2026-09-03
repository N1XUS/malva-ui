import type { MlvDateAdapter } from '@malva-ui/core/date';

/** The chip element rendering `id`, or `null`. Attribute comparison, so ids need no escaping. */
export function findEventElement(
  root: HTMLElement,
  id: string,
): HTMLElement | null {
  for (const element of Array.from(
    root.querySelectorAll<HTMLElement>('[data-event-id]'),
  )) {
    if (element.getAttribute('data-event-id') === id) return element;
  }
  return null;
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
