import { Component, ElementRef, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { OverlayContainer } from '@angular/cdk/overlay';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvListItem } from '@malva-ui/core/list';
import { MlvPopupService } from '@malva-ui/core/popup';
import { expectTypeOf, vi } from 'vitest';
import { Observable, Subject } from 'rxjs';
import { MlvDataSource } from '@malva-ui/cdk/data-source';
import type { Signal } from '@angular/core';
import { MlvMenu } from './menu';
import { MlvMenuDataRenderer } from './menu-data-renderer';
import type { MlvMenuItemData, MlvMenuItemDefContext } from './menu-data.types';
import { MlvMenuItemDef } from './menu-item-def';
import { MlvMenuItem } from './menu-item';
import { MlvMenuTrigger } from './menu-trigger';

type CommandItem = MlvMenuItemData<{ readonly shortcut: string }>;

function fireKey(
  element: Element,
  key: string,
  keyCode?: number,
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true });
  if (keyCode !== undefined) {
    Object.defineProperty(event, 'keyCode', { get: () => keyCode });
  }
  element.dispatchEvent(event);
  return event;
}

async function openMenu(
  fixture: ReturnType<typeof TestBed.createComponent<unknown>>,
  overlay: HTMLElement,
): Promise<void> {
  fixture.debugElement.query(By.css('button')).nativeElement.click();
  fixture.detectChanges();
  await fixture.whenStable();

  expect(overlay.querySelector('[role="menu"]')).not.toBeNull();
}

function textContent(nodes: NodeListOf<Element>): string[] {
  return Array.from(nodes).map((node) => node.textContent?.trim() ?? '');
}

@Component({
  imports: [
    MlvMenu,
    MlvMenuDataRenderer,
    MlvMenuItem,
    MlvMenuItemDef,
    MlvMenuTrigger,
    MlvListItem,
  ],
  template: `
    <button [mlvMenuTrigger]="menu">Open</button>
    <mlv-menu #menu label="Commands">
      <mlv-menu-data-renderer
        [items]="items"
        [itemDef]="itemDef()"
        mode="menu"
        [parentMenu]="menu"
        [menubar]="null"
      />

      <ng-template
        mlvMenuItemDef
        let-item
        let-hasChildren="hasChildren"
        let-loading="loading"
      >
        <mlv-list-item mlvMenuItem>
          {{ item.label }}|{{ item.data?.shortcut }}|{{ hasChildren }}|{{
            loading
          }}
        </mlv-list-item>
      </ng-template>
    </mlv-menu>
  `,
})
class TemplateRendererHost {
  readonly itemDef = viewChild(MlvMenuItemDef);
  readonly items: readonly CommandItem[] = [
    {
      id: 'open',
      label: 'Open',
      data: { shortcut: 'Cmd+O' },
    },
    {
      id: 'more',
      label: 'More',
      data: { shortcut: '>' },
      children: new Subject<CommandItem[]>().asObservable(),
    },
  ];
}

@Component({
  imports: [MlvMenu, MlvMenuDataRenderer, MlvMenuTrigger],
  template: `
    <button [mlvMenuTrigger]="menu">Open</button>
    <mlv-menu #menu label="Default">
      <mlv-menu-data-renderer
        [items]="items"
        mode="menu"
        [parentMenu]="menu"
        [menubar]="null"
      />
    </mlv-menu>
  `,
})
class DefaultRendererHost {
  readonly items: readonly CommandItem[] = [
    {
      id: 'save',
      label: 'Save',
      data: { shortcut: 'Cmd+S' },
    },
    {
      id: 'save-as',
      label: 'Save As',
      data: { shortcut: 'Shift+Cmd+S' },
    },
  ];
}

