import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import type { DebugElement } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { OverlayContainer } from '@angular/cdk/overlay';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as Sass from 'sass';
import { vi } from 'vitest';
import { MlvRtlService } from '@malva-ui/cdk/utils';
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
