import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import type { Type } from '@angular/core';
import { Component } from '@angular/core';
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