@Component({
  imports: [
    MlvMenu,
    MlvMenuDataRenderer,
    MlvMenuItem,
    MlvMenuItemDef,
    MlvMenuTrigger,
    MlvListItem,
  ],
  template: `
    <button [mlvMenuTrigger]="menu">Open</button>
    <mlv-menu #menu label="Disabled">
      <mlv-menu-data-renderer
        [items]="items"
        [itemDef]="itemDef()"
        mode="menu"
        [parentMenu]="menu"
        [menubar]="null"
      />

      <ng-template mlvMenuItemDef let-item>
        <mlv-list-item mlvMenuItem>{{ item.label }}</mlv-list-item>
      </ng-template>
    </mlv-menu>
  `,
})
class DisabledRendererHost {
  readonly itemDef = viewChild(MlvMenuItemDef);
  readonly items: readonly CommandItem[] = [
    {
      id: 'enabled',
      label: 'Enabled',
      data: { shortcut: 'Cmd+E' },
    },
    {
      id: 'disabled',
      label: 'Disabled',
      data: { shortcut: 'Cmd+D' },
      disabled: true,
    },
  ];
}

@Component({
  imports: [
    MlvMenu,
    MlvMenuDataRenderer,
    MlvMenuItem,
    MlvMenuItemDef,
    MlvMenuTrigger,
    MlvListItem,
  ],
  template: `
    <button [mlvMenuTrigger]="menu">Open</button>
    <mlv-menu #menu label="Lazy">
      <mlv-menu-data-renderer
        [items]="items"
        [itemDef]="itemDef()"
        mode="menu"
        [parentMenu]="menu"
        [menubar]="null"
      />

      <ng-template mlvMenuItemDef let-item>
        <mlv-list-item mlvMenuItem>{{ item.label }}</mlv-list-item>
      </ng-template>
    </mlv-menu>
  `,
})
class LazyChildrenHost {
  readonly itemDef = viewChild(MlvMenuItemDef);
  readonly childrenSubject = new Subject<CommandItem[]>();
  childrenSubscriptions = 0;
  readonly children$ = new Observable<CommandItem[]>((subscriber) => {
    this.childrenSubscriptions++;
    return this.childrenSubject.subscribe(subscriber);
  });
  readonly items: readonly CommandItem[] = [
    {
      id: 'recent',
      label: 'Recent',
      data: { shortcut: '>' },
      children: this.children$,
    },
    {
      id: 'share',
      label: 'Share',
      data: { shortcut: 'Cmd+Shift+S' },
    },
  ];
}

@Component({
  imports: [MlvMenu, MlvMenuDataRenderer, MlvMenuTrigger],
  template: `
    <button [mlvMenuTrigger]="menu">Open</button>
    <mlv-menu #menu label="Reactive lazy children">
      <mlv-menu-data-renderer
        [items]="items()"
        mode="menu"
        [parentMenu]="menu"
        [menubar]="null"
      />
    </mlv-menu>
  `,
})
class ReactiveChildrenHost {
  readonly childrenSubject = new Subject<CommandItem[]>();
  childrenSubscriptions = 0;
  readonly children$ = new Observable<CommandItem[]>((subscriber) => {
    this.childrenSubscriptions++;
    return this.childrenSubject.subscribe(subscriber);
  });
  readonly replacementChildrenSubject = new Subject<CommandItem[]>();
  replacementChildrenSubscriptions = 0;
  readonly replacementChildren$ = new Observable<CommandItem[]>(
    (subscriber) => {
      this.replacementChildrenSubscriptions++;
      return this.replacementChildrenSubject.subscribe(subscriber);
    },
  );
  readonly items = signal<readonly CommandItem[]>([
    {
      id: 'recent',
      label: 'Recent',
      data: { shortcut: '>' },
      children: this.children$,
    },
  ]);

  refreshItem(): void {
    this.items.set([
      {
        id: 'recent',
        label: 'Recent files',
        data: { shortcut: '>' },
        children: this.children$,
      },
    ]);
  }

  replaceChildren(): void {
    this.items.set([
      {
        id: 'recent',
        label: 'Recent files',
        data: { shortcut: '>' },
        children: this.replacementChildren$,
      },
    ]);
  }
}

