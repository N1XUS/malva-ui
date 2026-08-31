import { Component, ViewChild, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { OverlayContainer } from '@angular/cdk/overlay';
import { MlvMenu } from './menu';
import { MlvMenuItem } from './menu-item';
import { MlvMenuSeparator } from './menu-separator';
import { MlvMenuGroup } from './menu-group';
import { MlvMenuTrigger } from './menu-trigger';
import { MlvListItem, MlvListItemPrefix } from '@malva-ui/core/list';

// ─── Test host components ─────────────────────────────────────────────────────

@Component({
  imports: [
    MlvMenu,
    MlvMenuItem,
    MlvMenuSeparator,
    MlvMenuTrigger,
    MlvListItem,
  ],
  template: `
    <button [mlvMenuTrigger]="menu">Open</button>
    <mlv-menu #menu>
      <mlv-list-item mlvMenuItem (itemClick)="onEdit()">Edit</mlv-list-item>
      <mlv-menu-separator />
      <mlv-list-item mlvMenuItem (itemClick)="onDelete()">Delete</mlv-list-item>
    </mlv-menu>
  `,
})
class BasicMenuHost {
  editCalled = false;
  deleteCalled = false;
  onEdit() {
    this.editCalled = true;
  }
  onDelete() {
    this.deleteCalled = true;
  }
}

@Component({
  imports: [MlvMenu, MlvMenuItem, MlvMenuTrigger, MlvListItem],
  template: `
    <button [mlvMenuTrigger]="menu">Open</button>
    <mlv-menu #menu>
      <mlv-list-item mlvMenuItem disabled>Cannot click</mlv-list-item>
      <mlv-list-item mlvMenuItem (itemClick)="onAction()">Action</mlv-list-item>
    </mlv-menu>
  `,
})
class DisabledItemHost {
  actionCalled = false;
  onAction() {
    this.actionCalled = true;
  }
}

@Component({
  imports: [MlvMenu, MlvMenuItem, MlvMenuGroup, MlvMenuTrigger, MlvListItem],
  template: `
    <button [mlvMenuTrigger]="menu">Open</button>
    <mlv-menu #menu label="File Actions">
      <mlv-menu-group>
        <mlv-list-item mlvMenuItem (itemClick)="onNew()">New</mlv-list-item>
        <mlv-list-item mlvMenuItem (itemClick)="onOpen()">Open</mlv-list-item>
      </mlv-menu-group>
    </mlv-menu>
  `,
})
class GroupMenuHost {
  newCalled = false;
  openCalled = false;
  onNew() {
    this.newCalled = true;
  }
  onOpen() {
    this.openCalled = true;
  }
}

@Component({
  imports: [MlvMenu, MlvMenuItem, MlvMenuTrigger, MlvListItem],
  template: `
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
      <mlv-list-item mlvMenuItem (itemClick)="onAction('Light')"
        >Light</mlv-list-item
      >
      <mlv-list-item mlvMenuItem (itemClick)="onAction('Dark')"
        >Dark</mlv-list-item
      >
    </mlv-menu>
  `,
})
class NestedMenuHost {
  @ViewChild('rootMenu') rootMenu!: MlvMenu;
  @ViewChild('themeMenu') themeMenu!: MlvMenu;

  action = '';

  onAction(value: string): void {
    this.action = value;
  }
}

@Component({
  imports: [MlvMenu, MlvMenuItem, MlvMenuTrigger, MlvListItem],
  template: `
    <button [mlvMenuTrigger]="rootMenu">Open</button>

    <mlv-menu #rootMenu label="Actions">
      <mlv-list-item
        mlvMenuItem
        [mlvMenuTrigger]="disabledMenu"
        [isSubmenuTrigger]="true"
        [menuTriggerDisabled]="true"
        (itemClick)="onLeafAction()"
      >
        More options
      </mlv-list-item>
    </mlv-menu>

    <mlv-menu #disabledMenu label="More options">
      <mlv-list-item mlvMenuItem>Unavailable child</mlv-list-item>
    </mlv-menu>
  `,
})
class DisabledSubmenuTriggerHost {
  @ViewChild('rootMenu') rootMenu!: MlvMenu;
  @ViewChild('disabledMenu') disabledMenu!: MlvMenu;

  leafActivations = 0;

  onLeafAction(): void {
    this.leafActivations += 1;
  }
}

@Component({
  imports: [
    MlvMenu,
    MlvMenuItem,
    MlvMenuTrigger,
    MlvListItem,
    MlvListItemPrefix,
  ],
  template: `
    <button [mlvMenuTrigger]="menu">Open</button>
    <mlv-menu #menu>
      <mlv-list-item mlvMenuItem>
        <span mlvListItemPrefix data-prefix>+</span>
        Edit
      </mlv-list-item>
    </mlv-menu>
  `,
})
class PrefixMenuHost {}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MlvMenu', () => {
  let overlayContainer: OverlayContainer;
  let overlayContainerEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BasicMenuHost, DisabledItemHost, GroupMenuHost],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);
    overlayContainerEl = overlayContainer.getContainerElement();
  });

  afterEach(() => {
    overlayContainer.ngOnDestroy();
  });

  it('should create menu component', () => {
    const fixture = TestBed.createComponent(BasicMenuHost);
    fixture.detectChanges();
    const menu = fixture.debugElement.query(By.directive(MlvMenu));
    expect(menu).toBeTruthy();
  });

  it('should render menu items in overlay after opening', async () => {
    const fixture = TestBed.createComponent(BasicMenuHost);
    fixture.detectChanges();
    const trigger = fixture.debugElement.query(By.css('button'));

    trigger.nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();

    // Menu items are rendered in the CDK overlay, not in the fixture DOM
    const items = overlayContainerEl.querySelectorAll('[role="menuitem"]');
    expect(items.length).toBe(2);
  });

  it('should render separator', async () => {
    const fixture = TestBed.createComponent(BasicMenuHost);
    fixture.detectChanges();
    const trigger = fixture.debugElement.query(By.css('button'));

    trigger.nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();

    // Separator is rendered in the overlay after opening
    const separator = overlayContainerEl.querySelector(
      '.mlv-menu-separator__line',
    );
    expect(separator).toBeTruthy();
  });

  it('should render list-item prefix content in the menu overlay', async () => {
    const fixture = TestBed.createComponent(PrefixMenuHost);
    fixture.detectChanges();
    fixture.debugElement.query(By.css('button')).nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(overlayContainerEl.querySelector('[data-prefix]')).toBeTruthy();
  });

  it('should open overlay with role="menu" panel on trigger click', async () => {
    const fixture = TestBed.createComponent(BasicMenuHost);
    fixture.detectChanges();
    const trigger = fixture.debugElement.query(By.css('button'));

    trigger.nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const menuPanel = overlayContainerEl.querySelector('[role="menu"]');
    expect(menuPanel).toBeTruthy();
  });

  it('renders the panel with the compact "menu" list appearance', async () => {
    const fixture = TestBed.createComponent(BasicMenuHost);
    fixture.detectChanges();
    const trigger = fixture.debugElement.query(By.css('button'));

    trigger.nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const menuPanel = overlayContainerEl.querySelector('.mlv-menu__panel');
    expect(menuPanel?.classList.contains('mlv-list--appearance-menu')).toBe(
      true,
    );
  });

  it('should set aria-label on panel when label input is provided', async () => {
    const fixture = TestBed.createComponent(GroupMenuHost);
    fixture.detectChanges();
    const trigger = fixture.debugElement.query(By.css('button'));

    trigger.nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const panel = overlayContainerEl.querySelector('[role="menu"]');
    expect(panel?.getAttribute('aria-label')).toBe('File Actions');
  });

  it('should render menu-group component in overlay after opening', async () => {
    const fixture = TestBed.createComponent(GroupMenuHost);
    fixture.detectChanges();
    const trigger = fixture.debugElement.query(By.css('button'));

    trigger.nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const group = overlayContainerEl.querySelector('.mlv-menu-group');
    expect(group).toBeTruthy();
  });

  it('stamps the forwarded mlvDensity on the detached popup panel', async () => {
    @Component({
      imports: [MlvMenu, MlvMenuItem, MlvMenuTrigger, MlvListItem],
      template: `
        <button [mlvMenuTrigger]="menu">Open</button>
        <mlv-menu #menu mlvDensity="compact">
          <mlv-list-item mlvMenuItem>Edit</mlv-list-item>
        </mlv-menu>
      `,
    })
    class DenseMenuHost {}

    const fixture = TestBed.createComponent(DenseMenuHost);
    fixture.detectChanges();
    const trigger = fixture.debugElement.query(By.css('button'));

    trigger.nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const panel = overlayContainerEl.querySelector('.mlv-popup');
    expect(panel).not.toBeNull();
    expect(panel?.classList.contains('mlv--compact')).toBe(true);
  });
});

