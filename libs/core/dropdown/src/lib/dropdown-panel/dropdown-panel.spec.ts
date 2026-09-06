import { fileURLToPath } from 'node:url';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { MlvSelectionService } from '@malva-ui/core/form-utils';
import { MlvScrollbar } from '@malva-ui/core/scrollbar';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { compile } from 'sass';
import { MlvDropdownPanel } from './dropdown-panel';

describe('MlvDropdownPanel (activedescendant)', () => {
  let fixture: ComponentFixture<MlvDropdownPanel<string>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvDropdownPanel],
      providers: [provideMlvI18nTesting(), MlvSelectionService],
    }).compileComponents();

    fixture =
      TestBed.createComponent<MlvDropdownPanel<string>>(MlvDropdownPanel);
    fixture.componentRef.setInput('options', [
      { label: 'Alpha', value: 'a' },
      { label: 'Beta', value: 'b' },
    ]);
    fixture.componentRef.setInput('listboxId', 'lb');
    fixture.componentRef.setInput('focusMode', 'activedescendant');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders deterministic option ids from the listboxId', () => {
    expect(fixture.nativeElement.querySelector('#lb-option-0')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#lb-option-1')).toBeTruthy();
  });

  it('renders the inner listbox with the compact "menu" list appearance', () => {
    const listbox = fixture.nativeElement.querySelector(
      '.mlv-dropdown-panel__listbox',
    ) as HTMLElement;
    expect(listbox.classList).toContain('mlv-list--appearance-menu');
  });

  it('forwards focusMode="activedescendant" so aria tracks the active option on the listbox', () => {
    const listbox = fixture.nativeElement.querySelector(
      '[role="listbox"]',
    ) as HTMLElement;
    expect(listbox.hasAttribute('aria-activedescendant')).toBe(true);
  });

  it('uses the themed scrollbar without adding a tab stop to the composite widget', () => {
    const scrollbar = fixture.nativeElement.querySelector(
      '.mlv-dropdown-panel__scrollbar.mlv-scrollbar',
    ) as HTMLElement;
    const viewport = scrollbar.querySelector(
      '.mlv-scrollbar__viewport',
    ) as HTMLElement;

    expect(scrollbar).toBeTruthy();
    expect(viewport.getAttribute('tabindex')).toBe('-1');
  });

  it('delegates scrolling without rendering a nested scrollbar in parent mode', () => {
    fixture.componentRef.setInput('scrollMode', 'parent');
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.mlv-dropdown-panel__scrollbar'),
    ).toBeNull();
    expect(fixture.nativeElement.classList).toContain(
      'mlv-dropdown-panel--parent-scroll',
    );
    expect(
      fixture.nativeElement.querySelector('[role="listbox"]'),
    ).toBeTruthy();
  });

  it('names the inner listbox from ariaLabel and omits the attribute otherwise', () => {
    const listbox = fixture.nativeElement.querySelector(
      '[role="listbox"]',
    ) as HTMLElement;
    expect(listbox.hasAttribute('aria-label')).toBe(false);

    fixture.componentRef.setInput('ariaLabel', 'Status');
    fixture.detectChanges();
    expect(listbox.getAttribute('aria-label')).toBe('Status');
  });

  it('applies the active highlight class to the option at activeIndex', () => {
    fixture.componentRef.setInput('activeIndex', 1);
    fixture.detectChanges();
    const items = fixture.nativeElement.querySelectorAll(
      '.mlv-dropdown-panel__item',
    ) as NodeListOf<HTMLElement>;
    expect(items[0].classList).not.toContain(
      'mlv-dropdown-panel__item--active',
    );
    expect(items[1].classList).toContain('mlv-dropdown-panel__item--active');
  });
});

