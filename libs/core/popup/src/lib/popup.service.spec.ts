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

  function open(fixture: ReturnType<typeof TestBed.createComponent<HostComponent>>) {
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
});
