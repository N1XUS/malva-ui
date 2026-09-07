import { fileURLToPath } from 'node:url';
import { Component, DOCUMENT, inject, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { MlvResizeObserverFactory, MlvRtlService } from '@malva-ui/cdk/utils';
import { expectNoAxeViolations, runAxe } from '@malva-ui/internal-testing/axe';
import { compile } from 'sass';
import { MlvSwipeAction } from '../swipe-action/swipe-action';
import { MlvSwipeActionsCoordinator } from '../swipe-actions-coordinator';
import type { MlvSwipeActionsSide } from '../swipe-actions-token';
import { MlvSwipeActions } from './swipe-actions';

/**
 * jsdom ships no `ResizeObserver`, so the shared factory is replaced with one
 * that records the callback per observed element and lets a spec fire it.
 */
class FakeResizeObserverFactory {
  readonly callbacks = new Map<Element, ResizeObserverCallback>();

  create(callback: ResizeObserverCallback): ResizeObserver {
    const observer: ResizeObserver = {
      observe: (target) => this.callbacks.set(target, callback),
      unobserve: (target) => this.callbacks.delete(target),
      disconnect: () => this.callbacks.clear(),
    };
    return observer;
  }

  /** Reports `width` as the border box of `target` and fires its callback. */
  resize(target: Element, width: number): void {
    Object.defineProperty(target, 'offsetWidth', {
      configurable: true,
      value: width,
    });
    const callback = this.callbacks.get(target);
    if (!callback) throw new Error('element is not observed');
    callback([], {} as ResizeObserver);
  }
}

@Component({
  imports: [MlvSwipeActions, MlvSwipeAction],
  // Inside a list the row is the list item: its actions sit beside the
  // content, and a list may own nothing but items. The axe pass below runs on
  // the list, so `aria-required-children` sees the actions.
  template: `
    <div role="list">
      <mlv-swipe-actions
        class="row"
        role="listitem"
        [(opened)]="opened"
        [disabled]="disabled()"
        [hint]="hint()"
      >
        <button
          mlvSwipeAction
          side="start"
          tone="success"
          (click)="log('read')"
        >
          Read
        </button>
        <div class="content">
          <button type="button" class="inner">Inner</button>
          Row content
        </div>
        <button mlvSwipeAction tone="warning" (click)="log('flag')">
          Flag
        </button>
        <button mlvSwipeAction tone="danger" (click)="log('delete')">
          Delete
        </button>
      </mlv-swipe-actions>
    </div>
    <button type="button" class="outside">Outside</button>
  `,
})
class HostComponent {
  readonly opened = signal<MlvSwipeActionsSide | null>(null);
  readonly disabled = signal(false);
  readonly hint = signal(false);
  readonly clicks: string[] = [];

  log(action: string): void {
    this.clicks.push(action);
  }
}

@Component({
  imports: [MlvSwipeActions, MlvSwipeAction],
  template: `
    <mlv-swipe-actions class="a">
      <div>A</div>
      <button mlvSwipeAction>Delete A</button>
    </mlv-swipe-actions>
    <mlv-swipe-actions class="b">
      <div>B</div>
      <button mlvSwipeAction>Delete B</button>
    </mlv-swipe-actions>
    <button type="button" class="outside">Outside</button>
  `,
})
class PairHostComponent {
  readonly document = inject(DOCUMENT);
}

interface ScrollCall {
  left: number;
  behavior: ScrollBehavior;
}

/**
 * Turns a jsdom element into a measurable, programmatically scrollable
 * container: `scrollTo` is recorded and applied to `scrollLeft`, and the
 * geometry the component reads for the "fully open at the end" target is
 * fixed at a 300px viewport over 600px of content.
 */
function mockScroller(el: HTMLElement): ScrollCall[] {
  const calls: ScrollCall[] = [];
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: 300 });
  Object.defineProperty(el, 'scrollWidth', { configurable: true, value: 600 });
  Object.defineProperty(el, 'scrollTo', {
    configurable: true,
    value: (options: ScrollToOptions) => {
      calls.push({
        left: options.left ?? 0,
        behavior: options.behavior ?? 'auto',
      });
      el.scrollLeft = options.left ?? 0;
    },
  });
  return calls;
}

