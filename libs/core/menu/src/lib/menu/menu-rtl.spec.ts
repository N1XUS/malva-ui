import { Component, ViewChild, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { OverlayContainer } from '@angular/cdk/overlay';
import { Observable, Subject } from 'rxjs';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { MlvListItem } from '@malva-ui/core/list';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvMenu } from './menu';
import { MlvMenuItem } from './menu-item';
import { MlvMenuTrigger } from './menu-trigger';
import { MlvMenubar } from './menubar';
import { MlvMenuDataRenderer } from './menu-data-renderer';
import type { MlvMenuItemData } from './menu-data.types';

// Key codes CDK's ListKeyManager reads from `event.keyCode`.
const KEY = { left: 37, up: 38, right: 39, down: 40, home: 36, end: 35 };

/**
 * Dispatches a keydown whose `keyCode` is set (jsdom leaves it `0` otherwise),
 * which CDK's `FocusKeyManager` requires for arrow / Home / End navigation.
 */
function fireKey(element: Element, key: string, keyCode?: number): void {
  const event = new KeyboardEvent('keydown', { key, bubbles: true });
  if (keyCode !== undefined) {
    Object.defineProperty(event, 'keyCode', { get: () => keyCode });
  }
  element.dispatchEvent(event);
}

/** Flushes the `setTimeout(0)` hops the trigger uses to focus after opening. */
function flushTimers(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

type DataItem = MlvMenuItemData<Record<string, never>>;

@Component({
  imports: [MlvMenubar, MlvMenu, MlvMenuItem, MlvMenuTrigger, MlvListItem],
  template: `
    <div [attr.dir]="scopeDir()">
      <mlv-menubar aria-label="Main">
        <button [mlvMenuTrigger]="fileMenu">File</button>
        <button [mlvMenuTrigger]="editMenu">Edit</button>
        <button [mlvMenuTrigger]="viewMenu">View</button>
      </mlv-menubar>

      <mlv-menu #fileMenu label="File">
        <mlv-list-item mlvMenuItem>New</mlv-list-item>
        <mlv-list-item mlvMenuItem>Open</mlv-list-item>
      </mlv-menu>

      <mlv-menu #editMenu label="Edit">
        <mlv-list-item mlvMenuItem>Undo</mlv-list-item>
      </mlv-menu>

      <mlv-menu #viewMenu label="View">
        <mlv-list-item mlvMenuItem>Zoom</mlv-list-item>
      </mlv-menu>
    </div>
  `,
})
class ScopedMenubarHost {
  readonly scopeDir = signal<'ltr' | 'rtl'>('rtl');
}

@Component({
  imports: [MlvMenu, MlvMenuItem, MlvMenuTrigger, MlvListItem],
  template: `
    <div [attr.dir]="scopeDir()">
      <button [mlvMenuTrigger]="rootMenu">Open</button>

      <mlv-menu #rootMenu label="Settings">
        <mlv-list-item mlvMenuItem>Profile</mlv-list-item>
        <mlv-list-item
          mlvMenuItem
          [mlvMenuTrigger]="themeMenu"
          [isSubmenuTrigger]="true"
        >
          Appearance
        </mlv-list-item>
      </mlv-menu>

      <mlv-menu #themeMenu label="Appearance">
        <mlv-list-item mlvMenuItem>Light</mlv-list-item>
        <mlv-list-item mlvMenuItem>Dark</mlv-list-item>
      </mlv-menu>
    </div>
  `,
})
class ScopedNestedMenuHost {
  @ViewChild('rootMenu') rootMenu!: MlvMenu;
  @ViewChild('themeMenu') themeMenu!: MlvMenu;

  readonly scopeDir = signal<'ltr' | 'rtl'>('rtl');
}

@Component({
  imports: [MlvMenu, MlvMenuDataRenderer, MlvMenuTrigger],
  template: `
    <div [attr.dir]="scopeDir()">
      <button [mlvMenuTrigger]="menu">Open</button>
      <mlv-menu #menu label="Commands">
        <mlv-menu-data-renderer
          [items]="items"
          mode="menu"
          [parentMenu]="menu"
          [menubar]="null"
        />
      </mlv-menu>
    </div>
  `,
})
class ScopedDataMenuHost {
  readonly scopeDir = signal<'ltr' | 'rtl'>('rtl');
  readonly childrenSubject = new Subject<DataItem[]>();
  childrenSubscriptions = 0;
  readonly children$ = new Observable<DataItem[]>((subscriber) => {
    this.childrenSubscriptions++;
    return this.childrenSubject.subscribe(subscriber);
  });
  readonly items: readonly DataItem[] = [
    { id: 'recent', label: 'Recent', children: this.children$ },
    { id: 'share', label: 'Share' },
  ];
}

/**
 * The shape the other scoped hosts cannot express: the trigger sits **inside**
 * the `[dir]` subtree while the `<mlv-menu>` elements are declared **outside**
 * it, at page level. That is the normal authoring shape for menus declared once
 * and triggered from several places.
 *
 * It matters because the two disagree. `MlvPopupService` stamps the overlay
 * pane with `resolveDirection(config.origin)` — the *trigger* — so the panel
 * mirrors; but `<mlv-menu>`'s own host never moves, so resolving direction from
 * it yields the document's LTR. Arrow keys would then run the opposite way to
 * the layout the user sees, which is #147 with extra steps.
 */
@Component({
  imports: [MlvMenubar, MlvMenu, MlvMenuItem, MlvMenuTrigger, MlvListItem],
  template: `
    <div [attr.dir]="scopeDir()">
      <mlv-menubar aria-label="Main">
        <button [mlvMenuTrigger]="fileMenu">File</button>
        <button [mlvMenuTrigger]="editMenu">Edit</button>
        <button [mlvMenuTrigger]="viewMenu">View</button>
      </mlv-menubar>

      <button [mlvMenuTrigger]="rootMenu">Settings</button>
    </div>

    <!-- Declared outside the scope, as a page-level menu normally is. -->
    <mlv-menu #fileMenu label="File">
      <mlv-list-item mlvMenuItem>New</mlv-list-item>
      <mlv-list-item mlvMenuItem>Open</mlv-list-item>
    </mlv-menu>

    <mlv-menu #editMenu label="Edit">
      <mlv-list-item mlvMenuItem>Undo</mlv-list-item>
    </mlv-menu>

    <mlv-menu #viewMenu label="View">
      <mlv-list-item mlvMenuItem>Zoom</mlv-list-item>
    </mlv-menu>

    <mlv-menu #rootMenu label="Settings">
      <mlv-list-item mlvMenuItem>Profile</mlv-list-item>
      <mlv-list-item
        mlvMenuItem
        [mlvMenuTrigger]="themeMenu"
        [isSubmenuTrigger]="true"
      >
        Appearance
      </mlv-list-item>
    </mlv-menu>

    <mlv-menu #themeMenu label="Appearance">
      <mlv-list-item mlvMenuItem>Light</mlv-list-item>
      <mlv-list-item mlvMenuItem>Dark</mlv-list-item>
    </mlv-menu>
  `,
})
class DetachedMenuHost {
  @ViewChild('rootMenu') rootMenu!: MlvMenu;
  @ViewChild('themeMenu') themeMenu!: MlvMenu;

  readonly scopeDir = signal<'ltr' | 'rtl'>('rtl');
}

describe('menu direction (RTL)', () => {
  let overlayContainer: OverlayContainer;
  let overlayContainerEl: HTMLElement;
  let rtlService: MlvRtlService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ScopedMenubarHost,
        ScopedNestedMenuHost,
        ScopedDataMenuHost,
        DetachedMenuHost,
      ],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);
    overlayContainerEl = overlayContainer.getContainerElement();
    rtlService = TestBed.inject(MlvRtlService);
  });

  afterEach(() => {
    overlayContainer.ngOnDestroy();
    // `setDirection` is global state and writes `<html dir>`.
    rtlService.setDirection('ltr');
    document.documentElement.removeAttribute('dir');
  });

  /** Opens the menubar dropdown at `index` by clicking its top-level trigger. */
  async function openMenubarHost(dir: 'ltr' | 'rtl' = 'rtl') {
    const fixture = TestBed.createComponent(ScopedMenubarHost);
    fixture.componentInstance.scopeDir.set(dir);
    fixture.detectChanges();
    fixture.detectChanges();
    const buttons = fixture.debugElement
      .queryAll(By.css('.mlv-menubar button'))
      .map((d) => d.nativeElement as HTMLButtonElement);
    return { fixture, buttons };
  }

  /** Opens the standalone root menu of the nested host. */
  async function openNestedRoot(dir: 'ltr' | 'rtl' = 'rtl') {
    const fixture = TestBed.createComponent(ScopedNestedMenuHost);
    fixture.componentInstance.scopeDir.set(dir);
    fixture.detectChanges();
    fixture.debugElement.query(By.css('button')).nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  function panelLabels(): string[] {
    return Array.from(overlayContainerEl.querySelectorAll('[role="menu"]')).map(
      (panel) => panel.getAttribute('aria-label') ?? '',
    );
  }

  // ─── MlvMenu._onKeydown — menubar crossing ────────────────────────────────

  describe('MlvMenu panel crossing between menubar dropdowns', () => {
    it('crosses to the NEXT menubar menu on ArrowLeft inside a scoped [dir="rtl"] subtree while the document stays LTR', async () => {
      const { fixture, buttons } = await openMenubarHost('rtl');

      buttons[0].click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(rtlService.direction()).toBe('ltr');
      expect(panelLabels()).toEqual(['File']);

      const panel = overlayContainerEl.querySelector(
        '[role="menu"][aria-label="File"]',
      ) as HTMLElement;
      fireKey(panel, 'ArrowLeft', KEY.left);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // ArrowLeft is "next" once mirrored — File → Edit, never File → View.
      // The outgoing panel lingers through its leave animation, so assert on
      // which menu was *opened* rather than on the whole panel list.
      expect(panelLabels()).toContain('Edit');
      expect(panelLabels()).not.toContain('View');
    });

    it('crosses to the PREVIOUS menubar menu on ArrowRight inside the same scope', async () => {
      const { fixture, buttons } = await openMenubarHost('rtl');

      buttons[1].click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const panel = overlayContainerEl.querySelector(
        '[role="menu"][aria-label="Edit"]',
      ) as HTMLElement;
      fireKey(panel, 'ArrowRight', KEY.right);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // ArrowRight is "previous" once mirrored — Edit → File, never Edit → View.
      expect(panelLabels()).toContain('File');
      expect(panelLabels()).not.toContain('View');
    });

    it('stays unmirrored inside a [dir="ltr"] island while the document is RTL', async () => {
      rtlService.setDirection('rtl');
      const { fixture, buttons } = await openMenubarHost('ltr');

      buttons[0].click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const panel = overlayContainerEl.querySelector(
        '[role="menu"][aria-label="File"]',
      ) as HTMLElement;
      fireKey(panel, 'ArrowRight', KEY.right);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // LTR island: ArrowRight is still "next".
      expect(panelLabels()).toContain('Edit');
      expect(panelLabels()).not.toContain('View');
    });
  });

  // ─── MlvMenu._onKeydown — submenu close ───────────────────────────────────

  describe('MlvMenu submenu close', () => {
    /** Opens the root menu and its "Appearance" submenu by hovering the row. */
    async function openSubmenu(dir: 'ltr' | 'rtl' = 'rtl') {
      const fixture = await openNestedRoot(dir);

      const row = Array.from(
        overlayContainerEl.querySelectorAll('[role="menuitem"]'),
      ).find((item) => item.textContent?.includes('Appearance')) as HTMLElement;

      row.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      fixture.detectChanges();
      await fixture.whenStable();
      await flushTimers();
      fixture.detectChanges();

      expect(fixture.componentInstance.themeMenu._isOpen()).toBe(true);
      return { fixture, row };
    }

    it('closes the submenu on ArrowRight inside a scoped [dir="rtl"] subtree while the document stays LTR', async () => {
      const { fixture } = await openSubmenu('rtl');

      expect(rtlService.direction()).toBe('ltr');

      const submenuPanel = overlayContainerEl.querySelector(
        '[role="menu"][aria-label="Appearance"]',
      ) as HTMLElement;
      fireKey(submenuPanel, 'ArrowRight', KEY.right);
      fixture.detectChanges();
      await fixture.whenStable();

      // ArrowRight is "previous" once mirrored, so it closes the submenu.
      expect(fixture.componentInstance.themeMenu._isOpen()).toBe(false);
      expect(fixture.componentInstance.rootMenu._isOpen()).toBe(true);
    });

    it('keeps vertical arrows and Home unchanged in the same scope', async () => {
      const { fixture } = await openSubmenu('rtl');

      const submenuPanel = overlayContainerEl.querySelector(
        '[role="menu"][aria-label="Appearance"]',
      ) as HTMLElement;

      fireKey(submenuPanel, 'ArrowDown', KEY.down);
      fireKey(submenuPanel, 'ArrowUp', KEY.up);
      fireKey(submenuPanel, 'Home', KEY.home);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(fixture.componentInstance.themeMenu._isOpen()).toBe(true);
    });
  });

  // ─── MlvMenu._onKeydown — menu declared OUTSIDE the trigger's scope ────────

  describe("MlvMenu declared outside the trigger's [dir] scope", () => {
    /** Opens a menubar dropdown from a trigger inside the scope. */
    async function openDetachedMenubar(dir: 'ltr' | 'rtl' = 'rtl') {
      const fixture = TestBed.createComponent(DetachedMenuHost);
      fixture.componentInstance.scopeDir.set(dir);
      fixture.detectChanges();
      fixture.detectChanges();
      const buttons = fixture.debugElement
        .queryAll(By.css('.mlv-menubar button'))
        .map((d) => d.nativeElement as HTMLButtonElement);
      return { fixture, buttons };
    }

    it('opens a mirrored pane from a host that resolves LTR', async () => {
      const { fixture, buttons } = await openDetachedMenubar('rtl');
      buttons[1].click();
      fixture.detectChanges();
      await fixture.whenStable();

      // CDK stamps the direction on the connected-position bounding box that
      // wraps the pane, not on the pane itself.
      const pane = overlayContainerEl.querySelector(
        '.cdk-overlay-connected-position-bounding-box',
      ) as HTMLElement;
      const menuHost = fixture.nativeElement.querySelector(
        'mlv-menu',
      ) as HTMLElement;

      // The premise of this whole block, asserted rather than assumed: the pane
      // follows the trigger, the `<mlv-menu>` host follows the document.
      expect(pane.getAttribute('dir')).toBe('rtl');
      // The host sits under no scoped [dir] — its nearest one is the document's.
      expect(menuHost.closest('[dir]')).toBe(document.documentElement);
      expect(rtlService.direction()).toBe('ltr');
    });

    it('crosses to the NEXT menubar menu on ArrowLeft', async () => {
      const { fixture, buttons } = await openDetachedMenubar('rtl');
      buttons[1].click();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(panelLabels()).toContain('Edit');

      const panel = overlayContainerEl.querySelector(
        '[role="menu"][aria-label="Edit"]',
      ) as HTMLElement;
      fireKey(panel, 'ArrowLeft', KEY.left);
      fixture.detectChanges();
      await fixture.whenStable();

      // ArrowLeft is "next" in a mirrored pane.
      expect(panelLabels()).toContain('View');
    });

    it('crosses to the PREVIOUS menubar menu on ArrowRight', async () => {
      const { fixture, buttons } = await openDetachedMenubar('rtl');
      buttons[1].click();
      fixture.detectChanges();
      await fixture.whenStable();

      const panel = overlayContainerEl.querySelector(
        '[role="menu"][aria-label="Edit"]',
      ) as HTMLElement;
      fireKey(panel, 'ArrowRight', KEY.right);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(panelLabels()).toContain('File');
    });

    it('closes the submenu on ArrowRight', async () => {
      const fixture = TestBed.createComponent(DetachedMenuHost);
      fixture.componentInstance.scopeDir.set('rtl');
      fixture.detectChanges();
      const settings = fixture.debugElement
        .queryAll(By.css('button'))
        .map((d) => d.nativeElement as HTMLButtonElement)
        .find((b) => b.textContent?.includes('Settings')) as HTMLButtonElement;
      settings.click();
      fixture.detectChanges();
      await fixture.whenStable();

      const row = Array.from(
        overlayContainerEl.querySelectorAll('[role="menuitem"]'),
      ).find((item) => item.textContent?.includes('Appearance')) as HTMLElement;
      row.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      fixture.detectChanges();
      await fixture.whenStable();
      await flushTimers();
      fixture.detectChanges();
      expect(fixture.componentInstance.themeMenu._isOpen()).toBe(true);

      const submenuPanel = overlayContainerEl.querySelector(
        '[role="menu"][aria-label="Appearance"]',
      ) as HTMLElement;
      fireKey(submenuPanel, 'ArrowRight', KEY.right);
      fixture.detectChanges();
      await fixture.whenStable();

      // ArrowRight is "previous" once mirrored, so it closes the submenu.
      expect(fixture.componentInstance.themeMenu._isOpen()).toBe(false);
      expect(fixture.componentInstance.rootMenu._isOpen()).toBe(true);
    });

    it('stays unmirrored when the trigger scope is LTR under an RTL document', async () => {
      rtlService.setDirection('rtl');
      const { fixture, buttons } = await openDetachedMenubar('ltr');
      buttons[1].click();
      fixture.detectChanges();
      await fixture.whenStable();

      const panel = overlayContainerEl.querySelector(
        '[role="menu"][aria-label="Edit"]',
      ) as HTMLElement;
      fireKey(panel, 'ArrowRight', KEY.right);
      fixture.detectChanges();
      await fixture.whenStable();

      // ArrowRight is "next" in the LTR island the trigger sits in, even though
      // the document — and so `<mlv-menu>`'s own host — is RTL.
      expect(panelLabels()).toContain('View');
    });
  });

  // ─── MlvMenuTrigger._onKeydown — submenu open ─────────────────────────────

  describe('MlvMenuTrigger submenu opening', () => {
    it('opens the submenu on ArrowLeft inside a scoped [dir="rtl"] subtree while the document stays LTR', async () => {
      const fixture = await openNestedRoot('rtl');

      expect(rtlService.direction()).toBe('ltr');

      const row = Array.from(
        overlayContainerEl.querySelectorAll('[role="menuitem"]'),
      ).find((item) => item.textContent?.includes('Appearance')) as HTMLElement;

      fireKey(row, 'ArrowLeft', KEY.left);
      fixture.detectChanges();
      await fixture.whenStable();
      await flushTimers();
      fixture.detectChanges();

      // ArrowLeft is "into the submenu" once mirrored.
      expect(fixture.componentInstance.themeMenu._isOpen()).toBe(true);
    });

    it('stays unmirrored inside a [dir="ltr"] island while the document is RTL', async () => {
      rtlService.setDirection('rtl');
      const fixture = await openNestedRoot('ltr');

      const row = Array.from(
        overlayContainerEl.querySelectorAll('[role="menuitem"]'),
      ).find((item) => item.textContent?.includes('Appearance')) as HTMLElement;

      fireKey(row, 'ArrowRight', KEY.right);
      fixture.detectChanges();
      await fixture.whenStable();
      await flushTimers();
      fixture.detectChanges();

      expect(fixture.componentInstance.themeMenu._isOpen()).toBe(true);
    });
  });

  // ─── MlvMenuItem._onKeydown — generated submenu rows ──────────────────────

  describe('MlvMenuItem generated submenu rows', () => {
    async function openDataMenu(dir: 'ltr' | 'rtl' = 'rtl') {
      const fixture = TestBed.createComponent(ScopedDataMenuHost);
      fixture.componentInstance.scopeDir.set(dir);
      fixture.detectChanges();
      fixture.debugElement.query(By.css('button')).nativeElement.click();
      fixture.detectChanges();
      await fixture.whenStable();

      const row = overlayContainerEl.querySelector(
        '[role="menuitem"]',
      ) as HTMLElement;
      return { fixture, row };
    }

    it('opens a generated submenu on ArrowLeft inside a scoped [dir="rtl"] subtree while the document stays LTR', async () => {
      const { fixture, row } = await openDataMenu('rtl');

      expect(rtlService.direction()).toBe('ltr');
      expect(fixture.componentInstance.childrenSubscriptions).toBe(0);

      fireKey(row, 'ArrowLeft', KEY.left);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(row.getAttribute('aria-expanded')).toBe('true');
      expect(fixture.componentInstance.childrenSubscriptions).toBe(1);
    });

    it('leaves ArrowRight inert in the same scope', async () => {
      const { fixture, row } = await openDataMenu('rtl');

      fireKey(row, 'ArrowRight', KEY.right);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(row.getAttribute('aria-expanded')).toBe('false');
      expect(fixture.componentInstance.childrenSubscriptions).toBe(0);
    });
  });

  // ─── MlvMenubar FocusKeyManager orientation ───────────────────────────────

  describe('MlvMenubar roving tabindex', () => {
    it('moves to the NEXT top-level item on ArrowLeft inside a scoped [dir="rtl"] subtree while the document stays LTR', async () => {
      const { fixture, buttons } = await openMenubarHost('rtl');

      expect(rtlService.direction()).toBe('ltr');
      expect(buttons[0].getAttribute('tabindex')).toBe('0');

      fireKey(buttons[0], 'ArrowLeft', KEY.left);
      fixture.detectChanges();

      // Mirrored: ArrowLeft advances File → Edit rather than wrapping to View.
      expect(buttons[1].getAttribute('tabindex')).toBe('0');
      expect(buttons[2].getAttribute('tabindex')).toBe('-1');
    });

    it('keeps Home / End and vertical arrows unchanged in the same scope', async () => {
      const { fixture, buttons } = await openMenubarHost('rtl');

      fireKey(buttons[0], 'End', KEY.end);
      fixture.detectChanges();
      expect(buttons[2].getAttribute('tabindex')).toBe('0');

      fireKey(buttons[2], 'Home', KEY.home);
      fixture.detectChanges();
      expect(buttons[0].getAttribute('tabindex')).toBe('0');

      // Vertical keys open the focused menu; they never move the roving index.
      fireKey(buttons[0], 'ArrowDown', KEY.down);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(buttons[0].getAttribute('tabindex')).toBe('0');
    });

    it('stays unmirrored inside a [dir="ltr"] island while the document is RTL', async () => {
      rtlService.setDirection('rtl');
      const { fixture, buttons } = await openMenubarHost('ltr');

      fireKey(buttons[0], 'ArrowRight', KEY.right);
      fixture.detectChanges();

      expect(buttons[1].getAttribute('tabindex')).toBe('0');
    });
  });
});
