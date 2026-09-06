import { TestBed } from '@angular/core/testing';
import type { TemplateRef } from '@angular/core';
import {
  Component,
  ElementRef,
  inject,
  ViewContainerRef,
  viewChild,
} from '@angular/core';
import { Overlay, OverlayContainer } from '@angular/cdk/overlay';
import { DOCUMENT } from '@angular/common';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { MlvPopupService } from './popup.service';

@Component({
  template: `
    <div #origin>origin</div>
    <div #trigger><input #field /></div>
    <ng-template #tpl><div class="panel-content">panel</div></ng-template>
  `,
})
class HostComponent {
  readonly vcr = inject(ViewContainerRef);
  readonly origin = viewChild.required('origin', { read: ElementRef });
  readonly trigger = viewChild.required('trigger', { read: ElementRef });
  readonly field = viewChild.required('field', { read: ElementRef });
  readonly tpl = viewChild.required<TemplateRef<unknown>>('tpl');
}

/** Waits for the deferred (setTimeout(0)) document click listener to attach. */
function nextMacrotask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 5));
}

describe('MlvPopupService — backdrop-less click-outside dismissal', () => {
  let service: MlvPopupService;
  let overlayContainer: OverlayContainer;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    service = TestBed.inject(MlvPopupService);
    overlayContainer = TestBed.inject(OverlayContainer);
  });

  afterEach(() => {
    overlayContainer.ngOnDestroy();
  });

  it('does not dismiss when a click lands inside a dismissExcludeElements element', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const host = fixture.componentInstance;
    const requestClose = vi.fn();

    const handle = service.open({
      origin: host.origin(),
      template: host.tpl(),
      vcr: host.vcr,
      positions: service.resolvePositions('bottom-start'),
      hasBackdrop: false,
      dismissExcludeElements: [host.trigger().nativeElement],
      onClose: () => undefined,
      onRequestClose: requestClose,
    });

    await nextMacrotask();

    // A click on the trigger's input (the caret target) is treated as inside.
    host
      .field()
      .nativeElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(requestClose).not.toHaveBeenCalled();

    // A genuine outside click still dismisses.
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(requestClose).toHaveBeenCalledTimes(1);

    handle.close();
  });

  it('dismisses on any outside click when no exclusions are provided', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const host = fixture.componentInstance;
    const requestClose = vi.fn();

    const handle = service.open({
      origin: host.origin(),
      template: host.tpl(),
      vcr: host.vcr,
      positions: service.resolvePositions('bottom-start'),
      hasBackdrop: false,
      onClose: () => undefined,
      onRequestClose: requestClose,
    });

    await nextMacrotask();

    // Without exclusions, clicking the trigger counts as outside → dismiss.
    host
      .field()
      .nativeElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(requestClose).toHaveBeenCalledTimes(1);

    handle.close();
  });
});

describe('MlvPopupService — fullscreen mode', () => {
  let service: MlvPopupService;
  let overlayContainer: OverlayContainer;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    service = TestBed.inject(MlvPopupService);
    overlayContainer = TestBed.inject(OverlayContainer);
  });

  afterEach(() => {
    overlayContainer.ngOnDestroy();
  });

  function openFullscreen(
    overrides: Partial<Parameters<MlvPopupService['open']>[0]> = {},
  ) {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const host = fixture.componentInstance;
    const handle = service.open({
      origin: host.origin(),
      template: host.tpl(),
      vcr: host.vcr,
      positions: service.resolvePositions('bottom-start'),
      fullscreen: true,
      onClose: () => undefined,
      ...overrides,
    });
    return { fixture, host, handle };
  }

  it('stretches the overlay pane to the viewport via the fullscreen pane class', () => {
    const { handle } = openFullscreen();
    expect(
      handle.overlayRef.overlayElement.classList.contains(
        'mlv-popup-fullscreen-pane',
      ),
    ).toBe(true);
    handle.close();
  });

  it('always renders a solid backdrop in fullscreen mode', () => {
    // hasBackdrop:false must be ignored — the sheet always has a scrim.
    const { handle } = openFullscreen({ hasBackdrop: false });
    const backdrop = handle.overlayRef.backdropElement;
    expect(backdrop).toBeTruthy();
    expect(backdrop?.classList.contains('mlv-popup-fullscreen-backdrop')).toBe(
      true,
    );
    handle.close();
  });

  it('locks page scroll with the block scroll strategy in fullscreen', () => {
    // CDK's block strategy only stamps `cdk-global-scrollblock` when the page is
    // actually scrollable (never true in jsdom), so assert the mechanism selects
    // the block strategy rather than the DOM side effect.
    const overlay = TestBed.inject(Overlay);
    const blockSpy = vi.spyOn(overlay.scrollStrategies, 'block');
    const { handle } = openFullscreen();
    expect(blockSpy).toHaveBeenCalledTimes(1);
    handle.close();
  });

  it('does not use the block scroll strategy for a non-fullscreen popup', () => {
    const overlay = TestBed.inject(Overlay);
    const blockSpy = vi.spyOn(overlay.scrollStrategies, 'block');
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const host = fixture.componentInstance;
    const handle = service.open({
      origin: host.origin(),
      template: host.tpl(),
      vcr: host.vcr,
      positions: service.resolvePositions('bottom-start'),
      onClose: () => undefined,
    });
    expect(blockSpy).not.toHaveBeenCalled();
    handle.close();
  });

  it('requests close on Escape', () => {
    const requestClose = vi.fn();
    const { handle } = openFullscreen({ onRequestClose: requestClose });

    handle.overlayRef.overlayElement.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    expect(requestClose).toHaveBeenCalledTimes(1);
    handle.close();
  });

  it('requests close on backdrop click', () => {
    const requestClose = vi.fn();
    const { handle } = openFullscreen({ onRequestClose: requestClose });

    handle.overlayRef.backdropElement?.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    expect(requestClose).toHaveBeenCalledTimes(1);
    handle.close();
  });

  it('does not subscribe to position changes (global strategy has none)', () => {
    const onPositionChange = vi.fn();
    // With the connected strategy this would subscribe; the fullscreen guard
    // skips it so the global strategy is never cast to a connected one.
    const { handle } = openFullscreen({ onPositionChange });
    expect(onPositionChange).not.toHaveBeenCalled();
    handle.close();
  });
});

