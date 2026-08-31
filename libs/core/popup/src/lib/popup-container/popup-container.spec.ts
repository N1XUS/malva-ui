import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, viewChild } from '@angular/core';
import { OverlayContainer } from '@angular/cdk/overlay';
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
