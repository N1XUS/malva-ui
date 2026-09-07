import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvTaskboardI18n {
  /** aria-label for the board grid itself. */
  boardLabel: string;
  /** Text of the built-in add-card affordance rendered in every cell. */
  addCard: string;
  /** Message rendered inside a cell that currently holds no cards. */
  emptyCell: string;
  /** Text of the built-in card surface. ICU parameter: `{label}`. */
  cardLabel: string;
  /**
   * Swimlane qualifier appended to a move announcement. ICU parameter:
   * `{lane}`. Boards without swimlanes pass an empty `{lane}` to the
   * announcements below, so this key never renders for them.
   */
  laneName: string;
  /** Keyboard commands associated with every draggable card. */
  keyboardInstructions: string;
  /** Polite announcement made when a card is picked up. ICU: `{label}`. */
  grabbed: string;
  /**
   * Polite announcement for a keyboard target the board accepts.
   * ICU parameters: `{column}`, `{lane}`, `{position}`, `{count}`.
   */
  targetValid: string;
  /**
   * Polite announcement for a keyboard target the board refuses.
   * ICU parameters: `{column}`, `{lane}`, `{reason}`.
   */
  targetInvalid: string;
  /**
   * Polite announcement made after a committed move.
   * ICU parameters: `{label}`, `{column}`, `{lane}`, `{position}`.
   */
  moved: string;
  /** Polite announcement for a refused move. ICU: `{label}`, `{reason}`. */
  moveRejected: string;
  /** Polite announcement for an abandoned move. ICU: `{label}`. */
  moveCancelled: string;
  /**
   * Polite announcement for a grab dropped back on the slot the card already
   * occupied: nothing moved, and nothing was cancelled either. ICU: `{label}`.
   */
  releasedInPlace: string;
  /** Work-in-progress readout for a limited column. ICU: `{count}`, `{limit}`. */
  wipState: string;
  /** Polite announcement of the current selection size. ICU plural: `{count}`. */
  selectionCount: string;
  /** Reason phrase for a slot that was never a permitted target. */
  reasonInvalidDrop: string;
  /** Reason phrase for a move the user abandoned. */
  reasonCancelled: string;
  /** Reason phrase for a move the application guard answered `false` for. */
  reasonBeforeMoveRejected: string;
  /** Reason phrase for a move whose application guard threw or rejected. */
  reasonBeforeMoveError: string;
  /** Reason phrase for a move whose board changed while the guard ran. */
  reasonStale: string;
  /** Reason phrase for a card, column, or lane that is locked. */
  reasonLocked: string;
  /** Reason phrase for a column transition the board forbids. */
  reasonTransition: string;
  /** Reason phrase for a target whose work-in-progress limit is reached. */
  reasonWip: string;
  /** Reason phrase for a target the application drop policy refused. */
  reasonPolicy: string;
}

export const MLV_TASKBOARD_I18N = new InjectionToken<Signal<MlvTaskboardI18n>>(
  'MLV_TASKBOARD_I18N',
);

export const MLV_TASKBOARD_I18N_CONTEXT: Record<
  keyof MlvTaskboardI18n,
  MlvTranslationContext
> = {
  boardLabel: {
    component: 'mlv-taskboard',
    usage: 'aria-label',
    description: 'Accessible name of the taskboard grid',
  },
  addCard: {
    component: 'mlv-taskboard',
    usage: 'button-text',
    description: 'Built-in affordance that asks the application to add a card',
  },
  emptyCell: {
    component: 'mlv-taskboard',
    usage: 'message',
    description: 'Placeholder shown in a column/lane cell that holds no cards',
  },
  cardLabel: {
    component: 'mlv-taskboard',
    usage: 'button-text',
    icuParams: ['label'],
    description:
      'Built-in card surface text when no card template is projected',
  },
  laneName: {
    component: 'mlv-taskboard',
    usage: 'live-announcement',
    icuParams: ['lane'],
    description:
      'Swimlane qualifier appended to a move announcement; never rendered on a board without swimlanes',
  },
  keyboardInstructions: {
    component: 'mlv-taskboard',
    usage: 'message',
    description: 'Keyboard commands for grabbing, aiming, and dropping a card',
  },
  grabbed: {
    component: 'mlv-taskboard',
    usage: 'live-announcement',
    icuParams: ['label'],
    description: 'Announcement made when a card is picked up by keyboard',
  },
  targetValid: {
    component: 'mlv-taskboard',
    usage: 'live-announcement',
    icuParams: ['column', 'lane', 'position', 'count'],
    description:
      'Announcement for a keyboard target the board accepts; {lane} is empty on a board without swimlanes',
  },
  targetInvalid: {
    component: 'mlv-taskboard',
    usage: 'live-announcement',
    icuParams: ['column', 'lane', 'reason'],
    description:
      'Announcement for a keyboard target the board refuses; {lane} is empty on a board without swimlanes',
  },
  moved: {
    component: 'mlv-taskboard',
    usage: 'live-announcement',
    icuParams: ['label', 'column', 'lane', 'position'],
    description: 'Announcement made after a card move is committed',
  },
  moveRejected: {
    component: 'mlv-taskboard',
    usage: 'live-announcement',
    icuParams: ['label', 'reason'],
    description: 'Announcement made when a requested move is refused',
  },
  moveCancelled: {
    component: 'mlv-taskboard',
    usage: 'live-announcement',
    icuParams: ['label'],
    description: 'Announcement made when a started move is abandoned',
  },
  releasedInPlace: {
    component: 'mlv-taskboard',
    usage: 'live-announcement',
    icuParams: ['label'],
    description:
      'Announcement made when a grabbed card is dropped back on the slot it already occupied',
  },
  wipState: {
    component: 'mlv-taskboard',
    usage: 'label',
    icuParams: ['count', 'limit'],
    description:
      'Work-in-progress readout rendered in a built-in column header that declares a limit',
  },
  selectionCount: {
    component: 'mlv-taskboard',
    usage: 'live-announcement',
    icuParams: ['count'],
    description: 'Announcement of how many cards are currently selected',
  },
  reasonInvalidDrop: {
    component: 'mlv-taskboard',
    usage: 'live-announcement',
    description: 'Reason phrase: the released slot was never a valid target',
  },
  reasonCancelled: {
    component: 'mlv-taskboard',
    usage: 'live-announcement',
    description: 'Reason phrase: the user abandoned the move',
  },
  reasonBeforeMoveRejected: {
    component: 'mlv-taskboard',
    usage: 'live-announcement',
    description: 'Reason phrase: the application guard rejected the move',
  },
  reasonBeforeMoveError: {
    component: 'mlv-taskboard',
    usage: 'live-announcement',
    description: 'Reason phrase: the application guard threw or rejected',
  },
  reasonStale: {
    component: 'mlv-taskboard',
    usage: 'live-announcement',
    description: 'Reason phrase: the board changed while the guard was pending',
  },
  reasonLocked: {
    component: 'mlv-taskboard',
    usage: 'live-announcement',
    description: 'Reason phrase: the card, its column, or its lane is locked',
  },
  reasonTransition: {
    component: 'mlv-taskboard',
    usage: 'live-announcement',
    description: 'Reason phrase: the board forbids that column transition',
  },
  reasonWip: {
    component: 'mlv-taskboard',
    usage: 'live-announcement',
    description:
      "Reason phrase: the target's work-in-progress limit is reached",
  },
  reasonPolicy: {
    component: 'mlv-taskboard',
    usage: 'live-announcement',
    description:
      'Reason phrase: the application drop policy refused the target',
  },
};
