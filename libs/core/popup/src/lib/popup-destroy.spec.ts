import { Component, signal, viewChild } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import type { MockInstance } from 'vitest';
import { MlvPopup } from './popup/popup';
import { MlvPopupContainer } from './popup-container/popup-container';
import { MlvPopupContent } from './popup-content';
import { MlvPopupTrigger } from './popup-trigger/popup-trigger';

/**
 * #360 — an overlay owner (`mlv-popup-container`, a standalone
 * `[mlvPopupTrigger]`) destroyed while its overlay is attached closes it from
 * `ngOnDestroy`, and that close writes the popup's `opened` model and emits
 * its `afterClosed`.
 *
 * Two arrangements, and they must come out differently:
 *
 * - **Popup and owner in one view** — the common one, and every Malva control
 *   built on a container (select, combobox, the pickers, color-picker-popup,
 *   sidebar flyouts). Angular runs every `ngOnDestroy` of a view before any of
 *   its `DestroyRef` callbacks, so the popup's outputs and the consumer's
 *   listeners are still live when the owner closes. The close must still reach
 *   them, exactly as before: `[(opened)]` goes back to `false`, `afterClosed`
 *   fires once.
 * - **Popup in a view Angular tears down first** — an `@if` inside the
 *   container's content, or a child component holding the popup a trigger is
 *   bound to. Its outputs are already destroyed when the owner closes, and
 *   each write used to print NG0953.
 */

/** Messages of every NG0953 `console.warn` since the spy was installed. */
function ng0953(spy: MockInstance<typeof console.warn>): string[] {
  return spy.mock.calls
    .map((args) => String(args[0]))
    .filter((message) => message.includes('NG0953'));
}

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
}

@Component({
  imports: [MlvPopupContainer, MlvPopup, MlvPopupContent, MlvPopupTrigger],
  template: `
    @if (show()) {
      <mlv-popup-container>
        <button mlvPopupTrigger>open</button>
        <mlv-popup
          [(opened)]="opened"
          (afterClosed)="afterClosed = afterClosed + 1"
        >
          <ng-template mlvPopupContent><span>body</span></ng-template>
        </mlv-popup>
      </mlv-popup-container>
    }
  `,
})
class ContainerSameViewHost {
  readonly show = signal(true);
  readonly opened = signal(false);
  readonly container = viewChild(MlvPopupContainer);
  afterClosed = 0;
}

@Component({
  imports: [MlvPopupContainer, MlvPopup, MlvPopupContent, MlvPopupTrigger],
  template: `
    @if (show()) {
      <mlv-popup-container>
        <button mlvPopupTrigger>open</button>
        @if (true) {
          <mlv-popup>
            <ng-template mlvPopupContent><span>body</span></ng-template>
          </mlv-popup>
        }
      </mlv-popup-container>
    }
  `,
})
class ContainerNestedPopupHost {
  readonly show = signal(true);
  readonly container = viewChild(MlvPopupContainer);
}

@Component({
  imports: [MlvPopup, MlvPopupContent, MlvPopupTrigger],
  template: `
    @if (show()) {
      <button [mlvPopupTrigger]="popup">open</button>
    }
    <mlv-popup
      #popup
      [(opened)]="opened"
      (afterClosed)="afterClosed = afterClosed + 1"
    >
      <ng-template mlvPopupContent><span>body</span></ng-template>
    </mlv-popup>
  `,
})
class TriggerOnlyDestroyedHost {
  readonly show = signal(true);
  readonly opened = signal(false);
  readonly trigger = viewChild(MlvPopupTrigger);
  afterClosed = 0;
}

@Component({
  imports: [MlvPopup, MlvPopupContent, MlvPopupTrigger],
  template: `
    @if (show()) {
      <button [mlvPopupTrigger]="popup">open</button>
      <mlv-popup
        #popup
        [(opened)]="opened"
        (afterClosed)="afterClosed = afterClosed + 1"
      >
        <ng-template mlvPopupContent><span>body</span></ng-template>
      </mlv-popup>
    }
  `,
})
class TriggerSameViewHost {
  readonly show = signal(true);
  readonly opened = signal(false);
  readonly trigger = viewChild(MlvPopupTrigger);
  afterClosed = 0;
}

/** Holds its popup in its own view, which Angular destroys before its host's. */
@Component({
  selector: 'mlv-test-popup-holder',
  imports: [MlvPopup, MlvPopupContent],
  template: `
    <mlv-popup>
      <ng-template mlvPopupContent><span>body</span></ng-template>
    </mlv-popup>
  `,
})
class PopupHolder {
  readonly popup = viewChild.required(MlvPopup);
}