describe('MlvMenuItem', () => {
  let overlayContainer: OverlayContainer;
  let overlayContainerEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        BasicMenuHost,
        DisabledItemHost,
        NestedMenuHost,
        DisabledSubmenuTriggerHost,
      ],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);
    overlayContainerEl = overlayContainer.getContainerElement();
  });

  afterEach(() => {
    overlayContainer.ngOnDestroy();
  });

  it('should have role="menuitem" on the list item after opening', async () => {
    const fixture = TestBed.createComponent(BasicMenuHost);
    fixture.detectChanges();
    const trigger = fixture.debugElement.query(By.css('button'));

    trigger.nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const menuItems = overlayContainerEl.querySelectorAll('[role="menuitem"]');
    expect(menuItems.length).toBeGreaterThan(0);
  });

  it('should emit itemClick and close menu when item is clicked', async () => {
    const fixture = TestBed.createComponent(BasicMenuHost);
    fixture.detectChanges();
    const host = fixture.componentInstance;

    const trigger = fixture.debugElement.query(By.css('button'));
    trigger.nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const editItem = overlayContainerEl.querySelector(
      '[role="menuitem"]',
    ) as HTMLElement;
    editItem.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(host.editCalled).toBe(true);
  });

  it('should apply disabled class when disabled input is true', async () => {
    const fixture = TestBed.createComponent(DisabledItemHost);
    fixture.detectChanges();
    const trigger = fixture.debugElement.query(By.css('button'));

    // Open the menu so items are rendered in the overlay
    trigger.nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const disabledItem = overlayContainerEl.querySelector(
      '.mlv-list-item--disabled',
    ) as HTMLElement;
    expect(disabledItem).toBeTruthy();
  });

  it('should set aria-disabled on disabled items after opening', async () => {
    const fixture = TestBed.createComponent(DisabledItemHost);
    fixture.detectChanges();
    const trigger = fixture.debugElement.query(By.css('button'));

    trigger.nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const disabledItem = overlayContainerEl.querySelector(
      '.mlv-list-item--disabled',
    ) as HTMLElement;
    expect(disabledItem?.getAttribute('aria-disabled')).toBeTruthy();
  });

  it('should not emit itemClick when item is disabled', async () => {
    const fixture = TestBed.createComponent(DisabledItemHost);
    fixture.detectChanges();
    const host = fixture.componentInstance;

    const trigger = fixture.debugElement.query(By.css('button'));
    trigger.nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const disabledItem = overlayContainerEl.querySelector(
      '.mlv-list-item--disabled',
    ) as HTMLElement;
    disabledItem?.click();
    fixture.detectChanges();

    expect(host.actionCalled).toBe(false);
  });

  for (const activation of [
    { name: 'click', key: null },
    { name: 'Enter', key: 'Enter' },
    { name: 'Space', key: ' ' },
  ] as const) {
    it(`treats a disabled submenu trigger as a leaf action on ${activation.name}`, async () => {
      const fixture = TestBed.createComponent(DisabledSubmenuTriggerHost);
      fixture.detectChanges();
      const host = fixture.componentInstance;

      fixture.debugElement.query(By.css('button')).nativeElement.click();
      fixture.detectChanges();
      await fixture.whenStable();

      const item = overlayContainerEl.querySelector(
        '[role="menuitem"]',
      ) as HTMLElement;
      expect(host.rootMenu._isOpen()).toBe(true);
      expect(host.disabledMenu._isOpen()).toBe(false);

      if (activation.key === null) {
        item.click();
      } else {
        item.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: activation.key,
            bubbles: true,
          }),
        );
      }
      fixture.detectChanges();
      await fixture.whenStable();

      expect(host.leafActivations).toBe(1);
      expect(host.disabledMenu._isOpen()).toBe(false);
      expect(host.rootMenu._isOpen()).toBe(false);
    });
  }
});

