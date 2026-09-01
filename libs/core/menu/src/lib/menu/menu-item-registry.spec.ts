import type { BooleanInput } from '@angular/cdk/coercion';
import {
  Component,
  Directive,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import type { InputSignalWithTransform } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { OverlayContainer } from '@angular/cdk/overlay';
import { MlvListItem } from '@malva-ui/core/list';
import { expectTypeOf, vi } from 'vitest';
import { MlvMenu } from './menu';
import { MlvMenuItem } from './menu-item';
import {
  MLV_MENU_ITEM_REGISTRY,
  MlvMenuItemRegistryStore,
  type MenuKeyItem,
} from './menu-item-registry';
import { MlvMenuTrigger } from './menu-trigger';
import { MlvMenubar } from './menubar';
import {
  MLV_MENUBAR_ITEM_REGISTRY,
  MlvMenubarItemRegistryStore,
} from './menubar-item-registry';
import type { MlvMenubarItem } from './menubar.types';

const KEY = { left: 37, right: 39 } as const;
const noop = (): void => undefined;

function fireKey(el: Element, key: string, keyCode?: number): void {
  const event = new KeyboardEvent('keydown', { key, bubbles: true });
  if (keyCode !== undefined) {
    Object.defineProperty(event, 'keyCode', { get: () => keyCode });
  }
  el.dispatchEvent(event);
}

function flushMacrotask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function createMenuKeyItem(label: string, element?: HTMLElement): MenuKeyItem {
  return {
    _tabIndex: signal(-1),
    _elementRef: element ? new ElementRef(element) : undefined,
    disabledBoolean: false,
    focus: noop,
    getLabel: () => label,
  };
}

function createMenubarItem(
  label: string,
  element?: HTMLElement,
): MlvMenubarItem {
  return {
    _tabIndex: signal(-1),
    _elementRef: element ? new ElementRef(element) : undefined,
    disabledBoolean: false,
    closeMenu: noop,
    focus: noop,
    getLabel: () => label,
    isMenuOpen: () => false,
    openMenu: noop,
    openMenuWithFirstItemFocused: noop,
    openMenuWithLastItemFocused: noop,
  };
}

/** Roots appended to `document.body` by DOM-order specs, torn down after each. */
const detachAfterEach: HTMLElement[] = [];

function trackRoot<T extends HTMLElement>(root: T): T {
  document.body.appendChild(root);
  detachAfterEach.push(root);
  return root;
}

/** `<div role="menu">` panel holding `rowCount` `[role="menuitem"]` rows. */
function createMenuPanel(rowCount: number): {
  container: HTMLElement;
  rows: HTMLElement[];
} {
  const container = document.createElement('div');
  container.setAttribute('role', 'menu');

  const rows = Array.from({ length: rowCount }, (_unused, index) => {
    const row = document.createElement('div');
    row.setAttribute('role', 'menuitem');
    row.textContent = `Item ${index}`;
    container.appendChild(row);
    return row;
  });

  trackRoot(container);
  return { container, rows };
}

/** `<mlv-menu>` host holding `rowCount` `mlv-list-item[mlvMenuItem]` rows. */
function createMenuHost(rowCount: number): {
  container: HTMLElement;
  rows: HTMLElement[];
} {
  const container = document.createElement('mlv-menu');

  const rows = Array.from({ length: rowCount }, (_unused, index) => {
    const row = document.createElement('mlv-list-item');
    row.setAttribute('mlvMenuItem', '');
    row.textContent = `Item ${index}`;
    container.appendChild(row);
    return row;
  });

  trackRoot(container);
  return { container, rows };
}

/** `<mlv-menubar>` holding `itemCount` `[role="menuitem"]` triggers. */
function createMenubarHost(itemCount: number): {
  container: HTMLElement;
  triggers: HTMLElement[];
} {
  const container = document.createElement('mlv-menubar');
  container.setAttribute('role', 'menubar');

  const triggers = Array.from({ length: itemCount }, (_unused, index) => {
    const trigger = document.createElement('button');
    trigger.setAttribute('role', 'menuitem');
    trigger.textContent = `Item ${index}`;
    container.appendChild(trigger);
    return trigger;
  });

  trackRoot(container);
  return { container, triggers };
}

function labelsOf(items: readonly { getLabel(): string }[]): readonly string[] {
  return items.map((item) => item.getLabel());
}

@Directive({
  selector: '[mlvRegistryMenuProbe]',
})
class MlvRegistryMenuProbe {
  readonly registry = inject(MLV_MENU_ITEM_REGISTRY);
}

@Directive({
  selector: '[mlvRegistryMenubarProbe]',
})
class MlvRegistryMenubarProbe {
  readonly registry = inject(MLV_MENUBAR_ITEM_REGISTRY);
}

@Component({
  imports: [
    MlvMenu,
    MlvMenuItem,
    MlvMenuTrigger,
    MlvListItem,
    MlvRegistryMenuProbe,
  ],
  template: `
    <button [mlvMenuTrigger]="menu">Open</button>
    <mlv-menu #menu mlvRegistryMenuProbe>
      <mlv-list-item mlvMenuItem>Alpha</mlv-list-item>
      @if (showBravo()) {
        <mlv-list-item mlvMenuItem>Bravo</mlv-list-item>
      }
      <mlv-list-item mlvMenuItem>Charlie</mlv-list-item>
    </mlv-menu>
  `,
})
class ConditionalMenuHost {
  readonly showBravo = signal(true);
}

type TestItem = { id: string; label: string };

@Component({
  imports: [
    MlvMenu,
    MlvMenuItem,
    MlvMenuTrigger,
    MlvListItem,
    MlvRegistryMenuProbe,
  ],
  template: `
    <button [mlvMenuTrigger]="menu">Open</button>
    <mlv-menu #menu mlvRegistryMenuProbe>
      @for (item of items(); track item.id) {
        <mlv-list-item mlvMenuItem>{{ item.label }}</mlv-list-item>
      }
    </mlv-menu>
  `,
})
class ReorderedMenuHost {
  readonly items = signal<readonly TestItem[]>([
    { id: 'alpha', label: 'Alpha' },
    { id: 'bravo', label: 'Bravo' },
    { id: 'charlie', label: 'Charlie' },
  ]);
}

@Component({
  imports: [
    MlvMenubar,
    MlvMenu,
    MlvMenuItem,
    MlvMenuTrigger,
    MlvListItem,
    MlvRegistryMenubarProbe,
  ],
  template: `
    <mlv-menubar aria-label="Main" mlvRegistryMenubarProbe>
      <button [mlvMenuTrigger]="fileMenu">File</button>
      @if (showEdit()) {
        <button [mlvMenuTrigger]="editMenu">Edit</button>
      }
      <button [mlvMenuTrigger]="viewMenu">View</button>
    </mlv-menubar>

    <mlv-menu #fileMenu label="File">
      <mlv-list-item mlvMenuItem>New</mlv-list-item>
    </mlv-menu>

    <mlv-menu #editMenu label="Edit">
      <mlv-list-item mlvMenuItem>Undo</mlv-list-item>
    </mlv-menu>

    <mlv-menu #viewMenu label="View">
      <mlv-list-item mlvMenuItem>Zoom</mlv-list-item>
    </mlv-menu>
  `,
})
class ConditionalMenubarHost {
  readonly showEdit = signal(true);
}

@Component({
  imports: [
    MlvMenubar,
    MlvMenu,
    MlvMenuItem,
    MlvMenuTrigger,
    MlvListItem,
    MlvRegistryMenubarProbe,
  ],
  template: `
    <mlv-menubar aria-label="Main" mlvRegistryMenubarProbe>
      @for (item of items(); track item.id) {
        <button [mlvMenuTrigger]="sharedMenu">{{ item.label }}</button>
      }
    </mlv-menubar>

    <mlv-menu #sharedMenu label="Shared">
      <mlv-list-item mlvMenuItem>Item</mlv-list-item>
    </mlv-menu>
  `,
})
class ReorderedMenubarHost {
  readonly items = signal<readonly TestItem[]>([
    { id: 'file', label: 'File' },
    { id: 'edit', label: 'Edit' },
    { id: 'view', label: 'View' },
  ]);
}

describe('MlvMenuItemRegistryStore', () => {
  it('ignores duplicate registrations and unregisters by instance identity', () => {
    const registry = new MlvMenuItemRegistryStore();
    const alpha = createMenuKeyItem('Alpha');
    const bravo = createMenuKeyItem('Bravo');

    registry.register(alpha);
    registry.register(alpha);
    registry.register(bravo);

    expect(registry.items()).toEqual([alpha, bravo]);

    registry.unregister(createMenuKeyItem('Alpha'));
    expect(registry.items()).toEqual([alpha, bravo]);

    registry.unregister(alpha);
    expect(registry.items()).toEqual([bravo]);
  });
});

describe('MlvMenubarItemRegistryStore', () => {
  it('ignores duplicate registrations and unregisters by instance identity', () => {
    const registry = new MlvMenubarItemRegistryStore();
    const file = createMenubarItem('File');
    const edit = createMenubarItem('Edit');

    registry.register(file);
    registry.register(file);
    registry.register(edit);

    expect(registry.items()).toEqual([file, edit]);

    registry.unregister(createMenubarItem('File'));
    expect(registry.items()).toEqual([file, edit]);

    registry.unregister(file);
    expect(registry.items()).toEqual([edit]);
  });
});

describe('menu typing contracts', () => {
  it('keeps boolean input read types compatible with menu registry consumers', () => {
    expectTypeOf<MlvMenuItem['disabled']>().toEqualTypeOf<
      InputSignalWithTransform<boolean, BooleanInput>
    >();
    expectTypeOf<MlvMenuTrigger['isSubmenuTrigger']>().toEqualTypeOf<
      InputSignalWithTransform<boolean, BooleanInput>
    >();
    expectTypeOf<MlvMenuTrigger['menuTriggerDisabled']>().toEqualTypeOf<
      InputSignalWithTransform<boolean, BooleanInput>
    >();
  });

  it('keeps registry element references narrowed to HTMLElement', () => {
    expectTypeOf<MenuKeyItem['_elementRef']>().toEqualTypeOf<
      ElementRef<HTMLElement> | undefined
    >();
  });
});

describe('registry-backed projected items', () => {
  let overlayContainer: OverlayContainer;
  let overlayContainerEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ConditionalMenuHost,
        ReorderedMenuHost,
        ConditionalMenubarHost,
        ReorderedMenubarHost,
      ],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);
    overlayContainerEl = overlayContainer.getContainerElement();
  });

  afterEach(() => {
    overlayContainer.ngOnDestroy();
  });

  it('tracks projected menu items in the menu registry and keeps one valid tab stop when the active row is removed', async () => {
    const fixture = TestBed.createComponent(ConditionalMenuHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const registry = fixture.debugElement
      .query(By.directive(MlvRegistryMenuProbe))
      .injector.get(MlvRegistryMenuProbe).registry;
    expect(registry.items().map((item) => item.getLabel())).toEqual([
      'Alpha',
      'Bravo',
      'Charlie',
    ]);

    const trigger = fixture.debugElement.query(By.css('button')).nativeElement;
    fireKey(trigger, 'Enter');
    fixture.detectChanges();
    await fixture.whenStable();
    await flushMacrotask();
    fixture.detectChanges();

    const panel = overlayContainerEl.querySelector(
      '[role="menu"]',
    ) as HTMLElement;
    fireKey(panel, 'b');
    await new Promise((resolve) => setTimeout(resolve, 250));
    fixture.detectChanges();

    const bravoItem = Array.from(
      overlayContainerEl.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ).find((item) => item.textContent?.trim() === 'Bravo');
    expect(bravoItem?.getAttribute('tabindex')).toBe('0');

    fixture.componentInstance.showBravo.set(false);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(registry.items().map((item) => item.getLabel())).toEqual([
      'Alpha',
      'Charlie',
    ]);

    const menuItemsAfter = Array.from(
      overlayContainerEl.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    );
    expect(menuItemsAfter.map((item) => item.textContent?.trim())).toEqual([
      'Alpha',
      'Charlie',
    ]);
    expect(
      menuItemsAfter.filter((item) => item.getAttribute('tabindex') === '0'),
    ).toHaveLength(1);
    expect(menuItemsAfter[1].getAttribute('tabindex')).toBe('0');
  });

  it('re-syncs registry order when tracked menu rows move in the DOM without new instances', async () => {
    const fixture = TestBed.createComponent(ReorderedMenuHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const registry = fixture.debugElement
      .query(By.directive(MlvRegistryMenuProbe))
      .injector.get(MlvRegistryMenuProbe).registry;
    expect(registry.items().map((item) => item.getLabel())).toEqual([
      'Alpha',
      'Bravo',
      'Charlie',
    ]);

    const trigger = fixture.debugElement.query(By.css('button')).nativeElement;
    fireKey(trigger, 'Enter');
    fixture.detectChanges();
    await fixture.whenStable();
    await flushMacrotask();
    fixture.detectChanges();

    fixture.componentInstance.items.set([
      { id: 'charlie', label: 'Charlie' },
      { id: 'alpha', label: 'Alpha' },
      { id: 'bravo', label: 'Bravo' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    await flushMacrotask();
    fixture.detectChanges();

    expect(
      Array.from(
        overlayContainerEl.querySelectorAll<HTMLElement>('[role="menuitem"]'),
      ).map((item) => item.textContent?.trim()),
    ).toEqual(['Charlie', 'Alpha', 'Bravo']);
    expect(registry.items().map((item) => item.getLabel())).toEqual([
      'Charlie',
      'Alpha',
      'Bravo',
    ]);
  });

  it('tracks menubar triggers in the menubar registry and keeps one valid tab stop when the active item is removed', async () => {
    const fixture = TestBed.createComponent(ConditionalMenubarHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const registry = fixture.debugElement
      .query(By.directive(MlvRegistryMenubarProbe))
      .injector.get(MlvRegistryMenubarProbe).registry;
    expect(registry.items().map((item) => item.getLabel())).toEqual([
      'File',
      'Edit',
      'View',
    ]);

    const buttons = fixture.debugElement
      .queryAll(By.css('.mlv-menubar button'))
      .map((ref) => ref.nativeElement as HTMLButtonElement);

    fireKey(buttons[0], 'ArrowRight', KEY.right);
    fireKey(buttons[0], 'e');
    await new Promise((resolve) => setTimeout(resolve, 250));
    fixture.detectChanges();

    const editButton = fixture.debugElement
      .queryAll(By.css('.mlv-menubar button'))
      .map((ref) => ref.nativeElement as HTMLButtonElement)
      .find((button) => button.textContent?.trim() === 'Edit');
    expect(editButton?.getAttribute('tabindex')).toBe('0');

    fixture.componentInstance.showEdit.set(false);
    fixture.detectChanges();

    expect(registry.items().map((item) => item.getLabel())).toEqual([
      'File',
      'View',
    ]);

    const remainingButtons = fixture.debugElement
      .queryAll(By.css('.mlv-menubar button'))
      .map((ref) => ref.nativeElement as HTMLButtonElement);
    expect(
      remainingButtons.map((button) => button.textContent?.trim()),
    ).toEqual(['File', 'View']);
    expect(
      remainingButtons.filter(
        (button) => button.getAttribute('tabindex') === '0',
      ),
    ).toHaveLength(1);
    const activeRemainingButton =
      remainingButtons.find(
        (button) => button.getAttribute('tabindex') === '0',
      ) ?? null;
    expect(activeRemainingButton).not.toBeNull();

    if (activeRemainingButton) {
      fireKey(activeRemainingButton, 'ArrowLeft', KEY.left);
      fixture.detectChanges();
      expect(
        remainingButtons.filter(
          (button) => button.getAttribute('tabindex') === '0',
        ),
      ).toHaveLength(1);
    }
  });

  it('re-syncs registry order when tracked menubar triggers move in the DOM without new instances', async () => {
    const fixture = TestBed.createComponent(ReorderedMenubarHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const registry = fixture.debugElement
      .query(By.directive(MlvRegistryMenubarProbe))
      .injector.get(MlvRegistryMenubarProbe).registry;
    expect(registry.items().map((item) => item.getLabel())).toEqual([
      'File',
      'Edit',
      'View',
    ]);

    fixture.componentInstance.items.set([
      { id: 'view', label: 'View' },
      { id: 'file', label: 'File' },
      { id: 'edit', label: 'Edit' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    await flushMacrotask();
    fixture.detectChanges();

    expect(
      fixture.debugElement
        .queryAll(By.css('.mlv-menubar button'))
        .map((ref) =>
          (ref.nativeElement as HTMLButtonElement).textContent?.trim(),
        ),
    ).toEqual(['View', 'File', 'Edit']);
    expect(registry.items().map((item) => item.getLabel())).toEqual([
      'View',
      'File',
      'Edit',
    ]);
  });
});

afterEach(() => {
  while (detachAfterEach.length > 0) {
    detachAfterEach.pop()?.remove();
  }
});

describe('menu registry DOM-order index', () => {
  it('sorts items registered out of order into panel DOM order', () => {
    const { rows } = createMenuPanel(3);
    const registry = new MlvMenuItemRegistryStore();
    const items = rows.map((row, index) =>
      createMenuKeyItem(`Item ${index}`, row),
    );

    registry.register(items[2]);
    registry.register(items[0]);
    registry.register(items[1]);

    expect(labelsOf(registry.items())).toEqual(['Item 0', 'Item 1', 'Item 2']);
  });

  it('sorts items registered out of order into mlv-menu host DOM order', () => {
    const { rows } = createMenuHost(3);
    const registry = new MlvMenuItemRegistryStore();
    const items = rows.map((row, index) =>
      createMenuKeyItem(`Item ${index}`, row),
    );

    registry.register(items[1]);
    registry.register(items[2]);
    registry.register(items[0]);

    expect(labelsOf(registry.items())).toEqual(['Item 0', 'Item 1', 'Item 2']);
  });

  it('falls back to document position for items in different containers', () => {
    const first = createMenuPanel(1);
    const second = createMenuPanel(1);
    const registry = new MlvMenuItemRegistryStore();
    const secondItem = createMenuKeyItem('Second', second.rows[0]);
    const firstItem = createMenuKeyItem('First', first.rows[0]);

    registry.register(secondItem);
    registry.register(firstItem);

    expect(labelsOf(registry.items())).toEqual(['First', 'Second']);
  });

  it.each([
    ['untracked first', ['Untracked', 'Item 0']],
    ['tracked first', ['Item 0', 'Untracked']],
  ] as const)(
    'keeps insertion order for an item missing from its container query (%s)',
    (order, expected) => {
      const { container, rows } = createMenuPanel(1);
      // Inside the same `[role="menu"]` container, but not a `[role="menuitem"]`
      // row — the container query never returns it, so it compares equal to
      // every sibling and the sort must leave the registration order untouched.
      const untrackedRow = document.createElement('div');
      untrackedRow.textContent = 'Untracked';
      container.appendChild(untrackedRow);

      const registry = new MlvMenuItemRegistryStore();
      const untrackedItem = createMenuKeyItem('Untracked', untrackedRow);
      const trackedItem = createMenuKeyItem('Item 0', rows[0]);

      // Both registration orders must survive. Asserting only the
      // untracked-first order is vacuous: an implementation that dropped the
      // `-1` → equal rule ranks the untracked row (index `-1`) *before* the
      // tracked one (index `0`), which happens to reproduce that one expected
      // result. Registering the tracked item first is what falsifies it.
      if (order === 'untracked first') {
        registry.register(untrackedItem);
        registry.register(trackedItem);
      } else {
        registry.register(trackedItem);
        registry.register(untrackedItem);
      }

      expect(labelsOf(registry.items())).toEqual(expected);
    },
  );

  it('keeps insertion order for items with no element reference', () => {
    // A registered item without `_elementRef` compares equal to every other
    // item, so it must never be hoisted or sunk relative to its neighbours —
    // in either registration order.
    const { rows } = createMenuPanel(1);

    const forward = new MlvMenuItemRegistryStore();
    forward.register(createMenuKeyItem('No element'));
    forward.register(createMenuKeyItem('Item 0', rows[0]));
    expect(labelsOf(forward.items())).toEqual(['No element', 'Item 0']);

    const reverse = new MlvMenuItemRegistryStore();
    reverse.register(createMenuKeyItem('Item 0', rows[0]));
    reverse.register(createMenuKeyItem('No element'));
    expect(labelsOf(reverse.items())).toEqual(['Item 0', 'No element']);
  });

  it('orders a two-item container, not just containers holding three or more', () => {
    // Container row order is only read for containers holding at least two of
    // the sorted items. Two is the boundary: the three-row specs above still
    // pass if the threshold slips to three, so a pair is what pins it.
    const { rows } = createMenuPanel(2);
    const registry = new MlvMenuItemRegistryStore();

    registry.register(createMenuKeyItem('Item 1', rows[1]));
    registry.register(createMenuKeyItem('Item 0', rows[0]));

    expect(labelsOf(registry.items())).toEqual(['Item 0', 'Item 1']);
  });

  it('lets a shared panel container settle the order before the mlv-menu host', () => {
    // Both rows share a `[role="menu"]` panel *and* the `mlv-menu` host around
    // it, but match only the host's row selector. The panel branch is checked
    // first and cannot rank them (both index `-1`), so the pair compares equal
    // and registration order stands — the host branch must never get a turn.
    const host = document.createElement('mlv-menu');
    const panel = document.createElement('div');
    panel.setAttribute('role', 'menu');
    host.appendChild(panel);

    const rows = ['Item 0', 'Item 1'].map((label) => {
      const row = document.createElement('mlv-list-item');
      row.setAttribute('mlvMenuItem', '');
      row.textContent = label;
      panel.appendChild(row);
      return row;
    });
    trackRoot(host);

    const registry = new MlvMenuItemRegistryStore();
    registry.register(createMenuKeyItem('Item 1', rows[1]));
    registry.register(createMenuKeyItem('Item 0', rows[0]));

    expect(labelsOf(registry.items())).toEqual(['Item 1', 'Item 0']);
  });

  it('issues a bounded number of container queries per resync', () => {
    // One `querySelectorAll` per distinct container per selector family. All
    // rows share a single `[role="menu"]` container and none has an `mlv-menu`
    // ancestor, so a resync stays at this bound no matter how many items are
    // registered. The old implementation queried the container once per
    // comparison instead: 29 queries for this already-ordered n = 30 input,
    // and ~n·log2(n) ≈ 147 in the worst case.
    const MAX_CONTAINER_QUERIES_PER_RESYNC = 2;
    const ITEM_COUNT = 30;

    const { container, rows } = createMenuPanel(ITEM_COUNT);
    const registry = new MlvMenuItemRegistryStore();
    // Registered in reverse DOM order so the trailing order assertion is
    // load-bearing: a resync that queried nothing *and* sorted nothing would
    // satisfy the query budget but leave the list reversed.
    [...rows]
      .reverse()
      .forEach((row) =>
        registry.register(createMenuKeyItem(row.textContent ?? '', row)),
      );

    const querySpy = vi.spyOn(container, 'querySelectorAll');
    registry.resync();
    const queryCount = querySpy.mock.calls.length;
    querySpy.mockRestore();

    expect(queryCount).toBeLessThanOrEqual(MAX_CONTAINER_QUERIES_PER_RESYNC);
    expect(labelsOf(registry.items())).toEqual(
      rows.map((_unused, index) => `Item ${index}`),
    );
  });
});

describe('menu registry mutation relevance', () => {
  it('ignores text churn inside an existing menu row', async () => {
    const { container, rows } = createMenuPanel(3);
    const badge = document.createElement('span');
    rows[1].appendChild(badge);

    const registry = new MlvMenuItemRegistryStore();
    rows.forEach((row, index) =>
      registry.register(createMenuKeyItem(`Item ${index}`, row)),
    );

    const itemsBefore = registry.items();
    const querySpy = vi.spyOn(container, 'querySelectorAll');

    badge.appendChild(document.createTextNode('7'));
    await flushMacrotask();

    const queryCount = querySpy.mock.calls.length;
    querySpy.mockRestore();

    expect(queryCount).toBe(0);
    expect(registry.items()).toBe(itemsBefore);
  });

  it('ignores element churn strictly inside an existing menu row', async () => {
    const { container, rows } = createMenuPanel(3);

    const registry = new MlvMenuItemRegistryStore();
    rows.forEach((row, index) =>
      registry.register(createMenuKeyItem(`Item ${index}`, row)),
    );

    const itemsBefore = registry.items();
    const querySpy = vi.spyOn(container, 'querySelectorAll');

    const icon = document.createElement('span');
    icon.className = 'icon';
    rows[0].appendChild(icon);
    await flushMacrotask();
    icon.remove();
    await flushMacrotask();

    const queryCount = querySpy.mock.calls.length;
    querySpy.mockRestore();

    expect(queryCount).toBe(0);
    expect(registry.items()).toBe(itemsBefore);
  });

  it('resyncs when a real menu row is appended to the container', async () => {
    const { container, rows } = createMenuPanel(3);

    const registry = new MlvMenuItemRegistryStore();
    rows.forEach((row, index) =>
      registry.register(createMenuKeyItem(`Item ${index}`, row)),
    );

    const querySpy = vi.spyOn(container, 'querySelectorAll');

    const addedRow = document.createElement('div');
    addedRow.setAttribute('role', 'menuitem');
    container.appendChild(addedRow);
    await flushMacrotask();

    const queryCount = querySpy.mock.calls.length;
    querySpy.mockRestore();

    expect(queryCount).toBeGreaterThan(0);
  });

  it('reorders when a tracked menu row moves within the container', async () => {
    const { container, rows } = createMenuPanel(3);

    const registry = new MlvMenuItemRegistryStore();
    rows.forEach((row, index) =>
      registry.register(createMenuKeyItem(`Item ${index}`, row)),
    );

    const itemsBefore = registry.items();
    expect(labelsOf(itemsBefore)).toEqual(['Item 0', 'Item 1', 'Item 2']);

    container.appendChild(rows[0]);
    await flushMacrotask();

    expect(registry.items()).not.toBe(itemsBefore);
    expect(labelsOf(registry.items())).toEqual(['Item 1', 'Item 2', 'Item 0']);
  });
});

describe('menubar registry DOM order and mutation relevance', () => {
  it('sorts items registered out of order into menubar DOM order', () => {
    const { triggers } = createMenubarHost(3);
    const registry = new MlvMenubarItemRegistryStore();
    const items = triggers.map((trigger, index) =>
      createMenubarItem(`Item ${index}`, trigger),
    );

    registry.register(items[2]);
    registry.register(items[0]);
    registry.register(items[1]);

    expect(labelsOf(registry.items())).toEqual(['Item 0', 'Item 1', 'Item 2']);
  });

  it('ignores content churn inside an existing menubar item', async () => {
    const { triggers } = createMenubarHost(3);
    const badge = document.createElement('span');
    triggers[1].appendChild(badge);

    const registry = new MlvMenubarItemRegistryStore();
    triggers.forEach((trigger, index) =>
      registry.register(createMenubarItem(`Item ${index}`, trigger)),
    );

    const itemsBefore = registry.items();
    // A resync of an already-ordered list returns the same array reference, so
    // identity alone cannot prove the sort was skipped. The menubar comparator
    // is a bare `compareDocumentPosition` on the item elements, so counting
    // those calls is what actually proves no sort ran.
    const compareSpies = triggers.map((trigger) =>
      vi.spyOn(trigger, 'compareDocumentPosition'),
    );

    badge.appendChild(document.createTextNode('7'));
    await flushMacrotask();
    const swappedIcon = document.createElement('span');
    triggers[2].appendChild(swappedIcon);
    await flushMacrotask();
    swappedIcon.remove();
    await flushMacrotask();

    const compareCount = compareSpies.reduce(
      (total, spy) => total + spy.mock.calls.length,
      0,
    );
    compareSpies.forEach((spy) => spy.mockRestore());

    expect(compareCount).toBe(0);
    expect(registry.items()).toBe(itemsBefore);
    expect(labelsOf(registry.items())).toEqual(['Item 0', 'Item 1', 'Item 2']);
  });

  it('resyncs when a real menubar item is appended to the bar', async () => {
    const { container, triggers } = createMenubarHost(3);

    const registry = new MlvMenubarItemRegistryStore();
    triggers.forEach((trigger, index) =>
      registry.register(createMenubarItem(`Item ${index}`, trigger)),
    );

    const compareSpies = triggers.map((trigger) =>
      vi.spyOn(trigger, 'compareDocumentPosition'),
    );

    const addedTrigger = document.createElement('button');
    addedTrigger.setAttribute('role', 'menuitem');
    container.appendChild(addedTrigger);
    await flushMacrotask();

    const compareCount = compareSpies.reduce(
      (total, spy) => total + spy.mock.calls.length,
      0,
    );
    compareSpies.forEach((spy) => spy.mockRestore());

    expect(compareCount).toBeGreaterThan(0);
  });

  it('reorders when a tracked menubar item moves within the bar', async () => {
    const { container, triggers } = createMenubarHost(3);

    const registry = new MlvMenubarItemRegistryStore();
    triggers.forEach((trigger, index) =>
      registry.register(createMenubarItem(`Item ${index}`, trigger)),
    );

    const itemsBefore = registry.items();
    expect(labelsOf(itemsBefore)).toEqual(['Item 0', 'Item 1', 'Item 2']);

    container.appendChild(triggers[0]);
    await flushMacrotask();

    expect(registry.items()).not.toBe(itemsBefore);
    expect(labelsOf(registry.items())).toEqual(['Item 1', 'Item 2', 'Item 0']);
  });
});

@Component({
  imports: [MlvMenu, MlvMenuTrigger, MlvRegistryMenuProbe],
  template: `
    <button [mlvMenuTrigger]="menu">Open</button>
    <mlv-menu #menu mlvRegistryMenuProbe [dataSource]="items()" />
  `,
})
class DataMenuHost {
  readonly items = signal<readonly TestItem[]>([
    { id: 'alpha', label: 'Alpha' },
    { id: 'bravo', label: 'Bravo' },
    { id: 'charlie', label: 'Charlie' },
  ]);
}

@Component({
  imports: [MlvMenubar, MlvRegistryMenubarProbe],
  template: `
    <mlv-menubar
      aria-label="Main"
      mlvRegistryMenubarProbe
      [dataSource]="items()"
    />
  `,
})
class DataMenubarHost {
  readonly items = signal<readonly TestItem[]>([
    { id: 'file', label: 'File' },
    { id: 'edit', label: 'Edit' },
    { id: 'view', label: 'View' },
  ]);
}

/**
 * Rows generated from a `dataSource` are rendered inside the menu's own view,
 * so they are never picked up by the `contentChildren` query that feeds
 * `syncOrder()`. Reordering the source moves the existing rows without changing
 * the registered item set, which leaves the `MutationObserver` relevance filter
 * as the *only* mechanism that can re-sort the registry — unlike the projected
 * specs above, which stay correct even with the filter disabled.
 */
describe('registry-backed data-driven rows', () => {
  let overlayContainer: OverlayContainer;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataMenuHost, DataMenubarHost],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);
  });

  afterEach(() => {
    overlayContainer.ngOnDestroy();
  });

  async function settle(fixture: {
    detectChanges(): void;
    whenStable(): Promise<unknown>;
  }): Promise<void> {
    for (let pass = 0; pass < 4; pass++) {
      fixture.detectChanges();
      await fixture.whenStable();
      await flushMacrotask();
    }
  }

  it('re-sorts generated menu rows when the data source reorders', async () => {
    const fixture = TestBed.createComponent(DataMenuHost);
    fixture.detectChanges();
    fixture.debugElement
      .query(By.directive(MlvMenuTrigger))
      .injector.get(MlvMenuTrigger)
      .open();
    await settle(fixture);

    const registry = fixture.debugElement
      .query(By.directive(MlvRegistryMenuProbe))
      .injector.get(MlvRegistryMenuProbe).registry;
    const rowLabels = () =>
      Array.from(
        overlayContainer
          .getContainerElement()
          .querySelectorAll('[role="menuitem"]'),
      ).map((row) => row.textContent?.trim());

    expect(rowLabels()).toEqual(['Alpha', 'Bravo', 'Charlie']);
    expect(labelsOf(registry.items())).toEqual(['Alpha', 'Bravo', 'Charlie']);

    fixture.componentInstance.items.set([
      { id: 'charlie', label: 'Charlie' },
      { id: 'alpha', label: 'Alpha' },
      { id: 'bravo', label: 'Bravo' },
    ]);
    await settle(fixture);

    expect(rowLabels()).toEqual(['Charlie', 'Alpha', 'Bravo']);
    expect(labelsOf(registry.items())).toEqual(rowLabels());
  });

  it('re-sorts generated menubar rows when the data source reorders', async () => {
    const fixture = TestBed.createComponent(DataMenubarHost);
    await settle(fixture);

    const registry = fixture.debugElement
      .query(By.directive(MlvRegistryMenubarProbe))
      .injector.get(MlvRegistryMenubarProbe).registry;
    const rowLabels = () =>
      Array.from(
        fixture.nativeElement.querySelectorAll('mlv-menu-data-item'),
      ).map((row) => (row as HTMLElement).textContent?.trim());

    expect(labelsOf(registry.items())).toEqual(['File', 'Edit', 'View']);

    fixture.componentInstance.items.set([
      { id: 'view', label: 'View' },
      { id: 'file', label: 'File' },
      { id: 'edit', label: 'Edit' },
    ]);
    await settle(fixture);

    expect(rowLabels()).toEqual(['View', 'File', 'Edit']);
    expect(labelsOf(registry.items())).toEqual(rowLabels());
  });
});
