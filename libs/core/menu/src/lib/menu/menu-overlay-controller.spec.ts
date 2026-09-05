import type {
  ElementRef,
  TemplateRef,
  ViewContainerRef,
  WritableSignal,
} from '@angular/core';
import {
  Component,
  Injector,
  runInInjectionContext,
  signal,
} from '@angular/core';
import type { NgZone } from '@angular/core';
import type { ConnectedPosition, OverlayRef } from '@angular/cdk/overlay';
import { OverlayContainer } from '@angular/cdk/overlay';
import {
  MENU_POSITIONS,
  MlvPopupService,
  SUBMENU_POSITIONS,
} from '@malva-ui/core/popup';
import type { MlvPopupHandle, MlvPopupOpenConfig } from '@malva-ui/core/popup';
import { Subject } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { By } from '@angular/platform-browser';
import { MlvListItem } from '@malva-ui/core/list';
import { MlvMenuOverlayController } from './menu-overlay-controller';
import { MlvMenu } from './menu';
import { MlvMenuItem } from './menu-item';
import { MlvMenuTrigger } from './menu-trigger';
import { MlvMenubar } from './menubar';
import type { MlvMenu } from './menu';
import type { MlvMenuAccessor } from './menu.types';
import type {
  MlvMenubarAccessor,
  MlvMenubarItem,
  MlvMenubarMenuController,
} from './menubar.types';

type PopupAnimationState = 'enter' | 'leave' | 'idle';

interface PopupLike {
  readonly animationState: WritableSignal<PopupAnimationState>;
  readonly leaveAnimationDone$: Subject<void>;
  readonly opened: WritableSignal<boolean>;
  beginEnterAnimation(): void;
  popupTemplate(): TemplateRef<unknown>;
  updateArrowFromPosition(position: ConnectedPosition): void;
}

interface MenuLike {
  readonly _isOpen: WritableSignal<boolean>;
  readonly _popup: ReturnType<typeof vi.fn>;
  readonly closed: Subject<void>;
  readonly close: ReturnType<typeof vi.fn>;
  readonly focusFirstItem: ReturnType<typeof vi.fn>;
  readonly focusLastItem: ReturnType<typeof vi.fn>;
  readonly popup: PopupLike;
  registerMenubarController(controller: MlvMenubarMenuController | null): void;
  registerParentMenu(parentMenu: MlvMenuAccessor | null): void;
}

interface PopupHarness {
  readonly popupService: { open: ReturnType<typeof vi.fn> };
  readonly handle: MlvPopupHandle;
  readonly overlayElement: HTMLElement;
  config: MlvPopupOpenConfig | null;
}

function createPopupHarness(): PopupHarness {
  const overlayElement = document.createElement('div');
  const overlayRef = { overlayElement } as OverlayRef;

  const harness: PopupHarness = {
    popupService: {
      open: vi.fn((config: MlvPopupOpenConfig) => {
        harness.config = config;
        return harness.handle;
      }),
    },
    handle: {
      overlayRef,
      close: vi.fn(() => harness.config?.onClose()),
      setPositionOrigin: vi.fn(),
    },
    overlayElement,
    config: null,
  };

  return harness;
}

function createPopup(): PopupLike {
  return {
    animationState: signal<PopupAnimationState>('idle'),
    leaveAnimationDone$: new Subject<void>(),
    opened: signal(false),
    beginEnterAnimation: vi.fn(function (this: PopupLike) {
      this.animationState.set('enter');
    }),
    popupTemplate: vi.fn(() => null as unknown as TemplateRef<unknown>),
    updateArrowFromPosition: vi.fn(),
  };
}

function createMenu(): MenuLike {
  const popup = createPopup();

  return {
    _isOpen: signal(false),
    _popup: vi.fn(() => popup),
    closed: new Subject<void>(),
    close: vi.fn(function (this: MenuLike) {
      this.closed.next();
    }),
    focusFirstItem: vi.fn(),
    focusLastItem: vi.fn(),
    popup,
    registerMenubarController: vi.fn(),
    registerParentMenu: vi.fn(),
  };
}

function createMenubarItem(): MlvMenubarItem {
  return {
    _tabIndex: signal(-1),
    disabledBoolean: false,
    closeMenu: vi.fn(),
    focus: vi.fn(),
    getLabel: vi.fn(() => 'File'),
    isMenuOpen: vi.fn(() => false),
    openMenu: vi.fn(),
    openMenuWithFirstItemFocused: vi.fn(),
    openMenuWithLastItemFocused: vi.fn(),
  };
}

