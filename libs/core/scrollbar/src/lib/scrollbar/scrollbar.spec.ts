/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MlvScrollbar } from './scrollbar';
import {
  i18nTestProvider,
  provideMlvI18nTesting,
} from '@malva-ui/i18n/testing';
import { MLV_SCROLLBAR_I18N } from '@malva-ui/i18n';

/**
 * Mock ResizeObserver — not available in JSDOM. The callbacks are recorded so a
 * spec can drive `_updateGeometry` and produce a genuine overflow state.
 */
const resizeCallbacks: ResizeObserverCallback[] = [];

/**
 * Every element passed to `observe()`, in call order, across all instances.
 * The component attaches exactly one observer, so this doubles as "what the
 * live observer watches" — asserted by the `--mlv-sb-edge-*` tests, which turn
 * on the tracks being watched at all rather than on a fabricated notification.
 */
const resizeObserved: Element[] = [];

globalThis.ResizeObserver = class implements ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallbacks.push(callback);
  }
  readonly observe = vi.fn((target: Element) => {
    resizeObserved.push(target);
  });
  readonly unobserve = vi.fn();
  readonly disconnect = vi.fn();
};

describe('MlvScrollbar', () => {
  let fixture: ComponentFixture<MlvScrollbar>;
  let component: MlvScrollbar;
  let hostEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvScrollbar],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvScrollbar);
    component = fixture.componentInstance;
    hostEl = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  // ---------------------------------------------------------------------------
  // Creation
  // ---------------------------------------------------------------------------

  describe('creation', () => {
    it('should create without error', () => {
      expect(component).toBeTruthy();
    });

    it('should apply mlv-scrollbar class to host', () => {
      expect(hostEl.classList).toContain('mlv-scrollbar');
    });
  });

  // ---------------------------------------------------------------------------
  // Default inputs
  // ---------------------------------------------------------------------------

  describe('default inputs', () => {
    it('should default orientation to vertical', () => {
      expect(component.orientation()).toBe('vertical');
    });

    it('should default scrollbarSize to 0.75rem', () => {
      expect(component.scrollbarSize()).toBe('0.75rem');
    });

    it('should default disabled to false', () => {
      expect(component.disabled()).toBe(false);
    });

    it('should leave the ariaLabel override unset by default', () => {
      expect(component.ariaLabel()).toBeUndefined();
    });

    it('should default viewportTabIndex to null (no attribute, no opinion)', () => {
      expect(component.viewportTabIndex()).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Orientation — _showVertical / _showHorizontal computed
  // ---------------------------------------------------------------------------

  describe('orientation', () => {
    it('should show vertical and hide horizontal when orientation is vertical (default)', () => {
      fixture.componentRef.setInput('orientation', 'vertical');
      fixture.detectChanges();

      // Access protected signals via bracket notation
      expect((component as any)['_showVertical']()).toBe(true);
      expect((component as any)['_showHorizontal']()).toBe(false);
    });

    it('should hide vertical and show horizontal when orientation is horizontal', () => {
      fixture.componentRef.setInput('orientation', 'horizontal');
      fixture.detectChanges();

      expect((component as any)['_showVertical']()).toBe(false);
      expect((component as any)['_showHorizontal']()).toBe(true);
    });

    it('should show both tracks when orientation is both', () => {
      fixture.componentRef.setInput('orientation', 'both');
      fixture.detectChanges();

      expect((component as any)['_showVertical']()).toBe(true);
      expect((component as any)['_showHorizontal']()).toBe(true);
    });

    it('should hide vertical track in DOM when orientation is horizontal', () => {
      fixture.componentRef.setInput('orientation', 'horizontal');
      fixture.detectChanges();

      const vTrack = fixture.debugElement.query(
        By.css('.mlv-scrollbar__track--vertical'),
      );
      expect(vTrack.nativeElement.classList).toContain(
        'mlv-scrollbar__track--hidden',
      );
    });

    it('should hide horizontal track in DOM when orientation is vertical', () => {
      fixture.detectChanges();

      const hTrack = fixture.debugElement.query(
        By.css('.mlv-scrollbar__track--horizontal'),
      );
      expect(hTrack.nativeElement.classList).toContain(
        'mlv-scrollbar__track--hidden',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Disabled input
  // ---------------------------------------------------------------------------

  describe('disabled input', () => {
    it('should add mlv-scrollbar--disabled class when disabled is true', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();

      expect(hostEl.classList).toContain('mlv-scrollbar--disabled');
    });

    it('should not have mlv-scrollbar--disabled class when disabled is false', () => {
      fixture.componentRef.setInput('disabled', false);
      fixture.detectChanges();

      expect(hostEl.classList).not.toContain('mlv-scrollbar--disabled');
    });

    it('should coerce string "true" to true for disabled', () => {
      fixture.componentRef.setInput('disabled', 'true');
      fixture.detectChanges();

      expect(component.disabled()).toBe(true);
      expect(hostEl.classList).toContain('mlv-scrollbar--disabled');
    });

    it('should coerce empty string to true for disabled (attribute syntax)', () => {
      fixture.componentRef.setInput('disabled', '');
      fixture.detectChanges();

      expect(component.disabled()).toBe(true);
      expect(hostEl.classList).toContain('mlv-scrollbar--disabled');
    });

    it('should hide both tracks when disabled', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();

      expect((component as any)['_showVertical']()).toBe(false);
      expect((component as any)['_showHorizontal']()).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Track aria-hidden
  // ---------------------------------------------------------------------------

  describe('tracks aria-hidden', () => {
    it('should have aria-hidden="true" on the vertical track', () => {
      const vTrack = fixture.debugElement.query(
        By.css('.mlv-scrollbar__track--vertical'),
      );
      expect(vTrack.nativeElement.getAttribute('aria-hidden')).toBe('true');
    });

    it('should have aria-hidden="true" on the horizontal track', () => {
      const hTrack = fixture.debugElement.query(
        By.css('.mlv-scrollbar__track--horizontal'),
      );
      expect(hTrack.nativeElement.getAttribute('aria-hidden')).toBe('true');
    });
  });

  // ---------------------------------------------------------------------------
  // scrollbarSize CSS custom property
  // ---------------------------------------------------------------------------

  describe('scrollbarSize host style', () => {
    it('should set --mlv-sb-size CSS custom property on host with default value', () => {
      fixture.detectChanges();
      const sbSize = hostEl.style.getPropertyValue('--mlv-sb-size');
      expect(sbSize).toBe('0.75rem');
    });

    it('should update --mlv-sb-size when scrollbarSize input changes', () => {
      fixture.componentRef.setInput('scrollbarSize', '1rem');
      fixture.detectChanges();

      const sbSize = hostEl.style.getPropertyValue('--mlv-sb-size');
      expect(sbSize).toBe('1rem');
    });
  });

  // ---------------------------------------------------------------------------
  // Template structure
  // ---------------------------------------------------------------------------

  describe('template structure', () => {
    it('should render viewport element', () => {
      const viewport = fixture.debugElement.query(
        By.css('.mlv-scrollbar__viewport'),
      );
      expect(viewport).toBeTruthy();
    });

    it('should render content wrapper inside viewport', () => {
      const content = fixture.debugElement.query(
        By.css('.mlv-scrollbar__content'),
      );
      expect(content).toBeTruthy();
    });

    it('should render both track elements in the DOM', () => {
      const tracks = fixture.debugElement.queryAll(
        By.css('.mlv-scrollbar__track'),
      );
      expect(tracks.length).toBe(2);
    });

    it('should render a thumb inside the vertical track', () => {
      const vTrack = fixture.debugElement.query(
        By.css('.mlv-scrollbar__track--vertical'),
      );
      const thumb = vTrack.query(By.css('.mlv-scrollbar__thumb'));
      expect(thumb).toBeTruthy();
    });

    it('should render a thumb inside the horizontal track', () => {
      const hTrack = fixture.debugElement.query(
        By.css('.mlv-scrollbar__track--horizontal'),
      );
      const thumb = hTrack.query(By.css('.mlv-scrollbar__thumb'));
      expect(thumb).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  // _onScroll sets _isScrolling
  // ---------------------------------------------------------------------------

  describe('_onScroll()', () => {
    it('should set _isScrolling to true when _onScroll is called', () => {
      expect((component as any)['_isScrolling']()).toBe(false);

      (component as any)['_onScroll']();

      expect((component as any)['_isScrolling']()).toBe(true);
    });

    it('should add mlv-scrollbar--scrolling class on host while scrolling', () => {
      (component as any)['_onScroll']();
      fixture.detectChanges();

      expect(hostEl.classList).toContain('mlv-scrollbar--scrolling');
    });
  });

  // ---------------------------------------------------------------------------
  // _isScrolling clears after timeout
  // ---------------------------------------------------------------------------

  describe('_isScrolling timeout', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('should clear _isScrolling after 150ms idle', () => {
      vi.useFakeTimers();

      (component as any)['_onScroll']();
      expect((component as any)['_isScrolling']()).toBe(true);

      vi.advanceTimersByTime(150);

      expect((component as any)['_isScrolling']()).toBe(false);
    });

    it('should reset the timeout if _onScroll is called again before 150ms', () => {
      vi.useFakeTimers();

      (component as any)['_onScroll']();
      vi.advanceTimersByTime(100);

      // Call again — timeout should restart
      (component as any)['_onScroll']();
      vi.advanceTimersByTime(100);

      // Only 100ms elapsed since last call — still scrolling
      expect((component as any)['_isScrolling']()).toBe(true);

      vi.advanceTimersByTime(50);

      // Now 150ms have elapsed since last call — should be cleared
      expect((component as any)['_isScrolling']()).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // _isDragging host class
  // ---------------------------------------------------------------------------

  describe('_isDragging', () => {
    it('should not have mlv-scrollbar--dragging class by default', () => {
      fixture.detectChanges();
      expect(hostEl.classList).not.toContain('mlv-scrollbar--dragging');
    });

    it('should add mlv-scrollbar--dragging class when _isDragging is set to true', () => {
      (component as any)['_isDragging'].set(true);
      fixture.detectChanges();

      expect(hostEl.classList).toContain('mlv-scrollbar--dragging');
    });
  });
});

// ---------------------------------------------------------------------------
// viewportTabIndex — pure passthrough (no auto mode, no content inspection)
// ---------------------------------------------------------------------------

@Component({
  imports: [MlvScrollbar, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #body>
      @if (withControls()) {
        <button class="projected-button">Act</button>
      }
      <p class="projected-passage">A long passage.</p>
    </ng-template>

    @if (bindTabIndex()) {
      <mlv-scrollbar
        [viewportTabIndex]="tabIndex()"
        [ariaLabel]="ariaLabel()"
        style="height: 6rem"
      >
        <ng-container [ngTemplateOutlet]="body" />
      </mlv-scrollbar>
    } @else {
      <!-- No viewportTabIndex binding at all — exercises the input default. -->
      <mlv-scrollbar [ariaLabel]="ariaLabel()" style="height: 6rem">
        <ng-container [ngTemplateOutlet]="body" />
      </mlv-scrollbar>
    }
  `,
})
class ScrollbarTabIndexHostComponent {
  /** When false the `viewportTabIndex` binding is omitted entirely. */
  readonly bindTabIndex = signal(false);
  readonly tabIndex = signal<-1 | 0 | null>(null);
  readonly ariaLabel = signal<string | undefined>(undefined);
  readonly withControls = signal(false);
}

describe('MlvScrollbar — viewportTabIndex passthrough', () => {
  let fixture: ComponentFixture<ScrollbarTabIndexHostComponent>;
  let host: ScrollbarTabIndexHostComponent;

  beforeEach(async () => {
    resizeCallbacks.length = 0;
    resizeObserved.length = 0;

    await TestBed.configureTestingModule({
      imports: [ScrollbarTabIndexHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ScrollbarTabIndexHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function viewport(): HTMLElement {
    return fixture.nativeElement.querySelector(
      '.mlv-scrollbar__viewport',
    ) as HTMLElement;
  }

  /**
   * JSDOM has no layout, so overflow is produced by stubbing the viewport
   * metrics and replaying the ResizeObserver callback the component
   * registered — `_hasVerticalOverflow` is then set by the real
   * `_updateGeometry`, exactly as it is in a browser.
   */
  async function setOverflow(overflowing: boolean): Promise<void> {
    // Let `afterNextRender` register the observer for the current instance.
    await fixture.whenStable();

    const viewportEl = viewport();
    // Give the tracks a resolvable padding so the thumb maths stays finite.
    for (const track of Array.from(
      fixture.nativeElement.querySelectorAll<HTMLElement>(
        '.mlv-scrollbar__track',
      ),
    )) {
      track.style.padding = '4px';
    }
    Object.defineProperty(viewportEl, 'clientHeight', {
      value: 100,
      configurable: true,
    });
    Object.defineProperty(viewportEl, 'scrollHeight', {
      value: overflowing ? 2000 : 100,
      configurable: true,
    });

    // Only the most recently registered callback belongs to the live instance.
    const callback = resizeCallbacks.at(-1);
    expect(callback).toBeDefined();
    callback?.([], {} as ResizeObserver);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function scrollbarInstance(): MlvScrollbar {
    return fixture.debugElement.query(By.directive(MlvScrollbar))
      .componentInstance as MlvScrollbar;
  }

  function expectSilentViewport(): void {
    // `hasAttribute`, not `getAttribute(...) === null` — an empty-string
    // attribute (`tabindex=""`) must not be able to pass this.
    expect(viewport().hasAttribute('tabindex')).toBe(false);
    expect(viewport().hasAttribute('role')).toBe(false);
    expect(viewport().hasAttribute('aria-label')).toBe(false);
  }

  // -- Case 1: default (null) ------------------------------------------------

  it('emits no tabindex, role or aria-label by default', () => {
    expectSilentViewport();
  });

  it('stays silent by default with no overflow and no focusable content', async () => {
    host.withControls.set(false);
    fixture.detectChanges();
    await setOverflow(false);

    expect((scrollbarInstance() as any)['_hasVerticalOverflow']()).toBe(false);
    expectSilentViewport();
  });

  it('stays silent by default with no overflow and focusable content', async () => {
    host.withControls.set(true);
    fixture.detectChanges();
    await setOverflow(false);

    expect(
      fixture.nativeElement.querySelector('.projected-button'),
    ).toBeTruthy();
    expect((scrollbarInstance() as any)['_hasVerticalOverflow']()).toBe(false);
    expectSilentViewport();
  });

  it('stays silent by default with overflow and no focusable content', async () => {
    host.withControls.set(false);
    fixture.detectChanges();
    await setOverflow(true);

    expect((scrollbarInstance() as any)['_hasVerticalOverflow']()).toBe(true);
    expectSilentViewport();
  });

  it('stays silent by default with overflow and focusable content', async () => {
    host.withControls.set(true);
    fixture.detectChanges();
    await setOverflow(true);

    expect(
      fixture.nativeElement.querySelector('.projected-button'),
    ).toBeTruthy();
    expect((scrollbarInstance() as any)['_hasVerticalOverflow']()).toBe(true);
    expectSilentViewport();
  });

  it('stays silent by default after the projected content gains a control', async () => {
    expectSilentViewport();

    host.withControls.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    // A content-mutation observer would have re-decided here; nothing does.
    await Promise.resolve();
    fixture.detectChanges();

    expectSilentViewport();
  });

  // -- Case 2: explicit 0 ----------------------------------------------------

  it('applies tabindex="0" verbatim, with role="group" and the i18n label', async () => {
    host.bindTabIndex.set(true);
    host.tabIndex.set(0);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(viewport().getAttribute('tabindex')).toBe('0');
    expect(viewport().getAttribute('role')).toBe('group');
    expect(viewport().getAttribute('aria-label')).toBe('Scrollable region');
  });

  it('keeps tabindex="0" and the name when the content is focusable', async () => {
    host.bindTabIndex.set(true);
    host.tabIndex.set(0);
    host.withControls.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(viewport().getAttribute('tabindex')).toBe('0');
    expect(viewport().getAttribute('role')).toBe('group');
    expect(viewport().getAttribute('aria-label')).toBe('Scrollable region');
  });

  it('keeps tabindex="0" and the name whether or not the content overflows', async () => {
    host.bindTabIndex.set(true);
    host.tabIndex.set(0);
    fixture.detectChanges();

    await setOverflow(true);
    expect((scrollbarInstance() as any)['_hasVerticalOverflow']()).toBe(true);
    expect(viewport().getAttribute('tabindex')).toBe('0');
    expect(viewport().getAttribute('role')).toBe('group');

    await setOverflow(false);
    expect((scrollbarInstance() as any)['_hasVerticalOverflow']()).toBe(false);
    expect(viewport().getAttribute('tabindex')).toBe('0');
    expect(viewport().getAttribute('role')).toBe('group');
  });

  it('prefers an explicit ariaLabel over the i18n default at tabindex="0"', async () => {
    host.bindTabIndex.set(true);
    host.tabIndex.set(0);
    host.ariaLabel.set('Chat messages');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(viewport().getAttribute('aria-label')).toBe('Chat messages');
  });

  it('never exposes a landmark role (a scroll wrapper is not a page region)', async () => {
    host.bindTabIndex.set(true);
    host.tabIndex.set(0);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(viewport().getAttribute('role')).not.toBe('region');
  });

  // -- Case 3: explicit -1 ---------------------------------------------------

  it('applies tabindex="-1" verbatim, with no role and no name', async () => {
    host.bindTabIndex.set(true);
    host.tabIndex.set(-1);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(viewport().getAttribute('tabindex')).toBe('-1');
    expect(viewport().hasAttribute('role')).toBe(false);
    expect(viewport().hasAttribute('aria-label')).toBe(false);
  });

  it('keeps tabindex="-1" nameless even when an ariaLabel is supplied', async () => {
    host.bindTabIndex.set(true);
    host.tabIndex.set(-1);
    host.ariaLabel.set('Conversation details');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(viewport().getAttribute('tabindex')).toBe('-1');
    expect(viewport().hasAttribute('role')).toBe(false);
    expect(viewport().hasAttribute('aria-label')).toBe(false);
  });

  it('keeps tabindex="-1" whether or not the content overflows or is focusable', async () => {
    host.bindTabIndex.set(true);
    host.tabIndex.set(-1);
    host.withControls.set(true);
    fixture.detectChanges();
    await setOverflow(true);

    expect(viewport().getAttribute('tabindex')).toBe('-1');
    expect(viewport().hasAttribute('role')).toBe(false);
  });

  // -- Case 1/3: the resolved label never leaks -------------------------------

  it('does not leak an explicit ariaLabel into the default (null) case', () => {
    host.ariaLabel.set('Conversation details');
    fixture.detectChanges();

    expectSilentViewport();
  });

  // -- Case 5: runtime flips -------------------------------------------------

  it('flips the attributes in both directions when the input changes', async () => {
    host.bindTabIndex.set(true);
    host.tabIndex.set(null);
    fixture.detectChanges();
    await fixture.whenStable();
    expectSilentViewport();

    host.tabIndex.set(0);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(viewport().getAttribute('tabindex')).toBe('0');
    expect(viewport().getAttribute('role')).toBe('group');
    expect(viewport().getAttribute('aria-label')).toBe('Scrollable region');

    host.bindTabIndex.set(true);
    host.tabIndex.set(-1);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(viewport().getAttribute('tabindex')).toBe('-1');
    expect(viewport().hasAttribute('role')).toBe(false);
    expect(viewport().hasAttribute('aria-label')).toBe(false);

    host.bindTabIndex.set(true);
    host.tabIndex.set(0);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(viewport().getAttribute('tabindex')).toBe('0');
    expect(viewport().getAttribute('role')).toBe('group');

    host.bindTabIndex.set(true);
    host.tabIndex.set(null);
    fixture.detectChanges();
    await fixture.whenStable();
    expectSilentViewport();
  });
});

// ---------------------------------------------------------------------------
// Regression guard: the content-tabbability scan must stay deleted
// ---------------------------------------------------------------------------

describe('MlvScrollbar — no content observation', () => {
  it('never constructs a MutationObserver across a full lifecycle', async () => {
    const RealMutationObserver = globalThis.MutationObserver;
    const constructed = vi.fn();

    class SpyMutationObserver extends RealMutationObserver {
      constructor(callback: MutationCallback) {
        constructed();
        super(callback);
      }
    }

    globalThis.MutationObserver =
      SpyMutationObserver as unknown as typeof MutationObserver;

    try {
      await TestBed.configureTestingModule({
        imports: [ScrollbarTabIndexHostComponent],
        providers: [provideMlvI18nTesting()],
      }).compileComponents();

      const fixture = TestBed.createComponent(ScrollbarTabIndexHostComponent);
      fixture.detectChanges();
      await fixture.whenStable();

      // Mutate the projected content — the deleted observer watched exactly
      // this (childList/subtree plus the tabindex/disabled/hidden attributes).
      fixture.componentInstance.withControls.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.nativeElement
        .querySelector('.projected-button')
        ?.setAttribute('disabled', '');
      await Promise.resolve();
      fixture.detectChanges();
      await fixture.whenStable();

      fixture.destroy();

      expect(constructed).not.toHaveBeenCalled();
    } finally {
      globalThis.MutationObserver = RealMutationObserver;
    }
  });
});

// ---------------------------------------------------------------------------
// The i18n label — distinguishable from the hardcoded fallback
// ---------------------------------------------------------------------------

describe('MlvScrollbar — i18n viewport label', () => {
  let fixture: ComponentFixture<ScrollbarTabIndexHostComponent>;
  let host: ScrollbarTabIndexHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScrollbarTabIndexHostComponent],
      providers: [
        provideMlvI18nTesting(),
        i18nTestProvider(MLV_SCROLLBAR_I18N, {
          scrollableRegion: 'Zone défilable',
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ScrollbarTabIndexHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function viewport(): HTMLElement {
    return fixture.nativeElement.querySelector(
      '.mlv-scrollbar__viewport',
    ) as HTMLElement;
  }

  it('names a tabindex="0" viewport from the i18n token, not a hardcoded string', async () => {
    host.bindTabIndex.set(true);
    host.tabIndex.set(0);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(viewport().getAttribute('aria-label')).toBe('Zone défilable');
  });

  it('does not leak the i18n label into the default (null) case', () => {
    expect(viewport().hasAttribute('aria-label')).toBe(false);
    expect(viewport().hasAttribute('role')).toBe(false);
  });

  it('does not leak the i18n label into the -1 case', async () => {
    host.bindTabIndex.set(true);
    host.tabIndex.set(-1);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(viewport().hasAttribute('aria-label')).toBe(false);
    expect(viewport().hasAttribute('role')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Track-metric caching — perf guards + geometry correctness
//
// `_updateThumbPositions()` runs on every scroll event. It used to read
// `getComputedStyle(track).padding*` (forces a style recalculation) and
// `track.offsetHeight` / `offsetWidth` (forces a layout) on every call, per
// axis. Both inputs are static between resizes, so they are now cached.
// ---------------------------------------------------------------------------

/** Viewport scroll state stubbed onto the real element (JSDOM has no layout). */
interface ViewportState {
  clientHeight: number;
  scrollHeight: number;
  scrollTop: number;
  clientWidth: number;
  scrollWidth: number;
  scrollLeft: number;
}

/** Counted DOM reads, split per axis so cross-axis leakage is visible. */
interface TrackReads {
  /** `getComputedStyle(verticalTrack)` calls. */
  vStyle: number;
  /** `verticalTrack.offsetHeight` reads. */
  vOffset: number;
  /** `getComputedStyle(horizontalTrack)` calls. */
  hStyle: number;
  /** `horizontalTrack.offsetWidth` reads. */
  hOffset: number;
}

interface CachingHarness {
  fixture: ComponentFixture<MlvScrollbar>;
  component: MlvScrollbar;
  viewportEl: HTMLElement;
  trackV: HTMLElement;
  trackH: HTMLElement;
  state: ViewportState;
  /** Rendered track extent along each track's own scroll axis, in px. */
  extent: { vertical: number; horizontal: number };
  reads: TrackReads;
  resetReads: () => void;
  /** Replays the component's ResizeObserver callback → real `_updateGeometry`. */
  resize: () => Promise<void>;
  /**
   * Replays the same callback with entries whose targets are the two **tracks**
   * — what the browser delivers when only a track's own box moved, e.g. because
   * `--mlv-sb-edge-padding` / `--mlv-sb-edge-gap` were re-resolved.
   */
  resizeTracks: () => Promise<void>;
  /** Dispatches a native scroll event on the viewport → real `_onScroll`. */
  scroll: () => void;
  /** Reads a protected thumb signal. */
  thumb: (
    name: '_thumbTop' | '_thumbHeight' | '_thumbLeft' | '_thumbWidth',
  ) => number;
}

describe('MlvScrollbar — track metric caching', () => {
  const TRACK_PADDING_PX = 4;
  /** Width the corner-avoidance rule removes from a track while the other is shown. */
  const CORNER_INSET_PX = 12;

  let originalGetComputedStyle: typeof globalThis.getComputedStyle;
  let harness: CachingHarness | null = null;

  beforeEach(() => {
    resizeCallbacks.length = 0;
    resizeObserved.length = 0;
    originalGetComputedStyle = globalThis.getComputedStyle;
  });

  afterEach(() => {
    globalThis.getComputedStyle = originalGetComputedStyle;
    harness?.fixture.destroy();
    harness = null;
  });

  /**
   * Builds a scrollbar whose track extents and viewport scroll state are fully
   * controlled, and which counts every style/layout read the component makes
   * against a track element.
   *
   * `offsetHeight`/`offsetWidth` return `0` while the track carries
   * `--hidden`, exactly as a `display: none` element does in a browser — that
   * is what makes the hidden → visible transition reproducible here.
   */
  async function createHarness(
    orientation: 'vertical' | 'horizontal' | 'both',
    initial: Partial<ViewportState> = {},
  ): Promise<CachingHarness> {
    await TestBed.configureTestingModule({
      imports: [MlvScrollbar],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    const fixture = TestBed.createComponent(MlvScrollbar);
    fixture.componentRef.setInput('orientation', orientation);
    fixture.detectChanges();
    await fixture.whenStable();

    const root: HTMLElement = fixture.nativeElement;
    const viewportEl = root.querySelector(
      '.mlv-scrollbar__viewport',
    ) as HTMLElement;
    const trackV = root.querySelector(
      '.mlv-scrollbar__track--vertical',
    ) as HTMLElement;
    const trackH = root.querySelector(
      '.mlv-scrollbar__track--horizontal',
    ) as HTMLElement;

    // Real inline padding, so getComputedStyle resolves a real length.
    trackV.style.padding = `${TRACK_PADDING_PX}px 0`;
    trackH.style.padding = `0 ${TRACK_PADDING_PX}px`;

    const state: ViewportState = {
      clientHeight: 100,
      scrollHeight: 100,
      scrollTop: 0,
      clientWidth: 100,
      scrollWidth: 100,
      scrollLeft: 0,
      ...initial,
    };
    for (const key of Object.keys(state) as (keyof ViewportState)[]) {
      Object.defineProperty(viewportEl, key, {
        get: () => state[key],
        set: (value: number) => {
          state[key] = value;
        },
        configurable: true,
      });
    }

    const extent = { vertical: 200, horizontal: 300 };
    const reads: TrackReads = { vStyle: 0, vOffset: 0, hStyle: 0, hOffset: 0 };
    const hidden = (el: HTMLElement): boolean =>
      el.classList.contains('mlv-scrollbar__track--hidden');

    Object.defineProperty(trackV, 'offsetHeight', {
      get: () => {
        reads.vOffset++;
        return hidden(trackV) ? 0 : extent.vertical;
      },
      configurable: true,
    });
    Object.defineProperty(trackH, 'offsetWidth', {
      get: () => {
        reads.hOffset++;
        return hidden(trackH) ? 0 : extent.horizontal;
      },
      configurable: true,
    });

    globalThis.getComputedStyle = ((
      el: Element,
      pseudoElt?: string | null,
    ): CSSStyleDeclaration => {
      if (el === trackV) {
        reads.vStyle++;
      } else if (el === trackH) {
        reads.hStyle++;
      }
      return originalGetComputedStyle.call(
        globalThis,
        el,
        pseudoElt,
      ) as CSSStyleDeclaration;
    }) as typeof globalThis.getComputedStyle;

    const built: CachingHarness = {
      fixture,
      component: fixture.componentInstance,
      viewportEl,
      trackV,
      trackH,
      state,
      extent,
      reads,
      resetReads: () => {
        reads.vStyle = 0;
        reads.vOffset = 0;
        reads.hStyle = 0;
        reads.hOffset = 0;
      },
      resizeTracks: async () => {
        const callback = resizeCallbacks.at(-1);
        expect(callback).toBeDefined();
        callback?.(
          [trackV, trackH].map(
            (target) => ({ target }) as unknown as ResizeObserverEntry,
          ),
          {} as ResizeObserver,
        );
        fixture.detectChanges();
        await fixture.whenStable();
      },
      resize: async () => {
        const callback = resizeCallbacks.at(-1);
        expect(callback).toBeDefined();
        callback?.([], {} as ResizeObserver);
        fixture.detectChanges();
        await fixture.whenStable();
      },
      scroll: () => {
        viewportEl.dispatchEvent(new Event('scroll'));
      },
      thumb: (name) => (fixture.componentInstance as any)[name]() as number,
    };

    harness = built;
    return built;
  }

  // -------------------------------------------------------------------------
  // 1. Call-count guard — getComputedStyle
  // -------------------------------------------------------------------------

  describe('getComputedStyle call count on the scroll fast path', () => {
    it('reads track styles at most once per axis across many scrolls', async () => {
      const h = await createHarness('both', {
        scrollHeight: 400,
        scrollWidth: 600,
        clientWidth: 150,
      });
      await h.resize();
      h.resetReads();

      // 10 scroll events over an unchanged layout.
      const SCROLLS = 10;
      for (let i = 0; i < SCROLLS; i++) {
        h.state.scrollTop = i * 10;
        h.state.scrollLeft = i * 10;
        h.scroll();
      }

      // Bound derivation: the layout never changes during the burst, so each
      // axis needs at most ONE measurement — the one that refills the cache
      // `_updateGeometry()` invalidated. 2 axes → 2 calls, for any number of
      // scrolls. The uncached implementation makes SCROLLS × 2 = 20.
      expect(h.reads.vStyle + h.reads.hStyle).toBeLessThanOrEqual(2);
      expect(h.reads.vStyle).toBeLessThanOrEqual(1);
      expect(h.reads.hStyle).toBeLessThanOrEqual(1);
      // And the count must not scale with the number of scroll events.
      expect(h.reads.vStyle + h.reads.hStyle).toBeLessThan(SCROLLS);
    });

    it('does not grow the call count as more scrolls arrive', async () => {
      const h = await createHarness('vertical', { scrollHeight: 400 });
      await h.resize();
      h.resetReads();

      for (let i = 0; i < 5; i++) {
        h.state.scrollTop = i;
        h.scroll();
      }
      const afterFive = h.reads.vStyle;

      for (let i = 5; i < 40; i++) {
        h.state.scrollTop = i;
        h.scroll();
      }

      // 35 further scrolls must add nothing at all.
      expect(h.reads.vStyle).toBe(afterFive);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Layout-read guard — offsetHeight / offsetWidth
  // -------------------------------------------------------------------------

  describe('forced-layout reads on the scroll fast path', () => {
    it('reads track offsetHeight/offsetWidth at most once per axis across many scrolls', async () => {
      const h = await createHarness('both', {
        scrollHeight: 400,
        scrollWidth: 600,
        clientWidth: 150,
      });
      await h.resize();
      h.resetReads();

      const SCROLLS = 10;
      for (let i = 0; i < SCROLLS; i++) {
        h.state.scrollTop = i * 10;
        h.state.scrollLeft = i * 10;
        h.scroll();
      }

      // Same derivation as the getComputedStyle bound: one refill per axis,
      // never one per scroll event (which would be SCROLLS × 2 = 20).
      expect(h.reads.vOffset + h.reads.hOffset).toBeLessThanOrEqual(2);
      expect(h.reads.vOffset).toBeLessThanOrEqual(1);
      expect(h.reads.hOffset).toBeLessThanOrEqual(1);
      expect(h.reads.vOffset + h.reads.hOffset).toBeLessThan(SCROLLS);
    });

    it('performs zero layout reads once the cache is warm', async () => {
      const h = await createHarness('vertical', { scrollHeight: 400 });
      await h.resize();
      // Warm the cache with one scroll, then count the next twenty.
      h.scroll();
      h.resetReads();

      for (let i = 0; i < 20; i++) {
        h.state.scrollTop = i;
        h.scroll();
      }

      expect(h.reads.vOffset).toBe(0);
      expect(h.reads.vStyle).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Correctness after resize — the cache must not survive it
  // -------------------------------------------------------------------------

  describe('cache invalidation on resize', () => {
    it('recomputes thumb geometry when the track grows', async () => {
      const h = await createHarness('vertical', { scrollHeight: 400 });
      await h.resize();
      h.scroll();

      // extent 200, padding 4 → usable 192; ratio 100/400 → thumb 48.
      expect(h.thumb('_thumbHeight')).toBe(48);

      // The host got taller: viewport and track both grow.
      h.extent.vertical = 400;
      h.state.clientHeight = 200;
      await h.resize();
      h.scroll();

      // extent 400, padding 4 → usable 392; ratio 200/400 = 0.5 → thumb 196.
      expect(h.thumb('_thumbHeight')).toBe(196);
    });

    it('recomputes thumb geometry when only the content size changes', async () => {
      const h = await createHarness('vertical', { scrollHeight: 400 });
      await h.resize();
      h.scroll();
      expect(h.thumb('_thumbHeight')).toBe(48);

      // Content doubled — the track is unchanged, only the ratio moves.
      h.state.scrollHeight = 800;
      await h.resize();
      h.scroll();

      // usable 192; ratio 100/800 = 0.125 → 24 → clamped to the 32 minimum.
      expect(h.thumb('_thumbHeight')).toBe(32);
    });

    it('recomputes thumb geometry when the track shrinks', async () => {
      const h = await createHarness('vertical', { scrollHeight: 400 });
      await h.resize();
      h.scroll();
      expect(h.thumb('_thumbHeight')).toBe(48);

      h.extent.vertical = 100;
      await h.resize();
      h.scroll();

      // usable 92; ratio 0.25 → 23 → clamped to 32.
      expect(h.thumb('_thumbHeight')).toBe(32);
    });
  });

  // -------------------------------------------------------------------------
  // 3b. Invalidation when only the TRACK box moves (#69)
  // -------------------------------------------------------------------------

  describe('cache invalidation when only the track box changes', () => {
    it('watches both track elements, not only the scroller, viewport and content', async () => {
      const h = await createHarness('both', {
        scrollHeight: 400,
        scrollWidth: 600,
        clientWidth: 150,
      });

      // This is the whole defect: `--mlv-sb-edge-padding` and
      // `--mlv-sb-edge-gap` are consumer-facing custom properties, and a theme
      // swap or an ancestor class toggle re-resolves either without changing
      // the size of the viewport or the content wrapper. Those were the only
      // things observed, so nothing invalidated the cache and the thumb stayed
      // laid out against the old padding until the next genuine resize.
      //
      // The default `ResizeObserver` box is content-box, so watching the tracks
      // catches an edge-padding change (padding sits inside the track's border
      // box but outside its content box) as well as an edge-gap change (which
      // moves the track's own insets) and a root font-size change — both values
      // are rem, which is the second half of this ticket.
      //
      // Booleans, not the elements themselves: a failed assertion against a
      // DOM node makes vitest spend minutes pretty-printing it.
      expect(resizeObserved.includes(h.trackV)).toBe(true);
      expect(resizeObserved.includes(h.trackH)).toBe(true);
    });

    it('recomputes thumb geometry when the track padding changes with no viewport resize', async () => {
      const h = await createHarness('vertical', { scrollHeight: 400 });
      await h.resize();
      h.scroll();

      // extent 200, padding 4 → usable 192; ratio 100/400 → thumb 48.
      expect(h.thumb('_thumbHeight')).toBe(48);

      // Stands in for `--mlv-sb-edge-padding` being re-resolved. The viewport
      // and the content wrapper are untouched.
      h.trackV.style.padding = '20px 0';
      await h.resizeTracks();

      // extent 200, padding 20 → usable 160; ratio 0.25 → 40. No scroll event
      // is needed: the track-only branch re-lays the thumb itself, so the
      // change lands immediately rather than at the next scroll.
      expect(h.thumb('_thumbHeight')).toBe(40);
    });

    it('does not re-derive the overflow decision on a track-only notification', async () => {
      const h = await createHarness('vertical', { scrollHeight: 400 });
      await h.resize();
      expect((h.component as any)['_hasVerticalOverflow']()).toBe(true);

      // The content did not change; only the track's box did. Running the full
      // geometry pass here would re-read the viewport and rewrite the
      // visibility classes that size these very tracks — feeding the observer
      // back into itself, which is the `ResizeObserver loop completed with
      // undelivered notifications` risk that kept the tracks unobserved until
      // now. A track-only notification must therefore invalidate and re-lay
      // the thumb, and nothing else.
      //
      // A stale viewport reading is the observable proxy: if the overflow
      // decision is re-derived from it, it flips to false and the track picks
      // up `--hidden`.
      h.state.scrollHeight = 100;
      await h.resizeTracks();

      expect((h.component as any)['_hasVerticalOverflow']()).toBe(true);
      expect(h.trackV.classList.contains('mlv-scrollbar__track--hidden')).toBe(
        false,
      );
    });
  });

  // -------------------------------------------------------------------------
  // 4. THE TRAP — hidden → visible transition
  // -------------------------------------------------------------------------

  describe('hidden → visible transition', () => {
    it('does not cache the zero measured while the track is still display:none', async () => {
      // Starts with no overflow, so the track carries `--hidden`.
      const h = await createHarness('vertical', { scrollHeight: 100 });
      await h.resize();

      expect((h.component as any)['_hasVerticalOverflow']()).toBe(false);
      expect(h.trackV.classList).toContain('mlv-scrollbar__track--hidden');

      // Overflow appears. `_updateGeometry` sets the signal and measures
      // synchronously, before Angular re-renders the class binding — so the
      // track is still display:none and still measures 0 on this frame.
      h.state.scrollHeight = 400;
      await h.resize();

      expect((h.component as any)['_hasVerticalOverflow']()).toBe(true);
      expect(h.trackV.classList).not.toContain('mlv-scrollbar__track--hidden');

      // First read of the now-visible track.
      h.scroll();

      // extent 200, padding 4 → usable 192; ratio 100/400 → 48.
      // A cached zero would give usable = -8 → max(32, -2) = 32.
      expect(h.thumb('_thumbHeight')).toBe(48);
      expect(h.thumb('_thumbHeight')).not.toBe(32);
    });

    it('stays correct across repeated hide/show cycles', async () => {
      const h = await createHarness('vertical', { scrollHeight: 100 });
      await h.resize();

      for (let cycle = 0; cycle < 3; cycle++) {
        h.state.scrollHeight = 400;
        await h.resize();
        h.scroll();
        expect(h.thumb('_thumbHeight')).toBe(48);

        h.state.scrollHeight = 100;
        await h.resize();
        expect(h.trackV.classList).toContain('mlv-scrollbar__track--hidden');
      }
    });

    it('never reads a hidden track once the axis has no overflow', async () => {
      const h = await createHarness('vertical', { scrollHeight: 100 });
      await h.resize();
      h.resetReads();

      for (let i = 0; i < 10; i++) {
        h.scroll();
      }

      // `_updateThumbPositions` guards each axis on its overflow signal, so a
      // hidden track's cache is never *read* — only ever written on the
      // transition frame, which the guard above covers.
      expect(h.reads.vOffset).toBe(0);
      expect(h.reads.vStyle).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Both axes independently
  // -------------------------------------------------------------------------

  describe('per-axis independence', () => {
    it('never measures the vertical track in a horizontal-only region', async () => {
      const h = await createHarness('horizontal', {
        scrollWidth: 600,
        clientWidth: 150,
      });
      await h.resize();
      h.resetReads();

      for (let i = 0; i < 10; i++) {
        h.state.scrollLeft = i * 10;
        h.scroll();
      }

      expect(h.reads.vOffset).toBe(0);
      expect(h.reads.vStyle).toBe(0);
      expect(h.thumb('_thumbWidth')).toBe(73);
      expect(h.thumb('_thumbHeight')).toBe(0);
    });

    it('never measures the horizontal track in a vertical-only region', async () => {
      const h = await createHarness('vertical', { scrollHeight: 400 });
      await h.resize();
      h.resetReads();

      for (let i = 0; i < 10; i++) {
        h.state.scrollTop = i * 10;
        h.scroll();
      }

      expect(h.reads.hOffset).toBe(0);
      expect(h.reads.hStyle).toBe(0);
      expect(h.thumb('_thumbHeight')).toBe(48);
      expect(h.thumb('_thumbWidth')).toBe(0);
    });

    it('keeps both axes correct and independent when both scroll', async () => {
      const h = await createHarness('both', {
        scrollHeight: 400,
        scrollWidth: 600,
        clientWidth: 150,
      });
      await h.resize();
      h.state.scrollTop = 300;
      h.state.scrollLeft = 450;
      h.scroll();

      // Vertical: usable 192, ratio 0.25 → 48; at the end → 4 + 144 = 148.
      expect(h.thumb('_thumbHeight')).toBe(48);
      expect(h.thumb('_thumbTop')).toBe(148);
      // Horizontal: usable 292, ratio 0.25 → 73; at the end → 4 + 219 = 223.
      expect(h.thumb('_thumbWidth')).toBe(73);
      expect(h.thumb('_thumbLeft')).toBe(223);
    });

    it('re-measures the cross axis when the other axis gains overflow', async () => {
      // The stylesheet's corner-avoidance rule shortens the vertical track by
      // one scrollbar width once the horizontal track becomes visible, and the
      // vertical track is measured *before* that class change is rendered.
      const h = await createHarness('both', { scrollHeight: 400 });
      // Model the corner rule: vertical track loses CORNER_INSET_PX while the
      // horizontal track is on screen.
      Object.defineProperty(h.trackV, 'offsetHeight', {
        get: () => {
          h.reads.vOffset++;
          if (h.trackV.classList.contains('mlv-scrollbar__track--hidden')) {
            return 0;
          }
          return h.trackH.classList.contains('mlv-scrollbar__track--hidden')
            ? h.extent.vertical
            : h.extent.vertical - CORNER_INSET_PX;
        },
        configurable: true,
      });

      await h.resize();
      h.scroll();
      expect(h.thumb('_thumbHeight')).toBe(48);

      // Horizontal overflow appears → the vertical track shortens to 188.
      h.state.clientWidth = 150;
      h.state.scrollWidth = 600;
      await h.resize();
      h.scroll();

      // usable 188 - 8 = 180; ratio 0.25 → 45. A cached pre-shrink 192 → 48.
      expect(h.thumb('_thumbHeight')).toBe(45);
    });
  });

  // -------------------------------------------------------------------------
  // 5b. Track visibility driven by `orientation` / `disabled`
  //
  // `--hidden` is bound to `!_showX() || !_hasXOverflow()`, so `orientation`
  // and `disabled` turn the corner-avoidance rule on and off **without** any
  // overflow signal moving — the cross-axis nulling in `_updateGeometry()`
  // cannot see it, and neither the viewport nor the content resizes, so the
  // ResizeObserver never fires either.
  // -------------------------------------------------------------------------

  describe('track visibility changes', () => {
    /**
     * Models the corner-avoidance rule on BOTH tracks: each loses
     * `CORNER_INSET_PX` along its own axis while the other track is on screen.
     */
    function installCornerRule(h: CachingHarness): void {
      const isHidden = (el: HTMLElement): boolean =>
        el.classList.contains('mlv-scrollbar__track--hidden');

      Object.defineProperty(h.trackV, 'offsetHeight', {
        get: () => {
          h.reads.vOffset++;
          if (isHidden(h.trackV)) {
            return 0;
          }
          return isHidden(h.trackH)
            ? h.extent.vertical
            : h.extent.vertical - CORNER_INSET_PX;
        },
        configurable: true,
      });
      Object.defineProperty(h.trackH, 'offsetWidth', {
        get: () => {
          h.reads.hOffset++;
          if (isHidden(h.trackH)) {
            return 0;
          }
          return isHidden(h.trackV)
            ? h.extent.horizontal
            : h.extent.horizontal - CORNER_INSET_PX;
        },
        configurable: true,
      });
    }

    async function setOrientation(
      h: CachingHarness,
      orientation: 'vertical' | 'horizontal' | 'both',
    ): Promise<void> {
      h.fixture.componentRef.setInput('orientation', orientation);
      h.fixture.detectChanges();
      await h.fixture.whenStable();
    }

    it('re-measures the vertical track when orientation drops the horizontal one', async () => {
      const h = await createHarness('both', {
        scrollHeight: 400,
        scrollWidth: 600,
        clientWidth: 150,
      });
      installCornerRule(h);
      await h.resize();
      h.scroll();

      // Both tracks on screen → 200 - 12 = 188; usable 180; ratio .25 → 45.
      expect(h.thumb('_thumbHeight')).toBe(45);

      await setOrientation(h, 'vertical');
      expect(h.trackH.classList).toContain('mlv-scrollbar__track--hidden');
      h.scroll();

      // The corner rule stopped matching → 200; usable 192; ratio .25 → 48.
      expect(h.thumb('_thumbHeight')).toBe(48);
    });

    it('re-measures the vertical track when orientation adds the horizontal one', async () => {
      const h = await createHarness('vertical', {
        scrollHeight: 400,
        scrollWidth: 600,
        clientWidth: 150,
      });
      installCornerRule(h);
      await h.resize();
      h.scroll();

      expect(h.thumb('_thumbHeight')).toBe(48);

      await setOrientation(h, 'both');
      expect(h.trackH.classList).not.toContain('mlv-scrollbar__track--hidden');
      h.scroll();

      expect(h.thumb('_thumbHeight')).toBe(45);
    });

    it('re-measures the horizontal track when orientation drops the vertical one', async () => {
      const h = await createHarness('both', {
        scrollHeight: 400,
        scrollWidth: 600,
        clientWidth: 150,
      });
      installCornerRule(h);
      await h.resize();
      h.scroll();

      // 300 - 12 = 288; usable 280; ratio 150/600 → 70.
      expect(h.thumb('_thumbWidth')).toBe(70);

      await setOrientation(h, 'horizontal');
      h.scroll();

      // 300; usable 292; ratio .25 → 73.
      expect(h.thumb('_thumbWidth')).toBe(73);
    });

    it('drags against the settled track size after an orientation change', async () => {
      const h = await createHarness('both', {
        scrollHeight: 400,
        scrollWidth: 600,
        clientWidth: 150,
      });
      installCornerRule(h);
      await h.resize();
      h.scroll();
      expect(h.thumb('_thumbHeight')).toBe(45);

      await setOrientation(h, 'vertical');

      const thumbEl = h.trackV.querySelector(
        '.mlv-scrollbar__thumb',
      ) as HTMLElement;
      thumbEl.setPointerCapture = vi.fn();

      const down = new Event('pointerdown', { bubbles: true }) as PointerEvent;
      Object.assign(down, { clientY: 0, clientX: 0, pointerId: 1 });
      thumbEl.dispatchEvent(down);
      const move = new Event('pointermove', { bubbles: true }) as PointerEvent;
      Object.assign(move, { clientY: 10, clientX: 0, pointerId: 1 });
      thumbEl.dispatchEvent(move);

      // Settled track 200 - 8 = 192, thumb 45, range 300 →
      // scrollPerPixel = 300 / 147; a stale 180 would give 300 / 135.
      expect(h.state.scrollTop).toBeCloseTo((300 / (192 - 45)) * 10, 5);
    });

    it('stays correct across a disabled round-trip', async () => {
      const h = await createHarness('both', {
        scrollHeight: 400,
        scrollWidth: 600,
        clientWidth: 150,
      });
      installCornerRule(h);
      await h.resize();
      h.scroll();
      expect(h.thumb('_thumbHeight')).toBe(45);

      h.fixture.componentRef.setInput('disabled', true);
      h.fixture.detectChanges();
      await h.fixture.whenStable();
      h.scroll();

      h.fixture.componentRef.setInput('disabled', false);
      h.fixture.detectChanges();
      await h.fixture.whenStable();
      h.scroll();

      expect(h.thumb('_thumbHeight')).toBe(45);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Thumb geometry table — values must be identical to the pre-cache maths
  // -------------------------------------------------------------------------

  describe('thumb geometry values', () => {
    // Every expectation below is the pre-change formula evaluated by hand:
    //   usable   = extent - 2 * padding            (padding = 4)
    //   thumb    = round(max(32, usable * client / scrollSize))
    //   offset   = round(padding + (scrollPos / (scrollSize - client))
    //                              * (usable - unrounded thumb))
    const verticalCases: {
      label: string;
      extent: number;
      clientHeight: number;
      scrollHeight: number;
      scrollTop: number;
      thumbHeight: number;
      thumbTop: number;
    }[] = [
      {
        label: 'at the top',
        extent: 200,
        clientHeight: 100,
        scrollHeight: 400,
        scrollTop: 0,
        thumbHeight: 48,
        thumbTop: 4,
      },
      {
        label: 'at the midpoint',
        extent: 200,
        clientHeight: 100,
        scrollHeight: 400,
        scrollTop: 150,
        thumbHeight: 48,
        thumbTop: 76,
      },
      {
        label: 'at the bottom',
        extent: 200,
        clientHeight: 100,
        scrollHeight: 400,
        scrollTop: 300,
        thumbHeight: 48,
        thumbTop: 148,
      },
      {
        label: 'clamped to the 32px minimum thumb size',
        extent: 200,
        clientHeight: 10,
        scrollHeight: 1000,
        scrollTop: 495,
        thumbHeight: 32,
        thumbTop: 84,
      },
      {
        label: 'rounding a fractional thumb and offset',
        extent: 200,
        clientHeight: 100,
        scrollHeight: 350,
        scrollTop: 100,
        thumbHeight: 55,
        thumbTop: 59,
      },
      {
        label: 'a tall track with a long thumb',
        extent: 400,
        clientHeight: 200,
        scrollHeight: 400,
        scrollTop: 200,
        thumbHeight: 196,
        thumbTop: 200,
      },
    ];

    for (const c of verticalCases) {
      it(`computes the vertical thumb ${c.label}`, async () => {
        const h = await createHarness('vertical', {
          clientHeight: c.clientHeight,
          scrollHeight: c.scrollHeight,
        });
        h.extent.vertical = c.extent;
        await h.resize();
        h.state.scrollTop = c.scrollTop;
        h.scroll();

        expect(h.thumb('_thumbHeight')).toBe(c.thumbHeight);
        expect(h.thumb('_thumbTop')).toBe(c.thumbTop);
      });
    }

    const horizontalCases: {
      label: string;
      extent: number;
      clientWidth: number;
      scrollWidth: number;
      scrollLeft: number;
      thumbWidth: number;
      thumbLeft: number;
    }[] = [
      {
        label: 'at the start',
        extent: 300,
        clientWidth: 150,
        scrollWidth: 600,
        scrollLeft: 0,
        thumbWidth: 73,
        thumbLeft: 4,
      },
      {
        label: 'at the midpoint',
        extent: 300,
        clientWidth: 150,
        scrollWidth: 600,
        scrollLeft: 225,
        thumbWidth: 73,
        thumbLeft: 114,
      },
      {
        label: 'at the end',
        extent: 300,
        clientWidth: 150,
        scrollWidth: 600,
        scrollLeft: 450,
        thumbWidth: 73,
        thumbLeft: 223,
      },
      {
        label: 'clamped to the 32px minimum thumb size',
        extent: 300,
        clientWidth: 10,
        scrollWidth: 2000,
        scrollLeft: 995,
        thumbWidth: 32,
        thumbLeft: 134,
      },
    ];

    for (const c of horizontalCases) {
      it(`computes the horizontal thumb ${c.label}`, async () => {
        const h = await createHarness('horizontal', {
          clientWidth: c.clientWidth,
          scrollWidth: c.scrollWidth,
        });
        h.extent.horizontal = c.extent;
        await h.resize();
        h.state.scrollLeft = c.scrollLeft;
        h.scroll();

        expect(h.thumb('_thumbWidth')).toBe(c.thumbWidth);
        expect(h.thumb('_thumbLeft')).toBe(c.thumbLeft);
      });
    }

    it('falls back to the padding offset when the scroll range collapses', async () => {
      // The `scrollRange <= 0` branch: the overflow signal is set, then the
      // content shrinks without a ResizeObserver notification, and a scroll
      // event arrives before the next geometry pass.
      const h = await createHarness('vertical', { scrollHeight: 400 });
      await h.resize();
      h.state.scrollTop = 300;
      h.scroll();
      expect(h.thumb('_thumbTop')).toBe(148);

      h.state.scrollHeight = 100;
      h.scroll();

      expect((h.component as any)['_hasVerticalOverflow']()).toBe(true);
      // ratio 1 → thumb = max(32, 192) = 192; range 0 → top = padding = 4.
      expect(h.thumb('_thumbHeight')).toBe(192);
      expect(h.thumb('_thumbTop')).toBe(4);
    });

    it('falls back to the padding offset on the horizontal axis too', async () => {
      const h = await createHarness('horizontal', {
        clientWidth: 150,
        scrollWidth: 600,
      });
      await h.resize();
      h.state.scrollLeft = 450;
      h.scroll();
      expect(h.thumb('_thumbLeft')).toBe(223);

      h.state.scrollWidth = 150;
      h.scroll();

      expect(h.thumb('_thumbWidth')).toBe(292);
      expect(h.thumb('_thumbLeft')).toBe(4);
    });
  });

  // -------------------------------------------------------------------------
  // scrollbarSize — the corner rule makes the cached extents depend on it
  // -------------------------------------------------------------------------

  describe('scrollbarSize changes', () => {
    it('re-measures the tracks after the scrollbar size input changes', async () => {
      const h = await createHarness('vertical', { scrollHeight: 400 });
      await h.resize();
      h.scroll();
      expect(h.thumb('_thumbHeight')).toBe(48);

      // A wider scrollbar changes the track boxes without resizing the
      // viewport or the content, so the ResizeObserver never fires.
      h.extent.vertical = 100;
      h.fixture.componentRef.setInput('scrollbarSize', '1.5rem');
      h.fixture.detectChanges();
      h.scroll();

      // usable 92; ratio 0.25 → 23 → clamped to 32.
      expect(h.thumb('_thumbHeight')).toBe(32);
    });
  });

  // -------------------------------------------------------------------------
  // Drag path — shares the cache, must still measure correctly
  // -------------------------------------------------------------------------

  describe('thumb drag', () => {
    it('scrolls the viewport correctly on a drag started before any scroll', async () => {
      const h = await createHarness('vertical', { scrollHeight: 400 });
      await h.resize();

      const thumbEl = h.trackV.querySelector(
        '.mlv-scrollbar__thumb',
      ) as HTMLElement;
      thumbEl.setPointerCapture = vi.fn();

      // No scroll event has happened yet — the cache is cold here.
      const down = new Event('pointerdown', { bubbles: true }) as PointerEvent;
      Object.assign(down, { clientY: 0, clientX: 0, pointerId: 1 });
      thumbEl.dispatchEvent(down);

      const move = new Event('pointermove', { bubbles: true }) as PointerEvent;
      Object.assign(move, { clientY: 24, clientX: 0, pointerId: 1 });
      thumbEl.dispatchEvent(move);

      // The drag reads the same metrics the fast path does: usable = 200 - 8
      // = 192, measured on the spot because nothing has warmed the cache yet.
      // `_thumbHeight` is still the 32px minimum left by the transition frame
      // (identical before and after this change), so
      // scrollPerPixel = 300 / (192 - 32) = 1.875 → 24px of travel = 45px.
      expect(h.state.scrollTop).toBeCloseTo(45, 5);
      // The measurement it took is now cached: a second drag re-reads nothing.
      h.resetReads();
      const down2 = new Event('pointerdown', { bubbles: true }) as PointerEvent;
      Object.assign(down2, { clientY: 0, clientX: 0, pointerId: 2 });
      thumbEl.dispatchEvent(down2);
      expect(h.reads.vOffset).toBe(0);
      expect(h.reads.vStyle).toBe(0);
    });
  });
});
