import type { BooleanInput } from '@angular/cdk/coercion';
import { Component, Directive, inject, signal } from '@angular/core';
import type { ElementRef, InputSignalWithTransform } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { OverlayContainer } from '@angular/cdk/overlay';
import { MlvListItem } from '@malva-ui/core/list';
import { expectTypeOf } from 'vitest';
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

function createMenuKeyItem(label: string): MenuKeyItem {
  return {
    _tabIndex: signal(-1),
    disabledBoolean: false,
    focus: noop,
    getLabel: () => label,
  };
}

function createMenubarItem(label: string): MlvMenubarItem {
  return {
    _tabIndex: signal(-1),
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
