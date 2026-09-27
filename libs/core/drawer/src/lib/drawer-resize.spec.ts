import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import type { Type } from '@angular/core';
import { Component } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { MlvDrawerResize } from './drawer-resize';

/**
 * jsdom ships no `PointerEvent`, so pointer gestures are built from
 * `MouseEvent` with a `pointerId` grafted on — the pattern used by the slider
 * and compare specs.
 */
function pointerEvent(type: string, pointerId = 1): PointerEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
  });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  return event as unknown as PointerEvent;
}

@Component({
  template: `
    <div class="panel">
      <div mlvDrawerResize position="bottom" [snapPoints]="[50, 100]"></div>
    </div>
  `,
  imports: [MlvDrawerResize],
})
class HostComponent {}

/** A side drawer with no snap points — the free-resize path. */
@Component({
  template: `
    <div class="panel">
      <div mlvDrawerResize position="left"></div>
    </div>
  `,
  imports: [MlvDrawerResize],
})
class FreeResizeHostComponent {}

async function createFixture<T>(host: Type<T>): Promise<ComponentFixture<T>> {
  await TestBed.configureTestingModule({
    imports: [host],
  }).compileComponents();
  const fixture = TestBed.createComponent(host);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

describe('MlvDrawerResize', () => {
  let fixture: ComponentFixture<HostComponent>;
  let handle: HTMLElement;
  let panel: HTMLElement;

  beforeEach(async () => {
    fixture = await createFixture(HostComponent);
    handle = fixture.nativeElement.querySelector(
      '[mlvDrawerResize]',
    ) as HTMLElement;
    panel = fixture.nativeElement.querySelector('.panel') as HTMLElement;
    Object.defineProperty(handle, 'setPointerCapture', {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Drives a pointerdown/pointerup pair, which lands in the snap branch. */
  function snapGesture(): void {
    handle.dispatchEvent(pointerEvent('pointerdown'));
    handle.dispatchEvent(pointerEvent('pointerup'));
  }

  describe('snap transition teardown', () => {
    it('clears the snapping class when no transitionend ever arrives', () => {
      vi.useFakeTimers();

      snapGesture();
      expect(panel.classList.contains('mlv-drawer--snapping')).toBe(true);

      // `.mlv-drawer--snapping` declares its `transition` inside
      // `@media (prefers-reduced-motion: no-preference)`, so under reduced
      // motion the panel has no transition and `transitionend` never fires.
      // The same happens whenever the snap target equals the current size.
      vi.advanceTimersByTime(2000);

      expect(panel.classList.contains('mlv-drawer--snapping')).toBe(false);
    });

    it('releases the transitionend listener for every snap gesture', () => {
      vi.useFakeTimers();
      const added: string[] = [];
      const removed: string[] = [];
      const realAdd = panel.addEventListener.bind(panel);
      const realRemove = panel.removeEventListener.bind(panel);
      vi.spyOn(panel, 'addEventListener').mockImplementation(
        (type, listener, options) => {
          added.push(type);
          realAdd(type, listener, options);
        },
      );
      vi.spyOn(panel, 'removeEventListener').mockImplementation(
        (type, listener, options) => {
          removed.push(type);
          realRemove(type, listener, options);
        },
      );

      snapGesture();
      vi.advanceTimersByTime(2000);
      snapGesture();
      vi.advanceTimersByTime(2000);

      const addCount = added.filter((t) => t === 'transitionend').length;
      const removeCount = removed.filter((t) => t === 'transitionend').length;

      expect(addCount).toBe(2);
      expect(removeCount).toBe(2);
    });

    it('clears the snapping class as soon as transitionend arrives', () => {
      snapGesture();
      expect(panel.classList.contains('mlv-drawer--snapping')).toBe(true);

      panel.dispatchEvent(new Event('transitionend'));

      expect(panel.classList.contains('mlv-drawer--snapping')).toBe(false);
    });

    it('keeps the snapping class through a transitionend bubbling out of the panel content', () => {
      snapGesture();
      expect(panel.classList.contains('mlv-drawer--snapping')).toBe(true);

      // `transitionend` bubbles. The handle is itself a descendant of the
      // panel, and its `__handle-pill` fades `background-color` on
      // hover/focus-visible in `--mlv-duration-fast` — shorter than the snap —
      // so the handle's own chrome can end the snap early, and so can any
      // consumer content with a hover transition. Only the panel's own
      // width/height transition may clear the class.
      handle.dispatchEvent(new Event('transitionend', { bubbles: true }));
      expect(panel.classList.contains('mlv-drawer--snapping')).toBe(true);

      panel.dispatchEvent(new Event('transitionend', { bubbles: true }));
      expect(panel.classList.contains('mlv-drawer--snapping')).toBe(false);
    });

    it('still clears the snapping class through the fallback after ignoring a descendant transitionend', () => {
      vi.useFakeTimers();

      snapGesture();
      expect(panel.classList.contains('mlv-drawer--snapping')).toBe(true);

      // The descendant event must not settle the `race`. Were the target
      // filter applied after it (`race(…).pipe(filter(…), take(1))`), this
      // event would win, be dropped by the filter, and leave the timer arm
      // already unsubscribed — so the class would latch for good (#76 again).
      handle.dispatchEvent(new Event('transitionend', { bubbles: true }));
      expect(panel.classList.contains('mlv-drawer--snapping')).toBe(true);

      // The panel's own transition never ends (reduced motion, or a snap to
      // the current size); only the fallback timer is left.
      vi.advanceTimersByTime(2000);

      expect(panel.classList.contains('mlv-drawer--snapping')).toBe(false);
    });
  });
});

describe('MlvDrawerResize — clamped box', () => {
  const innerWidth = window.innerWidth;

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: innerWidth,
    });
  });

  it('reports the rendered size, not the requested one, once a floor stops the box', async () => {
    const fixture = await createFixture(FreeResizeHostComponent);
    const handle = fixture.nativeElement.querySelector(
      '[mlvDrawerResize]',
    ) as HTMLElement;
    const panel = fixture.nativeElement.querySelector('.panel') as HTMLElement;
    Object.defineProperty(handle, 'setPointerCapture', {
      configurable: true,
      value: vi.fn(),
    });
    // A 1000px viewport and a panel whose `minSize` has pinned it at 300px.
    // jsdom lays nothing out, so the box is stubbed.
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1000,
    });
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({
      width: 300,
      height: 800,
    } as DOMRect);

    // A free-resize gesture (no snap points) ends by reading the box back.
    handle.dispatchEvent(pointerEvent('pointerdown'));
    handle.dispatchEvent(pointerEvent('pointerup'));
    fixture.detectChanges();

    expect(handle.getAttribute('aria-valuenow')).toBe('30');

    // ArrowDown asks for 300 − 100 = 200px (20%); the floor keeps the box at
    // 300px, and the value follows the box.
    handle.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    fixture.detectChanges();

    expect(panel.style.getPropertyValue('--mlv-drawer-current-size')).toBe(
      '200px',
    );
    expect(handle.getAttribute('aria-valuenow')).toBe('30');
  });
});