function scroll(el: HTMLElement, scrollLeft: number): void {
  el.scrollLeft = scrollLeft;
  el.dispatchEvent(new Event('scroll'));
}

function settle(el: HTMLElement): void {
  el.dispatchEvent(new Event('scrollend'));
}

describe('MlvSwipeActions', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let el: HTMLElement;
  let startSlot: HTMLElement;
  let endSlot: HTMLElement;
  let contentSlot: HTMLElement;
  let component: MlvSwipeActions;
  let calls: ScrollCall[];
  let resizeObservers: FakeResizeObserverFactory;
  let rtl: MlvRtlService;

  async function ready(startWidth = 120): Promise<void> {
    resizeObservers.resize(startSlot, startWidth);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    resizeObservers = new FakeResizeObserverFactory();
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: MlvResizeObserverFactory, useValue: resizeObservers },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    el = fixture.nativeElement.querySelector('mlv-swipe-actions');
    calls = mockScroller(el);
    fixture.detectChanges();
    await fixture.whenStable();

    startSlot = el.querySelector('.mlv-swipe-actions__start') as HTMLElement;
    endSlot = el.querySelector('.mlv-swipe-actions__end') as HTMLElement;
    contentSlot = el.querySelector(
      '.mlv-swipe-actions__content',
    ) as HTMLElement;
    component = fixture.debugElement
      .query((node) => node.nativeElement === el)
      .injector.get(MlvSwipeActions);
    rtl = TestBed.inject(MlvRtlService);
  });

  afterEach(() => {
    rtl.setDirection('ltr');
  });

  describe('projection', () => {
    it('routes actions by their static side attribute and content in between', () => {
      const startActions = [...startSlot.querySelectorAll('.mlv-swipe-action')];
      const endActions = [...endSlot.querySelectorAll('.mlv-swipe-action')];

      expect(startActions.map((a) => a.textContent?.trim())).toEqual(['Read']);
      expect(endActions.map((a) => a.textContent?.trim())).toEqual([
        'Flag',
        'Delete',
      ]);
      expect(contentSlot.querySelector('.content')).not.toBeNull();
      expect(contentSlot.querySelector('.mlv-swipe-action')).toBeNull();
      expect([...el.children].map((c) => c.className)).toEqual([
        'mlv-swipe-actions__start',
        'mlv-swipe-actions__content',
        'mlv-swipe-actions__end',
      ]);
    });

    it('carries the BEM block class on the host', () => {
      expect(el.classList.contains('mlv-swipe-actions')).toBe(true);
    });

    it('has no axe violations, the list around the row included', async () => {
      await expectNoAxeViolations(fixture.nativeElement);
    });

    it('needs the listitem role on the row itself: a list owns the actions through a roleless row', async () => {
      // ARIA 1.2 lets a `listitem` reach its `list` through generic
      // intermediates, so the content could carry the role instead — but the
      // actions sit beside the content, and axe collects focusable
      // descendants through generics as children the list does not allow.
      el.removeAttribute('role');
      contentSlot.querySelector('.content')?.setAttribute('role', 'listitem');

      // `runAxe`, not `expectNoAxeViolations`: this case asserts that a
      // violation IS raised, and needs the raw result to read its related
      // nodes.
      const results = await runAxe(fixture.nativeElement, {
        runOnly: { type: 'rule', values: ['aria-required-children'] },
      });

      expect(results.violations.map(({ id }) => id)).toEqual([
        'aria-required-children',
      ]);
      expect(
        results.violations[0].nodes[0].any[0].relatedNodes?.map(
          ({ html }) => html,
        ),
      ).toHaveLength(3);
    });
  });

  describe('initial position', () => {
    it('is not ready before the start slot has been measured', () => {
      expect(el.classList.contains('mlv-swipe-actions--ready')).toBe(false);
      expect(el.scrollLeft).toBe(0);
    });

    it('rests on the content once the start slot width is known', async () => {
      await ready(120);

      expect(el.classList.contains('mlv-swipe-actions--ready')).toBe(true);
      expect(el.scrollLeft).toBe(120);
      expect(calls).toEqual([]);
    });

    it('re-aligns the closed position when the start slot resizes while closed', async () => {
      await ready(120);
      await ready(150);

      expect(el.scrollLeft).toBe(150);
    });

    it('re-derives the displaced state when the closed offset moves onto the current position', async () => {
      await ready(120);
      scroll(el, 300);
      settle(el);
      await fixture.whenStable();
      expect(el.classList.contains('mlv-swipe-actions--displaced')).toBe(true);
      expect(host.opened()).toBe('end');

      // The start slot grows until the closed offset is where the row already
      // rests — no scroll event reports that.
      resizeObservers.resize(startSlot, 300);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(el.classList.contains('mlv-swipe-actions--displaced')).toBe(false);
      expect(host.opened()).toBeNull();
      expect(calls).toEqual([]);
    });

    it('leaves an open row alone when the start slot resizes', async () => {
      await ready(120);
      scroll(el, 300);
      settle(el);
      await fixture.whenStable();

      await ready(150);

      expect(el.scrollLeft).toBe(300);
    });

    it('rests at the mirrored offset in RTL', async () => {
      rtl.setDirection('rtl');
      fixture.detectChanges();
      await fixture.whenStable();
      await ready(120);

      expect(el.scrollLeft).toBe(-120);
    });
  });

  describe('scroll-driven state', () => {
    beforeEach(() => ready(120));

    it('marks the host displaced as soon as it leaves the closed offset', async () => {
      scroll(el, 121);
      await fixture.whenStable();
      expect(el.classList.contains('mlv-swipe-actions--displaced')).toBe(true);

      scroll(el, 120);
      await fixture.whenStable();
      expect(el.classList.contains('mlv-swipe-actions--displaced')).toBe(false);
    });

    it('reports the end side once the scroll settles past the content', async () => {
      const seen: (MlvSwipeActionsSide | null)[] = [];
      component.opened.subscribe((side) => seen.push(side));

      scroll(el, 300);
      expect(host.opened()).toBeNull();

      settle(el);
      await fixture.whenStable();

      expect(host.opened()).toBe('end');
      expect(seen).toEqual(['end']);
      expect(el.classList.contains('mlv-swipe-actions--open')).toBe(true);
    });

    it('reports the start side when settled before the content', async () => {
      scroll(el, 0);
      settle(el);
      await fixture.whenStable();

      expect(host.opened()).toBe('start');
    });

    it('reports null when settled back on the content', async () => {
      scroll(el, 300);
      settle(el);
      await fixture.whenStable();
      scroll(el, 120);
      settle(el);
      await fixture.whenStable();

      expect(host.opened()).toBeNull();
      expect(el.classList.contains('mlv-swipe-actions--open')).toBe(false);
    });

    it('reads a negative scrollLeft as a logical distance in RTL', async () => {
      rtl.setDirection('rtl');
      fixture.detectChanges();
      await fixture.whenStable();

      scroll(el, -300);
      settle(el);
      await fixture.whenStable();
      expect(host.opened()).toBe('end');

      scroll(el, 0);
      settle(el);
      await fixture.whenStable();
      expect(host.opened()).toBe('start');
    });

    it('falls back to a debounced scroll where the browser has no scrollend event', async () => {
      // jsdom declares `onscrollend`, so the fallback is only wired when a row
      // is created in a window without it. Hide the property for a fresh row.
      const descriptor = Object.getOwnPropertyDescriptor(
        HTMLElement.prototype,
        'onscrollend',
      );
      delete (HTMLElement.prototype as { onscrollend?: unknown }).onscrollend;
      let legacy: ComponentFixture<HostComponent>;
      let legacyEl: HTMLElement;
      try {
        legacy = TestBed.createComponent(HostComponent);
        legacyEl = legacy.nativeElement.querySelector('mlv-swipe-actions');
        mockScroller(legacyEl);
        legacy.detectChanges();
        await legacy.whenStable();
      } finally {
        if (descriptor) {
          Object.defineProperty(
            HTMLElement.prototype,
            'onscrollend',
            descriptor,
          );
        }
      }
      resizeObservers.resize(
        legacyEl.querySelector('.mlv-swipe-actions__start') as HTMLElement,
        120,
      );
      legacy.detectChanges();
      await legacy.whenStable();

      scroll(legacyEl, 300);
      await legacy.whenStable();
      expect(legacy.componentInstance.opened()).toBeNull();

      await new Promise((resolve) => setTimeout(resolve, 200));
      await legacy.whenStable();

      expect(legacy.componentInstance.opened()).toBe('end');
    });
  });

  describe('programmatic control', () => {
    beforeEach(() => ready(120));

    it('opens the end side by scrolling to the far end', async () => {
      host.opened.set('end');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(calls).toEqual([{ left: 300, behavior: 'smooth' }]);
    });

    it('opens the start side by scrolling to zero', async () => {
      host.opened.set('start');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(calls).toEqual([{ left: 0, behavior: 'smooth' }]);
    });

    it('closes by scrolling back to the content', async () => {
      scroll(el, 300);
      settle(el);
      await fixture.whenStable();

      component.close();

      expect(calls).toEqual([{ left: 120, behavior: 'smooth' }]);
    });

    it('honours a consumer write that lands while the previous one is still scrolling', async () => {
      host.opened.set('end');
      fixture.detectChanges();
      await fixture.whenStable();
      // The smooth scroll is in flight: a scroll event has fired, settle has not.
      scroll(el, 200);

      host.opened.set(null);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(calls).toEqual([
        { left: 300, behavior: 'smooth' },
        { left: 120, behavior: 'smooth' },
      ]);
    });

    it('keeps an imperative open on course when the closed offset moves mid-flight', async () => {
      component.open('end');
      // In flight: a scroll event has fired, settle has not — and the model
      // still reads `null`, because it follows the settle.
      scroll(el, 200);

      await ready(150);

      expect(calls).toEqual([{ left: 300, behavior: 'smooth' }]);
      expect(host.opened()).toBeNull();
    });

    it('does not report a settle while a scroll it started is still in flight', async () => {
      const seen: (MlvSwipeActionsSide | null)[] = [];
      component.opened.subscribe((side) => seen.push(side));
      host.opened.set('start');
      fixture.detectChanges();
      await fixture.whenStable();
      // Passing over the content on the way to the start side…
      scroll(el, 150);

      // …when the closed offset lands exactly there. The row is not at rest.
      await ready(150);
      expect(seen).toEqual([]);

      scroll(el, 0);
      settle(el);
      await fixture.whenStable();
      expect(host.opened()).toBe('start');
      expect(seen).toEqual([]);
    });

    it('does not re-scroll when the model echoes the settled side', async () => {
      scroll(el, 300);
      settle(el);
      await fixture.whenStable();

      expect(host.opened()).toBe('end');
      expect(calls).toEqual([]);
    });

    it('mirrors the scroll target in RTL', async () => {
      rtl.setDirection('rtl');
      fixture.detectChanges();
      await fixture.whenStable();
      calls.length = 0;

      component.open('end');
      expect(calls).toEqual([{ left: -300, behavior: 'smooth' }]);

      component.close();
      expect(calls[1]).toEqual({ left: -120, behavior: 'smooth' });
    });

    it('jumps instead of animating under prefers-reduced-motion', () => {
      const matchMedia = vi.fn().mockReturnValue({ matches: true });
      vi.stubGlobal('matchMedia', matchMedia);
      try {
        component.open('end');
      } finally {
        vi.unstubAllGlobals();
      }

      expect(matchMedia).toHaveBeenCalledWith(
        '(prefers-reduced-motion: reduce)',
      );
      expect(calls).toEqual([{ left: 300, behavior: 'instant' }]);
    });

    it('peeks the end actions and closes again after the hold', () => {
      // Only the interval clock rxjs' `timer()` runs on — Angular's zoneless
      // scheduler keeps its real `setTimeout` / rAF so `whenStable()` resolves.
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      try {
        component.peek();
        expect(calls).toEqual([{ left: 300, behavior: 'smooth' }]);

        vi.advanceTimersByTime(2000);
        expect(calls).toEqual([
          { left: 300, behavior: 'smooth' },
          { left: 120, behavior: 'smooth' },
        ]);
      } finally {
        vi.useRealTimers();
      }
    });

    it('does not peek under prefers-reduced-motion', () => {
      vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
      try {
        component.peek('start');
      } finally {
        vi.unstubAllGlobals();
      }

      expect(calls).toEqual([]);
    });
  });

  describe('hint', () => {
    it('peeks once after the first measurement when hint is set', async () => {
      // Only the interval clock rxjs' `timer()` runs on — Angular's zoneless
      // scheduler keeps its real `setTimeout` / rAF so `whenStable()` resolves.
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      try {
        host.hint.set(true);
        fixture.detectChanges();
        expect(calls).toEqual([]);

        await ready(120);
        expect(calls).toEqual([{ left: 300, behavior: 'smooth' }]);

        vi.advanceTimersByTime(2000);
        expect(calls[1]).toEqual({ left: 120, behavior: 'smooth' });

        await ready(130);
        expect(calls).toHaveLength(2);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('closing interactions', () => {
    beforeEach(async () => {
      await ready(120);
      scroll(el, 300);
      settle(el);
      await fixture.whenStable();
    });

    it('closes when an action is activated and still runs the consumer handler', () => {
      (endSlot.querySelectorAll('button')[1] as HTMLButtonElement).click();

      expect(host.clicks).toEqual(['delete']);
      expect(calls).toEqual([{ left: 120, behavior: 'smooth' }]);
    });

    it('consumes Escape only when it closed the row', () => {
      const seen: KeyboardEvent[] = [];
      const listener = (event: KeyboardEvent) => seen.push(event);
      document.addEventListener('keydown', listener);
      try {
        el.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        );
        expect(calls).toEqual([{ left: 120, behavior: 'smooth' }]);
        expect(seen).toHaveLength(0);

        // Resting now: an enclosing drawer or dialog gets to see this one.
        el.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        );
        expect(seen).toHaveLength(1);
        expect(calls).toHaveLength(1);
      } finally {
        document.removeEventListener('keydown', listener);
      }
    });

    it('closes on Escape and moves focus into the content', () => {
      // jsdom lays nothing out; give the inner button the geometry the CDK
      // InteractivityChecker requires to call it visible.
      const inner = contentSlot.querySelector('.inner') as HTMLElement;
      Object.defineProperty(inner, 'getClientRects', {
        configurable: true,
        value: () => [{}],
      });
      const action = endSlot.querySelector('button') as HTMLButtonElement;
      action.focus();
      action.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );

      expect(calls).toEqual([{ left: 120, behavior: 'smooth' }]);
      expect(document.activeElement).toBe(contentSlot.querySelector('.inner'));
    });

    it('closes on a pointer press outside the row', () => {
      const outside = fixture.nativeElement.querySelector('.outside');
      outside.dispatchEvent(new Event('pointerdown', { bubbles: true }));

      expect(calls).toEqual([{ left: 120, behavior: 'smooth' }]);
    });

    it('stays open on a pointer press inside the row', () => {
      const inner = contentSlot.querySelector('.inner') as HTMLElement;
      inner.dispatchEvent(new Event('pointerdown', { bubbles: true }));

      expect(calls).toEqual([]);
    });

    it('closes when focus moves outside the row', () => {
      const outside = fixture.nativeElement.querySelector('.outside');
      outside.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

      expect(calls).toEqual([{ left: 120, behavior: 'smooth' }]);
    });

    it('stops listening to the document once closed', () => {
      scroll(el, 120);
      settle(el);
      calls.length = 0;

      const outside = fixture.nativeElement.querySelector('.outside');
      outside.dispatchEvent(new Event('pointerdown', { bubbles: true }));

      expect(calls).toEqual([]);
    });
  });

  describe('disabled', () => {
    it('reflects the modifier class and closes an open row', async () => {
      await ready(120);
      scroll(el, 300);
      settle(el);
      await fixture.whenStable();

      host.disabled.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(el.classList.contains('mlv-swipe-actions--disabled')).toBe(true);
      expect(calls).toEqual([{ left: 120, behavior: 'smooth' }]);
    });

    it('ignores open requests while disabled', async () => {
      await ready(120);
      host.disabled.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      component.open('end');
      component.peek();

      expect(calls).toEqual([]);
    });
  });
});

