import { ApplicationRef, Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import type { DebugElement } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { OverlayRef } from '@angular/cdk/overlay';
import { Overlay, OverlayContainer } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as Sass from 'sass';
import { vi } from 'vitest';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import {
  MlvDialog,
  MlvDialogBody,
  MlvDialogService,
} from '@malva-ui/core/dialog';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvTooltip } from './tooltip';
import type { MlvTooltipPlacement } from './tooltip.types';

const nodeRequire = createRequire(import.meta.url);
const sass = nodeRequire('sass') as typeof Sass;
const tooltipStyles = sass.compile(
  join(dirname(fileURLToPath(import.meta.url)), 'tooltip-panel.scss'),
).css;

@Component({
  imports: [MlvTooltip],
  template: `
    <button [mlvTooltip]="tooltipText" [tooltipDelay]="delay">Trigger</button>
  `,
})
class TestHostComponent {
  tooltipText = 'Test tooltip';
  delay = 0;
}

@Component({
  imports: [MlvTooltip],
  template: `<button [mlvTooltip]="'Test'" [tooltipDisabled]="true">
    Trigger
  </button>`,
})
class DisabledHostComponent {}

@Component({
  imports: [MlvTooltip],
  template: `<button [mlvTooltip]="'Test'" [tooltipArrow]="false">
    Trigger
  </button>`,
})
class NoArrowHostComponent {}

