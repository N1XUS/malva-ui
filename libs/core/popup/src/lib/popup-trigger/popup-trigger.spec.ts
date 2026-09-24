import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import type { WritableSignal } from '@angular/core';
import { Component, signal, viewChild } from '@angular/core';
import { OverlayContainer } from '@angular/cdk/overlay';
import type { MlvBreakpoint } from '@malva-ui/cdk/utils';
import { MlvBreakpointService, MlvRtlService } from '@malva-ui/cdk/utils';
import { MlvPopup, POPUP_DETACH_WATCHDOG_MS } from '../popup/popup';
import { MlvPopupContent } from '../popup-content';
import { MlvPopupTrigger } from './popup-trigger';

/**
 * Stubs {@link MlvBreakpointService} so the spec can cross the mobile
 * breakpoint on demand — jsdom's `matchMedia` never matches a `min-width`
 * query, so the real service is pinned below every breakpoint.
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
  imports: [MlvPopup, MlvPopupContent, MlvPopupTrigger],
  template: `
    <button [mlvPopupTrigger]="standalonePopup">open</button>
    <mlv-popup #standalonePopup mobileMode="auto" mobileTitle="Sheet">
      <ng-template mlvPopupContent><span>panel body</span></ng-template>
    </mlv-popup>
  `,
})
class StandaloneHostComponent {
  readonly popup = viewChild.required(MlvPopup);
}

describe('MlvPopupTrigger — standalone mode, breakpoint flip while open', () => {
  let overlayContainer: OverlayContainer;
  let fixture: ComponentFixture<StandaloneHostComponent>;
  let breakpoint: FakeBreakpointService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StandaloneHostComponent],
      providers: [
        { provide: MlvBreakpointService, useClass: FakeBreakpointService },
      ],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);
    breakpoint = TestBed.inject(
      MlvBreakpointService,
    ) as unknown as FakeBreakpointService;
    fixture = TestBed.createComponent(StandaloneHostComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    overlayContainer.ngOnDestroy();
  });

  const root = (): HTMLElement => overlayContainer.getContainerElement();
  const panelEl = (): Element | null => root().querySelector('.mlv-popup');

  const paneIsFullscreen = (): boolean =>
    root()
      .querySelector('.cdk-overlay-pane')
      ?.classList.contains('mlv-popup-fullscreen-pane') ?? false;

  const panelIsFullscreen = (): boolean =>
    panelEl()?.classList.contains('mlv-popup--fullscreen') ?? false;

  const hasCloseButton = (): boolean =>
    panelEl()?.querySelector('.mlv-popup__close') != null;

  /**
   * `MlvPopupTrigger` builds its own overlay when no `mlv-popup-container`
   * wraps it, so it snapshots the full-screen flag on a second code path that
   * the container specs never reach.
   */
  it('keeps the sheet whole when the viewport widens past the breakpoint', async () => {
    breakpoint.down.set(true);
    fixture.componentInstance.popup().opened.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(paneIsFullscreen()).toBe(true);
    expect(panelIsFullscreen()).toBe(true);
    expect(hasCloseButton()).toBe(true);

    breakpoint.down.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(paneIsFullscreen()).toBe(true);
    expect(panelIsFullscreen()).toBe(true);
    expect(hasCloseButton()).toBe(true);
    expect(fixture.componentInstance.popup().isFullscreen()).toBe(true);
  });

  it('reports the mode the open actually rendered to an afterClosed handler', async () => {
    // `afterClosed` belongs to the open that just finished, so it must read the
    // latched mode — the release happens after the emit for exactly this. See
    // the matching `MlvPopupContainer` spec for the consumer that branches on
    // it (`mlv-combobox._onPopupClosed`).
    const seen: boolean[] = [];
    const popup = fixture.componentInstance.popup();
    popup.afterClosed.subscribe(() => seen.push(popup.isFullscreen()));

    breakpoint.down.set(true);
    popup.opened.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(popup.isFullscreen()).toBe(true);

    breakpoint.down.set(false);
    fixture.detectChanges();
    await fixture.whenStable();

    popup.opened.set(false);
    fixture.detectChanges();
    await new Promise((resolve) =>
      setTimeout(resolve, POPUP_DETACH_WATCHDOG_MS + 50),
    );

    expect(seen).toEqual([true]);
    // …and the lock is still released, so the closed popup tracks the viewport.
    expect(popup.isFullscreen()).toBe(false);
  });

  it('keeps the anchored dropdown whole when the viewport narrows past the breakpoint', async () => {
    breakpoint.down.set(false);
    fixture.componentInstance.popup().opened.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(paneIsFullscreen()).toBe(false);
    expect(panelIsFullscreen()).toBe(false);

    breakpoint.down.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(paneIsFullscreen()).toBe(false);
    expect(panelIsFullscreen()).toBe(false);
    expect(hasCloseButton()).toBe(false);
    expect(fixture.componentInstance.popup().isFullscreen()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Arrow direction in standalone mode (#163)
//
// `MlvPopupTrigger` is its own overlay owner — it calls `MlvPopupService.open()`
// directly rather than going through `MlvPopupContainer` — so it wires
// `onPositionChange` itself and needs its own coverage.
// ---------------------------------------------------------------------------

@Component({
  imports: [MlvPopup, MlvPopupContent, MlvPopupTrigger],
  template: `
    <div [attr.dir]="scope()">
      <button [mlvPopupTrigger]="arrowPopup" triggerOn="click">open</button>
      <mlv-popup #arrowPopup position="right-start" [hasArrow]="true">
        <ng-template mlvPopupContent><span>panel body</span></ng-template>
      </mlv-popup>
    </div>
  `,
})
class ArrowHostComponent {
  readonly scope = signal<string | null>(null);
  readonly trigger = viewChild.required(MlvPopupTrigger);
  readonly popup = viewChild.required(MlvPopup);
}

describe('MlvPopupTrigger — arrow direction', () => {
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
    // Global state: `setDirection` writes `documentElement.dir` and the root
    // CDK `Directionality`.
    rtl.setDirection('ltr');
    document.documentElement.removeAttribute('dir');
    overlayContainer.ngOnDestroy();
  });

  async function open(): Promise<MlvPopup> {
    fixture.componentInstance.trigger().open();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.componentInstance.popup();
  }

  it('anchors a `right-start` arrow to the physical left edge in LTR', async () => {
    const popup = await open();
    expect(popup.arrowEdge()).toBe('left');
  });

  it('anchors it to the physical right edge under a scoped `[dir="rtl"]`', async () => {
    fixture.componentInstance.scope.set('rtl');
    fixture.detectChanges();

    const popup = await open();

    expect(rtl.direction()).toBe('ltr');
    expect(popup.arrowEdge()).toBe('right');
  });

  it('anchors it to the physical right edge under a global flip', async () => {
    rtl.setDirection('rtl');
    fixture.detectChanges();

    const popup = await open();

    expect(popup.arrowEdge()).toBe('right');
  });
});

@Component({
  imports: [MlvPopup, MlvPopupContent, MlvPopupTrigger],
  template: `
    <button #triggerEl [mlvPopupTrigger]="excludePopup" triggerOn="focus">
      open
    </button>
    <div #excludedEl><span class="excluded-child">inside</span></div>
    <span class="outside">outside</span>
    <mlv-popup
      #excludePopup
      [hasBackdrop]="false"
      [dismissExcludeElements]="[triggerEl, excludedEl]"
    >
      <ng-template mlvPopupContent><span>panel body</span></ng-template>
    </mlv-popup>
  `,
})
class DismissExcludeHostComponent {
  readonly popup = viewChild.required(MlvPopup);
}

describe('MlvPopupTrigger — standalone mode, dismissExcludeElements', () => {
  let overlayContainer: OverlayContainer;
  let fixture: ComponentFixture<DismissExcludeHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DismissExcludeHostComponent],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);
    fixture = TestBed.createComponent(DismissExcludeHostComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    overlayContainer.ngOnDestroy();
  });

  /** Waits for the deferred (`setTimeout(0)`) document click listener. */
  const nextMacrotask = (): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, 5));

  async function open(): Promise<MlvPopup> {
    const popup = fixture.componentInstance.popup();
    popup.opened.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await nextMacrotask();
    return popup;
  }

  const click = (selector: string): void => {
    (fixture.nativeElement as HTMLElement)
      .querySelector(selector)
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
  };

  // The container forwarded the input; the standalone trigger did not, so
  // the documented exclusion was inert on this path and a click on the
  // trigger — or on anything else the consumer listed — dismissed the
  // backdrop-less popup (#328 needs it for the avatar group's +N counter).
  it('keeps the popup open for a click inside an excluded element', async () => {
    const popup = await open();

    click('.excluded-child');
    click('button');

    expect(popup.opened()).toBe(true);
    expect(
      overlayContainer.getContainerElement().querySelector('.mlv-popup'),
    ).not.toBeNull();
  });

  it('still dismisses on a click outside the panel and the exclusions', async () => {
    const popup = await open();

    click('.outside');

    expect(popup.opened()).toBe(false);
  });
});
