import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Listbox } from '@angular/aria/listbox';
import { MlvSelectionService } from '@malva-ui/core/form-utils';
import { MlvScrollbar } from '@malva-ui/core/scrollbar';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import type { MlvSelectOption } from '../select-option';
import { MlvDropdownPanel } from './dropdown-panel';
import { DROPDOWN_WINDOW_PAGE, MIRRORED_LISTBOX_CONFIG } from './option-window';

/**
 * #318 — the panel renders a bounded, growing window of its options instead of
 * every row. Each row hosts `@angular/aria`'s `Option`, whose registration is
 * O(n²) in the size of the collection, so a 5,000-option list used to take
 * ~12.5 s to open in jsdom. Every assertion below pins one half of the
 * contract that has to survive the window: the rows it renders, the positions
 * assistive tech reads, the keys that reach rows it has not rendered, the ids
 * an owning combobox points at, and the committed values aria would otherwise
 * drop because their row is absent.
 */

/** Rows the panel renders up front, and the step the window grows by. */
const WINDOW = DROPDOWN_WINDOW_PAGE;

type Option = MlvSelectOption<string>;

function makeOptions(
  n: number,
  label: (i: number) => string = (i) => `Option ${i}`,
): Option[] {
  return Array.from({ length: n }, (_, i) => ({
    label: label(i),
    value: `v${i}`,
  }));
}