function createMenubar(): MlvMenubarAccessor {
  return {
    hostElement: document.createElement('div'),
    hasOpenMenu: vi.fn(() => false),
    notifyItemClosed: vi.fn(),
    notifyItemOpened: vi.fn(),
    onItemPointerEnter: vi.fn(),
    openAdjacentItemMenu: vi.fn(),
  };
}

function createOrigin(): ElementRef<HTMLElement> {
  const nativeElement = document.createElement('button');
  document.body.appendChild(nativeElement);
  return { nativeElement };
}

function createController(options?: {
  isDisabled?: () => boolean;
  isMenubarChild?: boolean;
  isSubmenu?: boolean;
  menu?: MenuLike;
  menubar?: MlvMenubarAccessor | null;
  menubarItem?: MlvMenubarItem | null;
  origin?: ElementRef<HTMLElement>;
  parentMenu?: MlvMenuAccessor | null;
  popupHarness?: PopupHarness;
}) {
  const popupHarness = options?.popupHarness ?? createPopupHarness();
  const menu = options?.menu ?? createMenu();
  const origin = options?.origin ?? createOrigin();
  const menubar = options?.menubar ?? null;
  const menubarItem = options?.menubarItem ?? createMenubarItem();
  const injector = TestBed.inject(Injector);
  const zone = {
    runOutsideAngular: <T>(fn: () => T) => fn(),
    run: <T>(fn: () => T) => fn(),
  } as unknown as NgZone;
  const controller = runInInjectionContext(
    injector,
    () =>
      new MlvMenuOverlayController(
        {
          getMenu: () => menu as unknown as MlvMenu,
          getMenubarItem: () => menubarItem,
          isDisabled: options?.isDisabled ?? (() => false),
          isMenubarChild: options?.isMenubarChild ?? false,
          isSubmenu: () => options?.isSubmenu ?? false,
          menubar,
          origin,
          parentMenu: options?.parentMenu ?? null,
          requestClose: undefined,
          vcr: {} as ViewContainerRef,
        },
        {
          ngZone: zone,
          popupService: popupHarness.popupService,
        },
      ),
  );

  return { controller, menu, menubar, menubarItem, origin, popupHarness };
}

/**
 * Counts listeners added and removed on a target, so a test can assert *which*
 * object received one. Returns a live map of type to net count.
 */
function trackListeners(target: EventTarget): Map<string, number> {
  const net = new Map<string, number>();
  const bump = (type: string, delta: number): void =>
    void net.set(type, (net.get(type) ?? 0) + delta);
  const realAdd = target.addEventListener.bind(target);
  const realRemove = target.removeEventListener.bind(target);
  vi.spyOn(target, 'addEventListener').mockImplementation(
    (type, listener, options) => {
      bump(type, 1);
      realAdd(type, listener, options);
    },
  );
  vi.spyOn(target, 'removeEventListener').mockImplementation(
    (type, listener, options) => {
      bump(type, -1);
      realRemove(type, listener, options);
    },
  );
  return net;
}

async function flushOpenLifecycle(): Promise<void> {
  await Promise.resolve();
  await vi.runOnlyPendingTimersAsync();
}

@Component({
  imports: [MlvMenu, MlvMenuItem, MlvMenuTrigger, MlvMenubar, MlvListItem],
  template: `
    <mlv-menubar aria-label="Main">
      <button #barButton [mlvMenuTrigger]="barMenu">File</button>
    </mlv-menubar>
    <mlv-menu #barMenu label="File">
      <mlv-list-item mlvMenuItem>Open</mlv-list-item>
    </mlv-menu>

    <button #rootButton [mlvMenuTrigger]="rootMenu">Settings</button>
    <mlv-menu #rootMenu label="Settings">
      <mlv-list-item
        mlvMenuItem
        [mlvMenuTrigger]="childMenu"
        [isSubmenuTrigger]="true"
        >Appearance</mlv-list-item
      >
    </mlv-menu>
    <mlv-menu #childMenu label="Appearance">
      <mlv-list-item mlvMenuItem>Dark</mlv-list-item>
    </mlv-menu>
  `,
})
class RealOverlayHost {}

