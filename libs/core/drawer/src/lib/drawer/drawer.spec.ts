import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { Overlay, OverlayContainer } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { MlvDrawer } from './drawer';
import { DrawerBodyDirective } from '../drawer-body';
import { MlvDrawerContent } from '../drawer-content';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';

describe('MlvDrawer', () => {
  let component: MlvDrawer;
  let fixture: ComponentFixture<MlvDrawer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvDrawer],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvDrawer);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Focus management (declarative component mode)
// ---------------------------------------------------------------------------

@Component({
  imports: [MlvDrawer, MlvDrawerContent, DrawerBodyDirective],
  template: `
    <button class="trigger">Open</button>
    <mlv-drawer [(opened)]="open">
      <ng-template mlvDrawerContent>
        <div mlvDrawerBody><button class="inside">Inside</button></div>
      </ng-template>
    </mlv-drawer>
  `,
})
class DrawerHostComponent {
  readonly open = signal(false);
}

describe('MlvDrawer — focus', () => {
  let fixture: ComponentFixture<DrawerHostComponent>;
  let host: DrawerHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DrawerHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(DrawerHostComponent);
    host = fixture.componentInstance;
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.nativeElement.remove();
  });

  function panel(): HTMLElement | null {
    return document.querySelector('.mlv-drawer');
  }

  function drawerInstance(): MlvDrawer {
    return fixture.debugElement.children.find(
      (d) => d.componentInstance instanceof MlvDrawer,
    )?.componentInstance as MlvDrawer;
  }

  it('captures the pre-open focused element as the restore target', async () => {
    const trigger = fixture.nativeElement.querySelector(
      '.trigger',
    ) as HTMLButtonElement;
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    host.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(
      (drawerInstance() as unknown as { _triggerElement: HTMLElement | null })
        ._triggerElement,
    ).toBe(trigger);
  });

  it('restores focus to the trigger when the drawer closes', async () => {
    const trigger = fixture.nativeElement.querySelector(
      '.trigger',
    ) as HTMLButtonElement;
    trigger.focus();

    host.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    host.open.set(false);
    fixture.detectChanges();
    await fixture.whenStable();

    // Leave animation drives overlay disposal via animationend.
    panel()?.dispatchEvent(new Event('animationend'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe(trigger);
  });

  it('does not set a dangling aria-labelledby on the drawer panel', async () => {
    host.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(panel()?.getAttribute('aria-labelledby')).toBeNull();
  });

  it('uses the Malva scrollbar for the drawer body', async () => {
    host.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(
      panel()?.querySelector('.mlv-drawer__body-scrollbar.mlv-scrollbar'),
    ).toBeTruthy();
  });

  it('focuses the first content control rather than the panel chrome', async () => {
    host.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe(panel()?.querySelector('.inside'));
  });

  /**
   * The open modal surface: `role="dialog"`, `aria-modal`, the scrim and the
   * focus-trap anchors. Swept from `document.body` because the panel is
   * portaled into the CDK overlay container, outside `fixture.nativeElement`.
   *
   * This host projects no `mlv-drawer-header`, so the name under test is the
   * localized `aria-label` fallback rather than a header title — which is the
   * state a dangling `aria-labelledby` would otherwise be hiding in.
   */
  it('has no axe violations while open', async () => {
    host.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(panel()).not.toBeNull();
    await expectNoAxeViolations(document.body);
  });

  it('has no axe violations while closed', async () => {
    expect(panel()).toBeNull();
    await expectNoAxeViolations(document.body);
  });
});

// ---------------------------------------------------------------------------
// Viewport clamping
// ---------------------------------------------------------------------------

@Component({
  imports: [MlvDrawer, MlvDrawerContent, DrawerBodyDirective],
  template: `
    <mlv-drawer
      [(opened)]="open"
      [position]="position()"
      [size]="size()"
      [minSize]="minSize()"
      [maxSize]="maxSize()"
      [resizable]="resizable()"
    >
      <ng-template mlvDrawerContent>
        <div mlvDrawerBody>Body</div>
      </ng-template>
    </mlv-drawer>
  `,
})
class DrawerSizeHostComponent {
  readonly open = signal(false);
  readonly position = signal<'left' | 'right' | 'top' | 'bottom'>('right');
  readonly size = signal('36rem');
  readonly minSize = signal('0px');
  readonly maxSize = signal('100%');
  readonly resizable = signal(false);
}

