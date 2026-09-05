import type { EnvironmentProviders } from '@angular/core';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import type {
  MlvTaskboardColumn,
  MlvTaskboardColumnGroup,
  MlvTaskboardSwimlane,
} from '../taskboard.types';

/**
 * Providers every taskboard component spec needs. `MlvTaskboard` injects
 * `MLV_TASKBOARD_I18N` at construction, so a `TestBed` without the i18n
 * tokens cannot create the component at all.
 */
export function provideTaskboardTesting(): EnvironmentProviders {
  return provideMlvI18nTesting();
}

/** Test-only card shape used by taskboard component integration tests. */
export interface TaskboardTestTicket {
  readonly id: string;
  readonly status: string;
  readonly lane: string;
  readonly title: string;
}

/** A grouped two-column, two-lane fixture with one empty cell. */
export const TASKBOARD_TEST_COLUMNS: readonly MlvTaskboardColumn[] = [
  { id: 'todo', label: 'Todo', groupId: 'work', wipLimit: 3 },
  { id: 'done', label: 'Done', groupId: 'work', collapsible: true },
];

/** The group shared by the taskboard test columns. */
export const TASKBOARD_TEST_GROUPS: readonly MlvTaskboardColumnGroup[] = [
  { id: 'work', label: 'Work' },
];

/** The lanes used by taskboard component integration tests. */
export const TASKBOARD_TEST_LANES: readonly MlvTaskboardSwimlane[] = [
  { id: 'engineering', label: 'Engineering' },
  { id: 'design', label: 'Design' },
];

/** Cards arranged across the grouped test board. */
export const TASKBOARD_TEST_ITEMS: readonly TaskboardTestTicket[] = [
  { id: 'one', status: 'todo', lane: 'engineering', title: 'First card' },
  { id: 'two', status: 'todo', lane: 'design', title: 'Second card' },
  { id: 'three', status: 'done', lane: 'engineering', title: 'Third card' },
];
