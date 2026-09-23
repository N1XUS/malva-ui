import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { ApplicationRef, Component, signal, viewChild } from '@angular/core';
import { OverlayContainer } from '@angular/cdk/overlay';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { Subject } from 'rxjs';
import type {
  MlvOptionMatcher,
  MlvOptionsInput,
  MlvSelectOption,
} from '@malva-ui/core/dropdown';
import {
  defaultOptionMatcher,
  MlvSelectDataSource,
} from '@malva-ui/core/dropdown';
import { MlvDataSource } from '@malva-ui/cdk/data-source';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvInput } from '@malva-ui/core/input';
import { MlvFormField, MlvLabel } from '@malva-ui/core/form-utils';
import { MlvAutocomplete } from './autocomplete';
import type { MlvAutocompleteSearchFn } from './autocomplete';

@Component({
  template: `<input
    mlvAutocomplete
    [mlvAutocomplete]="options()"
    [mlvAutocompleteSearch]="search()"
    [mlvAutocompleteMinLength]="minLength()"
    [mlvAutocompleteDebounce]="debounce()"
    [mlvAutocompleteMatcher]="matcher()"
    [mlvAutocompleteDisabled]="disabled()"
    [mlvAutocompleteOpenOnFocus]="openOnFocus()"
    [mlvAutocompleteHighlight]="highlight()"
    [mlvAutocompleteInline]="inline()"
    (optionSelected)="picked = $event"
    (openedChange)="openEvents.push($event)"
  />`,
  imports: [MlvAutocomplete],
})
class HostComponent {
  readonly directive = viewChild.required(MlvAutocomplete<string>);
  readonly options = signal<MlvOptionsInput<string>>([
    'Apple',
    'Apricot',
    'Banana',
    'Cherry',
  ]);
  readonly search = signal<MlvAutocompleteSearchFn<string> | null>(null);
  readonly minLength = signal(0);
  readonly debounce = signal(0);
  readonly matcher = signal<MlvOptionMatcher<string>>(defaultOptionMatcher);
  readonly disabled = signal(false);
  readonly openOnFocus = signal(true);
  readonly highlight = signal(true);
  readonly inline = signal(true);
  picked: MlvSelectOption<string> | null = null;
  openEvents: boolean[] = [];
}