describe('MlvMenuTrigger', () => {
  let overlayContainer: OverlayContainer;
  let overlayContainerEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BasicMenuHost, DisabledItemHost],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);
    overlayContainerEl = overlayContainer.getContainerElement();
  });

  afterEach(() => {
    overlayContainer.ngOnDestroy();
  });

  it('should set aria-haspopup="menu" on the trigger', () => {
    const fixture = TestBed.createComponent(BasicMenuHost);
    fixture.detectChanges();
    const trigger = fixture.debugElement.query(By.css('button'));
    expect(trigger.nativeElement.getAttribute('aria-haspopup')).toBe('menu');
  });

  it('should set aria-expanded to false when closed', () => {
    const fixture = TestBed.createComponent(BasicMenuHost);
    fixture.detectChanges();
    const trigger = fixture.debugElement.query(By.css('button'));
    expect(trigger.nativeElement.getAttribute('aria-expanded')).toBe('false');
  });

  it('should open the menu on click and set aria-expanded to true', async () => {
    const fixture = TestBed.createComponent(BasicMenuHost);
    fixture.detectChanges();
    const trigger = fixture.debugElement.query(By.css('button'));

    trigger.nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(trigger.nativeElement.getAttribute('aria-expanded')).toBe('true');
  });

  it('should open menu containing role="menu" element on trigger click', async () => {
    const fixture = TestBed.createComponent(BasicMenuHost);
    fixture.detectChanges();
    const trigger = fixture.debugElement.query(By.css('button'));

    trigger.nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const menuPanel = overlayContainerEl.querySelector('[role="menu"]');
    expect(menuPanel).toBeTruthy();
  });

  it('should toggle menu closed on second click', async () => {
    const fixture = TestBed.createComponent(BasicMenuHost);
    fixture.detectChanges();
    const trigger = fixture.debugElement.query(By.css('button'));

    // Open the menu
    trigger.nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(trigger.nativeElement.getAttribute('aria-expanded')).toBe('true');

    // Second click starts the leave animation.
    trigger.nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();

    // JSDOM does not fire real CSS animationend events.  The popup's (animationend)
    // binding calls onAnimationEnd() which emits leaveAnimationDone$ and disposes
    // the overlay.  Dispatch a synthetic event to simulate the animation completing.
    const leavingPanel = overlayContainerEl.querySelector('.mlv-popup--leave');
    leavingPanel?.dispatchEvent(new Event('animationend', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    const menuPanel = overlayContainerEl.querySelector('[role="menu"]');
    expect(menuPanel).toBeNull();
  });

  it('should open menu on ArrowDown key', async () => {
    const fixture = TestBed.createComponent(BasicMenuHost);
    fixture.detectChanges();
    const trigger = fixture.debugElement.query(By.css('button'));

    trigger.nativeElement.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    expect(trigger.nativeElement.getAttribute('aria-expanded')).toBe('true');
  });

  it('should close menu on Escape key', async () => {
    const fixture = TestBed.createComponent(BasicMenuHost);
    fixture.detectChanges();
    const trigger = fixture.debugElement.query(By.css('button'));

    trigger.nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();

    // Escape on the trigger calls close() which starts the leave animation.
    trigger.nativeElement.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    // Simulate the CSS leave animation completing (JSDOM fires no real animationend).
    const leavingPanel = overlayContainerEl.querySelector('.mlv-popup--leave');
    leavingPanel?.dispatchEvent(new Event('animationend', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    // After the animation the overlay should be disposed.
    const menuPanel = overlayContainerEl.querySelector('[role="menu"]');
    expect(menuPanel).toBeNull();
  });

  it('should close the root menu when a submenu item is selected', async () => {
    const fixture = TestBed.createComponent(NestedMenuHost);
    fixture.detectChanges();
    const host = fixture.componentInstance;
    const trigger = fixture.debugElement.query(By.css('button'));

    trigger.nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const submenuTrigger = Array.from(
      overlayContainerEl.querySelectorAll('[role="menuitem"]'),
    ).find((item) => item.textContent?.includes('Appearance')) as HTMLElement;

    submenuTrigger.dispatchEvent(
      new MouseEvent('mouseenter', { bubbles: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    const submenuItem = Array.from(
      overlayContainerEl.querySelectorAll('[role="menuitem"]'),
    ).find((item) => item.textContent?.trim() === 'Light') as HTMLElement;

    expect(host.rootMenu._isOpen()).toBe(true);
    expect(host.themeMenu._isOpen()).toBe(true);

    submenuItem.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(host.action).toBe('Light');
    expect(host.themeMenu._isOpen()).toBe(false);
    expect(host.rootMenu._isOpen()).toBe(false);
  });

  describe('submenu hover lifecycle', () => {
    /** Opens the root menu and hovers the submenu trigger, returning both. */
    async function openSubmenu() {
      const fixture = TestBed.createComponent(NestedMenuHost);
      fixture.detectChanges();
      const host = fixture.componentInstance;

      fixture.debugElement.query(By.css('button')).nativeElement.click();
      fixture.detectChanges();
      await fixture.whenStable();

      const submenuTrigger = Array.from(
        overlayContainerEl.querySelectorAll('[role="menuitem"]'),
      ).find((item) => item.textContent?.includes('Appearance')) as HTMLElement;

      submenuTrigger.dispatchEvent(
        new MouseEvent('mouseenter', { bubbles: true }),
      );
      fixture.detectChanges();
      await fixture.whenStable();

      // `_setupSubmenuTracking` installs the mousemove/overlay listeners inside a
      // `setTimeout(0)`, which `whenStable()` does not flush. Without this the
      // hover machinery is simply absent and any assertion about it is vacuous.
      await new Promise((resolve) => setTimeout(resolve, 0));

      const panel = Array.from(
        overlayContainerEl.querySelectorAll('.mlv-menu__panel'),
      ).find((p) => p.textContent?.includes('Light')) as HTMLElement;

      expect(host.themeMenu._isOpen()).toBe(true);
      return { fixture, host, submenuTrigger, panel };
    }

    /** Spies on the submenu trigger's close decision. */
    function spyOnClose(fixture: ReturnType<typeof TestBed.createComponent>) {
      const trigger = fixture.debugElement
        .queryAll(By.directive(MlvMenuTrigger))
        .map((ref) => ref.injector.get(MlvMenuTrigger))
        .find((instance) => instance.isSubmenuTrigger()) as MlvMenuTrigger;
      return vi.spyOn(trigger, 'close');
    }

    it('stays open while the cursor rests on the parent item', async () => {
      const { fixture, submenuTrigger } = await openSubmenu();
      const close = spyOnClose(fixture);

      // Settling movements on the item itself make no horizontal progress, so the
      // safe cone reads "not heading" — but the pointer is still on the item that
      // owns the panel, which outranks any trajectory.
      for (const [x, y] of [
        [50, 100],
        [50, 101],
        [51, 101],
      ]) {
        submenuTrigger.dispatchEvent(
          new MouseEvent('mousemove', {
            bubbles: true,
            clientX: x,
            clientY: y,
          }),
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 250));

      expect(close).not.toHaveBeenCalled();
    });

    it('closes when the cursor moves onto a sibling item of the same menu', async () => {
      const { fixture, submenuTrigger } = await openSubmenu();
      const close = spyOnClose(fixture);

      // Must come from the trigger's *own* panel — an item in the submenu panel
      // is not a sibling and must not close anything.
      const ownPanel = submenuTrigger.closest('[role="menu"]') as HTMLElement;
      const sibling = Array.from(
        ownPanel.querySelectorAll('[role="menuitem"]'),
      ).find((item) => item !== submenuTrigger) as HTMLElement;

      sibling.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          clientX: 50,
          clientY: 200,
        }),
      );

      expect(close).toHaveBeenCalled();
    });

    it('stays open when the cursor returns from the submenu to its parent item', async () => {
      const { fixture, submenuTrigger, panel } = await openSubmenu();

      // Assert on whether a close is *initiated*. `_isOpen()` cannot tell the two
      // behaviours apart here: `close()` only flips it once the leave animation
      // ends, and `animationend` never fires in jsdom — so `_isOpen()` reads
      // `true` whether or not the bug is present.
      const trigger = fixture.debugElement
        .queryAll(By.directive(MlvMenuTrigger))
        .map((ref) => ref.injector.get(MlvMenuTrigger))
        .find((instance) => instance.isSubmenuTrigger()) as MlvMenuTrigger;
      const close = vi.spyOn(trigger, 'close');

      // Into the submenu…
      panel.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      fixture.detectChanges();

      // …and back towards the item that owns it. `SUBMENU_POSITIONS` offsets the
      // panel by 8px, so the cursor crosses a gap: the real `mouseleave` carries
      // the overlay container or `<body>` as `relatedTarget`, never the trigger.
      panel.dispatchEvent(
        new MouseEvent('mouseleave', {
          bubbles: true,
          relatedTarget: document.body,
        }),
      );
      submenuTrigger.dispatchEvent(
        new MouseEvent('mouseenter', { bubbles: true }),
      );
      await new Promise((resolve) => setTimeout(resolve, 250));

      expect(close).not.toHaveBeenCalled();
    });

    it('closes when the cursor leaves the parent item for somewhere else after visiting the submenu', async () => {
      const { fixture, submenuTrigger, panel } = await openSubmenu();

      // Spy on the decision to close rather than on teardown: the close runs a
      // leave animation whose `animationend` never fires in jsdom.
      const trigger = fixture.debugElement
        .queryAll(By.directive(MlvMenuTrigger))
        .map((ref) => ref.injector.get(MlvMenuTrigger))
        .find((instance) => instance.isSubmenuTrigger()) as MlvMenuTrigger;
      const close = vi.spyOn(trigger, 'close');

      panel.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      panel.dispatchEvent(
        new MouseEvent('mouseleave', { bubbles: true, relatedTarget: null }),
      );
      submenuTrigger.dispatchEvent(
        new MouseEvent('mouseenter', { bubbles: true }),
      );
      fixture.detectChanges();

      // Leaving the parent for unrelated content must still close it — the
      // panel's own mouseleave already fired on the way back to the parent, so
      // nothing else is left to close it.
      submenuTrigger.dispatchEvent(
        new MouseEvent('mouseleave', {
          bubbles: true,
          relatedTarget: document.body,
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(close).toHaveBeenCalled();
    });
  });
});

describe('MlvMenuSeparator', () => {
  let overlayContainer: OverlayContainer;
  let overlayContainerEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BasicMenuHost],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);
    overlayContainerEl = overlayContainer.getContainerElement();
  });

  afterEach(() => {
    overlayContainer.ngOnDestroy();
  });

  it('should render an hr with role="separator" inside the overlay', async () => {
    const fixture = TestBed.createComponent(BasicMenuHost);
    fixture.detectChanges();
    const trigger = fixture.debugElement.query(By.css('button'));

    // Open the menu so separator is rendered in the overlay
    trigger.nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const hr = overlayContainerEl.querySelector('.mlv-menu-separator__line');
    expect(hr).toBeTruthy();
    expect(hr?.getAttribute('role')).toBe('separator');
  });

  it('should have mlv-menu-separator class on host', async () => {
    const fixture = TestBed.createComponent(BasicMenuHost);
    fixture.detectChanges();
    const trigger = fixture.debugElement.query(By.css('button'));

    // Open the menu so separator is rendered in the overlay
    trigger.nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const separator = overlayContainerEl.querySelector('mlv-menu-separator');
    expect(separator?.classList.contains('mlv-menu-separator')).toBe(true);
  });
});

describe('MlvMenuItem roving tabindex', () => {
  @Component({
    imports: [MlvMenuItem, MlvListItem],
    template: `<mlv-list-item mlvMenuItem>Item</mlv-list-item>`,
  })
  class IsolatedItemHost {}

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IsolatedItemHost],
    }).compileComponents();
  });

  it('reflects the _tabIndex signal on the host tabindex attribute (OnPush safe)', () => {
    const fixture = TestBed.createComponent(IsolatedItemHost);
    fixture.detectChanges();

    const el = fixture.debugElement.query(By.directive(MlvMenuItem));
    const dir = el.injector.get(MlvMenuItem);

    // Default roving tabindex is -1.
    expect(el.nativeElement.getAttribute('tabindex')).toBe('-1');

    // Updating the signal re-renders the attribute under OnPush.
    dir._tabIndex.set(0);
    fixture.detectChanges();
    expect(el.nativeElement.getAttribute('tabindex')).toBe('0');
  });

  it('exposes its trimmed visible text via getLabel() for type-ahead', () => {
    const fixture = TestBed.createComponent(IsolatedItemHost);
    fixture.detectChanges();

    const dir = fixture.debugElement
      .query(By.directive(MlvMenuItem))
      .injector.get(MlvMenuItem);

    expect(dir.getLabel()).toBe('Item');
  });
});