describe('MlvDropdownPanel — windowed option list (#318)', () => {
  let fixture: ComponentFixture<MlvDropdownPanel<string>>;
  let el: HTMLElement;
  let emitted: string[][];

  async function setup(inputs: Record<string, unknown>): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [MlvDropdownPanel],
      providers: [provideMlvI18nTesting(), MlvSelectionService],
    }).compileComponents();
    fixture =
      TestBed.createComponent<MlvDropdownPanel<string>>(MlvDropdownPanel);
    el = fixture.nativeElement;
    fixture.componentRef.setInput('listboxId', 'lb');
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    emitted = [];
    fixture.componentInstance.valueChange.subscribe((values) => {
      emitted.push([...values]);
    });
    await render();
  }

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function rows(): HTMLElement[] {
    return [...el.querySelectorAll<HTMLElement>('[role="option"]')];
  }

  function activeId(): string | undefined {
    return (document.activeElement as HTMLElement | null)?.id;
  }

  /** Dispatches a keydown the way a real key would reach it: on the focused row. */
  async function press(
    key: string,
    init: KeyboardEventInit = {},
  ): Promise<void> {
    const target = (document.activeElement as HTMLElement | null) ?? el;
    target.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, ...init }),
    );
    await render();
  }

  /** Focuses the first rendered row, as Tab would land on a fresh listbox. */
  function focusFirstRow(): void {
    rows()[0].focus();
    expect(activeId()).toBe('lb-option-0');
  }

  /** The panel's own scrollbar viewport — the sentinel's scroll owner in `self` mode. */
  function viewport(): HTMLElement {
    return el.querySelector('.mlv-scrollbar__viewport') as HTMLElement;
  }

  /** Row height the stubbed layout assumes. */
  const ROW_PX = 10;

  /**
   * Gives the viewport the layout jsdom never computes: a 200px box whose
   * content grows with the rows actually rendered, so growing the window moves
   * the end away the way it does in a browser. Without it every metric is `0`,
   * which reads as "no layout".
   */
  function stubViewportMetrics(clientHeight = 200): void {
    const target = viewport();
    Object.defineProperty(target, 'scrollHeight', {
      get: () => rows().length * ROW_PX,
      configurable: true,
    });
    Object.defineProperty(target, 'clientHeight', {
      value: clientHeight,
      configurable: true,
    });
  }

  /** Scrolls the viewport to 50px from its (stubbed) end and settles. */
  async function scrollNearEnd(): Promise<void> {
    const target = viewport();
    target.scrollTop = target.scrollHeight - target.clientHeight - 50;
    target.dispatchEvent(new Event('scroll'));
    await render();
  }

  afterEach(() => fixture?.destroy());

  describe('rendering', () => {
    it('renders one page of a 5,000-option list, each row carrying its position in the whole set', async () => {
      await setup({ options: makeOptions(5000) });

      const rendered = rows();
      expect(rendered.length).toBe(WINDOW);
      expect(rendered[0].getAttribute('aria-setsize')).toBe('5000');
      expect(rendered[0].getAttribute('aria-posinset')).toBe('1');
      expect(rendered[WINDOW - 1].getAttribute('aria-posinset')).toBe(
        String(WINDOW),
      );
    });

    it('renders a list that fits the window unchanged, with no set-position attributes', async () => {
      await setup({ options: makeOptions(40) });

      const rendered = rows();
      expect(rendered.length).toBe(40);
      expect(rendered[0].hasAttribute('aria-setsize')).toBe(false);
      expect(rendered[0].hasAttribute('aria-posinset')).toBe(false);
    });

    it('numbers grouped rows within their group, the way a fully rendered list is read', async () => {
      const options = makeOptions(3000).map((option, i) => ({
        ...option,
        group: i < 1000 ? 'A' : i < 2000 ? 'B' : 'C',
      }));
      await setup({ options });

      const rendered = rows();
      expect(rendered.length).toBe(WINDOW);
      expect(rendered[0].getAttribute('aria-setsize')).toBe('1000');
      expect(rendered[0].getAttribute('aria-posinset')).toBe('1');
      expect(rendered[WINDOW - 1].getAttribute('aria-posinset')).toBe(
        String(WINDOW),
      );
    });

    it('does not grow on its own while the scroll owner has no layout', async () => {
      // jsdom reports every layout metric as 0, which the paging sentinel
      // reads as "already at the end". Growing on that signal would cascade
      // page by page to the full list, so a zero-height owner never grows.
      await setup({ options: makeOptions(2000) });
      await render();
      await render();

      expect(rows().length).toBe(WINDOW);
    });

    it('renders the first page of 5,000 options in under 500 ms', async () => {
      // Unwindowed, this render measured 12.5–12.9 s on the dev machine;
      // windowed, ~33 ms. The ticket's budget, with an order of magnitude of
      // headroom for a loaded CI runner.
      await TestBed.configureTestingModule({
        imports: [MlvDropdownPanel],
        providers: [provideMlvI18nTesting(), MlvSelectionService],
      }).compileComponents();
      fixture =
        TestBed.createComponent<MlvDropdownPanel<string>>(MlvDropdownPanel);
      fixture.componentRef.setInput('options', makeOptions(5000));

      const start = performance.now();
      fixture.detectChanges();
      await fixture.whenStable();
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(500);
    });
  });

  describe('growing the window', () => {
    it('grows by a page as the scroll owner nears the end, and pages the source only once every option is rendered', async () => {
      await setup({ options: makeOptions(250) });
      await render();
      stubViewportMetrics();
      fixture.componentRef.setInput('hasMore', true);
      let loadMore = 0;
      fixture.componentInstance.loadMore.subscribe(() => loadMore++);
      await render();
      expect(rows().length).toBe(WINDOW);

      await scrollNearEnd();
      expect(rows().length).toBe(2 * WINDOW);
      expect(loadMore).toBe(0);

      await scrollNearEnd();
      expect(rows().length).toBe(250);
      expect(loadMore).toBe(0);

      await scrollNearEnd();
      expect(loadMore).toBe(1);
    });

    it('keeps the grown window when a page is appended behind it', async () => {
      const first = makeOptions(250);
      await setup({ options: first });
      await render();
      stubViewportMetrics();
      await scrollNearEnd();
      expect(rows().length).toBe(2 * WINDOW);

      // Next page landed: same leading options, 150 more behind them.
      fixture.componentRef.setInput('options', [
        ...first,
        ...makeOptions(400).slice(250),
      ]);
      await render();

      expect(rows().length).toBe(2 * WINDOW);
    });

    it('keeps the grown window when the same options are regrouped', async () => {
      const flat = makeOptions(350);
      await setup({ options: flat });
      await render();
      stubViewportMetrics();
      await scrollNearEnd();
      expect(rows().length).toBe(2 * WINDOW);

      // Back at the top, so a collapsed window would not grow straight back.
      viewport().scrollTop = 0;
      // Every row is re-created, but the list is the one the user scrolled.
      fixture.componentRef.setInput(
        'options',
        flat.map((option) => ({ ...option, group: 'G' })),
      );
      await render();

      expect(rows().length).toBe(2 * WINDOW);
    });

    it('re-mounts one page, not the whole list, when a filter is cleared', async () => {
      const all = makeOptions(350);
      await setup({ options: all });
      focusFirstRow();
      await press('End');
      expect(rows().length).toBe(350);

      // Type a query, then backspace to empty.
      fixture.componentRef.setInput(
        'options',
        all.filter((option) => option.label.endsWith('7')),
      );
      await render();
      fixture.componentRef.setInput('options', all);
      await render();

      expect(rows().length).toBe(WINDOW);
    });
  });

  describe('roving keyboard reaches rows past the window', () => {
    it('End focuses the true last option', async () => {
      await setup({ options: makeOptions(350) });
      focusFirstRow();

      await press('End');

      expect(activeId()).toBe('lb-option-349');
    });

    it('ArrowUp on the first option wraps to the true last option', async () => {
      await setup({ options: makeOptions(350) });
      focusFirstRow();

      await press('ArrowUp');

      expect(activeId()).toBe('lb-option-349');
    });

    it('ArrowDown on the last rendered row moves on instead of wrapping to the top', async () => {
      await setup({ options: makeOptions(350) });
      focusFirstRow();
      for (let i = 0; i < WINDOW - 1; i++) {
        (document.activeElement as HTMLElement).dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
        );
      }
      await render();
      expect(activeId()).toBe(`lb-option-${WINDOW - 1}`);

      await press('ArrowDown');

      expect(activeId()).toBe(`lb-option-${WINDOW}`);
    });

    it('typeahead focuses a match past the window', async () => {
      await setup({
        options: makeOptions(350, (i) => (i === 250 ? 'Zebra' : `Option ${i}`)),
      });
      focusFirstRow();

      await press('z');

      expect(activeId()).toBe('lb-option-250');
    });

    it('Ctrl+A in a multi-select selects every option, rendered or not', async () => {
      await setup({ options: makeOptions(350), multiple: true });
      focusFirstRow();

      await press('a', { ctrlKey: true });

      expect(emitted.at(-1)?.length).toBe(350);
    });

    it.each([
      ['Ctrl+Shift', { ctrlKey: true, shiftKey: true }],
      ['Cmd+Shift', { metaKey: true, shiftKey: true }],
    ])(
      '%s+End in a multi-select extends the range to the true last option',
      async (_name, modifiers) => {
        await setup({ options: makeOptions(350), multiple: true });
        focusFirstRow();
        // aria anchors a range on the Shift keydown itself.
        await press('Shift', { shiftKey: true });

        await press('End', modifiers);

        expect(activeId()).toBe('lb-option-349');
        expect(emitted.at(-1)?.length).toBe(350);
        expect(emitted.at(-1)?.at(-1)).toBe('v349');
      },
    );

    it('Shift+ArrowDown in a multi-select extends the range past the last rendered row', async () => {
      await setup({ options: makeOptions(350), multiple: true });
      focusFirstRow();
      for (let i = 0; i < WINDOW - 1; i++) {
        (document.activeElement as HTMLElement).dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
        );
      }
      await render();
      await press('Shift', { shiftKey: true });

      await press('ArrowDown', { shiftKey: true });

      expect(activeId()).toBe(`lb-option-${WINDOW}`);
      expect(emitted.at(-1)).toEqual([`v${WINDOW - 1}`, `v${WINDOW}`]);
    });
  });

  describe('the key mirror matches the live aria listbox', () => {
    it('reads the configuration its key table assumes off the rendered Listbox', async () => {
      await setup({ options: makeOptions(350) });
      const listbox = fixture.debugElement
        .query(By.directive(Listbox))
        .injector.get(Listbox);

      // The mirror pre-renders the row aria will move to; if aria's own
      // configuration drifted, it would render a row aria then skips.
      const live = {
        orientation: listbox.orientation(),
        wrap: listbox.wrap(),
        selectionMode: listbox.selectionMode(),
        softDisabled: listbox.softDisabled(),
        typeaheadDelay: listbox.typeaheadDelay(),
      };
      expect(live).toEqual(MIRRORED_LISTBOX_CONFIG);
    });
  });

  describe('roving default tab stop', () => {
    function tabStop(): string | null {
      return el.querySelector('[role="option"][tabindex="0"]')?.id ?? null;
    }

    it('renders the first checked row aria can focus, skipping a disabled checked row', async () => {
      await setup({
        options: makeOptions(350).map((option, i) =>
          i === 50 ? { ...option, disabled: true } : option,
        ),
        multiple: true,
        selectedValues: ['v50', 'v300'],
      });

      expect(rows().length).toBeGreaterThan(300);
      expect(tabStop()).toBe('lb-option-300');
    });

    it('renders the first focusable row when a whole window of leading options is disabled', async () => {
      await setup({
        options: makeOptions(350).map((option, i) =>
          i < WINDOW ? { ...option, disabled: true } : option,
        ),
      });

      // With only disabled rows registered, aria counts the whole listbox as
      // disabled and takes the tab stop itself.
      expect(tabStop()).toBe(`lb-option-${WINDOW}`);
      expect(
        el.querySelector('[role="listbox"]')?.getAttribute('tabindex'),
      ).not.toBe('0');
    });

    it('follows a committed value set before the listbox is interacted with', async () => {
      await setup({ options: makeOptions(350) });

      fixture.componentRef.setInput('selectedValues', ['v300']);
      await render();

      expect(tabStop()).toBe('lb-option-300');
    });

    it('stops following the selection once focus has entered the listbox', async () => {
      await setup({ options: makeOptions(350) });
      focusFirstRow();

      fixture.componentRef.setInput('selectedValues', ['v300']);
      await render();

      // aria no longer re-derives its tab stop, so neither does the window.
      expect(rows().length).toBe(WINDOW);
      expect(tabStop()).toBe('lb-option-0');
    });

    it('stops following the selection after a click that moves no focus', async () => {
      // A disabled row: aria counts the click as interaction but moves
      // neither focus nor its active row, so no focusin reaches the panel.
      await setup({
        options: makeOptions(350).map((option, i) =>
          i === 5 ? { ...option, disabled: true } : option,
        ),
      });
      rows()[5].click();
      await render();
      expect(document.activeElement).toBe(document.body);

      fixture.componentRef.setInput('selectedValues', ['v300']);
      await render();

      expect(rows().length).toBe(WINDOW);
      expect(tabStop()).toBe('lb-option-0');
    });

    it('does not grow when the first of two checked rows is deselected', async () => {
      await setup({
        options: makeOptions(350),
        multiple: true,
        selectedValues: ['v3', 'v300'],
      });
      // The consumer loops every emission back, as a bound form does.
      fixture.componentInstance.valueChange.subscribe((values) => {
        fixture.componentRef.setInput('selectedValues', [...values]);
      });
      expect(rows().length).toBe(WINDOW);

      rows()[3].click();
      await render();

      expect(emitted.at(-1)).toEqual(['v300']);
      expect(rows().length).toBe(WINDOW);
      expect(tabStop()).toBe('lb-option-3');
    });

    it('pins the default tab stop again when the options are replaced under an interacted listbox', async () => {
      await setup({ options: makeOptions(350) });
      focusFirstRow();

      // A new option set drops aria's active row, so aria re-derives its tab
      // stop from the rows it has — the committed one has to be among them.
      fixture.componentRef.setInput(
        'options',
        makeOptions(350).map((option) => ({
          ...option,
          value: option.value.replace('v', 'w'),
        })),
      );
      fixture.componentRef.setInput('selectedValues', ['w300']);
      await render();

      expect(tabStop()).toBe('lb-option-300');
    });

    describe('when the same values re-create their rows under an interacted listbox', () => {
      /**
       * Interacts with the listbox on row `active`, then commits `v300`: aria
       * keeps its tab stop on the active row and the window stays one page.
       */
      async function interactThenCommit(
        options: Option[],
        active = 0,
      ): Promise<void> {
        await setup({ options });
        focusFirstRow();
        for (let i = 0; i < active; i++) await press('ArrowDown');
        fixture.componentRef.setInput('selectedValues', ['v300']);
        await render();
        expect(rows().length).toBe(WINDOW);
        expect(tabStop()).toBe(`lb-option-${active}`);
      }

      /** Every option of a 350-long list under `group(i)`. */
      function regrouped(
        group: (index: number) => string | undefined,
      ): Option[] {
        return makeOptions(350).map((option, i) => ({
          ...option,
          group: group(i),
        }));
      }

      async function setOptions(options: Option[]): Promise<void> {
        fixture.componentRef.setInput('options', options);
        await render();
      }

      // Each case re-creates aria's active row, so aria re-derives its tab stop
      // from the rows it has; the committed row has to be among them.
      it('pins the default tab stop again when the list turns grouped', async () => {
        await interactThenCommit(makeOptions(350));
        await setOptions(regrouped(() => 'G'));
        expect(tabStop()).toBe('lb-option-300');
      });

      it('pins it again when a group past the window turns the list grouped', async () => {
        await interactThenCommit(makeOptions(350));
        await setOptions(regrouped((i) => (i === 349 ? 'Z' : undefined)));
        expect(tabStop()).toBe('lb-option-300');
      });

      it('pins it again when the active row moves to another group run', async () => {
        await interactThenCommit(
          regrouped(() => 'A'),
          3,
        );
        await setOptions(regrouped((i) => (i < 2 ? 'B' : 'A')));
        expect(tabStop()).toBe('lb-option-300');
      });

      it('pins it again when the run of the active row loses its label', async () => {
        await interactThenCommit(regrouped(() => 'A'));
        await setOptions(regrouped((i) => (i === 349 ? 'A' : undefined)));
        expect(tabStop()).toBe('lb-option-300');
      });

      it('pins it again when scrollMode re-creates the listbox', async () => {
        await interactThenCommit(makeOptions(350));
        fixture.componentRef.setInput('scrollMode', 'parent');
        await render();
        expect(tabStop()).toBe('lb-option-300');
      });

      it('keeps the latch when a group is only renamed, which re-creates no row', async () => {
        await interactThenCommit(regrouped(() => 'A'));
        await setOptions(regrouped(() => 'B'));
        expect(rows().length).toBe(WINDOW);
        expect(tabStop()).toBe('lb-option-0');
      });
    });
  });

  describe('activedescendant', () => {
    it('renders the active row past the window, so aria-activedescendant resolves, and scrolls it into view', async () => {
      const scrolled: string[] = [];
      const original = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = function (this: Element) {
        scrolled.push(this.id);
      };
      try {
        await setup({
          options: makeOptions(350),
          focusMode: 'activedescendant',
        });

        fixture.componentRef.setInput('activeIndex', 250);
        await render();

        const row = el.querySelector('#lb-option-250') as HTMLElement | null;
        expect(row?.getAttribute('role')).toBe('option');
        expect(scrolled).toContain('lb-option-250');
      } finally {
        Element.prototype.scrollIntoView = original;
      }
    });
  });

  describe('committed values whose row is not rendered', () => {
    it('keeps an off-window value through aria reconciliation and through a pick (multi)', async () => {
      await setup({
        options: makeOptions(350),
        multiple: true,
        selectedValues: ['v250', 'v3'],
      });
      // aria drops a value with no registered row; the panel must not relay it.
      expect(emitted).toEqual([]);

      rows()[5].click();
      await render();
      expect(emitted.at(-1)).toEqual(['v250', 'v3', 'v5']);

      fixture.componentRef.setInput('selectedValues', ['v250', 'v3', 'v5']);
      await render();
      rows()[3].click();
      await render();
      expect(emitted.at(-1)).toEqual(['v250', 'v5']);
    });

    it('renders a single-select committed row past the window, keeping it the tab stop', async () => {
      await setup({ options: makeOptions(350), selectedValues: ['v250'] });

      const row = el.querySelector('#lb-option-250') as HTMLElement | null;
      expect(row?.getAttribute('aria-selected')).toBe('true');
      expect(row?.getAttribute('tabindex')).toBe('0');
      expect(emitted).toEqual([]);
    });
  });

  describe('axe', () => {
    it('has no violations with a truncated flat list', async () => {
      await setup({ options: makeOptions(350), ariaLabel: 'Options' });
      await expectNoAxeViolations(el);
    });

    it('has no violations with a truncated grouped list', async () => {
      const options = makeOptions(600).map((option, i) => ({
        ...option,
        group: i < 300 ? 'A' : 'B',
      }));
      await setup({ options, ariaLabel: 'Options' });
      await expectNoAxeViolations(el);
    });

    it('has no violations with an activedescendant row past the window', async () => {
      await setup({
        options: makeOptions(350),
        ariaLabel: 'Options',
        focusMode: 'activedescendant',
        activeIndex: 250,
      });
      await expectNoAxeViolations(el);
    });
  });
});