describe('MlvAutocomplete', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let input: HTMLInputElement;
  let overlayContainer: OverlayContainer;
  let overlayEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    overlayContainer = TestBed.inject(OverlayContainer);
    overlayEl = overlayContainer.getContainerElement();
  });

  afterEach(() => {
    overlayContainer.ngOnDestroy();
  });

  /**
   * Flush the debounce macrotask, run the directive's effects (which push state
   * into the panel via `setInput`), then render the overlay panel. The panel is
   * a `ComponentPortal` — a separate CD root — so `ApplicationRef.tick()` (not
   * `fixture.detectChanges()`) is what renders it.
   */
  async function settle(ms = 5): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
    fixture.detectChanges();
    TestBed.inject(ApplicationRef).tick();
    await fixture.whenStable();
  }

  function type(value: string): void {
    input.value = value;
    // Mirror a real "type at the end": caret is a plain cursor after the text.
    input.setSelectionRange(value.length, value.length);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function key(k: string): void {
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: k, bubbles: true }),
    );
    fixture.detectChanges();
  }

  /**
   * Make every element measure as an overflowing scroll container parked at the
   * top (`scrollHeight` 1000, `clientHeight` 200). jsdom has no layout, so the
   * panel's paging sentinel would otherwise measure a 0px distance to the end
   * and immediately request every remaining page. Returns the undo function.
   */
  function stubOverflowingViewport(): () => void {
    const patch = (
      property: 'scrollHeight' | 'clientHeight',
      value: number,
    ) => {
      const previous = Object.getOwnPropertyDescriptor(
        HTMLElement.prototype,
        property,
      );
      Object.defineProperty(HTMLElement.prototype, property, {
        configurable: true,
        get: () => value,
      });
      return () => {
        if (previous) {
          Object.defineProperty(HTMLElement.prototype, property, previous);
        } else {
          delete (HTMLElement.prototype as Partial<HTMLElement>)[property];
        }
      };
    };
    const undo = [patch('scrollHeight', 1000), patch('clientHeight', 200)];
    return () => undo.forEach((restore) => restore());
  }

  function optionEls(): HTMLElement[] {
    return Array.from(
      overlayEl.querySelectorAll<HTMLElement>('[role="option"]'),
    );
  }

  it('creates and wires the WAI-ARIA combobox attributes on the input', () => {
    expect(host.directive()).toBeTruthy();
    expect(input.getAttribute('role')).toBe('combobox');
    // Inline completion is on by default → "both" (inline + list).
    expect(input.getAttribute('aria-autocomplete')).toBe('both');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.hasAttribute('aria-controls')).toBe(false);
  });

  it('advertises aria-autocomplete "list" when inline completion is opted out', async () => {
    host.inline.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
  });

  it('opens on focus and shows all static options (minLength 0)', async () => {
    input.dispatchEvent(new FocusEvent('focus'));
    await settle();

    expect(host.directive().isOpen()).toBe(true);
    expect(optionEls().length).toBe(4);
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(input.hasAttribute('aria-controls')).toBe(true);
    expect(host.openEvents).toContain(true);
  });

  it('filters options by the typed query (case-insensitive substring)', async () => {
    input.dispatchEvent(new FocusEvent('focus'));
    await settle();

    type('ap');
    await settle();

    const labels = optionEls().map((el) => el.textContent?.trim());
    expect(labels).toEqual(['Apple', 'Apricot']);
  });

  it('honours minLength before opening', async () => {
    host.minLength.set(2);
    fixture.detectChanges();

    input.dispatchEvent(new FocusEvent('focus'));
    await settle();
    expect(host.directive().isOpen()).toBe(false);

    type('a');
    await settle();
    expect(host.directive().isOpen()).toBe(false);

    type('ap');
    await settle();
    expect(host.directive().isOpen()).toBe(true);
    expect(optionEls().length).toBe(2);
  });

  it('uses a custom matcher', async () => {
    // prefix-only matcher
    host.matcher.set((option, query) =>
      option.label.toLowerCase().startsWith(query.toLowerCase()),
    );
    fixture.detectChanges();

    input.dispatchEvent(new FocusEvent('focus'));
    await settle();
    type('b');
    await settle();

    const labels = optionEls().map((el) => el.textContent?.trim());
    expect(labels).toEqual(['Banana']);
  });

  it('highlights the matched substring in suggestions', async () => {
    input.dispatchEvent(new FocusEvent('focus'));
    await settle();
    type('ap');
    await settle();

    const mark = overlayEl.querySelector<HTMLElement>(
      'mark.mlv-dropdown-panel__match',
    );
    expect(mark).toBeTruthy();
    expect(mark?.textContent?.toLowerCase()).toBe('ap');
  });

  it('navigates options via the keyboard and wires aria-activedescendant', async () => {
    input.dispatchEvent(new FocusEvent('focus'));
    await settle();

    key('ArrowDown');
    await settle();
    const active = overlayEl.querySelector<HTMLElement>(
      '.mlv-dropdown-panel__item--active',
    );
    expect(active).toBeTruthy();
    expect(input.getAttribute('aria-activedescendant')).toBe(active?.id);

    // Wrap: ArrowUp from the first option lands on the last.
    key('ArrowUp');
    await settle();
    const wrapped = overlayEl.querySelector<HTMLElement>(
      '.mlv-dropdown-panel__item--active',
    );
    expect(wrapped?.textContent?.trim()).toBe('Cherry');
  });

  it('selects the active option with Enter (writes label, emits, closes)', async () => {
    input.dispatchEvent(new FocusEvent('focus'));
    await settle();
    key('ArrowDown');
    await settle();
    key('Enter');
    await settle();

    expect(host.picked?.value).toBe('Apple');
    expect(input.value).toBe('Apple');
    expect(host.directive().isOpen()).toBe(false);
  });

  it('commits a pointer selection from the panel', async () => {
    input.dispatchEvent(new FocusEvent('focus'));
    await settle();

    host.directive().selectFromPanel(['Banana']);
    await settle();

    expect(host.picked?.value).toBe('Banana');
    expect(input.value).toBe('Banana');
    expect(host.directive().isOpen()).toBe(false);
  });

  it('closes on Escape, then clears the input on a second Escape', async () => {
    input.dispatchEvent(new FocusEvent('focus'));
    await settle();
    type('ap');
    await settle();
    expect(host.directive().isOpen()).toBe(true);

    key('Escape');
    await settle();
    expect(host.directive().isOpen()).toBe(false);
    expect(input.value).toBe('ap');

    key('Escape');
    await settle();
    expect(input.value).toBe('');
  });

  it('does nothing when disabled', async () => {
    host.disabled.set(true);
    fixture.detectChanges();

    input.dispatchEvent(new FocusEvent('focus'));
    await settle();
    type('ap');
    await settle();

    expect(host.directive().isOpen()).toBe(false);
    expect(optionEls().length).toBe(0);
  });

  it('does not open on focus when openOnFocus is false', async () => {
    host.openOnFocus.set(false);
    fixture.detectChanges();

    input.dispatchEvent(new FocusEvent('focus'));
    await settle();
    expect(host.directive().isOpen()).toBe(false);

    // Typing still opens.
    type('a');
    await settle();
    expect(host.directive().isOpen()).toBe(true);
  });

  it('repaints an open panel when a local observable source emits later', async () => {
    const subject = new Subject<string[]>();
    host.options.set(subject.asObservable());
    fixture.detectChanges();

    input.dispatchEvent(new FocusEvent('focus'));
    await settle();

    // Opened before the source has emitted anything.
    expect(host.directive().isOpen()).toBe(true);
    expect(optionEls().length).toBe(0);

    // The emission alone must repaint — no further keystroke.
    subject.next(['Alpha', 'Beta']);
    await settle();
    expect(optionEls().map((el) => el.textContent?.trim())).toEqual([
      'Alpha',
      'Beta',
    ]);

    // A second emission while the panel is open replaces the list.
    subject.next(['Gamma', 'Delta']);
    await settle();
    expect(optionEls().map((el) => el.textContent?.trim())).toEqual([
      'Gamma',
      'Delta',
    ]);
  });

  it('shows a loading affordance then renders async results', async () => {
    const subject = new Subject<string[]>();
    host.search.set(() => subject.asObservable());
    host.minLength.set(1);
    fixture.detectChanges();

    input.dispatchEvent(new FocusEvent('focus'));
    await settle();
    type('do');
    await settle();

    expect(
      overlayEl.querySelector('.mlv-dropdown-panel__loading'),
    ).toBeTruthy();
    expect(optionEls().length).toBe(0);

    subject.next(['Dog', 'Dolphin']);
    subject.complete();
    await settle();

    expect(overlayEl.querySelector('.mlv-dropdown-panel__loading')).toBeNull();
    expect(optionEls().map((el) => el.textContent?.trim())).toEqual([
      'Dog',
      'Dolphin',
    ]);
  });

  it('ignores a stale async result superseded by a newer query', async () => {
    const first = new Subject<string[]>();
    const second = new Subject<string[]>();
    let call = 0;
    host.search.set(() => (call++ === 0 ? first : second).asObservable());
    host.minLength.set(1);
    fixture.detectChanges();

    input.dispatchEvent(new FocusEvent('focus'));
    await settle();
    type('a');
    await settle();
    type('ab');
    await settle();

    // The stale first result must be discarded.
    first.next(['STALE']);
    first.complete();
    await settle();
    expect(optionEls().length).toBe(0);

    second.next(['Fresh']);
    second.complete();
    await settle();
    expect(optionEls().map((el) => el.textContent?.trim())).toEqual(['Fresh']);
  });

  it('re-renders a memoised search result after the min-length gate closed the panel', async () => {
    // Memoising fn: a repeated query yields the *identical* array reference, so
    // the adapter's `items()` never changes and the mirroring effect never fires
    // — `_runQuery` has to seed the panel from the adapter for the re-entry.
    const cache = new Map<string, string[]>();
    host.search.set((query) => {
      const hit = cache.get(query) ?? [`${query}-result`];
      cache.set(query, hit);
      return hit;
    });
    host.minLength.set(2);
    // Inline completion would rewrite the field from the results; this test is
    // about the rendered list.
    host.inline.set(false);
    fixture.detectChanges();

    input.dispatchEvent(new FocusEvent('focus'));
    await settle();
    type('ab');
    await settle();
    expect(optionEls().map((el) => el.textContent?.trim())).toEqual([
      'ab-result',
    ]);

    // Backspacing below minLength clears the results and closes the panel.
    type('a');
    await settle();
    expect(host.directive().isOpen()).toBe(false);

    // Typing the same query again must repaint, identical array reference or not.
    type('ab');
    await settle();
    expect(host.directive().isOpen()).toBe(true);
    expect(optionEls().map((el) => el.textContent?.trim())).toEqual([
      'ab-result',
    ]);
  });

  it('debounces keystrokes before filtering (fake timers)', async () => {
    host.debounce.set(200);
    fixture.detectChanges();

    input.dispatchEvent(new FocusEvent('focus'));
    await settle();

    vi.useFakeTimers();
    try {
      type('a');
      type('ap');
      type('apr');
      // Not yet elapsed — still showing the pre-debounce (all) results.
      vi.advanceTimersByTime(150);
      fixture.detectChanges();
      expect(optionEls().length).toBe(4);

      // Elapsed — the final query "apr" filters to "Apricot".
      await vi.advanceTimersByTimeAsync(100);
      fixture.detectChanges();
    } finally {
      vi.useRealTimers();
    }
    await settle();

    expect(optionEls().map((el) => el.textContent?.trim())).toEqual([
      'Apricot',
    ]);
  });

  // ─── Inline completion (Feature 1) ─────────────────────────────────────────

  it('inline-completes the top prefix match with the remainder selected on insertion', async () => {
    input.dispatchEvent(new FocusEvent('focus'));
    await settle();

    type('Ap');
    await settle();

    // Typed "Ap" + suggestion remainder "ple", with "ple" left selected.
    expect(input.value).toBe('Apple');
    expect(input.selectionStart).toBe(2);
    expect(input.selectionEnd).toBe(5);

    // The completed top item (index 0) is the activedescendant-active row.
    const active = overlayEl.querySelector<HTMLElement>(
      '.mlv-dropdown-panel__item--active',
    );
    expect(active?.textContent?.trim()).toBe('Apple');
    expect(input.getAttribute('aria-activedescendant')).toBe(active?.id);
  });

  it('keeps the typed casing and uses the suggestion casing for the remainder', async () => {
    input.dispatchEvent(new FocusEvent('focus'));
    await settle();

    type('ap');
    await settle();

    // Lowercase prefix preserved; remainder "ple" taken from "Apple".
    expect(input.value).toBe('apple');
    expect(input.selectionStart).toBe(2);
    expect(input.selectionEnd).toBe(5);
  });

  it('does not re-complete on deletion (shorter value)', async () => {
    input.dispatchEvent(new FocusEvent('focus'));
    await settle();

    type('appl');
    await settle();
    expect(input.value).toBe('apple'); // completed

    // Simulate a delete: the value shrinks below the previously typed length.
    type('app');
    await settle();
    expect(input.value).toBe('app'); // NOT re-completed to "apple"
    // Still filters the list (list behaviour is unaffected).
    expect(optionEls().length).toBe(1);
  });

  it('does not inline-complete when the top match is not a prefix', async () => {
    input.dispatchEvent(new FocusEvent('focus'));
    await settle();

    // "Apple" contains "pp" but does not start with it → substring-only match.
    type('pp');
    await settle();

    expect(input.value).toBe('pp');
    expect(input.selectionStart).toBe(2);
    expect(input.selectionEnd).toBe(2); // plain caret, no selected remainder
  });

  it('reverts the inline completion to the typed text on Escape', async () => {
    input.dispatchEvent(new FocusEvent('focus'));
    await settle();

    type('Ap');
    await settle();
    expect(input.value).toBe('Apple');

    key('Escape');
    await settle();

    // Reverted to the typed prefix, caret at the end, popup closed.
    expect(input.value).toBe('Ap');
    expect(input.selectionStart).toBe(2);
    expect(input.selectionEnd).toBe(2);
    expect(host.directive().isOpen()).toBe(false);
  });

  it('does not inline-complete when inline is disabled (list-only)', async () => {
    host.inline.set(false);
    fixture.detectChanges();

    input.dispatchEvent(new FocusEvent('focus'));
    await settle();
    type('ap');
    await settle();

    // No completion — the field holds only the typed text.
    expect(input.value).toBe('ap');
    // But the list still opens and filters.
    expect(host.directive().isOpen()).toBe(true);
    expect(optionEls().map((el) => el.textContent?.trim())).toEqual([
      'Apple',
      'Apricot',
    ]);
  });

  it('inline-completes only once the async results for the current query arrive', async () => {
    const subject = new Subject<string[]>();
    host.search.set(() => subject.asObservable());
    host.minLength.set(1);
    fixture.detectChanges();

    input.dispatchEvent(new FocusEvent('focus'));
    await settle();
    type('Ar');
    await settle();

    // While the search is in flight there is no completion yet.
    expect(input.value).toBe('Ar');

    subject.next(['Argentina', 'Armenia']);
    subject.complete();
    await settle();

    expect(input.value).toBe('Argentina');
    expect(input.selectionStart).toBe(2);
    expect(input.selectionEnd).toBe(9);
  });

  it('applies the floating surface modifier to the overlay panel', async () => {
    input.dispatchEvent(new FocusEvent('focus'));
    await settle();

    const panel = overlayEl.querySelector<HTMLElement>('.mlv-dropdown-panel');
    expect(panel).toBeTruthy();
    expect(panel?.classList.contains('mlv-dropdown-panel--surface')).toBe(true);
  });

  it('stamps the global density cascade class on the overlay panel', async () => {
    input.dispatchEvent(new FocusEvent('focus'));
    await settle();

    const panel = overlayEl.querySelector<HTMLElement>('.mlv-dropdown-panel');
    expect(panel?.classList.contains('mlv--comfortable')).toBe(true);
  });

  // ─── Data-source backed options ────────────────────────────────────────────

  describe('data-source backed options', () => {
    it('uses the data source for search (keys []) and renders its items', async () => {
      const ds = new MlvSelectDataSource(['Apple', 'Apricot', 'Banana']);
      host.options.set(ds);
      fixture.detectChanges();
      input.dispatchEvent(new FocusEvent('focus'));
      await settle();
      expect(optionEls().length).toBe(3);
      type('ap');
      await settle();
      expect(ds.search()).toEqual({ query: 'ap', keys: [] });
      expect(optionEls().map((e) => e.textContent?.trim())).toEqual([
        'Apple',
        'Apricot',
      ]);
    });

    it('keeps stale results visible (dimmed) while a newer search is in flight', async () => {
      const first = new Subject<string[]>();
      const second = new Subject<string[]>();
      let call = 0;
      host.search.set(() => (call++ === 0 ? first : second).asObservable());
      host.minLength.set(1);
      fixture.detectChanges();
      input.dispatchEvent(new FocusEvent('focus'));
      await settle();
      type('a');
      await settle();
      first.next(['Alpha']);
      first.complete();
      await settle();
      expect(optionEls().length).toBe(1);
      type('ab');
      await settle();
      // In flight: previous result still rendered under the spinner + dim modifier.
      expect(optionEls().length).toBe(1);
      expect(
        overlayEl.querySelector('.mlv-dropdown-panel--loading'),
      ).toBeTruthy();
      second.next(['Abba']);
      second.complete();
      await settle();
      expect(optionEls().map((e) => e.textContent?.trim())).toEqual(['Abba']);
      expect(
        overlayEl.querySelector('.mlv-dropdown-panel--loading'),
      ).toBeNull();
    });

    it('forwards paging state to the panel and requests the next page on loadMore', async () => {
      class PagedStub extends MlvDataSource<string> {
        readonly totalItems = signal(4);
        private readonly _slice = signal(['p1', 'p2']);
        constructor() {
          super();
          this._perPage.set(2);
        }
        connect() {
          return this._slice.asReadonly();
        }
        override setPage(page: number): void {
          super.setPage(page);
          this._slice.set(page === 1 ? ['p1', 'p2'] : ['p3', 'p4']);
        }
      }
      const ds = new PagedStub();
      host.options.set(ds);
      fixture.detectChanges();
      // jsdom reports 0 for every layout box, which the panel's sentinel reads
      // as "already at the end" and auto-fills every page on the first render.
      // Emulate an overflowing viewport scrolled to the top so paging happens
      // only when it is explicitly requested.
      const restoreLayout = stubOverflowingViewport();
      try {
        input.dispatchEvent(new FocusEvent('focus'));
        await settle();
        const panel = overlayEl.querySelector(
          'mlv-dropdown-panel',
        ) as HTMLElement;
        expect(
          panel.querySelector('.mlv-dropdown-panel__sentinel'),
        ).toBeTruthy();
        expect(optionEls().length).toBe(2);

        // The adapter's paging state is forwarded into the panel's inputs.
        const instance = host.directive()['_panelRef']()?.instance;
        expect(instance).toBeTruthy();
        expect(instance?.hasMore()).toBe(true);
        expect(instance?.loadingMore()).toBe(false);
        expect(instance?.infiniteScrollThreshold()).toBe(150);

        // Drive the next page the way the sentinel does — through the panel's
        // own `loadMore` output, so the directive's subscription is exercised.
        instance?.loadMore.emit();
        await settle();
        expect(optionEls().map((e) => e.textContent?.trim())).toEqual([
          'p1',
          'p2',
          'p3',
          'p4',
        ]);
        expect(ds.page()).toBe(2);
        // Last page applied — the sentinel is disarmed again.
        expect(instance?.hasMore()).toBe(false);
      } finally {
        restoreLayout();
      }
    });
  });
});

