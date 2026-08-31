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
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import axe from 'axe-core';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';
import { provideMlvDensity } from '@malva-ui/cdk/density';
import { MlvDataTable } from '@malva-ui/core/data-table';
import { mlvFilterExpressionToFields } from '@malva-ui/core/filter';
// The service/provider contract is static; only locale data is split into lazy packs.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { provideMlvI18n } from '@malva-ui/i18n';
import { ACCOUNT_VIEW_VARIANTS, type Account } from './data-operations.data';
import { DataOperationsShowcaseComponent } from './data-operations';

const MD_QUERY = '(min-width: 768px)';
const LG_QUERY = '(min-width: 1200px)';

@Component({
  selector: 'docs-data-operations-test-host',
  imports: [RouterOutlet],
  template: '<router-outlet />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class DataOperationsTestHostComponent {}

interface RenderedShowcase {
  readonly component: DataOperationsShowcaseComponent;
  readonly root: HTMLElement;
  readonly router: Router;
  readonly harness: RouterTestingHarness;
  readonly viewport: BehaviorSubject<BreakpointState>;
}

function viewportState(tier: 'compact' | 'desktop'): BreakpointState {
  const desktop = tier === 'desktop';
  return {
    matches: desktop,
    breakpoints: {
      [MD_QUERY]: desktop,
      [LG_QUERY]: desktop,
    },
  };
}

async function settle(rendered: RenderedShowcase, delay = 0): Promise<void> {
  rendered.harness.fixture.detectChanges();
  await TestBed.inject(ApplicationRef).whenStable();
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  rendered.harness.fixture.detectChanges();
  await TestBed.inject(ApplicationRef).whenStable();
}

async function settleShowcaseOperation(
  rendered: RenderedShowcase,
): Promise<void> {
  await settle(rendered, 24);
}

async function renderAt(
  url = '/showcases/data-operations?view=at-risk',
  tier: 'compact' | 'desktop' = 'desktop',
): Promise<RenderedShowcase> {
  const viewport = new BehaviorSubject<BreakpointState>(viewportState(tier));

  await TestBed.configureTestingModule({
    providers: [
      provideRouter([
        {
          path: '',
          component: DataOperationsTestHostComponent,
          children: [
            {
              path: 'showcases/data-operations',
              component: DataOperationsShowcaseComponent,
            },
          ],
        },
      ]),
      provideAnimationsAsync('noop'),
      provideMlvDensity('comfortable'),
      provideMlvI18n(() => import('@malva-ui/i18n/en')),
      {
        provide: BreakpointObserver,
        useValue: { observe: () => viewport.asObservable() },
      },
    ],
  }).compileComponents();
  await TestBed.inject(ApplicationInitStatus).donePromise;

  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url);
  const rendered: RenderedShowcase = {
    component: harness.fixture.debugElement.query(
      By.directive(DataOperationsShowcaseComponent),
    ).componentInstance as DataOperationsShowcaseComponent,
    root: harness.fixture.nativeElement as HTMLElement,
    router: TestBed.inject(Router),
    harness,
    viewport,
  };
  await settle(rendered);
  return rendered;
}

function buttonsNamed(
  label: string,
  parent: ParentNode = document,
): HTMLButtonElement[] {
  return Array.from(
    parent.querySelectorAll<HTMLButtonElement>('button'),
  ).filter(
    (button) =>
      button.getAttribute('aria-label')?.trim() === label ||
      button.textContent?.trim() === label,
  );
}

function buttonNamed(
  label: string,
  parent: ParentNode = document,
): HTMLButtonElement {
  const button = buttonsNamed(label, parent)[0];
  if (!button) {
    throw new Error(`Expected button named “${label}”`);
  }
  return button;
}

async function clickButton(
  rendered: RenderedShowcase,
  label: string,
  parent: ParentNode = document,
): Promise<HTMLButtonElement> {
  const button = buttonNamed(label, parent);
  button.click();
  await settle(rendered);
  return button;
}

function menuItem(label: string, parent: ParentNode = document): HTMLElement {
  const item = Array.from(
    parent.querySelectorAll<HTMLElement>('[role="menuitem"]'),
  ).find((candidate) => candidate.textContent?.trim() === label);
  if (!item) {
    throw new Error(`Expected menu item named “${label}”`);
  }
  return item;
}

async function clickMenuItem(
  rendered: RenderedShowcase,
  label: string,
  parent: ParentNode = document,
): Promise<void> {
  menuItem(label, parent).click();
  await settle(rendered);
}

async function setViewport(
  rendered: RenderedShowcase,
  tier: 'compact' | 'desktop',
): Promise<void> {
  rendered.viewport.next(viewportState(tier));
  await settle(rendered);
}

async function typeInAccountSearch(
  rendered: RenderedShowcase,
  value: string,
): Promise<void> {
  const input = rendered.root.querySelector<HTMLInputElement>(
    '.mlv-data-table__search input',
  );
  if (!input) {
    throw new Error('Expected the Data Table-owned account Search field');
  }
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await settle(rendered, 230);
}

async function selectView(
  rendered: RenderedShowcase,
  label: string,
): Promise<void> {
  const row = Array.from(
    document.querySelectorAll<HTMLButtonElement>('.mlv-view-variant-list__row'),
  ).find((button) => button.textContent?.includes(label));
  if (!row) {
    throw new Error(`Expected saved view “${label}”`);
  }
  row.click();
  await settle(rendered);
}

async function clickTableRow(
  rendered: RenderedShowcase,
  accountName: string,
): Promise<HTMLElement> {
  const row = Array.from(
    rendered.root.querySelectorAll<HTMLElement>('.mlv-data-table__row--data'),
  ).find((candidate) => candidate.textContent?.includes(accountName));
  if (!row) {
    throw new Error(`Expected table row for “${accountName}”`);
  }
  row.focus();
  row.click();
  await settle(rendered);
  return row;
}

function finishOverlayAnimations(): void {
  document
    .querySelectorAll<HTMLElement>(
      '.mlv-dialog--leave, .mlv-drawer--leave, .mlv-popup--leave',
    )
    .forEach((element) =>
      element.dispatchEvent(new Event('animationend', { bubbles: true })),
    );
}

async function finishClosing(rendered: RenderedShowcase): Promise<void> {
  await settle(rendered);
  finishOverlayAnimations();
  await settle(rendered);
}

function tableRows(root: ParentNode): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>('.mlv-data-table__row--data'),
  );
}