class CountingMenuDataSource extends MlvDataSource<CommandItem> {
  connectCount = 0;
  readonly totalItems = signal(0);
  private readonly _items = signal<CommandItem[]>([]);

  connect(): Signal<CommandItem[]> {
    this.connectCount += 1;
    return this._items.asReadonly();
  }

  setItems(items: CommandItem[]): void {
    this.totalItems.set(items.length);
    this._items.set(items);
  }

  setLoading(value: boolean): void {
    this._loading.set(value);
  }
}

@Component({
  imports: [MlvMenu, MlvMenuItem, MlvMenuItemDef, MlvMenuTrigger, MlvListItem],
  template: `
    <button [mlvMenuTrigger]="menu">Open</button>
    <mlv-menu #menu label="Data commands" [dataSource]="source()">
      <mlv-list-item mlvMenuItem>Projected</mlv-list-item>

      <ng-template mlvMenuItemDef let-item let-index="index">
        <mlv-list-item mlvMenuItem>{{ item.label }}|{{ index }}</mlv-list-item>
      </ng-template>
    </mlv-menu>
  `,
})
class DataSourceMenuHost {
  readonly source = signal<CommandItem[] | undefined>(undefined);

  setSource(items: CommandItem[] | undefined): void {
    this.source.set(items);
  }
}

@Component({
  imports: [MlvMenu, MlvMenuItem, MlvMenuTrigger, MlvMenuItemDef, MlvListItem],
  template: `
    <button [mlvMenuTrigger]="menu">Open</button>
    <mlv-menu #menu label="Remote commands" [dataSource]="selection()">
      <ng-template mlvMenuItemDef let-item>
        <mlv-list-item mlvMenuItem>{{ item.label }}</mlv-list-item>
      </ng-template>
    </mlv-menu>
  `,
})
class RemoteDataSourceMenuHost {
  readonly source = new CountingMenuDataSource();
  readonly selection = signal<CommandItem[] | CountingMenuDataSource>(
    this.source,
  );

  selectEmptyArray(): void {
    this.selection.set([]);
  }

  selectSource(): void {
    this.selection.set(this.source);
  }
}