describe('MlvDrawerResize — scoped direction', () => {
  const innerWidth = window.innerWidth;

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: innerWidth,
    });
    // `setDirection` is global state (it writes `dir` onto <html>) — reset both
    // the service and the attribute so a direction never leaks into the next test.
    TestBed.inject(MlvRtlService).setDirection('ltr');
    document.documentElement.removeAttribute('dir');
  });

  /**
   * A 1000px viewport with the panel box stubbed at 300px, so every key press
   * steps from the same base: 300 ± (1000 × 0.1).
   */
  async function scopedFixture(direction: 'ltr' | 'rtl'): Promise<{
    fixture: ComponentFixture<FreeResizeHostComponent>;
    handle: HTMLElement;
    panel: HTMLElement;
  }> {
    const fixture = await createFixture(FreeResizeHostComponent);
    const handle = fixture.nativeElement.querySelector(
      '[mlvDrawerResize]',
    ) as HTMLElement;
    const panel = fixture.nativeElement.querySelector('.panel') as HTMLElement;
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1000,
    });
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({
      width: 300,
      height: 800,
    } as DOMRect);
    (fixture.nativeElement as HTMLElement).setAttribute('dir', direction);
    fixture.detectChanges();
    return { fixture, handle, panel };
  }

  function size(panel: HTMLElement): string {
    return panel.style.getPropertyValue('--mlv-drawer-current-size');
  }

  function keydown(handle: HTMLElement, key: string): void {
    handle.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  }

  it('mirrors resize arrows inside a scoped [dir="rtl"] subtree while the document stays LTR', async () => {
    const { fixture, handle, panel } = await scopedFixture('rtl');

    expect(TestBed.inject(MlvRtlService).direction()).toBe('ltr');

    // Vertical arrows never mirror: ArrowUp still grows the panel.
    keydown(handle, 'ArrowUp');
    fixture.detectChanges();
    expect(size(panel)).toBe('400px');

    // ArrowRight is "smaller" once the inline axis runs right-to-left…
    keydown(handle, 'ArrowRight');
    fixture.detectChanges();
    expect(size(panel)).toBe('200px');

    // …and ArrowLeft is "bigger".
    keydown(handle, 'ArrowLeft');
    fixture.detectChanges();
    expect(size(panel)).toBe('400px');
  });

  it('leaves a scoped [dir="ltr"] island unmirrored while the document is RTL', async () => {
    // The fixture comes first: `TestBed.inject` instantiates the test module,
    // and `createFixture` still has to configure it.
    const { fixture, handle, panel } = await scopedFixture('ltr');
    TestBed.inject(MlvRtlService).setDirection('rtl');
    fixture.detectChanges();

    keydown(handle, 'ArrowRight');
    fixture.detectChanges();
    expect(size(panel)).toBe('400px');
  });
});

