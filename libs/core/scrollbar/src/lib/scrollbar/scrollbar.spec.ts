/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MlvScrollbar } from './scrollbar';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

// Mock ResizeObserver — not available in JSDOM
globalThis.ResizeObserver = class implements ResizeObserver {
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
      // `ariaLabel` is now an optional override; when unset, the effective
      // aria-label falls back to the i18n label ("Scrollable region"). That
      // resolved default is asserted via the DOM in the "ariaLabel" suite below.
      expect(component.ariaLabel()).toBeUndefined();
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
  // ariaLabel
  // ---------------------------------------------------------------------------

  describe('ariaLabel', () => {
    it('should set aria-label on viewport with default value', () => {
      fixture.detectChanges();
      const viewport = fixture.debugElement.query(
        By.css('.mlv-scrollbar__viewport'),
      );
      expect(viewport.nativeElement.getAttribute('aria-label')).toBe(
        'Scrollable region',
      );
    });

    it('should reflect custom ariaLabel on viewport', () => {
      fixture.componentRef.setInput('ariaLabel', 'Chat messages');
      fixture.detectChanges();

      const viewport = fixture.debugElement.query(
        By.css('.mlv-scrollbar__viewport'),
      );
      expect(viewport.nativeElement.getAttribute('aria-label')).toBe(
        'Chat messages',
      );
    });

    it('should carry a role that permits aria-label (never a bare labelled div)', () => {
      fixture.detectChanges();
      const viewport = fixture.debugElement.query(
        By.css('.mlv-scrollbar__viewport'),
      ).nativeElement as HTMLElement;

      // `aria-label` is prohibited on an implicit `generic` role, so the label
      // must always be accompanied by an explicit role that allows a name.
      expect(viewport.getAttribute('aria-label')).toBe('Scrollable region');
      expect(viewport.getAttribute('role')).toBe('group');
    });

    it('should not expose a landmark role (a scroll wrapper is not a page region)', () => {
      fixture.detectChanges();
      const viewport = fixture.debugElement.query(
        By.css('.mlv-scrollbar__viewport'),
      ).nativeElement as HTMLElement;

      expect(viewport.getAttribute('role')).not.toBe('region');
    });

    it('should drop both role and label when the viewport is not a tab stop', () => {
      fixture.componentRef.setInput('viewportTabIndex', -1);
      fixture.detectChanges();

      const viewport = fixture.debugElement.query(
        By.css('.mlv-scrollbar__viewport'),
      ).nativeElement as HTMLElement;

      expect(viewport.getAttribute('role')).toBeNull();
      expect(viewport.getAttribute('aria-label')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Viewport tabindex
  // ---------------------------------------------------------------------------

  describe('viewport tabindex', () => {
    it('should have tabindex="0" on a viewport with no tabbable content', () => {
      const viewport = fixture.debugElement.query(
        By.css('.mlv-scrollbar__viewport'),
      );
      expect(viewport.nativeElement.getAttribute('tabindex')).toBe('0');
    });

    it('should allow composite widgets to remove the viewport from the tab order', () => {
      fixture.componentRef.setInput('viewportTabIndex', -1);
      fixture.detectChanges();

      const viewport = fixture.debugElement.query(
        By.css('.mlv-scrollbar__viewport'),
      );
      expect(viewport.nativeElement.getAttribute('tabindex')).toBe('-1');
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
// Viewport tabindex vs. projected content (WCAG 2.1.1)
// ---------------------------------------------------------------------------

@Component({
  imports: [MlvScrollbar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mlv-scrollbar [viewportTabIndex]="tabIndex()">
      @if (withControls()) {
        <button class="projected-button">Act</button>
      } @else {
        <p>Text only.</p>
      }
    </mlv-scrollbar>
  `,
})
class ScrollbarContentHostComponent {
  readonly withControls = signal(false);
  readonly tabIndex = signal(0);
}

describe('MlvScrollbar — viewport tab stop', () => {
  let fixture: ComponentFixture<ScrollbarContentHostComponent>;
  let host: ScrollbarContentHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScrollbarContentHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ScrollbarContentHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function viewport(): HTMLElement {
    return fixture.nativeElement.querySelector(
      '.mlv-scrollbar__viewport',
    ) as HTMLElement;
  }

  function tabindex(): string | null {
    return viewport().getAttribute('tabindex');
  }

  /** MutationObserver callbacks are microtask-scheduled. */
  async function flushMutations(): Promise<void> {
    await Promise.resolve();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('stays a tab stop for a text-only region so it can still be scrolled', () => {
    expect(tabindex()).toBe('0');
  });

  it('drops out of the tab order when the content itself is tabbable', async () => {
    host.withControls.set(true);
    fixture.detectChanges();
    await flushMutations();

    expect(tabindex()).toBe('-1');
  });

  it('becomes a tab stop again when the tabbable content goes away', async () => {
    host.withControls.set(true);
    fixture.detectChanges();
    await flushMutations();
    expect(tabindex()).toBe('-1');

    host.withControls.set(false);
    fixture.detectChanges();
    await flushMutations();

    expect(tabindex()).toBe('0');
  });

  it('ignores a disabled control — it is not a tab stop', async () => {
    host.withControls.set(true);
    fixture.detectChanges();
    await flushMutations();

    fixture.nativeElement
      .querySelector('.projected-button')
      ?.setAttribute('disabled', '');
    await flushMutations();

    expect(tabindex()).toBe('0');
  });

  it('applies an explicit non-zero viewportTabIndex verbatim', async () => {
    host.tabIndex.set(-1);
    host.withControls.set(false);
    fixture.detectChanges();
    await flushMutations();

    expect(tabindex()).toBe('-1');
  });

  it('names itself as a group while it is a tab stop', () => {
    expect(tabindex()).toBe('0');
    expect(viewport().getAttribute('role')).toBe('group');
    expect(viewport().getAttribute('aria-label')).toBe('Scrollable region');
  });

  it('gives up role and name together with the tab stop', async () => {
    host.withControls.set(true);
    fixture.detectChanges();
    await flushMutations();

    expect(tabindex()).toBe('-1');
    expect(viewport().getAttribute('role')).toBeNull();
    expect(viewport().getAttribute('aria-label')).toBeNull();
  });

  it('regains role and name when the tabbable content goes away', async () => {
    host.withControls.set(true);
    fixture.detectChanges();
    await flushMutations();
    expect(viewport().getAttribute('role')).toBeNull();

    host.withControls.set(false);
    fixture.detectChanges();
    await flushMutations();

    expect(tabindex()).toBe('0');
    expect(viewport().getAttribute('role')).toBe('group');
    expect(viewport().getAttribute('aria-label')).toBe('Scrollable region');
  });
});