@Component({
  imports: [PopupHolder, MlvPopupTrigger],
  template: `
    @if (show()) {
      <button [mlvPopupTrigger]="holder.popup()">open</button>
      <mlv-test-popup-holder #holder />
    }
  `,
})
class TriggerChildViewPopupHost {
  readonly show = signal(true);
  readonly trigger = viewChild(MlvPopupTrigger);
}

describe('mlv-popup — owner destroyed while the overlay is attached (#360)', () => {
  let overlay: HTMLElement;
  let warn: MockInstance<typeof console.warn>;

  beforeEach(() => {
    overlay = TestBed.inject(OverlayContainer).getContainerElement();
    warn = vi.spyOn(console, 'warn');
  });

  afterEach(() => {
    warn.mockRestore();
    TestBed.inject(OverlayContainer).ngOnDestroy();
  });

  function panes(): number {
    return overlay.querySelectorAll('.cdk-overlay-pane').length;
  }

  describe('MlvPopupContainer', () => {
    it('with the popup in its view: the close still reaches the consumer while open', async () => {
      const fixture = TestBed.createComponent(ContainerSameViewHost);
      await settle(fixture);
      fixture.componentInstance.container()?.open();
      await settle(fixture);
      expect(fixture.componentInstance.opened()).toBe(true);

      fixture.componentInstance.show.set(false);
      await settle(fixture);

      expect(fixture.componentInstance.opened()).toBe(false);
      expect(fixture.componentInstance.afterClosed).toBe(1);
      expect(ng0953(warn)).toEqual([]);
      expect(panes()).toBe(0);
    });

    it('with the popup in its view: the close still reaches the consumer mid-leave', async () => {
      const fixture = TestBed.createComponent(ContainerSameViewHost);
      await settle(fixture);
      fixture.componentInstance.container()?.open();
      await settle(fixture);
      fixture.componentInstance.container()?.close();
      await settle(fixture);
      // Mid-leave: `opened` is already `false`; the overlay waits for the
      // panel's `animationend`, which never comes before the destroy.
      expect(overlay.querySelector('.mlv-popup--leave')).not.toBeNull();
      expect(panes()).toBe(1);
      expect(fixture.componentInstance.afterClosed).toBe(0);

      fixture.componentInstance.show.set(false);
      await settle(fixture);

      expect(fixture.componentInstance.opened()).toBe(false);
      expect(fixture.componentInstance.afterClosed).toBe(1);
      expect(ng0953(warn)).toEqual([]);
      expect(panes()).toBe(0);
    });

    it('with the popup in a nested view destroyed first: warns nothing and removes the pane', async () => {
      const fixture = TestBed.createComponent(ContainerNestedPopupHost);
      await settle(fixture);
      fixture.componentInstance.container()?.open();
      await settle(fixture);
      expect(panes()).toBe(1);

      fixture.componentInstance.show.set(false);
      await settle(fixture);

      expect(ng0953(warn)).toEqual([]);
      expect(panes()).toBe(0);
    });
  });

  describe('MlvPopupTrigger (standalone)', () => {
    it('with the popup in its view: the close still reaches the consumer', async () => {
      const fixture = TestBed.createComponent(TriggerSameViewHost);
      await settle(fixture);
      fixture.componentInstance.trigger()?.open();
      await settle(fixture);
      expect(panes()).toBe(1);

      fixture.componentInstance.show.set(false);
      await settle(fixture);

      expect(fixture.componentInstance.opened()).toBe(false);
      expect(fixture.componentInstance.afterClosed).toBe(1);
      expect(ng0953(warn)).toEqual([]);
      expect(panes()).toBe(0);
    });

    it('a popup that outlives its trigger is still told the overlay closed', async () => {
      const fixture = TestBed.createComponent(TriggerOnlyDestroyedHost);
      await settle(fixture);
      fixture.componentInstance.trigger()?.open();
      await settle(fixture);
      expect(fixture.componentInstance.opened()).toBe(true);

      fixture.componentInstance.show.set(false);
      await settle(fixture);

      // Left `true`, the consumer's state would say open with no overlay, and
      // the next trigger bound to this popup would reattach it on creation.
      expect(fixture.componentInstance.opened()).toBe(false);
      expect(fixture.componentInstance.afterClosed).toBe(1);
      expect(ng0953(warn)).toEqual([]);
      expect(panes()).toBe(0);
    });

    it('with the popup in a child view destroyed first: warns nothing and removes the pane', async () => {
      const fixture = TestBed.createComponent(TriggerChildViewPopupHost);
      await settle(fixture);
      fixture.componentInstance.trigger()?.open();
      await settle(fixture);
      expect(panes()).toBe(1);

      fixture.componentInstance.show.set(false);
      await settle(fixture);

      expect(ng0953(warn)).toEqual([]);
      expect(panes()).toBe(0);
    });
  });
});