describe('MlvMenuDataRenderer', () => {
  let overlayContainer: OverlayContainer;
  let overlayContainerEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        TemplateRendererHost,
        DefaultRendererHost,
        DisabledRendererHost,
        LazyChildrenHost,
        ReactiveChildrenHost,
        DataSourceMenuHost,
        RemoteDataSourceMenuHost,
      ],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);
    overlayContainerEl = overlayContainer.getContainerElement();
  });

  afterEach(() => {
    overlayContainer.ngOnDestroy();
  });

  it('keeps the public template context typed for the item definition', () => {
    expectTypeOf<
      MlvMenuItemDefContext<CommandItem>['$implicit']
    >().toEqualTypeOf<CommandItem>();
  });

  it('renders array rows through the projected item definition context', async () => {
    const fixture = TestBed.createComponent(TemplateRendererHost);
    fixture.detectChanges();

    await openMenu(fixture, overlayContainerEl);

    expect(
      textContent(overlayContainerEl.querySelectorAll('[role="menuitem"]')),
    ).toEqual(['Open|Cmd+O|false|false', 'More|>|true|false']);
  });

  it('falls back to the item label when no custom item definition is projected', async () => {
    const fixture = TestBed.createComponent(DefaultRendererHost);
    fixture.detectChanges();

    await openMenu(fixture, overlayContainerEl);

    expect(
      textContent(overlayContainerEl.querySelectorAll('[role="menuitem"]')),
    ).toEqual(['Save', 'Save As']);
  });

  it('applies disabled semantics from the data item without requiring a disabled binding', async () => {
    const fixture = TestBed.createComponent(DisabledRendererHost);
    fixture.detectChanges();

    await openMenu(fixture, overlayContainerEl);

    const items = overlayContainerEl.querySelectorAll('[role="menuitem"]');
    const disabledItem = items[1] as HTMLElement;

    expect(disabledItem.classList.contains('mlv-list-item--disabled')).toBe(
      true,
    );
    expect(disabledItem.getAttribute('aria-disabled')).toBe('true');
    expect(disabledItem.getAttribute('tabindex')).toBe('-1');
  });

  it('opens a generated submenu on mouseenter with automatic submenu aria state and no explicit row trigger', async () => {
    const fixture = TestBed.createComponent(LazyChildrenHost);
    fixture.detectChanges();

    await openMenu(fixture, overlayContainerEl);

    const recent = overlayContainerEl.querySelector(
      '[role="menuitem"]',
    ) as HTMLElement;

    expect(fixture.componentInstance.childrenSubscriptions).toBe(0);
    expect(recent.getAttribute('aria-haspopup')).toBe('menu');
    expect(recent.getAttribute('aria-expanded')).toBe('false');
    expect(recent.getAttribute('aria-controls')).toBeNull();

    recent.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.childrenSubscriptions).toBe(1);
    expect(recent.getAttribute('aria-expanded')).toBe('true');
    expect(recent.getAttribute('aria-controls')).toBeTruthy();
    expect(
      overlayContainerEl
        .querySelector('mlv-loader')
        ?.getAttribute('aria-label'),
    ).toBe('Loading');

    fixture.componentInstance.childrenSubject.next([
      { id: 'today', label: 'Today', data: { shortcut: 'T' } },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(overlayContainerEl.querySelector('mlv-loader')).toBeNull();
    expect(
      textContent(overlayContainerEl.querySelectorAll('[role="menuitem"]')),
    ).toContain('Today');
  });

  it('anchors a generated submenu to the rendered row through a real ElementRef origin', async () => {
    const fixture = TestBed.createComponent(LazyChildrenHost);
    fixture.detectChanges();

    await openMenu(fixture, overlayContainerEl);

    const openSpy = vi.spyOn(TestBed.inject(MlvPopupService), 'open');
    const recent = overlayContainerEl.querySelector(
      '[role="menuitem"]',
    ) as HTMLElement;

    recent.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(openSpy).toHaveBeenCalledTimes(1);
    const origin = openSpy.mock.calls[0][0].origin;

    // `FlexibleConnectedPositionStrategy._getOriginRect()` only calls
    // `getBoundingClientRect()` when the origin is an `ElementRef`/`Element`
    // instance; anything else is read as an `{x, y}` point, which places the
    // submenu at the viewport origin.
    expect(origin).toBeInstanceOf(ElementRef);
    expect(origin.nativeElement).toBe(recent);
  });

  it('opens a generated submenu with ArrowRight and does not subscribe before activation', async () => {
    const fixture = TestBed.createComponent(LazyChildrenHost);
    fixture.detectChanges();

    await openMenu(fixture, overlayContainerEl);

    const recent = overlayContainerEl.querySelector(
      '[role="menuitem"]',
    ) as HTMLElement;

    fireKey(recent, 'ArrowRight', 39);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.childrenSubscriptions).toBe(1);
    expect(recent.getAttribute('aria-expanded')).toBe('true');
  });

  it('preserves a loaded child source when a tracked item refreshes', async () => {
    const fixture = TestBed.createComponent(ReactiveChildrenHost);
    fixture.detectChanges();

    await openMenu(fixture, overlayContainerEl);

    const recent = overlayContainerEl.querySelector(
      '[role="menuitem"]',
    ) as HTMLElement;
    recent.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.childrenSubject.next([
      { id: 'first', label: 'First', data: { shortcut: '1' } },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.refreshItem();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.childrenSubscriptions).toBe(1);
    expect(
      textContent(overlayContainerEl.querySelectorAll('[role="menuitem"]')),
    ).toContain('First');

    fixture.componentInstance.childrenSubject.next([
      { id: 'second', label: 'Second', data: { shortcut: '2' } },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(
      textContent(overlayContainerEl.querySelectorAll('[role="menuitem"]')),
    ).toContain('Second');
  });

  it('replaces an open child source and tears down the previous subscription', async () => {
    const fixture = TestBed.createComponent(ReactiveChildrenHost);
    fixture.detectChanges();

    await openMenu(fixture, overlayContainerEl);

    const recent = overlayContainerEl.querySelector(
      '[role="menuitem"]',
    ) as HTMLElement;
    recent.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.childrenSubject.next([
      { id: 'first', label: 'First', data: { shortcut: '1' } },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.replaceChildren();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.childrenSubscriptions).toBe(1);
    expect(fixture.componentInstance.replacementChildrenSubscriptions).toBe(1);
    expect(overlayContainerEl.querySelector('mlv-loader')).not.toBeNull();

    fixture.componentInstance.childrenSubject.next([
      { id: 'stale', label: 'Stale', data: { shortcut: 'S' } },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(
      textContent(overlayContainerEl.querySelectorAll('[role="menuitem"]')),
    ).not.toContain('Stale');

    fixture.componentInstance.replacementChildrenSubject.next([
      { id: 'new', label: 'New', data: { shortcut: 'N' } },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(overlayContainerEl.querySelector('mlv-loader')).toBeNull();
    expect(
      textContent(overlayContainerEl.querySelectorAll('[role="menuitem"]')),
    ).toContain('New');
  });

  it('switches exclusively from projected content to data rows', async () => {
    const fixture = TestBed.createComponent(DataSourceMenuHost);
    fixture.detectChanges();

    await openMenu(fixture, overlayContainerEl);

    expect(
      textContent(overlayContainerEl.querySelectorAll('[role="menuitem"]')),
    ).toEqual(['Projected']);

    fixture.componentInstance.setSource([
      { id: 'open', label: 'Open', data: { shortcut: 'O' } },
      { id: 'save', label: 'Save', data: { shortcut: 'S' } },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(
      textContent(overlayContainerEl.querySelectorAll('[role="menuitem"]')),
    ).toEqual(['Open|0', 'Save|1']);
    expect(overlayContainerEl.textContent).not.toContain('Projected');
  });

  it('reconciles an array replacement without rebuilding the menu panel', async () => {
    const fixture = TestBed.createComponent(DataSourceMenuHost);
    fixture.componentInstance.setSource([
      { id: 'first', label: 'First', data: { shortcut: '1' } },
      { id: 'second', label: 'Second', data: { shortcut: '2' } },
    ]);
    fixture.detectChanges();

    await openMenu(fixture, overlayContainerEl);
    const panel = overlayContainerEl.querySelector('[role="menu"]');

    fixture.componentInstance.setSource([
      { id: 'replacement', label: 'Replacement', data: { shortcut: 'R' } },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(overlayContainerEl.querySelector('[role="menu"]')).toBe(panel);
    expect(
      textContent(overlayContainerEl.querySelectorAll('[role="menuitem"]')),
    ).toEqual(['Replacement|0']);
  });

  it('connects a remote source once across repeated source identity selection', async () => {
    const fixture = TestBed.createComponent(RemoteDataSourceMenuHost);
    const source = fixture.componentInstance.source;
    source.setItems([
      { id: 'remote', label: 'Remote', data: { shortcut: 'R' } },
    ]);
    fixture.detectChanges();

    await openMenu(fixture, overlayContainerEl);
    expect(source.connectCount).toBe(1);

    fixture.componentInstance.selectEmptyArray();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.selectSource();
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.source.setLoading(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.source.setLoading(false);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(source.connectCount).toBe(1);
    expect(
      textContent(overlayContainerEl.querySelectorAll('[role="menuitem"]')),
    ).toEqual(['Remote']);
  });

  it('clears data mode and restores projected content', async () => {
    const fixture = TestBed.createComponent(DataSourceMenuHost);
    fixture.componentInstance.setSource([
      { id: 'data', label: 'Data', data: { shortcut: 'D' } },
    ]);
    fixture.detectChanges();

    await openMenu(fixture, overlayContainerEl);
    expect(
      textContent(overlayContainerEl.querySelectorAll('[role="menuitem"]')),
    ).toEqual(['Data|0']);

    fixture.componentInstance.setSource(undefined);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(
      textContent(overlayContainerEl.querySelectorAll('[role="menuitem"]')),
    ).toEqual(['Projected']);
  });

  it('moves the roving tabindex to the nearest remaining item when the active item is removed', async () => {
    const fixture = TestBed.createComponent(DataSourceMenuHost);
    fixture.componentInstance.setSource([
      { id: 'first', label: 'First', data: { shortcut: '1' } },
      { id: 'second', label: 'Second', data: { shortcut: '2' } },
      { id: 'third', label: 'Third', data: { shortcut: '3' } },
    ]);
    fixture.detectChanges();

    await openMenu(fixture, overlayContainerEl);
    const panel = overlayContainerEl.querySelector('[role="menu"]') as Element;
    fireKey(panel, 'ArrowDown', 40);
    fixture.detectChanges();
    const firstItem = overlayContainerEl.querySelector(
      '[role="menuitem"]',
    ) as HTMLElement;
    firstItem.focus();

    expect(
      overlayContainerEl
        .querySelector('[role="menuitem"][tabindex="0"]')
        ?.textContent?.trim(),
    ).toBe('First|0');

    fixture.componentInstance.setSource([
      { id: 'second', label: 'Second', data: { shortcut: '2' } },
      { id: 'third', label: 'Third', data: { shortcut: '3' } },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(
      overlayContainerEl
        .querySelector('[role="menuitem"][tabindex="0"]')
        ?.textContent?.trim(),
    ).toBe('Second|0');
    expect(document.activeElement?.textContent?.trim()).toBe('Second|0');
  });

  it('reconciles a live disabled-state change for a tracked data row', async () => {
    const fixture = TestBed.createComponent(DataSourceMenuHost);
    fixture.componentInstance.setSource([
      { id: 'first', label: 'First', data: { shortcut: '1' } },
      { id: 'second', label: 'Second', data: { shortcut: '2' } },
    ]);
    fixture.detectChanges();

    await openMenu(fixture, overlayContainerEl);
    const firstItem = overlayContainerEl.querySelector(
      '[role="menuitem"]',
    ) as HTMLElement;
    firstItem.focus();

    fixture.componentInstance.setSource([
      {
        id: 'first',
        label: 'First',
        data: { shortcut: '1' },
        disabled: true,
      },
      { id: 'second', label: 'Second', data: { shortcut: '2' } },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(firstItem.getAttribute('aria-disabled')).toBe('true');
    expect(
      overlayContainerEl
        .querySelector('[role="menuitem"][tabindex="0"]')
        ?.textContent?.trim(),
    ).toBe('Second|1');
  });

  it('shows the localized loader while a remote root source is loading', async () => {
    const fixture = TestBed.createComponent(RemoteDataSourceMenuHost);
    const source = fixture.componentInstance.source;
    source.setLoading(true);
    fixture.detectChanges();

    await openMenu(fixture, overlayContainerEl);

    const loader = overlayContainerEl.querySelector('mlv-loader');
    expect(loader).not.toBeNull();
    expect(loader?.getAttribute('aria-label')).toBe('Loading');

    source.setItems([
      { id: 'loaded', label: 'Loaded', data: { shortcut: 'L' } },
    ]);
    source.setLoading(false);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(overlayContainerEl.querySelector('mlv-loader')).toBeNull();
    expect(
      textContent(overlayContainerEl.querySelectorAll('[role="menuitem"]')),
    ).toEqual(['Loaded']);
  });
});
