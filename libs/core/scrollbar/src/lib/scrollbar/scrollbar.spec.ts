/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import type { MockInstance } from 'vitest';
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

  /**
   * MutationObserver callbacks are microtask-scheduled; the rescan they queue
   * is debounced onto the next animation frame, so both have to be flushed.
   */
  async function flushMutations(): Promise<void> {
    await Promise.resolve();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
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

// ---------------------------------------------------------------------------
// Tabbability rescan — relevance filter + animation-frame debounce
// ---------------------------------------------------------------------------

@Component({
  imports: [MlvScrollbar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mlv-scrollbar>
      <button class="eager-button">Act</button>
    </mlv-scrollbar>
  `,
})
class ScrollbarEagerContentHostComponent {}

@Component({
  imports: [MlvScrollbar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mlv-scrollbar>
      <div class="fixture-root"><p class="fixture-text">Text only.</p></div>
    </mlv-scrollbar>
  `,
})
class ScrollbarRescanHostComponent {}

describe('MlvScrollbar — first tabbability scan', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScrollbarEagerContentHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
  });

  it('resolves the viewport tabindex on first render without waiting a frame', () => {
    // No animation frame is ever run here: the stub records callbacks and
    // never invokes them. If the first scan were routed through the debounce
    // the viewport would still claim to be a tab stop.
    const queued: FrameRequestCallback[] = [];
    const rafSpy = vi
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => queued.push(cb));

    try {
      const fixture = TestBed.createComponent(
        ScrollbarEagerContentHostComponent,
      );
      fixture.detectChanges();

      const viewport = fixture.nativeElement.querySelector(
        '.mlv-scrollbar__viewport',
      ) as HTMLElement;

      expect(viewport.getAttribute('tabindex')).toBe('-1');
      expect(viewport.getAttribute('role')).toBeNull();
    } finally {
      rafSpy.mockRestore();
    }
  });
});

