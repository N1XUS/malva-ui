import { Component, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MlvSplitPane } from './split-pane';
import { MlvSplitPanePanel } from './split-pane-panel';

/**
 * #338 — a handle drag ended only on `pointerup` on the handle. A cancelled
 * touch drag, a lost capture or a destroy mid-drag left the page-wide
 * `col-resize` cursor and `user-select: none` on `<html>` and the
 * `--dragging` class latched, and the move listener alive.
 */

/** jsdom ships no `PointerEvent`; the repo builds them from `MouseEvent`. */
function pointerEvent(
  type: string,
  clientX = 0,
  { pointerId = 1, button = 0 }: { pointerId?: number; button?: number } = {},
): PointerEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button,
    clientX,
  });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  return event as unknown as PointerEvent;
}

/** A laid-out box `width` wide whose left edge is at `left`. */
function rect(left: number, width: number): DOMRect {
  return {
    x: left,
    y: 0,
    top: 0,
    left,
    right: left + width,
    bottom: 400,
    width,
    height: 400,
    toJSON: () => ({}),
  } as DOMRect;
}

@Component({
  imports: [MlvSplitPane, MlvSplitPanePanel],
  template: `
    @if (shown()) {
      <mlv-split-pane>
        <mlv-split-pane-panel [size]="50">Start</mlv-split-pane-panel>
        <mlv-split-pane-panel>End</mlv-split-pane-panel>
      </mlv-split-pane>
    }
  `,
})
class HostComponent {
  readonly shown = signal(true);
}

interface Mounted {
  fixture: ComponentFixture<HostComponent>;
  pane: HTMLElement;
  handle: HTMLElement;
}

/** Mounts the host and lays the 1000px pane out; `doc` overrides `DOCUMENT`. */
async function mount(doc?: Document): Promise<Mounted> {
  await TestBed.configureTestingModule({
    imports: [HostComponent],
    providers: doc ? [{ provide: DOCUMENT, useValue: doc }] : [],
  }).compileComponents();
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  const pane = fixture.debugElement.query(By.directive(MlvSplitPane))
    .nativeElement as HTMLElement;
  const handle = pane.querySelector('.mlv-split-pane__handle') as HTMLElement;
  Object.defineProperty(handle, 'setPointerCapture', {
    configurable: true,
    value: vi.fn(),
  });
  vi.spyOn(pane, 'getBoundingClientRect').mockReturnValue(rect(0, 1000));
  const firstPanel = pane.querySelector('mlv-split-pane-panel') as HTMLElement;
  vi.spyOn(firstPanel, 'getBoundingClientRect').mockReturnValue(rect(0, 500));
  return { fixture, pane, handle };
}

@Component({
  imports: [MlvSplitPane, MlvSplitPanePanel],
  template: `
    <mlv-split-pane>
      <mlv-split-pane-panel [size]="30">One</mlv-split-pane-panel>
      <mlv-split-pane-panel [size]="30">Two</mlv-split-pane-panel>
      <mlv-split-pane-panel [size]="40">Three</mlv-split-pane-panel>
    </mlv-split-pane>
  `,
})
class ThreePanelHostComponent {}

interface MountedThree {
  fixture: ComponentFixture<ThreePanelHostComponent>;
  pane: HTMLElement;
  handleA: HTMLElement;
  handleB: HTMLElement;
  captureB: ReturnType<typeof vi.fn>;
}