/**
 * #150 — the suggestion overlay takes the input's measured width as a **floor**,
 * never as an exact width, so a suggestion longer than the field grows the
 * panel instead of being clipped.
 *
 * jsdom runs no layout, so "the panel grew" is asserted where the constraint is
 * actually expressed — the CDK overlay pane's own inline sizing. An exact
 * `width` pins the pane to the input's box (the bug); a `min-width` with no
 * `width` leaves the pane a `fit-content` flex item inside the flexible
 * bounding box (the fix), free to grow to its content and clamped by that box
 * (which CDK sizes to the space up to the viewport edge) via CDK's own
 * `.cdk-overlay-pane { max-width: 100% }`.
 */
describe('MlvAutocomplete — suggestion panel width (#150)', () => {
  const VIEWPORT_WIDTH = 1024;
  const VIEWPORT_HEIGHT = 768;
  /** Input box: 200px wide, 40px from the viewport's inline-start edge. */
  const INPUT_RECT = {
    x: 40,
    y: 100,
    left: 40,
    top: 100,
    right: 240,
    bottom: 132,
    width: 200,
    height: 32,
  };
  /** A suggestion far wider than the 200px input. */
  const LONG_OPTION = 'comfortable — the density every control starts at';

  @Component({
    template: `<input
      mlvAutocomplete
      [mlvAutocomplete]="options"
      [mlvAutocompleteMinWidth]="minWidth()"
      [mlvAutocompleteMaxWidth]="maxWidth()"
    />`,
    imports: [MlvAutocomplete],
  })
  class WidthHostComponent {
    readonly directive = viewChild.required(MlvAutocomplete<string>);
    readonly options = ['compact', LONG_OPTION, 'spacious'];
    readonly minWidth = signal<number | string | undefined>(undefined);
    readonly maxWidth = signal<number | string | undefined>(undefined);
  }

  let fixture: ComponentFixture<WidthHostComponent>;
  let input: HTMLInputElement;
  let overlayContainer: OverlayContainer;
  let rtlService: MlvRtlService;

  /** Replaces an element's zero-sized jsdom box with a real one. */
  function stubRect(element: Element, rect: Record<string, number>): void {
    const full = { toJSON: () => rect, ...rect };
    element.getBoundingClientRect = () => full as unknown as DOMRect;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WidthHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(WidthHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    overlayContainer = TestBed.inject(OverlayContainer);
    rtlService = TestBed.inject(MlvRtlService);
    // jsdom reports `documentElement.clientWidth === 0`; CDK reads it as the viewport.
    Object.defineProperty(document.documentElement, 'clientWidth', {
      value: VIEWPORT_WIDTH,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, 'clientHeight', {
      value: VIEWPORT_HEIGHT,
      configurable: true,
    });
  });

  afterEach(() => {
    rtlService.setDirection('ltr');
    document.documentElement.removeAttribute('dir');
    Reflect.deleteProperty(document.documentElement, 'clientWidth');
    Reflect.deleteProperty(document.documentElement, 'clientHeight');
    overlayContainer.ngOnDestroy();
  });

  /** The input is both the width source and the overlay origin here. */
  async function open(): Promise<void> {
    // Flush host bindings first: `focus` opens the overlay synchronously, so an
    // input set by the test after the last CD would still read its old value.
    fixture.detectChanges();
    stubRect(input, INPUT_RECT);
    input.dispatchEvent(new FocusEvent('focus'));
    await new Promise((resolve) => setTimeout(resolve, 5));
    fixture.detectChanges();
    TestBed.inject(ApplicationRef).tick();
    await fixture.whenStable();
  }

  const pane = () =>
    overlayContainer
      .getContainerElement()
      .querySelector('.cdk-overlay-pane') as HTMLElement;
  const boundingBox = () =>
    overlayContainer
      .getContainerElement()
      .querySelector(
        '.cdk-overlay-connected-position-bounding-box',
      ) as HTMLElement | null;

  it('floors the panel at the input width instead of pinning it', async () => {
    await open();

    expect(overlayContainer.getContainerElement().textContent).toContain(
      LONG_OPTION,
    );
    expect(pane().style.minWidth).toBe('200px');
    expect(pane().style.width).toBe('');
  });

  it('raises the floor to an explicit mlvAutocompleteMinWidth', async () => {
    fixture.componentInstance.minWidth.set('30rem');
    await open();

    // Both bounds survive as a CSS `max()`, so the author's units resolve in
    // the browser rather than being converted to px in TypeScript.
    expect(pane().style.minWidth).toBe('max(200px, 30rem)');
    expect(pane().style.width).toBe('');
  });

  it('never lets mlvAutocompleteMinWidth shrink the panel below its input', async () => {
    // The input raises the floor; it does not replace it. A value under the
    // field width is the reading a consumer is most likely to get wrong, so
    // the measured width stays in the `max()` and wins.
    fixture.componentInstance.minWidth.set(80);
    await open();

    expect(pane().style.minWidth).toBe('max(200px, 80px)');
  });

  it('caps the panel at an explicit mlvAutocompleteMaxWidth', async () => {
    fixture.componentInstance.maxWidth.set('24rem');
    await open();

    // With flexible dimensions the cap lands on the bounding box, not the
    // pane: CDK clears `max-width` on the pane and applies the configured
    // value to the box the pane is laid out inside. That is the same
    // mechanism the viewport clamp uses, so the two compose.
    expect(boundingBox()?.style.maxWidth).toBe('24rem');
    // The floor is unaffected by the ceiling.
    expect(pane().style.minWidth).toBe('200px');
  });

  it('grows toward inline-end and stays anchored at the start edge (LTR)', async () => {
    await open();

    const box = boundingBox();
    expect(box?.getAttribute('dir')).toBe('ltr');
    expect(box?.style.left).toBe(`${INPUT_RECT.left}px`);
    // Bounded by the viewport's inline-end edge — the clamp for a pane that
    // carries no `width` of its own.
    expect(box?.style.width).toBe(`${VIEWPORT_WIDTH - INPUT_RECT.left}px`);
    expect(box?.style.alignItems).toBe('flex-start');
    expect(pane().style.width).toBe('');
    expect(pane().style.maxWidth).toBe('');
  });

  it('grows toward inline-end (leftward) under a global RTL flip', async () => {
    rtlService.setDirection('rtl');
    await open();

    const box = boundingBox();
    expect(box?.getAttribute('dir')).toBe('rtl');
    // Anchored at the input's start edge — its RIGHT edge in RTL.
    expect(box?.style.right).toBe(`${VIEWPORT_WIDTH - INPUT_RECT.right}px`);
    expect(box?.style.width).toBe(`${INPUT_RECT.right}px`);
    expect(pane().style.minWidth).toBe('200px');
    expect(pane().style.width).toBe('');
  });

  it('follows a [dir="rtl"] scope while the document stays LTR', async () => {
    input.setAttribute('dir', 'rtl');
    await open();

    expect(rtlService.direction()).toBe('ltr');
    expect(document.documentElement.getAttribute('dir')).not.toBe('rtl');
    expect(boundingBox()?.getAttribute('dir')).toBe('rtl');
    expect(boundingBox()?.style.right).toBe(
      `${VIEWPORT_WIDTH - INPUT_RECT.right}px`,
    );
    expect(pane().style.minWidth).toBe('200px');
    expect(pane().style.width).toBe('');
  });
});

/**
 * #154 — the panel #150 freed to grow still had nowhere to grow into: both
 * suggestion positions were `start`-aligned, so a field near the viewport's
 * inline-end edge got a bounding box only as wide as the sliver of room after
 * it. `end`-aligned fallbacks let the panel anchor its inline-end edge to the
 * field and grow back toward inline-start instead. The directive builds its own
 * CDK overlay rather than going through `mlv-popup`, so it is pinned separately
 * from `mlv-select` / `mlv-combobox` even though the position list is shared.
 */
describe('MlvAutocomplete — suggestion panel inline-axis fallback (#154)', () => {
  const VIEWPORT_WIDTH = 1024;
  const VIEWPORT_HEIGHT = 768;
  /** The panel's own box: wider than the room left beside an edge field. */
  const PANEL_WIDTH = 300;
  const PANEL_HEIGHT = 200;

  const rect = (left: number, width: number) => ({
    x: left,
    y: 100,
    left,
    top: 100,
    right: left + width,
    bottom: 132,
    width,
    height: 32,
  });

  /** 60px field with only 20px of room after its physical right edge. */
  const RIGHT_EDGE_RECT = rect(944, 60);
  /** The mirror image: 60px field 20px from the physical left edge. */
  const LEFT_EDGE_RECT = rect(20, 60);
  /** Room on both sides — the case the preferred `start` pair must keep. */
  const ROOMY_RECT = rect(40, 200);

  @Component({
    template: `<input mlvAutocomplete [mlvAutocomplete]="options" />`,
    imports: [MlvAutocomplete],
  })
  class HostComponent {
    readonly options = ['a', 'b'];
  }

  let fixture: ComponentFixture<HostComponent>;
  let input: HTMLInputElement;
  let overlayContainer: OverlayContainer;
  let rtlService: MlvRtlService;

  const nativeGetBoundingClientRect = Element.prototype.getBoundingClientRect;

  /** Replaces an element's zero-sized jsdom box with a real one. */
  function stubRect(element: Element, box: Record<string, number>): void {
    const full = { toJSON: () => box, ...box };
    element.getBoundingClientRect = () => full as unknown as DOMRect;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    overlayContainer = TestBed.inject(OverlayContainer);
    rtlService = TestBed.inject(MlvRtlService);
    Object.defineProperty(document.documentElement, 'clientWidth', {
      value: VIEWPORT_WIDTH,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, 'clientHeight', {
      value: VIEWPORT_HEIGHT,
      configurable: true,
    });

    // The pane does not exist until CDK attaches it and CDK measures it inside
    // that same attach, so it is stubbed on the prototype rather than on the
    // instance. With a 0x0 pane `isCompletelyWithinViewport` compares
    // `0 === 0` and every candidate fits outright, so a spec that does not stub
    // the pane pins `positions[0]` and can never reach a fallback.
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (this.classList?.contains('cdk-overlay-pane')) {
        const box = {
          x: 0,
          y: 0,
          left: 0,
          top: 0,
          right: PANEL_WIDTH,
          bottom: PANEL_HEIGHT,
          width: PANEL_WIDTH,
          height: PANEL_HEIGHT,
        };
        return { toJSON: () => box, ...box } as unknown as DOMRect;
      }
      return nativeGetBoundingClientRect.call(this);
    };
  });

  afterEach(() => {
    Element.prototype.getBoundingClientRect = nativeGetBoundingClientRect;
    rtlService.setDirection('ltr');
    document.documentElement.removeAttribute('dir');
    Reflect.deleteProperty(document.documentElement, 'clientWidth');
    Reflect.deleteProperty(document.documentElement, 'clientHeight');
    overlayContainer.ngOnDestroy();
  });

  /** The input is both the width source and the overlay origin here. */
  async function openAt(box: Record<string, number>): Promise<void> {
    fixture.detectChanges();
    stubRect(input, box);
    input.dispatchEvent(new FocusEvent('focus'));
    await new Promise((resolve) => setTimeout(resolve, 5));
    fixture.detectChanges();
    TestBed.inject(ApplicationRef).tick();
    await fixture.whenStable();
  }

  /**
   * The anchored inset, the width and `align-items` together identify the
   * applied pair. The opposite inset is not asserted: CDK writes `auto` there
   * and jsdom's `cssstyle` rejects `auto` on `left`/`right`, silently keeping
   * the `0px` left by CDK's own reset.
   */
  const boundingBox = () =>
    overlayContainer
      .getContainerElement()
      .querySelector(
        '.cdk-overlay-connected-position-bounding-box',
      ) as HTMLElement | null;

  it('anchors the panel to the field inline-end edge when inline-end room runs out (LTR)', async () => {
    await openAt(RIGHT_EDGE_RECT);

    const box = boundingBox();
    expect(box?.getAttribute('dir')).toBe('ltr');
    expect(box?.style.right).toBe(
      `${VIEWPORT_WIDTH - RIGHT_EDGE_RECT.right}px`,
    );
    expect(box?.style.width).toBe(`${RIGHT_EDGE_RECT.right}px`);
    expect(box?.style.alignItems).toBe('flex-end');
  });

  it('keeps the preferred start-aligned position when there is inline-end room', async () => {
    await openAt(ROOMY_RECT);

    const box = boundingBox();
    expect(box?.getAttribute('dir')).toBe('ltr');
    expect(box?.style.left).toBe(`${ROOMY_RECT.left}px`);
    expect(box?.style.width).toBe(`${VIEWPORT_WIDTH - ROOMY_RECT.left}px`);
    expect(box?.style.alignItems).toBe('flex-start');
  });

  it('mirrors the fallback under a global RTL flip', async () => {
    // The directive does not go through `MlvPopupService`: it resolves the
    // pane's direction itself with `MlvRtlService.resolveDirection(el)` on its
    // own `flexibleConnectedTo`. The scoped case below covers the `[dir]` walk;
    // this one covers the document-level source that walk falls back to, which
    // no other spec exercises on this plumbing.
    rtlService.setDirection('rtl');
    // Inline-end is the physical LEFT edge in RTL, so it is a field hugging the
    // left of the viewport that has nowhere to grow.
    await openAt(LEFT_EDGE_RECT);

    const box = boundingBox();
    expect(box?.getAttribute('dir')).toBe('rtl');
    expect(box?.style.left).toBe(`${LEFT_EDGE_RECT.left}px`);
    expect(box?.style.width).toBe(`${VIEWPORT_WIDTH - LEFT_EDGE_RECT.left}px`);
    expect(box?.style.alignItems).toBe('flex-end');
  });

  it('mirrors the fallback under a [dir="rtl"] scope while the document stays LTR', async () => {
    input.setAttribute('dir', 'rtl');
    // Inline-end is the physical LEFT edge in RTL, so it is a field hugging the
    // left of the viewport that has nowhere to grow.
    await openAt(LEFT_EDGE_RECT);

    expect(rtlService.direction()).toBe('ltr');
    const box = boundingBox();
    expect(box?.getAttribute('dir')).toBe('rtl');
    expect(box?.style.left).toBe(`${LEFT_EDGE_RECT.left}px`);
    expect(box?.style.width).toBe(`${VIEWPORT_WIDTH - LEFT_EDGE_RECT.left}px`);
    expect(box?.style.alignItems).toBe('flex-end');
  });
});

