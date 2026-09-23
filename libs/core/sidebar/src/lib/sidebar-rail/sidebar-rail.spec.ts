import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { SIDEBAR_CONTEXT } from '../sidebar-context';
import type { MlvSidebarContextValue } from '../sidebar-context';
import type { MlvSidebarMode } from '../sidebar-mode';
import { MlvSidebarRail } from './sidebar-rail';

/** jsdom ships no `PointerEvent`; the repo builds them from `MouseEvent`. */
function pointerEvent(type: string, clientX = 0, pointerId = 1): PointerEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX,
  });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  return event as unknown as PointerEvent;
}

/**
 * Tracks listeners bound to `target` as a **net count per event type**.
 *
 * The number of subscriptions is an implementation detail — `takeUntil(up$)`
 * opens a `pointerup` subscription of its own — while "nothing is still bound
 * once the gesture is over" is the actual guarantee, and a net of zero is how
 * you see it.
 */
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

const setWidth = vi.fn();
const toggle = vi.fn();
const collapsed = signal(false);

const context: MlvSidebarContextValue = {
  collapsed,
  mode: signal<MlvSidebarMode>('inline'),
  toggle,
  setWidth,
};

/** A laid-out box `width` wide whose left edge is at `left`. */
function rect(left: number, width: number): DOMRect {
  return {
    x: left,
    y: 0,
    top: 0,
    left,
    right: left + width,
    bottom: 800,
    width,
    height: 800,
    toJSON: () => ({}),
  } as DOMRect;
}

@Component({
  template: `<div class="mlv-sidebar"><mlv-sidebar-rail /></div>`,
  imports: [MlvSidebarRail],
})
class HostComponent {}

