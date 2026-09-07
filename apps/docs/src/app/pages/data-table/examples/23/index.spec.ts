import { OverlayContainer } from '@angular/cdk/overlay';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import DataTableToolbarExampleComponent from './index';

function buttonNamed(scope: ParentNode, name: string): HTMLButtonElement {
  const button = Array.from(
    scope.querySelectorAll<HTMLButtonElement>('button'),
  ).find(
    (candidate) =>
      candidate.textContent?.trim() === name ||
      candidate.getAttribute('aria-label') === name,
  );
  if (!button) throw new Error(`Expected button named "${name}".`);
  return button;
}

function menuPanel(scope: ParentNode, label: string): HTMLElement {
  const panel = Array.from(
    scope.querySelectorAll<HTMLElement>('[role="menu"]'),
  ).find((candidate) => candidate.getAttribute('aria-label') === label);
  if (!panel) throw new Error(`Expected menu panel "${label}".`);
  return panel;
}

function menuItem(scope: ParentNode, name: string): HTMLElement {
  const item = Array.from(
    scope.querySelectorAll<HTMLElement>('[role="menuitem"]'),
  ).find((candidate) => candidate.textContent?.trim() === name);
  if (!item) throw new Error(`Expected menu item "${name}".`);
  return item;
}

function dispatchKey(target: HTMLElement, key: string, keyCode?: number): void {
  const event = new KeyboardEvent('keydown', { key, bubbles: true });
  if (keyCode !== undefined) {
    Object.defineProperty(event, 'keyCode', { value: keyCode });
  }
  target.dispatchEvent(event);
}