// ─── Type-ahead (aria-parity keyboard behaviour, added with Task 2.6) ─────────
describe('MlvMenu type-ahead', () => {
  let overlayContainer: OverlayContainer;
  let overlayContainerEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BasicMenuHost],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);
    overlayContainerEl = overlayContainer.getContainerElement();
  });

  afterEach(() => {
    overlayContainer.ngOnDestroy();
  });

  it('moves focus to the first item matching the typed letter', async () => {
    const fixture = TestBed.createComponent(BasicMenuHost);
    fixture.detectChanges();
    const trigger = fixture.debugElement.query(By.css('button'));

    trigger.nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const panel = overlayContainerEl.querySelector(
      '[role="menu"]',
    ) as HTMLElement;

    // Type "d" → the FocusKeyManager type-ahead should jump to "Delete".
    panel.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'd', bubbles: true }),
    );
    // Type-ahead matching is debounced (200 ms default); wait past it.
    await new Promise((resolve) => setTimeout(resolve, 250));
    fixture.detectChanges();

    const menuItems = Array.from(
      overlayContainerEl.querySelectorAll('[role="menuitem"]'),
    ) as HTMLElement[];
    const deleteItem = menuItems.find(
      (el) => el.textContent?.trim() === 'Delete',
    ) as HTMLElement;

    // Type-ahead moved keyboard focus to the matching item ("Delete"),
    // skipping the first item ("Edit").
    expect(deleteItem).toBeTruthy();
    expect(document.activeElement).toBe(deleteItem);
    expect(document.activeElement).not.toBe(menuItems[0]);
  });
});

