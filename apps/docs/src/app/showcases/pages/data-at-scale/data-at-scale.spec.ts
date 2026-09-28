import type { BreakpointState } from '@angular/cdk/layout';
import { BreakpointObserver } from '@angular/cdk/layout';
import {
  ApplicationInitStatus,
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { BehaviorSubject } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { provideMlvDensity } from '@malva-ui/cdk/density';
import { MlvDataTable } from '@malva-ui/core/data-table';
// The service/provider contract is static; only locale data is split into lazy packs.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { provideMlvI18n } from '@malva-ui/i18n';
import { buildScaleDataset } from './backend/scale-dataset';
import { runScaleQuery } from './backend/scale-engine';
import { absoluteNow } from './backend/scale-protocol';
import type {
  ScaleDatasetConfig,
  ScaleResponse,
  ScaleRow,
} from './backend/scale-protocol';
import { SCALE_BACKEND_FACTORY } from './scale-backend';
import type { ScaleBackend } from './scale-backend';
import { DataAtScaleShowcaseComponent } from './data-at-scale';
import {
  SCALE_DEFAULT_ROOT_FONT_PX,
  SCALE_MAX_SCROLLABLE_PX,
  SCALE_ROW_HEIGHT_REM,
  readScaleRootFontPx,
  scaleMaxVirtualRows,
  scaleRowHeightPx,
} from './data-at-scale.data';

const MD_QUERY = '(min-width: 768px)';
const LG_QUERY = '(min-width: 1200px)';

/**
 * Rows the spec backend generates no matter what the page asks for.
 *
 * The page defaults to 100,000 rows, which is the point of the showcase and
 * hopeless in a spec. Clamping here keeps every assertion about the wiring —
 * the query round trip, the identity cache, the measurement pipeline — rather
 * than about how fast jsdom can allocate objects.
 */
const SPEC_ROWS = 120;

/**
 * A backend that runs the real generator and the real query engine on the
 * calling thread, over a deliberately tiny dataset.
 *
 * jsdom exposes no `Worker` at all, so this is also what the page would fall
 * back to in such an environment — which is why `kind` reports the truth.
 */
const specBackendFailures: ((reason: string) => void)[] = [];

/**
 * Reports a fatal transport failure on the most recently created spec backend,
 * the way a dying worker's `error` event does — no request id, nothing that
 * will ever answer the request in flight.
 */
function failSpecBackend(reason: string): void {
  const fail = specBackendFailures.at(-1);
  if (!fail) throw new Error('No spec backend has been created yet.');
  fail(reason);
}

function createSpecBackend(): ScaleBackend {
  const listeners = new Set<(response: ScaleResponse) => void>();
  const errorListeners = new Set<(reason: string) => void>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let rows: readonly ScaleRow[] = [];
  let disposed = false;

  specBackendFailures.push((reason) => {
    for (const listener of [...errorListeners]) listener(reason);
  });

  const emit = (response: ScaleResponse): void => {
    if (disposed) return;
    for (const listener of [...listeners]) listener(response);
  };
  const later = (delayMs: number, run: () => void): void => {
    const timer = setTimeout(
      () => {
        timers.delete(timer);
        run();
      },
      Math.max(0, delayMs),
    );
    timers.add(timer);
  };

  return {
    kind: 'main-thread',
    post(request) {
      if (disposed) return;
      if (request.type === 'init') {
        const config: ScaleDatasetConfig = {
          ...request.config,
          rowCount: Math.min(SPEC_ROWS, request.config.rowCount),
        };
        const built = buildScaleDataset(config);
        rows = built.rows;
        later(0, () =>
          emit({
            type: 'ready',
            config,
            topLevelRows: built.rows.length,
            totalRows: built.totalRows,
            generateMs: 0.5,
            sentAt: absoluteNow(),
          }),
        );
        return;
      }
      const result = runScaleQuery(rows, request.state);
      later(request.latencyMs, () =>
        emit({
          type: 'result',
          id: request.id,
          rows: result.rows,
          total: result.total,
          computeMs: result.computeMs,
          latencyMs: request.latencyMs,
          sentAt: absoluteNow(),
        }),
      );
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    subscribeError(listener) {
      errorListeners.add(listener);
      return () => {
        errorListeners.delete(listener);
      };
    },
    terminate() {
      disposed = true;
      listeners.clear();
      errorListeners.clear();
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
    },
  };
}

@Component({
  selector: 'docs-data-at-scale-test-host',
  imports: [RouterOutlet],
  template: '<router-outlet />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class DataAtScaleTestHostComponent {}

interface RenderedShowcase {
  readonly component: DataAtScaleShowcaseComponent;
  readonly table: MlvDataTable;
  readonly root: HTMLElement;
  readonly router: Router;
  readonly harness: RouterTestingHarness;
}

function viewportState(): BreakpointState {
  return { matches: true, breakpoints: { [MD_QUERY]: true, [LG_QUERY]: true } };
}

/**
 * Flushes change detection, the backend's timers, and the frame hop the paint
 * measurement waits on.
 */
async function settle(rendered: RenderedShowcase, delay = 80): Promise<void> {
  rendered.harness.fixture.detectChanges();
  await TestBed.inject(ApplicationRef).whenStable();
  await new Promise((resolve) => setTimeout(resolve, delay));
  rendered.harness.fixture.detectChanges();
  await TestBed.inject(ApplicationRef).whenStable();
}

async function renderShowcase(
  url = '/showcases/data-at-scale',
): Promise<RenderedShowcase> {
  await TestBed.configureTestingModule({
    providers: [
      provideRouter([
        {
          path: '',
          component: DataAtScaleTestHostComponent,
          children: [
            {
              path: 'showcases/data-at-scale',
              component: DataAtScaleShowcaseComponent,
            },
          ],
        },
      ]),
      provideMlvDensity('comfortable'),
      provideMlvI18n(() => import('@malva-ui/i18n/en')),
      {
        provide: BreakpointObserver,
        useValue: { observe: () => new BehaviorSubject(viewportState()) },
      },
      { provide: SCALE_BACKEND_FACTORY, useValue: createSpecBackend },
    ],
  }).compileComponents();
  await TestBed.inject(ApplicationInitStatus).donePromise;

  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url);
  const debugElement = harness.fixture.debugElement.query(
    By.directive(DataAtScaleShowcaseComponent),
  );
  const rendered: RenderedShowcase = {
    component: debugElement.componentInstance as DataAtScaleShowcaseComponent,
    table: harness.fixture.debugElement.query(By.directive(MlvDataTable))
      .componentInstance as MlvDataTable,
    root: harness.fixture.nativeElement as HTMLElement,
    router: TestBed.inject(Router),
    harness,
  };
  // The dialled-in latency exists to make the loading affordance visible on the
  // real page; a spec only needs the round trip, not the wait.
  rendered.component.setLatency(0);
  await settle(rendered, 200);
  return rendered;
}

function textOf(root: HTMLElement, selector: string): string {
  return (root.querySelector(selector)?.textContent ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Runs `body` with `globalThis.matchMedia` replaced, then restores exactly what
 * was there — including its absence, which is what jsdom presents.
 */
async function withMatchMedia(
  stub: (query: string) => { matches: boolean },
  body: () => Promise<void>,
): Promise<void> {
  const global = globalThis as unknown as Record<string, unknown>;
  const original = Object.getOwnPropertyDescriptor(globalThis, 'matchMedia');
  Object.defineProperty(globalThis, 'matchMedia', {
    configurable: true,
    writable: true,
    value: stub,
  });
  try {
    await body();
  } finally {
    if (original) Object.defineProperty(globalThis, 'matchMedia', original);
    else delete global['matchMedia'];
  }
}

describe('DataAtScaleShowcaseComponent', () => {
  it('renders one main landmark and the documented method section', async () => {
    const rendered = await renderShowcase();

    expect(rendered.root.querySelectorAll('main')).toHaveLength(1);
    expect(textOf(rendered.root, 'h1')).toBe('Data at scale');
    const method = rendered.root.querySelector(
      '.data-at-scale-showcase__method',
    );
    expect(method?.querySelector('h2')?.textContent).toContain(
      'How these numbers are measured',
    );
    // The issue's acceptance criterion is that the method is documented on the
    // page, including that the numbers belong to the visitor's machine.
    const methodText = (method?.textContent ?? '').replace(/\s+/g, ' ');
    expect(methodText).toContain('your');
    expect(methodText).toContain('not comparable');
    expect(
      Array.from(method?.querySelectorAll('h3') ?? []).map((heading) =>
        heading.textContent?.trim(),
      ),
    ).toEqual([
      'The dataset',
      'Where the work happens',
      'Initial render',
      'Scroll frame rate',
      'Filter latency',
      'What these numbers do not prove',
    ]);
  });

  it('drives the table from the backend-held dataset', async () => {
    const rendered = await renderShowcase();

    expect(rendered.component.dataset()?.topLevelRows).toBe(SPEC_ROWS);
    expect(rendered.component.source.totalItems()).toBe(SPEC_ROWS);
    // Virtual scroll is the default mode, and it asks the source for every
    // matching row rather than a page.
    expect(rendered.component.mode()).toBe('virtual');
    expect(rendered.component.source.connect()()).toHaveLength(SPEC_ROWS);
    expect(rendered.component.lastQuery()?.unpaged).toBe(true);
    expect(
      rendered.root.querySelector('cdk-virtual-scroll-viewport'),
    ).not.toBeNull();
    // The fact reports the rows the main thread is actually holding, so it is
    // read off the source rather than off a benchmark sample.
    expect(textOf(rendered.root, '.data-at-scale-showcase__facts')).toMatch(
      new RegExp(`Rows on the main thread\\s*${SPEC_ROWS}`),
    );
    expect(rendered.router.url).toBe(
      '/showcases/data-at-scale?view=all-accounts',
    );
  });

  it('switches to a server-side page and renders exactly that page', async () => {
    const rendered = await renderShowcase();

    rendered.component.setMode('paged');
    await settle(rendered);

    expect(rendered.component.source.connect()()).toHaveLength(25);
    expect(rendered.component.lastQuery()?.unpaged).toBe(false);
    expect(rendered.component.lastQuery()?.total).toBe(SPEC_ROWS);
    expect(
      rendered.root.querySelectorAll('.mlv-data-table__row--data'),
    ).toHaveLength(25);
  });

  it('drops the unpaged rows synchronously when the table leaves virtual scroll', async () => {
    const rendered = await renderShowcase();
    expect(rendered.component.source.connect()()).toHaveLength(SPEC_ROWS);

    rendered.component.setMode('paged');

    // Deliberately not awaited. `[virtualScroll]` reads `mode()`, so it is
    // already false for the next change detection pass — and anything the
    // source is still holding at this instant gets rendered unvirtualised, one
    // `<tr>` per row plus a selection checkbox. At the 100,000 rows this page
    // exists to demonstrate that is a frozen tab, so the rows have to be gone
    // before the pass runs, not after the backend answers.
    expect(rendered.component.source.connect()()).toHaveLength(0);
    expect(rendered.component.source.loading()).toBe(true);
    rendered.harness.fixture.detectChanges();
    expect(
      rendered.root.querySelectorAll('.mlv-data-table__row--data'),
    ).toHaveLength(0);

    await settle(rendered);

    expect(rendered.component.source.connect()()).toHaveLength(25);
    expect(rendered.component.source.loading()).toBe(false);
  });

  it('drops the page synchronously when the table enters virtual scroll', async () => {
    const rendered = await renderShowcase();
    rendered.component.setMode('paged');
    await settle(rendered);
    expect(rendered.component.source.connect()()).toHaveLength(25);

    rendered.component.setMode('virtual');
    expect(rendered.component.source.connect()()).toHaveLength(0);

    await settle(rendered);

    expect(rendered.component.source.connect()()).toHaveLength(SPEC_ROWS);
    expect(rendered.component.lastQuery()?.unpaged).toBe(true);
  });

  it('never lets an in-flight unpaged answer land in a paged table', async () => {
    const rendered = await renderShowcase();
    // Enough delay that the query below is still outstanding when the mode
    // changes underneath it.
    rendered.component.setLatency(120);
    rendered.component.onFiltersChange([
      { key: 'plan', operator: 'equals', value: 'Enterprise' },
    ]);
    // One turn of change detection: long enough for the table's effects to push
    // the filter onto the source and for the request to go out, far too short
    // for the answer to come back.
    rendered.harness.fixture.detectChanges();
    await TestBed.inject(ApplicationRef).whenStable();
    expect(rendered.component.source.loading()).toBe(true);

    rendered.component.setMode('paged');
    expect(rendered.component.source.connect()()).toHaveLength(0);
    rendered.component.setLatency(0);
    await settle(rendered, 300);

    // The superseded answer was the whole result set; only the reshaped one may
    // reach the table.
    expect(rendered.component.lastQuery()?.unpaged).toBe(false);
    expect(rendered.component.source.connect()().length).toBeLessThanOrEqual(
      25,
    );
    expect(
      rendered.root.querySelectorAll('.mlv-data-table__row--data').length,
    ).toBeLessThanOrEqual(25);
  });

  it('falls back to paging for a dataset taller than the browser will scroll', async () => {
    const rendered = await renderShowcase();
    expect(rendered.component.virtualScrollFits()).toBe(true);

    // 60 px a row past ~279,000 rows asks for a spacer taller than the
    // 16,777,214 px the page allows one scroller. Past it the browser stops
    // scrolling with nothing logged (Firefox drops the height outright), so
    // the mode has to give way, not the dataset.
    rendered.component.setRowCount(1_000_000);
    await settle(rendered, 200);

    expect(rendered.component.virtualScrollFits()).toBe(false);
    expect(rendered.component.mode()).toBe('virtual');
    expect(rendered.component.effectiveMode()).toBe('paged');
    expect(rendered.table.virtualScroll()).toBe(false);
    expect(
      rendered.root.querySelector('cdk-virtual-scroll-viewport'),
    ).toBeNull();
    expect(rendered.component.lastQuery()?.unpaged).toBe(false);

    // The reason is on the page, not only in the console.
    const alert = Array.from(rendered.root.querySelectorAll('mlv-alert')).find(
      (element) => element.textContent?.includes('one scroller'),
    );
    expect(alert?.textContent).toContain('Too many rows for one scroller');
    expect(
      Array.from(
        rendered.root.querySelectorAll('.mlv-segmented-item--disabled'),
      ).map((item) => item.textContent?.trim()),
    ).toEqual(['Virtual scroll']);

    // Coming back down restores the mode the visitor originally chose.
    rendered.component.setRowCount(100_000);
    await settle(rendered, 200);
    expect(rendered.component.effectiveMode()).toBe('virtual');
  });

  it('lowers the one-scroller ceiling under a larger browser font size', async () => {
    // The table measures its rem row height (#363), so at a 20px root it
    // strides 75px, not 60: 250,000 rows ask for an 18,750,000px spacer,
    // which Firefox drops outright — measured, `scrollHeight` collapsed to
    // the container and the tail was unreachable. The ceiling has to follow
    // the same root font size the rows do.
    const root = document.documentElement;
    const previous = root.style.fontSize;
    root.style.fontSize = '20px';
    try {
      const rendered = await renderShowcase();
      expect(rendered.component.rowHeight).toBe(75);
      expect(rendered.component.maxVirtualRows).toBe(223_696);

      rendered.component.setRowCount(250_000);
      await settle(rendered, 200);

      expect(rendered.component.virtualScrollFits()).toBe(false);
      expect(rendered.component.effectiveMode()).toBe('paged');
      expect(rendered.table.virtualScroll()).toBe(false);
      expect(rendered.component.benchmarkStatus()).toContain('75 px');

      rendered.component.setRowCount(100_000);
      await settle(rendered, 200);
      expect(rendered.component.effectiveMode()).toBe('virtual');
      // Only 100,000 still fits in one scroller at this font size, and the
      // size control says so.
      const description = textOf(
        rendered.root,
        '.data-at-scale-showcase__controls mlv-select mlv-description',
      );
      expect(description).toMatch(/virtual scroll on, 100.?000 rows transfer/);
      expect(description).toMatch(/250.?000, 500.?000 and 1.?000.?000 rows/);
    } finally {
      root.style.fontSize = previous;
    }
  });

  it('sends search and filters to the backend rather than filtering locally', async () => {
    const rendered = await renderShowcase();
    const first = rendered.component.source.connect()()[0];

    rendered.component.onSearchChange(first.ref);
    await settle(rendered);

    expect(rendered.component.source.totalItems()).toBe(1);
    expect(rendered.component.source.connect()()[0].ref).toBe(first.ref);

    rendered.component.onSearchChange('');
    rendered.component.onFiltersChange([
      { key: 'plan', operator: 'equals', value: 'Enterprise' },
    ]);
    await settle(rendered);

    const rows = rendered.component.source.connect()();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(SPEC_ROWS);
    expect(rows.every((row) => row.plan === 'Enterprise')).toBe(true);
  });

  it('publishes an initial-render measurement for the first painted frame', async () => {
    const rendered = await renderShowcase();
    const sample = rendered.component.initialRender();

    expect(sample).not.toBeNull();
    expect(sample?.rowsReturned).toBe(SPEC_ROWS);
    expect(sample?.datasetRows).toBe(SPEC_ROWS);
    expect(Number.isFinite(sample?.renderMs)).toBe(true);
    expect(sample?.endToEndMs).toBeGreaterThanOrEqual(sample?.renderMs ?? 0);
    expect(
      textOf(rendered.root, '.data-at-scale-showcase__metric-value'),
    ).toMatch(/^[\d,.]+ ?ms$/);
  });

  it('discards a paint measurement taken while the tab is hidden, then re-measures', async () => {
    let hidden = true;
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => hidden,
    });

    try {
      const rendered = await renderShowcase();

      // A hidden tab receives no animation frames at all, so the interval
      // between the rows arriving and the frame that finally runs is browser
      // scheduling, not render cost.
      expect(rendered.component.initialRender()).toBeNull();
      expect(rendered.component.benchmarkStatus()).toContain('hidden');

      hidden = false;
      document.dispatchEvent(new Event('visibilitychange'));
      await settle(rendered, 200);

      const sample = rendered.component.initialRender();
      expect(sample).not.toBeNull();
      expect(sample?.rowsReturned).toBe(SPEC_ROWS);
      expect(Number.isFinite(sample?.renderMs)).toBe(true);
    } finally {
      delete (document as unknown as { hidden?: boolean }).hidden;
    }
  });

  it('measures a filter round trip from commit to painted frame', async () => {
    const rendered = await renderShowcase();

    rendered.component.measureFilterLatency();
    await settle(rendered);

    const sample = rendered.component.filterSample();
    expect(sample).not.toBeNull();
    expect(sample?.interaction).toBe('filter');
    expect(sample?.total).toBeLessThan(SPEC_ROWS);
    expect(sample?.commitToPaintMs).not.toBeNull();
    expect(sample?.commitToPaintMs ?? -1).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(sample?.computeMs)).toBe(true);
    expect(sample?.latencyMs).toBe(0);
    // The breakdown is published part by part, never summed into one number.
    const breakdown = Array.from(
      rendered.root.querySelectorAll('.data-at-scale-showcase__breakdown dt'),
    ).map((term) => term.textContent?.trim());
    expect(breakdown).toContain('Backend compute');
    expect(breakdown).toContain('Transfer');
    // The identity pass is a main-thread walk of every delivered row, so it is
    // published rather than left in the gap between transfer and render.
    expect(breakdown).toContain('Row identity');
    expect(breakdown).toContain('Main-thread render');
    expect(sample?.identifyMs).toBeGreaterThanOrEqual(0);
  });

  it('samples scroll frames and publishes the frame rate', async () => {
    const rendered = await renderShowcase();

    await rendered.component.measureScroll(60);
    await settle(rendered);

    const sample = rendered.component.scrollSample();
    expect(sample).not.toBeNull();
    expect(sample?.frames ?? 0).toBeGreaterThanOrEqual(2);
    expect(sample?.fps ?? 0).toBeGreaterThan(0);
    expect(sample?.displayCapHz ?? 0).toBeGreaterThanOrEqual(sample?.fps ?? 0);
    expect(rendered.component.scrollRunning()).toBe(false);
    expect(rendered.component.benchmarkStatus()).toContain('Sampled');
    expect(
      Array.from(
        rendered.root.querySelectorAll('.data-at-scale-showcase__metric-value'),
      ).map((value) => value.textContent?.replace(/\s+/g, ' ').trim()),
    ).toContainEqual(expect.stringMatching(/fps$/));
  });

  it('shows a dead backend as an error row instead of a permanent loading overlay', async () => {
    const rendered = await renderShowcase();

    // Nothing between these three statements may await: a timer firing would
    // answer the request and hide the very state under test.
    rendered.component.source.refresh();
    expect(rendered.component.source.loading()).toBe(true);
    failSpecBackend('The worker stopped before it could answer.');

    expect(rendered.component.source.loading()).toBe(false);
    expect(rendered.component.source.error()).toBe(
      'The worker stopped before it could answer.',
    );

    rendered.harness.fixture.detectChanges();
    expect(
      rendered.root.querySelector('.mlv-data-table__row--error'),
    ).not.toBeNull();
    expect(textOf(rendered.root, '.mlv-data-table__error')).toContain(
      'The worker stopped before it could answer.',
    );
  });

  it('clears the error and re-renders rows when the retry succeeds', async () => {
    const rendered = await renderShowcase();
    rendered.component.source.refresh();
    failSpecBackend('The worker stopped before it could answer.');
    rendered.harness.fixture.detectChanges();
    expect(
      rendered.root.querySelector('.mlv-data-table__row--error'),
    ).not.toBeNull();

    rendered.component.retryQuery();
    await settle(rendered);

    expect(rendered.component.source.error()).toBeNull();
    expect(
      rendered.root.querySelector('.mlv-data-table__row--error'),
    ).toBeNull();
    expect(rendered.component.source.connect()()).toHaveLength(SPEC_ROWS);
  });

  it('says at the size control which options transfer the whole result set', async () => {
    const rendered = await renderShowcase();

    const description = textOf(
      rendered.root,
      '.data-at-scale-showcase__controls mlv-select mlv-description',
    );
    // Both offered sizes that still fit in one scroller clone every matching
    // row onto the main thread per interaction; the control used to say
    // nothing about it.
    expect(description).toMatch(/100.?000 and 250.?000/);
    expect(description).toContain('whole result set');

    rendered.component.setMode('paged');
    await settle(rendered);

    expect(
      textOf(
        rendered.root,
        '.data-at-scale-showcase__controls mlv-select mlv-description',
      ),
    ).toContain('one page');
  });

  it('refuses the scroll benchmark when the system asks for reduced motion', async () => {
    const rendered = await renderShowcase();

    await withMatchMedia(
      (query) => ({ matches: query === '(prefers-reduced-motion: reduce)' }),
      async () => {
        await rendered.component.measureScroll(60);
      },
    );

    expect(rendered.component.scrollSample()).toBeNull();
    expect(rendered.component.scrollRunning()).toBe(false);
    expect(rendered.component.benchmarkStatus()).toContain('reduced motion');
  });

  it('abandons a scroll run when the page is destroyed mid-sample', async () => {
    const rendered = await renderShowcase();

    const startedAt = Date.now();
    const run = rendered.component.measureScroll(2000);
    // Everything up to the first await runs synchronously, so the run is
    // genuinely under way rather than having bailed out for want of a scroller.
    expect(rendered.component.scrollRunning()).toBe(true);
    expect(rendered.component.benchmarkStatus()).toContain('Sampling frames');

    await rendered.harness.navigateByUrl('/');
    await run;

    expect(
      rendered.harness.fixture.debugElement.query(
        By.directive(DataAtScaleShowcaseComponent),
      ),
    ).toBeNull();
    // The two-second run ended with the page, rather than scrolling a detached
    // element for the rest of its duration. The elapsed time is the assertion
    // that matters: a destroyed-component guard alone would still leave the
    // frame loop running to completion.
    expect(Date.now() - startedAt).toBeLessThan(1000);
    expect(rendered.component.scrollSample()).toBeNull();
  });

  it('keeps selected row instances across a refetch', async () => {
    const rendered = await renderShowcase();
    // Selection is offered in paged mode only — the virtual body table is
    // `role="presentation"`, where `aria-selected` on a row is invalid ARIA.
    rendered.component.setMode('paged');
    await settle(rendered);
    const [first, second] = rendered.component.source.connect()();
    rendered.table.selectedRows.set(new Set([first, second]));
    await settle(rendered);

    expect(rendered.component.selectedCount()).toBe(2);

    // Each sort re-runs the whole query in the backend and delivers fresh
    // structured clones. Sorting away and back lands on the same page, so any
    // row that is not the *same object* would show up as a lost selection.
    const base = rendered.component.tableState();
    rendered.table.applyPresentationState({
      ...base,
      sort: { key: 'ref', direction: 'desc' },
    });
    await settle(rendered);
    expect(rendered.component.source.connect()()).not.toContain(first);

    rendered.table.applyPresentationState({
      ...base,
      sort: { key: 'ref', direction: 'asc' },
    });
    await settle(rendered);

    const refetched = rendered.component.source.connect()() as unknown[];
    expect(rendered.component.selectedCount()).toBe(2);
    expect(refetched).toContain(first);
    expect(refetched).toContain(second);
    expect(
      rendered.root.querySelectorAll('.mlv-data-table__row--selected'),
    ).toHaveLength(2);
  });

  it('restores a saved view and reports the working state as clean again', async () => {
    const rendered = await renderShowcase();

    rendered.component.selectVariant('enterprise-by-arr');
    await settle(rendered);

    expect(rendered.component.activeVariant()?.id).toBe('enterprise-by-arr');
    expect(rendered.component.filters()).toEqual([
      { key: 'plan', operator: 'equals', value: 'Enterprise' },
    ]);
    expect(rendered.component.dirty()).toBe(false);
    expect(rendered.router.url).toBe(
      '/showcases/data-at-scale?view=enterprise-by-arr',
    );

    rendered.component.onSearchChange('northwind');
    await settle(rendered);
    expect(rendered.component.dirty()).toBe(true);

    rendered.component.resetWorkingState();
    await settle(rendered);
    expect(rendered.component.dirty()).toBe(false);
    expect(rendered.component.search()).toBe('');
  });

  it('regenerates the dataset when tree rows are turned on', async () => {
    const rendered = await renderShowcase();

    rendered.component.setTreeRows(true);
    await settle(rendered, 200);

    expect(rendered.component.dataset()?.config.tree).toBe(true);
    expect(rendered.component.dataset()?.totalRows ?? 0).toBeGreaterThan(
      SPEC_ROWS,
    );
    expect(
      rendered.component.source
        .connect()()
        .some((row) => (row._mlvChildren?.length ?? 0) > 0),
    ).toBe(true);
    // The dataset change restarts the initial-render measurement.
    expect(rendered.component.initialRender()).not.toBeNull();
  });

  it('keeps the default and paged compositions axe-clean', async () => {
    const rendered = await renderShowcase();
    await expectNoAxeViolations(rendered.root);

    rendered.component.setMode('paged');
    await settle(rendered);
    await expectNoAxeViolations(rendered.root);
  });
});

describe('data-at-scale scroll-limit arithmetic', () => {
  /** A document whose root reports `fontSize` as its computed font size. */
  function documentWithRootFont(fontSize: string): Document {
    return {
      documentElement: {},
      defaultView: { getComputedStyle: () => ({ fontSize }) },
    } as unknown as Document;
  }

  it('resolves the comfortable 3.75rem row against the root font size', () => {
    expect(SCALE_ROW_HEIGHT_REM).toBe(3.75);
    expect(scaleRowHeightPx(16)).toBe(60);
    expect(scaleRowHeightPx(18)).toBe(67.5);
    expect(scaleRowHeightPx(20)).toBe(75);
  });

  it('stays below every engine’s measured scroll-height cap', () => {
    // Firefox honours up to 17,895,688px and drops the height past it; Chrome
    // and WebKit clamp at 33,554,428px. The page's limit is under both.
    expect(SCALE_MAX_SCROLLABLE_PX).toBeLessThan(17_895_688);
  });

  it('fits fewer rows in one scroller as the root font grows', () => {
    expect(scaleMaxVirtualRows(scaleRowHeightPx(16))).toBe(279_620);
    expect(scaleMaxVirtualRows(scaleRowHeightPx(18))).toBe(248_551);
    expect(scaleMaxVirtualRows(scaleRowHeightPx(20))).toBe(223_696);
    // The 250,000 preset: one scroller at 16px, paged from 18px up.
    expect(250_000 * scaleRowHeightPx(16)).toBeLessThanOrEqual(
      SCALE_MAX_SCROLLABLE_PX,
    );
    expect(250_000).toBeGreaterThan(scaleMaxVirtualRows(scaleRowHeightPx(18)));
  });

  it('reads the root font size, and falls back to 16px where it cannot', () => {
    expect(readScaleRootFontPx(documentWithRootFont('20px'))).toBe(20);
    expect(readScaleRootFontPx(documentWithRootFont('17.5px'))).toBe(17.5);
    expect(readScaleRootFontPx(documentWithRootFont(''))).toBe(
      SCALE_DEFAULT_ROOT_FONT_PX,
    );
    expect(readScaleRootFontPx(documentWithRootFont('0px'))).toBe(
      SCALE_DEFAULT_ROOT_FONT_PX,
    );
    // A server render passes no document.
    expect(readScaleRootFontPx(null)).toBe(SCALE_DEFAULT_ROOT_FONT_PX);
    expect(SCALE_DEFAULT_ROOT_FONT_PX).toBe(16);
  });
});