/**
 * `scrollMode="parent"` — how `mlv-select` and `mlv-combobox` compose the
 * panel inside `mlv-popup`: the sentinel's scroll owner is the **wrapping**
 * scrollbar viewport, so that is the box whose layout the window grows from.
 */
@Component({
  selector: 'mlv-window-parent-scroll-host',
  imports: [MlvScrollbar, MlvDropdownPanel],
  template: `
    <mlv-scrollbar>
      <mlv-dropdown-panel
        scrollMode="parent"
        listboxId="lb"
        [options]="options"
        [hasMore]="true"
        (loadMore)="loadMoreCount = loadMoreCount + 1"
      />
    </mlv-scrollbar>
  `,
})
class WindowParentScrollHost {
  readonly options = makeOptions(250);
  loadMoreCount = 0;
}

describe('MlvDropdownPanel — windowed option list in scrollMode="parent" (#318)', () => {
  it('grows from the ancestor scroll owner and pages the source once every option is rendered', async () => {
    await TestBed.configureTestingModule({
      imports: [WindowParentScrollHost],
      providers: [provideMlvI18nTesting(), MlvSelectionService],
    }).compileComponents();
    const fixture = TestBed.createComponent(WindowParentScrollHost);
    const root = fixture.nativeElement as HTMLElement;
    const render = async (): Promise<void> => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };
    const rows = (): number => root.querySelectorAll('[role="option"]').length;
    // The owner is resolved in `afterNextRender`; a second flush rebinds the
    // sentinel to it.
    await render();
    await render();

    const owner = root.querySelector('.mlv-scrollbar__viewport') as HTMLElement;
    Object.defineProperty(owner, 'scrollHeight', {
      get: () => rows() * 10,
      configurable: true,
    });
    Object.defineProperty(owner, 'clientHeight', {
      value: 200,
      configurable: true,
    });
    const scrollNearEnd = async (): Promise<void> => {
      owner.scrollTop = owner.scrollHeight - owner.clientHeight - 50;
      owner.dispatchEvent(new Event('scroll'));
      await render();
    };
    expect(rows()).toBe(WINDOW);

    await scrollNearEnd();
    expect(rows()).toBe(2 * WINDOW);
    await scrollNearEnd();
    expect(rows()).toBe(250);
    expect(fixture.componentInstance.loadMoreCount).toBe(0);

    await scrollNearEnd();
    expect(fixture.componentInstance.loadMoreCount).toBe(1);
    fixture.destroy();
  });
});

