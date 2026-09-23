import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvPagination } from './pagination';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

@Component({
  template: `<mlv-pagination [totalItems]="100" />`,
  imports: [MlvPagination],
})
class TestHostComponent {}

describe('MlvPagination', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    await fixture.whenStable();
  });

  it('should create', () => {
    const el = fixture.nativeElement.querySelector('mlv-pagination');
    expect(el).toBeTruthy();
  });

  it('should expose the page navigation as a labelled navigation landmark', () => {
    const nav: HTMLElement | null = fixture.nativeElement.querySelector(
      '[role="navigation"]',
    );
    expect(nav).toBeTruthy();
    expect(nav?.getAttribute('aria-label')).toBe('Pagination');
  });

  describe('items-per-page popover', () => {
    const trigger = (): HTMLButtonElement =>
      fixture.nativeElement.querySelector(
        '.mlv-pagination__items-per-page button',
      ) as HTMLButtonElement;

    const panel = (): HTMLElement | null =>
      document.querySelector('mlv-dropdown-panel');

    const options = (): HTMLElement[] =>
      Array.from(document.querySelectorAll('[role="option"]'));

    afterEach(() => {
      document
        .querySelectorAll('.cdk-overlay-container')
        .forEach((element) => element.remove());
    });

    async function open(): Promise<void> {
      trigger().click();
      fixture.detectChanges();
      await fixture.whenStable();
    }

    it('opens a listbox of the configured page sizes', async () => {
      expect(trigger().getAttribute('aria-haspopup')).toBe('listbox');
      expect(trigger().getAttribute('aria-expanded')).toBe('false');

      await open();

      expect(panel()).not.toBeNull();
      expect(trigger().getAttribute('aria-expanded')).toBe('true');

      // Defaults are [10, 30, 60, 100, Infinity], but the service truncates at
      // the first option that covers the total — 100 items stops at 100 and
      // never offers "all".
      const labels = options().map((option) => option.textContent?.trim());
      expect(labels.length).toBe(4);
      expect(labels[0]).toContain('10');
      expect(labels[3]).toContain('100');
      expect(labels.some((label) => label?.includes('Infinity'))).toBe(false);
    });

    it('marks the active page size as the selected option', async () => {
      await open();

      const selected = options().filter(
        (option) => option.getAttribute('aria-selected') === 'true',
      );

      expect(selected.length).toBe(1);
      expect(selected[0].textContent).toContain('10');
    });

    it('applies the chosen page size and closes', async () => {
      await open();

      // Second option is 30.
      options()[1].click();
      fixture.detectChanges();
      await fixture.whenStable();

      const pagination = fixture.debugElement.children[0]
        .componentInstance as MlvPagination;
      expect(pagination.itemsPerPage()).toBe(30);
      // The overlay element outlives the close until its leave animation ends,
      // which never fires in jsdom — assert the trigger's state instead of the
      // panel's presence.
      expect(trigger().getAttribute('aria-expanded')).toBe('false');
    });

    it('stamps the forwarded density on the detached popup panel', async () => {
      @Component({
        template: `<mlv-pagination [totalItems]="100" mlvDensity="compact" />`,
        imports: [MlvPagination],
      })
      class DenseHostComponent {}

      const dense = TestBed.createComponent(DenseHostComponent);
      await dense.whenStable();
      (
        dense.nativeElement.querySelector(
          '.mlv-pagination__items-per-page button',
        ) as HTMLButtonElement
      ).click();
      dense.detectChanges();
      await dense.whenStable();

      const popupPanel = document.querySelector('.mlv-popup');
      expect(popupPanel).not.toBeNull();
      expect(popupPanel?.classList.contains('mlv--compact')).toBe(true);
    });

    it('points the trigger at the listbox it controls', async () => {
      await open();

      const controls = trigger().getAttribute('aria-controls');
      expect(controls).toBeTruthy();
      expect(document.getElementById(controls as string)).not.toBeNull();
    });
  });

  it('should label the "jump to page" input with an accessible name', () => {
    // 100 items / 10 per page = 10 pages, one past the nine-slot window, so a
    // run is elided and the "…" jump field is rendered.
    const input: HTMLInputElement | null = fixture.nativeElement.querySelector(
      '.mlv-pagination__item--input input',
    );
    expect(input).toBeTruthy();
    expect(input?.getAttribute('aria-label')).toBe('Go to page');
  });

  // The documented input names are the contract consumers copy out of the API
  // table. A doc that names an input the component does not declare produced
  // NG0303 warnings here for months without failing anything, so the exact
  // names are pinned to a rendered effect.
  describe('declared input contract', () => {
    @Component({
      template: `<mlv-pagination
        [totalItems]="totalItems()"
        [(currentPage)]="currentPage"
        [(itemsPerPage)]="itemsPerPage"
        [perPageOptions]="[5, 10, 25, 50]"
      />`,
      imports: [MlvPagination],
    })
    class ContractHostComponent {
      readonly totalItems = signal(50);
      readonly currentPage = signal(1);
      readonly itemsPerPage = signal(10);
    }

    let contract: ComponentFixture<ContractHostComponent>;

    const pageButtonLabels = (): string[] =>
      Array.from(
        contract.nativeElement.querySelectorAll<HTMLButtonElement>(
          '.mlv-pagination__items__container button',
        ),
      ).map((button) => button.textContent?.trim() ?? '');

    beforeEach(async () => {
      contract = TestBed.createComponent(ContractHostComponent);
      await contract.whenStable();
    });

    it('derives the page buttons from totalItems and itemsPerPage', () => {
      // 50 / 10 = 5 pages, inside the nine-slot window, so all are rendered.
      expect(pageButtonLabels()).toEqual(['1', '2', '3', '4', '5']);
    });

    it('repaginates when the itemsPerPage model changes', async () => {
      contract.componentInstance.itemsPerPage.set(25);
      await contract.whenStable();

      expect(pageButtonLabels()).toEqual(['1', '2']);
    });

    it('writes the active page back through the currentPage model', async () => {
      const page3 = contract.nativeElement.querySelectorAll(
        '.mlv-pagination__items__container button',
      )[2] as HTMLButtonElement;
      page3.click();
      await contract.whenStable();

      expect(contract.componentInstance.currentPage()).toBe(3);
      expect(page3.getAttribute('aria-current')).toBe('page');
    });

    it('trims perPageOptions past the first one that covers totalItems', async () => {
      contract.componentInstance.totalItems.set(12);
      await contract.whenStable();

      const trigger = contract.nativeElement.querySelector(
        '.mlv-pagination__items-per-page button',
      ) as HTMLButtonElement;
      trigger.click();
      contract.detectChanges();
      await contract.whenStable();

      const options = Array.from(
        document.querySelectorAll<HTMLElement>(
          '.cdk-overlay-container [role="option"]',
        ),
      ).map((option) => option.textContent?.trim() ?? '');

      // The list is cut after the first option that covers all 12 items, so 25
      // survives as the "show everything" choice and 50 is dropped.
      expect(options).toEqual([
        '5 items per page',
        '10 items per page',
        '25 items per page',
      ]);
    });
  });
});