describe('MlvDropdownPanel (option groups)', () => {
  let fixture: ComponentFixture<MlvDropdownPanel<string>>;

  async function setup(
    options: { label: string; value: string; group?: string }[],
  ): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [MlvDropdownPanel],
      providers: [provideMlvI18nTesting(), MlvSelectionService],
    }).compileComponents();

    fixture =
      TestBed.createComponent<MlvDropdownPanel<string>>(MlvDropdownPanel);
    fixture.componentRef.setInput('options', options);
    fixture.componentRef.setInput('listboxId', 'lb');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const grouped = [
    { label: 'Alpha', value: 'a', group: 'Letters' },
    { label: 'Beta', value: 'b', group: 'Letters' },
    { label: 'One', value: '1', group: 'Numbers' },
  ];

  it('renders one role="group" per consecutive group run', async () => {
    await setup(grouped);
    const groups = fixture.nativeElement.querySelectorAll('[role="group"]');
    expect(groups.length).toBe(2);
  });

  it('labels each group via aria-labelledby → a presentational header with matching id and text', async () => {
    await setup(grouped);
    const group = fixture.nativeElement.querySelector(
      '[role="group"]',
    ) as HTMLElement;
    const headerId = group.getAttribute('aria-labelledby');
    expect(headerId).toBeTruthy();
    const header = fixture.nativeElement.querySelector(
      `#${headerId}`,
    ) as HTMLElement;
    expect(header).toBeTruthy();
    expect(header.getAttribute('role')).toBe('presentation');
    expect(header.textContent?.trim()).toBe('Letters');
    expect(header.classList).toContain('mlv-dropdown-panel__group-header');
  });

  it('keeps headers out of the option set (headers are not role="option")', async () => {
    await setup(grouped);
    const options = fixture.nativeElement.querySelectorAll('[role="option"]');
    expect(options.length).toBe(3);
    const headers = fixture.nativeElement.querySelectorAll(
      '.mlv-dropdown-panel__group-header',
    );
    headers.forEach((h: Element) =>
      expect(h.getAttribute('role')).not.toBe('option'),
    );
  });

  it('preserves flat option ids across groups (optionId uses the flat index)', async () => {
    await setup(grouped);
    expect(fixture.nativeElement.querySelector('#lb-option-0')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#lb-option-1')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#lb-option-2')).toBeTruthy();
  });

  it('highlights the option at the flat activeIndex even when grouped', async () => {
    await setup(grouped);
    fixture.componentRef.setInput('activeIndex', 2);
    fixture.detectChanges();
    const active = fixture.nativeElement.querySelector(
      '.mlv-dropdown-panel__item--active .mlv-dropdown-panel__item-label',
    ) as HTMLElement;
    expect(active.textContent?.trim()).toBe('One');
  });

  it('highlights the matched query substring inside a suggestion label', async () => {
    await setup([
      { label: 'Pineapple', value: 'p' },
      { label: 'Banana', value: 'b' },
    ]);
    fixture.componentRef.setInput('highlightQuery', 'app');
    fixture.detectChanges();

    const mark = fixture.nativeElement.querySelector(
      'mark.mlv-dropdown-panel__match',
    ) as HTMLElement;
    expect(mark).toBeTruthy();
    expect(mark.textContent).toBe('app');
    // The label text content is unchanged by the highlight split.
    const label = fixture.nativeElement.querySelector(
      '.mlv-dropdown-panel__item-label',
    ) as HTMLElement;
    expect(label.textContent?.trim()).toBe('Pineapple');
  });

  it('renders a loading affordance and suppresses the empty projection while loading', async () => {
    await setup([]);
    fixture.componentRef.setInput('loading', true);
    fixture.componentRef.setInput('loadingText', 'Fetching…');
    fixture.detectChanges();

    const loading = fixture.nativeElement.querySelector(
      '.mlv-dropdown-panel__loading',
    ) as HTMLElement;
    expect(loading).toBeTruthy();
    expect(loading.textContent).toContain('Fetching…');
    expect(loading.getAttribute('role')).toBe('status');
  });

  it('does not render any group when no option declares a group (unchanged)', async () => {
    await setup([
      { label: 'Alpha', value: 'a' },
      { label: 'Beta', value: 'b' },
    ]);
    expect(fixture.nativeElement.querySelector('[role="group"]')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('.mlv-dropdown-panel__group-header'),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelectorAll('[role="option"]').length,
    ).toBe(2);
  });

  it('renders ungrouped options (no group) in a headerless cluster', async () => {
    await setup([
      { label: 'Alpha', value: 'a' },
      { label: 'Beta', value: 'b', group: 'Letters' },
    ]);
    // One header (for "Letters") but two options; the ungrouped first option
    // renders without a header.
    expect(
      fixture.nativeElement.querySelectorAll(
        '.mlv-dropdown-panel__group-header',
      ).length,
    ).toBe(1);
    expect(
      fixture.nativeElement.querySelectorAll('[role="option"]').length,
    ).toBe(2);
  });
});

