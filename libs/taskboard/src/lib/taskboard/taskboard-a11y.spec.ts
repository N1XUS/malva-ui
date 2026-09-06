import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { Component, signal, type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { MlvTaskboardItemDef } from '../taskboard-defs';
import type { MlvTaskboardColumn } from '../taskboard.types';
import { MlvTaskboard } from './taskboard';
import {
  TASKBOARD_TEST_ITEMS,
  TASKBOARD_TEST_LANES,
  provideTaskboardTesting,
  type TaskboardTestTicket,
} from '../testing/taskboard-test-context';

/**
 * `done` is locked so a keyboard grab aimed at it produces the refused drop
 * preview, which is the only way the invalid drop indicator renders.
 */
const A11Y_COLUMNS: readonly MlvTaskboardColumn[] = [
  { id: 'todo', label: 'Todo', wipLimit: 3 },
  { id: 'done', label: 'Done', locked: true },
];

@Component({
  imports: [MlvTaskboard],
  template: `
    <mlv-taskboard
      [items]="items()"
      [columns]="columns"
      [swimlanes]="lanes"
      [selection]="selection()"
      [collapsedColumnIds]="collapsedColumnIds()"
      [collapsedSwimlaneIds]="collapsedSwimlaneIds()"
      [virtualItemSize]="virtualItemSize()"
      dataKey="id"
      columnField="status"
      swimlaneField="lane"
    />
  `,
})
class A11yHost {
  readonly columns = A11Y_COLUMNS;
  readonly lanes = TASKBOARD_TEST_LANES;
  readonly items = signal<readonly TaskboardTestTicket[]>(TASKBOARD_TEST_ITEMS);
  readonly selection = signal<ReadonlySet<string>>(new Set());
  readonly collapsedColumnIds = signal<ReadonlySet<string>>(new Set());
  readonly collapsedSwimlaneIds = signal<ReadonlySet<string>>(new Set());
  readonly virtualItemSize = signal<number | undefined>(undefined);
}

@Component({
  imports: [MlvTaskboard, MlvTaskboardItemDef],
  template: `
    <mlv-taskboard
      [items]="items()"
      [columns]="columns"
      [swimlanes]="lanes"
      dataKey="id"
      columnField="status"
      swimlaneField="lane"
    >
      <ng-template
        mlvTaskboardItemDef
        [mlvTaskboardItemDefFrom]="itemType"
        let-card
        let-column="column"
      >
        <span class="custom-card">{{ card.title }}</span>
        <span class="custom-card__meta">in {{ column.label }}</span>
      </ng-template>
    </mlv-taskboard>
  `,
})
class TemplateA11yHost {
  readonly columns = A11Y_COLUMNS;
  readonly lanes = TASKBOARD_TEST_LANES;
  readonly items = signal<readonly TaskboardTestTicket[]>(TASKBOARD_TEST_ITEMS);
  readonly itemType: TaskboardTestTicket = TASKBOARD_TEST_ITEMS[0];
}

describe('MlvTaskboard accessibility', () => {
  async function mount<THost>(type: Type<THost>) {
    await TestBed.configureTestingModule({
      imports: [type],
      providers: [provideTaskboardTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(type);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    return { fixture, host };
  }

  /**
   * Runs axe over the whole rendered board.
   *
   * `color-contrast` is off because jsdom has no canvas-backed colour
   * computation, so the rule can only guess; token contrast is covered by
   * `libs/styles` and manual review instead.
   */
  async function violationsOf(host: HTMLElement) {
    const results = await axe.run(host, {
      resultTypes: ['violations'],
      rules: { 'color-contrast': { enabled: false } },
    });
    return results.violations.map(({ id, impact, nodes }) => ({
      id,
      impact,
      nodes: nodes.map((node) => node.html),
    }));
  }

  /** Focuses a card and presses `key` on it, as a keyboard user would. */
  function press(host: HTMLElement, cardId: string, key: string): void {
    const card = host.querySelector(
      `[data-mlv-taskboard-card-id="string:${cardId}"]`,
    ) as HTMLElement;
    card.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  }

  it('has no axe violations on the default board', async () => {
    const { host } = await mount(A11yHost);

    // State: two grouped columns across two swimlanes, three cards, one cell
    // empty — the board as a consumer first renders it.
    expect(host.querySelectorAll('[role="listbox"]')).toHaveLength(4);
    expect(host.querySelectorAll('[role="option"]')).toHaveLength(3);

    expect(await violationsOf(host)).toEqual([]);
  }, 30_000);

  it('has no axe violations with a card selected', async () => {
    const { fixture, host } = await mount(A11yHost);

    // State: `selection` holds one card, so its option is aria-selected.
    fixture.componentInstance.selection.set(new Set(['one']));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.querySelectorAll('[aria-selected="true"]')).toHaveLength(1);

    expect(await violationsOf(host)).toEqual([]);
  }, 30_000);

  it('has no axe violations while a grab aims at an invalid drop target', async () => {
    const { fixture, host } = await mount(A11yHost);

    // State: card `one` is grabbed and aimed at the locked `done` column, so
    // the refused drop indicator renders and the live region names the reason.
    const card = host.querySelector(
      '[data-mlv-taskboard-card-id="string:one"]',
    ) as HTMLElement;
    card.focus();
    fixture.detectChanges();
    press(host, 'one', ' ');
    fixture.detectChanges();
    press(host, 'one', 'ArrowRight');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(
      host.querySelector('.mlv-taskboard__drop-indicator--invalid'),
    ).not.toBeNull();
    expect(
      host.querySelector('.mlv-taskboard__live-region')?.textContent,
    ).toContain('Cannot move to Done');

    expect(await violationsOf(host)).toEqual([]);
  }, 30_000);

  it('has no axe violations with a collapsed column', async () => {
    const { fixture, host } = await mount(A11yHost);

    // State: the `done` column is collapsed, so its header and both of its
    // cells are marked collapsed while they stay in the grid.
    fixture.componentInstance.collapsedColumnIds.set(new Set(['done']));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(
      host.querySelectorAll('.mlv-taskboard__column-header[data-collapsed]'),
    ).toHaveLength(1);
    expect(
      host.querySelectorAll('.mlv-taskboard__cell[data-collapsed]'),
    ).toHaveLength(2);

    expect(await violationsOf(host)).toEqual([]);
  }, 30_000);

  it('has no axe violations with a collapsed swimlane', async () => {
    const { fixture, host } = await mount(A11yHost);

    // State: the `design` lane is collapsed, so its row is marked collapsed
    // while its cells stay in the grid.
    fixture.componentInstance.collapsedSwimlaneIds.set(new Set(['design']));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(
      host.querySelectorAll('.mlv-taskboard__lane[data-collapsed]'),
    ).toHaveLength(1);
    expect(
      host.querySelectorAll('.mlv-taskboard__cell[data-collapsed]'),
    ).toHaveLength(2);

    expect(await violationsOf(host)).toEqual([]);
  }, 30_000);

  it('has no axe violations when every cell is empty', async () => {
    const { fixture, host } = await mount(A11yHost);

    // State: no cards at all, so each listbox owns zero options and renders
    // the empty-cell text and the add affordance as its siblings.
    fixture.componentInstance.items.set([]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.querySelectorAll('[role="option"]')).toHaveLength(0);
    expect(host.querySelectorAll('.mlv-taskboard__empty')).toHaveLength(4);

    expect(await violationsOf(host)).toEqual([]);
  }, 30_000);

  it('has no axe violations on a virtualized cell', async () => {
    const { fixture, host } = await mount(A11yHost);

    // State: virtual cells, so the listbox is the CDK viewport host and the
    // options sit inside its presentational content wrapper.
    fixture.componentInstance.virtualItemSize.set(40);
    fixture.detectChanges();
    await fixture.whenStable();

    // jsdom lays nothing out, so a viewport measures zero and renders no card.
    // Give each one a real block size and re-measure.
    for (const debugElement of fixture.debugElement.queryAll(
      By.directive(CdkVirtualScrollViewport),
    )) {
      const viewport = debugElement.injector.get(CdkVirtualScrollViewport);
      viewport.elementRef.nativeElement.getBoundingClientRect = () =>
        ({
          top: 0,
          left: 0,
          right: 300,
          bottom: 200,
          width: 300,
          height: 200,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect;
      viewport.checkViewportSize();
    }
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const viewportListboxes = host.querySelectorAll(
      'cdk-virtual-scroll-viewport[role="listbox"]',
    );
    expect(viewportListboxes).toHaveLength(4);
    // The case is only meaningful once a virtualized option actually rendered.
    expect(
      host.querySelectorAll('cdk-virtual-scroll-viewport [role="option"]')
        .length,
    ).toBeGreaterThan(0);
    expect(
      host
        .querySelector('.cdk-virtual-scroll-content-wrapper')
        ?.getAttribute('role'),
    ).toBe('presentation');

    // CDK's own sizing spacer is a role-less child of the viewport listbox.
    // Pinned so this case keeps covering it: if a future axe or CDK version
    // starts counting it as an owned child, this listbox stops being valid.
    const spacer = host.querySelector('.cdk-virtual-scroll-spacer');
    expect(spacer).not.toBeNull();
    expect(spacer?.parentElement?.getAttribute('role')).toBe('listbox');
    expect(spacer?.hasAttribute('role')).toBe(false);

    expect(await violationsOf(host)).toEqual([]);
  }, 30_000);

  it('has no axe violations with a custom card template', async () => {
    const { host } = await mount(TemplateA11yHost);

    // State: `mlvTaskboardItemDef` replaces the built-in card button, so each
    // option is a projected div that must carry the option semantics itself.
    expect(host.querySelectorAll('.custom-card')).toHaveLength(3);
    expect(
      host.querySelectorAll('div.mlv-taskboard__card[role="option"]'),
    ).toHaveLength(3);

    expect(await violationsOf(host)).toEqual([]);
  }, 30_000);
});