describe('MlvSwipeActionsCoordinator', () => {
  let fixture: ComponentFixture<PairHostComponent>;
  let a: HTMLElement;
  let b: HTMLElement;
  let callsA: ScrollCall[];
  let callsB: ScrollCall[];
  let resizeObservers: FakeResizeObserverFactory;

  async function readyBoth(): Promise<void> {
    for (const row of [a, b]) {
      resizeObservers.resize(
        row.querySelector('.mlv-swipe-actions__start') as HTMLElement,
        0,
      );
    }
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    resizeObservers = new FakeResizeObserverFactory();
    await TestBed.configureTestingModule({
      imports: [PairHostComponent],
      providers: [
        { provide: MlvResizeObserverFactory, useValue: resizeObservers },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PairHostComponent);
    a = fixture.nativeElement.querySelector('.a');
    b = fixture.nativeElement.querySelector('.b');
    callsA = mockScroller(a);
    callsB = mockScroller(b);
    fixture.detectChanges();
    await fixture.whenStable();
    await readyBoth();
  });

  // The spies sit on the one jsdom `document` every test shares; a spy left
  // in place carries its call history into the next test.
  afterEach(() => vi.restoreAllMocks());

  it('closes the previously open row as soon as another one starts moving', async () => {
    scroll(a, 300);
    settle(a);
    await fixture.whenStable();
    expect(callsA).toEqual([]);

    scroll(b, 40);
    await fixture.whenStable();

    expect(callsA).toEqual([{ left: 0, behavior: 'smooth' }]);
    expect(callsB).toEqual([]);
  });

  it('keeps a single document listener for the active row only', async () => {
    const document = fixture.componentInstance.document;
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    scroll(a, 300);
    settle(a);
    await fixture.whenStable();
    scroll(b, 300);
    settle(b);
    await fixture.whenStable();

    const added = addSpy.mock.calls.map(([type]) => type).sort();
    expect(added).toEqual(['focusin', 'pointerdown']);

    scroll(b, 0);
    settle(b);
    await fixture.whenStable();
    scroll(a, 0);
    settle(a);
    await fixture.whenStable();

    const removed = removeSpy.mock.calls.map(([type]) => type).sort();
    expect(removed).toEqual(['focusin', 'pointerdown']);
  });

  it('releases the document listener when the active row is destroyed', async () => {
    const document = fixture.componentInstance.document;
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    scroll(a, 300);
    settle(a);
    await fixture.whenStable();

    fixture.destroy();

    const removed = removeSpy.mock.calls.map(([type]) => type).sort();
    expect(removed).toEqual(['focusin', 'pointerdown']);
    expect(TestBed.inject(MlvSwipeActionsCoordinator)).toBeTruthy();
  });
});

describe('MlvSwipeActions stylesheet', () => {
  let rules: CSSRule[];
  let styleRules: CSSStyleRule[];

  beforeAll(() => {
    const css = compile(
      fileURLToPath(
        new URL(['.', 'swipe-actions.scss'].join('/'), import.meta.url),
      ),
    ).css;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    rules = [...(style.sheet?.cssRules ?? [])];
    styleRules = rules.filter(
      (rule): rule is CSSStyleRule => rule instanceof CSSStyleRule,
    );
    style.remove();
  });

  // jsdom's CSSStyleDeclaration is index-addressable but neither iterable
  // nor `item()`-capable.
  function propertyNames(style: CSSStyleDeclaration): string[] {
    return Array.from({ length: style.length }, (_, i) => style[i]);
  }

  // `mixins.base` nests a `*` rule, so Sass emits a block's declarations as
  // two rules with the same selector; merge every rule whose selector list
  // names `selector`.
  function declarationsOf(selector: string): Record<string, string> {
    const matching = styleRules.filter(({ selectorText }) =>
      selectorText
        .split(',')
        .map((part) => part.trim())
        .includes(selector),
    );
    if (!matching.length) throw new Error(`no rule for ${selector}`);
    const out: Record<string, string> = {};
    for (const rule of matching) {
      for (const name of propertyNames(rule.style)) {
        out[name] = rule.style.getPropertyValue(name).trim();
      }
    }
    return out;
  }

  it('makes the host a hidden-scrollbar mandatory snap container', () => {
    const host = declarationsOf('.mlv-swipe-actions');
    expect(host['display']).toBe('flex');
    expect(host['overflow-x']).toBe('scroll');
    expect(host['scroll-snap-type']).toBe('x mandatory');
    expect(host['scrollbar-width']).toBe('none');
    expect(host['overscroll-behavior-x']).toBe('none');
  });

  it('allows the local bounce only while displaced', () => {
    expect(
      declarationsOf('.mlv-swipe-actions--displaced')['overscroll-behavior-x'],
    ).toBe('contain');
  });

  it('snaps the content as a mandatory stop and each side to its own edge', () => {
    const content = declarationsOf('.mlv-swipe-actions__content');
    expect(content['flex']).toBe('0 0 100%');
    expect(content['scroll-snap-align']).toBe('start');
    expect(content['scroll-snap-stop']).toBe('always');
    expect(
      declarationsOf('.mlv-swipe-actions__start')['scroll-snap-align'],
    ).toBe('start');
    expect(declarationsOf('.mlv-swipe-actions__end')['scroll-snap-align']).toBe(
      'end',
    );
  });

  it('places each action from its slot: sticky, pinned inset from the edge it reveals from', () => {
    // Slot-scoped, so the placement is a (0,2,0) rule: a host that paints
    // itself declares its own `position` at (0,1,0) in the same layer
    // (`.mlv-switch { position: relative }`), and a bare `.mlv-swipe-action`
    // rule would beat it or lose to it by stylesheet load order alone.
    for (const side of ['start', 'end'] as const) {
      const placed = declarationsOf(
        `.mlv-swipe-actions__${side} > .mlv-swipe-action`,
      );
      expect(placed['position'], side).toBe('sticky');
      expect(placed['flex'], side).toBe('0 0 auto');
      expect(placed[`inset-inline-${side}`], side).toBe(
        'var(--mlv-swipe-actions-inset)',
      );
    }
  });

  it('paints the outermost start action on top so the edge action is the hero on both sides', () => {
    const first = declarationsOf(
      '.mlv-swipe-actions__start > .mlv-swipe-action:nth-child(1)',
    );
    const second = declarationsOf(
      '.mlv-swipe-actions__start > .mlv-swipe-action:nth-child(2)',
    );
    expect(Number(first['z-index'])).toBeGreaterThan(Number(second['z-index']));
  });

  it('emits no rule on the bare action selector so a foreign host keeps its own look', () => {
    // Every declaration is either slot-scoped placement or chrome under
    // `--block`; nothing at (0,1,0) can collide with what a `button[mlvButton]`
    // or `mlv-switch` host declares for itself.
    expect(
      styleRules.some(({ selectorText }) =>
        selectorText
          .split(',')
          .map((part) => part.trim())
          .includes('.mlv-swipe-action'),
      ),
    ).toBe(false);
    const plain = declarationsOf('.mlv-swipe-action--plain');
    for (const chrome of [
      'background-color',
      'color',
      'padding',
      'font-size',
      'min-inline-size',
      'border',
      'border-radius',
      'position',
    ]) {
      expect(plain[chrome], chrome).toBeUndefined();
    }
  });

  it('paints the tone fill and the block metrics only on the block appearance', () => {
    const block = declarationsOf('.mlv-swipe-action--block');
    expect(block['background-color']).toBe('var(--mlv-swipe-action-bg)');
    expect(block['color']).toBe('var(--mlv-swipe-action-color)');
    expect(block['min-inline-size']).toBe(
      'var(--mlv-swipe-actions-action-size)',
    );
    expect(block['display']).toBe('inline-flex');
    expect(
      declarationsOf('.mlv-swipe-action--block:hover')['background-color'],
    ).toBe('var(--mlv-swipe-action-bg-hover)');
    expect(
      styleRules.some(
        ({ selectorText }) => selectorText === '.mlv-swipe-action:hover',
      ),
    ).toBe(false);
  });

  it('centres a plain action on the row', () => {
    expect(declarationsOf('.mlv-swipe-action--plain')['align-self']).toBe(
      'center',
    );
  });

  it('spaces and insets each side through row-level custom properties', () => {
    const host = declarationsOf('.mlv-swipe-actions');
    expect(host['--mlv-swipe-actions-gap']).toBe('0');
    expect(host['--mlv-swipe-actions-inset']).toBe('0');
    for (const side of ['start', 'end']) {
      const slot = declarationsOf(`.mlv-swipe-actions__${side}`);
      expect(slot['gap'], side).toBe('var(--mlv-swipe-actions-gap)');
      expect(slot['padding-inline'], side).toBe(
        'var(--mlv-swipe-actions-inset)',
      );
      // An empty side must not become a phantom snap stop made of padding.
      expect(
        declarationsOf(`.mlv-swipe-actions__${side}:empty`)['padding-inline'],
        side,
      ).toBe('0');
    }
  });

  it('keeps the start slot out of flow and invisible until the row is positioned', () => {
    const pending = declarationsOf(
      '.mlv-swipe-actions:not(.mlv-swipe-actions--ready) .mlv-swipe-actions__start',
    );
    expect(pending['position']).toBe('absolute');
    expect(pending['visibility']).toBe('hidden');
  });

  it('hides the scroll axis entirely while disabled', () => {
    expect(declarationsOf('.mlv-swipe-actions--disabled')['overflow-x']).toBe(
      'hidden',
    );
  });

  it('never writes a physical inline property', () => {
    const physical =
      /^(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)$/;
    const offenders = styleRules.flatMap((rule) =>
      propertyNames(rule.style)
        .filter((name) => physical.test(name))
        .map((name) => `${rule.selectorText} { ${name} }`),
    );
    expect(offenders).toEqual([]);
  });

  it('ships a reduced-motion path', () => {
    const media = rules.filter(
      (rule): rule is CSSMediaRule => rule instanceof CSSMediaRule,
    );
    expect(
      media.some((rule) =>
        rule.media.mediaText.includes('prefers-reduced-motion'),
      ),
    ).toBe(true);
  });
});