describe('MlvDropdownPanel — loading dim + paging', () => {
  let fixture: ComponentFixture<MlvDropdownPanel<string>>;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvDropdownPanel],
      providers: [provideMlvI18nTesting(), MlvSelectionService],
    }).compileComponents();
    fixture =
      TestBed.createComponent<MlvDropdownPanel<string>>(MlvDropdownPanel);
    fixture.componentRef.setInput('options', [
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' },
      { label: 'C', value: 'c' },
    ]);
    el = fixture.nativeElement;
  });

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** The panel's own scrollbar viewport — the sentinel's scroll owner in `self` mode. */
  function viewport(): HTMLElement {
    return el.querySelector('.mlv-scrollbar__viewport') as HTMLElement;
  }

  /**
   * Stubs the viewport's layout metrics. jsdom reports `0` for every layout box,
   * which reads as "already at the end" — so every paging test states the
   * geometry it means. Defaults describe content that overflows the viewport
   * (distance to the end = `1000 - scrollTop - 200`).
   */
  function stubViewportMetrics(scrollHeight = 1000, clientHeight = 200): void {
    const el = viewport();
    Object.defineProperty(el, 'scrollHeight', {
      value: scrollHeight,
      configurable: true,
    });
    Object.defineProperty(el, 'clientHeight', {
      value: clientHeight,
      configurable: true,
    });
    el.scrollTop = 0;
  }

  /** Scrolls the viewport to `top` and dispatches the scroll event. */
  function scrollTo(top: number): void {
    const el = viewport();
    el.scrollTop = top;
    el.dispatchEvent(new Event('scroll'));
  }

  /** Scrolls to 50px from the end — inside the default 150px threshold. */
  function scrollNearEnd(): void {
    scrollTo(750);
  }

  it('adds the --loading modifier and aria-busy while loading, keeping the options rendered', async () => {
    fixture.componentRef.setInput('loading', true);
    await render();
    expect(el.classList).toContain('mlv-dropdown-panel--loading');
    expect(
      el.querySelector('[role="listbox"]')?.getAttribute('aria-busy'),
    ).toBe('true');
    expect(el.querySelectorAll('[role="option"]').length).toBe(3);
    expect(el.querySelector('.mlv-dropdown-panel__loading')).toBeTruthy();
    fixture.componentRef.setInput('loading', false);
    fixture.detectChanges();
    expect(el.classList).not.toContain('mlv-dropdown-panel--loading');
    expect(
      el.querySelector('[role="listbox"]')?.getAttribute('aria-busy'),
    ).toBeNull();
  });

  it('renders a polite bottom status row while loadingMore (top row absent)', async () => {
    fixture.componentRef.setInput('loadingMore', true);
    fixture.componentRef.setInput('loadingText', 'More…');
    await render();
    const row = el.querySelector(
      '.mlv-dropdown-panel__loading-more',
    ) as HTMLElement;
    expect(row).toBeTruthy();
    expect(row.getAttribute('role')).toBe('status');
    expect(row.textContent).toContain('More…');
    expect(el.querySelector('.mlv-dropdown-panel__loading')).toBeNull();
    expect(
      el.querySelector('[role="listbox"]')?.getAttribute('aria-busy'),
    ).toBe('true');
  });

  /**
   * Arms the sentinel: renders the panel, gives the viewport overflowing
   * metrics scrolled to the top (so the auto-fill `check()` stays silent), then
   * flips `hasMore` on. Returns the emission log. The extra `render()` lets the
   * directive rebind to the viewport resolved in `afterNextRender`.
   */
  async function arm(inputs: Record<string, unknown> = {}): Promise<number[]> {
    await render();
    stubViewportMetrics();
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.componentRef.setInput('hasMore', true);
    const emitted: number[] = [];
    fixture.componentInstance.loadMore.subscribe(() => emitted.push(1));
    await render();
    return emitted;
  }

  it('emits loadMore from the sentinel when scrolled near the end and hasMore', async () => {
    const emitted = await arm();
    expect(el.querySelector('.mlv-dropdown-panel__sentinel')).toBeTruthy();
    // Armed but far from the end: the auto-fill check must stay silent.
    expect(emitted.length).toBe(0);

    scrollNearEnd();
    await fixture.whenStable();
    expect(emitted.length).toBe(1);
  });

  it('auto-fills: appended options that still do not fill the scroll owner request the next page', async () => {
    const emitted = await arm();
    expect(emitted.length).toBe(0);

    // The next page landed but the list still falls short of the viewport, so
    // the option change alone must re-measure and ask for another page.
    stubViewportMetrics(100, 200);
    fixture.componentRef.setInput('options', [
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' },
      { label: 'C', value: 'c' },
      { label: 'D', value: 'd' },
      { label: 'E', value: 'e' },
      { label: 'F', value: 'f' },
    ]);
    await render();

    expect(el.querySelectorAll('[role="option"]').length).toBe(6);
    expect(emitted.length).toBe(1);
  });

  it('gates the sentinel while a page is in flight (loadingMore)', async () => {
    const emitted = await arm({ loadingMore: true });

    scrollNearEnd();
    await fixture.whenStable();
    expect(emitted.length).toBe(0);

    // Page landed: back to the top, ungate, and the next near-end scroll fires.
    scrollTo(0);
    fixture.componentRef.setInput('loadingMore', false);
    await render();
    expect(emitted.length).toBe(0);

    scrollNearEnd();
    await fixture.whenStable();
    expect(emitted.length).toBe(1);
  });

  it('honours a non-default infiniteScrollThreshold', async () => {
    const emitted = await arm({ infiniteScrollThreshold: 400 });

    // 500px from the end — outside the 400px threshold.
    scrollTo(300);
    await fixture.whenStable();
    expect(emitted.length).toBe(0);

    // 350px from the end — inside it.
    scrollTo(450);
    await fixture.whenStable();
    expect(emitted.length).toBe(1);
  });

  it('does not emit loadMore when hasMore is false', async () => {
    fixture.componentRef.setInput('hasMore', false);
    const emitted: number[] = [];
    fixture.componentInstance.loadMore.subscribe(() => emitted.push(1));
    await render();
    await render();
    scrollNearEnd();
    await fixture.whenStable();
    expect(emitted.length).toBe(0);
  });
});

