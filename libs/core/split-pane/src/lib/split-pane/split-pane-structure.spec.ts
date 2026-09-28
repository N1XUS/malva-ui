import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  ElementRef,
  inject,
  signal,
  TemplateRef,
  viewChild,
  ViewContainerRef,
} from '@angular/core';
import type { AfterViewInit, OnInit } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  MlvBreakpointService,
  MlvBreakpointUp,
  MlvRtlService,
} from '@malva-ui/cdk/utils';
import type { MlvBreakpoint } from '@malva-ui/cdk/utils';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvSplitPane } from './split-pane';
import { MlvSplitPanePanel } from './split-pane-panel';
import type { MlvSplitPaneOrientation } from './split-pane.types';

/**
 * #359 — `mlv-split-pane` built its handles, their ARIA and the grid template
 * once, in `ngAfterContentInit`. A runtime `orientation` flip kept the old grid
 * track property and the old handle ARIA, a panel added at runtime fell into
 * an implicit second grid row, and a panel removed at runtime left an orphan
 * handle whose ArrowRight threw `TypeError … minSize`.
 */

interface PanelSpec {
  id: string;
  size?: number;
  minSize?: number;
}

@Component({
  imports: [MlvSplitPane, MlvSplitPanePanel],
  template: `
    <mlv-split-pane [orientation]="orientation()">
      @for (panel of panels(); track panel.id) {
        <mlv-split-pane-panel
          [size]="panel.size"
          [minSize]="panel.minSize ?? 5"
          [attr.data-id]="panel.id"
          >{{ panel.id }}</mlv-split-pane-panel
        >
      }
    </mlv-split-pane>
  `,
})
class DynamicHost {
  readonly orientation = signal<MlvSplitPaneOrientation>('horizontal');
  readonly panels = signal<PanelSpec[]>([]);
}

const A: PanelSpec = { id: 'a', size: 30 };
const B: PanelSpec = { id: 'b', size: 30 };
const C: PanelSpec = { id: 'c', size: 40 };

interface Mounted {
  fixture: ComponentFixture<DynamicHost>;
  host: DynamicHost;
  pane: HTMLElement;
}

async function mount(
  panels: PanelSpec[],
  orientation: MlvSplitPaneOrientation = 'horizontal',
): Promise<Mounted> {
  await TestBed.configureTestingModule({
    imports: [DynamicHost],
  }).compileComponents();
  const fixture = TestBed.createComponent(DynamicHost);
  const host = fixture.componentInstance;
  host.panels.set(panels);
  host.orientation.set(orientation);
  fixture.detectChanges();
  await fixture.whenStable();
  const pane = fixture.debugElement.query(By.directive(MlvSplitPane))
    .nativeElement as HTMLElement;
  return { fixture, host, pane };
}

async function settle({ fixture }: Mounted): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
}

function handles(pane: HTMLElement): HTMLElement[] {
  return Array.from(
    pane.querySelectorAll<HTMLElement>(':scope > .mlv-split-pane__handle'),
  );
}

/** The host's element children, in order: `a | b` for panel a, handle, panel b. */
function layout(pane: HTMLElement): string {
  return Array.from(pane.children)
    .map((child) =>
      child.classList.contains('mlv-split-pane__handle')
        ? '|'
        : (child.getAttribute('data-id') ?? child.tagName.toLowerCase()),
    )
    .join(' ');
}

/** The `fr` tracks of `prop`, rounded to two decimals; handle tracks dropped. */
function tracks(pane: HTMLElement, prop: string): number[] {
  return pane.style
    .getPropertyValue(prop)
    .split(' ')
    .filter((track) => track.endsWith('fr'))
    .map((track) => Math.round(parseFloat(track) * 100) / 100);
}

function keydown(target: HTMLElement, key: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

/** jsdom ships no `PointerEvent`; the repo builds them from `MouseEvent`. */
function pointerEvent(type: string, clientX: number): PointerEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX,
  });
  Object.defineProperty(event, 'pointerId', { value: 1 });
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

