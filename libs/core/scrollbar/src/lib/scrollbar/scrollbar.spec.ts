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

globalThis.ResizeObserver = class implements ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallbacks.push(callback);
  }
  readonly observe = vi.fn();
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