describe('DataTableToolbarExampleComponent', () => {
  it('proves the rendered Search, Sort, Columns, and Export composition', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [DataTableToolbarExampleComponent],
      providers: [provideMlvI18nTesting()],
    }).createComponent(DataTableToolbarExampleComponent);
    const overlayContainer = TestBed.inject(OverlayContainer);
    const overlay = overlayContainer.getContainerElement();
    const host = fixture.nativeElement as HTMLElement;
    const component = fixture.componentInstance;

    fixture.detectChanges();

    const toolbar = host.querySelector(
      '.mlv-data-table__toolbar',
    ) as HTMLElement;
    const search = toolbar.querySelector(
      'input[aria-label="Search rows"]',
    ) as HTMLInputElement | null;
    if (!search) throw new Error('Expected the rendered Search field.');
    expect(toolbar.querySelectorAll('button')).not.toHaveLength(0);
    expect(buttonNamed(toolbar, 'Sort rows')).toBeTruthy();
    expect(buttonNamed(toolbar, 'Toggle column visibility')).toBeTruthy();
    expect(buttonNamed(toolbar, 'Export')).toBeTruthy();
    expect(host.querySelectorAll('.mlv-data-table__toolbar')).toHaveLength(1);

    search.value = 'Acme';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 250));
    fixture.detectChanges();

    expect(component.query()).toBe('Acme');
    expect(
      Array.from(
        host.querySelectorAll<HTMLTableRowElement>(
          '.mlv-data-table__row--data',
        ),
      ).map((row) => row.textContent),
    ).toEqual([expect.stringContaining('Acme')]);

    search.value = '';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 250));
    fixture.detectChanges();
    expect(component.query()).toBe('');

    buttonNamed(host, 'Sort rows').click();
    fixture.detectChanges();
    await fixture.whenStable();
    const amount = menuItem(menuPanel(overlay, 'Sort rows'), 'Amount');
    amount.click();
    fixture.detectChanges();

    expect(component.lastState()?.sort).toEqual({
      key: 'amount',
      direction: 'asc',
    });

    overlay
      .querySelectorAll('.mlv-popup--leave')
      .forEach((panel) =>
        panel.dispatchEvent(new Event('animationend', { bubbles: true })),
      );
    fixture.detectChanges();
    await fixture.whenStable();

    const sortTrigger = buttonNamed(host, 'Sort rows');
    sortTrigger.focus();
    dispatchKey(sortTrigger, 'ArrowDown');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const rootPanel = menuPanel(overlay, 'Sort rows');
    dispatchKey(rootPanel, 'ArrowDown', 40);
    const activeAmount = menuItem(rootPanel, 'Amount');
    expect(document.activeElement).toBe(activeAmount);

    dispatchKey(activeAmount, 'Enter');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));

    let directionPanel = menuPanel(overlay, 'Sort by Amount');
    expect(rootPanel.closest('.mlv-popup--leave')).toBeNull();
    expect(document.activeElement).toBe(menuItem(directionPanel, 'Ascending'));
    await expectNoAxeViolations(overlay);

    dispatchKey(directionPanel, 'Escape');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(activeAmount);
    expect(rootPanel.closest('.mlv-popup--leave')).toBeNull();
    directionPanel
      .closest('.mlv-popup--leave')
      ?.dispatchEvent(new Event('animationend', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    dispatchKey(activeAmount, ' ');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    directionPanel = menuPanel(overlay, 'Sort by Amount');
    const ascending = menuItem(directionPanel, 'Ascending');
    expect(document.activeElement).toBe(ascending);
    const descending = menuItem(directionPanel, 'Descending');
    descending.click();
    fixture.detectChanges();

    expect(component.lastState()?.sort).toEqual({
      key: 'amount',
      direction: 'desc',
    });

    const renderedRows = Array.from(
      host.querySelectorAll<HTMLTableRowElement>('.mlv-data-table__row--data'),
    );
    expect(renderedRows[0].textContent).toContain('Acme');
    expect(
      host
        .querySelector('[data-mlv-column-key="amount"]')
        ?.getAttribute('aria-sort'),
    ).toBe('descending');

    overlay
      .querySelectorAll('.mlv-popup--leave')
      .forEach((panel) =>
        panel.dispatchEvent(new Event('animationend', { bubbles: true })),
      );
    fixture.detectChanges();
    await fixture.whenStable();

    sortTrigger.focus();
    dispatchKey(sortTrigger, 'ArrowDown');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const escapePanel = menuPanel(overlay, 'Sort rows');
    dispatchKey(escapePanel, 'Escape');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(sortTrigger);

    overlay
      .querySelectorAll('.mlv-popup--leave')
      .forEach((panel) =>
        panel.dispatchEvent(new Event('animationend', { bubbles: true })),
      );
    fixture.detectChanges();
    await fixture.whenStable();

    buttonNamed(host, 'Toggle column visibility').click();
    fixture.detectChanges();
    await fixture.whenStable();
    await expectNoAxeViolations(overlay);
    const statusControl = Array.from(
      overlay.querySelectorAll<HTMLElement>('.mlv-data-table__columns-item'),
    )
      .find((item) => item.textContent?.includes('Status'))
      ?.querySelector<HTMLInputElement>('.mlv-checkbox__native');
    if (!statusControl)
      throw new Error('Expected the Status visibility toggle.');
    expect(statusControl.getAttribute('aria-label')).toBe('Status');
    statusControl.click();
    fixture.detectChanges();

    expect(host.querySelector('[data-mlv-column-key="status"]')).toBeNull();
    expect(component.lastState()).toMatchObject({
      sort: { key: 'amount', direction: 'desc' },
      visibleColumnKeys: ['customer', 'amount'],
    });

    buttonNamed(host, 'Export').click();
    fixture.detectChanges();
    expect(component.exportMessage()).toBe('Prepared 3 orders for export.');
    expect(host.textContent).toContain('Prepared 3 orders for export.');
    await expectNoAxeViolations(host);

    buttonNamed(host, 'Toggle column visibility').click();
    fixture.detectChanges();
    await fixture.whenStable();
    overlay
      .querySelectorAll('.mlv-popup--leave')
      .forEach((panel) =>
        panel.dispatchEvent(new Event('animationend', { bubbles: true })),
      );
    fixture.detectChanges();
    await fixture.whenStable();
    overlayContainer.ngOnDestroy();
  });
});