function panelEl(pane: HTMLElement, id: string): HTMLElement {
  return pane.querySelector(`[data-id="${id}"]`) as HTMLElement;
}

describe('MlvSplitPane — structure follows orientation and panels (#359)', () => {
  const root = document.documentElement;

  afterEach(() => {
    vi.restoreAllMocks();
    root.style.removeProperty('cursor');
    root.style.removeProperty('user-select');
    TestBed.inject(MlvRtlService).setDirection('ltr');
    root.removeAttribute('dir');
  });

  describe('orientation', () => {
    it('moves the tracks to grid-template-rows and clears the columns on a flip', async () => {
      const m = await mount([A, B, C]);
      expect(tracks(m.pane, 'grid-template-columns')).toEqual([30, 30, 40]);

      m.host.orientation.set('vertical');
      await settle(m);

      expect(tracks(m.pane, 'grid-template-rows')).toEqual([30, 30, 40]);
      expect(m.pane.style.getPropertyValue('grid-template-columns')).toBe('');

      m.host.orientation.set('horizontal');
      await settle(m);

      expect(tracks(m.pane, 'grid-template-columns')).toEqual([30, 30, 40]);
      expect(m.pane.style.getPropertyValue('grid-template-rows')).toBe('');
    });

    it('re-labels the same handles for the new axis', async () => {
      const m = await mount([A, B]);
      const [handle] = handles(m.pane);

      m.host.orientation.set('vertical');
      await settle(m);

      expect(handles(m.pane)).toEqual([handle]);
      expect(handle.getAttribute('aria-orientation')).toBe('horizontal');
      expect(handle.getAttribute('aria-label')).toBe(
        'Resize panels vertically',
      );
      const grip = handle.querySelector(
        '.mlv-split-pane__handle-grip',
      ) as HTMLElement;
      expect(grip.className).toBe(
        'mlv-split-pane__handle-grip mlv-split-pane__handle-grip--horizontal',
      );
    });

    it('keeps focus on the handle and steps on the new axis after a flip', async () => {
      const m = await mount([A, { id: 'b' }]);
      const [handle] = handles(m.pane);
      handle.focus();

      m.host.orientation.set('vertical');
      await settle(m);

      expect(document.activeElement).toBe(handle);
      keydown(handle, 'ArrowRight');
      expect(handle.getAttribute('aria-valuenow')).toBe('30');
      keydown(handle, 'ArrowDown');
      expect(handle.getAttribute('aria-valuenow')).toBe('31');
      expect(tracks(m.pane, 'grid-template-rows')).toEqual([31, 69]);
      expect(m.pane.style.getPropertyValue('grid-template-columns')).toBe('');
    });
  });

  describe('a panel added at runtime', () => {
    it('gets its own column and a handle before it', async () => {
      const m = await mount([A, { id: 'b' }]);
      m.host.panels.set([A, { id: 'b' }, { id: 'c', size: 25 }]);
      await settle(m);

      expect(layout(m.pane)).toBe('a | b | c');
      expect(handles(m.pane)).toHaveLength(2);
      // The added panel takes its `size` from the panel before it.
      expect(tracks(m.pane, 'grid-template-columns')).toEqual([30, 45, 25]);
      expect(m.pane.style.getPropertyValue('grid-template-columns')).toBe(
        '30fr 0.125rem 45fr 0.125rem 25fr',
      );
    });

    it('takes an equal share when it has no size', async () => {
      const m = await mount([A, { id: 'b' }]);
      m.host.panels.set([A, { id: 'b' }, { id: 'c' }]);
      await settle(m);

      expect(tracks(m.pane, 'grid-template-columns')).toEqual([
        30, 36.67, 33.33,
      ]);
    });

    it('takes its size from the panel after it when added first', async () => {
      const m = await mount([A, { id: 'b' }]);
      const [kept] = handles(m.pane);
      m.host.panels.set([{ id: 'n', size: 10 }, A, { id: 'b' }]);
      await settle(m);

      expect(layout(m.pane)).toBe('n | a | b');
      expect(tracks(m.pane, 'grid-template-columns')).toEqual([10, 20, 70]);
      // The handle between a and b is still the same node.
      expect(handles(m.pane)[1]).toBe(kept);
    });

    it('never takes a donor below its minSize and spills to the next one', async () => {
      const m = await mount([
        { id: 'a', size: 30 },
        { id: 'b', size: 70 },
      ]);
      m.host.panels.set([
        { id: 'a', size: 30 },
        { id: 'b', size: 70 },
        { id: 'c', size: 80 },
      ]);
      await settle(m);

      // b gives down to its minSize (5), a gives the remaining 15.
      expect(tracks(m.pane, 'grid-template-columns')).toEqual([15, 5, 80]);
    });

    it('gets only what the donors can give once every donor is at its minSize', async () => {
      const m = await mount([
        { id: 'a', size: 30 },
        { id: 'b', size: 70 },
      ]);
      m.host.panels.set([
        { id: 'a', size: 30 },
        { id: 'b', size: 70 },
        { id: 'c', size: 95 },
      ]);
      await settle(m);

      expect(tracks(m.pane, 'grid-template-columns')).toEqual([5, 5, 90]);
    });

    it('publishes ARIA for every handle', async () => {
      const m = await mount([A, { id: 'b' }]);
      m.host.panels.set([A, { id: 'b' }, { id: 'c', size: 25, minSize: 10 }]);
      await settle(m);

      const [first, second] = handles(m.pane);
      expect(first.getAttribute('aria-valuenow')).toBe('30');
      expect(second.getAttribute('aria-valuenow')).toBe('45');
      expect(second.getAttribute('aria-valuemin')).toBe('5');
      expect(second.getAttribute('aria-valuemax')).toBe('90');
      expect(second.getAttribute('role')).toBe('separator');
      expect(second.getAttribute('tabindex')).toBe('0');
    });

    it('resizes through the new handle by keyboard, mirrored in a scoped RTL subtree', async () => {
      const m = await mount([A, { id: 'b' }]);
      m.host.panels.set([A, { id: 'b' }, { id: 'c', size: 25 }]);
      await settle(m);
      (m.fixture.nativeElement as HTMLElement).setAttribute('dir', 'rtl');

      const [, second] = handles(m.pane);
      keydown(second, 'ArrowLeft');

      expect(tracks(m.pane, 'grid-template-columns')).toEqual([30, 46, 24]);
      expect(second.getAttribute('aria-valuenow')).toBe('46');
    });

    it('is gone again on removal without drift: a toggled panel round-trips', async () => {
      const panels = [
        { id: 'a', size: 20 },
        { id: 'b' },
        { id: 'c', size: 25 },
      ];
      const m = await mount(panels);
      expect(tracks(m.pane, 'grid-template-columns')).toEqual([20, 55, 25]);

      for (let round = 0; round < 3; round++) {
        m.host.panels.set(panels.slice(0, 2));
        await settle(m);
        expect(tracks(m.pane, 'grid-template-columns')).toEqual([20, 80]);

        m.host.panels.set(panels);
        await settle(m);
        expect(tracks(m.pane, 'grid-template-columns')).toEqual([20, 55, 25]);
      }
    });
  });

  describe('a panel removed at runtime', () => {
    it('removes the orphan handle, and a key on it no longer throws or resizes', async () => {
      const m = await mount([A, B, C]);
      const [first, orphan] = handles(m.pane);

      m.host.panels.set([A, B]);
      await settle(m);

      expect(layout(m.pane)).toBe('a | b');
      expect(handles(m.pane)).toEqual([first]);
      expect(orphan.isConnected).toBe(false);

      // Its listener is released with it: a live one would `preventDefault()`
      // the key before failing to find its pair.
      const onOrphan = new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        cancelable: true,
      });
      orphan.dispatchEvent(onOrphan);
      expect(onOrphan.defaultPrevented).toBe(false);
      expect(tracks(m.pane, 'grid-template-columns')).toEqual([30, 70]);

      keydown(first, 'ArrowRight');
      expect(tracks(m.pane, 'grid-template-columns')).toEqual([31, 69]);
      expect(first.getAttribute('aria-valuenow')).toBe('31');
    });

    it('gives the freed size to the panel before it', async () => {
      const m = await mount([A, B, C]);
      m.host.panels.set([A, C]);
      await settle(m);

      expect(layout(m.pane)).toBe('a | c');
      expect(tracks(m.pane, 'grid-template-columns')).toEqual([60, 40]);
      expect(handles(m.pane)[0].getAttribute('aria-valuenow')).toBe('60');
    });

    it('gives the freed size to the panel after it when it was first', async () => {
      const m = await mount([A, B, C]);
      m.host.panels.set([B, C]);
      await settle(m);

      expect(layout(m.pane)).toBe('b | c');
      expect(tracks(m.pane, 'grid-template-columns')).toEqual([60, 40]);
    });

    it('keeps every other panel at its dragged size', async () => {
      const m = await mount([
        { id: 'a', size: 20 },
        { id: 'b', size: 20 },
        { id: 'c', size: 20 },
        { id: 'd', size: 40 },
      ]);
      const [first] = handles(m.pane);
      keydown(first, 'ArrowRight');
      expect(tracks(m.pane, 'grid-template-columns')).toEqual([21, 19, 20, 40]);

      m.host.panels.set([
        { id: 'a', size: 20 },
        { id: 'b', size: 20 },
        { id: 'd', size: 40 },
      ]);
      await settle(m);

      expect(tracks(m.pane, 'grid-template-columns')).toEqual([21, 39, 40]);
    });

    it('leaves no handle and no inline template with a single panel, and starts over from the inputs', async () => {
      const m = await mount([A, { id: 'b' }]);
      const [first] = handles(m.pane);
      keydown(first, 'ArrowRight');

      m.host.panels.set([A]);
      await settle(m);

      expect(layout(m.pane)).toBe('a');
      expect(m.pane.style.getPropertyValue('grid-template-columns')).toBe('');
      expect(m.pane.style.getPropertyValue('grid-template-rows')).toBe('');

      m.host.panels.set([A, { id: 'b' }]);
      await settle(m);

      expect(layout(m.pane)).toBe('a | b');
      expect(tracks(m.pane, 'grid-template-columns')).toEqual([30, 70]);
    });
  });

  describe('focus', () => {
    it('keeps the focused handle when the panel between two handles goes', async () => {
      const m = await mount([A, B, C]);
      const [first, second] = handles(m.pane);
      second.focus();

      m.host.panels.set([A, C]);
      await settle(m);

      expect(handles(m.pane)).toEqual([second]);
      expect(first.isConnected).toBe(false);
      expect(document.activeElement).toBe(second);
    });

    it('moves focus to the next handle when the first panel goes with the focused one', async () => {
      const m = await mount([A, B, C]);
      const [first, second] = handles(m.pane);
      first.focus();

      m.host.panels.set([B, C]);
      await settle(m);

      expect(first.isConnected).toBe(false);
      expect(document.activeElement).toBe(second);
    });

    it('moves focus to the previous handle when the last panel goes with the focused one', async () => {
      const m = await mount([A, B, C]);
      const [first, second] = handles(m.pane);
      second.focus();

      m.host.panels.set([A, B]);
      await settle(m);

      expect(second.isConnected).toBe(false);
      expect(document.activeElement).toBe(first);
    });

    it('keeps focus on a handle that survives an added panel', async () => {
      const m = await mount([A, { id: 'b' }]);
      const [first] = handles(m.pane);
      first.focus();

      m.host.panels.set([A, { id: 'b' }, { id: 'c', size: 25 }]);
      await settle(m);

      expect(handles(m.pane)[0]).toBe(first);
      expect(document.activeElement).toBe(first);
    });
  });

  describe('a rebuild during a drag', () => {
    it('ends the drag, keeps the size it reached and releases its listeners when the dragged handle goes', async () => {
      const m = await mount([A, B, C]);
      const [, second] = handles(m.pane);
      Object.defineProperty(second, 'setPointerCapture', {
        configurable: true,
        value: vi.fn(),
      });
      vi.spyOn(m.pane, 'getBoundingClientRect').mockReturnValue(rect(0, 1000));
      vi.spyOn(panelEl(m.pane, 'b'), 'getBoundingClientRect').mockReturnValue(
        rect(300, 300),
      );

      second.dispatchEvent(pointerEvent('pointerdown', 600));
      second.dispatchEvent(pointerEvent('pointermove', 500));
      await settle(m);
      expect(m.pane.classList.contains('mlv-split-pane--dragging')).toBe(true);
      expect(tracks(m.pane, 'grid-template-columns')).toEqual([30, 20, 50]);

      m.host.panels.set([A, B]);
      await settle(m);

      expect(m.pane.classList.contains('mlv-split-pane--dragging')).toBe(false);
      expect(root.style.cursor).toBe('');
      expect(root.style.getPropertyValue('user-select')).toBe('');
      // The size the drag reached is carried over: b absorbs c's 50.
      expect(tracks(m.pane, 'grid-template-columns')).toEqual([30, 70]);

      // No move listener survives on the removed handle.
      second.dispatchEvent(pointerEvent('pointermove', 900));
      second.dispatchEvent(pointerEvent('pointerup', 900));
      await settle(m);
      expect(tracks(m.pane, 'grid-template-columns')).toEqual([30, 70]);
    });

    it('ends the drag on an orientation flip and keeps the size it reached', async () => {
      const m = await mount([A, { id: 'b' }]);
      const [handle] = handles(m.pane);
      Object.defineProperty(handle, 'setPointerCapture', {
        configurable: true,
        value: vi.fn(),
      });
      vi.spyOn(m.pane, 'getBoundingClientRect').mockReturnValue(rect(0, 1000));
      vi.spyOn(panelEl(m.pane, 'a'), 'getBoundingClientRect').mockReturnValue(
        rect(0, 300),
      );

      handle.dispatchEvent(pointerEvent('pointerdown', 300));
      handle.dispatchEvent(pointerEvent('pointermove', 400));
      await settle(m);

      m.host.orientation.set('vertical');
      await settle(m);

      expect(m.pane.classList.contains('mlv-split-pane--dragging')).toBe(false);
      expect(root.style.cursor).toBe('');
      expect(tracks(m.pane, 'grid-template-rows')).toEqual([40, 60]);

      // The ended drag's move listener is gone.
      handle.dispatchEvent(pointerEvent('pointermove', 700));
      expect(tracks(m.pane, 'grid-template-rows')).toEqual([40, 60]);

      // A fresh drag still starts from the handle afterwards.
      handle.dispatchEvent(pointerEvent('pointerup', 700));
      handle.dispatchEvent(pointerEvent('pointerdown', 400));
      await settle(m);
      expect(m.pane.classList.contains('mlv-split-pane--dragging')).toBe(true);
      handle.dispatchEvent(pointerEvent('pointerup', 400));
      await settle(m);
    });
  });

  describe('axe', () => {
    it('sweeps clean after a panel is added', async () => {
      const m = await mount([A, { id: 'b' }]);
      m.host.panels.set([A, { id: 'b' }, { id: 'c', size: 25 }]);
      await settle(m);
      await expectNoAxeViolations(m.fixture.nativeElement as HTMLElement);
    });

    it('sweeps clean after a panel is removed', async () => {
      const m = await mount([A, B, C]);
      m.host.panels.set([A, C]);
      await settle(m);
      await expectNoAxeViolations(m.fixture.nativeElement as HTMLElement);
    });

    it('sweeps clean after an orientation flip', async () => {
      const m = await mount([A, B, C]);
      m.host.orientation.set('vertical');
      await settle(m);
      await expectNoAxeViolations(m.fixture.nativeElement as HTMLElement);
    });

    it('sweeps clean with a single panel', async () => {
      const m = await mount([A]);
      await expectNoAxeViolations(m.fixture.nativeElement as HTMLElement);
    });
  });
});