describe('MlvDrawer — size clamping', () => {
  let fixture: ComponentFixture<DrawerSizeHostComponent>;
  let host: DrawerSizeHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DrawerSizeHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(DrawerSizeHostComponent);
    host = fixture.componentInstance;
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.nativeElement.remove();
  });

  async function openDrawer(): Promise<HTMLElement> {
    host.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    return document.querySelector('.mlv-drawer') as HTMLElement;
  }

  it('clamps a fixed width to the viewport for side drawers', async () => {
    const panel = await openDrawer();

    expect(panel.style.width).toBe('36rem');
    expect(panel.style.maxWidth).toBe('100dvw');
    expect(panel.style.maxHeight).toBe('100dvh');
  });

  it('clamps a fixed height to the viewport for top/bottom drawers', async () => {
    host.position.set('bottom');
    const panel = await openDrawer();

    expect(panel.style.height).toBe('36rem');
    expect(panel.style.maxHeight).toBe('100dvh');
    expect(panel.style.maxWidth).toBe('100dvw');
  });

  it('honours maxSize on the non-resizable path, still capped by the viewport', async () => {
    host.maxSize.set('20rem');
    const panel = await openDrawer();

    expect(panel.style.maxWidth).toBe('min(20rem, 100dvw)');
  });

  it('honours maxSize on the resizable path', async () => {
    host.resizable.set(true);
    host.maxSize.set('30rem');
    host.position.set('bottom');
    const panel = await openDrawer();

    expect(panel.style.maxHeight).toBe('min(30rem, 100dvh)');
  });

  it('binds minSize as the width floor of a resizable side drawer', async () => {
    // The drag directive writes the axis size through a custom property;
    // `min-width` is what stops it from shrinking the panel below the floor.
    host.resizable.set(true);
    host.minSize.set('18rem');
    const panel = await openDrawer();

    expect(panel.style.minWidth).toBe('min(18rem, 100dvw)');
    expect(panel.style.minHeight).toBe('');
  });

  it('binds minSize as the height floor of a top/bottom drawer', async () => {
    host.position.set('top');
    host.minSize.set('12rem');
    const panel = await openDrawer();

    expect(panel.style.minHeight).toBe('min(12rem, 100dvh)');
    expect(panel.style.minWidth).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Leave disposal is driven by the panel's own animationend
// ---------------------------------------------------------------------------

/**
 * A bubbling `animationend`, the way a finished CSS animation dispatches one.
 *
 * A plain `Event`, not an `AnimationEvent`: jsdom implements neither the
 * interface nor CSS animations, so nothing here would ever synthesise one. The
 * handler under test reads only `target` / `currentTarget`, and those are
 * dispatch mechanics `Event` models exactly.
 */
function animationEnd(): Event {
  return new Event('animationend', { bubbles: true });
}

describe('MlvDrawer — animationend target', () => {
  let fixture: ComponentFixture<DrawerHostComponent>;
  let host: DrawerHostComponent;
  let overlayContainer: OverlayContainer;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DrawerHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);
    fixture = TestBed.createComponent(DrawerHostComponent);
    host = fixture.componentInstance;
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.nativeElement.remove();
    overlayContainer.ngOnDestroy();
  });

  /** Drawer panels attached to the live CDK overlay container right now. */
  function attachedPanels(): NodeListOf<HTMLElement> {
    return overlayContainer
      .getContainerElement()
      .querySelectorAll<HTMLElement>('.mlv-drawer');
  }

  function drawerInstance(): MlvDrawer {
    return fixture.debugElement.children.find(
      (d) => d.componentInstance instanceof MlvDrawer,
    )?.componentInstance as MlvDrawer;
  }

  async function openThenClose(): Promise<void> {
    host.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(attachedPanels()).toHaveLength(1);

    host.open.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(drawerInstance().animationState()).toBe('leave');
  }

  it('keeps the drawer attached for an animationend bubbling out of its content', async () => {
    await openThenClose();

    // Consumer content finishing a finite CSS animation (a row fade-in, a
    // one-shot highlight) inside the leave window. `animationend` bubbles to
    // the panel's listener; only the panel's own leave keyframes may dispose.
    const child = attachedPanels()[0].querySelector<HTMLElement>('.inside');
    expect(child).not.toBeNull();
    child?.dispatchEvent(animationEnd());
    fixture.detectChanges();
    await fixture.whenStable();

    expect(attachedPanels()).toHaveLength(1);
    expect(drawerInstance().animationState()).toBe('leave');
  });

  it('disposes the drawer for an animationend raised by the panel itself', async () => {
    await openThenClose();

    attachedPanels()[0].dispatchEvent(animationEnd());
    fixture.detectChanges();
    await fixture.whenStable();

    expect(attachedPanels()).toHaveLength(0);
    expect(drawerInstance().animationState()).toBe('idle');
  });
});

// ---------------------------------------------------------------------------
// Escape on the resize handle (#344)
//
// The handle used to answer Escape itself: it emitted `dismissed`, which the
// template binds to `close()`, before the keystroke ever reached CDK's
// `OverlayKeyboardDispatcher` (one `keydown` listener on `<body>`, handing the
// key to the topmost overlay with a `keydownEvents()` observer). So a drawer
// opened with `closeOnEscape` false — an unsaved form — still closed from the
// handle, the same Escape then reached the drawer's own subscription and
// closed it a second time when `closeOnEscape` was on, and an overlay above
// the drawer that owns Escape (a hover-shown tooltip, #319) could not stop it.
// Now Escape on the handle is Escape anywhere in the drawer.
// ---------------------------------------------------------------------------