function currentViewRow(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>(
    '.mlv-view-variant-list__row[aria-current="page"]',
  );
}

describe('DataOperationsShowcaseComponent', () => {
  afterEach(() => {
    finishOverlayAnimations();
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((element) => element.remove());
  });

  it('loads the locked At risk system view into rendered filters and table state', async () => {
    const rendered = await renderAt();

    expect(rendered.component.activeVariant()?.name).toBe('At risk');
    expect(rendered.component.dirty()).toBe(false);
    expect(rendered.root.textContent).toContain(
      'This system view is read-only',
    );
    expect(rendered.root.textContent).toContain('34');
    expect(rendered.component.filterFields().map((field) => field.key)).toEqual(
      ['health', 'renewalDays', 'owner'],
    );
  });

  it('keeps every shipped saved-view expression representable by the public query filter model', () => {
    expect(
      ACCOUNT_VIEW_VARIANTS.map((variant) => ({
        id: variant.id,
        fields: mlvFilterExpressionToFields(variant.state.filterExpression),
      })).filter((entry) => entry.fields === null),
    ).toEqual([]);
  });

  it('uses one responsive Malva Sidebar for Views', async () => {
    const rendered = await renderAt();
    expect(rendered.root.querySelectorAll('mlv-sidebar')).toHaveLength(1);
    expect(rendered.root.querySelector('.mlv-sidebar--flat')).not.toBeNull();

    await setViewport(rendered, 'compact');
    await clickButton(rendered, 'Open navigation menu', rendered.root);
    const dialog = document.querySelector<HTMLElement>(
      '.mlv-drawer[role="dialog"]',
    );
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('My follow-ups');
    dialog?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    await finishClosing(rendered);

    expect(document.querySelector('.mlv-drawer[role="dialog"]')).toBeNull();
    expect(rendered.root.querySelectorAll('mlv-sidebar')).toHaveLength(1);
  });

  it('dismisses compact view navigation after accepted activation and preserves desktop navigation', async () => {
    const rendered = await renderAt(undefined, 'compact');
    const trigger = buttonNamed('Open navigation menu', rendered.root);
    trigger.focus();
    trigger.click();
    await settle(rendered);

    await selectView(rendered, 'My follow-ups');
    expect(rendered.component.activeVariant()?.id).toBe('my-follow-ups');
    expect(document.querySelector('.mlv-drawer--leave')).not.toBeNull();
    await finishClosing(rendered);

    expect(document.querySelector('.mlv-drawer[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    await setViewport(rendered, 'desktop');
    await selectView(rendered, 'All accounts');
    expect(rendered.component.activeVariant()?.id).toBe('all-accounts');
    expect(document.querySelector('.mlv-drawer[role="dialog"]')).toBeNull();

    await setViewport(rendered, 'compact');
    expect(rendered.component.activeVariant()?.id).toBe('all-accounts');
    expect(document.querySelector('.mlv-drawer[role="dialog"]')).toBeNull();
  });

  it('returns focus to the connected Sidebar trigger after compact New view closes', async () => {
    const rendered = await renderAt(undefined, 'compact');
    const trigger = buttonNamed('Open navigation menu', rendered.root);
    trigger.focus();
    trigger.click();
    await settle(rendered);

    const detachedOpener = buttonNamed('New view');
    const detachedOpenerFocus = vi.spyOn(detachedOpener, 'focus');
    detachedOpener.click();
    await settle(rendered);
    expect(document.querySelector('.mlv-drawer--leave')).not.toBeNull();
    await finishClosing(rendered);

    const modals = document.querySelectorAll<HTMLElement>('[role="dialog"]');
    expect(document.querySelector('.mlv-drawer[role="dialog"]')).toBeNull();
    expect(modals).toHaveLength(1);
    expect(modals[0]?.textContent).toContain('Create view');
    expect(document.activeElement?.closest('[role="dialog"]')).toBe(modals[0]);

    await clickButton(rendered, 'Cancel');
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    await finishClosing(rendered);

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(detachedOpener.isConnected).toBe(false);
    expect(detachedOpenerFocus).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
  });

  it('restores desktop Create focus to its visible opener instead of the hidden Sidebar trigger', async () => {
    const rendered = await renderAt();
    const hiddenTrigger = buttonNamed('Collapse sidebar', rendered.root);
    expect(
      hiddenTrigger
        .closest('mlv-sidebar-trigger')
        ?.classList.contains('mlv-sidebar-trigger--hidden'),
    ).toBe(true);
    const hiddenTriggerFocus = vi.spyOn(hiddenTrigger, 'focus');
    const opener = buttonNamed('New view', rendered.root);
    opener.focus();
    const openerFocus = vi.spyOn(opener, 'focus');

    opener.click();
    await settle(rendered);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    await clickButton(rendered, 'Cancel');
    await finishClosing(rendered);

    expect(opener.isConnected).toBe(true);
    expect(openerFocus).toHaveBeenCalledTimes(1);
    expect(hiddenTriggerFocus).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(opener);
  });

  it('restores desktop dirty-confirm focus to its connected row after backdrop dismissal', async () => {
    const rendered = await renderAt();
    await typeInAccountSearch(rendered, 'enterprise');
    const hiddenTrigger = buttonNamed('Collapse sidebar', rendered.root);
    const hiddenTriggerFocus = vi.spyOn(hiddenTrigger, 'focus');
    const opener = Array.from(
      rendered.root.querySelectorAll<HTMLButtonElement>(
        '.mlv-view-variant-list__row',
      ),
    ).find((button) => button.textContent?.includes('My follow-ups'));
    if (!opener) throw new Error('Expected desktop dirty-view opener');
    opener.focus();
    const openerFocus = vi.spyOn(opener, 'focus');

    opener.click();
    await settle(rendered);
    expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();
    document
      .querySelector<HTMLElement>('.mlv-dialog-backdrop')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await finishClosing(rendered);

    expect(rendered.component.activeVariant()?.id).toBe('at-risk');
    expect(opener.isConnected).toBe(true);
    expect(openerFocus).toHaveBeenCalledTimes(1);
    expect(hiddenTriggerFocus).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(opener);
  });

  it('restores a desktop-opened dirty alertdialog to the visible trigger after switching to compact', async () => {
    const rendered = await renderAt();
    await typeInAccountSearch(rendered, 'enterprise');
    const trigger = buttonNamed('Collapse sidebar', rendered.root);
    const triggerFocus = vi.spyOn(trigger, 'focus');
    const opener = Array.from(
      rendered.root.querySelectorAll<HTMLButtonElement>(
        '.mlv-view-variant-list__row',
      ),
    ).find((button) => button.textContent?.includes('My follow-ups'));
    if (!opener) throw new Error('Expected desktop dirty-view opener');
    opener.focus();
    const openerFocus = vi.spyOn(opener, 'focus');

    opener.click();
    await settle(rendered);
    expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();
    await setViewport(rendered, 'compact');

    expect(opener.isConnected).toBe(false);
    expect(buttonNamed('Open navigation menu', rendered.root)).toBe(trigger);
    expect(
      trigger
        .closest('mlv-sidebar-trigger')
        ?.classList.contains('mlv-sidebar-trigger--hidden'),
    ).toBe(false);
    document
      .querySelector<HTMLElement>('.mlv-dialog-backdrop')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await finishClosing(rendered);

    expect(openerFocus).not.toHaveBeenCalled();
    expect(triggerFocus).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(trigger);
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it('restores a compact-opened Create dialog to its reconnected opener after switching to desktop', async () => {
    const rendered = await renderAt(undefined, 'compact');
    const trigger = buttonNamed('Open navigation menu', rendered.root);
    trigger.focus();
    trigger.click();
    await settle(rendered);
    const triggerFocus = vi.spyOn(trigger, 'focus');
    const opener = buttonNamed('New view');
    opener.focus();
    const openerFocus = vi.spyOn(opener, 'focus');

    opener.click();
    await settle(rendered);
    expect(document.querySelector('.mlv-drawer--leave')).not.toBeNull();
    await finishClosing(rendered);
    expect(opener.isConnected).toBe(false);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.activeElement?.closest('[role="dialog"]')).not.toBeNull();
    triggerFocus.mockClear();

    await setViewport(rendered, 'desktop');
    expect(opener.isConnected).toBe(true);
    expect(buttonNamed('New view', rendered.root)).toBe(opener);
    expect(
      trigger
        .closest('mlv-sidebar-trigger')
        ?.classList.contains('mlv-sidebar-trigger--hidden'),
    ).toBe(true);
    expect(triggerFocus).not.toHaveBeenCalled();
    await clickButton(rendered, 'Cancel');
    await finishClosing(rendered);

    expect(openerFocus).toHaveBeenCalledTimes(1);
    expect(triggerFocus).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(opener);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('uses Data Table-owned Search, Sort, and Columns exactly once', async () => {
    const rendered = await renderAt();
    expect(
      rendered.root.querySelectorAll('.mlv-data-table__toolbar'),
    ).toHaveLength(1);
    expect(
      rendered.root.querySelectorAll('.mlv-data-table__search'),
    ).toHaveLength(1);
    expect(
      rendered.root.querySelectorAll('.mlv-smart-filter-bar__query-search'),
    ).toHaveLength(0);
    expect(
      rendered.root.querySelectorAll('[data-mlv-table-sort-trigger]'),
    ).toHaveLength(1);
    expect(buttonsNamed('Columns', rendered.root)).toHaveLength(1);

    await typeInAccountSearch(rendered, 'acme');
    await clickButton(rendered, 'Sort', rendered.root);
    const sortMenu = document.querySelector<HTMLElement>(
      '[role="menu"][aria-label="Sort rows"]',
    );
    expect(sortMenu).not.toBeNull();
    await clickMenuItem(rendered, 'Renewal date', sortMenu ?? document);
    const directionMenu = Array.from(
      document.querySelectorAll<HTMLElement>('[role="menu"]'),
    ).find((menu) => menu.getAttribute('aria-label')?.includes('Renewal date'));
    expect(directionMenu).not.toBeNull();
    await clickMenuItem(rendered, 'Descending', directionMenu ?? document);

    await clickButton(rendered, 'Columns', rendered.root);
    const owner = document.querySelector<HTMLInputElement>(
      '.mlv-data-table__columns-dropdown input[aria-label="Owner"]',
    );
    expect(owner).not.toBeNull();
    owner?.click();
    await settle(rendered);

    expect(rendered.component.dirty()).toBe(true);
  });

  it('passes expression-filtered rows to Data Table and leaves normalized Search evaluation to the table', async () => {
    const rendered = await renderAt();
    await selectView(rendered, 'Enterprise renewals');
    const cafeAccount: Account = {
      ...rendered.component.accounts()[0],
      id: 'cafe-analytics',
      name: 'Café Analytics',
    };
    rendered.component.accounts.update((accounts) => [
      ...accounts,
      cafeAccount,
    ]);
    await settle(rendered);

    const table = rendered.harness.fixture.debugElement.query(
      By.directive(MlvDataTable),
    ).componentInstance as MlvDataTable;
    expect(table.data()).toHaveLength(17);
    expect(table.data()).toEqual(
      rendered.component.expressionFilteredAccounts(),
    );

    await typeInAccountSearch(rendered, 'CAFE');

    expect(table.data()).toHaveLength(17);
    expect(tableRows(rendered.root)).toHaveLength(1);
    expect(tableRows(rendered.root)[0]?.textContent).toContain(
      'Café Analytics',
    );
  });

  it('opens one responsive details pane and clears selection on Escape', async () => {
    const rendered = await renderAt();
    await clickTableRow(rendered, 'Acme Corporation');
    expect(
      rendered.root.querySelectorAll('[data-account-details]'),
    ).toHaveLength(1);

    await setViewport(rendered, 'compact');
    expect(document.querySelectorAll('[data-account-details]')).toHaveLength(1);
    const dialog = document.querySelector<HTMLElement>(
      '[role="dialog"][aria-label="Account details"]',
    );
    expect(dialog).not.toBeNull();
    dialog?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    await finishClosing(rendered);

    expect(rendered.component.selectedAccount()).toBeNull();
    expect(document.querySelector('[data-account-details]')).toBeNull();
  });

  it('keeps exactly one details content instance across both breakpoint directions', async () => {
    const rendered = await renderAt(undefined, 'compact');
    await clickTableRow(rendered, 'Acme Corporation');
    expect(document.querySelectorAll('[data-account-details]')).toHaveLength(1);
    expect(
      document.querySelector('[role="dialog"][aria-label="Account details"]'),
    ).not.toBeNull();

    await setViewport(rendered, 'desktop');
    expect(document.querySelectorAll('[data-account-details]')).toHaveLength(1);
    expect(
      document.querySelector('[role="dialog"][aria-label="Account details"]'),
    ).toBeNull();
    expect(
      rendered.root.querySelector('aside[aria-label="Account details"]'),
    ).not.toBeNull();

    await setViewport(rendered, 'compact');
    expect(document.querySelectorAll('[data-account-details]')).toHaveLength(1);
    expect(rendered.component.selectedAccount()?.name).toBe('Acme Corporation');
  });

  it('does not expose unsupported saved-view actions', async () => {
    const rendered = await renderAt();
    await selectView(rendered, 'My follow-ups');

    expect(currentViewRow()?.textContent).toContain('My follow-ups');
    expect(buttonsNamed('More actions for My follow-ups')).toHaveLength(0);
    expect(
      Array.from(document.querySelectorAll('[role="menuitem"]')).some((item) =>
        ['Rename', 'Share', 'Delete'].includes(item.textContent?.trim() ?? ''),
      ),
    ).toBe(false);
  });

  it('clears optional filters instead of restoring the saved baseline', async () => {
    const rendered = await renderAt();
    await typeInAccountSearch(rendered, 'does-not-exist');
    await clickButton(rendered, 'Clear filters', rendered.root);

    expect(rendered.component.filterFields()).toEqual([]);
    expect(rendered.component.filterExpression()).toEqual({
      kind: 'group',
      combinator: 'and',
      children: [],
    });
    expect(rendered.component.dirty()).toBe(true);
  });

  it('cancels a dirty view switch through the rendered dialog', async () => {
    const rendered = await renderAt();
    await typeInAccountSearch(rendered, 'enterprise');
    await selectView(rendered, 'My follow-ups');
    expect(rendered.component.activeVariant()?.id).toBe('at-risk');
    expect(currentViewRow()?.textContent).toContain('At risk');
    expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();

    await clickButton(rendered, 'Cancel');
    await finishClosing(rendered);
    expect(rendered.component.activeVariant()?.id).toBe('at-risk');
    expect(rendered.component.pendingVariantId()).toBeNull();
    expect(currentViewRow()?.textContent).toContain('At risk');

    await selectView(rendered, 'My follow-ups');
    expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();
  });

  it('keeps compact dirty-confirm focus in one alert dialog, then returns it to the external trigger', async () => {
    const rendered = await renderAt(undefined, 'compact');
    await typeInAccountSearch(rendered, 'enterprise');
    const trigger = buttonNamed('Open navigation menu', rendered.root);
    trigger.focus();
    trigger.click();
    await settle(rendered);

    const detachedOpener = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        '.mlv-view-variant-list__row',
      ),
    ).find((button) => button.textContent?.includes('My follow-ups'));
    if (!detachedOpener) throw new Error('Expected compact dirty-view opener');
    const detachedOpenerFocus = vi.spyOn(detachedOpener, 'focus');
    detachedOpener.click();
    await settle(rendered);
    await finishClosing(rendered);

    const modals = document.querySelectorAll<HTMLElement>(
      '[role="dialog"], [role="alertdialog"]',
    );
    expect(modals).toHaveLength(1);
    expect(modals[0]?.getAttribute('role')).toBe('alertdialog');
    expect(modals[0]?.textContent).toContain('Save view changes?');
    expect(document.activeElement?.closest('[role="alertdialog"]')).toBe(
      modals[0],
    );

    document
      .querySelector<HTMLElement>('.mlv-dialog-backdrop')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle(rendered);
    expect(
      document.querySelectorAll('[role="dialog"], [role="alertdialog"]'),
    ).toHaveLength(1);
    await finishClosing(rendered);

    expect(rendered.component.activeVariant()?.id).toBe('at-risk');
    expect(detachedOpener.isConnected).toBe(false);
    expect(detachedOpenerFocus).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
    expect(
      document.querySelector('[role="dialog"], [role="alertdialog"]'),
    ).toBeNull();

    trigger.click();
    await settle(rendered);
    expect(currentViewRow()?.textContent).toContain('At risk');
    document
      .querySelector<HTMLElement>('.mlv-drawer[role="dialog"]')
      ?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    await finishClosing(rendered);
    expect(document.activeElement).toBe(trigger);
  });

  it('discards a dirty view switch through the rendered dialog', async () => {
    const rendered = await renderAt();
    await typeInAccountSearch(rendered, 'enterprise');
    await selectView(rendered, 'My follow-ups');
    await clickButton(rendered, 'Discard changes');
    await finishClosing(rendered);
    expect(rendered.component.activeVariant()?.id).toBe('my-follow-ups');
    expect(rendered.component.dirty()).toBe(false);
  });

  it('cancels and saves create requests through a rendered dialog', async () => {
    const rendered = await renderAt();
    const initialCount = rendered.component.variants().length;
    await clickButton(rendered, 'New view', rendered.root);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    await clickButton(rendered, 'Cancel');
    await finishClosing(rendered);
    expect(rendered.component.variants()).toHaveLength(initialCount);

    await clickButton(rendered, 'New view', rendered.root);
    await clickButton(rendered, 'Save view');
    await finishClosing(rendered);
    await settleShowcaseOperation(rendered);
    expect(rendered.component.variants()).toHaveLength(initialCount + 1);
    expect(rendered.component.activeVariant()?.scope).toBe('personal');
    expect(rendered.component.dirty()).toBe(false);
  });

  it('duplicates and updates views through rendered status actions', async () => {
    const rendered = await renderAt();
    await typeInAccountSearch(rendered, 'enterprise');
    await clickButton(rendered, 'Duplicate view', rendered.root);
    await settleShowcaseOperation(rendered);
    expect(rendered.component.activeVariant()?.name).toBe('At risk copy');
    expect(rendered.component.dirty()).toBe(false);

    await typeInAccountSearch(rendered, 'acme');
    await clickButton(rendered, 'Update view', rendered.root);
    await settleShowcaseOperation(rendered);
    expect(rendered.component.activeVariant()?.updatedAt).toBe('Just now');
    expect(rendered.component.dirty()).toBe(false);
  });

  it('retries and dismisses simulated persistence failures through rendered actions', async () => {
    const rendered = await renderAt(
      '/showcases/data-operations?view=my-follow-ups',
    );
    await typeInAccountSearch(rendered, 'acme');
    rendered.component.failNextOperation.set(true);
    await clickButton(rendered, 'Update view', rendered.root);
    await settleShowcaseOperation(rendered);
    expect(rendered.component.operationError()).toContain(
      'could not be updated',
    );

    await clickButton(rendered, 'Retry', rendered.root);
    await settleShowcaseOperation(rendered);
    expect(rendered.component.operationError()).toBeNull();
    expect(rendered.component.dirty()).toBe(false);

    await typeInAccountSearch(rendered, 'northwind');
    rendered.component.failNextOperation.set(true);
    await clickButton(rendered, 'Update view', rendered.root);
    await settleShowcaseOperation(rendered);
    await clickButton(rendered, 'Dismiss', rendered.root);
    expect(rendered.component.operationError()).toBeNull();
    expect(rendered.component.dirty()).toBe(true);
  });

  it('runs import from the account menu and Export from the Data Table toolbar slot', async () => {
    const rendered = await renderAt();
    const initialCount = rendered.component.accounts().length;
    await clickButton(rendered, 'More account actions', rendered.root);
    await clickMenuItem(rendered, 'Import accounts');
    expect(rendered.component.accounts()).toHaveLength(initialCount + 1);
    expect(rendered.component.exportStatus()).toContain('Imported account');

    await clickButton(rendered, 'Export', rendered.root);
    expect(rendered.component.exportStatus()).toContain('accounts for export');
    const toolbar = rendered.root.querySelector('.mlv-data-table__toolbar');
    expect(toolbar?.querySelectorAll('button')).not.toHaveLength(0);
    expect(buttonsNamed('Export', toolbar ?? rendered.root)).toHaveLength(1);
  });

  it('dismisses the real dirty-switch dialog backdrop without changing views', async () => {
    const rendered = await renderAt();
    await typeInAccountSearch(rendered, 'enterprise');
    await selectView(rendered, 'My follow-ups');

    document.querySelector<HTMLElement>('.cdk-overlay-backdrop')?.click();
    await finishClosing(rendered);

    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(rendered.component.activeVariant()?.id).toBe('at-risk');
    expect(rendered.component.pendingVariantId()).toBeNull();
    expect(currentViewRow()?.textContent).toContain('At risk');

    await selectView(rendered, 'My follow-ups');
    expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();
  });

  it('restores focus to the activated row after closing account details', async () => {
    const rendered = await renderAt();
    const row = await clickTableRow(rendered, 'Acme Corporation');
    await clickButton(rendered, 'Close account details', rendered.root);
    await settle(rendered);

    expect(rendered.component.selectedAccount()).toBeNull();
    expect(document.activeElement).toBe(row);
  });

  it('renders rows in saved sort order and applies Sort menu choices', async () => {
    const rendered = await renderAt();
    expect(tableRows(rendered.root)[0]?.textContent).toContain(
      'Acme Corporation',
    );

    await clickButton(rendered, 'Sort', rendered.root);
    const rootMenu = document.querySelector<HTMLElement>(
      '[role="menu"][aria-label="Sort rows"]',
    );
    await clickMenuItem(rendered, 'ARR', rootMenu ?? document);

    expect(rendered.component.tableState().sort).toEqual({
      key: 'arr',
      direction: 'asc',
    });
    // The active At risk view only surfaces unowned, at-risk accounts renewing
    // within 60 days, so ARR ascending orders its three rows 82k → 245k → 275k.
    const sortedRows = tableRows(rendered.root);
    expect(sortedRows).toHaveLength(3);
    expect(sortedRows[0]?.textContent).toContain('Initech');
    expect(sortedRows[0]?.textContent).toContain('$82,000');
    expect(sortedRows[1]?.textContent).toContain('Acme Corporation');
    expect(sortedRows[2]?.textContent).toContain('Wayne Enterprises');
  });

  it('keeps pagination interactive for the complete account fixture', async () => {
    const rendered = await renderAt();
    await selectView(rendered, 'All accounts');
    expect(tableRows(rendered.root)).toHaveLength(25);

    await clickButton(rendered, 'Next page', rendered.root);
    expect(tableRows(rendered.root)).toHaveLength(9);
    expect(tableRows(rendered.root)[0]?.textContent).toContain('Fabrikam');
  });

  it('adds deterministic accounts through the rendered primary action', async () => {
    const rendered = await renderAt();
    const initialCount = rendered.component.accounts().length;

    await clickButton(rendered, 'Add account', rendered.root);

    expect(rendered.component.accounts()).toHaveLength(initialCount + 1);
    expect(rendered.component.accounts().at(-1)?.name).toBe('New account 35');
  });

  it('does not let a completed clone hijack a later view selection', async () => {
    const rendered = await renderAt();
    rendered.component.search.set('enterprise');
    rendered.component.duplicateActiveView();
    rendered.component.selectVariant('my-follow-ups');
    rendered.component.search.set('Acme');
    await settleShowcaseOperation(rendered);

    expect(rendered.component.activeVariant()?.id).toBe('my-follow-ups');
    expect(rendered.component.dirty()).toBe(true);
    expect(rendered.router.url).toContain('view=my-follow-ups');
  });

  it('restores a valid saved view from the URL', async () => {
    const rendered = await renderAt(
      '/showcases/data-operations?view=my-follow-ups',
    );
    expect(rendered.component.activeVariant()?.id).toBe('my-follow-ups');
  });

  it('replaces an unknown view with the At risk default', async () => {
    const rendered = await renderAt('/showcases/data-operations?view=missing');
    expect(rendered.component.activeVariant()?.id).toBe('at-risk');
    expect(rendered.router.url).toBe('/showcases/data-operations?view=at-risk');
  });

  it('writes selection to the URL without adding a history entry', async () => {
    const rendered = await renderAt();
    const navigate = vi.spyOn(rendered.router, 'navigate');
    rendered.component.selectVariant('my-follow-ups');

    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { view: 'my-follow-ups' },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      }),
    );
  });

  it('keeps the default, dirty controls, and compact details overlay axe-clean', async () => {
    const rendered = await renderAt();
    const runAxe = async (
      context: Element | DocumentFragment = rendered.root,
    ) =>
      axe.run(context, {
        rules: {
          'color-contrast': { enabled: false },
        },
      });

    expect((await runAxe()).violations).toEqual([]);
    await typeInAccountSearch(rendered, 'enterprise');
    await clickButton(rendered, 'Sort', rendered.root);
    const overlayContainer = document.querySelector<HTMLElement>(
      '.cdk-overlay-container',
    );
    expect(overlayContainer).not.toBeNull();
    expect(
      (await runAxe(overlayContainer ?? rendered.root)).violations,
    ).toEqual([]);

    document
      .querySelector<HTMLElement>('[role="menu"]')
      ?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    await finishClosing(rendered);
    await clickTableRow(rendered, 'Acme Corporation');
    await setViewport(rendered, 'compact');
    expect((await runAxe(rendered.root)).violations).toEqual([]);
    expect(
      (await runAxe(overlayContainer ?? rendered.root)).violations,
    ).toEqual([]);
  });
});