@Component({
  template: `<mlv-pagination
    [totalItems]="totalItems()"
    [(currentPage)]="currentPage"
    [(itemsPerPage)]="itemsPerPage"
  />`,
  imports: [MlvPagination],
})
class PaginationA11yHost {
  readonly totalItems = signal(500);
  readonly currentPage = signal(6);
  readonly itemsPerPage = signal(10);
}

/**
 * Accessibility sweeps — `mlv-pagination`.
 *
 * The component renders three things worth judging, and they do not all exist
 * at once: a labelled `role="navigation"` landmark that is only present while
 * there is more than one page, an ellipsis slot that becomes a numeric
 * `mlv-input` when the page run is truncated, and an items-per-page listbox
 * that lives in a CDK overlay. So the sweeps cover the many-page rendering, the
 * single-page rendering (where the landmark is gone entirely), and the open
 * popup — the last rooted at `.cdk-overlay-container`, because the panel is
 * portaled out of the fixture and `fixture.nativeElement` holds none of it.
 */
describe('MlvPagination accessibility', () => {
  let a11yFixture: ComponentFixture<PaginationA11yHost>;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [PaginationA11yHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    a11yFixture = TestBed.createComponent(PaginationA11yHost);
    root = a11yFixture.nativeElement as HTMLElement;
    a11yFixture.detectChanges();
    await a11yFixture.whenStable();
  });

  afterEach(() => {
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((element) => element.remove());
  });

  it('has no axe violations for a truncated many-page run', async () => {
    // State: a labelled navigation landmark, exactly one `aria-current="page"`,
    // named prev/next buttons and at least one truncation input.
    const nav = root.querySelector('[role="navigation"]') as HTMLElement;
    expect(nav.getAttribute('aria-label')).toBeTruthy();
    expect(root.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    expect(
      root.querySelectorAll('.mlv-pagination__item--input').length,
    ).toBeGreaterThan(0);

    await expectNoAxeViolations(root);
  });

  it('has no axe violations when a single page removes the navigation', async () => {
    a11yFixture.componentInstance.totalItems.set(5);
    a11yFixture.componentInstance.currentPage.set(1);
    a11yFixture.detectChanges();
    await a11yFixture.whenStable();

    // State: the whole page-button block is gone — with a single page there is
    // no navigation landmark, no prev/next and no page buttons, only the count.
    expect(root.querySelector('[role="navigation"]')).toBeNull();
    expect(root.querySelectorAll('.mlv-pagination__item')).toHaveLength(0);
    expect(root.querySelector('.mlv-pagination__items-count')).not.toBeNull();

    await expectNoAxeViolations(root);
  });

  it('has no axe violations with the items-per-page listbox open', async () => {
    const trigger = root.querySelector(
      '.mlv-pagination__items-per-page button',
    ) as HTMLButtonElement;
    trigger.click();
    a11yFixture.detectChanges();
    await a11yFixture.whenStable();

    // State: the portaled panel, whose listbox and options exist nowhere in
    // the fixture. The trigger's `aria-controls` must resolve to that listbox.
    const container = document.querySelector(
      '.cdk-overlay-container',
    ) as HTMLElement;
    expect(container).not.toBeNull();
    const controls = trigger.getAttribute('aria-controls') as string;
    expect(container.querySelectorAll(`#${controls}`)).toHaveLength(1);
    expect(
      container.querySelectorAll('[role="option"]').length,
    ).toBeGreaterThan(0);
    // The listbox owes an accessible name and the panel invents none — the
    // component has to hand it one.
    expect(
      container.querySelector('[role="listbox"]')?.getAttribute('aria-label'),
    ).toBeTruthy();

    await expectNoAxeViolations(container);
  });
});