// ---------------------------------------------------------------------------
// Accessible name of the suggestion listbox (#222)
// ---------------------------------------------------------------------------

/**
 * The panel's inner `role="listbox"` is an ARIA input field, so it needs an
 * accessible name (axe `aria-input-field-name`, WCAG 4.1.2). `mlv-select` and
 * `mlv-combobox` name it from their own `label` / `ariaLabel` inputs; the
 * directive attaches to a host input the consumer owns, so it mirrors that
 * input's own accessible name instead — the same "the listbox shares the name
 * of the field it belongs to" contract, resolved from the DOM.
 */
describe('MlvAutocomplete — suggestion listbox accessible name', () => {
  @Component({
    template: `
      @if (labelText(); as text) {
        <label [attr.for]="labelFor()">{{ text }}</label>
      }
      <span id="ac-external-label">{{ externalLabelText() }}</span>
      <input
        id="ac-input"
        mlvAutocomplete
        [mlvAutocomplete]="options"
        [mlvAutocompleteSearch]="search()"
        [mlvAutocompleteDebounce]="0"
        [attr.aria-label]="ariaLabel()"
        [attr.aria-labelledby]="ariaLabelledby()"
      />
    `,
    imports: [MlvAutocomplete],
  })
  class NamedHostComponent {
    readonly directive = viewChild.required(MlvAutocomplete<string>);
    readonly options = ['Apple', 'Apricot', 'Banana'];
    readonly labelText = signal<string | null>(null);
    readonly labelFor = signal<string | null>(null);
    readonly externalLabelText = signal('');
    readonly ariaLabel = signal<string | null>(null);
    readonly ariaLabelledby = signal<string | null>(null);
    readonly search = signal<MlvAutocompleteSearchFn<string> | null>(null);
  }

  let fixture: ComponentFixture<NamedHostComponent>;
  let host: NamedHostComponent;
  let input: HTMLInputElement;
  let overlayContainer: OverlayContainer;
  let overlayEl: HTMLElement;
  let rtlService: MlvRtlService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NamedHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(NamedHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    overlayContainer = TestBed.inject(OverlayContainer);
    overlayEl = overlayContainer.getContainerElement();
    rtlService = TestBed.inject(MlvRtlService);
  });

  afterEach(() => {
    rtlService.setDirection('ltr');
    overlayContainer.ngOnDestroy();
  });

  /** Opens the popup and renders the portalled panel (its own CD root). */
  async function open(): Promise<HTMLElement> {
    fixture.detectChanges();
    await fixture.whenStable();
    input.dispatchEvent(new FocusEvent('focus'));
    await new Promise((resolve) => setTimeout(resolve, 5));
    fixture.detectChanges();
    TestBed.inject(ApplicationRef).tick();
    await fixture.whenStable();
    return overlayEl.querySelector('[role="listbox"]') as HTMLElement;
  }

  it("names the listbox from the host input's aria-label", async () => {
    host.ariaLabel.set('Fruit');

    const listbox = await open();

    expect(listbox).toBeTruthy();
    expect(listbox.getAttribute('aria-label')).toBe('Fruit');
  });

  it('names the listbox from a native <label for> on the host input', async () => {
    host.labelText.set('Fruit');
    host.labelFor.set('ac-input');

    const listbox = await open();

    expect(listbox.getAttribute('aria-label')).toBe('Fruit');
  });

  it("names the listbox from the host input's aria-labelledby", async () => {
    host.externalLabelText.set('Fruit');
    host.ariaLabelledby.set('ac-external-label');

    const listbox = await open();

    expect(listbox.getAttribute('aria-label')).toBe('Fruit');
  });

  it('emits no aria-label at all when the host input is itself unnamed', async () => {
    const listbox = await open();

    // Never `aria-label=""` — an empty name is not a name, and it would launder
    // the consumer's own unnamed `role="combobox"` input into something that
    // reads as labelled in review.
    expect(listbox.hasAttribute('aria-label')).toBe(false);
  });

  /**
   * Why the sweep below cannot be the regression guard for the tests above, and
   * must not be re-tightened into one.
   *
   * axe's `aria-input-field-name` selects `[role="listbox"]`, but its matcher
   * (`no-naming-method-matches`) bails out via `isComboboxPopup` for a listbox
   * that some `role="combobox"` element points at through `aria-controls` or
   * `aria-owns` — the APG combobox contract, under which the popup takes its
   * name from the combobox. That is exactly this wiring, so the rule reports
   * `inapplicable` whether or not the panel is named. (Measured against
   * axe-core 4.12: a detached `mlv-list[role="listbox"]` with the same markup
   * *is* a violation; this one is not.) The name is still set, because the
   * panel is shared with `mlv-select` / `mlv-combobox`, which both name it.
   */
  it('wires the input as the listbox’s combobox owner', async () => {
    host.ariaLabel.set('Fruit');
    const listbox = await open();

    expect(input.getAttribute('role')).toBe('combobox');
    expect(listbox.id).toBeTruthy();
    expect(input.getAttribute('aria-controls')).toBe(listbox.id);
  });

  /**
   * The `.set()` that snapshots the name sits *above* `_openPopup`'s
   * `if (!this._overlayRef)` guard on purpose. `_openPopup()` is re-entered
   * from `_runQuery()` on every debounced keystroke, while the overlay — and
   * with it the panel component — is created once per session and disposed on
   * close. Moving the `.set()` inside the guard reads like "resolve once per
   * open" and matches no observable behaviour: it would pin the name for the
   * whole session instead. This test is the tripwire for exactly that edit —
   * it asserts the panel node is unchanged (so this is a re-resolve on the
   * live panel, not a fresh open) *and* that the name followed the label.
   */
  it("re-resolves the field's name on each query, not once per overlay", async () => {
    host.externalLabelText.set('Fruit');
    host.ariaLabelledby.set('ac-external-label');

    const listbox = await open();
    expect(listbox.getAttribute('aria-label')).toBe('Fruit');

    // The consumer's label changes while the popup is up.
    host.externalLabelText.set('Vegetable');
    fixture.detectChanges();
    await fixture.whenStable();

    // One keystroke: `_runQuery` re-enters `_openPopup`, which re-resolves.
    input.value = 'A';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 5));
    fixture.detectChanges();
    TestBed.inject(ApplicationRef).tick();
    await fixture.whenStable();

    const after = overlayEl.querySelector('[role="listbox"]') as HTMLElement;
    // Same node — the popup never closed, so the overlay was not rebuilt.
    expect(after).toBe(listbox);
    expect(after.getAttribute('aria-label')).toBe('Vegetable');
  });

  /**
   * Every naming source is flattened, `aria-label` included: the
   * accessible-name computation normalizes whitespace over whichever source it
   * takes, so the input's own computed name here is `'Fruit basket'` and the
   * panel has to read the same. Trimming the attribute without collapsing it
   * would leave the two disagreeing.
   */
  it('collapses internal whitespace in the aria-label branch too', async () => {
    host.ariaLabel.set('Fruit  \n  basket');

    const listbox = await open();

    expect(listbox.getAttribute('aria-label')).toBe('Fruit basket');
  });

  it('is axe-clean with the suggestion panel open', async () => {
    host.ariaLabel.set('Fruit');
    await open();

    // Coverage for the whole rendered open state — the project's first sweep
    // (#47 / #202), not the assertion behind #222; see the note above. The
    // panel is portalled into the CDK overlay container, outside the fixture,
    // so the sweep has to start at the document body.
    await expectNoAxeViolations(document.body);
  });

  // `.claude/rules/accessibility.md` asks for one sweep per state that changes
  // the markup. Beyond the populated panel above, the panel's own template
  // branches on `loading()` (a `role="status"` row above the listbox, plus
  // `aria-busy` on it), on an empty option list (the `@empty` branch), and the
  // overlay pane is its own `[dir]` scope. Each gets its own sweep below.

  it('is axe-clean while an async search is in flight (loading row)', async () => {
    host.ariaLabel.set('Fruit');
    // A search that never resolves: the panel stays in its loading state.
    host.search.set(() => new Subject<string[]>().asObservable());
    fixture.detectChanges();
    await fixture.whenStable();

    await open();
    input.value = 'ap';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 5));
    fixture.detectChanges();
    TestBed.inject(ApplicationRef).tick();
    await fixture.whenStable();

    expect(
      overlayEl.querySelector('.mlv-dropdown-panel__loading'),
    ).toBeTruthy();
    await expectNoAxeViolations(document.body);
  });

  it('is axe-clean with an empty result list', async () => {
    host.ariaLabel.set('Fruit');
    await open();

    input.value = 'zzzzz';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 5));
    fixture.detectChanges();
    TestBed.inject(ApplicationRef).tick();
    await fixture.whenStable();

    expect(overlayEl.querySelectorAll('[role="option"]').length).toBe(0);
    await expectNoAxeViolations(document.body);
  });

  it('is axe-clean with the panel open in RTL', async () => {
    host.ariaLabel.set('Fruit');
    rtlService.setDirection('rtl');
    fixture.detectChanges();
    await fixture.whenStable();

    const listbox = await open();

    expect(listbox).toBeTruthy();
    await expectNoAxeViolations(document.body);
  });
});

