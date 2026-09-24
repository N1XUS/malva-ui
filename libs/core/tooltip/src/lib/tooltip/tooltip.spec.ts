import {
  ApplicationRef,
  Component,
  Directive,
  input,
  signal,
} from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import type { DebugElement } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Overlay, OverlayContainer, OverlayRef } from '@angular/cdk/overlay';
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
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvTooltip } from './tooltip';
import type { MlvTooltipPlacement, MlvTooltipTone } from './tooltip.types';

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

  // #321 (D12): these two asserted the old contract — the panel's own
  // `mlv-tooltip-*` id written on show, the attribute removed on hide. The host
  // is now described from init through `AriaDescriber`'s hidden element, which
  // is not the (aria-hidden) panel and outlives it.
  it('describes the host with its text while shown, through an element that is not the panel', async () => {
    triggerEl.nativeElement.dispatchEvent(new MouseEvent('mouseenter'));
    vi.runAllTimers();
    fixture.detectChanges();
    await fixture.whenStable();

    const ids = (
      triggerEl.nativeElement.getAttribute('aria-describedby') ?? ''
    ).split(/\s+/);
    expect(ids).toHaveLength(1);
    const description = document.getElementById(ids[0]);
    expect(description?.textContent).toBe('Test tooltip');
    expect(overlayContainerEl.contains(description)).toBe(false);
  });

  it('keeps the description after the tooltip is hidden', async () => {
    const before = triggerEl.nativeElement.getAttribute('aria-describedby');
    expect(before).toBeTruthy();

    triggerEl.nativeElement.dispatchEvent(new MouseEvent('mouseenter'));
    vi.runAllTimers();
    fixture.detectChanges();
    await fixture.whenStable();

    triggerEl.nativeElement.dispatchEvent(new MouseEvent('mouseleave'));
    vi.runAllTimers();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(overlayContainerEl.querySelector('[role="tooltip"]')).toBeNull();
    expect(triggerEl.nativeElement.getAttribute('aria-describedby')).toBe(
      before,
    );
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

// ---------------------------------------------------------------------------
// Description (#321, D12)
//
// The directive used to write `aria-describedby="<panel id>"` over whatever the
// host carried when the panel attached — `tooltipDelay` ms after hover or
// focus — and remove the attribute outright on hide. So a host's own
// description was replaced while the tooltip showed and gone for good after,
// a screen reader landing on the host by focus spoke it before the description
// existed, and empty content still showed a bubble and described the host with
// it. The description is now registered at init, alongside the host's own ids,
// and removed on destroy; empty content shows and describes nothing.
// ---------------------------------------------------------------------------

@Component({
  imports: [MlvTooltip],
  template: `
    <span id="rules">At least 12 characters</span>
    @if (present()) {
      <button
        id="described"
        aria-describedby="rules"
        [mlvTooltip]="text()"
        [tooltipDelay]="delay()"
        [tooltipDisabled]="disabled()"
        [tooltipArrow]="arrow()"
      >
        Password
      </button>
    }
  `,
})
class DescribedHostComponent {
  readonly present = signal(true);
  readonly text = signal('Use a passphrase');
  readonly disabled = signal(false);
  readonly arrow = signal(true);
  readonly delay = signal(300);
}

@Component({
  imports: [MlvTooltip],
  template: `
    <button id="bare" [mlvTooltip]="text()" [tooltipDelay]="0">Bare</button>
  `,
})
class BareHostComponent {
  readonly text = signal('Use a passphrase');
}

@Component({
  imports: [MlvTooltip],
  template: `
    <button
      id="named"
      aria-label="Delete item"
      [mlvTooltip]="'Delete item'"
      [tooltipDelay]="0"
    >
      <span aria-hidden="true">×</span>
    </button>
  `,
})
class NamedHostComponent {}

@Component({
  imports: [MlvTooltip],
  template: `
    @if (first()) {
      <button id="first" [mlvTooltip]="'Shared hint'">First</button>
    }
    <button id="second" [mlvTooltip]="'Shared hint'">Second</button>
  `,
})
class SharedHostComponent {
  readonly first = signal(true);
}

/**
 * Writes `aria-describedby` through a host binding, as a directive co-hosted
 * with `[mlvTooltip]` would. Angular writes an element's host bindings after
 * the effects of the view the element sits in, so a tooltip registering from
 * a plain `effect` would be overwritten by this on the first render.
 */
@Directive({
  selector: '[mlvTestOwnDescription]',
  host: { '[attr.aria-describedby]': 'mlvTestOwnDescription()' },
})
class OwnDescriptionDirective {
  readonly mlvTestOwnDescription = input<string | null>(null);
}

/**
 * A component whose own host binding writes `aria-describedby` — the shape of
 * `mlv-radio-group` and `fieldset[mlvFieldset]` with a message showing at init.
 */
@Component({
  selector: 'mlv-test-self-described',
  host: { '[attr.aria-describedby]': '"rules"' },
  template: 'Self described',
})
class SelfDescribedComponent {}

@Component({
  imports: [MlvTooltip, OwnDescriptionDirective, SelfDescribedComponent],
  template: `
    <span id="rules">At least 12 characters</span>
    <button
      id="cohosted"
      [mlvTestOwnDescription]="'rules'"
      [mlvTooltip]="'Use a passphrase'"
    >
      Password
    </button>
    <mlv-test-self-described id="self" [mlvTooltip]="'Use a passphrase'" />
  `,
})
class HostBoundDescriptionComponent {}

/** The host's `aria-describedby` split into its ids. */
function describedByIds(element: Element): string[] {
  return (element.getAttribute('aria-describedby') ?? '')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * What each `aria-describedby` id resolves to in the document, joined —
 * `<missing id>` for an id that names nothing, which is the dangling reference
 * axe reports as `aria-valid-attr-value`.
 */
function describedByText(element: Element): string {
  return describedByIds(element)
    .map(
      (id) =>
        document.getElementById(id)?.textContent?.trim() ?? `<missing ${id}>`,
    )
    .join(' | ');
}

describe('MlvTooltip — description', () => {
  let overlayContainer: OverlayContainer;

  /** Number of tooltip panes currently attached. */
  const tooltips = () =>
    overlayContainer.getContainerElement().querySelectorAll('.mlv-tooltip')
      .length;

  async function flush(fixture: ComponentFixture<unknown>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [
        DescribedHostComponent,
        BareHostComponent,
        NamedHostComponent,
        SharedHostComponent,
        HostBoundDescriptionComponent,
      ],
    }).compileComponents();
    overlayContainer = TestBed.inject(OverlayContainer);
  });

  afterEach(() => {
    vi.useRealTimers();
    overlayContainer.ngOnDestroy();
  });

  async function createDescribed(): Promise<{
    fixture: ComponentFixture<DescribedHostComponent>;
    host: () => HTMLButtonElement;
  }> {
    const fixture = TestBed.createComponent(DescribedHostComponent);
    await flush(fixture);
    const root = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      host: () => root.querySelector('#described') as HTMLButtonElement,
    };
  }

  it('adds its description beside the host’s own at init, before any hover or focus', async () => {
    const { host } = await createDescribed();

    expect(describedByIds(host())[0]).toBe('rules');
    expect(describedByText(host())).toBe(
      'At least 12 characters | Use a passphrase',
    );
    expect(tooltips()).toBe(0);
  });

  it('describes the host the moment it takes focus, not after tooltipDelay (D12)', async () => {
    const { fixture, host } = await createDescribed();

    host().focus();
    host().dispatchEvent(new FocusEvent('focusin'));
    await flush(fixture);

    // The show is still pending; the description is already there.
    expect(tooltips()).toBe(0);
    expect(describedByText(host())).toBe(
      'At least 12 characters | Use a passphrase',
    );
  });

  it('keeps the host’s own description while shown and after hide', async () => {
    const { fixture, host } = await createDescribed();

    host().dispatchEvent(new FocusEvent('focusin'));
    vi.runAllTimers();
    await flush(fixture);
    expect(tooltips()).toBe(1);
    expect(describedByText(host())).toBe(
      'At least 12 characters | Use a passphrase',
    );

    host().dispatchEvent(new FocusEvent('focusout'));
    await flush(fixture);
    expect(tooltips()).toBe(0);
    expect(describedByText(host())).toBe(
      'At least 12 characters | Use a passphrase',
    );
  });

  it('gives the host back exactly its own aria-describedby when destroyed', async () => {
    const { fixture, host } = await createDescribed();
    const detached = host();
    const token = describedByIds(detached)[1];

    fixture.componentInstance.present.set(false);
    await flush(fixture);

    expect(detached.getAttribute('aria-describedby')).toBe('rules');
    // Nothing else referenced that text, so its element is gone too.
    expect(document.getElementById(token)).toBeNull();
  });

  it('removes the attribute entirely on destroy when the host had none of its own', async () => {
    const fixture = TestBed.createComponent(BareHostComponent);
    await flush(fixture);
    const bare = (fixture.nativeElement as HTMLElement).querySelector(
      '#bare',
    ) as HTMLButtonElement;
    expect(describedByText(bare)).toBe('Use a passphrase');

    fixture.destroy();

    expect(bare.hasAttribute('aria-describedby')).toBe(false);
  });

  // Pins the client half of `afterRenderEffect`: a host binding on the same
  // element is written after the view's effects, so under a plain `effect` the
  // tooltip's id would be appended first and then overwritten (and its hidden
  // element leaked). A template `[attr.aria-describedby]` would not show it —
  // the template is written before the view's effects either way.
  it.each([
    ['a co-hosted directive', '#cohosted'],
    ['the host component itself', '#self'],
  ])(
    'lands beside an aria-describedby that %s writes through a host binding at init',
    async (_label, selector) => {
      const fixture = TestBed.createComponent(HostBoundDescriptionComponent);
      await flush(fixture);
      const element = (fixture.nativeElement as HTMLElement).querySelector(
        selector,
      ) as HTMLElement;

      expect(describedByIds(element)[0]).toBe('rules');
      expect(describedByText(element)).toBe(
        'At least 12 characters | Use a passphrase',
      );
    },
  );

  it('follows the text when it changes while hidden, leaving no stale description behind', async () => {
    const { fixture, host } = await createDescribed();
    const staleToken = describedByIds(host())[1];

    fixture.componentInstance.text.set('Unstar');
    await flush(fixture);

    expect(describedByText(host())).toBe('At least 12 characters | Unstar');
    expect(document.getElementById(staleToken)).toBeNull();
  });

  it('drops the description while tooltipDisabled and restores it after', async () => {
    const { fixture, host } = await createDescribed();

    fixture.componentInstance.disabled.set(true);
    await flush(fixture);
    expect(host().getAttribute('aria-describedby')).toBe('rules');

    fixture.componentInstance.disabled.set(false);
    await flush(fixture);
    expect(describedByText(host())).toBe(
      'At least 12 characters | Use a passphrase',
    );
  });

  it.each([
    ['empty', ''],
    ['whitespace-only', '   '],
  ])(
    'shows no bubble and describes nothing for %s content',
    async (_label, text) => {
      const fixture = TestBed.createComponent(BareHostComponent);
      fixture.componentInstance.text.set(text);
      await flush(fixture);
      const bare = (fixture.nativeElement as HTMLElement).querySelector(
        '#bare',
      ) as HTMLButtonElement;

      bare.dispatchEvent(new MouseEvent('mouseenter'));
      bare.dispatchEvent(new FocusEvent('focusin'));
      vi.runAllTimers();
      await flush(fixture);

      expect(tooltips()).toBe(0);
      expect(bare.hasAttribute('aria-describedby')).toBe(false);
    },
  );

  it('adds no description that would only repeat the host’s aria-label', async () => {
    const fixture = TestBed.createComponent(NamedHostComponent);
    await flush(fixture);
    const named = (fixture.nativeElement as HTMLElement).querySelector(
      '#named',
    ) as HTMLButtonElement;
    expect(named.hasAttribute('aria-describedby')).toBe(false);

    named.dispatchEvent(new MouseEvent('mouseenter'));
    vi.runAllTimers();
    await flush(fixture);

    // The bubble still shows for sighted users; the name already says it.
    expect(tooltips()).toBe(1);
    expect(named.hasAttribute('aria-describedby')).toBe(false);
  });

  it('shares one description between hosts with the same text and keeps it while one remains', async () => {
    const fixture = TestBed.createComponent(SharedHostComponent);
    await flush(fixture);
    const root = fixture.nativeElement as HTMLElement;
    const first = root.querySelector('#first') as HTMLButtonElement;
    const second = root.querySelector('#second') as HTMLButtonElement;

    expect(describedByIds(first)).toEqual(describedByIds(second));
    expect(describedByText(second)).toBe('Shared hint');

    fixture.componentInstance.first.set(false);
    await flush(fixture);

    expect(first.hasAttribute('aria-describedby')).toBe(false);
    expect(describedByText(second)).toBe('Shared hint');
  });

  it('hides the visible bubble from assistive tech, which reads the description instead', async () => {
    const { fixture, host } = await createDescribed();

    host().dispatchEvent(new MouseEvent('mouseenter'));
    vi.runAllTimers();
    await flush(fixture);

    const panel = overlayContainer
      .getContainerElement()
      .querySelector('mlv-tooltip-panel');
    expect(panel?.getAttribute('aria-hidden')).toBe('true');
  });

  describe('axe', () => {
    // Real timers: axe schedules its own work, and a faked clock stalls it
    // once the overlay pane is in the document.
    beforeEach(() => vi.useRealTimers());

    it('has no axe violations while idle, the host described from init', async () => {
      const { host } = await createDescribed();
      expect(describedByIds(host())).toHaveLength(2);

      await expectNoAxeViolations(document.body);
    });

    it.each([
      ['with its arrow', true],
      ['without its arrow', false],
    ])('has no axe violations while shown %s', async (_label, arrow) => {
      const { fixture, host } = await createDescribed();
      fixture.componentInstance.arrow.set(arrow);
      fixture.componentInstance.delay.set(0);
      await flush(fixture);

      host().dispatchEvent(new MouseEvent('mouseenter'));
      // `tooltipDelay` is 0: one macrotask runs the show timer.
      await new Promise((resolve) => setTimeout(resolve));
      await flush(fixture);
      expect(tooltips()).toBe(1);
      expect(
        overlayContainer
          .getContainerElement()
          .querySelectorAll('.mlv-tooltip__arrow').length,
      ).toBe(arrow ? 1 : 0);

      // The pane is portaled out of the fixture, and the description lives in
      // CDK's container on <body>: sweep the whole document.
      await expectNoAxeViolations(document.body);
    });

    it('has no axe violations while disabled', async () => {
      const { fixture, host } = await createDescribed();
      fixture.componentInstance.disabled.set(true);
      await flush(fixture);
      expect(host().getAttribute('aria-describedby')).toBe('rules');

      await expectNoAxeViolations(document.body);
    });

    it('has no axe violations with empty content', async () => {
      const fixture = TestBed.createComponent(BareHostComponent);
      fixture.componentInstance.text.set('');
      await flush(fixture);
      const bare = (fixture.nativeElement as HTMLElement).querySelector(
        '#bare',
      ) as HTMLButtonElement;
      expect(bare.hasAttribute('aria-describedby')).toBe(false);

      await expectNoAxeViolations(document.body);
    });
  });
});