/**
 * Host for `scrollMode="parent"`: the panel renders inside an `mlv-scrollbar`,
 * exactly as `mlv-popup` composes it for `mlv-select` / `mlv-combobox`. The
 * wrapping `.mlv-scrollbar__viewport` is the sentinel's scroll owner.
 */
@Component({
  selector: 'mlv-parent-scroll-host',
  imports: [MlvScrollbar, MlvDropdownPanel],
  template: `
    <mlv-scrollbar>
      <mlv-dropdown-panel
        scrollMode="parent"
        [options]="options"
        [hasMore]="hasMore()"
        (loadMore)="onLoadMore()"
      />
    </mlv-scrollbar>
  `,
})
class ParentScrollHost {
  readonly options = [
    { label: 'A', value: 'a' },
    { label: 'B', value: 'b' },
    { label: 'C', value: 'c' },
  ];
  readonly hasMore = signal(false);
  loadMoreCount = 0;

  onLoadMore(): void {
    this.loadMoreCount++;
  }
}

describe('MlvDropdownPanel — parent-mode paging', () => {
  let fixture: ComponentFixture<ParentScrollHost>;
  let host: ParentScrollHost;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ParentScrollHost],
      providers: [provideMlvI18nTesting(), MlvSelectionService],
    }).compileComponents();
    fixture = TestBed.createComponent(ParentScrollHost);
    host = fixture.componentInstance;
  });

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** The panel instance rendered inside the host's scrollbar. */
  function panel(): MlvDropdownPanel<string> {
    return fixture.debugElement.query(By.directive(MlvDropdownPanel))
      .componentInstance as MlvDropdownPanel<string>;
  }

  /** The **wrapping** scrollbar viewport — the panel renders none of its own. */
  function viewport(): HTMLElement {
    return fixture.nativeElement.querySelector(
      '.mlv-scrollbar__viewport',
    ) as HTMLElement;
  }

  /** Same jsdom workaround as the self-mode paging tests: state the geometry. */
  function stubViewportMetrics(scrollHeight = 1000, clientHeight = 200): void {
    const el = viewport();
    Object.defineProperty(el, 'scrollHeight', {
      value: scrollHeight,
      configurable: true,
    });
    Object.defineProperty(el, 'clientHeight', {
      value: clientHeight,
      configurable: true,
    });
    el.scrollTop = 0;
  }

  it('resolves the ancestor scrollbar viewport and pages from it', async () => {
    await render();
    // The scroll owner is resolved in `afterNextRender`; a second flush lets the
    // sentinel directive rebind to it.
    await render();

    expect(
      fixture.nativeElement.querySelector('.mlv-dropdown-panel__scrollbar'),
    ).toBeNull();
    expect(panel()['_scrollContainer']()).toBe(viewport());

    // Armed while parked at the top of an overflowing viewport: silent.
    stubViewportMetrics();
    host.hasMore.set(true);
    await render();
    expect(host.loadMoreCount).toBe(0);

    // 50px from the end — inside the default 150px threshold.
    const el = viewport();
    el.scrollTop = 750;
    el.dispatchEvent(new Event('scroll'));
    await fixture.whenStable();

    expect(host.loadMoreCount).toBe(1);
  });
});

