import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import type { WritableSignal } from '@angular/core';
import { Component, ElementRef, signal, viewChild } from '@angular/core';
import { Overlay, OverlayContainer } from '@angular/cdk/overlay';
import type { MockInstance } from 'vitest';
import type { MlvBreakpoint } from '@malva-ui/cdk/utils';
import { MlvBreakpointService, MlvRtlService } from '@malva-ui/cdk/utils';
import { MlvPopup, POPUP_DETACH_WATCHDOG_MS } from '../popup/popup';
import { MlvPopupContent } from '../popup-content';
import type { MlvPopupTriggerType } from '../popup-trigger/popup-trigger';
import { MlvPopupTrigger } from '../popup-trigger/popup-trigger';
import { MlvPopupService } from '../popup.service';
import type { MlvPopupPositionName } from '../popup-positions';
import { MlvPopupContainer } from './popup-container';

@Component({
  imports: [MlvPopupContainer, MlvPopup, MlvPopupContent, MlvPopupTrigger],
  template: `
    <mlv-popup-container>
      <button mlvPopupTrigger>open</button>
      <mlv-popup>
        <ng-template mlvPopupContent><span>panel body</span></ng-template>
      </mlv-popup>
    </mlv-popup-container>
  `,
})
class HostComponent {
  readonly container = viewChild.required(MlvPopupContainer);
  readonly popup = viewChild.required(MlvPopup);
}

/** Waits past every leave fallback so a stuck overlay cannot pass as detached. */
function afterLeaveWindow(): Promise<void> {
  return new Promise((resolve) =>
    setTimeout(resolve, POPUP_DETACH_WATCHDOG_MS + 50),
  );
}

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