describe('MlvSidebarRail', () => {
  let fixture: ComponentFixture<HostComponent>;
  let rail: HTMLElement;

  beforeEach(async () => {
    setWidth.mockClear();
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: SIDEBAR_CONTEXT, useValue: context }],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    rail = fixture.nativeElement.querySelector(
      'mlv-sidebar-rail',
    ) as HTMLElement;
    Object.defineProperty(rail, 'setPointerCapture', {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    // The listener trackers replace `document.addEventListener`; without this
    // they chain into the next test in this file and its counts are nonsense.
    vi.restoreAllMocks();
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    // `setDirection` is global state (it writes `dir` onto <html>) — reset both
    // the service and the attribute so a direction never leaks into the next test.
    TestBed.inject(MlvRtlService).setDirection('ltr');
    document.documentElement.removeAttribute('dir');
  });

  /** Dispatches a bubbling keydown on the rail, the way a real key press arrives. */
  function keydown(key: string): void {
    rail.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    fixture.detectChanges();
  }

  it('mirrors resize arrows inside a scoped [dir="rtl"] subtree while the document stays LTR', () => {
    const scope = fixture.nativeElement as HTMLElement;
    scope.setAttribute('dir', 'rtl');

    expect(TestBed.inject(MlvRtlService).direction()).toBe('ltr');
    expect(rail.getAttribute('aria-valuenow')).toBe('260');

    // ArrowRight is "narrower" once the inline axis runs right-to-left.
    keydown('ArrowRight');
    expect(rail.getAttribute('aria-valuenow')).toBe('250');

    keydown('ArrowLeft');
    expect(rail.getAttribute('aria-valuenow')).toBe('260');

    // Vertical arrows and Home/End never mirror and never resize.
    keydown('ArrowUp');
    keydown('Home');
    expect(rail.getAttribute('aria-valuenow')).toBe('260');

    scope.removeAttribute('dir');
  });

  it('leaves a scoped [dir="ltr"] island unmirrored while the document is RTL', () => {
    TestBed.inject(MlvRtlService).setDirection('rtl');
    const scope = fixture.nativeElement as HTMLElement;
    scope.setAttribute('dir', 'ltr');
    fixture.detectChanges();

    keydown('ArrowRight');
    expect(rail.getAttribute('aria-valuenow')).toBe('270');

    scope.removeAttribute('dir');
  });

  it('marks itself dragging on pointerdown and clears on pointerup', () => {
    rail.dispatchEvent(pointerEvent('pointerdown'));
    fixture.detectChanges();
    expect(rail.classList.contains('mlv-sidebar-rail--dragging')).toBe(true);

    document.dispatchEvent(pointerEvent('pointerup'));
    fixture.detectChanges();
    expect(rail.classList.contains('mlv-sidebar-rail--dragging')).toBe(false);
  });

  it('releases the drag listeners when the gesture ends normally', () => {
    const net = trackListeners(document);

    rail.dispatchEvent(pointerEvent('pointerdown'));
    expect(net.get('pointermove')).toBeGreaterThan(0);

    document.dispatchEvent(pointerEvent('pointerup'));

    expect(net.get('pointermove')).toBe(0);
    expect(net.get('pointerup')).toBe(0);

    setWidth.mockClear();
    document.dispatchEvent(pointerEvent('pointermove', 300));
    expect(setWidth).toHaveBeenCalledTimes(0);
  });

  // The drag binds `pointermove` / `pointerup` on the document, which outlives
  // the component. `takeUntilDestroyed` is paired with `takeUntil(pointerUp$)`
  // precisely so a component torn down mid-drag leaves nothing attached — the
  // path no gesture exercises.
  it('detaches its document listeners when destroyed mid-drag', () => {
    const net = trackListeners(document);

    rail.dispatchEvent(pointerEvent('pointerdown'));
    fixture.detectChanges();
    expect(net.get('pointermove')).toBeGreaterThan(0);

    // Destroyed without ever seeing a pointerup.
    fixture.destroy();

    expect(net.get('pointermove')).toBe(0);
    expect(net.get('pointerup')).toBe(0);

    setWidth.mockClear();
    document.dispatchEvent(pointerEvent('pointermove', 300));
    expect(setWidth).toHaveBeenCalledTimes(0);
  });

  it('does not stack listeners when a second pointerdown re-enters the drag', () => {
    const net = trackListeners(document);

    rail.dispatchEvent(pointerEvent('pointerdown', 0, 1));
    const afterFirst = net.get('pointermove');

    // A second contact re-enters before the first gesture ended.
    rail.dispatchEvent(pointerEvent('pointerdown', 0, 2));

    expect(net.get('pointermove')).toBe(afterFirst);

    document.dispatchEvent(pointerEvent('pointerup'));
    expect(net.get('pointermove')).toBe(0);
    expect(net.get('pointerup')).toBe(0);
  });

  it('restores the body cursor and selection styles after a drag', () => {
    rail.dispatchEvent(pointerEvent('pointerdown'));
    expect(document.body.style.cursor).toBe('col-resize');

    document.dispatchEvent(pointerEvent('pointerup'));

    expect(document.body.style.cursor).toBe('');
    expect(document.body.style.userSelect).toBe('');
  });

  // #308 — the rail rides the sidebar's inline-end edge, which is its physical
  // LEFT edge in RTL. `clientX - rect.left` measured the width from the wrong
  // side: ≈ 0 at the rail and negative when dragging outward, so every RTL drag
  // fell under `snapThreshold` and collapsed the sidebar on release.
  describe('pointer width follows the inline axis', () => {
    type Scope = 'ltr' | 'global-rtl' | 'scoped-rtl';

    /**
     * Lays the sidebar out on the side the direction puts it: at the start of
     * a 1000px viewport in LTR (0..260), at its end in RTL (740..1000). The rail
     * sits on the inline-end edge, so a drag starts at 260 / 740 respectively.
     * Returns that start point and the sign of "outward" on the physical x axis.
     */
    function layOut(scope: Scope): { railX: number; outward: number } {
      const rtl = scope !== 'ltr';
      if (scope === 'global-rtl') {
        TestBed.inject(MlvRtlService).setDirection('rtl');
      }
      if (scope === 'scoped-rtl') {
        (fixture.nativeElement as HTMLElement).setAttribute('dir', 'rtl');
      }
      const sidebar = fixture.nativeElement.querySelector(
        '.mlv-sidebar',
      ) as HTMLElement;
      vi.spyOn(sidebar, 'getBoundingClientRect').mockReturnValue(
        rect(rtl ? 740 : 0, 260),
      );
      // Run the rAF-throttled move synchronously.
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        cb(0);
        return 1;
      });
      return { railX: rtl ? 740 : 260, outward: rtl ? -1 : 1 };
    }

    beforeEach(() => {
      toggle.mockClear();
    });

    afterEach(() => {
      (fixture.nativeElement as HTMLElement).removeAttribute('dir');
      collapsed.set(false);
    });

    it.each<Scope>(['ltr', 'global-rtl', 'scoped-rtl'])(
      'widens the sidebar when dragged 40px outward (%s)',
      (scope) => {
        const { railX, outward } = layOut(scope);
        if (scope === 'scoped-rtl') {
          // Only the subtree is flipped; the document stays LTR.
          expect(TestBed.inject(MlvRtlService).direction()).toBe('ltr');
        }

        rail.dispatchEvent(pointerEvent('pointerdown', railX));
        document.dispatchEvent(
          pointerEvent('pointermove', railX + 40 * outward),
        );
        document.dispatchEvent(pointerEvent('pointerup', railX + 40 * outward));
        fixture.detectChanges();

        expect(setWidth.mock.calls).toEqual([[300]]);
        expect(toggle).not.toHaveBeenCalled();
        expect(rail.getAttribute('aria-valuenow')).toBe('300');
      },
    );

    it.each<Scope>(['ltr', 'global-rtl', 'scoped-rtl'])(
      'still snaps to collapsed when dragged inward past the threshold (%s)',
      (scope) => {
        const { railX, outward } = layOut(scope);

        // 200px inward leaves 60px, under the 100px snap threshold.
        rail.dispatchEvent(pointerEvent('pointerdown', railX));
        document.dispatchEvent(
          pointerEvent('pointermove', railX - 200 * outward),
        );
        document.dispatchEvent(
          pointerEvent('pointerup', railX - 200 * outward),
        );

        expect(setWidth).not.toHaveBeenCalled();
        expect(toggle).toHaveBeenCalledTimes(1);
      },
    );

    it.each<Scope>(['ltr', 'global-rtl', 'scoped-rtl'])(
      'expands a collapsed sidebar dragged outward past the threshold (%s)',
      (scope) => {
        collapsed.set(true);
        const { railX, outward } = layOut(scope);

        rail.dispatchEvent(pointerEvent('pointerdown', railX));
        document.dispatchEvent(
          pointerEvent('pointermove', railX + 60 * outward),
        );
        document.dispatchEvent(pointerEvent('pointerup', railX + 60 * outward));

        // 260 + 60 = 320 from the sidebar's inline-start edge.
        expect(toggle).toHaveBeenCalledTimes(1);
        expect(setWidth.mock.calls).toEqual([[320]]);
      },
    );
  });
});