/** A bottom sheet whose nearest snap point can be 0 — the dismiss branch. */
@Component({
  template: `
    <div class="panel">
      <div
        mlvDrawerResize
        position="bottom"
        [snapPoints]="[0, 50, 100]"
        (dismissed)="dismissals = dismissals + 1"
      ></div>
    </div>
  `,
  imports: [MlvDrawerResize],
})
class DismissibleHostComponent {
  dismissals = 0;
}

// #338 — the drag ended on `pointerup` alone. A touch drag the browser turns
// into a scroll (or a palm rejection, or lost capture) fires `pointercancel` /
// `lostpointercapture` instead, which left `mlv-drawer--dragging` latched —
// the snap transition off for good — and the next hover over the handle still
// resizing the sheet.
describe('MlvDrawerResize — gesture end (#338)', () => {
  const innerHeight = window.innerHeight;
  let fixture: ComponentFixture<DismissibleHostComponent>;
  let handle: HTMLElement;
  let panel: HTMLElement;

  /** A pointer event at `clientY`, from pointer `pointerId`. */
  function pointerAt(
    type: string,
    clientY: number,
    pointerId = 1,
  ): PointerEvent {
    const event = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientY,
    });
    Object.defineProperty(event, 'pointerId', { value: pointerId });
    return event as unknown as PointerEvent;
  }

  function size(): string {
    return panel.style.getPropertyValue('--mlv-drawer-current-size');
  }

  beforeEach(async () => {
    fixture = await createFixture(DismissibleHostComponent);
    handle = fixture.nativeElement.querySelector(
      '[mlvDrawerResize]',
    ) as HTMLElement;
    panel = fixture.nativeElement.querySelector('.panel') as HTMLElement;
    Object.defineProperty(handle, 'setPointerCapture', {
      configurable: true,
      value: vi.fn(),
    });
    // A 1000px viewport; jsdom lays nothing out, so the box follows the size
    // the drag writes, starting at 800px (80%).
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 1000,
    });
    vi.spyOn(panel, 'getBoundingClientRect').mockImplementation(
      () =>
        ({
          width: 400,
          height: parseFloat(size()) || 800,
        }) as DOMRect,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: innerHeight,
    });
  });

  /** Drags the sheet 700px down — to 100px (10%), fast, toward closed. */
  function dragNearlyClosed(): void {
    handle.dispatchEvent(pointerAt('pointerdown', 200));
    handle.dispatchEvent(pointerAt('pointermove', 900));
    expect(panel.classList.contains('mlv-drawer--dragging')).toBe(true);
    expect(size()).toBe('100px');
  }

  it('dismisses on a release near 0 — the control for the interruptions below', () => {
    dragNearlyClosed();
    handle.dispatchEvent(pointerAt('pointerup', 900));

    expect(fixture.componentInstance.dismissals).toBe(1);
    expect(panel.classList.contains('mlv-drawer--dragging')).toBe(false);
  });

  it.each(['pointercancel', 'lostpointercapture'])(
    'ends the drag on %s: clears the drag class, snaps, never dismisses',
    (type) => {
      dragNearlyClosed();

      handle.dispatchEvent(pointerAt(type, 900));
      fixture.detectChanges();

      expect(panel.classList.contains('mlv-drawer--dragging')).toBe(false);
      // Neither the fling nor the 0 snap point dismisses a sheet the user
      // never let go of; it settles on the nearest point that keeps it open.
      expect(fixture.componentInstance.dismissals).toBe(0);
      expect(size()).toBe('500px');
      expect(handle.getAttribute('aria-valuenow')).toBe('50');

      // The move listener is gone: a later hover no longer resizes.
      handle.dispatchEvent(pointerAt('pointermove', 300));
      expect(size()).toBe('500px');
    },
  );

  it('ignores the interruption of another pointer', () => {
    dragNearlyClosed();

    handle.dispatchEvent(pointerAt('pointercancel', 900, 2));
    handle.dispatchEvent(pointerAt('lostpointercapture', 900, 2));
    handle.dispatchEvent(pointerAt('pointermove', 600, 2));

    expect(panel.classList.contains('mlv-drawer--dragging')).toBe(true);
    expect(size()).toBe('100px');
  });

  it('clears the drag class when destroyed mid-drag', () => {
    dragNearlyClosed();

    fixture.destroy();

    expect(panel.classList.contains('mlv-drawer--dragging')).toBe(false);
  });
});