describe('MlvPopupContainer — overlay lifecycle', () => {
  let overlayContainer: OverlayContainer;
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    overlayContainer.ngOnDestroy();
  });

  function panels(): NodeListOf<Element> {
    return overlayContainer
      .getContainerElement()
      .querySelectorAll('.mlv-popup');
  }

  it('attaches a panel when opened', async () => {
    fixture.componentInstance.container().open();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(panels()).toHaveLength(1);
  });

  it('detaches the overlay when a close lands in the same tick as the attach', async () => {
    const popup = fixture.componentInstance.popup();

    // Open and close without yielding: the microtask queued by the attach has
    // not drained yet when the close is requested, so its 'enter' write would
    // land on top of the 'leave' the close just made.
    popup.opened.set(true);
    fixture.detectChanges();
    popup.opened.set(false);
    fixture.detectChanges();

    await afterLeaveWindow();

    // Assert the panel is gone from the DOM — `opened()` is already false
    // throughout the wedged state, so asserting on it would pass against the bug.
    expect(panels()).toHaveLength(0);
    expect(popup.animationState()).toBe('idle');
  });

  it('re-opens normally after a same-tick open/close cycle', async () => {
    const container = fixture.componentInstance.container();
    const popup = fixture.componentInstance.popup();

    popup.opened.set(true);
    fixture.detectChanges();
    popup.opened.set(false);
    fixture.detectChanges();
    await afterLeaveWindow();

    container.open();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(panels()).toHaveLength(1);
    expect(container.isOpen()).toBe(true);
  });

  it('force-detaches when the leave animation never completes', async () => {
    const container = fixture.componentInstance.container();
    const popup = fixture.componentInstance.popup();

    container.open();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(panels()).toHaveLength(1);

    // Simulate a lost animation signal: the close starts the leave, then the
    // state is overwritten so neither `animationend` nor the popup's own
    // fallback timer can complete the detach.
    container.close();
    fixture.detectChanges();
    popup.animationState.set('enter');

    await afterLeaveWindow();

    expect(panels()).toHaveLength(0);
    expect(popup.opened()).toBe(false);
  });

  it('ignores an animationend bubbling out of the panel content during a leave', async () => {
    const container = fixture.componentInstance.container();
    const popup = fixture.componentInstance.popup();

    container.open();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(panels()).toHaveLength(1);

    container.close();
    fixture.detectChanges();
    expect(popup.animationState()).toBe('leave');

    // A projected consumer component finishing its own finite CSS animation
    // inside the ~100ms leave window (a row fade-in, a one-shot highlight).
    // `animationend` bubbles, so it reaches the panel's listener; only the
    // panel's own leave keyframes may complete the detach (#231).
    const child = panels()[0].querySelector(
      '.mlv-popup__inner span',
    ) as HTMLElement | null;
    expect(child).not.toBeNull();
    child?.dispatchEvent(animationEnd());
    fixture.detectChanges();

    // Still on screen, still leaving — the leave was not truncated.
    expect(panels()).toHaveLength(1);
    expect(popup.animationState()).toBe('leave');

    // …and the leave still completes on its own, so the guard strands nothing.
    await afterLeaveWindow();
    expect(panels()).toHaveLength(0);
  });

  it('detaches when the animationend target is the panel itself', async () => {
    const container = fixture.componentInstance.container();
    const popup = fixture.componentInstance.popup();

    container.open();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(panels()).toHaveLength(1);

    container.close();
    fixture.detectChanges();
    expect(popup.animationState()).toBe('leave');

    panels()[0].dispatchEvent(animationEnd());
    fixture.detectChanges();

    // Detached synchronously off `leaveAnimationDone$`, with no wait at all —
    // so neither the popup's 250ms fallback nor the container's 350ms watchdog
    // can be what removed it. A guard that broke this path would show up here.
    expect(panels()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Breakpoint flip while the popup is open (#126 / #144)
// ---------------------------------------------------------------------------

/**
 * Stubs {@link MlvBreakpointService} so the spec can cross the mobile
 * breakpoint on demand. jsdom's `matchMedia` never matches a `min-width`
 * query, so the real service is pinned below every breakpoint and cannot
 * express the anchored half at all.
 */
class FakeBreakpointService {
  readonly down: WritableSignal<boolean> = signal(false);
  isDown(_bp: MlvBreakpoint): WritableSignal<boolean> {
    return this.down;
  }
  isUp(_bp: MlvBreakpoint): WritableSignal<boolean> {
    return signal(false);
  }
}

@Component({
  imports: [MlvPopupContainer, MlvPopup, MlvPopupContent, MlvPopupTrigger],
  template: `
    <mlv-popup-container>
      <button mlvPopupTrigger>open</button>
      <mlv-popup mobileMode="auto" mobileTitle="Sheet">
        <ng-template mlvPopupContent><span>panel body</span></ng-template>
      </mlv-popup>
    </mlv-popup-container>
  `,
})
class AutoModeHostComponent {
  readonly container = viewChild.required(MlvPopupContainer);
  readonly popup = viewChild.required(MlvPopup);
}

describe('MlvPopupContainer — breakpoint flip while the popup is open', () => {
  let overlayContainer: OverlayContainer;
  let fixture: ComponentFixture<AutoModeHostComponent>;
  let breakpoint: FakeBreakpointService;
  let blockSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AutoModeHostComponent],
      providers: [
        { provide: MlvBreakpointService, useClass: FakeBreakpointService },
      ],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);
    breakpoint = TestBed.inject(
      MlvBreakpointService,
    ) as unknown as FakeBreakpointService;
    blockSpy = vi.spyOn(TestBed.inject(Overlay).scrollStrategies, 'block');
    fixture = TestBed.createComponent(AutoModeHostComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    blockSpy.mockRestore();
    overlayContainer.ngOnDestroy();
  });

  const root = (): HTMLElement => overlayContainer.getContainerElement();
  const panelEl = (): Element | null => root().querySelector('.mlv-popup');

  // ── Overlay-level state: everything `MlvPopupService.open` decides once ──

  /** The full-screen pane class the service stamps on the CDK pane. */
  const paneIsFullscreen = (): boolean =>
    root()
      .querySelector('.cdk-overlay-pane')
      ?.classList.contains('mlv-popup-fullscreen-pane') ?? false;

  /** Whether the scrim is the solid full-screen one rather than the transparent default. */
  const backdropIsSolid = (): boolean =>
    root()
      .querySelector('.cdk-overlay-backdrop')
      ?.classList.contains('mlv-popup-fullscreen-backdrop') ?? false;

  /**
   * Which CDK position strategy is in force, read off the wrapper element each
   * strategy stamps: `GlobalPositionStrategy` marks the host
   * `cdk-global-overlay-wrapper`, `FlexibleConnectedPositionStrategy` inserts a
   * `cdk-overlay-connected-position-bounding-box`.
   */
  const positionStrategyKind = (): 'global' | 'connected' | 'none' => {
    if (root().querySelector('.cdk-global-overlay-wrapper')) return 'global';
    if (root().querySelector('.cdk-overlay-connected-position-bounding-box')) {
      return 'connected';
    }
    return 'none';
  };

  /** Whether page scroll was locked, i.e. the block scroll strategy was selected. */
  const scrollIsBlocked = (): boolean => blockSpy.mock.calls.length > 0;

  // ── Component-level state: what the reactive `isFullscreen()` half drives ──

  const panelIsFullscreen = (): boolean =>
    panelEl()?.classList.contains('mlv-popup--fullscreen') ?? false;

  const hasCloseButton = (): boolean =>
    panelEl()?.querySelector('.mlv-popup__close') != null;

  const hasHeader = (): boolean =>
    panelEl()?.querySelector('.mlv-popup__header') != null;

  async function open(): Promise<void> {
    fixture.componentInstance.container().open();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function crossBreakpoint(down: boolean): Promise<void> {
    breakpoint.down.set(down);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('keeps the sheet whole when the viewport widens past the breakpoint', async () => {
    breakpoint.down.set(true);
    await open();

    // Opened as a real sheet: global pane, solid scrim, locked scroll, header.
    expect(paneIsFullscreen()).toBe(true);
    expect(backdropIsSolid()).toBe(true);
    expect(positionStrategyKind()).toBe('global');
    expect(scrollIsBlocked()).toBe(true);
    expect(panelIsFullscreen()).toBe(true);
    expect(hasCloseButton()).toBe(true);

    await crossBreakpoint(false);

    // The overlay cannot follow — the position strategy, pane class, backdrop
    // and scroll lock are all chosen once at attach — so the panel must not
    // walk away from it. Otherwise the user is left with an anchored-looking
    // panel in a viewport-filling pane behind a modal scrim, with the close
    // button removed by the half that did follow.
    expect(paneIsFullscreen()).toBe(true);
    expect(backdropIsSolid()).toBe(true);
    expect(positionStrategyKind()).toBe('global');
    expect(panelIsFullscreen()).toBe(true);
    expect(hasHeader()).toBe(true);
    expect(hasCloseButton()).toBe(true);
    expect(fixture.componentInstance.popup().isFullscreen()).toBe(true);
  });

  it('keeps the anchored dropdown whole when the viewport narrows past the breakpoint', async () => {
    breakpoint.down.set(false);
    await open();

    // Opened anchored: connected pane, transparent scrim, no scroll lock.
    expect(paneIsFullscreen()).toBe(false);
    expect(backdropIsSolid()).toBe(false);
    expect(positionStrategyKind()).toBe('connected');
    expect(scrollIsBlocked()).toBe(false);
    expect(panelIsFullscreen()).toBe(false);
    expect(hasCloseButton()).toBe(false);

    await crossBreakpoint(true);

    // Same argument the other way: a panel that paints itself as a sheet
    // inside a content-sized, trigger-anchored pane with no scrim and no
    // scroll lock is the reverse half-conversion.
    expect(paneIsFullscreen()).toBe(false);
    expect(backdropIsSolid()).toBe(false);
    expect(positionStrategyKind()).toBe('connected');
    expect(scrollIsBlocked()).toBe(false);
    expect(panelIsFullscreen()).toBe(false);
    expect(hasHeader()).toBe(false);
    expect(hasCloseButton()).toBe(false);
    expect(fixture.componentInstance.popup().isFullscreen()).toBe(false);
  });

  it('reports the mode the open actually rendered to an afterClosed handler', async () => {
    // `afterClosed` belongs to the open that just finished, so it must read the
    // latched mode, not the mode the (now changed) viewport would resolve to.
    // `mlv-combobox._onPopupClosed` branches on exactly this: releasing the
    // lock before the emit makes it skip the activedescendant reset, the
    // display-text resync and the focus restore after a full-screen open that
    // was widened past the breakpoint mid-flight.
    const seen: boolean[] = [];
    const popup = fixture.componentInstance.popup();
    popup.afterClosed.subscribe(() => seen.push(popup.isFullscreen()));

    breakpoint.down.set(true);
    await open();
    expect(popup.isFullscreen()).toBe(true);

    await crossBreakpoint(false);
    fixture.componentInstance.container().close();
    fixture.detectChanges();
    await afterLeaveWindow();

    expect(seen).toEqual([true]);
    // …and the lock is still released, so the closed popup tracks the viewport.
    expect(popup.isFullscreen()).toBe(false);
  });

  it('tracks the breakpoint again once the overlay is gone', async () => {
    // The lock is released on dispose rather than left standing until the next
    // open, so a consumer reading `isFullscreen()` on a closed popup — to size
    // a trigger, or to pick chrome ahead of opening — sees the live viewport
    // instead of whatever the previous open happened to resolve to.
    breakpoint.down.set(true);
    await open();
    expect(fixture.componentInstance.popup().isFullscreen()).toBe(true);

    fixture.componentInstance.container().close();
    fixture.detectChanges();
    await afterLeaveWindow();

    await crossBreakpoint(false);
    expect(fixture.componentInstance.popup().isFullscreen()).toBe(false);
  });

  it('picks up a breakpoint crossed between two opens', async () => {
    // The mode is fixed per open, not per component instance: the next open
    // must resolve it afresh, which is the behaviour that makes freezing safe.
    breakpoint.down.set(false);
    await open();
    expect(fixture.componentInstance.popup().isFullscreen()).toBe(false);

    fixture.componentInstance.container().close();
    fixture.detectChanges();
    await afterLeaveWindow();

    await crossBreakpoint(true);
    await open();

    expect(paneIsFullscreen()).toBe(true);
    expect(panelIsFullscreen()).toBe(true);
    expect(fixture.componentInstance.popup().isFullscreen()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Arrow direction through the real overlay owner (#163)
//
// `MlvPopupService` resolves the pane's direction from the trigger — the pane
// is portaled to <body> and inherits no `[dir]` scope — and CDK mirrors the
// `start`/`end` pair it applies against exactly that. So the direction the
// arrow is derived from has to be the one that travelled with the config, not
// the document's.
// ---------------------------------------------------------------------------

@Component({
  imports: [MlvPopupContainer, MlvPopup, MlvPopupContent, MlvPopupTrigger],
  template: `
    <div [attr.dir]="scope()">
      <mlv-popup-container>
        <button mlvPopupTrigger>open</button>
        <mlv-popup [position]="position()" [hasArrow]="true">
          <ng-template mlvPopupContent><span>panel body</span></ng-template>
        </mlv-popup>
      </mlv-popup-container>
    </div>
  `,
})
class ArrowHostComponent {
  readonly scope = signal<string | null>(null);
  readonly position = signal<MlvPopupPositionName>('left-start');
  readonly container = viewChild.required(MlvPopupContainer);
  readonly popup = viewChild.required(MlvPopup);
}

describe('MlvPopupContainer — arrow direction', () => {
  let overlayContainer: OverlayContainer;
  let fixture: ComponentFixture<ArrowHostComponent>;
  let rtl: MlvRtlService;

  beforeEach(async () => {
    document.documentElement.removeAttribute('dir');
    await TestBed.configureTestingModule({
      imports: [ArrowHostComponent],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);
    rtl = TestBed.inject(MlvRtlService);
    fixture = TestBed.createComponent(ArrowHostComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    // `setDirection` writes `document.documentElement.dir` and the root CDK
    // `Directionality` — global state that leaks into every later spec.
    rtl.setDirection('ltr');
    document.documentElement.removeAttribute('dir');
    overlayContainer.ngOnDestroy();
  });

  async function open(): Promise<MlvPopup> {
    fixture.componentInstance.container().open();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.componentInstance.popup();
  }

  function panelClasses(): string {
    const panel = overlayContainer
      .getContainerElement()
      .querySelector('.mlv-popup') as HTMLElement;
    return panel.className;
  }

  it('anchors a `left-start` arrow to the physical right edge in LTR', async () => {
    const popup = await open();

    expect(popup.arrowEdge()).toBe('right');
    expect(panelClasses()).toContain('mlv-popup--arrow-right');
  });

  it('anchors the same arrow to the physical left edge under a global flip', async () => {
    rtl.setDirection('rtl');
    fixture.detectChanges();

    const popup = await open();

    expect(popup.arrowEdge()).toBe('left');
    expect(panelClasses()).toContain('mlv-popup--arrow-left');
  });

  it('follows a `[dir]` scope around the trigger while the document stays LTR', async () => {
    // The load-bearing case: a global flip also writes the root CDK
    // `Directionality`, so a global-only spec passes with the whole fix ablated.
    // Only a scoped `[dir]` proves the direction came from the trigger.
    fixture.componentInstance.scope.set('rtl');
    fixture.detectChanges();

    const popup = await open();

    expect(rtl.direction()).toBe('ltr');
    expect(popup.arrowEdge()).toBe('left');
    expect(panelClasses()).toContain('mlv-popup--arrow-left');
  });

  it('keeps an LTR island unmirrored inside an RTL document', async () => {
    rtl.setDirection('rtl');
    fixture.componentInstance.scope.set('ltr');
    fixture.detectChanges();

    const popup = await open();

    expect(popup.arrowEdge()).toBe('right');
    expect(panelClasses()).toContain('mlv-popup--arrow-right');
  });

  it('mirrors the inline alignment of a `bottom-start` arrow in a scoped RTL subtree', async () => {
    fixture.componentInstance.position.set('bottom-start');
    fixture.componentInstance.scope.set('rtl');
    fixture.detectChanges();

    const popup = await open();

    expect(rtl.direction()).toBe('ltr');
    expect(popup.arrowEdge()).toBe('top');
    expect(popup.arrowAlign()).toBe('end');
    expect(panelClasses()).toContain('mlv-popup--arrow-end');
  });

  it('re-derives the arrow when the direction flips while the popup is open', async () => {
    const popup = await open();
    expect(popup.arrowEdge()).toBe('right');

    // CDK only re-emits `positionChanges` when the *chosen* position object
    // changes; mirroring re-resolves `start`/`end` within the same entry, so
    // nothing would tell the arrow the pane it lives in just flipped.
    rtl.setDirection('rtl');
    TestBed.tick();
    fixture.detectChanges();

    expect(popup.arrowEdge()).toBe('left');
    expect(panelClasses()).toContain('mlv-popup--arrow-left');
  });
});

// ---------------------------------------------------------------------------
// A trigger rendered inside the popup's own panel (#225)
//
// `<ng-template mlvPopupContent>` is declared lexically inside
// `<mlv-popup-container>`, and portaling the panel into the CDK overlay moves
// DOM, not the node injector — so every directive in the panel still resolves
// the container it was declared under. A `[mlvPopupTrigger]` in there (the
// `mlv-tab-group` overflow button inside `mlv-color-picker`, inside
// `mlv-color-picker-popup`, is the reported case) therefore claimed the outer
// container and overwrote its trigger origin with an element that dies with the
// panel. The next open anchored to that detached node, whose
// `getBoundingClientRect()` is all zeros, so the panel rendered at the top-left
// corner of the viewport.
// ---------------------------------------------------------------------------

@Component({
  imports: [MlvPopupContainer, MlvPopup, MlvPopupContent, MlvPopupTrigger],
  template: `
    <mlv-popup-container>
      <button #outerTrigger mlvPopupTrigger>open</button>
      <mlv-popup position="bottom-start">
        <ng-template mlvPopupContent>
          <button class="nested-trigger" [mlvPopupTrigger]="nested">
            more
          </button>
          <mlv-popup #nested position="bottom-start">
            <ng-template mlvPopupContent><span>nested body</span></ng-template>
          </mlv-popup>
        </ng-template>
      </mlv-popup>
    </mlv-popup-container>
  `,
})
class NestedTriggerHostComponent {
  readonly container = viewChild.required(MlvPopupContainer);
  readonly outerTrigger =
    viewChild.required<ElementRef<HTMLButtonElement>>('outerTrigger');
}

describe('MlvPopupContainer — a trigger inside the panel (#225)', () => {
  /** Rect the outer trigger reports, so a resolved position is legible in jsdom. */
  const TRIGGER_RECT = {
    top: 500,
    bottom: 528,
    left: 300,
    right: 800,
    width: 500,
    height: 28,
    x: 300,
    y: 500,
    toJSON: () => ({}),
  } as DOMRect;

  let overlayContainer: OverlayContainer;
  let fixture: ComponentFixture<NestedTriggerHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NestedTriggerHostComponent],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);
    fixture = TestBed.createComponent(NestedTriggerHostComponent);
    fixture.detectChanges();

    // jsdom runs no layout, so every element measures 0×0 at 0,0 and a naive
    // offset assertion would read the same in both states. Giving the real
    // origin a rect is what makes "anchored to the trigger" and "anchored to a
    // detached node" different numbers: the detached nested trigger keeps
    // jsdom's zeros, so the bug shows up as `top: 0px; left: 0px`.
    fixture.componentInstance.outerTrigger().nativeElement.getBoundingClientRect =
      () => TRIGGER_RECT;
  });

  afterEach(() => {
    overlayContainer.ngOnDestroy();
  });

  function panes(): NodeListOf<HTMLElement> {
    return overlayContainer
      .getContainerElement()
      .querySelectorAll<HTMLElement>('.cdk-overlay-pane');
  }

  /** Inline offsets `FlexibleConnectedPositionStrategy` resolved onto the pane. */
  function paneOffsets(index = 0): { top: string; left: string } {
    const pane = panes()[index];
    return { top: pane.style.top, left: pane.style.left };
  }

  async function open(): Promise<void> {
    fixture.componentInstance.container().open();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function close(): Promise<void> {
    fixture.componentInstance.container().close();
    fixture.detectChanges();
    await afterLeaveWindow();
    fixture.detectChanges();
  }

  it('anchors every open to the trigger, not to the previous panel', async () => {
    await open();
    // `bottom-start` — the panel's top edge sits on the trigger's bottom edge,
    // its inline start on the trigger's; the 8px gap rides a transform.
    expect(paneOffsets()).toEqual({ top: '528px', left: '300px' });

    await close();
    expect(panes()).toHaveLength(0);

    await open();
    expect(paneOffsets()).toEqual({ top: '528px', left: '300px' });
  });

  it('measures the trigger when resolving the position of a later open', async () => {
    await open();
    await close();

    // The offsets above are downstream of this: `_getOriginRect()` reads the
    // origin it was handed, and a detached node answers with zeros rather than
    // throwing. Counting the measurement says *which* element CDK asked.
    const measured = vi.fn(() => TRIGGER_RECT);
    fixture.componentInstance.outerTrigger().nativeElement.getBoundingClientRect =
      measured;

    await open();

    expect(measured.mock.calls.length).toBeGreaterThan(0);
  });

  it('falls back to the container host when the registered trigger is gone', async () => {
    // Not only the panel case: a destroyed trigger unregisters itself (#230),
    // but an element taken out of the document *without* destroying the view
    // that registered it — as here, or by a caller that never unregisters —
    // leaves the container holding a detached origin. CDK measures it without
    // complaint and answers zeros, so the panel would silently land at 0,0.
    const host = (fixture.nativeElement as HTMLElement).querySelector(
      'mlv-popup-container',
    ) as HTMLElement;
    host.getBoundingClientRect = () => TRIGGER_RECT;

    // Register, then remove — the order the bug takes. Dropping the rect stub
    // with it restores jsdom's own answer for a detached element, which is the
    // all-zero rect a real browser gives too.
    await open();
    await close();
    const trigger = fixture.componentInstance.outerTrigger().nativeElement;
    trigger.remove();
    Reflect.deleteProperty(trigger, 'getBoundingClientRect');

    await open();

    expect(paneOffsets()).toEqual({ top: '528px', left: '300px' });
  });

  it('opens the nested popup instead of toggling the container', async () => {
    await open();
    expect(panes()).toHaveLength(1);

    const nested = overlayContainer
      .getContainerElement()
      .querySelector<HTMLButtonElement>('.nested-trigger');
    nested?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // In container mode the click would have run `container.toggle()` and
    // closed the popup the button lives in.
    expect(panes()).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Trigger registration lifetime (#230)
//
// `registerTrigger` used to be a pair of plain fields with no unregister: a
// container-mode trigger that was destroyed kept governing every later open.
// Its element stayed referenced, and its backdrop preference stayed latched —
// a hover trigger registers `hasBackdrop: false`, so a container whose hover
// trigger left an `@if` opened backdrop-less forever. Two triggers overwrote
// each other with no way back to the earlier one.
// ---------------------------------------------------------------------------

@Component({
  imports: [MlvPopupContainer, MlvPopup, MlvPopupContent, MlvPopupTrigger],
  template: `
    <mlv-popup-container>
      @if (showFirst()) {
        <button #first mlvPopupTrigger [triggerOn]="firstTriggerOn()">
          first
        </button>
      }
      @if (showSecond()) {
        <button #second mlvPopupTrigger [triggerOn]="secondTriggerOn()">
          second
        </button>
      }
      <mlv-popup>
        <ng-template mlvPopupContent><span>panel body</span></ng-template>
      </mlv-popup>
    </mlv-popup-container>
  `,
})
class RegistrationHostComponent {
  readonly showFirst = signal(true);
  readonly showSecond = signal(false);
  readonly firstTriggerOn = signal<MlvPopupTriggerType | MlvPopupTriggerType[]>(
    'click',
  );
  readonly secondTriggerOn = signal<
    MlvPopupTriggerType | MlvPopupTriggerType[]
  >('hover');
  readonly container = viewChild.required(MlvPopupContainer);
  readonly containerHost = viewChild.required(MlvPopupContainer, {
    read: ElementRef,
  });
  readonly first = viewChild<ElementRef<HTMLButtonElement>>('first');
  readonly second = viewChild<ElementRef<HTMLButtonElement>>('second');
}

/**
 * Whether `value` holds `el`, looking through arrays, maps, plain objects and
 * `ElementRef`s a few levels deep.
 *
 * Deliberately blind to the container's implementation: it does not know the
 * name or the shape of the field a registration lives in, so the same probe
 * reads the pre-#230 `_triggerOrigin` field and whatever replaced it. Class
 * instances other than `ElementRef` are not entered — `ViewContainerRef` and
 * the injected services reach the whole view tree, trigger included, and are
 * not registration state.
 */
function holdsElement(value: unknown, el: Element, depth: number): boolean {
  if (value === el) return true;
  if (depth === 0 || value === null || typeof value !== 'object') return false;
  if (value instanceof ElementRef) return value.nativeElement === el;
  if (Array.isArray(value)) {
    return value.some((entry) => holdsElement(entry, el, depth - 1));
  }
  if (value instanceof Map) {
    return [...value.entries()].some(
      ([key, entry]) =>
        holdsElement(key, el, depth - 1) || holdsElement(entry, el, depth - 1),
    );
  }
  const proto: unknown = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  return Object.values(value).some((entry) =>
    holdsElement(entry, el, depth - 1),
  );
}

describe('MlvPopupContainer — trigger registration lifetime (#230)', () => {
  let overlayContainer: OverlayContainer;
  let fixture: ComponentFixture<RegistrationHostComponent>;
  let host: RegistrationHostComponent;
  let openSpy: MockInstance<MlvPopupService['open']>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegistrationHostComponent],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);
    // Calls through: the spy only records the config each attach was built
    // from, which is where the resolved origin and backdrop are legible.
    openSpy = vi.spyOn(TestBed.inject(MlvPopupService), 'open');
    fixture = TestBed.createComponent(RegistrationHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    overlayContainer.ngOnDestroy();
    vi.restoreAllMocks();
  });

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function open(): Promise<void> {
    host.container().open();
    await render();
  }

  async function close(): Promise<void> {
    host.container().close();
    fixture.detectChanges();
    await afterLeaveWindow();
    fixture.detectChanges();
  }

  /** Where the most recent attach anchored, as a name rather than a node. */
  function lastOrigin(): 'first' | 'second' | 'host' | 'other' {
    const origin = openSpy.mock.lastCall?.[0].origin;
    const el: unknown =
      origin instanceof ElementRef ? origin.nativeElement : origin;
    if (el === host.containerHost().nativeElement) return 'host';
    if (el instanceof HTMLElement && el.textContent?.trim() === 'first') {
      return 'first';
    }
    if (el instanceof HTMLElement && el.textContent?.trim() === 'second') {
      return 'second';
    }
    return 'other';
  }

  /** The backdrop preference the most recent attach was built with. */
  function lastBackdrop(): boolean | undefined {
    return openSpy.mock.lastCall?.[0].hasBackdrop;
  }

  function backdrops(): number {
    return overlayContainer
      .getContainerElement()
      .querySelectorAll('.cdk-overlay-backdrop').length;
  }

  /**
   * Whether the container holds `el`. Pass the instance explicitly once the
   * fixture is destroyed, when the host's view query is no longer a safe read.
   */
  function retains(
    el: Element,
    container: MlvPopupContainer = host.container(),
  ): boolean {
    return Object.values(container).some((value) => holdsElement(value, el, 3));
  }

  it('restores the backdrop once the hover trigger that suppressed it is destroyed', async () => {
    host.firstTriggerOn.set('hover');
    await render();

    // Precondition, so the assertion below cannot pass against a container
    // that never honoured the registration in the first place.
    await open();
    expect(lastBackdrop()).toBe(false);
    expect(backdrops()).toBe(0);
    await close();

    host.showFirst.set(false);
    await render();

    await open();
    expect(lastBackdrop()).toBe(true);
    expect(backdrops()).toBe(1);
  });

  it('holds no reference to a destroyed trigger and anchors on the host', async () => {
    const first = host.first()?.nativeElement;
    if (!first) throw new Error('first trigger not rendered');
    // Precondition: the probe can see a live registration at all.
    expect(retains(first)).toBe(true);

    host.showFirst.set(false);
    await render();

    expect(retains(first)).toBe(false);
    await open();
    expect(lastOrigin()).toBe('host');
  });

  it('lets the later of two triggers win, and pops back to the earlier one when it goes', async () => {
    host.showSecond.set(true);
    await render();

    await open();
    expect(lastOrigin()).toBe('second');
    expect(lastBackdrop()).toBe(false);
    await close();

    host.showSecond.set(false);
    await render();

    await open();
    expect(lastOrigin()).toBe('first');
    expect(lastBackdrop()).toBe(true);
  });

  it('drops an earlier registration destroyed out of order without disturbing the later one', async () => {
    host.showSecond.set(true);
    await render();
    const first = host.first()?.nativeElement;
    const second = host.second()?.nativeElement;
    if (!first || !second) throw new Error('triggers not rendered');

    host.showFirst.set(false);
    await render();

    expect(retains(first)).toBe(false);
    await open();
    expect(lastOrigin()).toBe('second');
    expect(lastBackdrop()).toBe(false);
    await close();

    host.showSecond.set(false);
    await render();

    expect(retains(second)).toBe(false);
    await open();
    expect(lastOrigin()).toBe('host');
    expect(lastBackdrop()).toBe(true);
  });

  it('moves a re-registering trigger to the top, and pops it back off cleanly', async () => {
    host.showSecond.set(true);
    await render();

    // `triggerOn` is tracked by the registering effect, so the earlier trigger
    // registers again — and, as the latest writer, wins, exactly as it did
    // before #230. Updating its entry where it sat would leave `second` on top.
    host.firstTriggerOn.set(['click', 'focus']);
    await render();

    await open();
    expect(lastOrigin()).toBe('first');
    expect(lastBackdrop()).toBe(true);
    await close();

    // Destroying it withdraws every trace of it, so control returns to
    // `second` rather than to a leftover `first` entry or to the host.
    host.showFirst.set(false);
    await render();

    await open();
    expect(lastOrigin()).toBe('second');
    expect(lastBackdrop()).toBe(false);
  });

  it('keys a registration by element, not by the ElementRef instance', async () => {
    host.showFirst.set(false);
    await render();

    const el = document.createElement('button');
    document.body.appendChild(el);
    try {
      host.container().registerTrigger(new ElementRef(el), false);
      // A query can hand out a fresh `ElementRef` for the same node, so a
      // caller unregistering with a different wrapper must still match.
      host.container().unregisterTrigger(new ElementRef(el));

      expect(retains(el)).toBe(false);
      await open();
      expect(lastOrigin()).toBe('host');
      expect(lastBackdrop()).toBe(true);
    } finally {
      el.remove();
    }
  });

  it('ignores an unregister for an element that never registered', async () => {
    host
      .container()
      .unregisterTrigger(new ElementRef(document.createElement('button')));

    await open();
    expect(lastOrigin()).toBe('first');
  });

  it('consults only the latest registration, not an earlier one, when it has left the document', async () => {
    // A live, connected registration underneath — the entry a skip-past rule
    // would fall through to. It registered with a backdrop.
    expect(host.first()?.nativeElement.isConnected).toBe(true);

    const detached = document.createElement('button');
    document.body.appendChild(detached);
    host.container().registerTrigger(new ElementRef(detached), false);
    // Removed from the document without being unregistered.
    detached.remove();

    await open();

    // Origin and backdrop both come from the top entry: its origin is
    // unusable, so the host stands in, but its backdrop still applies.
    expect(lastBackdrop()).toBe(false);
    expect(lastOrigin()).toBe('host');
  });

  it('releases registrations nobody withdrew when the container is destroyed', async () => {
    const container = host.container();
    const el = document.createElement('button');
    container.registerTrigger(new ElementRef(el), false);
    // Precondition: registered and never unregistered.
    expect(retains(el, container)).toBe(true);

    fixture.destroy();

    // The instance itself can outlive its view — held here, as a consumer's
    // template reference or `viewChild` result could be — and must not keep
    // the element alive with it.
    expect(retains(el, container)).toBe(false);
  });

  it('does not re-anchor an open overlay when its trigger is destroyed', async () => {
    await open();
    expect(lastOrigin()).toBe('first');

    host.showFirst.set(false);
    await render();

    // The origin is resolved once per attach; unregistering mid-open changes
    // the next open, not this one. The open overlay keeps its now-detached
    // origin, which CDK re-measures as 0,0 on the next reposition (#283).
    expect(host.container().isOpen()).toBe(true);
    expect(openSpy.mock.calls.length).toBe(1);
  });
});