// ─── Roving tabindex & arrow navigation ──────────────────────────────────────
//
// Regression cover for the key-manager rebuild defect: a constructor `effect()`
// used to call `_syncTabIndices()` inside its reactive context. That reads
// `FocusKeyManager.activeItem`, which CDK backs with a signal, so every arrow key
// re-ran the effect, replaced the manager and reset `activeItemIndex` to -1 —
// ArrowDown always snapped back to the first item, ArrowUp to the last, and no
// `role="menuitem"` ever held `tabindex="0"`.

/** Key codes CDK's `ListKeyManager` reads from `event.keyCode`. */
const NAV_KEY = { up: 38, down: 40, home: 36, end: 35 } as const;

/**
 * Dispatches a keydown whose `keyCode` is set (jsdom leaves it `0` otherwise),
 * which CDK's `FocusKeyManager` requires for arrow / Home / End navigation.
 */
function fireNavKey(el: Element, key: string, keyCode?: number): void {
  const event = new KeyboardEvent('keydown', { key, bubbles: true });
  if (keyCode !== undefined) {
    Object.defineProperty(event, 'keyCode', { get: () => keyCode });
  }
  el.dispatchEvent(event);
}

/** Flushes the `setTimeout(…, 0)` the trigger uses to focus the first/last item. */
function flushMacrotask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Internal shape of `MlvMenu` the roving-tabindex tests assert against. */
interface MenuInternals {
  _keyManager: { activeItemIndex: number } | null;
}

