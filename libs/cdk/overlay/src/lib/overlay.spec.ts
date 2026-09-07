import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import type { StaticProvider, TemplateRef } from '@angular/core';
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
import { OverlayModule } from '@angular/cdk/overlay';
import { A11yModule } from '@angular/cdk/a11y';
import { firstValueFrom } from 'rxjs';
import { expectNoAxeViolations, runAxe } from '@malva-ui/internal-testing/axe';

import type { MlvBaseOverlayConfig } from './overlay-config';
import { MlvOverlayRef } from './overlay-ref';
import { MlvOverlayHostBase } from './overlay-host-base';
import { MlvOverlayServiceBase } from './overlay-service-base';

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
           judging a subclass nobody ships. -->
      <div
        class="test-panel"
        role="dialog"
        aria-label="Test overlay"
        (animationend)="onAnimationEnd()"
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
