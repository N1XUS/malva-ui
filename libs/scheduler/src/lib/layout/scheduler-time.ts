import type { MlvSchedulerBusinessHours } from '../scheduler/scheduler.types';

/** Minutes in one calendar day. */
export const MINUTES_PER_DAY = 1440;

const TIME_PATTERN = /^([01]\d|2[0-4]):([0-5]\d)$/;

/** Parses `'HH:mm'` (two-digit hours, `'24:00'` allowed) into minutes of day. */
export function parseTime(value: string): number {
  const match = TIME_PATTERN.exec(value);
  if (!match) {
    throw new Error(
      `Invalid time "${value}". Expected "HH:mm" between 00:00 and 24:00.`,
    );
  }
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  if (minutes > MINUTES_PER_DAY) {
    throw new Error(
      `Invalid time "${value}". Expected "HH:mm" between 00:00 and 24:00.`,
    );
  }
  return minutes;
}

/** Rounds to the nearest multiple of `snap`; `snap <= 0` returns the input. */
export function snapMinutes(minutes: number, snap: number): number {
  if (snap <= 0) return minutes;
  return Math.round(minutes / snap) * snap;
}

/** Clamps into `[min, max]`. */
export function clampMinutes(
  minutes: number,
  min: number,
  max: number,
): number {
  return Math.min(max, Math.max(min, minutes));
}

/**
 * Maps a block offset inside a time column to snapped minutes of day.
 * `offsetPx` is measured from the column's block-start edge; the column spans
 * `[minMinutes, maxMinutes)` over `heightPx`.
 */
export function minutesFromOffset(
  offsetPx: number,
  heightPx: number,
  minMinutes: number,
  maxMinutes: number,
  snap: number,
): number {
  if (heightPx <= 0) return minMinutes;
  const raw = minMinutes + (offsetPx / heightPx) * (maxMinutes - minMinutes);
  return clampMinutes(snapMinutes(raw, snap), minMinutes, maxMinutes);
}

/** Number of slot rows needed to cover `[minMinutes, maxMinutes)`. */
export function slotCount(
  minMinutes: number,
  maxMinutes: number,
  slotDuration: number,
): number {
  return Math.max(1, Math.ceil((maxMinutes - minMinutes) / slotDuration));
}

const DEFAULT_BUSINESS_DAYS: readonly number[] = [1, 2, 3, 4, 5];

/** Whether the slot starting at `minutes` on `dayOfWeek` (0 = Sunday) is inside business hours. */
export function isBusinessSlot(
  dayOfWeek: number,
  minutes: number,
  hours: MlvSchedulerBusinessHours | null,
): boolean {
  if (!hours) return false;
  const days = hours.days ?? DEFAULT_BUSINESS_DAYS;
  if (!days.includes(dayOfWeek)) return false;
  return minutes >= parseTime(hours.start) && minutes < parseTime(hours.end);
}