@Component({
  imports: [MlvMenu, MlvMenuItem, MlvMenuTrigger, MlvListItem],
  template: `
    <button [mlvMenuTrigger]="menu">Open {{ renderTick() }}</button>
    <mlv-menu #menu>
      <mlv-list-item mlvMenuItem>New File</mlv-list-item>
      <mlv-list-item mlvMenuItem>Open</mlv-list-item>
      <mlv-list-item mlvMenuItem>Save</mlv-list-item>
      <mlv-list-item mlvMenuItem>Delete</mlv-list-item>
    </mlv-menu>
  `,
})
class KeyboardMenuHost {
  /** Re-render counter — bumping it runs change detection without touching items. */
  readonly renderTick = signal(0);
}

@Component({
  imports: [MlvMenu, MlvMenuItem, MlvMenuTrigger, MlvListItem],
  template: `
    <button [mlvMenuTrigger]="menu">Open</button>
    <mlv-menu #menu>
      @for (item of items(); track item) {
        <mlv-list-item mlvMenuItem>{{ item }}</mlv-list-item>
      }
    </mlv-menu>
  `,
})
class DynamicMenuHost {
  readonly items = signal(['Alpha', 'Bravo', 'Charlie']);
}

@Component({
  imports: [MlvMenu, MlvMenuItem, MlvMenuTrigger, MlvListItem],
  template: `
    <button [mlvMenuTrigger]="menu">Open</button>
    <mlv-menu #menu>
      <mlv-list-item mlvMenuItem>First</mlv-list-item>
      <mlv-list-item mlvMenuItem disabled>Blocked</mlv-list-item>
      <mlv-list-item mlvMenuItem>Third</mlv-list-item>
    </mlv-menu>
  `,
})
class SkipDisabledMenuHost {}

