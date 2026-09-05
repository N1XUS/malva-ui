import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
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

const context: MlvSidebarContextValue = {
  collapsed: signal(false),
  mode: signal<MlvSidebarMode>('inline'),
  toggle: vi.fn(),
  setWidth,
};

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
