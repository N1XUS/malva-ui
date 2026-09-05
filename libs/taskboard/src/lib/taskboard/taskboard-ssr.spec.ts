import { DOCUMENT } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { renderApplication } from '@angular/platform-server';
import Sortable from 'sortablejs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MlvTaskboard } from './taskboard';
import {
  TASKBOARD_TEST_COLUMNS,
  TASKBOARD_TEST_GROUPS,
  TASKBOARD_TEST_ITEMS,
  TASKBOARD_TEST_LANES,
  provideTaskboardTesting,
} from '../testing/taskboard-test-context';

@Component({
  selector: 'mlv-taskboard-ssr-host',
  imports: [MlvTaskboard],
  template: `
    <mlv-taskboard
      [items]="items()"
      [columns]="columns"
      [columnGroups]="groups"
      [swimlanes]="lanes"
      dataKey="id"
      columnField="status"
      swimlaneField="lane"
    />
  `,
})
class SsrHost {
  readonly columns = TASKBOARD_TEST_COLUMNS;
  readonly groups = TASKBOARD_TEST_GROUPS;
  readonly lanes = TASKBOARD_TEST_LANES;
  readonly items = signal(TASKBOARD_TEST_ITEMS);
}

/** Restores a global this spec shadowed, whether or not it owned one before. */
function restoreGlobal(
  name: string,
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor);
  else delete (globalThis as Record<string, unknown>)[name];
}

/**
 * Installs a `vi.fn()` in place of a browser global for one render, so "the
 * board never reached for it" is an assertion on a spy rather than an
 * assertion that nothing threw. Both globals are absent from this environment,
 * so shadowing them also keeps a reach-for from being a silent `undefined`.
 */
function shadowGlobal(name: string): {
  readonly spy: ReturnType<typeof vi.fn>;
  restore: () => void;
} {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
  const spy = vi.fn();
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value: spy,
  });
  return { spy, restore: () => restoreGlobal(name, descriptor) };
}

describe('MlvTaskboard server rendering', () => {
  afterEach(() => vi.restoreAllMocks());

  /**
   * Renders `component` through `@angular/platform-server`, with every
   * browser-only touchpoint the board owns replaced by a spy.
   *
   * `DOCUMENT` is re-provided at application level as a `Proxy` over the
   * platform's own server document (`skipSelf`), so a `defaultView` read from
   * the board — `print()` is the only one in the component — is counted
   * instead of merely returning `null`.
   */
  async function renderWithSpies(component: unknown) {
    const sortableCreate = vi.spyOn(Sortable, 'create');
    const resizeObserver = shadowGlobal('ResizeObserver');
    const matchMedia = shadowGlobal('matchMedia');
    const defaultViewReads = vi.fn();

    try {
      const html = await renderApplication(
        (context) =>
          bootstrapApplication(
            component as never,
            {
              providers: [
                provideTaskboardTesting(),
                {
                  provide: DOCUMENT,
                  useFactory: () =>
                    new Proxy(inject(DOCUMENT, { skipSelf: true }), {
                      get(target, property, receiver) {
                        if (property === 'defaultView') defaultViewReads();
                        const value = Reflect.get(target, property, receiver);
                        return typeof value === 'function'
                          ? value.bind(target)
                          : value;
                      },
                    }),
                },
              ],
            },
            context,
          ),
        {
          document: '<mlv-taskboard-ssr-host></mlv-taskboard-ssr-host>',
          url: '/',
        },
      );
      return {
        html,
        sortableCreate,
        resizeObserver: resizeObserver.spy,
        matchMedia: matchMedia.spy,
        defaultViewReads,
      };
    } finally {
      resizeObserver.restore();
      matchMedia.restore();
    }
  }

  it('server-renders the whole grid role tree with its projected cards', async () => {
    const { html } = await renderWithSpies(SsrHost);

    // grid > rowgroup > row > gridcell, the tree AT-users navigate.
    expect(html).toContain('role="grid"');
    expect(html).toContain('role="rowgroup"');
    expect(html).toContain('class="mlv-taskboard__lane"');
    expect(html).toContain('role="gridcell"');

    // Every cell's cards host is the listbox that owns the cards.
    expect(html).toContain('role="listbox"');
    expect(html).toContain('aria-multiselectable="true"');
    expect(
      html.match(
        /aria-labelledby="mlv-taskboard-\d+-column-\d+ mlv-taskboard-\d+-lane-\d+"/g,
      ),
    ).toHaveLength(4);

    // All three fixture cards are options, and exactly one is the tab stop.
    expect(html.match(/role="option"/g)).toHaveLength(3);
    expect(html).toContain('Task one');
    expect(html).toContain('Task two');
    expect(html).toContain('Task three');
    expect(
      html.match(/class="mlv-taskboard__card" [^>]*tabindex="0"/g),
    ).toHaveLength(1);

    // The empty cell keeps its placeholder, and the localized chrome resolves.
    expect(html).toContain('>No cards</p>');
    expect(html).toContain('Add card');
    expect(html).toContain('aria-label="Taskboard"');
    expect(html).toContain('aria-live="polite"');
  }, 30_000);

  it('reaches for no browser-only API while rendering that tree', async () => {
    const { sortableCreate, resizeObserver, matchMedia, defaultViewReads } =
      await renderWithSpies(SsrHost);

    // The pointer-drag adapter registers a bucket per cell from
    // `afterNextRender`, which never runs on the server.
    expect(sortableCreate).not.toHaveBeenCalled();
    expect(resizeObserver).not.toHaveBeenCalled();
    expect(matchMedia).not.toHaveBeenCalled();
    // `print()` is the board's only `defaultView` read; a render performs none.
    expect(defaultViewReads).not.toHaveBeenCalled();
  }, 30_000);
});