@Component({
  imports: [MlvSplitPane, MlvSplitPanePanel],
  template: `
    <mlv-split-pane [orientation]="orientation()">
      <mlv-split-pane-panel [size]="30" data-id="nav">nav</mlv-split-pane-panel>
      <mlv-split-pane-panel data-id="main">main</mlv-split-pane-panel>
      @if (detail()) {
        <mlv-split-pane-panel [size]="25" data-id="detail"
          >detail</mlv-split-pane-panel
        >
      }
      @if (wrapped()) {
        @for (panel of extra(); track panel.id) {
          <mlv-split-pane-panel [size]="panel.size" [attr.data-id]="panel.id">{{
            panel.id
          }}</mlv-split-pane-panel>
        }
      }
    </mlv-split-pane>
  `,
})
class MixedHost {
  readonly orientation = signal<MlvSplitPaneOrientation>('horizontal');
  readonly detail = signal(false);
  readonly wrapped = signal(true);
  readonly extra = signal<PanelSpec[]>([]);
}

describe('MlvSplitPane — static panels beside conditional ones (#359)', () => {
  /** Mounts the host; `init` runs before its first change detection. */
  async function mountMixed(init?: (host: MixedHost) => void): Promise<{
    fixture: ComponentFixture<MixedHost>;
    host: MixedHost;
    pane: HTMLElement;
  }> {
    await TestBed.configureTestingModule({
      imports: [MixedHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(MixedHost);
    init?.(fixture.componentInstance);
    fixture.detectChanges();
    await fixture.whenStable();
    const pane = fixture.debugElement.query(By.directive(MlvSplitPane))
      .nativeElement as HTMLElement;
    return { fixture, host: fixture.componentInstance, pane };
  }

  it('reads the bound size of an `@if` panel, not its unbound default', async () => {
    const m = await mountMixed();
    expect(tracks(m.pane, 'grid-template-columns')).toEqual([30, 70]);

    m.host.detail.set(true);
    m.fixture.detectChanges();
    await m.fixture.whenStable();

    expect(layout(m.pane)).toBe('nav | main | detail');
    // detail asks for its own 25, taken from main (its nearest survivor).
    expect(tracks(m.pane, 'grid-template-columns')).toEqual([30, 45, 25]);

    m.host.detail.set(false);
    m.fixture.detectChanges();
    await m.fixture.whenStable();

    expect(layout(m.pane)).toBe('nav | main');
    expect(tracks(m.pane, 'grid-template-columns')).toEqual([30, 70]);
  });

  it('lays a sizeless `@for`-in-`@if` panel present at init out with the rest, as `ngAfterContentInit` did', async () => {
    // The `@for` stamps x only while the `@if`'s embedded view refreshes, after
    // the split pane's effect has run. A first layout taken there saw
    // `nav | main` alone and then carved x out of it as an added panel
    // (30 / 36.67 / 33.33); from scratch, main and x share what nav leaves.
    const m = await mountMixed((host) => host.extra.set([{ id: 'x' }]));

    expect(layout(m.pane)).toBe('nav | main | x');
    expect(tracks(m.pane, 'grid-template-columns')).toEqual([30, 35, 35]);
  });

  it('follows a `@for` nested in an `@if` whose list alone changes', async () => {
    const m = await mountMixed();

    m.host.extra.set([{ id: 'x', size: 20 }]);
    m.fixture.detectChanges();
    await m.fixture.whenStable();

    expect(layout(m.pane)).toBe('nav | main | x');
    expect(tracks(m.pane, 'grid-template-columns')).toEqual([30, 50, 20]);
    expect(handles(m.pane)[1].getAttribute('aria-valuenow')).toBe('50');
  });

  it('sweeps clean in both orientations', async () => {
    const m = await mountMixed();
    await expectNoAxeViolations(m.fixture.nativeElement as HTMLElement);

    m.host.orientation.set('vertical');
    m.host.detail.set(true);
    m.fixture.detectChanges();
    await m.fixture.whenStable();
    await expectNoAxeViolations(m.fixture.nativeElement as HTMLElement);
  });
});

@Component({
  imports: [MlvSplitPane, MlvSplitPanePanel],
  template: `
    <mlv-split-pane #pane>
      @for (panel of panels; track panel.id) {
        <mlv-split-pane-panel [size]="panel.size" [attr.data-id]="panel.id">{{
          panel.id
        }}</mlv-split-pane-panel>
      }
    </mlv-split-pane>
  `,
})
class InitTimingHost implements AfterViewInit {
  readonly panels: PanelSpec[] = [A, B, C];
  readonly pane = viewChild.required('pane', { read: ElementRef });
  /** What the host saw in its own `ngAfterViewInit`. */
  seen: { layout: string; columns: number[] } | null = null;

  ngAfterViewInit(): void {
    const pane = this.pane().nativeElement as HTMLElement;
    this.seen = {
      layout: layout(pane),
      columns: tracks(pane, 'grid-template-columns'),
    };
  }
}

describe('MlvSplitPane — first layout timing (#359)', () => {
  it('lays `@for` panels out by the host’s ngAfterViewInit, as `ngAfterContentInit` did', async () => {
    await TestBed.configureTestingModule({
      imports: [InitTimingHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(InitTimingHost);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.seen).toEqual({
      layout: 'a | b | c',
      columns: [30, 30, 40],
    });
  });
});

const viewport = signal<MlvBreakpoint>('md');

@Component({
  imports: [MlvSplitPane, MlvSplitPanePanel, MlvBreakpointUp],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mlv-split-pane>
      <mlv-split-pane-panel [size]="30" data-id="nav">nav</mlv-split-pane-panel>
      <mlv-split-pane-panel data-id="main">main</mlv-split-pane-panel>
      <mlv-split-pane-panel *mlvBreakpointUp="'lg'" [size]="25" data-id="aside"
        >aside</mlv-split-pane-panel
      >
    </mlv-split-pane>
  `,
})
class BreakpointHost {}

@Component({
  imports: [MlvSplitPane, MlvSplitPanePanel, MlvBreakpointUp],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mlv-split-pane>
      <mlv-split-pane-panel [size]="30" data-id="nav">nav</mlv-split-pane-panel>
      <mlv-split-pane-panel data-id="main">main</mlv-split-pane-panel>
      <mlv-split-pane-panel *mlvBreakpointUp="'lg'" data-id="aside"
        >aside</mlv-split-pane-panel
      >
    </mlv-split-pane>
  `,
})
class SizelessBreakpointHost {}

describe('MlvSplitPane — a panel stamped without refreshing its host (#359)', () => {
  afterEach(() => viewport.set('md'));

  it('lays a sizeless `*mlvBreakpointUp` panel present at init out with the rest', async () => {
    // The directive stamps the panel from its own effect, which runs after the
    // split pane's: a first layout taken by the split pane's effect saw
    // `nav | main` alone and carved aside out of it (30 / 36.67 / 33.33).
    viewport.set('lg');
    await TestBed.configureTestingModule({
      imports: [SizelessBreakpointHost],
      providers: [
        { provide: MlvBreakpointService, useValue: { breakpoint: viewport } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(SizelessBreakpointHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const pane = fixture.debugElement.query(By.directive(MlvSplitPane))
      .nativeElement as HTMLElement;

    expect(layout(pane)).toBe('nav | main | aside');
    expect(tracks(pane, 'grid-template-columns')).toEqual([30, 35, 35]);
  });

  it('follows a `*mlvBreakpointUp` panel the host view never re-renders for', async () => {
    await TestBed.configureTestingModule({
      imports: [BreakpointHost],
      providers: [
        { provide: MlvBreakpointService, useValue: { breakpoint: viewport } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(BreakpointHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const pane = fixture.debugElement.query(By.directive(MlvSplitPane))
      .nativeElement as HTMLElement;
    expect(layout(pane)).toBe('nav | main');

    // A viewport change: the directive's own effect stamps the panel, and the
    // OnPush host view is only traversed, never refreshed, so no content hook
    // of the split pane runs. No `fixture.detectChanges()` here on purpose —
    // it would refresh the host and hide exactly that.
    viewport.set('lg');
    await fixture.whenStable();

    expect(layout(pane)).toBe('nav | main | aside');
    expect(tracks(pane, 'grid-template-columns')).toEqual([30, 45, 25]);

    viewport.set('md');
    await fixture.whenStable();

    expect(layout(pane)).toBe('nav | main');
    expect(tracks(pane, 'grid-template-columns')).toEqual([30, 70]);
  });
});

/**
 * Stamps its template once and detaches the view from change detection, so
 * the panel inside is created and queried but its inputs are never bound and
 * its `ngOnInit` never runs.
 */
@Directive({ selector: '[mlvTestDetached]' })
class MlvTestDetached implements OnInit {
  private readonly _viewContainer = inject(ViewContainerRef);
  private readonly _template = inject(TemplateRef);

  ngOnInit(): void {
    this._viewContainer.createEmbeddedView(this._template).detach();
  }
}

@Component({
  imports: [MlvSplitPane, MlvSplitPanePanel, MlvBreakpointUp, MlvTestDetached],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mlv-split-pane>
      <mlv-split-pane-panel [size]="30" data-id="a">a</mlv-split-pane-panel>
      <mlv-split-pane-panel *mlvTestDetached [size]="50" data-id="b"
        >b</mlv-split-pane-panel
      >
      <mlv-split-pane-panel data-id="d">d</mlv-split-pane-panel>
      <mlv-split-pane-panel *mlvBreakpointUp="'lg'" [size]="20" data-id="e"
        >e</mlv-split-pane-panel
      >
    </mlv-split-pane>
  `,
})
class DetachedHost {}

describe('MlvSplitPane — a panel whose view is detached (#359)', () => {
  afterEach(() => viewport.set('md'));

  it('is laid out with its unbound defaults, as `ngAfterContentInit` did, and does not block a later change', async () => {
    await TestBed.configureTestingModule({
      imports: [DetachedHost],
      providers: [
        { provide: MlvBreakpointService, useValue: { breakpoint: viewport } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(DetachedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const pane = fixture.debugElement.query(By.directive(MlvSplitPane))
      .nativeElement as HTMLElement;

    // b's `[size]="50"` never binds, so it takes an equal share with d.
    expect(layout(pane)).toBe('a | b | d');
    expect(tracks(pane, 'grid-template-columns')).toEqual([30, 35, 35]);

    // A panel stamped without refreshing the OnPush host: only the effect
    // sees it, and b — laid out already — must not make it wait for inputs
    // that never arrive.
    viewport.set('lg');
    await fixture.whenStable();

    expect(layout(pane)).toBe('a | b | d | e');
    // e asks for its 20 and takes it from d, its nearest panel before it.
    expect(tracks(pane, 'grid-template-columns')).toEqual([30, 35, 15, 20]);
  });
});
