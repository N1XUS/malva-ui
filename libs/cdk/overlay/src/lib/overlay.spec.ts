import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import type {
  Injector,
  StaticProvider,
  TemplateRef,
  Type,
} from '@angular/core';
import {
  ApplicationRef,
  Component,
  Injectable,
  signal,
  viewChild,
} from '@angular/core';
import type {
  OverlayConfig,
  OverlayRef,
  PositionStrategy,
} from '@angular/cdk/overlay';
import { OverlayContainer, OverlayModule } from '@angular/cdk/overlay';
import { A11yModule } from '@angular/cdk/a11y';
import { ComponentPortal } from '@angular/cdk/portal';
import { firstValueFrom } from 'rxjs';
import { expectNoAxeViolations, runAxe } from '@malva-ui/internal-testing/axe';

import type { MlvBaseOverlayConfig } from './overlay-config';
import { MlvOverlayRef } from './overlay-ref';
import { MlvOverlayHostBase } from './overlay-host-base';
import { MlvOverlayServiceBase } from './overlay-service-base';

/**
 * A bubbling `animationend`, the way a finished CSS animation dispatches one.
 *
 * A plain `Event`, not an `AnimationEvent`: jsdom implements neither the
 * interface nor CSS animations, so nothing here would ever synthesise one. The
 * handlers under test read only `target` / `currentTarget`, and those are
 * dispatch mechanics `Event` models exactly.
 */
function animationEnd(): Event {
  return new Event('animationend', { bubbles: true });
}

// ---------------------------------------------------------------------------
// MlvOverlayRef
// ---------------------------------------------------------------------------

class TestOverlayRef<R = unknown> extends MlvOverlayRef<R> {
  protected override readonly _backdropLeavingClass = 'test-backdrop--leaving';
  protected override readonly _panelLeaveClass = 'test-panel--leave';
  protected override readonly _leaveFallbackMs = 20;
}

function createFakeOverlayRef() {
  const backdropElement = document.createElement('div');
  const overlayElement = document.createElement('div');
  const dispose = vi.fn();
  return {
    ref: { backdropElement, overlayElement, dispose } as unknown as OverlayRef,
    backdropElement,
    overlayElement,
    dispose,
  };
}