// ---------------------------------------------------------------------------
// The shape every real consumer writes: `<mlv-input>`, not a native `<input>` (#222)
// ---------------------------------------------------------------------------

/**
 * All four `apps/docs` examples — and the pattern `best-practices.md` mandates
 * for any text field — put the directive on `<mlv-input>`, never on a bare
 * `<input>`. That resolves the name through a different branch of
 * `_resolveHostAccessibleName`: the directive walks to the *inner* native
 * input, whose `labels` collection holds `mlv-label`'s rendered `<label for>`.
 *
 * The tests above, which host a native `<input>`, cannot see that branch break.
 * Concretely: dropping `[for]` from `mlv-input`'s internal `<mlv-label>` empties
 * `el.labels`, and un-hiding `mlv-hint`'s `__source` span folds the hint text
 * into the name — both would leave every native-`<input>` test green.
 */
describe('MlvAutocomplete — listbox name from an mlv-input host', () => {
  @Component({
    template: `
      <mlv-input
        label="Fruit"
        [hint]="hint()"
        [mlvAutocomplete]="options"
        [mlvAutocompleteDebounce]="0"
      />
    `,
    imports: [MlvAutocomplete, MlvInput],
  })
  class MlvInputHostComponent {
    readonly options = ['Apple', 'Apricot', 'Banana'];
    readonly hint = signal<string | undefined>(undefined);
  }

  @Component({
    template: `
      <mlv-form-field>
        <mlv-label>Vegetable</mlv-label>
        <mlv-input [mlvAutocomplete]="options" [mlvAutocompleteDebounce]="0" />
      </mlv-form-field>
    `,
    imports: [MlvAutocomplete, MlvInput, MlvFormField, MlvLabel],
  })
  class FormFieldHostComponent {
    readonly options = ['Carrot', 'Celery'];
  }

  let overlayContainer: OverlayContainer;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideMlvI18nTesting()] });
    overlayContainer = TestBed.inject(OverlayContainer);
  });

  afterEach(() => {
    overlayContainer.ngOnDestroy();
  });

  /** Mounts `type`, opens its suggestion popup and returns the panel listbox. */
  async function openIn<C>(type: new (...args: never[]) => C): Promise<{
    fixture: ComponentFixture<C>;
    listbox: HTMLElement;
  }> {
    const fixture = TestBed.createComponent(type);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector(
      'input',
    ) as HTMLInputElement;
    input.dispatchEvent(new FocusEvent('focus'));
    await new Promise((resolve) => setTimeout(resolve, 5));
    fixture.detectChanges();
    TestBed.inject(ApplicationRef).tick();
    await fixture.whenStable();
    const listbox = overlayContainer
      .getContainerElement()
      .querySelector('[role="listbox"]') as HTMLElement;
    return { fixture, listbox };
  }

  it("names the listbox from mlv-input's own label input", async () => {
    const { listbox } = await openIn(MlvInputHostComponent);

    expect(listbox).toBeTruthy();
    expect(listbox.getAttribute('aria-label')).toBe('Fruit');
  });

  it("keeps an mlv-hint's text out of the name", async () => {
    const { fixture, listbox: before } = await openIn(MlvInputHostComponent);
    expect(before.getAttribute('aria-label')).toBe('Fruit');

    fixture.componentInstance.hint.set('pick one');
    fixture.detectChanges();
    await fixture.whenStable();

    const input = fixture.nativeElement.querySelector(
      'input',
    ) as HTMLInputElement;
    // Re-query the field so the name is resolved again with the hint present.
    input.value = 'A';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 5));
    fixture.detectChanges();
    TestBed.inject(ApplicationRef).tick();
    await fixture.whenStable();

    const listbox = overlayContainer
      .getContainerElement()
      .querySelector('[role="listbox"]') as HTMLElement;
    // `mlv-hint` renders its source text inside the `<label>` but marks it
    // `aria-hidden` precisely so it stays out of the control's own accessible
    // name. Not `'Fruit pick one'`.
    expect(listbox.getAttribute('aria-label')).toBe('Fruit');
  });

  it('names the listbox from a projected mlv-label in an mlv-form-field', async () => {
    const { listbox } = await openIn(FormFieldHostComponent);

    expect(listbox.getAttribute('aria-label')).toBe('Vegetable');
  });
});

