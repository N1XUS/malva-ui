import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { OverlayContainer } from '@angular/cdk/overlay';
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