describe('MlvOverlayRef', () => {
  it('emits beforeClose synchronously and adds the leave classes', () => {
    const { ref, backdropElement, overlayElement } = createFakeOverlayRef();
    const overlayRef = new TestOverlayRef(ref);

    let before = false;
    overlayRef.beforeClose().subscribe(() => (before = true));
    overlayRef.close();

    expect(before).toBe(true);
    expect(backdropElement.classList.contains('test-backdrop--leaving')).toBe(
      true,
    );
    expect(overlayElement.classList.contains('test-panel--leave')).toBe(true);
  });

  it('disposes and emits the result once on animationend', async () => {
    const { ref, overlayElement, dispose } = createFakeOverlayRef();
    const overlayRef = new TestOverlayRef<string>(ref);

    const closed = firstValueFrom(overlayRef.afterClosed());
    overlayRef.close('done');
    expect(dispose).not.toHaveBeenCalled();

    overlayElement.dispatchEvent(new Event('animationend'));
    await expect(closed).resolves.toBe('done');
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('ignores repeated close requests and keeps the first result', async () => {
    const { ref, overlayElement, dispose } = createFakeOverlayRef();
    const overlayRef = new TestOverlayRef<string>(ref);
    const beforeClose = vi.fn();
    overlayRef.beforeClose().subscribe(beforeClose);

    const closed = firstValueFrom(overlayRef.afterClosed());
    overlayRef.close('first');
    overlayRef.close('second');
    overlayElement.dispatchEvent(new Event('animationend'));

    await expect(closed).resolves.toBe('first');
    expect(beforeClose).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("disposes on the panel's own animationend immediately after ignoring a descendant one", () => {
    const { ref, overlayElement, dispose } = createFakeOverlayRef();
    const child = overlayElement.appendChild(document.createElement('div'));
    const overlayRef = new TestOverlayRef<string>(ref);
    let result: string | undefined;
    overlayRef.afterClosed().subscribe((value) => (result = value));

    overlayRef.close('done');
    // Consumer content finishing its own finite animation inside the leave
    // window: ignored (#231)…
    child.dispatchEvent(animationEnd());
    expect(dispose).not.toHaveBeenCalled();

    // …and the listener must still be there for the pane's own leave. A
    // `once: true` listener would have been spent by the ignored event above,
    // stranding the leave on the fallback timer. Everything here is synchronous,
    // so that 20ms timer cannot be what disposes.
    overlayElement.dispatchEvent(animationEnd());
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(result).toBe('done');
  });

  it('releases the panel animationend listener once disposed', () => {
    const { ref, overlayElement } = createFakeOverlayRef();
    const removeSpy = vi.spyOn(overlayElement, 'removeEventListener');
    const overlayRef = new TestOverlayRef(ref);

    overlayRef.close();
    overlayElement.dispatchEvent(animationEnd());

    expect(
      removeSpy.mock.calls.filter(([type]) => type === 'animationend'),
    ).toHaveLength(1);
  });

  it('falls back to the timeout when animationend never fires', async () => {
    const { ref, dispose } = createFakeOverlayRef();
    const overlayRef = new TestOverlayRef(ref);

    const closed = firstValueFrom(overlayRef.afterClosed());
    overlayRef.close();
    await closed;

    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('disposes immediately when there is no panel element', () => {
    const backdropElement = document.createElement('div');
    const dispose = vi.fn();
    const ref = {
      backdropElement,
      overlayElement: null,
      dispose,
    } as unknown as OverlayRef;

    const overlayRef = new TestOverlayRef(ref);
    overlayRef.close();

    expect(dispose).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// MlvOverlayHostBase
// ---------------------------------------------------------------------------

@Component({
  selector: 'test-overlay-host',
  imports: [OverlayModule, A11yModule],
  template: `
    <button class="trigger">Open</button>
    <ng-template #tpl>
      <!-- aria-label is the harness playing the part of a real subclass:
           MlvOverlayHostBase emits no ARIA of its own, and MlvDrawer names its
           own role="dialog" surface (through mlv-drawer-header's
           aria-labelledby registration). Without it the sweep below would be
           judging a subclass nobody ships. The (animationend) binding mirrors
           MlvDrawer / MlvSearchField too: the guarded handler, never the raw
           onAnimationEnd(), or this suite exercises the path they don't ship. -->
      <div
        class="test-panel"
        role="dialog"
        aria-label="Test overlay"
        (animationend)="_onPanelAnimationEnd($event)"
      >
        <button class="mlv-button--close">Close</button>
        <button class="inside">Inside</button>
      </div>
    </ng-template>
  `,
})
class TestHostComponent extends MlvOverlayHostBase {
  protected override readonly _backdropClass = 'test-host-backdrop';
  protected override readonly _leaveFallbackMs = 20;
  private readonly _tpl = viewChild<TemplateRef<unknown>>('tpl');

  protected override _getOverlayTemplate(): TemplateRef<unknown> | undefined {
    return this._tpl();
  }

  protected override _buildPositionStrategy(): PositionStrategy {
    return this._overlay
      .position()
      .global()
      .centerHorizontally()
      .centerVertically();
  }
}

@Component({
  imports: [TestHostComponent],
  template: `
    <button class="trigger">Open</button>
    <button class="fallback">Fallback</button>
    <test-overlay-host [opened]="opened()" [restoreFocus]="restoreFocus()" />
  `,
})
class DeclarativeOverlayHostComponent {
  readonly opened = signal(false);
  readonly restoreFocus = signal(true);
}

describe('MlvOverlayHostBase — focus restoration input', () => {
  let fixture: ComponentFixture<DeclarativeOverlayHostComponent>;
  let host: DeclarativeOverlayHostComponent;
  let trigger: HTMLButtonElement;
  let fallback: HTMLButtonElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeclarativeOverlayHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DeclarativeOverlayHostComponent);
    host = fixture.componentInstance;
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
    trigger = fixture.nativeElement.querySelector('.trigger');
    fallback = fixture.nativeElement.querySelector('.fallback');
  });

  afterEach(() => {
    fixture.destroy();
    fixture.nativeElement.remove();
  });

  function finishLeaveAnimation(): void {
    fixture.detectChanges();
    document
      .querySelector('.test-panel')
      ?.dispatchEvent(new Event('animationend'));
    fixture.detectChanges();
  }

  it('restores focus by default after disposal', async () => {
    trigger.focus();
    host.opened.set(true);
    fixture.detectChanges();
    host.opened.set(false);
    finishLeaveAnimation();
    expect(document.activeElement).toBe(trigger);
  });

  it('does not restore focus when restoreFocus is false', async () => {
    host.restoreFocus.set(false);
    trigger.focus();
    host.opened.set(true);
    fixture.detectChanges();
    fallback.focus();
    host.opened.set(false);
    finishLeaveAnimation();
    expect(document.activeElement).toBe(fallback);
  });

  it('keeps the overlay rendered when reopened during leave', () => {
    host.opened.set(true);
    fixture.detectChanges();
    const leavingPanel = document.querySelector('.test-panel');
    expect(leavingPanel).not.toBeNull();

    host.opened.set(false);
    fixture.detectChanges();
    host.opened.set(true);
    fixture.detectChanges();
    leavingPanel?.dispatchEvent(new Event('animationend'));
    fixture.detectChanges();

    expect(host.opened()).toBe(true);
    expect(document.querySelector('.test-panel')).not.toBeNull();
  });
});

describe('MlvOverlayHostBase', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.nativeElement.remove();
  });

  function panel(): HTMLElement | null {
    return document.querySelector('.test-panel');
  }

  it('creates the overlay and emits afterOpened when opened', async () => {
    let opened = false;
    host.afterOpened.subscribe(() => (opened = true));

    host.opened.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(panel()).not.toBeNull();
    expect(opened).toBe(true);
    expect(host.animationState()).toBe('enter');
  });

  it('restores focus to the trigger and emits afterClosed after the leave animation', async () => {
    const trigger = fixture.nativeElement.querySelector(
      '.trigger',
    ) as HTMLButtonElement;
    trigger.focus();

    host.opened.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    let closed = false;
    host.afterClosed.subscribe(() => (closed = true));

    host.opened.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.animationState()).toBe('leave');

    panel()?.dispatchEvent(new Event('animationend'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(closed).toBe(true);
    expect(host.animationState()).toBe('idle');
    expect(document.activeElement).toBe(trigger);
  });

  it('moves focus past the close button to the first real control on open', async () => {
    host.opened.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe(panel()?.querySelector('.inside'));
  });

  it('honours an explicit initialFocus strategy', async () => {
    fixture.componentRef.setInput('initialFocus', 'container');
    host.opened.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe(panel());
    expect(panel()?.getAttribute('tabindex')).toBe('-1');
  });

  it('honours an initialFocus CSS selector', async () => {
    fixture.componentRef.setInput('initialFocus', '.mlv-button--close');
    host.opened.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe(
      panel()?.querySelector('.mlv-button--close'),
    );
  });

  it('disposes via the fallback timer when animationend never fires (reduced motion)', async () => {
    host.opened.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    let closed = false;
    host.afterClosed.subscribe(() => (closed = true));

    host.opened.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.animationState()).toBe('leave');
    expect(panel()).not.toBeNull();

    // No animationend dispatched — the _leaveFallbackMs (20ms) timer must dispose.
    await new Promise((resolve) => setTimeout(resolve, 60));
    fixture.detectChanges();

    expect(closed).toBe(true);
    expect(host.animationState()).toBe('idle');
    expect(panel()).toBeNull();
  });

  describe('animationend target', () => {
    /** Panels attached to the live CDK overlay container right now. */
    function attachedPanels(): NodeListOf<Element> {
      return TestBed.inject(OverlayContainer)
        .getContainerElement()
        .querySelectorAll('.test-panel');
    }

    /** Opens, then starts the leave; resolves with a live `afterClosed` flag. */
    async function openThenClose(): Promise<{ closed: () => boolean }> {
      host.opened.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(attachedPanels()).toHaveLength(1);

      let closed = false;
      host.afterClosed.subscribe(() => (closed = true));

      host.opened.set(false);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(host.animationState()).toBe('leave');
      return { closed: () => closed };
    }

    it('keeps the overlay attached for an animationend bubbling out of the panel content', async () => {
      const { closed } = await openThenClose();

      // A consumer component inside the panel finishing its own finite CSS
      // animation inside the leave window (a row fade-in, a one-shot
      // highlight). Only the panel's own leave keyframes may dispose (#231).
      const child = panel()?.querySelector('.inside') as HTMLElement | null;
      expect(child).not.toBeNull();
      child?.dispatchEvent(animationEnd());
      fixture.detectChanges();

      expect(attachedPanels()).toHaveLength(1);
      expect(host.animationState()).toBe('leave');
      expect(closed()).toBe(false);
    });

    it('disposes the overlay for an animationend raised by the panel itself', async () => {
      const { closed } = await openThenClose();

      panel()?.dispatchEvent(animationEnd());
      fixture.detectChanges();

      expect(attachedPanels()).toHaveLength(0);
      expect(host.animationState()).toBe('idle');
      expect(closed()).toBe(true);
    });

    it('still force-completes through the fallback timer after ignoring a content animationend', async () => {
      const { closed } = await openThenClose();

      panel()?.querySelector('.inside')?.dispatchEvent(animationEnd());
      fixture.detectChanges();
      expect(attachedPanels()).toHaveLength(1);

      // The fallback calls `onAnimationEnd()` with no event at all; the guard
      // must not sit on that path (_leaveFallbackMs is 20ms here).
      await new Promise((resolve) => setTimeout(resolve, 60));
      fixture.detectChanges();

      expect(attachedPanels()).toHaveLength(0);
      expect(closed()).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// MlvOverlayServiceBase
// ---------------------------------------------------------------------------

@Component({
  selector: 'test-overlay-content',
  template: `
    <div class="mlv-scrollbar__viewport" tabindex="0">
      <button class="svc-inside">Hi</button>
    </div>
  `,
})
class TestContentComponent {}

type TestServiceConfig = MlvBaseOverlayConfig;

@Injectable()
class TestOverlayService extends MlvOverlayServiceBase<
  TestServiceConfig,
  TestOverlayRef
> {
  protected override readonly _enterAnimationClass = 'test-svc--enter';

  protected override _buildPositionStrategy(): PositionStrategy {
    return this._overlay
      .position()
      .global()
      .centerHorizontally()
      .centerVertically();
  }

  protected override _buildOverlayConfig(): OverlayConfig {
    return { backdropClass: 'test-svc-backdrop' };
  }

  protected override _createRef(overlayRef: OverlayRef): TestOverlayRef {
    return new TestOverlayRef(overlayRef);
  }

  protected override _createProviders(): StaticProvider[] {
    return [];
  }

  protected override _decoratePanel(panelEl: HTMLElement): void {
    panelEl.classList.add('test-svc-panel');
  }
}

describe('MlvOverlayServiceBase', () => {
  let service: TestOverlayService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [TestOverlayService] });
    service = TestBed.inject(TestOverlayService);
  });

  afterEach(() => {
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((el) => el.remove());
  });

  it('opens the component in an overlay with dialog semantics and enter animation', () => {
    const ref = service.open(TestContentComponent);

    const panel = document.querySelector('.test-svc-panel');
    expect(panel).not.toBeNull();
    expect(panel?.getAttribute('role')).toBe('dialog');
    expect(panel?.getAttribute('aria-modal')).toBe('true');
    expect(panel?.classList.contains('test-svc--enter')).toBe(true);
    expect(document.querySelector('.svc-inside')).not.toBeNull();
    expect(ref).toBeInstanceOf(TestOverlayRef);

    panel?.dispatchEvent(new Event('animationend'));
    expect(panel?.classList.contains('test-svc--enter')).toBe(false);
  });

  describe('animationend target', () => {
    /** Panes attached to the live CDK overlay container right now. */
    function attachedPanes(): NodeListOf<Element> {
      return TestBed.inject(OverlayContainer)
        .getContainerElement()
        .querySelectorAll('.test-svc-panel');
    }

    it('keeps the enter class through an animationend bubbling out of the content', () => {
      service.open(TestContentComponent);
      const pane = attachedPanes()[0] as HTMLElement;
      expect(pane.classList.contains('test-svc--enter')).toBe(true);

      document.querySelector('.svc-inside')?.dispatchEvent(animationEnd());
      expect(pane.classList.contains('test-svc--enter')).toBe(true);

      // The pane's own enter keyframes still clear it — a guard that consumed
      // its one-shot listener on the ignored event would latch the class.
      pane.dispatchEvent(animationEnd());
      expect(pane.classList.contains('test-svc--enter')).toBe(false);
    });

    it('keeps the pane attached for an animationend bubbling out of the content during the leave', () => {
      const ref = service.open(TestContentComponent);
      expect(attachedPanes()).toHaveLength(1);
      let closed = false;
      ref.afterClosed().subscribe(() => (closed = true));

      ref.close();
      // Synchronous from here on: TestOverlayRef's 20ms fallback cannot fire.
      const child = document.querySelector('.svc-inside');
      expect(child).not.toBeNull();
      child?.dispatchEvent(animationEnd());

      expect(attachedPanes()).toHaveLength(1);
      expect(closed).toBe(false);
    });

    it('disposes the pane for an animationend raised by the pane itself during the leave', () => {
      const ref = service.open(TestContentComponent);
      const pane = attachedPanes()[0] as HTMLElement;
      let closed = false;
      ref.afterClosed().subscribe(() => (closed = true));

      ref.close();
      pane.dispatchEvent(animationEnd());

      expect(attachedPanes()).toHaveLength(0);
      expect(closed).toBe(true);
    });
  });

  it('closes and tears down the overlay when the backdrop is clicked', async () => {
    const ref = service.open(TestContentComponent);
    const closed = firstValueFrom(ref.afterClosed());

    const backdrop = document.querySelector(
      '.test-svc-backdrop',
    ) as HTMLElement | null;
    expect(backdrop).not.toBeNull();
    backdrop?.click();

    // The leave animation resolves via TestOverlayRef's 20ms fallback timeout.
    await closed;
    expect(document.querySelector('.svc-inside')).toBeNull();
  });

  it('focuses content past the scroll viewport rather than the viewport itself', async () => {
    const ref = service.open(TestContentComponent);
    await TestBed.inject(ApplicationRef).whenStable();

    expect(document.activeElement).toBe(document.querySelector('.svc-inside'));

    ref.close();
    document
      .querySelector('.test-svc-panel')
      ?.dispatchEvent(new Event('animationend'));
  });

  it('honours config.initialFocus', async () => {
    const ref = service.open(TestContentComponent, {
      initialFocus: 'container',
    });
    await TestBed.inject(ApplicationRef).whenStable();

    expect(document.activeElement).toBe(
      document.querySelector('.test-svc-panel'),
    );

    ref.close();
    document
      .querySelector('.test-svc-panel')
      ?.dispatchEvent(new Event('animationend'));
  });

  it('restores focus to the element active before the service opened', async () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const ref = service.open(TestContentComponent);
    const closed = firstValueFrom(ref.afterClosed());
    ref.close();
    document
      .querySelector('.test-svc-panel')
      ?.dispatchEvent(new Event('animationend'));
    await closed;

    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});

/**
 * A subclass that renders the opened component inside a surface of its own
 * instead of straight into the pane — the shape `MlvDrawerService` takes to
 * render through the drawer's component shell. A bare `<div>` stands in for
 * that shell: the base only cares which element the hook hands back.
 */
@Injectable()
class SurfaceOverlayService extends TestOverlayService {
  protected override _attachContent<T>(
    overlayRef: OverlayRef,
    component: Type<T>,
    injector: Injector,
  ): HTMLElement {
    const surface = document.createElement('div');
    surface.className = 'test-svc-surface';
    overlayRef.overlayElement.appendChild(surface);
    const componentRef = overlayRef.attach(
      new ComponentPortal(component, null, injector),
    );
    surface.appendChild(componentRef.location.nativeElement);
    return surface;
  }
}

describe('MlvOverlayServiceBase — content surface', () => {
  function pane(): HTMLElement | null {
    return document.querySelector('.cdk-overlay-pane');
  }

  function surface(): HTMLElement | null {
    return document.querySelector('.test-svc-surface');
  }

  afterEach(() => {
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((el) => el.remove());
  });

  it('treats the pane as the surface when the hook is not overridden', () => {
    TestBed.configureTestingModule({ providers: [TestOverlayService] });
    const ref = TestBed.inject(TestOverlayService).open(TestContentComponent);

    const host = document.querySelector('test-overlay-content') as HTMLElement;
    expect(host.parentElement).toBe(pane());
    expect(host.style.display).toBe('flex');
    expect(host.style.minHeight).toBe('0');
    expect(pane()?.classList.contains('test-svc-panel')).toBe(true);
    expect(pane()?.getAttribute('role')).toBe('dialog');
    expect(pane()?.getAttribute('tabindex')).toBe('-1');

    ref.close();
    expect(pane()?.classList.contains('test-panel--leave')).toBe(true);
    pane()?.dispatchEvent(animationEnd());
    expect(pane()).toBeNull();
  });

  it('puts the dialog semantics, decoration and enter class on the surface the hook returns', () => {
    TestBed.configureTestingModule({ providers: [SurfaceOverlayService] });
    TestBed.inject(SurfaceOverlayService).open(TestContentComponent);

    expect(surface()).not.toBeNull();
    expect(surface()?.getAttribute('role')).toBe('dialog');
    expect(surface()?.getAttribute('aria-modal')).toBe('true');
    expect(surface()?.getAttribute('tabindex')).toBe('-1');
    expect(surface()?.classList.contains('test-svc-panel')).toBe(true);
    expect(surface()?.classList.contains('test-svc--enter')).toBe(true);
    expect(pane()?.hasAttribute('role')).toBe(false);
    expect(pane()?.classList.contains('test-svc-panel')).toBe(false);
    expect(pane()?.classList.contains('test-svc--enter')).toBe(false);

    // Only the surface's own keyframes clear the enter class.
    pane()?.dispatchEvent(animationEnd());
    expect(surface()?.classList.contains('test-svc--enter')).toBe(true);
    surface()?.dispatchEvent(animationEnd());
    expect(surface()?.classList.contains('test-svc--enter')).toBe(false);
  });

  it('plays the leave on the surface and disposes on its own animationend only', () => {
    TestBed.configureTestingModule({ providers: [SurfaceOverlayService] });
    const ref = TestBed.inject(SurfaceOverlayService).open(
      TestContentComponent,
    );
    let closed = false;
    ref.afterClosed().subscribe(() => (closed = true));

    ref.close();
    expect(surface()?.classList.contains('test-panel--leave')).toBe(true);
    expect(pane()?.classList.contains('test-panel--leave')).toBe(false);

    // Synchronous from here on: TestOverlayRef's 20ms fallback cannot fire.
    // The pane is an ancestor of the surface, so its event is not the
    // surface's own; neither is the content's, bubbling up through it.
    document.querySelector('.svc-inside')?.dispatchEvent(animationEnd());
    pane()?.dispatchEvent(animationEnd());
    expect(closed).toBe(false);

    surface()?.dispatchEvent(animationEnd());
    expect(closed).toBe(true);
    expect(pane()).toBeNull();
  });

  it('resolves initial focus against the surface', async () => {
    TestBed.configureTestingModule({ providers: [SurfaceOverlayService] });
    const ref = TestBed.inject(SurfaceOverlayService).open(
      TestContentComponent,
      { initialFocus: 'container' },
    );
    await TestBed.inject(ApplicationRef).whenStable();

    expect(document.activeElement).toBe(surface());

    ref.close();
    surface()?.dispatchEvent(animationEnd());
  });

  it('drops the surface once the ref has disposed the overlay', () => {
    TestBed.configureTestingModule({ providers: [SurfaceOverlayService] });
    const ref = TestBed.inject(SurfaceOverlayService).open(
      TestContentComponent,
    );
    const surfaceEl = surface();
    expect(surfaceEl).not.toBeNull();
    expect(ref._surfaceElement === surfaceEl).toBe(true);

    ref.close();
    surfaceEl?.dispatchEvent(animationEnd());

    // A ref kept in a component field must not keep the detached surface's
    // DOM alive with it.
    expect(pane()).toBeNull();
    expect(ref._surfaceElement === null).toBe(true);
    expect(ref['_panelElement'] === null).toBe(true);
  });

  it('completes a close() at once after the overlay was disposed outside the ref', () => {
    TestBed.configureTestingModule({ providers: [SurfaceOverlayService] });
    const ref = TestBed.inject(SurfaceOverlayService).open(
      TestContentComponent,
    );
    let closed = false;
    ref.afterClosed().subscribe(() => (closed = true));

    // Disposed by something other than the ref's own `close()`: the surface
    // leaves the document with the pane and can never fire `animationend`.
    ref['_overlayRef'].dispose();
    expect(pane()).toBeNull();
    expect(ref['_panelElement'] === null).toBe(true);

    // Synchronous: no wait on TestOverlayRef's 20ms fallback timer.
    ref.close();
    expect(closed).toBe(true);
    expect(ref._surfaceElement === null).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

/**
 * A subclass that names its pane, which is what `MlvOverlayServiceBase`'s
 * contract asks of one: the base writes `role="dialog"` + `aria-modal="true"`
 * and stops there, leaving the accessible name to `_decoratePanel`.
 * `MlvDrawerService` does exactly this (`panelEl.setAttribute('aria-label',
 * this._i18n().drawer)`), so this is the shipped shape, and
 * `TestOverlayService` above — which omits it — is the counter-example the
 * last test in this file pins.
 */
@Injectable()
class NamedOverlayService extends TestOverlayService {
  protected override _decoratePanel(panelEl: HTMLElement): void {
    super._decoratePanel(panelEl);
    panelEl.setAttribute('aria-label', 'Test overlay');
  }
}

/**
 * Accessibility sweeps.
 *
 * Both overlay paths portal their pane to `<body>`, outside the fixture, so
 * every sweep here is rooted at the `.cdk-overlay-container` that actually
 * holds the panel — `fixture.nativeElement` never contains it, and a sweep
 * rooted there would pass while asserting nothing about the overlay.
 *
 * The states swept are the ones that change what is in that container: open
 * with a backdrop, open without one, and the imperative service path (whose
 * pane carries `role`/`aria-modal`/`tabindex` written by the base rather than
 * by a template).
 */
describe('MlvOverlayHostBase accessibility', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    fixture.nativeElement.remove();
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((el) => el.remove());
  });

  /** The `.cdk-overlay-container` holding the attached panel. */
  function overlayContainer(): HTMLElement {
    const panel = document.querySelector('.test-panel');
    expect(panel).not.toBeNull();
    const container = panel?.closest('.cdk-overlay-container');
    expect(container).not.toBeNull();
    return container as HTMLElement;
  }

  it('has no axe violations for an open modal overlay with a backdrop', async () => {
    host.opened.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    // State: pane attached, backdrop rendered, focus moved inside.
    const container = overlayContainer();
    expect(container.querySelector('.test-host-backdrop')).not.toBeNull();

    await expectNoAxeViolations(container);
  });

  it('has no axe violations for an open overlay with no backdrop', async () => {
    fixture.componentRef.setInput('hasBackdrop', false);
    host.opened.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    // State: same pane, no backdrop element between it and the page.
    const container = overlayContainer();
    expect(container.querySelector('.test-host-backdrop')).toBeNull();

    await expectNoAxeViolations(container);
  });
});

describe('MlvOverlayServiceBase accessibility', () => {
  afterEach(() => {
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((el) => el.remove());
  });

  it('has no axe violations for a named service-opened pane', async () => {
    TestBed.configureTestingModule({ providers: [NamedOverlayService] });
    const service = TestBed.inject(NamedOverlayService);
    service.open(TestContentComponent);
    await TestBed.inject(ApplicationRef).whenStable();

    const panel = document.querySelector('.test-svc-panel') as HTMLElement;
    // State: the semantics the base writes onto every pane it opens.
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.getAttribute('aria-modal')).toBe('true');
    expect(panel.getAttribute('tabindex')).toBe('-1');

    await expectNoAxeViolations(
      panel.closest('.cdk-overlay-container') as HTMLElement,
    );
  });

  /**
   * Non-vacuity, and the base's contract stated as a test. `role="dialog"` with
   * `aria-modal="true"` and no accessible name is a real WCAG 4.1.2 failure, and
   * `MlvOverlayServiceBase` writes that pair without ever naming the pane — so a
   * subclass whose `_decoratePanel` forgets the name ships an unnamed modal.
   * `TestOverlayService` is that subclass; asserting the violation here is what
   * keeps the clean sweep above from being clean because axe saw nothing.
   */
  it('leaves a subclass that never names its pane failing aria-dialog-name', async () => {
    TestBed.configureTestingModule({ providers: [TestOverlayService] });
    const service = TestBed.inject(TestOverlayService);
    service.open(TestContentComponent);
    await TestBed.inject(ApplicationRef).whenStable();

    const panel = document.querySelector('.test-svc-panel') as HTMLElement;
    expect(panel.hasAttribute('aria-label')).toBe(false);
    expect(panel.hasAttribute('aria-labelledby')).toBe(false);

    const results = await runAxe(
      panel.closest('.cdk-overlay-container') as HTMLElement,
    );
    expect(results.violations.map((violation) => violation.id)).toContain(
      'aria-dialog-name',
    );
  });
});