@Component({
  template: `<mlv-pagination [totalItems]="100" [(currentPage)]="page" />`,
  imports: [MlvPagination],
})
class KeyboardHostComponent {
  readonly page = signal(4);
}

/**
 * Keyboard activation of the page controls (#299).
 *
 * Every page control is a native `<button>`, so a real browser answers Enter
 * (and Space, on keyup) with a `click` of its own. jsdom synthesises none, so
 * `press()` replays exactly what Chrome dispatches for one trusted key press on
 * a `<button>`: keydown, then the click — unless the keydown was cancelled —
 * then keyup. The controls must count that as **one** activation; they used to
 * count the keydown and the click separately and move two pages.
 */
describe('MlvPagination keyboard activation', () => {
  let fixture: ComponentFixture<KeyboardHostComponent>;

  const navButtons = (): HTMLButtonElement[] =>
    Array.from(
      fixture.nativeElement.querySelectorAll('.mlv-pagination__items > button'),
    );
  const previous = (): HTMLButtonElement => navButtons()[0];
  const next = (): HTMLButtonElement => navButtons()[1];

  function press(button: HTMLButtonElement, key: 'Enter' | ' '): void {
    const keydown = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
    });
    button.dispatchEvent(keydown);
    if (!keydown.defaultPrevented) {
      button.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      );
    }
    button.dispatchEvent(
      new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }),
    );
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KeyboardHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(KeyboardHostComponent);
    await fixture.whenStable();
  });

  it('moves one page forward per Enter on Next', async () => {
    expect(next().getAttribute('aria-label')).toBe('Next page');

    press(next(), 'Enter');
    await fixture.whenStable();

    expect(fixture.componentInstance.page()).toBe(5);
  });

  it('moves one page back per Space on Previous', async () => {
    expect(previous().getAttribute('aria-label')).toBe('Previous page');

    press(previous(), ' ');
    await fixture.whenStable();

    expect(fixture.componentInstance.page()).toBe(3);
  });

  it('never leaves the range from the second-to-last page', async () => {
    fixture.componentInstance.page.set(9);
    await fixture.whenStable();

    press(next(), 'Enter');
    await fixture.whenStable();

    expect(fixture.componentInstance.page()).toBe(10);
    expect(next().disabled).toBe(true);
  });

  it('moves to the pressed page number exactly', async () => {
    const pageSix = Array.from(
      fixture.nativeElement.querySelectorAll(
        '.mlv-pagination__items__container button',
      ) as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.trim() === '6');
    expect(pageSix).toBeDefined();

    press(pageSix as HTMLButtonElement, 'Enter');
    await fixture.whenStable();

    expect(fixture.componentInstance.page()).toBe(6);
  });
});