describe('MlvPopupService — direction', () => {
  let service: MlvPopupService;
  let overlayContainer: OverlayContainer;

  beforeEach(() => {
    document.documentElement.removeAttribute('dir');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [HostComponent] });
    service = TestBed.inject(MlvPopupService);
    overlayContainer = TestBed.inject(OverlayContainer);
  });

  afterEach(() => {
    overlayContainer.ngOnDestroy();
    document.documentElement.removeAttribute('dir');
  });

  function open(
    fixture: ReturnType<typeof TestBed.createComponent<HostComponent>>,
  ) {
    const host = fixture.componentInstance;
    return service.open({
      origin: host.origin(),
      template: host.tpl(),
      vcr: host.vcr,
      positions: service.resolvePositions('bottom-start'),
      hasBackdrop: false,
      onClose: () => undefined,
    });
  }

  it('inherits the global direction', () => {
    TestBed.inject(MlvRtlService).setDirection('rtl');

    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    expect(open(fixture).overlayRef.getDirection()).toBe('rtl');
  });

  it('inherits a direction scoped to the origin, not the document', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    // The overlay is portaled to <body>, outside the origin's `[dir]` scope,
    // so the direction has to travel with the config.
    fixture.componentInstance.origin().nativeElement.setAttribute('dir', 'rtl');

    expect(TestBed.inject(MlvRtlService).direction()).toBe('ltr');
    expect(open(fixture).overlayRef.getDirection()).toBe('rtl');
  });

  it('re-mirrors an open popup when the global direction flips', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const handle = open(fixture);
    expect(handle.overlayRef.getDirection()).toBe('ltr');

    // Nothing re-parents an open overlay, so without a live watch the pane
    // keeps the direction it was opened with while the page mirrors around it.
    TestBed.inject(MlvRtlService).setDirection('rtl');
    TestBed.tick();

    expect(handle.overlayRef.getDirection()).toBe('rtl');
    expect(handle.overlayRef.hostElement.getAttribute('dir')).toBe('rtl');
  });

  it('recomputes the position when the direction flips', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const handle = open(fixture);
    const updatePosition = vi.spyOn(handle.overlayRef, 'updatePosition');
    const before = updatePosition.mock.calls.length;

    TestBed.inject(MlvRtlService).setDirection('rtl');
    TestBed.tick();

    // `bottom-start` resolves to the opposite edge of the trigger once
    // mirrored, so the strategy has to run again — a stale position is the
    // other half of the bug, next to the stale `dir`.
    expect(updatePosition.mock.calls.length).toBeGreaterThan(before);
  });

  it('re-mirrors when a dir scope around the origin changes', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const handle = open(fixture);

    fixture.componentInstance.origin().nativeElement.setAttribute('dir', 'rtl');
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();

    expect(handle.overlayRef.getDirection()).toBe('rtl');
  });

  it('stops watching once the popup closes', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const handle = open(fixture);
    const overlayRef = handle.overlayRef;
    handle.close();
    const setDirection = vi.spyOn(overlayRef, 'setDirection');

    TestBed.inject(MlvRtlService).setDirection('rtl');
    TestBed.tick();

    expect(setDirection).not.toHaveBeenCalled();
  });

  it('re-resolves the direction from the origin when re-anchored while open', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const host = fixture.componentInstance;
    const ltrRow = host.origin().nativeElement as HTMLElement;
    const rtlRow = document.createElement('div');
    rtlRow.setAttribute('dir', 'rtl');
    ltrRow.appendChild(rtlRow);

    // An origin that resolves lazily — a context menu shared by many rows
    // points it at whichever row was right-clicked last. No `dir` attribute
    // changes between the two opens, so `watchDirection` sees nothing; the
    // re-anchor itself has to re-read the direction.
    let anchor: HTMLElement = ltrRow;
    const origin = Object.defineProperty(
      new ElementRef<HTMLElement>(ltrRow),
      'nativeElement',
      { configurable: true, get: () => anchor },
    );
    const handle = service.open({
      origin,
      template: host.tpl(),
      vcr: host.vcr,
      positions: service.resolvePositions('bottom-start'),
      hasBackdrop: false,
      onClose: () => undefined,
    });
    expect(handle.overlayRef.getDirection()).toBe('ltr');

    anchor = rtlRow;
    handle.setPositionOrigin({ x: 10, y: 10 });

    expect(handle.overlayRef.getDirection()).toBe('rtl');
    expect(handle.overlayRef.hostElement.getAttribute('dir')).toBe('rtl');
  });
});