/** Mounts three panels (30 / 30 / 40) in a 1000px pane: handles A and B. */
async function mountThree(): Promise<MountedThree> {
  await TestBed.configureTestingModule({
    imports: [ThreePanelHostComponent],
  }).compileComponents();
  const fixture = TestBed.createComponent(ThreePanelHostComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  const pane = fixture.debugElement.query(By.directive(MlvSplitPane))
    .nativeElement as HTMLElement;
  const [handleA, handleB] = Array.from(
    pane.querySelectorAll<HTMLElement>('.mlv-split-pane__handle'),
  );
  const captureB = vi.fn();
  Object.defineProperty(handleA, 'setPointerCapture', {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(handleB, 'setPointerCapture', {
    configurable: true,
    value: captureB,
  });
  vi.spyOn(pane, 'getBoundingClientRect').mockReturnValue(rect(0, 1000));
  const [one, two] = Array.from(
    pane.querySelectorAll<HTMLElement>('mlv-split-pane-panel'),
  );
  vi.spyOn(one, 'getBoundingClientRect').mockReturnValue(rect(0, 300));
  vi.spyOn(two, 'getBoundingClientRect').mockReturnValue(rect(300, 300));
  return { fixture, pane, handleA, handleB, captureB };
}

describe('MlvSplitPane — drag gesture end (#338)', () => {
  const root = document.documentElement;

  afterEach(() => {
    vi.restoreAllMocks();
    root.style.removeProperty('cursor');
    root.style.removeProperty('user-select');
  });

  function dragTo300({ handle }: Mounted): void {
    handle.dispatchEvent(pointerEvent('pointerdown', 500));
    handle.dispatchEvent(pointerEvent('pointermove', 300));
  }

  it('sets the drag state on pointerdown and clears it on pointerup', async () => {
    const m = await mount();
    dragTo300(m);
    m.fixture.detectChanges();

    expect(m.pane.classList.contains('mlv-split-pane--dragging')).toBe(true);
    expect(root.style.cursor).toBe('col-resize');
    expect(root.style.getPropertyValue('user-select')).toBe('none');

    m.handle.dispatchEvent(pointerEvent('pointerup', 300));
    m.fixture.detectChanges();

    expect(m.pane.classList.contains('mlv-split-pane--dragging')).toBe(false);
    expect(root.style.cursor).toBe('');
    expect(root.style.getPropertyValue('user-select')).toBe('');
    expect(m.handle.getAttribute('aria-valuenow')).toBe('30');
  });

  it.each(['pointercancel', 'lostpointercapture'])(
    'ends the drag on %s and keeps the size it reached',
    async (type) => {
      const m = await mount();
      dragTo300(m);
      m.fixture.detectChanges();
      expect(m.pane.style.gridTemplateColumns).toBe('30fr 0.125rem 70fr');

      m.handle.dispatchEvent(pointerEvent(type, 300));
      m.fixture.detectChanges();

      expect(m.pane.classList.contains('mlv-split-pane--dragging')).toBe(false);
      expect(root.style.cursor).toBe('');
      expect(root.style.getPropertyValue('user-select')).toBe('');

      // The move listener is gone: a later move resizes nothing.
      m.handle.dispatchEvent(pointerEvent('pointermove', 800));
      expect(m.pane.style.gridTemplateColumns).toBe('30fr 0.125rem 70fr');

      // The size the drag reached is committed, so the keyboard steps from it
      // rather than from the size the drag started at.
      m.handle.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
      );
      m.fixture.detectChanges();
      expect(m.handle.getAttribute('aria-valuenow')).toBe('31');
    },
  );

  it('ignores a lostpointercapture that bubbles up from a descendant', async () => {
    const m = await mount();
    dragTo300(m);
    const grip = m.handle.querySelector(
      '.mlv-split-pane__handle-grip',
    ) as HTMLElement;

    grip.dispatchEvent(pointerEvent('lostpointercapture', 300));
    m.fixture.detectChanges();

    expect(m.pane.classList.contains('mlv-split-pane--dragging')).toBe(true);
    m.handle.dispatchEvent(pointerEvent('pointermove', 400));
    expect(m.pane.style.gridTemplateColumns).toBe('40fr 0.125rem 60fr');
  });

  it('ignores the end of another pointer', async () => {
    const m = await mount();
    dragTo300(m);

    m.handle.dispatchEvent(
      pointerEvent('pointercancel', 300, { pointerId: 2 }),
    );
    m.fixture.detectChanges();

    expect(m.pane.classList.contains('mlv-split-pane--dragging')).toBe(true);
    expect(root.style.cursor).toBe('col-resize');
  });

  it('ignores a second pointer pressing another handle mid-drag', async () => {
    const m = await mountThree();
    const second = { pointerId: 2 };
    m.handleA.dispatchEvent(pointerEvent('pointerdown', 300));
    m.handleA.dispatchEvent(pointerEvent('pointermove', 200));
    m.fixture.detectChanges();
    expect(m.pane.style.gridTemplateColumns).toBe(
      '20fr 0.125rem 40fr 0.125rem 40fr',
    );

    // A second finger on handle B: no second drag starts, so B neither
    // captures the pointer nor resizes on its moves.
    m.handleB.dispatchEvent(pointerEvent('pointerdown', 600, second));
    m.handleB.dispatchEvent(pointerEvent('pointermove', 700, second));
    m.fixture.detectChanges();
    expect(m.captureB).not.toHaveBeenCalled();
    expect(m.pane.style.gridTemplateColumns).toBe(
      '20fr 0.125rem 40fr 0.125rem 40fr',
    );

    // The second finger lifting does not end the first finger's drag.
    m.handleB.dispatchEvent(pointerEvent('pointerup', 700, second));
    m.fixture.detectChanges();
    expect(m.pane.classList.contains('mlv-split-pane--dragging')).toBe(true);
    expect(root.style.cursor).toBe('col-resize');

    // Only A's moves apply, and A's release commits them.
    m.handleA.dispatchEvent(pointerEvent('pointermove', 250));
    m.handleA.dispatchEvent(pointerEvent('pointerup', 250));
    m.fixture.detectChanges();
    expect(m.pane.style.gridTemplateColumns).toBe(
      '25fr 0.125rem 35fr 0.125rem 40fr',
    );
    expect(m.pane.classList.contains('mlv-split-pane--dragging')).toBe(false);
    expect(root.style.cursor).toBe('');
  });

  it('ends the drag when the captured handle leaves the document', async () => {
    const m = await mount();
    dragTo300(m);
    m.fixture.detectChanges();

    // Chromium dispatches `lostpointercapture` at the document when the
    // capturing element is removed (measured, see `mlvPointerGestureEnd`).
    m.handle.remove();
    document.dispatchEvent(pointerEvent('lostpointercapture', 300));
    m.fixture.detectChanges();

    expect(m.pane.classList.contains('mlv-split-pane--dragging')).toBe(false);
    expect(root.style.cursor).toBe('');
    expect(root.style.getPropertyValue('user-select')).toBe('');
  });

  it('restores the document styles when destroyed mid-drag', async () => {
    const m = await mount();
    dragTo300(m);
    expect(root.style.cursor).toBe('col-resize');

    m.fixture.componentInstance.shown.set(false);
    m.fixture.detectChanges();
    await m.fixture.whenStable();

    expect(root.style.cursor).toBe('');
    expect(root.style.getPropertyValue('user-select')).toBe('');
  });

  it('writes the drag styles to the injected DOCUMENT, not the ambient global', async () => {
    const isolated = document.implementation.createHTMLDocument('split-pane');
    const m = await mount(isolated);

    m.handle.dispatchEvent(pointerEvent('pointerdown', 500));

    expect(isolated.documentElement.style.cursor).toBe('col-resize');
    expect(root.style.cursor).toBe('');

    m.handle.dispatchEvent(pointerEvent('pointercancel', 500));

    expect(isolated.documentElement.style.cursor).toBe('');
    m.fixture.destroy();
  });
});