/**
 * `scrollMode="parent"` with no `mlv-scrollbar` above the panel: nothing
 * reports scrolling to it, so a window could only ever grow by keyboard.
 */
@Component({
  selector: 'mlv-window-parent-no-owner-host',
  imports: [MlvDropdownPanel],
  template: `
    <div style="overflow: auto; max-height: 200px">
      <mlv-dropdown-panel
        scrollMode="parent"
        listboxId="lb"
        [options]="options"
        [hasMore]="hasMore()"
      />
    </div>
  `,
})
class WindowParentNoOwnerHost {
  readonly options = makeOptions(250);
  readonly hasMore = signal(false);
}

describe('MlvDropdownPanel — scrollMode="parent" with no scroll owner (#318)', () => {
  it('renders every option, as before windowing, and warns only about hasMore', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await TestBed.configureTestingModule({
        imports: [WindowParentNoOwnerHost],
        providers: [provideMlvI18nTesting(), MlvSelectionService],
      }).compileComponents();
      const fixture = TestBed.createComponent(WindowParentNoOwnerHost);
      const root = fixture.nativeElement as HTMLElement;
      const render = async (): Promise<void> => {
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
      };
      // The owner lookup runs in `afterNextRender`.
      await render();
      await render();

      const rows = root.querySelectorAll('[role="option"]');
      expect(rows.length).toBe(250);
      expect(rows[0].hasAttribute('aria-setsize')).toBe(false);
      expect(warn).not.toHaveBeenCalled();

      fixture.componentInstance.hasMore.set(true);
      await render();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toContain('hasMore is set');
      fixture.destroy();
    } finally {
      warn.mockRestore();
    }
  });
});