describe('MlvScrollbar — tabbability rescan', () => {
  let fixture: ComponentFixture<ScrollbarRescanHostComponent>;
  let scanSpy: MockInstance<typeof Element.prototype.querySelectorAll> | null =
    null;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScrollbarRescanHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ScrollbarRescanHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    scanSpy?.mockRestore();
    scanSpy = null;
  });

  /** The element `_updateTabbableContent()` scans — the projection wrapper. */
  function contentEl(): HTMLElement {
    return fixture.nativeElement.querySelector(
      '.mlv-scrollbar__content',
    ) as HTMLElement;
  }

  /** The consumer-owned wrapper every mutation in these specs happens inside. */
  function root(): HTMLElement {
    return fixture.nativeElement.querySelector('.fixture-root') as HTMLElement;
  }

  function tabindex(): string | null {
    return (
      fixture.nativeElement.querySelector(
        '.mlv-scrollbar__viewport',
      ) as HTMLElement
    ).getAttribute('tabindex');
  }

  function nextFrame(): Promise<void> {
    return new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
  }

  /**
   * One microtask (the observer's own delivery) plus two frames: the first runs
   * the debounced scan, the second proves nothing landed a frame late.
   */
  async function settle(): Promise<void> {
    await Promise.resolve();
    await nextFrame();
    await nextFrame();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  /**
   * Installs the projected shape, lets the mutations it causes settle, and only
   * then starts counting scans — so every count below is caused by the spec's
   * own mutation and nothing else.
   */
  async function withContent(html: string): Promise<void> {
    root().innerHTML = html;
    await settle();
    scanSpy = vi.spyOn(contentEl(), 'querySelectorAll');
  }

  // -------------------------------------------------------------------------
  // Records that cannot move a tab stop
  // -------------------------------------------------------------------------

  describe('irrelevant mutations', () => {
    it('does not scan when a text node changes value', async () => {
      await withContent('<p class="text">before</p>');

      const text = root().querySelector('.text') as HTMLElement;
      (text.firstChild as Text).nodeValue = 'after';
      await settle();

      expect(scanSpy).not.toHaveBeenCalled();
      expect(tabindex()).toBe('0');
    });

    it('does not scan when a text node is swapped out', async () => {
      await withContent('<p class="text">before</p>');

      const text = root().querySelector('.text') as HTMLElement;
      text.removeChild(text.firstChild as Text);
      text.appendChild(document.createTextNode('after'));
      await settle();

      expect(scanSpy).not.toHaveBeenCalled();
      expect(tabindex()).toBe('0');
    });

    it('does not scan when a class toggles on a non-candidate element', async () => {
      await withContent('<div class="row">Row</div>');

      root().querySelector('.row')?.classList.add('row--selected');
      await settle();

      expect(scanSpy).not.toHaveBeenCalled();
      expect(tabindex()).toBe('0');
    });

    it('does not scan when hidden toggles on an element holding no candidate', async () => {
      await withContent(
        '<div class="row">Row</div><button class="keeper">Keep</button>',
      );
      expect(tabindex()).toBe('-1');

      root().querySelector('.row')?.setAttribute('hidden', '');
      await settle();

      expect(scanSpy).not.toHaveBeenCalled();
      expect(tabindex()).toBe('-1');
    });

    it('does not scan when an element holding no candidate is added or removed', async () => {
      await withContent('<p class="text">Text only.</p>');

      const noise = document.createElement('div');
      noise.textContent = 'noise';
      root().appendChild(noise);
      await settle();

      expect(scanSpy).not.toHaveBeenCalled();

      noise.remove();
      await settle();

      expect(scanSpy).not.toHaveBeenCalled();
      expect(tabindex()).toBe('0');
    });
  });

  // -------------------------------------------------------------------------
  // Records that can move a tab stop
  // -------------------------------------------------------------------------

  describe('relevant mutations', () => {
    it('scans once when a button is added', async () => {
      await withContent('<p class="text">Text only.</p>');
      expect(tabindex()).toBe('0');

      root().appendChild(document.createElement('button'));
      await settle();

      expect(scanSpy).toHaveBeenCalledTimes(1);
      expect(tabindex()).toBe('-1');
    });

    it('scans once when the last button is removed', async () => {
      await withContent('<button class="only">Act</button>');
      expect(tabindex()).toBe('-1');

      root().querySelector('.only')?.remove();
      await settle();

      expect(scanSpy).toHaveBeenCalledTimes(1);
      expect(tabindex()).toBe('0');
    });

    it('scans once when a nested button is added inside a wrapper', async () => {
      await withContent('<p class="text">Text only.</p>');

      const wrapper = document.createElement('div');
      wrapper.appendChild(document.createElement('button'));
      root().appendChild(wrapper);
      await settle();

      expect(scanSpy).toHaveBeenCalledTimes(1);
      expect(tabindex()).toBe('-1');
    });

    it('reaches a candidate that follows a text node in the same batch', async () => {
      await withContent('<p class="text">Text only.</p>');
      expect(tabindex()).toBe('0');

      // The text node is delivered first. Narrowing every added node to
      // `Element` before calling `matches()` on it is what keeps the filter
      // from throwing here — and a MutationObserver callback that throws is
      // swallowed, so the button behind it would be dropped in silence.
      root().appendChild(document.createTextNode('noise'));
      root().appendChild(document.createElement('button'));
      await settle();

      expect(scanSpy).toHaveBeenCalledTimes(1);
      expect(tabindex()).toBe('-1');
    });

    it('scans on each disabled toggle of a button', async () => {
      await withContent('<button class="only">Act</button>');
      expect(tabindex()).toBe('-1');

      const button = root().querySelector('.only') as HTMLElement;

      button.setAttribute('disabled', '');
      await settle();
      expect(scanSpy).toHaveBeenCalledTimes(1);
      expect(tabindex()).toBe('0');

      button.removeAttribute('disabled');
      await settle();
      expect(scanSpy).toHaveBeenCalledTimes(2);
      expect(tabindex()).toBe('-1');
    });

    it('scans when hidden toggles on a plain wrapper that contains a button', async () => {
      await withContent('<div class="wrap"><button>Act</button></div>');
      expect(tabindex()).toBe('-1');

      root().querySelector('.wrap')?.setAttribute('hidden', '');
      await settle();

      // The wrapper matches no candidate selector, so a `target.matches(...)`
      // filter would drop this record outright.
      expect(scanSpy).toHaveBeenCalledTimes(1);
      // The scan confirms candidates with `ignoreVisibility: true` — the CDK's
      // visibility test is geometric and never passes under jsdom — so a hidden
      // ancestor does not change the answer. What matters here is that the
      // record reached the scan at all.
      expect(tabindex()).toBe('-1');
    });

    it('scans when disabled toggles on a fieldset wrapping an input', async () => {
      await withContent(
        '<fieldset class="group"><input class="field" /></fieldset>',
      );
      expect(tabindex()).toBe('-1');

      root().querySelector('.group')?.setAttribute('disabled', '');
      await settle();

      // `fieldset` is not in the candidate selector either.
      expect(scanSpy).toHaveBeenCalledTimes(1);
      // The CDK reads `disabled` off the candidate itself, so the inherited
      // fieldset state leaves the verdict unchanged here.
      expect(tabindex()).toBe('-1');
    });

    it('scans once when tabindex is added to a plain div', async () => {
      await withContent('<div class="plain">Row</div>');
      expect(tabindex()).toBe('0');

      root().querySelector('.plain')?.setAttribute('tabindex', '0');
      await settle();

      expect(scanSpy).toHaveBeenCalledTimes(1);
      expect(tabindex()).toBe('-1');
    });

    it('scans once when tabindex is removed from a plain div', async () => {
      await withContent('<div class="plain" tabindex="0">Row</div>');
      expect(tabindex()).toBe('-1');

      root().querySelector('.plain')?.removeAttribute('tabindex');
      await settle();

      // After the removal the target matches nothing and contains nothing —
      // a filter that only asks about the post-mutation DOM drops it.
      expect(scanSpy).toHaveBeenCalledTimes(1);
      expect(tabindex()).toBe('0');
    });

    it('scans once when href is removed from an anchor', async () => {
      await withContent('<a class="link" href="#target">Link</a>');
      expect(tabindex()).toBe('-1');

      root().querySelector('.link')?.removeAttribute('href');
      await settle();

      // Same shape as the tabindex removal: the anchor stops being a candidate
      // at the very moment the change has to be re-read.
      expect(scanSpy).toHaveBeenCalledTimes(1);
      expect(tabindex()).toBe('0');
    });
  });

  // -------------------------------------------------------------------------
  // Debounce
  // -------------------------------------------------------------------------

  describe('debounce', () => {
    it('coalesces a burst of separate mutation batches into one scan', async () => {
      await withContent('<p class="text">Text only.</p>');

      for (let i = 0; i < 5; i++) {
        const button = document.createElement('button');
        button.textContent = `Act ${i}`;
        root().appendChild(button);
        // Drain the observer's microtask so each append is delivered as its own
        // batch. No timer can fire in between, so all five land in one frame —
        // undebounced that is five full-subtree scans.
        await Promise.resolve();
      }

      await settle();

      expect(scanSpy).toHaveBeenCalledTimes(1);
      expect(tabindex()).toBe('-1');
      expect(root().querySelectorAll('button')).toHaveLength(5);
    });

    it('scans synchronously where requestAnimationFrame is unavailable', async () => {
      await withContent('<p class="text">Text only.</p>');

      const raf = globalThis.requestAnimationFrame;
      // The file guards `MutationObserver`/`ResizeObserver` the same way; a
      // missing frame scheduler must cost the debounce, never the scan.
      (
        globalThis as { requestAnimationFrame?: unknown }
      ).requestAnimationFrame = undefined;

      try {
        root().appendChild(document.createElement('button'));
        // Only the observer's own microtask — no frame is available to run.
        await Promise.resolve();

        expect(scanSpy).toHaveBeenCalledTimes(1);
      } finally {
        globalThis.requestAnimationFrame = raf;
      }

      fixture.detectChanges();
      expect(tabindex()).toBe('-1');
    });

    it('scans again on the next frame after the first burst', async () => {
      await withContent('<p class="text">Text only.</p>');

      root().appendChild(document.createElement('button'));
      await settle();
      expect(scanSpy).toHaveBeenCalledTimes(1);

      root().querySelector('button')?.remove();
      await settle();

      expect(scanSpy).toHaveBeenCalledTimes(2);
      expect(tabindex()).toBe('0');
    });
  });

  // -------------------------------------------------------------------------
  // Destroy safety
  // -------------------------------------------------------------------------

  describe('destroy', () => {
    it('does not scan after the component is destroyed with a scan pending', async () => {
      await withContent('<p class="text">Text only.</p>');

      root().appendChild(document.createElement('button'));
      // The observer has delivered and a frame is queued, but not run yet.
      await Promise.resolve();
      expect(scanSpy).not.toHaveBeenCalled();

      expect(() => fixture.destroy()).not.toThrow();

      await nextFrame();
      await nextFrame();

      expect(scanSpy).not.toHaveBeenCalled();
    });
  });
});