describe('MlvTooltip', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let triggerEl: DebugElement;
  let overlayContainer: OverlayContainer;
  let overlayContainerEl: HTMLElement;

  beforeEach(async () => {
    vi.useFakeTimers();

    await TestBed.configureTestingModule({
      imports: [TestHostComponent, DisabledHostComponent, NoArrowHostComponent],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);
    overlayContainerEl = overlayContainer.getContainerElement();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();

    triggerEl = fixture.debugElement.query(By.css('button'));
  });

  afterEach(() => {
    vi.useRealTimers();
    overlayContainer.ngOnDestroy();
  });

  it('should create without error', () => {
    expect(host).toBeTruthy();
    const directive = triggerEl.injector.get(MlvTooltip);
    expect(directive).toBeTruthy();
  });

  it('should have default inputs (placement, tone, arrow, disabled)', () => {
    const directive = triggerEl.injector.get(MlvTooltip);

    expect(directive.tooltipPlacement()).toBe('top');
    expect(directive.tooltipTone()).toBe('neutral');
    expect(directive.tooltipArrow()).toBe(true);
    expect(directive.tooltipDisabled()).toBe(false);
  });

  it('should have default delay input signal defined', () => {
    const directive = triggerEl.injector.get(MlvTooltip);
    // The input signal is a function
    expect(typeof directive.tooltipDelay).toBe('function');
    // Default value is 300; test host overrides with 0 for instant testing
    // The directive default is validated through TypeScript types
    expect(directive.tooltipDelay).toBeDefined();
  });

  it('should show tooltip on mouseenter after delay', async () => {
    triggerEl.nativeElement.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();

    // Not visible yet before timer fires
    expect(overlayContainerEl.querySelector('[role="tooltip"]')).toBeNull();

    vi.runAllTimers();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(overlayContainerEl.querySelector('[role="tooltip"]')).not.toBeNull();
  });

  it('should hide tooltip on mouseleave', async () => {
    triggerEl.nativeElement.dispatchEvent(new MouseEvent('mouseenter'));
    vi.runAllTimers();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(overlayContainerEl.querySelector('[role="tooltip"]')).not.toBeNull();

    triggerEl.nativeElement.dispatchEvent(new MouseEvent('mouseleave'));
    // Hide is deferred by a grace period (WCAG 1.4.13) — run the hide timer.
    vi.runAllTimers();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(overlayContainerEl.querySelector('[role="tooltip"]')).toBeNull();
  });

  it('should show tooltip on focusin', async () => {
    triggerEl.nativeElement.dispatchEvent(new FocusEvent('focusin'));
    vi.runAllTimers();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(overlayContainerEl.querySelector('[role="tooltip"]')).not.toBeNull();
  });

  it('should hide tooltip on focusout', async () => {
    triggerEl.nativeElement.dispatchEvent(new FocusEvent('focusin'));
    vi.runAllTimers();
    fixture.detectChanges();
    await fixture.whenStable();

    triggerEl.nativeElement.dispatchEvent(new FocusEvent('focusout'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(overlayContainerEl.querySelector('[role="tooltip"]')).toBeNull();
  });

  it('should not show tooltip when tooltipDisabled is true', async () => {
    const disabledFixture = TestBed.createComponent(DisabledHostComponent);
    disabledFixture.detectChanges();
    const disabledTrigger = disabledFixture.debugElement.query(
      By.css('button'),
    );

    disabledTrigger.nativeElement.dispatchEvent(new MouseEvent('mouseenter'));
    vi.runAllTimers();
    disabledFixture.detectChanges();
    await disabledFixture.whenStable();

    expect(overlayContainerEl.querySelector('[role="tooltip"]')).toBeNull();
  });

  it('should set aria-describedby on host when tooltip is shown', async () => {
    triggerEl.nativeElement.dispatchEvent(new MouseEvent('mouseenter'));
    vi.runAllTimers();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(
      triggerEl.nativeElement.getAttribute('aria-describedby'),
    ).toBeTruthy();
    expect(triggerEl.nativeElement.getAttribute('aria-describedby')).toMatch(
      /^mlv-tooltip-/,
    );
  });

  it('should remove aria-describedby when tooltip is hidden', async () => {
    triggerEl.nativeElement.dispatchEvent(new MouseEvent('mouseenter'));
    vi.runAllTimers();
    fixture.detectChanges();
    await fixture.whenStable();

    triggerEl.nativeElement.dispatchEvent(new MouseEvent('mouseleave'));
    vi.runAllTimers();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(triggerEl.nativeElement.getAttribute('aria-describedby')).toBeNull();
  });

  it('should keep the tooltip open while the pointer is over the panel (hoverable)', async () => {
    triggerEl.nativeElement.dispatchEvent(new MouseEvent('mouseenter'));
    vi.runAllTimers();
    fixture.detectChanges();
    await fixture.whenStable();

    const pane = overlayContainerEl.querySelector(
      '.cdk-overlay-pane',
    ) as HTMLElement;
    expect(pane).not.toBeNull();

    // Pointer leaves the trigger but moves onto the panel before the grace
    // period elapses — the tooltip must remain visible.
    triggerEl.nativeElement.dispatchEvent(new MouseEvent('mouseleave'));
    pane.dispatchEvent(new MouseEvent('mouseenter'));
    vi.runAllTimers();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(overlayContainerEl.querySelector('[role="tooltip"]')).not.toBeNull();
  });

  it('should hide the tooltip after the pointer leaves the panel', async () => {
    triggerEl.nativeElement.dispatchEvent(new MouseEvent('mouseenter'));
    vi.runAllTimers();
    fixture.detectChanges();
    await fixture.whenStable();

    const pane = overlayContainerEl.querySelector(
      '.cdk-overlay-pane',
    ) as HTMLElement;

    // Move onto the panel, then off it — the tooltip hides after the grace period.
    triggerEl.nativeElement.dispatchEvent(new MouseEvent('mouseleave'));
    pane.dispatchEvent(new MouseEvent('mouseenter'));
    pane.dispatchEvent(new MouseEvent('mouseleave'));
    vi.runAllTimers();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(overlayContainerEl.querySelector('[role="tooltip"]')).toBeNull();
  });

  it('should hide tooltip on Escape key', async () => {
    triggerEl.nativeElement.dispatchEvent(new MouseEvent('mouseenter'));
    vi.runAllTimers();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(overlayContainerEl.querySelector('[role="tooltip"]')).not.toBeNull();

    triggerEl.nativeElement.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    expect(overlayContainerEl.querySelector('[role="tooltip"]')).toBeNull();
  });

  it('should cancel pending show when mouseleave happens before delay elapses', async () => {
    // Mouseenter then immediately mouseleave — timer fires after, but tooltip should not show
    triggerEl.nativeElement.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();

    triggerEl.nativeElement.dispatchEvent(new MouseEvent('mouseleave'));
    fixture.detectChanges();

    vi.runAllTimers();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(overlayContainerEl.querySelector('[role="tooltip"]')).toBeNull();
  });

  it('should pass tooltipArrow=false to component (no arrow rendered)', async () => {
    const noArrowFixture = TestBed.createComponent(NoArrowHostComponent);
    noArrowFixture.detectChanges();
    const noArrowTrigger = noArrowFixture.debugElement.query(By.css('button'));

    noArrowTrigger.nativeElement.dispatchEvent(new MouseEvent('mouseenter'));
    vi.runAllTimers();
    noArrowFixture.detectChanges();
    await noArrowFixture.whenStable();

    const tooltip = overlayContainerEl.querySelector('[role="tooltip"]');
    expect(tooltip).not.toBeNull();
    expect(tooltip?.querySelector('.mlv-tooltip__arrow')).toBeNull();
  });

  it('should display the tooltip text content', async () => {
    triggerEl.nativeElement.dispatchEvent(new MouseEvent('mouseenter'));
    vi.runAllTimers();
    fixture.detectChanges();
    await fixture.whenStable();

    const content = overlayContainerEl.querySelector('.mlv-tooltip__content');
    expect(content?.textContent?.trim()).toBe('Test tooltip');
  });
});

describe('MlvTooltip tone stylesheet', () => {
  it('uses theme-independent names and keeps the neutral tone readable in dark mode', () => {
    expect(tooltipStyles).toContain('.mlv-tooltip--tone-neutral');
    expect(tooltipStyles).toContain(
      '--mlv-tt-bg: var(--mlv-palette-neutral-900)',
    );
    expect(tooltipStyles).toContain(
      '--mlv-tt-color: var(--mlv-text-primary-on-accent-1)',
    );
    expect(tooltipStyles).not.toContain('.mlv-tooltip--tone-dark');
  });

  it('names the theme-following base surface as surface', () => {
    expect(tooltipStyles).toContain('.mlv-tooltip--tone-surface');
    expect(tooltipStyles).toContain('--mlv-tt-bg: var(--mlv-background-base)');
    expect(tooltipStyles).toContain('--mlv-tt-color: var(--mlv-text-primary)');
    expect(tooltipStyles).not.toContain('.mlv-tooltip--tone-light');
  });
});

// ---------------------------------------------------------------------------
// Inline offsets (#180)
//
// `ConnectedPosition.offsetX` is **physical**. `FlexibleConnectedPositionStrategy`
// returns it verbatim from `_getOffset()` and applies it as `x += offsetX` when
// scoring a candidate and as `translateX(${offsetX}px)` on the pane, with no
// `_isRtl()` on that path — unlike `originX` / `overlayX`, which it mirrors. So
// a `left` tooltip, mirrored to render physically *right* of its trigger in
// RTL, kept being pulled 6px further left: the arrow's clearance became a 6px
// overlap.
//
// These read the pane's own `transform`, which CDK composes from `offsetX`
// alone — no measurement, so jsdom's absent layout does not enter into it. The
// all-zero rects do decide *which* candidate wins: every position "fits" a 0×0
// viewport, so the preferred entry is applied and the fallback is never
// reached.
// ---------------------------------------------------------------------------

@Component({
  imports: [MlvTooltip],
  template: `
    <div [attr.dir]="scopeDir()">
      <button
        [mlvTooltip]="'Test'"
        [tooltipPlacement]="placement()"
        [tooltipDelay]="0"
      >
        Trigger
      </button>
    </div>
  `,
})
class ScopedPlacementHostComponent {
  readonly scopeDir = signal<'ltr' | 'rtl' | null>(null);
  readonly placement = signal<MlvTooltipPlacement>('left');
}

describe('MlvTooltip — inline offsets', () => {
  let overlayContainer: OverlayContainer;
  let overlayContainerEl: HTMLElement;
  let rtlService: MlvRtlService;

  beforeEach(async () => {
    vi.useFakeTimers();
    document.documentElement.removeAttribute('dir');
    await TestBed.configureTestingModule({
      imports: [ScopedPlacementHostComponent],
    }).compileComponents();
    overlayContainer = TestBed.inject(OverlayContainer);
    overlayContainerEl = overlayContainer.getContainerElement();
    rtlService = TestBed.inject(MlvRtlService);
  });

  afterEach(() => {
    rtlService.setDirection('ltr');
    vi.useRealTimers();
    overlayContainer.ngOnDestroy();
    document.documentElement.removeAttribute('dir');
  });

  /** Shows the tooltip and flushes the render in which CDK positions the pane. */
  async function show(
    scopeDir: 'ltr' | 'rtl' | null,
    placement: MlvTooltipPlacement = 'left',
  ): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(ScopedPlacementHostComponent);
    fixture.componentInstance.scopeDir.set(scopeDir);
    fixture.componentInstance.placement.set(placement);
    fixture.detectChanges();

    const trigger = fixture.debugElement.query(By.css('button'))
      .nativeElement as HTMLElement;
    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    vi.runAllTimers();
    fixture.detectChanges();
    await fixture.whenStable();

    return overlayContainerEl.querySelector('.cdk-overlay-pane') as HTMLElement;
  }

  it('pulls a left-placed tooltip away from the trigger in LTR', async () => {
    const pane = await show(null);

    // `overlayX: 'end'` resolves to the physical right anchor, so -6px is
    // leftward — away from the trigger's left edge.
    expect(pane.style.transform).toBe('translateX(-6px)');
  });

  it('mirrors the clearance when the document direction is RTL', async () => {
    rtlService.setDirection('rtl');
    const pane = await show(null);

    expect(pane.style.transform).toBe('translateX(6px)');
  });

  it('mirrors it under a scoped [dir="rtl"] while the document stays LTR', async () => {
    const pane = await show('rtl');

    expect(rtlService.direction()).toBe('ltr');
    expect(pane.style.transform).toBe('translateX(6px)');
  });

  it('leaves it alone in an LTR island inside an RTL document', async () => {
    rtlService.setDirection('rtl');
    const pane = await show('ltr');

    expect(rtlService.direction()).toBe('rtl');
    expect(pane.style.transform).toBe('translateX(-6px)');
  });

  it('leaves the block-axis clearance untouched in both directions', async () => {
    expect((await show(null, 'bottom')).style.transform).toBe(
      'translateY(6px)',
    );
    // `offsetY` is the block axis, which never mirrors.
    expect((await show('rtl', 'bottom')).style.transform).toBe(
      'translateY(6px)',
    );
  });
});

// ---------------------------------------------------------------------------
// Escape (#319, WCAG 1.4.13, D13)
//
// Escape used to be a host `(keydown.escape)` listener, so it reached the
// tooltip only while focus sat on the host: a hover-shown tooltip could not be
// dismissed from the keyboard at all. And the tooltip overlay had no
// `keydownEvents()` subscriber, so CDK's `OverlayKeyboardDispatcher` (one
// `keydown` listener on `<body>`, walking attached overlays from the top and
// stopping at the first with an observer) skipped it — inside a dialog, the
// host listener hid the tooltip and the same keystroke then reached the
// dialog's subscription and closed the dialog too.
// ---------------------------------------------------------------------------

@Component({
  imports: [MlvTooltip],
  template: `
    <button id="described" [mlvTooltip]="'Hint'" [tooltipDelay]="0">
      Trigger
    </button>
    <button id="other">Other</button>
  `,
})
class EscapeHostComponent {}

/** Content for a bare CDK overlay standing in for a dialog, drawer or popup. */
@Component({ template: '<p>Pane</p>' })
class PaneContentComponent {}

/** Attaches a bare overlay and records every key its `keydownEvents()` gets. */
function attachKeyRecordingOverlay(): { ref: OverlayRef; seen: string[] } {
  const ref = TestBed.inject(Overlay).create();
  ref.attach(new ComponentPortal(PaneContentComponent));
  const seen: string[] = [];
  ref.keydownEvents().subscribe((event) => {
    const modifiers = (['shiftKey', 'altKey', 'ctrlKey', 'metaKey'] as const)
      .filter((modifier) => event[modifier])
      .map((modifier) => modifier.replace('Key', ''));
    seen.push([event.key, ...modifiers].join('+'));
  });
  return { ref, seen };
}

/** Dispatches a bubbling, cancelable keydown and returns it. */
function pressKey(target: EventTarget, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

/** Dispatches a bubbling, cancelable Escape keydown and returns it. */
function pressEscape(
  target: EventTarget,
  init: KeyboardEventInit = {},
): KeyboardEvent {
  return pressKey(target, { key: 'Escape', ...init });
}

describe('MlvTooltip — Escape', () => {
  let fixture: ComponentFixture<EscapeHostComponent>;
  let overlayContainer: OverlayContainer;
  let trigger: HTMLButtonElement;
  let other: HTMLButtonElement;

  /** Number of tooltip panes currently attached. */
  const tooltips = () =>
    overlayContainer.getContainerElement().querySelectorAll('[role="tooltip"]')
      .length;

  async function flush(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function showOnHover(): Promise<void> {
    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    vi.runAllTimers();
    await flush();
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [EscapeHostComponent],
    }).compileComponents();
    overlayContainer = TestBed.inject(OverlayContainer);
    fixture = TestBed.createComponent(EscapeHostComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    trigger = root.querySelector('#described') as HTMLButtonElement;
    other = root.querySelector('#other') as HTMLButtonElement;
  });

  afterEach(() => {
    vi.useRealTimers();
    fixture.destroy();
    overlayContainer.ngOnDestroy();
  });

  it.each([
    ['another focused element', () => other],
    ['the body', () => document.body],
  ])(
    'dismisses a hover-shown tooltip on Escape pressed on %s',
    async (_label, target) => {
      await showOnHover();
      other.focus();
      expect(tooltips()).toBe(1);

      const event = pressEscape(target());
      await flush();

      expect(tooltips()).toBe(0);
      expect(event.defaultPrevented).toBe(true);
    },
  );

  it('consumes the Escape it dismisses on, so listeners above <body> never see it', async () => {
    await showOnHover();
    trigger.focus();
    const documentListener = vi.fn();
    document.addEventListener('keydown', documentListener);
    try {
      pressEscape(trigger);
      await flush();

      expect(tooltips()).toBe(0);
      expect(documentListener).not.toHaveBeenCalled();

      // Nothing left to dismiss: the next Escape passes through untouched.
      const next = pressEscape(trigger);
      expect(documentListener).toHaveBeenCalledOnce();
      expect(next.defaultPrevented).toBe(false);
    } finally {
      document.removeEventListener('keydown', documentListener);
    }
  });

  it.each(['shiftKey', 'altKey', 'ctrlKey', 'metaKey'] as const)(
    'leaves the tooltip up on Escape with %s held',
    async (modifier) => {
      await showOnHover();

      const event = pressEscape(document.body, { [modifier]: true });
      await flush();

      expect(tooltips()).toBe(1);
      expect(event.defaultPrevented).toBe(false);
    },
  );

  it('stays dismissed when a hover that re-entered the trigger had a show pending', async () => {
    await showOnHover();
    // Pointer drifts onto the panel and back: the re-entry schedules a show
    // that `_show()` would treat as a no-op while the tooltip is up.
    trigger.dispatchEvent(new MouseEvent('mouseleave'));
    trigger.dispatchEvent(new MouseEvent('mouseenter'));

    pressEscape(document.body);
    vi.runAllTimers();
    await flush();

    expect(tooltips()).toBe(0);
  });

  it('still cancels a pending show when Escape is pressed on the host', async () => {
    trigger.focus();
    trigger.dispatchEvent(new FocusEvent('focusin'));
    pressEscape(trigger);

    vi.runAllTimers();
    await flush();

    expect(tooltips()).toBe(0);
  });

  it('yields Escape to an overlay opened above it, then takes the next one', async () => {
    await showOnHover();
    // Focus elsewhere: the tooltip learns of the key only through the
    // dispatcher, which stops at the overlay above.
    other.focus();

    const above = attachKeyRecordingOverlay();
    try {
      pressEscape(other);
      vi.runAllTimers();
      await flush();
      expect(above.seen).toEqual(['Escape']);
      expect(tooltips()).toBe(1);
    } finally {
      // The dispatcher outlives this spec: never leave an overlay behind it.
      above.ref.dispose();
    }

    pressEscape(other);
    await flush();
    expect(tooltips()).toBe(0);
  });

  it('hides on the Escape an overlay opened above takes, while focus is on the host', async () => {
    trigger.focus();
    await showOnHover();

    // A popup opened from the host with the pointer leaves focus on the host.
    const above = attachKeyRecordingOverlay();
    try {
      pressEscape(trigger);
      vi.runAllTimers();
      await flush();

      expect(above.seen).toEqual(['Escape']);
      expect(tooltips()).toBe(0);
    } finally {
      above.ref.dispose();
    }
  });

  it('drops the armed host fallback when the tooltip hides another way first', async () => {
    trigger.focus();
    await showOnHover();

    const above = attachKeyRecordingOverlay();
    try {
      const before = vi.getTimerCount();
      // The overlay above takes the key, so the host arms its fallback.
      pressEscape(trigger);
      const armed = vi.getTimerCount();

      trigger.dispatchEvent(new FocusEvent('focusout'));

      expect(tooltips()).toBe(0);
      expect(armed - before).toBe(1);
      expect(vi.getTimerCount()).toBe(before);
    } finally {
      above.ref.dispose();
    }
  });

  it('hides on Escape pressed on the host even when an ancestor stops it before <body>', async () => {
    const root = fixture.nativeElement as HTMLElement;
    const stop = (event: Event) => event.stopPropagation();
    root.addEventListener('keydown', stop);
    try {
      trigger.focus();
      await showOnHover();

      pressEscape(trigger);
      vi.runAllTimers();
      await flush();

      expect(tooltips()).toBe(0);
    } finally {
      root.removeEventListener('keydown', stop);
    }
  });

  it('passes every other key to an overlay below it, Escape with a modifier included', async () => {
    const below = attachKeyRecordingOverlay();
    try {
      await showOnHover();
      expect(tooltips()).toBe(1);

      pressKey(document.body, { key: 'Enter' });
      pressEscape(document.body, { shiftKey: true });
      pressKey(document.body, { key: 's', ctrlKey: true });
      await flush();

      expect(below.seen).toEqual(['Enter', 'Escape+shift', 's+ctrl']);
      expect(tooltips()).toBe(1);

      // The one key the tooltip takes never reaches the overlay below.
      pressEscape(document.body);
      await flush();

      expect(below.seen).toEqual(['Enter', 'Escape+shift', 's+ctrl']);
      expect(tooltips()).toBe(0);
    } finally {
      below.ref.dispose();
    }
  });
});

@Component({
  imports: [MlvDialog, MlvDialogBody, MlvTooltip],
  template: `
    <mlv-dialog>
      <mlv-dialog-body>
        <button id="in-dialog" [mlvTooltip]="'Hint'" [tooltipDelay]="0">
          Described
        </button>
      </mlv-dialog-body>
    </mlv-dialog>
  `,
})
class TooltipDialogContent {}

describe('MlvTooltip — Escape inside an MlvDialogService dialog', () => {
  let service: MlvDialogService;

  const tooltips = () => document.querySelectorAll('[role="tooltip"]').length;
  const stabilize = () => TestBed.inject(ApplicationRef).whenStable();

  // Real timers: the zoneless scheduler behind `ApplicationRef.whenStable()`
  // races a `setTimeout` against `requestAnimationFrame`, so a faked clock
  // leaves a service-opened dialog never stable.
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideMlvI18nTesting()],
    });
    service = TestBed.inject(MlvDialogService);
  });

  afterEach(() => {
    service.closeAll();
    // End the leave animation so the dialog's ref disposes now.
    document
      .querySelectorAll('.mlv-dialog')
      .forEach((el) => el.dispatchEvent(new Event('animationend')));
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((el) => el.remove());
    TestBed.resetTestingModule();
  });

  it('closes only the tooltip on the first Escape and the dialog on the second', async () => {
    const ref = service.open(TooltipDialogContent);
    await stabilize();

    const described = document.getElementById('in-dialog') as HTMLElement;
    described.focus();
    described.dispatchEvent(new FocusEvent('focusin'));
    // `tooltipDelay` is 0: one macrotask runs the show timer.
    await new Promise((resolve) => setTimeout(resolve));
    await stabilize();
    expect(tooltips()).toBe(1);

    pressEscape(described);
    await stabilize();

    expect(tooltips()).toBe(0);
    expect(ref.animationState()).toBe('enter');

    pressEscape(described);
    await stabilize();

    expect(ref.animationState()).toBe('leave');
  });
});