// ---------------------------------------------------------------------------
// Inputs that change while the bubble is up (#346)
//
// `_show()` handed the panel its content, tone and arrow once, and nothing
// forwarded a later value, so a tooltip bound to changing state ("Star" →
// "Unstar") kept its old text for as long as the pointer stayed on the host —
// for a mouse user, exactly when the change happens. `tooltipDisabled` and
// empty text were read only when a show started, so turning either on left a
// visible bubble up.
// ---------------------------------------------------------------------------

@Component({
  imports: [MlvTooltip],
  template: `
    <button
      id="live"
      [mlvTooltip]="text()"
      [tooltipTone]="tone()"
      [tooltipArrow]="arrow()"
      [tooltipDisabled]="disabled()"
      [tooltipDelay]="delay()"
    >
      Star
    </button>
  `,
})
class LiveInputsHostComponent {
  readonly text = signal('Star');
  readonly tone = signal<MlvTooltipTone>('neutral');
  readonly arrow = signal(true);
  readonly disabled = signal(false);
  readonly delay = signal(0);
}

describe('MlvTooltip — inputs that change while shown', () => {
  let overlayContainer: OverlayContainer;
  let fixture: ComponentFixture<LiveInputsHostComponent>;
  let trigger: HTMLButtonElement;

  const container = () => overlayContainer.getContainerElement();
  /** Number of tooltip panes currently attached. */
  const tooltips = () => container().querySelectorAll('.mlv-tooltip').length;
  const bubble = () =>
    container().querySelector('.mlv-tooltip') as HTMLElement | null;

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
      imports: [LiveInputsHostComponent],
    }).compileComponents();
    overlayContainer = TestBed.inject(OverlayContainer);
    fixture = TestBed.createComponent(LiveInputsHostComponent);
    await flush();
    trigger = (fixture.nativeElement as HTMLElement).querySelector(
      '#live',
    ) as HTMLButtonElement;
  });

  afterEach(() => {
    vi.useRealTimers();
    fixture.destroy();
    overlayContainer.ngOnDestroy();
  });

  it('updates the visible text in place when the content changes, matching the description', async () => {
    await showOnHover();
    const pane = container().querySelector('.cdk-overlay-pane');
    expect(bubble()?.textContent?.trim()).toBe('Star');

    fixture.componentInstance.text.set('Unstar');
    await flush();

    expect(bubble()?.textContent?.trim()).toBe('Unstar');
    // Updated, not rebuilt: the same pane, and only one.
    expect(container().querySelector('.cdk-overlay-pane')).toBe(pane);
    expect(tooltips()).toBe(1);
    // The bubble and the description (#321) say the same thing.
    expect(describedByText(trigger)).toBe('Unstar');
  });

  // The side a pane sits on was chosen for its old size; a taller text can
  // stop fitting there (measured in Chromium: it covered its own host until
  // re-fitted). CDK measures the pane, so the re-fit has to come after the
  // panel has rendered the new text — recording what the pane held at each
  // `updatePosition()` pins both halves.
  it('re-fits the pane once the new text has rendered', async () => {
    await showOnHover();
    const measured: string[] = [];
    const updatePosition = OverlayRef.prototype.updatePosition;
    const spy = vi
      .spyOn(OverlayRef.prototype, 'updatePosition')
      .mockImplementation(function (this: OverlayRef) {
        measured.push(this.overlayElement.textContent?.trim() ?? '');
        updatePosition.call(this);
      });
    try {
      fixture.componentInstance.text.set('Unstar');
      await flush();

      expect(measured).toEqual(['Unstar']);
    } finally {
      spy.mockRestore();
    }
  });

  it('repaints the tone while shown', async () => {
    await showOnHover();
    expect(bubble()?.classList).toContain('mlv-tooltip--tone-neutral');

    fixture.componentInstance.tone.set('danger');
    await flush();

    expect(bubble()?.classList).toContain('mlv-tooltip--tone-danger');
    expect(bubble()?.classList).not.toContain('mlv-tooltip--tone-neutral');
  });

  it('drops and restores the arrow while shown', async () => {
    await showOnHover();
    expect(container().querySelectorAll('.mlv-tooltip__arrow')).toHaveLength(1);

    fixture.componentInstance.arrow.set(false);
    await flush();
    expect(container().querySelectorAll('.mlv-tooltip__arrow')).toHaveLength(0);
    expect(bubble()?.classList).toContain('mlv-tooltip--no-arrow');

    fixture.componentInstance.arrow.set(true);
    await flush();
    expect(container().querySelectorAll('.mlv-tooltip__arrow')).toHaveLength(1);
    expect(bubble()?.classList).not.toContain('mlv-tooltip--no-arrow');
  });

  it('hides the bubble when tooltipDisabled turns true while shown', async () => {
    await showOnHover();
    expect(tooltips()).toBe(1);

    fixture.componentInstance.disabled.set(true);
    await flush();

    expect(container().querySelectorAll('.cdk-overlay-pane')).toHaveLength(0);

    // Nothing is left half torn down: re-enabled, the next hover shows again.
    fixture.componentInstance.disabled.set(false);
    await flush();
    expect(tooltips()).toBe(0);
    await showOnHover();
    expect(tooltips()).toBe(1);
  });

  it.each([
    ['empty', ''],
    ['whitespace-only', '   '],
  ])(
    'hides the bubble when the content turns %s while shown',
    async (_label, text) => {
      await showOnHover();
      expect(tooltips()).toBe(1);

      fixture.componentInstance.text.set(text);
      await flush();

      expect(container().querySelectorAll('.cdk-overlay-pane')).toHaveLength(0);
    },
  );

  it('does not show when tooltipDisabled turns true while a show is pending', async () => {
    fixture.componentInstance.delay.set(300);
    await flush();

    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.componentInstance.disabled.set(true);
    await flush();
    vi.runAllTimers();
    await flush();

    expect(container().querySelectorAll('.cdk-overlay-pane')).toHaveLength(0);
  });

  // Turning the tooltip off drops a pending show outright, rather than leaving
  // it to be checked when the delay elapses: switched back on inside the delay,
  // it must not pop up on its own, just as a bubble hidden the same way stays
  // hidden until the next hover.
  it.each([
    [
      'tooltipDisabled turns true',
      (host: LiveInputsHostComponent) => host.disabled.set(true),
      (host: LiveInputsHostComponent) => host.disabled.set(false),
    ],
    [
      'the content turns empty',
      (host: LiveInputsHostComponent) => host.text.set(''),
      (host: LiveInputsHostComponent) => host.text.set('Star'),
    ],
  ])(
    'drops a pending show when %s, even if it is undone inside the delay',
    async (_label, turnOff, turnOn) => {
      fixture.componentInstance.delay.set(300);
      await flush();

      trigger.dispatchEvent(new MouseEvent('mouseenter'));
      turnOff(fixture.componentInstance);
      await flush();
      turnOn(fixture.componentInstance);
      await flush();
      vi.runAllTimers();
      await flush();

      expect(container().querySelectorAll('.cdk-overlay-pane')).toHaveLength(0);
    },
  );

  // The same path with the bubble up: the pointer returning from the panel to
  // the host re-arms the show timer, so a bubble disabled and re-enabled inside
  // the delay came straight back.
  it('does not bring back a bubble disabled and re-enabled inside the delay of a re-armed show', async () => {
    fixture.componentInstance.delay.set(300);
    await flush();
    await showOnHover();
    expect(tooltips()).toBe(1);

    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.componentInstance.disabled.set(true);
    await flush();
    expect(tooltips()).toBe(0);
    fixture.componentInstance.disabled.set(false);
    await flush();
    vi.runAllTimers();
    await flush();

    expect(container().querySelectorAll('.cdk-overlay-pane')).toHaveLength(0);
  });

  // A show armed while the text is empty is still dropped by disabling: the
  // tooltip was already saying nothing, so what turns it off here is
  // `tooltipDisabled` itself, not the text. Re-enabled inside the delay —
  // before or after the text arrives — it must not pop up on its own.
  it.each([
    [
      'the text arrives, then it is re-enabled',
      async (host: LiveInputsHostComponent) => {
        host.text.set('Star');
        await flush();
        host.disabled.set(false);
        await flush();
      },
    ],
    [
      'it is re-enabled, then the text arrives',
      async (host: LiveInputsHostComponent) => {
        host.disabled.set(false);
        await flush();
        host.text.set('Star');
        await flush();
      },
    ],
  ])(
    'drops a show armed while empty when disabled inside the delay, even if %s',
    async (_label, undo) => {
      fixture.componentInstance.text.set('');
      fixture.componentInstance.delay.set(300);
      await flush();

      trigger.dispatchEvent(new MouseEvent('mouseenter'));
      fixture.componentInstance.disabled.set(true);
      await flush();
      await undo(fixture.componentInstance);
      vi.runAllTimers();
      await flush();

      expect(container().querySelectorAll('.cdk-overlay-pane')).toHaveLength(0);
    },
  );

  // Disabling drops the pending show; `_show()` refusing a disabled tooltip
  // on its own is a second line behind that, pinned end to end here with the
  // text arriving while the tooltip is still disabled.
  it('does not show text that arrives while disabled during a pending show', async () => {
    fixture.componentInstance.text.set('');
    fixture.componentInstance.delay.set(300);
    await flush();

    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.componentInstance.disabled.set(true);
    await flush();
    fixture.componentInstance.text.set('Star');
    await flush();
    vi.runAllTimers();
    await flush();

    expect(container().querySelectorAll('.cdk-overlay-pane')).toHaveLength(0);
  });

  it('still shows text that arrives inside the delay of a show armed while empty', async () => {
    fixture.componentInstance.text.set('');
    fixture.componentInstance.delay.set(300);
    await flush();

    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.componentInstance.text.set('Star');
    await flush();
    vi.runAllTimers();
    await flush();

    expect(tooltips()).toBe(1);
    expect(bubble()?.textContent?.trim()).toBe('Star');
  });
});
