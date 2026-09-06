import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import type { WritableSignal } from '@angular/core';
import { Component, signal, viewChild } from '@angular/core';
import { OverlayContainer } from '@angular/cdk/overlay';
import type { MlvBreakpoint } from '@malva-ui/cdk/utils';
import { MlvBreakpointService } from '@malva-ui/cdk/utils';
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