// ---------------------------------------------------------------------------
// Listener binding: phase, target document, and teardown
//
// The click-outside listener moved from a raw `addEventListener(…, true)` to
// `fromEvent(this._document, 'click', { capture: true })` (#76). All three
// properties that made the raw call correct are asserted here, because none of
// them is visible in the dismissal tests above.
// ---------------------------------------------------------------------------

/** Net listener count per event type on `target`. Restored by `afterEach`. */
function trackListeners(target: EventTarget): Map<string, number> {
  const net = new Map<string, number>();
  const bump = (type: string, delta: number): void =>
    void net.set(type, (net.get(type) ?? 0) + delta);
  const realAdd = target.addEventListener.bind(target);
  const realRemove = target.removeEventListener.bind(target);
  vi.spyOn(target, 'addEventListener').mockImplementation(
    (type, listener, options) => {
      bump(type, 1);
      realAdd(type, listener, options);
    },
  );
  vi.spyOn(target, 'removeEventListener').mockImplementation(
    (type, listener, options) => {
      bump(type, -1);
      realRemove(type, listener, options);
    },
  );
  return net;
}

describe('MlvPopupService — dismissal listener binding', () => {
  let service: MlvPopupService;
  let overlayContainer: OverlayContainer;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    service = TestBed.inject(MlvPopupService);
    overlayContainer = TestBed.inject(OverlayContainer);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    overlayContainer.ngOnDestroy();
  });

  function openBackdropless(requestClose: () => void) {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const host = fixture.componentInstance;
    const handle = service.open({
      origin: host.origin(),
      template: host.tpl(),
      vcr: host.vcr,
      positions: service.resolvePositions('bottom-start'),
      hasBackdrop: false,
      onClose: () => undefined,
      onRequestClose: requestClose,
    });
    return { fixture, host, handle };
  }

  // The capture phase is the whole point of the listener: dismissal has to see
  // the click before a handler inside the page can stop its propagation.
  // A bubble-phase listener would never run here.
  it('still dismisses when a page handler stops the click propagating', async () => {
    const requestClose = vi.fn();
    const { host, handle } = openBackdropless(requestClose);
    await nextMacrotask();

    const outside = host.trigger().nativeElement as HTMLElement;
    const swallowed = vi.fn();
    outside.addEventListener('click', (event) => {
      swallowed();
      event.stopPropagation();
      event.stopImmediatePropagation();
    });

    host
      .field()
      .nativeElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    // The page handler did run — the click really was swallowed on the way up.
    expect(swallowed).toHaveBeenCalledTimes(1);
    // And dismissal still saw it, because it listens in the capture phase.
    expect(requestClose).toHaveBeenCalledTimes(1);

    handle.close();
  });

  it('releases the document listener when the popup closes', async () => {
    const net = trackListeners(document);
    const requestClose = vi.fn();
    const { handle } = openBackdropless(requestClose);
    await nextMacrotask();

    expect(net.get('click')).toBeGreaterThan(0);

    handle.close();

    expect(net.get('click')).toBe(0);

    // And it really is inert.
    requestClose.mockClear();
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(requestClose).toHaveBeenCalledTimes(0);
  });

  // Under server rendering the injected `DOCUMENT` and the ambient `document`
  // global are different objects *and the global is defined*, so binding the
  // ambient one attaches a per-open listener to a process-wide object that no
  // `cleanups` drain reaches — and nothing throws, so neither the SSR smoke
  // suite nor the teardown test above can see it. Asserting *which* object
  // received the listener is the only thing that can.
  it('binds click-outside dismissal to the injected DOCUMENT, not the ambient global', async () => {
    const isolated = document.implementation.createHTMLDocument('popup');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: DOCUMENT, useValue: isolated }],
    });
    service = TestBed.inject(MlvPopupService);
    overlayContainer = TestBed.inject(OverlayContainer);

    const isolatedNet = trackListeners(isolated);
    const ambientNet = trackListeners(document);

    const { handle } = openBackdropless(vi.fn());
    await nextMacrotask();

    expect(isolatedNet.get('click')).toBeGreaterThan(0);
    expect(ambientNet.get('click')).toBeUndefined();

    handle.close();
    expect(isolatedNet.get('click')).toBe(0);
  });
});
