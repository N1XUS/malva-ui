import { OverlayContainer } from '@angular/cdk/overlay';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvViewVariantList, type MlvViewVariant } from '../../index';

type ViewState = Readonly<{ search: string }>;

const variants: readonly MlvViewVariant<ViewState>[] = [
  {
    id: 'system',
    name: 'Café operations',
    scope: 'system',
    state: { search: 'risk' },
    locked: true,
    resultCount: 12,
    capabilities: {
      clone: true,
      update: false,
      rename: false,
      delete: false,
      share: false,
    },
  },
  {
    id: 'team',
    name: 'Renewal watch',
    scope: 'team',
    state: { search: 'renewal' },
    capabilities: {
      clone: true,
      update: true,
      rename: true,
      delete: false,
      share: true,
    },
  },
  {
    id: 'personal',
    name: 'My accounts',
    scope: 'personal',
    state: { search: 'accounts' },
    capabilities: {
      clone: true,
      update: true,
      rename: true,
      delete: true,
      share: true,
    },
  },
];

describe('MlvViewVariantList', () => {
  let component: MlvViewVariantList<ViewState>;
  let fixture: ComponentFixture<MlvViewVariantList<ViewState>>;
  let host: HTMLElement;
  let overlay: HTMLElement;
  let overlayContainer: OverlayContainer;

  const buttonNamed = (name: string): HTMLButtonElement | undefined =>
    [...host.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.trim() === name,
    );

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvViewVariantList],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvViewVariantList<ViewState>);
    component = fixture.componentInstance;
    host = fixture.nativeElement as HTMLElement;
    overlayContainer = TestBed.inject(OverlayContainer);
    overlay = overlayContainer.getContainerElement();
    fixture.componentRef.setInput('variants', variants);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(async () => {
    const openTrigger = host.querySelector<HTMLElement>(
      '[aria-expanded="true"]',
    );
    openTrigger?.click();
    fixture.detectChanges();
    await finishMenuClose();
    overlayContainer.ngOnDestroy();
  });

  async function openOverflowMenu(name: string): Promise<HTMLElement> {
    const trigger = host.querySelector<HTMLButtonElement>(
      `[aria-label="More actions for ${name}"]`,
    );
    trigger?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    return overlay.querySelector<HTMLElement>(
      `[role="menu"][aria-label="Actions for ${name}"]`,
    ) as HTMLElement;
  }

  function menuItem(menu: HTMLElement, label: string): HTMLElement {
    return [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
      (item) => item.textContent?.trim() === label,
    ) as HTMLElement;
  }

  async function finishMenuClose(): Promise<void> {
    overlay
      .querySelector<HTMLElement>('.mlv-popup--leave')
      ?.dispatchEvent(new Event('animationend', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('groups variants as System, Team, and My views in stable order', () => {
    const headings = [
      ...host.querySelectorAll('.mlv-view-variant-list__group-title'),
    ];

    expect(headings.map((node) => node.textContent?.trim())).toEqual([
      'System',
      'Team',
      'My views',
    ]);
  });

  it('filters view names with a diacritic-insensitive local query', () => {
    component.query.set('cafe');
    fixture.detectChanges();

    expect(host.textContent).toContain('Café operations');
    expect(host.textContent).not.toContain('Renewal watch');
    expect(host.textContent).not.toContain('My accounts');
  });

  it('hides New view when creation is not permitted', () => {
    fixture.componentRef.setInput('canCreate', false);
    fixture.detectChanges();

    expect(buttonNamed('New view')).toBeUndefined();
  });

  it('emits selection before writing its active-id model', () => {
    const selected: Array<{ id: string; activeId: string | null }> = [];
    component.variantSelect.subscribe((variant) => {
      selected.push({ id: variant.id, activeId: component.activeId() });
    });

    buttonNamed('Renewal watch')?.click();
    fixture.detectChanges();

    expect(selected).toEqual([{ id: 'team', activeId: null }]);
    expect(component.activeId()).toBe('team');
  });

  it('defers active-id writes when selection acceptance is controlled by the host', () => {
    component.activeId.set('system');
    fixture.componentRef.setInput('deferSelection', true);
    fixture.detectChanges();
    const selected = vi.fn();
    component.variantSelect.subscribe(selected);

    buttonNamed('Renewal watch')?.click();
    fixture.detectChanges();
    buttonNamed('Renewal watch')?.click();
    fixture.detectChanges();

    expect(selected).toHaveBeenCalledTimes(2);
    expect(selected).toHaveBeenNthCalledWith(1, variants[1]);
    expect(component.activeId()).toBe('system');
    expect(
      host.querySelector<HTMLButtonElement>('[aria-current="page"]')
        ?.textContent,
    ).toContain('Café operations');

    host.querySelector<HTMLButtonElement>('[aria-current="page"]')?.click();
    fixture.detectChanges();
    expect(selected).toHaveBeenCalledTimes(2);
  });

  it('does not emit or rewrite the active model when the active row is re-clicked', () => {
    component.activeId.set('team');
    fixture.detectChanges();
    const selected = vi.fn();
    component.variantSelect.subscribe(selected);

    host.querySelector<HTMLButtonElement>('[aria-current="page"]')?.click();
    fixture.detectChanges();

    expect(selected).not.toHaveBeenCalled();
    expect(component.activeId()).toBe('team');
  });

  it('marks the active row as the current page and exposes locked rows as read-only', () => {
    component.activeId.set('system');
    fixture.detectChanges();

    const selected = host.querySelector<HTMLButtonElement>(
      '.mlv-view-variant-list__row',
    );
    expect(selected?.getAttribute('aria-current')).toBe('page');
    expect(selected?.textContent).toContain('Read-only');
    expect(
      host.querySelector('.mlv-view-variant-list__count')?.textContent?.trim(),
    ).toBe('12');
  });

  it('emits only the configured creation scope', () => {
    const requests: string[] = [];
    fixture.componentRef.setInput('canCreate', true);
    fixture.detectChanges();
    component.createRequest.subscribe((scope) => requests.push(scope));

    buttonNamed('New view')?.click();

    expect(requests).toEqual(['personal']);
  });

  it('opens the real overflow menu and emits permitted rename, share, and delete payloads', async () => {
    const renamed: MlvViewVariant<ViewState>[] = [];
    const shared: MlvViewVariant<ViewState>[] = [];
    const deleted: MlvViewVariant<ViewState>[] = [];
    component.renameRequest.subscribe((variant) => renamed.push(variant));
    component.shareRequest.subscribe((variant) => shared.push(variant));
    component.deleteRequest.subscribe((variant) => deleted.push(variant));

    let menu = await openOverflowMenu('My accounts');
    menuItem(menu, 'Rename').click();
    fixture.detectChanges();
    await finishMenuClose();

    menu = await openOverflowMenu('My accounts');
    menuItem(menu, 'Share').click();
    fixture.detectChanges();
    await finishMenuClose();

    menu = await openOverflowMenu('My accounts');
    menuItem(menu, 'Delete').click();
    fixture.detectChanges();
    await finishMenuClose();

    expect(renamed).toEqual([variants[2]]);
    expect(shared).toEqual([variants[2]]);
    expect(deleted).toEqual([variants[2]]);
  });

  it('omits denied actions from the opened overflow menu', async () => {
    const deleted = vi.fn();
    component.deleteRequest.subscribe(deleted);

    const menu = await openOverflowMenu('Renewal watch');

    expect(
      [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')].map((item) =>
        item.textContent?.trim(),
      ),
    ).toEqual(['Rename', 'Share']);
    expect(deleted).not.toHaveBeenCalled();
  });

  it('blocks only the matching busy overflow action in the opened menu', async () => {
    const renamed = vi.fn();
    const shared = vi.fn();
    component.renameRequest.subscribe(renamed);
    component.shareRequest.subscribe(shared);
    fixture.componentRef.setInput('busyAction', {
      action: 'rename',
      variantId: 'personal',
    });
    fixture.detectChanges();

    const menu = await openOverflowMenu('My accounts');
    const rename = menuItem(menu, 'Rename');
    const share = menuItem(menu, 'Share');
    expect(rename.getAttribute('aria-disabled')).toBe('true');
    expect(share.getAttribute('aria-disabled')).toBeNull();

    rename.click();
    share.click();
    fixture.detectChanges();
    await finishMenuClose();

    expect(renamed).not.toHaveBeenCalled();
    expect(shared).toHaveBeenCalledWith(variants[2]);
  });

  it('has no accessibility violations in its default state', async () => {
    await expectNoAxeViolations(host);
  });
});