/**
 * #300 — an option whose `value` is `false` / `0` / `''` / `null`, or whose
 * `label` is `''`, used to fail `isSelectOption` (`!!label && !!value`), so the
 * default `toOption` wrapped the whole object: the suggestion read
 * "[object Object]", typing its label found nothing, and committing it wrote
 * "[object Object]" into the field and emitted the object as the value.
 */
describe('MlvAutocomplete — options whose label or value is falsy (#300)', () => {
  const FALSY_OPTIONS: MlvSelectOption<unknown>[] = [
    { label: 'No', value: false },
    { label: 'Yes', value: true },
    { label: 'Zero', value: 0 },
    { label: 'Empty', value: '' },
    { label: 'None', value: null },
    { label: '', value: 'blank' },
  ];

  @Component({
    template: `<input
      aria-label="Answer"
      [mlvAutocomplete]="options"
      [mlvAutocompleteDebounce]="0"
      [mlvAutocompleteInline]="false"
      [(mlvAutocompleteValue)]="value"
      (optionSelected)="picked = $event"
    />`,
    imports: [MlvAutocomplete],
  })
  class FalsyHostComponent {
    readonly options = FALSY_OPTIONS;
    readonly value = signal<unknown>('untouched');
    picked: MlvSelectOption<unknown> | null = null;
  }

  let fixture: ComponentFixture<FalsyHostComponent>;
  let input: HTMLInputElement;
  let overlayContainer: OverlayContainer;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FalsyHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(FalsyHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    overlayContainer = TestBed.inject(OverlayContainer);
  });
  afterEach(() => overlayContainer.ngOnDestroy());

  /** Same flush as the main suite: debounce, effects, then the portal's own CD root. */
  async function settle(ms = 5): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
    fixture.detectChanges();
    TestBed.inject(ApplicationRef).tick();
    await fixture.whenStable();
  }

  const rows = () =>
    Array.from(
      overlayContainer
        .getContainerElement()
        .querySelectorAll<HTMLElement>('[role="option"]'),
    );

  function key(k: string): void {
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: k, bubbles: true }),
    );
    fixture.detectChanges();
  }

  it('suggests every option by its own label, never "[object Object]"', async () => {
    input.dispatchEvent(new FocusEvent('focus'));
    await settle();
    expect(rows().map((row) => row.textContent?.trim())).toEqual([
      'No',
      'Yes',
      'Zero',
      'Empty',
      'None',
      '',
    ]);
  });

  it('finds a falsy-valued option by typing its label', async () => {
    input.dispatchEvent(new FocusEvent('focus'));
    await settle();
    input.value = 'zer';
    input.setSelectionRange(3, 3);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    expect(rows().map((row) => row.textContent?.trim())).toEqual(['Zero']);
  });

  it.each<[string, number, unknown]>([
    ['No', 0, false],
    ['Zero', 2, 0],
    ['Empty', 3, ''],
    ['None', 4, null],
    ['', 5, 'blank'],
  ])(
    'commits "%s" with its label in the field and its value, not the option object',
    async (label, index, expected) => {
      input.dispatchEvent(new FocusEvent('focus'));
      await settle();
      for (let step = 0; step <= index; step++) key('ArrowDown');
      await settle();
      key('Enter');
      await settle();

      const host = fixture.componentInstance;
      expect(input.value).toBe(label);
      expect(host.picked?.label).toBe(label);
      expect(host.picked?.value).toBe(expected);
      expect(host.value()).toBe(expected);
    },
  );

  it('commits a falsy value picked with the pointer', async () => {
    input.dispatchEvent(new FocusEvent('focus'));
    await settle();
    rows()[0].click();
    await settle();
    expect(input.value).toBe('No');
    expect(fixture.componentInstance.value()).toBe(false);
  });
});