describe('MlvDropdownPanel — missing scroll owner (dev warning)', () => {
  let fixture: ComponentFixture<MlvDropdownPanel<string>>;
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvDropdownPanel],
      providers: [provideMlvI18nTesting(), MlvSelectionService],
    }).compileComponents();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    fixture =
      TestBed.createComponent<MlvDropdownPanel<string>>(MlvDropdownPanel);
    fixture.componentRef.setInput('options', [
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' },
    ]);
  });

  afterEach(() => warn.mockRestore());

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('warns once when hasMore is armed in parent mode with no scrollbar ancestor', async () => {
    fixture.componentRef.setInput('scrollMode', 'parent');
    await render();
    expect(warn).not.toHaveBeenCalled();

    // `hasMore` flipping true later must still be caught.
    fixture.componentRef.setInput('hasMore', true);
    await render();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('[mlv-dropdown-panel]');

    // Re-checks never re-warn for the same panel instance.
    await render();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('stays silent while hasMore is false', async () => {
    fixture.componentRef.setInput('scrollMode', 'parent');
    await render();
    await render();
    expect(warn).not.toHaveBeenCalled();
  });

  it('stays silent in self mode, where the panel owns its scrollbar', async () => {
    fixture.componentRef.setInput('hasMore', true);
    await render();
    await render();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('MlvDropdownPanel — disabled options', () => {
  let fixture: ComponentFixture<MlvDropdownPanel<string>>;
  let el: HTMLElement;
  let emitted: readonly string[][];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvDropdownPanel],
      providers: [provideMlvI18nTesting(), MlvSelectionService],
    }).compileComponents();

    fixture =
      TestBed.createComponent<MlvDropdownPanel<string>>(MlvDropdownPanel);
    fixture.componentRef.setInput('options', [
      { label: 'Enabled', value: 'a' },
      { label: 'Blocked', value: 'b', disabled: true },
    ]);
    fixture.componentRef.setInput('listboxId', 'lb');
    el = fixture.nativeElement;
    emitted = [];
    fixture.componentInstance.valueChange.subscribe((values) => {
      emitted = [...emitted, [...values]];
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('marks a disabled option and blocks its selection', () => {
    const rows = el.querySelectorAll<HTMLElement>('[role="option"]');
    expect(rows[1].getAttribute('aria-disabled')).toBe('true');

    // Positive control: clicking the enabled row does emit, so the assertion
    // below on the disabled row fails for the right reason (blocked
    // selection) rather than because clicks never emit at all.
    rows[0].click();
    fixture.detectChanges();
    expect(emitted).toContainEqual(['a']);

    rows[1].click();
    fixture.detectChanges();

    // Selection must not include the disabled value.
    expect(emitted.some((values) => values.includes('b'))).toBe(false);
  });
});

describe('MlvDropdownPanel — activedescendant highlight parity (#75)', () => {
  // The two focus modes must render the same mark. In `roving` the option
  // takes DOM focus and picks up whatever `list-item.scss` paints on
  // `:focus-visible`; in `activedescendant` focus stays on the owning combobox
  // input, so that rule never matches and the panel has to paint it here.
  //
  // The assertions below read the roving treatment out of `list-item.scss`
  // rather than restating it, so the two can only agree — a change to one that
  // is not mirrored in the other fails here rather than shipping as a visual
  // drift, which is exactly how #75 arose.
  //
  // jsdom applies no `styleUrl` and resolves neither `var()` nor `calc()`
  // through `getComputedStyle`, so both stylesheets are compiled through Sass
  // and their emitted declarations read directly — the pattern
  // `icon-toggle.spec.ts` and `button.spec.ts` already use.
  // `setup-strip-css-layers.js` removes the `@layer` wrapper on injection, so
  // `sheet.cssRules` is populated rather than dropped.
  // Paths resolve from this file, never from `process.cwd()`: the
  // `@nx/vitest:test` executor runs with cwd = workspace root while the
  // inferred `vite:test` runs from the project root, so only `import.meta.url`
  // is stable across both. See `best-practices.md` — "Nx Workspace Conventions".
  function rulesOf(scss: string): CSSStyleRule[] {
    const css = compile(fileURLToPath(new URL(scss, import.meta.url))).css;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    const rules = [...(style.sheet?.cssRules ?? [])].filter(
      (rule): rule is CSSStyleRule => rule instanceof CSSStyleRule,
    );
    style.remove();
    return rules;
  }

  let panelRules: CSSStyleRule[];
  let listItemRules: CSSStyleRule[];

  beforeAll(() => {
    panelRules = rulesOf('./dropdown-panel.scss');
    listItemRules = rulesOf(
      '../../../../list/src/lib/list-item/list-item.scss',
    );
  });

  const ruleFor = (
    rules: CSSStyleRule[],
    pattern: RegExp,
  ): CSSStyleRule | undefined =>
    rules.find(({ selectorText }) => pattern.test(selectorText));

  const active = () =>
    ruleFor(panelRules, /\.mlv-dropdown-panel__item--active$/);

  it('paints the ring the roving mode gets from list-item.scss, not a restatement of it', () => {
    const roving = ruleFor(listItemRules, /^\.mlv-list-item:focus-visible$/);
    const rovingOutline = roving?.style.getPropertyValue('outline').trim();

    // Guard the guard: if list-item ever stops declaring the ring, the
    // comparison below would pass vacuously on two empty strings.
    expect(rovingOutline).toBeTruthy();
    expect(active()?.style.getPropertyValue('outline').trim()).toBe(
      rovingOutline,
    );
  });

  it('insets that ring, because the panel viewport clips horizontally', () => {
    const inset = 'calc(var(--mlv-focus-ring-offset) * -1)';

    expect(active()?.style.getPropertyValue('outline-offset').trim()).toBe(
      inset,
    );
    // The same inset the panel already applies to the roving ring.
    expect(
      ruleFor(panelRules, /\.mlv-dropdown-panel__item:focus-visible$/)
        ?.style.getPropertyValue('outline-offset')
        .trim(),
    ).toBe(inset);
  });

  it('wins the cascade over the base rule it has to override', () => {
    // `.mlv-dropdown-panel .mlv-dropdown-panel__item--active` is (0,2,0);
    // every `outline` rule in `list-item.scss` is at most (0,1,1). Both sit in
    // `@layer mlv.components`, so specificity decides.
    const classes = (selector: string) =>
      (selector.match(/\.[a-z0-9-]+/gi) ?? []).length;

    expect(classes(active()?.selectorText ?? '')).toBeGreaterThan(
      Math.max(
        ...listItemRules
          .filter(({ style }) => style.getPropertyValue('outline'))
          .map(({ selectorText }) => classes(selectorText)),
      ),
    );
  });

  it('paints no background of its own — the fill belongs to :hover alone', () => {
    // #75's original fix tinted `.mlv-list-item__surface`, an inner square box,
    // while `:hover` tints the whole rounded row. Same token, different mark,
    // and roving has no fill at all. A hovered row is tinted, the keyboard row
    // is ringed, and a row that is both shows both.
    const backgrounds = panelRules
      .filter(({ selectorText }) => selectorText.includes('__item--active'))
      .flatMap(({ style }) => [
        style.getPropertyValue('background'),
        style.getPropertyValue('background-color'),
        style.getPropertyValue('--mlv-list-item-bg'),
      ])
      .filter((value) => value.trim().length > 0);

    expect(backgrounds).toEqual([]);
  });

  it('takes no z-index, so it cannot paint over the sticky group header', () => {
    // The ring is inset, so it is drawn inside the row's own border box and no
    // adjacent row can reach it — a z-index buys nothing. It would however put
    // the row into the header's stacking competition and, being later in DOM
    // order, win and clip it.
    //
    // The header's own value is asserted as "declared", not as a literal:
    // #109 lifted it to `var(--mlv-z-raised)` so it clears the `z-index: 1`
    // that `list-item.scss` gives a `:focus-visible` row on the roving path.
    // `dropdown-panel-stacking.spec.ts` pins the numeric relationship.
    expect(active()?.style.getPropertyValue('z-index').trim()).toBe('');
    expect(
      ruleFor(panelRules, /\.mlv-dropdown-panel__group-header$/)
        ?.style.getPropertyValue('z-index')
        .trim(),
    ).not.toBe('');
  });
});

/**
 * The check-mark is a membership test, and it has to give the same answer as
 * every other membership test in the stack — `MlvSelectionService.isSelected`,
 * `deselect`, and the `select`/`toggle` de-dup path, all of which run the
 * injected comparator. It used to run `new Set(selectedValues()).has(value)`
 * instead, and SameValueZero is not that comparator (#132).
 */
describe('MlvDropdownPanel — check-mark agrees with the comparator (#132)', () => {
  interface Item {
    readonly id: number;
  }

  async function setup<T>(
    options: { label: string; value: T }[],
    selectedValues: T[],
  ): Promise<ComponentFixture<MlvDropdownPanel<T>>> {
    await TestBed.configureTestingModule({
      imports: [MlvDropdownPanel],
      providers: [provideMlvI18nTesting(), MlvSelectionService],
    }).compileComponents();

    const fixture =
      TestBed.createComponent<MlvDropdownPanel<T>>(MlvDropdownPanel);
    fixture.componentRef.setInput('options', options);
    fixture.componentRef.setInput('selectedValues', selectedValues);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  /**
   * Swallows `@angular/aria`'s listbox violation warning for the duration of a
   * NaN test, restoring `console.warn` afterwards.
   *
   * Nothing about this panel is being suppressed. `ngListbox.validate()`
   * detects duplicate option values with `values.indexOf(val) !== idx`, and
   * `indexOf` never matches `NaN` — so a listbox holding *one* NaN option is
   * always reported as holding a duplicate. It then logs the offending element
   * with `console.warn('… %o:', element)`, and Node's `%o` formatter throws
   * `TypeError: Receiver must be an instance of class URL` while walking a
   * jsdom element, which surfaces as a stack trace in the suite output. Both
   * halves are upstream and neither depends on the selection.
   *
   * Only aria's two violation lines are dropped; every other warning still
   * reaches the real `console.warn`, so a warning this library starts emitting
   * during a NaN test (the panel's own dev-mode scroll-owner diagnostic, say)
   * cannot hide behind the mute.
   */
  function silenceAriaNaNViolation(): () => void {
    const original = console.warn;
    console.warn = (...args: unknown[]) => {
      const first = args[0];
      if (
        typeof first === 'string' &&
        (first.startsWith('Violations found on element:') ||
          first.startsWith('Duplicate option value'))
      ) {
        return;
      }
      (original as (...rest: unknown[]) => void)(...args);
    };
    return () => {
      console.warn = original;
    };
  }

  /** Labels of the rows currently rendering a check-mark, in DOM order. */
  function checkedLabels(el: HTMLElement): string[] {
    return [...el.querySelectorAll<HTMLElement>('[role="option"]')]
      .filter((row) => row.querySelector('.mlv-dropdown-panel__item-check'))
      .map((row) => row.textContent?.trim() ?? '');
  }

  /** `aria-selected` of every rendered row, in DOM order. */
  function ariaSelected(el: HTMLElement): (string | null)[] {
    return [...el.querySelectorAll<HTMLElement>('[role="option"]')].map((row) =>
      row.getAttribute('aria-selected'),
    );
  }

  it('leaves a NaN row unchecked, because === reports it unselected', async () => {
    // `Set.has(NaN)` is true while `findIndex(v => v === NaN)` is -1, so the
    // Set ticked a row that `MlvSelectionService` — and therefore the display
    // value and the deselect path — considered not selected.
    const restore = silenceAriaNaNViolation();
    try {
      const fixture = await setup<number>(
        [
          { label: 'Not a number', value: NaN },
          { label: 'One', value: 1 },
        ],
        [NaN],
      );

      const service = TestBed.inject(MlvSelectionService);
      service.setValues([NaN]);
      expect(service.isSelected(NaN)).toBe(false);

      expect(checkedLabels(fixture.nativeElement)).toEqual([]);
      // aria reports the same, so the row is unselected by every account —
      // the `Set` was the only thing claiming otherwise.
      expect(ariaSelected(fixture.nativeElement)).not.toContain('true');
    } finally {
      restore();
    }
  });

  it('checks the row a custom comparator matches, not the one === matches', async () => {
    // The committed value is a fresh object (as a deserialised form value is),
    // so it is `===`-equal to no option value. The comparator matches it to
    // option B — the case `MlvSelectionService.compareWith`'s JSDoc promises
    // keeps "check-marks / display value in agreement".
    const options = [
      { label: 'A', value: { id: 1 } },
      { label: 'B', value: { id: 2 } },
    ];
    const committed: Item = { id: 2 };

    await TestBed.configureTestingModule({
      imports: [MlvDropdownPanel],
      providers: [provideMlvI18nTesting(), MlvSelectionService],
    }).compileComponents();

    const service = TestBed.inject(MlvSelectionService);
    service.compareWith.set((a, b) => (a as Item).id === (b as Item).id);
    service.setValues([committed]);

    const fixture =
      TestBed.createComponent<MlvDropdownPanel<Item>>(MlvDropdownPanel);
    fixture.componentRef.setInput('options', options);
    fixture.componentRef.setInput('selectedValues', [committed]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // Guard the guard: the comparator really does call option B selected, so
    // the DOM assertion below can only fail on the panel disagreeing with it.
    expect(service.isSelected(options[1].value)).toBe(true);
    expect(service.isSelected(options[0].value)).toBe(false);

    expect(checkedLabels(fixture.nativeElement)).toEqual(['B']);

    // `aria-selected` is asserted by its own test below, which also covers the
    // reconciliation emit — the two share one cause (`@angular/aria` matching
    // values to options with `===`) and one fix (`_ariaValues`). This test is
    // deliberately narrower: it pins the check-mark gate alone, so an
    // `_ariaValues` regression cannot be mistaken for a comparator regression.
  });

  it('takes an explicit compareWith input over the service default', async () => {
    const options = [
      { label: 'A', value: { id: 1 } },
      { label: 'B', value: { id: 2 } },
    ];

    await TestBed.configureTestingModule({
      imports: [MlvDropdownPanel],
      providers: [provideMlvI18nTesting(), MlvSelectionService],
    }).compileComponents();

    const fixture =
      TestBed.createComponent<MlvDropdownPanel<Item>>(MlvDropdownPanel);
    fixture.componentRef.setInput('options', options);
    fixture.componentRef.setInput('selectedValues', [{ id: 2 }]);
    fixture.componentRef.setInput(
      'compareWith',
      (a: Item, b: Item) => a.id === b.id,
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(checkedLabels(fixture.nativeElement)).toEqual(['B']);
  });

  /**
   * Renders a standalone panel whose committed value is a *fresh* object — as
   * a deserialised form value is — matched to option B by `compareWith` alone,
   * and records every `valueChange` from before the first render onward.
   */
  async function setupFreshObjectSelection(): Promise<{
    fixture: ComponentFixture<MlvDropdownPanel<Item>>;
    emitted: (readonly Item[])[];
  }> {
    await TestBed.configureTestingModule({
      imports: [MlvDropdownPanel],
      providers: [provideMlvI18nTesting(), MlvSelectionService],
    }).compileComponents();

    const fixture =
      TestBed.createComponent<MlvDropdownPanel<Item>>(MlvDropdownPanel);
    const emitted: (readonly Item[])[] = [];
    fixture.componentInstance.valueChange.subscribe((values) =>
      emitted.push(values),
    );
    fixture.componentRef.setInput('options', [
      { label: 'A', value: { id: 1 } },
      { label: 'B', value: { id: 2 } },
    ]);
    fixture.componentRef.setInput('selectedValues', [{ id: 2 }]);
    fixture.componentRef.setInput(
      'compareWith',
      (a: Item, b: Item) => a.id === b.id,
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    // A second settle: aria reconciles `value` from an afterRenderEffect, so
    // the emit under test lands one render after the one that paints the tick.
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, emitted };
  }

  it('emits nothing on first render, so the tick it paints survives', async () => {
    // `@angular/aria` reconciles its `value` model against the *rendered*
    // options with `i.value() === v` — SameValueZero, no comparator — from an
    // afterRenderEffect, and re-emits whatever survives. A value matched only
    // by `compareWith` is invisible to that check, so the panel used to emit
    // `[]` on first render with no user interaction. The wiring the docs
    // example shows (`selected.set([...values])`) then cleared the selection
    // and the check-mark vanished a frame after it appeared.
    const { emitted } = await setupFreshObjectSelection();

    expect(emitted).toEqual([]);
  });

  it('marks the matched row aria-selected, not just check-marked', async () => {
    // Same cause as the spurious emit above: aria's option computes
    // `aria-selected` as `listbox.value().includes(this.value())`, which takes
    // no comparator. Normalising what the panel hands aria settles both — a
    // screen reader and the check-mark now agree about which row is selected.
    const { fixture } = await setupFreshObjectSelection();

    expect(checkedLabels(fixture.nativeElement)).toEqual(['B']);
    expect(ariaSelected(fixture.nativeElement)).toEqual(['false', 'true']);
  });

  it('still checks exactly the reference-equal rows under the default', async () => {
    // The overwhelmingly common path, and the one that has to stay O(1) per
    // row: plain values, default comparator, no hazard.
    const fixture = await setup<string>(
      [
        { label: 'Alpha', value: 'a' },
        { label: 'Beta', value: 'b' },
        { label: 'Gamma', value: 'c' },
      ],
      ['b'],
    );

    expect(checkedLabels(fixture.nativeElement)).toEqual(['Beta']);
  });
});