@Component({
  imports: [MlvDrawer, MlvDrawerContent, DrawerBodyDirective],
  template: `
    <button class="trigger">Open</button>
    <mlv-drawer
      [(opened)]="open"
      position="bottom"
      resizable
      [closeOnEscape]="closeOnEscape()"
    >
      <ng-template mlvDrawerContent>
        <div mlvDrawerBody><button class="inside">Inside</button></div>
      </ng-template>
    </mlv-drawer>
  `,
})
class ResizableDrawerHostComponent {
  readonly open = signal(false);
  readonly closeOnEscape = signal(true);
}

/** Content for a bare CDK overlay standing in for a tooltip above the drawer. */
@Component({ template: '<p>Above</p>' })
class AboveDrawerContentComponent {}

describe('MlvDrawer — Escape on the resize handle (#344)', () => {
  let fixture: ComponentFixture<ResizableDrawerHostComponent>;
  let host: ResizableDrawerHostComponent;
  let overlayContainer: OverlayContainer;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResizableDrawerHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);
    fixture = TestBed.createComponent(ResizableDrawerHostComponent);
    host = fixture.componentInstance;
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.nativeElement.remove();
    overlayContainer.ngOnDestroy();
  });

  async function flush(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function trigger(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.trigger') as HTMLButtonElement;
  }

  /** Drawer panels attached to the live CDK overlay container right now. */
  function attachedPanels(): NodeListOf<HTMLElement> {
    return overlayContainer
      .getContainerElement()
      .querySelectorAll<HTMLElement>('.mlv-drawer');
  }

  function drawerInstance(): MlvDrawer {
    return fixture.debugElement.children.find(
      (d) => d.componentInstance instanceof MlvDrawer,
    )?.componentInstance as MlvDrawer;
  }

  /**
   * Counts every `close()` call on the drawer — from the template's
   * `(dismissed)` binding and from the overlay's Escape subscription alike.
   * A number, so a failure prints no instance.
   */
  function countCloses(): { readonly count: number } {
    const drawer = drawerInstance();
    const original = drawer.close.bind(drawer);
    const counter = { count: 0 };
    drawer.close = () => {
      counter.count++;
      original();
    };
    return counter;
  }

  /** Focuses the trigger, opens the drawer and focuses its resize handle. */
  async function openAndFocusHandle(): Promise<HTMLElement> {
    trigger().focus();
    host.open.set(true);
    await flush();
    const handle =
      attachedPanels()[0]?.querySelector<HTMLElement>('[role="separator"]');
    expect(handle).toBeTruthy();
    handle?.focus();
    expect(document.activeElement).toBe(handle);
    return handle as HTMLElement;
  }

  /** Dispatches a bubbling, cancelable Escape keydown, the way a key press does. */
  function pressEscape(target: HTMLElement): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(event);
    return event;
  }

  it('leaves a closeOnEscape=false drawer open', async () => {
    host.closeOnEscape.set(false);
    await flush();
    const handle = await openAndFocusHandle();

    pressEscape(handle);
    await flush();

    expect(host.open()).toBe(true);
    expect(drawerInstance().animationState()).not.toBe('leave');
    expect(attachedPanels()).toHaveLength(1);
    expect(document.activeElement).toBe(handle);
  });

  it('closes once per Escape with closeOnEscape on, and restores focus to the trigger', async () => {
    const handle = await openAndFocusHandle();
    const closes = countCloses();

    pressEscape(handle);
    await flush();

    expect(closes.count).toBe(1);
    expect(host.open()).toBe(false);
    expect(drawerInstance().animationState()).toBe('leave');

    attachedPanels()[0].dispatchEvent(
      new Event('animationend', { bubbles: true }),
    );
    await flush();

    expect(attachedPanels()).toHaveLength(0);
    expect(document.activeElement).toBe(trigger());
  });

  it('lets an overlay above the drawer take the Escape, then closes on the next one', async () => {
    const handle = await openAndFocusHandle();
    const closes = countCloses();

    // A tooltip (#319) owns Escape while it is up: its overlay subscribes to
    // `keydownEvents()`, so the dispatcher hands it the key and stops there.
    const above = TestBed.inject(Overlay).create();
    above.attach(new ComponentPortal(AboveDrawerContentComponent));
    let aboveEscapes = 0;
    above.keydownEvents().subscribe((event) => {
      aboveEscapes++;
      event.preventDefault();
      event.stopPropagation();
      above.dispose();
    });

    pressEscape(handle);
    await flush();

    expect(aboveEscapes).toBe(1);
    expect(closes.count).toBe(0);
    expect(host.open()).toBe(true);
    expect(attachedPanels()).toHaveLength(1);

    pressEscape(handle);
    await flush();

    expect(aboveEscapes).toBe(1);
    expect(closes.count).toBe(1);
    expect(host.open()).toBe(false);
  });
});