// #308 — the rail's width base was a hard-coded 260: `aria-valuenow` said 260
// on a 320px sidebar and the first keyboard step jumped it to 270. It now comes
// from the sidebar's rendered width, the same measurement a drag starts from.
// Own TestBed: the sidebar has to be laid out before the first render.
describe('MlvSidebarRail width base', () => {
  type Scope = 'ltr' | 'global-rtl' | 'scoped-rtl';

  let fixture: ComponentFixture<HostComponent>;
  let rail: HTMLElement;
  let sidebarWidth: number;

  beforeEach(async () => {
    setWidth.mockClear();
    collapsed.set(false);
    sidebarWidth = 320;
    const realRect = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        return this.classList.contains('mlv-sidebar')
          ? rect(0, sidebarWidth)
          : realRect.call(this);
      },
    );
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: SIDEBAR_CONTEXT, useValue: context }],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    collapsed.set(false);
    (fixture.nativeElement as HTMLElement).removeAttribute('dir');
    TestBed.inject(MlvRtlService).setDirection('ltr');
    document.documentElement.removeAttribute('dir');
  });

  /**
   * Renders the rail once the sidebar geometry and collapsed state are set —
   * the seed reads both on its first render, so a test that needs a different
   * start sets them before calling this.
   */
  async function mount(): Promise<void> {
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    rail = fixture.nativeElement.querySelector(
      'mlv-sidebar-rail',
    ) as HTMLElement;
  }

  /** Dispatches a bubbling keydown on the rail. */
  function keydown(key: string): void {
    rail.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    fixture.detectChanges();
  }

  it('reports the rendered sidebar width before any interaction', async () => {
    await mount();

    expect(rail.getAttribute('aria-valuenow')).toBe('320');
    expect(rail.getAttribute('aria-valuetext')).toBe('320px');
  });

  it('reports a fractional rendered width in whole pixels', async () => {
    // `width="22.5%"` in a 1517px shell.
    sidebarWidth = 341.325;
    await mount();

    expect(rail.getAttribute('aria-valuenow')).toBe('341');
    expect(rail.getAttribute('aria-valuetext')).toBe('341px');
  });

  it('keeps the fallback when the sidebar starts collapsed', async () => {
    // A collapsed `icon` sidebar renders its 56px rail. That is not the width
    // the rail controls: seeding it would report `aria-valuenow="56"` under
    // `aria-valuemin="200"` and step the next expand from 56.
    collapsed.set(true);
    sidebarWidth = 56;
    await mount();

    expect(rail.getAttribute('aria-valuenow')).toBe('260');
    expect(rail.getAttribute('aria-valuetext')).toBe('260px');
  });

  it.each<Scope>(['ltr', 'global-rtl', 'scoped-rtl'])(
    'steps from the rendered width, not from 260 (%s)',
    async (scope) => {
      await mount();
      if (scope === 'global-rtl') {
        TestBed.inject(MlvRtlService).setDirection('rtl');
      }
      if (scope === 'scoped-rtl') {
        (fixture.nativeElement as HTMLElement).setAttribute('dir', 'rtl');
      }
      fixture.detectChanges();
      await fixture.whenStable();

      // "Wider" is ArrowRight in LTR and ArrowLeft once the axis is mirrored.
      keydown(scope === 'ltr' ? 'ArrowRight' : 'ArrowLeft');

      expect(setWidth.mock.calls).toEqual([[330]]);
      expect(rail.getAttribute('aria-valuenow')).toBe('330');
    },
  );

  it('re-reads the width when the sidebar was resized from outside', async () => {
    await mount();
    // e.g. the consumer's `[width]` binding changed after the first render.
    sidebarWidth = 400;
    keydown('ArrowLeft');

    expect(setWidth.mock.calls).toEqual([[390]]);
    expect(rail.getAttribute('aria-valuenow')).toBe('390');
  });
});

