import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvSchedulerI18n {
  /** Host aria-label when the consumer gives none. */
  scheduler: string;
  /** "Today" toolbar button label. */
  today: string;
  /** aria-label of the previous-period button. ICU: "Previous {view, select, month {month} week {week} day {day} other {period}}". */
  previous: string;
  /** aria-label of the next-period button. ICU select on `view`, as `previous`. */
  next: string;
  /** View-switch label for the month view. */
  month: string;
  /** View-switch label for the week view. */
  week: string;
  /** View-switch label for the day view. */
  day: string;
  /** aria-label of the view-switch group. */
  viewSwitch: string;
  /** Header of the all-day row. */
  allDay: string;
  /** Visible "+N more" button text. ICU: "+{count, plural, one {# more} other {# more}}". */
  moreEvents: string;
  /** aria-label of the "+N more" button. ICU: "{count, plural, one {# more event} other {# more events}} on {date}". */
  moreEventsLabel: string;
  /** aria-label of a view grid. ICU: "{view, select, month {Month} week {Week} day {Day} other {Scheduler}} view, {period}". */
  gridLabel: string;
  /** aria-label of a time-grid slot cell. ICU: "{date}, {time}". */
  slotLabel: string;
  /** aria-label suffix for today's cell. ICU: "{date}, today". */
  dayLabelToday: string;
  /** Accessible name of a timed event chip. ICU: "{title}, {start} to {end}". */
  eventLabel: string;
  /** Accessible name of an all-day event chip. ICU: "{title}, all day, {start} to {end}". */
  eventLabelAllDay: string;
  /** Keyboard hint attached to editable chips via aria-description. */
  dragHint: string;
  /** Live announcement after a move. ICU: "{title} moved to {start}". */
  eventMoved: string;
  /** Live announcement after a resize. ICU: "{title} now ends at {end}". */
  eventResized: string;
  /** Live announcement when `canMove`/`canResize` vetoes. ICU: "{title} cannot be placed there". */
  moveRejected: string;
  /** Live announcement after navigation. ICU: "Showing {period}". */
  rangeChanged: string;
  /** Live announcement while a keyboard range selection is pending. ICU: "{start} to {end} selected. Press Enter to confirm". */
  selectionHint: string;
  /** `aria-label` of the built-in event context menu. ICU: "Actions for {title}". */
  eventMenu: string;
  /** `aria-label` of the built-in slot context menu; `start` is the day or the slot start. ICU: "Actions for {start}". */
  slotMenu: string;
}

export const MLV_SCHEDULER_I18N = new InjectionToken<Signal<MlvSchedulerI18n>>(
  'MLV_SCHEDULER_I18N',
);

export const MLV_SCHEDULER_I18N_CONTEXT: Record<
  keyof MlvSchedulerI18n,
  MlvTranslationContext
> = {
  scheduler: {
    component: 'mlv-scheduler',
    usage: 'aria-label',
    description: 'Default accessible name of the scheduler region',
  },
  today: {
    component: 'mlv-scheduler',
    usage: 'button-text',
    description: 'Toolbar button that jumps to the current period',
  },
  previous: {
    component: 'mlv-scheduler',
    usage: 'aria-label',
    icuParams: ['view'],
    description:
      'Previous period button; the view name is a select on month/week/day',
  },
  next: {
    component: 'mlv-scheduler',
    usage: 'aria-label',
    icuParams: ['view'],
    description:
      'Next period button; the view name is a select on month/week/day',
  },
  month: {
    component: 'mlv-scheduler',
    usage: 'button-text',
    description: 'View switch option for the month grid',
  },
  week: {
    component: 'mlv-scheduler',
    usage: 'button-text',
    description: 'View switch option for the seven-day time grid',
  },
  day: {
    component: 'mlv-scheduler',
    usage: 'button-text',
    description: 'View switch option for the single-day time grid',
  },
  viewSwitch: {
    component: 'mlv-scheduler',
    usage: 'aria-label',
    description: 'Accessible name of the month/week/day switch',
  },
  allDay: {
    component: 'mlv-scheduler',
    usage: 'message',
    description: 'Row header for events without a time',
  },
  moreEvents: {
    component: 'mlv-scheduler',
    usage: 'button-text',
    icuParams: ['count'],
    description: 'Overflow button in a month cell, e.g. "+3 more"',
  },
  moreEventsLabel: {
    component: 'mlv-scheduler',
    usage: 'aria-label',
    icuParams: ['count', 'date'],
    description:
      'Accessible name of the overflow button, plural on count, date is a localized full date',
  },
  gridLabel: {
    component: 'mlv-scheduler',
    usage: 'aria-label',
    icuParams: ['view', 'period'],
    description:
      'Accessible name of the calendar grid; period is the localized visible range',
  },
  slotLabel: {
    component: 'mlv-scheduler',
    usage: 'aria-label',
    icuParams: ['date', 'time'],
    description: 'Accessible name of one time slot cell',
  },
  dayLabelToday: {
    component: 'mlv-scheduler',
    usage: 'aria-label',
    icuParams: ['date'],
    description: 'Accessible name of the current day cell',
  },
  eventLabel: {
    component: 'mlv-scheduler',
    usage: 'aria-label',
    icuParams: ['title', 'start', 'end'],
    description:
      'Accessible name of a timed event; start/end are localized times or date-times',
  },
  eventLabelAllDay: {
    component: 'mlv-scheduler',
    usage: 'aria-label',
    icuParams: ['title', 'start', 'end'],
    description:
      'Accessible name of an all-day event; start/end are localized dates',
  },
  dragHint: {
    component: 'mlv-scheduler',
    usage: 'message',
    description:
      'Keyboard instructions for moving (Alt+Arrow) and resizing (Alt+Shift+Arrow) an event',
  },
  eventMoved: {
    component: 'mlv-scheduler',
    usage: 'live-announcement',
    icuParams: ['title', 'start'],
    description: 'Announced after an event was moved',
  },
  eventResized: {
    component: 'mlv-scheduler',
    usage: 'live-announcement',
    icuParams: ['title', 'end'],
    description: 'Announced after an event end was changed',
  },
  moveRejected: {
    component: 'mlv-scheduler',
    usage: 'live-announcement',
    icuParams: ['title'],
    description: 'Announced when the application refuses a move or resize',
  },
  rangeChanged: {
    component: 'mlv-scheduler',
    usage: 'live-announcement',
    icuParams: ['period'],
    description: 'Announced after navigating to another period',
  },
  selectionHint: {
    component: 'mlv-scheduler',
    usage: 'live-announcement',
    icuParams: ['start', 'end'],
    description: 'Announced while a keyboard range selection is being extended',
  },
  eventMenu: {
    component: 'mlv-scheduler',
    usage: 'aria-label',
    icuParams: ['title'],
    description:
      'Accessible name of the context menu opened on an event; title is the event title',
  },
  slotMenu: {
    component: 'mlv-scheduler',
    usage: 'aria-label',
    icuParams: ['start'],
    description:
      'Accessible name of the context menu opened on an empty cell or time slot; start is the localized day or slot start',
  },
};