/**
 * #300 adjacent — once `isSelectOption` stopped rejecting a `NaN`-valued
 * option, a pointer pick on it went from committing the wrapped object to doing
 * nothing: `selectFromPanel` looked the emitted value up with `===`, and
 * `NaN === NaN` is false. The lookup uses `Object.is`, which also keeps a
 * `-0` option distinct from a `+0` one — the emitted value is always one of the
 * options' own values, so identity is the exact question.
 */
describe('MlvAutocomplete — a NaN-valued option picked with the pointer (#300)', () => {
  @Component({
    template: `<input
      aria-label="Reading"
      [mlvAutocomplete]="options"
      [mlvAutocompleteDebounce]="0"
      [mlvAutocompleteInline]="false"
      [(mlvAutocompleteValue)]="value"
    />`,
    imports: [MlvAutocomplete],
  })
  class NaNHostComponent {
    readonly options: MlvSelectOption<number>[] = [
      { label: 'Zero', value: 0 },
      { label: 'Not a number', value: Number.NaN },
    ];
    readonly value = signal<unknown>('untouched');
  }

  let fixture: ComponentFixture<NaNHostComponent>;
  let input: HTMLInputElement;
  let overlayContainer: OverlayContainer;
  let warn: typeof console.warn;

  beforeEach(async () => {
    // `ngListbox.validate()` finds duplicates with `indexOf`, which never
    // matches NaN, so a listbox holding one NaN option always warns about a
    // duplicate and then logs the element with a `%o` Node cannot walk in
    // jsdom. Both are upstream; only those two lines are dropped here.
    warn = console.warn;
    console.warn = (...args: unknown[]) => {
      const first = args[0];
      if (
        typeof first === 'string' &&
        (first.startsWith('Violations found on element:') ||
          first.startsWith('Duplicate option value'))
      ) {
        return;
      }
      (warn as (...rest: unknown[]) => void)(...args);
    };
    await TestBed.configureTestingModule({
      imports: [NaNHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(NaNHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    overlayContainer = TestBed.inject(OverlayContainer);
  });
  afterEach(() => {
    console.warn = warn;
    overlayContainer.ngOnDestroy();
  });

  async function settle(ms = 5): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
    fixture.detectChanges();
    TestBed.inject(ApplicationRef).tick();
    await fixture.whenStable();
  }

  it('commits the NaN option instead of ignoring the pick', async () => {
    input.dispatchEvent(new FocusEvent('focus'));
    await settle();
    const row = Array.from(
      overlayContainer
        .getContainerElement()
        .querySelectorAll<HTMLElement>('[role="option"]'),
    )[1];
    expect(row.textContent?.trim()).toBe('Not a number');
    row.click();
    await settle();
    expect(input.value).toBe('Not a number');
    expect(fixture.componentInstance.value()).toBe(Number.NaN);
  });
});
