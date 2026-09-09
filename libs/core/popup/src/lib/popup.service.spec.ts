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
import type { FlexibleConnectedPositionStrategy } from '@angular/cdk/overlay';
import { DOCUMENT } from '@angular/common';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { MlvPopupService } from './popup.service';
import type { MlvPopupOpenConfig } from './popup.service';

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
    extra: Partial<MlvPopupOpenConfig> = {},
  ) {
    const host = fixture.componentInstance;
    return service.open({
      origin: host.origin(),
      template: host.tpl(),
      vcr: host.vcr,
      positions: service.resolvePositions('bottom-start'),
      hasBackdrop: false,
      onClose: () => undefined,
      ...extra,
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

  // The "one source of truth" property behind #163: `onPositionChange`'s
  // `direction` is read back off the **pane** (`overlayRef.getDirection()`),
  // never re-resolved from the origin, so the physical arrow the consumer
  // derives can never disagree with the geometry CDK produced from the same
  // value. Every other direction spec in this file keeps the two in sync, so
  // they pass with `resolveDirection(config.origin)` substituted in — only a
  // pane whose direction was set out of band separates them.
  it('reports the pane direction, not a re-resolved origin direction', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const onPositionChange = vi.fn();
    const handle = open(fixture, { onPositionChange });

    // Out of band: no `dir` attribute changes, so `watchDirection` never fires
    // and the origin still resolves LTR. Only the pane is RTL.
    handle.overlayRef.setDirection('rtl');
    expect(
      TestBed.inject(MlvRtlService).resolveDirection(
        fixture.componentInstance.origin(),
      ),
    ).toBe('ltr');
    expect(handle.overlayRef.getDirection()).toBe('rtl');

    // Force a fresh emission. CDK deduplicates `positionChanges` by the
    // identity of the chosen `ConnectedPosition`, and `withPositions()` clears
    // `_lastPosition` when the previous choice is no longer in the list.
    const strategy = handle.overlayRef.getConfig()
      .positionStrategy as FlexibleConnectedPositionStrategy;
    strategy.withPositions(service.resolvePositions('top-end'));
    handle.overlayRef.updatePosition();

    expect(onPositionChange).toHaveBeenLastCalledWith(expect.anything(), 'rtl');
    handle.close();
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
// Inline offsets (#180)
//
// `ConnectedPosition.offsetX` is **physical**. `FlexibleConnectedPositionStrategy`
// returns it verbatim from `_getOffset()` and applies it as `x += offsetX` when
// scoring a candidate and as `translateX(${offsetX}px)` on the pane; there is no
// `_isRtl()` anywhere on that path, unlike `originX` / `overlayX`, which the
// strategy does mirror. So a `right-*` popup — mirrored to render physically
// *left* of its trigger in RTL — kept being pushed 8px further right: the 8px
// gap became an 8px overlap, a 16px error against intent.
//
// The service therefore mirrors the inline offset against the direction it
// already resolves for the pane, and re-mirrors it whenever that direction
// changes under an open overlay.
//
// **What these read.** The pane's own `transform`, which CDK composes from
// `offsetX` alone — no measurement enters into it, so jsdom's missing layout
// does not either. The all-zero rects do decide *which* candidate is chosen:
// every position "fits" a 0×0 viewport, so `_getOverlayFit` accepts the first
// entry and the loop returns, which is what makes `right-start` the resolved
// position in every case below. The physical anchor property CDK picks
// (`left` in LTR, `right` in RTL) is asserted alongside it, because it is the
// half that already mirrored and is what makes the unmirrored offset wrong.
// ---------------------------------------------------------------------------

describe('MlvPopupService — inline offsets', () => {
  let service: MlvPopupService;
  let overlayContainer: OverlayContainer;
  let rtlService: MlvRtlService;

  beforeEach(() => {
    document.documentElement.removeAttribute('dir');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [HostComponent] });
    service = TestBed.inject(MlvPopupService);
    overlayContainer = TestBed.inject(OverlayContainer);
    rtlService = TestBed.inject(MlvRtlService);
  });

  afterEach(() => {
    rtlService.setDirection('ltr');
    overlayContainer.ngOnDestroy();
    document.documentElement.removeAttribute('dir');
  });

  /** Opens a popup and flushes the `afterNextRender` in which CDK positions it. */
  function openPositioned(
    scopeDir: 'ltr' | 'rtl' | null,
    names: Parameters<MlvPopupService['resolvePositions']>[0] = [
      'right-start',
      'left-start',
    ],
  ) {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const host = fixture.componentInstance;
    const originEl = host.origin().nativeElement as HTMLElement;
    if (scopeDir) originEl.setAttribute('dir', scopeDir);

    const handle = service.open({
      origin: host.origin(),
      template: host.tpl(),
      vcr: host.vcr,
      positions: service.resolvePositions(names),
      hasBackdrop: false,
      onClose: () => undefined,
    });
    TestBed.tick();
    return handle;
  }

  /** The pane's inline `transform` — `''` until the strategy has applied. */
  function transformOf(handle: {
    overlayRef: { overlayElement: HTMLElement };
  }) {
    return handle.overlayRef.overlayElement.style.transform;
  }

  it('pushes a right-start popup away from the trigger in LTR', () => {
    const handle = openPositioned(null);
    const pane = handle.overlayRef.overlayElement;

    // `overlayX: 'start'` resolves to the physical left anchor, so +8px is
    // rightward — away from the trigger's right edge.
    expect(pane.style.left).toBe('0px');
    expect(transformOf(handle)).toBe('translateX(8px)');
    handle.close();
  });

  it('mirrors the gap when the document direction is RTL', () => {
    rtlService.setDirection('rtl');
    const handle = openPositioned(null);
    const pane = handle.overlayRef.overlayElement;

    // Mirrored: the panel now hangs off the trigger's physical *left*, so the
    // gap has to point left too. Unmirrored this was `translateX(8px)` — 8px
    // back over the trigger.
    expect(pane.style.right).toBe('0px');
    expect(transformOf(handle)).toBe('translateX(-8px)');
    handle.close();
  });

  it('mirrors it under a scoped [dir="rtl"] while the document stays LTR', () => {
    const handle = openPositioned('rtl');

    expect(rtlService.direction()).toBe('ltr');
    expect(handle.overlayRef.getDirection()).toBe('rtl');
    expect(transformOf(handle)).toBe('translateX(-8px)');
    handle.close();
  });

  it('leaves it alone in an LTR island inside an RTL document', () => {
    rtlService.setDirection('rtl');
    const handle = openPositioned('ltr');

    expect(rtlService.direction()).toBe('rtl');
    expect(handle.overlayRef.getDirection()).toBe('ltr');
    expect(transformOf(handle)).toBe('translateX(8px)');
    handle.close();
  });

  it('leaves the block-axis gap untouched in both directions', () => {
    const ltr = openPositioned(null, ['bottom-start']);
    expect(transformOf(ltr)).toBe('translateY(8px)');
    ltr.close();

    const rtl = openPositioned('rtl', ['bottom-start']);
    expect(rtl.overlayRef.getDirection()).toBe('rtl');
    // `offsetY` is the block axis, which never mirrors.
    expect(transformOf(rtl)).toBe('translateY(8px)');
    rtl.close();
  });

  it('re-mirrors an open popup when the direction flips under it', () => {
    const handle = openPositioned(null);
    expect(transformOf(handle)).toBe('translateX(8px)');

    // Nothing re-parents an open pane, so the same watch that re-sets the
    // pane's `dir` has to re-apply the mirrored offset — `updatePosition()`
    // alone would re-run the strategy over the stale, unmirrored list.
    rtlService.setDirection('rtl');
    TestBed.tick();

    expect(handle.overlayRef.getDirection()).toBe('rtl');
    expect(transformOf(handle)).toBe('translateX(-8px)');
    handle.close();
  });

  it('mirrors a position list swapped in while the popup is open', () => {
    const handle = openPositioned('rtl', ['bottom-start']);
    expect(transformOf(handle)).toBe('translateY(8px)');

    // `setPositionOrigin` is how a context menu re-anchors from an element to
    // a cursor, dropping the element gap for a point-anchored list. A list
    // that arrives this way is mirrored on the same terms as the opening one.
    handle.setPositionOrigin(
      { x: 10, y: 10 },
      service.resolvePositions('right-start'),
    );

    expect(transformOf(handle)).toBe('translateX(-8px)');
    handle.close();
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