describe('MlvMenu roving tabindex and arrow navigation', () => {
  let overlayContainer: OverlayContainer;
  let overlayContainerEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KeyboardMenuHost, DynamicMenuHost, SkipDisabledMenuHost],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);
    overlayContainerEl = overlayContainer.getContainerElement();
  });

  afterEach(() => {
    overlayContainer.ngOnDestroy();
  });

  /** All `role="menuitem"` elements of the open panel, in DOM order. */
  function menuItems(): HTMLElement[] {
    return Array.from(
      overlayContainerEl.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    );
  }

  /** Labels of the items currently carrying `tabindex="0"`. */
  function tabbableLabels(): string[] {
    return menuItems()
      .filter((el) => el.getAttribute('tabindex') === '0')
      .map((el) => el.textContent?.trim() ?? '');
  }

  /** Opens the menu with Enter, which focuses the first item. */
  async function openWithEnter(
    fixture: { detectChanges(): void; whenStable(): Promise<unknown> },
    trigger: HTMLElement,
  ): Promise<void> {
    fireNavKey(trigger, 'Enter');
    fixture.detectChanges();
    await fixture.whenStable();
    await flushMacrotask();
    fixture.detectChanges();
  }

  it('advances to the second item on ArrowDown instead of snapping back to the first', async () => {
    const fixture = TestBed.createComponent(KeyboardMenuHost);
    fixture.detectChanges();
    const trigger = fixture.debugElement.query(By.css('button')).nativeElement;

    await openWithEnter(fixture, trigger);
    expect(document.activeElement).toBe(menuItems()[0]);
    expect(tabbableLabels()).toEqual(['New File']);

    const panel = overlayContainerEl.querySelector(
      '[role="menu"]',
    ) as HTMLElement;

    fireNavKey(panel, 'ArrowDown', NAV_KEY.down);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe(menuItems()[1]);
    expect(tabbableLabels()).toEqual(['Open']);

    fireNavKey(panel, 'ArrowDown', NAV_KEY.down);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe(menuItems()[2]);
    expect(tabbableLabels()).toEqual(['Save']);
  });

  it('wraps from the first item to the last on ArrowUp (withWrap)', async () => {
    const fixture = TestBed.createComponent(KeyboardMenuHost);
    fixture.detectChanges();
    const trigger = fixture.debugElement.query(By.css('button')).nativeElement;

    await openWithEnter(fixture, trigger);
    const panel = overlayContainerEl.querySelector(
      '[role="menu"]',
    ) as HTMLElement;

    fireNavKey(panel, 'ArrowUp', NAV_KEY.up);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe(menuItems()[3]);
    expect(tabbableLabels()).toEqual(['Delete']);

    // …and back up to the item above it, rather than to the last one again.
    fireNavKey(panel, 'ArrowUp', NAV_KEY.up);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe(menuItems()[2]);
    expect(tabbableLabels()).toEqual(['Save']);
  });

  it('keeps exactly one item tabbable at every step of a navigation sequence', async () => {
    const fixture = TestBed.createComponent(KeyboardMenuHost);
    fixture.detectChanges();
    const trigger = fixture.debugElement.query(By.css('button')).nativeElement;

    // Pointer-opened panel: focus sits on the list, the first item is the tab stop.
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(tabbableLabels()).toEqual(['New File']);

    const panel = overlayContainerEl.querySelector(
      '[role="menu"]',
    ) as HTMLElement;

    const sequence: [string, number, string][] = [
      ['ArrowDown', NAV_KEY.down, 'New File'],
      ['ArrowDown', NAV_KEY.down, 'Open'],
      ['ArrowDown', NAV_KEY.down, 'Save'],
      ['ArrowUp', NAV_KEY.up, 'Open'],
      ['End', NAV_KEY.end, 'Delete'],
      ['Home', NAV_KEY.home, 'New File'],
    ];

    for (const [key, keyCode, expected] of sequence) {
      fireNavKey(panel, key, keyCode);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(tabbableLabels()).toEqual([expected]);
      expect(document.activeElement?.textContent?.trim()).toBe(expected);
    }
  });

  it('does not rebuild the key manager while the item set is reference-identical', async () => {
    const proto = MlvMenu.prototype as unknown as Record<string, unknown>;
    const original = proto['_initKeyManager'] as (
      this: MlvMenu,
      ...args: unknown[]
    ) => void;
    let initCount = 0;
    proto['_initKeyManager'] = function (this: MlvMenu, ...args: unknown[]) {
      initCount += 1;
      return original.apply(this, args);
    };

    try {
      const fixture = TestBed.createComponent(KeyboardMenuHost);
      fixture.detectChanges();
      const trigger = fixture.debugElement.query(
        By.css('button'),
      ).nativeElement;

      await openWithEnter(fixture, trigger);
      const menu = fixture.debugElement.query(By.directive(MlvMenu))
        .componentInstance as MlvMenu;
      const internals = menu as unknown as MenuInternals;
      const managerAfterOpen = internals._keyManager;

      const buildsAfterOpen = initCount;
      const panel = overlayContainerEl.querySelector(
        '[role="menu"]',
      ) as HTMLElement;

      for (const [key, keyCode] of [
        ['ArrowDown', NAV_KEY.down],
        ['ArrowDown', NAV_KEY.down],
        ['ArrowUp', NAV_KEY.up],
        ['End', NAV_KEY.end],
      ] as const) {
        fireNavKey(panel, key, keyCode);
        fixture.detectChanges();
        await fixture.whenStable();
      }

      // Same manager instance, no extra builds: the items never changed.
      expect(buildsAfterOpen).toBe(1);
      expect(initCount).toBe(1);
      expect(internals._keyManager).toBe(managerAfterOpen);
      expect(internals._keyManager?.activeItemIndex).toBe(3);
    } finally {
      proto['_initKeyManager'] = original;
    }
  });

  it('keeps the active item across a change-detection pass that does not change the items', async () => {
    const fixture = TestBed.createComponent(KeyboardMenuHost);
    fixture.detectChanges();
    const trigger = fixture.debugElement.query(By.css('button')).nativeElement;

    await openWithEnter(fixture, trigger);
    const panel = overlayContainerEl.querySelector(
      '[role="menu"]',
    ) as HTMLElement;

    fireNavKey(panel, 'ArrowDown', NAV_KEY.down);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(tabbableLabels()).toEqual(['Open']);

    const menu = fixture.debugElement.query(By.directive(MlvMenu))
      .componentInstance as MlvMenu;
    const internals = menu as unknown as MenuInternals;
    const managerBefore = internals._keyManager;

    // Re-render the host repeatedly without touching the projected item set.
    for (let pass = 0; pass < 3; pass++) {
      fixture.componentInstance.renderTick.update((value) => value + 1);
      fixture.detectChanges();
      await fixture.whenStable();
    }

    expect(internals._keyManager).toBe(managerBefore);
    expect(internals._keyManager?.activeItemIndex).toBe(1);
    expect(tabbableLabels()).toEqual(['Open']);
  });

  it('keeps the active item when a new item is appended, and keeps navigating from it', async () => {
    const fixture = TestBed.createComponent(DynamicMenuHost);
    fixture.detectChanges();
    const trigger = fixture.debugElement.query(By.css('button')).nativeElement;

    await openWithEnter(fixture, trigger);
    const panel = overlayContainerEl.querySelector(
      '[role="menu"]',
    ) as HTMLElement;

    fireNavKey(panel, 'ArrowDown', NAV_KEY.down);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(tabbableLabels()).toEqual(['Bravo']);

    fixture.componentInstance.items.update((items) => [...items, 'Delta']);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(menuItems().length).toBe(4);
    expect(tabbableLabels()).toEqual(['Bravo']);

    const internals = fixture.debugElement.query(By.directive(MlvMenu))
      .componentInstance as MlvMenu as unknown as MenuInternals;
    expect(internals._keyManager?.activeItemIndex).toBe(1);

    // Navigation continues from the preserved position, and reaches the new item.
    fireNavKey(panel, 'ArrowDown', NAV_KEY.down);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(tabbableLabels()).toEqual(['Charlie']);

    fireNavKey(panel, 'End', NAV_KEY.end);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(tabbableLabels()).toEqual(['Delta']);
  });

  it('moves the roving tabindex to a neighbour when the active item is removed', async () => {
    const fixture = TestBed.createComponent(DynamicMenuHost);
    fixture.detectChanges();
    const trigger = fixture.debugElement.query(By.css('button')).nativeElement;

    await openWithEnter(fixture, trigger);
    const panel = overlayContainerEl.querySelector(
      '[role="menu"]',
    ) as HTMLElement;

    fireNavKey(panel, 'ArrowDown', NAV_KEY.down);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(tabbableLabels()).toEqual(['Bravo']);

    fixture.componentInstance.items.set(['Alpha', 'Charlie']);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(menuItems().length).toBe(2);
    // "Charlie" now occupies the removed item's index — the tab stop follows it.
    expect(tabbableLabels()).toEqual(['Charlie']);

    const internals = fixture.debugElement.query(By.directive(MlvMenu))
      .componentInstance as MlvMenu as unknown as MenuInternals;
    expect(internals._keyManager?.activeItemIndex).toBe(1);
  });

  it('skips disabled items when arrowing, and never makes them tabbable', async () => {
    const fixture = TestBed.createComponent(SkipDisabledMenuHost);
    fixture.detectChanges();
    const trigger = fixture.debugElement.query(By.css('button')).nativeElement;

    await openWithEnter(fixture, trigger);
    expect(tabbableLabels()).toEqual(['First']);

    const panel = overlayContainerEl.querySelector(
      '[role="menu"]',
    ) as HTMLElement;

    fireNavKey(panel, 'ArrowDown', NAV_KEY.down);
    fixture.detectChanges();
    await fixture.whenStable();

    // "Blocked" is skipped entirely.
    expect(document.activeElement?.textContent?.trim()).toBe('Third');
    expect(tabbableLabels()).toEqual(['Third']);
    expect(menuItems()[1].getAttribute('tabindex')).toBe('-1');
    expect(menuItems()[1].getAttribute('aria-disabled')).toBe('true');
  });

  it('follows type-ahead with the roving tabindex', async () => {
    const fixture = TestBed.createComponent(KeyboardMenuHost);
    fixture.detectChanges();
    const trigger = fixture.debugElement.query(By.css('button')).nativeElement;

    await openWithEnter(fixture, trigger);
    const panel = overlayContainerEl.querySelector(
      '[role="menu"]',
    ) as HTMLElement;

    fireNavKey(panel, 's');
    await new Promise((resolve) => setTimeout(resolve, 250));
    fixture.detectChanges();

    expect(document.activeElement?.textContent?.trim()).toBe('Save');
    expect(tabbableLabels()).toEqual(['Save']);
  });

  it('closes on Escape from a navigated item and restores focus to the trigger', async () => {
    const fixture = TestBed.createComponent(KeyboardMenuHost);
    fixture.detectChanges();
    const trigger = fixture.debugElement.query(By.css('button')).nativeElement;

    await openWithEnter(fixture, trigger);
    const panel = overlayContainerEl.querySelector(
      '[role="menu"]',
    ) as HTMLElement;

    fireNavKey(panel, 'ArrowDown', NAV_KEY.down);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(tabbableLabels()).toEqual(['Open']);

    fireNavKey(panel, 'Escape');
    fixture.detectChanges();
    await fixture.whenStable();

    const leavingPanel = overlayContainerEl.querySelector('.mlv-popup--leave');
    leavingPanel?.dispatchEvent(new Event('animationend', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(overlayContainerEl.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