// Isolated: this suite swaps the `DOCUMENT` provider, so it keeps its own
// TestBed rather than mutating the one the suite above shares.
describe('MlvSidebarRail document binding', () => {
  afterEach(() => vi.restoreAllMocks());

  // Under server rendering the injected `DOCUMENT` and the ambient `document`
  // global are different objects and the global is defined, so binding the
  // ambient one would attach a per-render component to a process-wide object
  // that no teardown reaches — and nothing would throw. This asserts *which*
  // object receives the listeners, which is the only way to see that.
  it('binds the drag to the injected DOCUMENT, not the ambient global', async () => {
    const isolated = document.implementation.createHTMLDocument('rail');

    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: SIDEBAR_CONTEXT, useValue: context },
        { provide: DOCUMENT, useValue: isolated },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const rail = fixture.nativeElement.querySelector(
      'mlv-sidebar-rail',
    ) as HTMLElement;
    Object.defineProperty(rail, 'setPointerCapture', {
      configurable: true,
      value: vi.fn(),
    });

    const isolatedNet = trackListeners(isolated);
    const ambientNet = trackListeners(document);

    rail.dispatchEvent(pointerEvent('pointerdown'));

    expect(isolatedNet.get('pointermove')).toBeGreaterThan(0);
    expect(ambientNet.get('pointermove')).toBeUndefined();
    expect(ambientNet.get('pointerup')).toBeUndefined();
    // The body styles follow the same document.
    expect(isolated.body.style.cursor).toBe('col-resize');

    isolated.dispatchEvent(pointerEvent('pointerup'));
    expect(isolatedNet.get('pointermove')).toBe(0);

    fixture.destroy();
  });
});
