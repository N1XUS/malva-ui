import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import type { WritableSignal } from '@angular/core';
import { Component, signal, viewChild } from '@angular/core';
import { Overlay, OverlayContainer } from '@angular/cdk/overlay';
import type { MlvBreakpoint } from '@malva-ui/cdk/utils';
import { MlvBreakpointService } from '@malva-ui/cdk/utils';
import { MlvPopup, POPUP_DETACH_WATCHDOG_MS } from '../popup/popup';
import { MlvPopupContent } from '../popup-content';
import { MlvPopupTrigger } from '../popup-trigger/popup-trigger';
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