/**
 * A stand-in for the injected `DOCUMENT`: only the two members the handle
 * reads the viewport size from. jsdom's own window is 768px tall, so a size
 * derived from it cannot pass for one derived from this.
 */
function viewportDocument(
  view: { innerHeight: number; innerWidth: number } | null,
  root = { clientHeight: 0, clientWidth: 0 },
): Document {
  return { defaultView: view, documentElement: root } as unknown as Document;
}

@Component({
  template: `
    <div class="panel">
      <div mlvDrawerResize position="bottom" [snapPoints]="[50, 100]"></div>
    </div>
  `,
  imports: [MlvDrawerResize],
  providers: [
    {
      provide: DOCUMENT,
      useValue: viewportDocument({ innerHeight: 1000, innerWidth: 400 }),
    },
  ],
})
class InjectedWindowHostComponent {}

@Component({
  template: `
    <div class="panel">
      <div mlvDrawerResize position="bottom" [snapPoints]="[50, 100]"></div>
    </div>
  `,
  imports: [MlvDrawerResize],
  providers: [
    {
      provide: DOCUMENT,
      useValue: viewportDocument(null, { clientHeight: 600, clientWidth: 400 }),
    },
  ],
})
class WindowlessDocumentHostComponent {}

// #338 (adjacent) — the handle read the viewport from the ambient `window`
// global instead of the injected `DOCUMENT`.
describe('MlvDrawerResize — viewport from the injected DOCUMENT', () => {
  function parts(fixture: ComponentFixture<unknown>): {
    handle: HTMLElement;
    panel: HTMLElement;
  } {
    const root = fixture.nativeElement as HTMLElement;
    const handle = root.querySelector('[mlvDrawerResize]') as HTMLElement;
    Object.defineProperty(handle, 'setPointerCapture', {
      configurable: true,
      value: vi.fn(),
    });
    return { handle, panel: root.querySelector('.panel') as HTMLElement };
  }

  function home(handle: HTMLElement): void {
    handle.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Home', bubbles: true }),
    );
  }

  afterEach(() => vi.restoreAllMocks());

  it("steps the keyboard against the injected document's window", async () => {
    const fixture = await createFixture(InjectedWindowHostComponent);
    const { handle, panel } = parts(fixture);

    home(handle);

    expect(panel.style.getPropertyValue('--mlv-drawer-current-size')).toBe(
      '500px',
    );
  });

  it("measures a drag against the injected document's window", async () => {
    const fixture = await createFixture(InjectedWindowHostComponent);
    const { handle, panel } = parts(fixture);
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({
      width: 400,
      height: 800,
    } as DOMRect);
    const at = (type: string, clientY: number): PointerEvent => {
      const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        button: 0,
        clientY,
      });
      Object.defineProperty(event, 'pointerId', { value: 1 });
      return event as unknown as PointerEvent;
    };

    handle.dispatchEvent(at('pointerdown', 200));
    handle.dispatchEvent(at('pointermove', 900));
    fixture.detectChanges();

    // 100px of a 1000px viewport; the ambient 768px window would read 13.
    expect(handle.getAttribute('aria-valuenow')).toBe('10');
  });

  it('falls back to the root element box for a document with no window', async () => {
    const fixture = await createFixture(WindowlessDocumentHostComponent);
    const { handle, panel } = parts(fixture);

    home(handle);

    expect(panel.style.getPropertyValue('--mlv-drawer-current-size')).toBe(
      '300px',
    );
  });
});