describe('MlvMenuOverlayController', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
    vi.useFakeTimers();
  });

  describe('real CDK overlay integration', () => {
    let overlayContainer: OverlayContainer;
    let overlayContainerElement: HTMLElement;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [RealOverlayHost],
      }).compileComponents();
      overlayContainer = TestBed.inject(OverlayContainer);
      overlayContainerElement = overlayContainer.getContainerElement();
    });

    afterEach(() => {
      overlayContainer.ngOnDestroy();
    });

    async function createRealHost() {
      const fixture = TestBed.createComponent(RealOverlayHost);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      return {
        fixture,
        barButton: fixture.debugElement.query(By.css('.mlv-menubar button'))
          .nativeElement as HTMLButtonElement,
        rootButton: fixture.debugElement
          .queryAll(By.css('button'))
          .map(
            (debugElement) => debugElement.nativeElement as HTMLButtonElement,
          )
          .find(
            (button) => !button.closest('.mlv-menubar'),
          ) as HTMLButtonElement,
      };
    }

    it('uses connected root positioning with a backdrop and restores focus through the real overlay', async () => {
      const { fixture, rootButton } = await createRealHost();
      const popupService = TestBed.inject(MlvPopupService);
      const open = vi.spyOn(popupService, 'open');
      rootButton.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(
        overlayContainerElement.querySelector(
          '[role="menu"][aria-label="Settings"]',
        ),
      ).toBeTruthy();
      expect(
        overlayContainerElement.querySelector(
          '.cdk-overlay-connected-position-bounding-box',
        ),
      ).toBeTruthy();
      expect(
        overlayContainerElement.querySelector('.cdk-overlay-backdrop'),
      ).toBeTruthy();
      expect(open).toHaveBeenCalledWith(
        expect.objectContaining({ positions: MENU_POSITIONS }),
      );

      const panel = overlayContainerElement.querySelector(
        '[role="menu"][aria-label="Settings"]',
      ) as HTMLElement;
      (panel.querySelector('[role="menuitem"]') as HTMLElement).focus();
      panel.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
      fixture.detectChanges();
      await fixture.whenStable();
      overlayContainerElement
        .querySelector('.mlv-popup--leave')
        ?.dispatchEvent(new Event('animationend', { bubbles: true }));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(
        overlayContainerElement.querySelector(
          '[role="menu"][aria-label="Settings"]',
        ),
      ).toBeNull();
      expect(document.activeElement).toBe(rootButton);
    });

    it('uses connected submenu positioning without a backdrop and keeps the menubar host excluded from dismissal', async () => {
      const { fixture, rootButton, barButton } = await createRealHost();
      const popupService = TestBed.inject(MlvPopupService);
      const open = vi.spyOn(popupService, 'open');
      rootButton.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const submenuTrigger = Array.from(
        overlayContainerElement.querySelectorAll('[role="menuitem"]'),
      ).find(
        (item) => item.textContent?.trim() === 'Appearance',
      ) as HTMLElement;
      submenuTrigger.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
      );
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(
        overlayContainerElement.querySelector(
          '[role="menu"][aria-label="Appearance"]',
        ),
      ).toBeTruthy();
      expect(
        overlayContainerElement.querySelectorAll(
          '.cdk-overlay-connected-position-bounding-box',
        ).length,
      ).toBe(2);
      expect(
        overlayContainerElement.querySelectorAll('.cdk-overlay-backdrop')
          .length,
      ).toBe(1);
      expect(open).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ positions: MENU_POSITIONS }),
      );
      expect(open).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ positions: SUBMENU_POSITIONS }),
      );

      const menubar = fixture.debugElement.query(By.directive(MlvMenubar))
        .componentInstance as MlvMenubar;
      const opened = vi.spyOn(menubar, 'notifyItemOpened');
      const closed = vi.spyOn(menubar, 'notifyItemClosed');
      barButton.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(barButton.getAttribute('aria-expanded')).toBe('true');
      expect(
        overlayContainerElement.querySelector(
          '[role="menu"][aria-label="File"]',
        ),
      ).toBeTruthy();
      expect(opened).toHaveBeenCalledTimes(1);
      expect(
        overlayContainerElement.querySelectorAll('.cdk-overlay-backdrop')
          .length,
      ).toBe(1);

      (
        overlayContainerElement.querySelector(
          '[role="menu"][aria-label="File"]',
        ) as HTMLElement
      ).dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
      fixture.detectChanges();
      await fixture.whenStable();
      overlayContainerElement
        .querySelector('.mlv-popup--leave')
        ?.dispatchEvent(new Event('animationend', { bubbles: true }));
      fixture.detectChanges();
      await fixture.whenStable();
      expect(closed).toHaveBeenCalledTimes(1);
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('does nothing when disabled and does not re-open an already-open overlay', async () => {
    const disabledHarness = createController({
      isDisabled: () => true,
    });

    disabledHarness.controller.open();

    expect(
      disabledHarness.popupHarness.popupService.open,
    ).not.toHaveBeenCalled();

    const enabledHarness = createController();

    enabledHarness.controller.open();
    await flushOpenLifecycle();
    enabledHarness.controller.open();

    expect(enabledHarness.popupHarness.popupService.open).toHaveBeenCalledTimes(
      1,
    );
  });

  it('runs the close lifecycle after the popup leave animation finishes', async () => {
    const { controller, menu, popupHarness } = createController();

    controller.open();
    await flushOpenLifecycle();

    expect(controller.isOpen()).toBe(true);
    expect(menu._isOpen()).toBe(true);
    expect(menu.popup.opened()).toBe(true);

    controller.close();

    expect(menu.popup.animationState()).toBe('leave');
    expect(controller.isOpen()).toBe(true);

    menu.popup.leaveAnimationDone$.next();

    expect(popupHarness.handle.close).toHaveBeenCalledTimes(1);
    expect(controller.isOpen()).toBe(false);
    expect(menu._isOpen()).toBe(false);
    expect(menu.popup.opened()).toBe(false);
    expect(menu.popup.animationState()).toBe('idle');
  });

  it('cancels the delayed submenu close when the pointer re-enters the trigger', async () => {
    const { controller, popupHarness } = createController({
      isSubmenu: true,
    });
    const close = vi.spyOn(controller, 'close');

    controller.open();
    await flushOpenLifecycle();

    popupHarness.overlayElement.dispatchEvent(
      new MouseEvent('mouseenter', { bubbles: true }),
    );
    popupHarness.overlayElement.dispatchEvent(
      new MouseEvent('mouseleave', { bubbles: true, relatedTarget: null }),
    );

    controller.onMouseEnter();
    await vi.advanceTimersByTimeAsync(200);

    expect(close).not.toHaveBeenCalled();
    expect(controller.isOpen()).toBe(true);
  });

  it('notifies the parent menubar when a menubar child opens and closes', async () => {
    const menubar = createMenubar();
    const menubarItem = createMenubarItem();
    const { controller, menu } = createController({
      isMenubarChild: true,
      menubar,
      menubarItem,
    });

    controller.open();
    await flushOpenLifecycle();

    expect(menubar.notifyItemOpened).toHaveBeenCalledWith(menubarItem);
    expect(menu.registerMenubarController).toHaveBeenCalledWith(
      expect.objectContaining({
        openNextItemMenu: expect.any(Function),
        openPreviousItemMenu: expect.any(Function),
      }),
    );

    controller.close();
    menu.popup.leaveAnimationDone$.next();

    expect(menubar.notifyItemClosed).toHaveBeenCalledWith(menubarItem);
  });

  // Under server rendering the injected `DOCUMENT` and the ambient `document`
  // global are different objects *and the global is defined*, so binding the
  // ambient one attaches a per-open listener to a process-wide object that
  // `_removeMousemoveListener()` never reaches — and nothing throws, so no
  // other assertion in this suite can see it. Asserting *which* object got the
  // listener is the only thing that can.
  it('binds submenu hover-intent tracking to the injected DOCUMENT, not the ambient global', async () => {
    const isolated = document.implementation.createHTMLDocument('menu');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: DOCUMENT, useValue: isolated }],
    });

    const isolatedNet = trackListeners(isolated);
    const ambientNet = trackListeners(document);

    const { controller, menu } = createController({ isSubmenu: true });
    controller.open();
    await flushOpenLifecycle();
    // `_setupSubmenuTracking` installs the tracker from a `setTimeout(0)`.
    await vi.advanceTimersByTimeAsync(0);

    expect(isolatedNet.get('mousemove')).toBeGreaterThan(0);
    expect(ambientNet.get('mousemove')).toBeUndefined();

    // And the same document is the one it is released from. `close()` only
    // starts the leave animation; the teardown runs once it reports done.
    controller.close();
    menu.popup.leaveAnimationDone$.next();
    await vi.runOnlyPendingTimersAsync();
    expect(isolatedNet.get('mousemove')).toBe(0);

    vi.restoreAllMocks();
  });
});
