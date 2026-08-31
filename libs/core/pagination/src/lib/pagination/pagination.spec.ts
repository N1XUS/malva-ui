import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
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
