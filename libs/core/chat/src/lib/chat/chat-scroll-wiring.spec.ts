import { Component, afterEveryRender, signal, viewChild } from '@angular/core';
import {
  ComponentFixtureAutoDetect,
  TestBed,
  type ComponentFixture,
} from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvChat } from './chat';
import type { MlvChatMessageData } from '../chat.types';

/**
 * Wiring specs for the chat scroll listener.
 *
 * `chat-scroll.spec.ts` drives `_evaluateScroll(...)` directly — deliberately,
 * so the pinning/window logic is testable without layout. Nothing there goes
 * through the listener, which is how the listener could sit on the wrong
 * element (issue #73) with a green suite. These specs close that gap: every
 * one of them dispatches a **native** scroll event at the element that really
 * scrolls, `.mlv-scrollbar__viewport`, and asserts an observable consequence.
 *
 * Dispatching at the `<mlv-scrollbar>` host instead would pass vacuously —
 * `dispatchEvent` runs a node's own listeners regardless of bubbling — which
 * is exactly the trap the old template binding fell into.
 */

const msg = (id: string, authorId = 'u1'): MlvChatMessageData => ({
  id,
  authorId,
  text: id,
  timestamp: new Date('2026-07-27T10:00:00'),
});

const many = (count: number, prefix = 'm'): MlvChatMessageData[] =>
  Array.from({ length: count }, (_, i) => msg(`${prefix}${i}`));

@Component({
  imports: [MlvChat],
  template: `
    <mlv-chat
      [messages]="messages()"
      selfId="me"
      [hasOlder]="hasOlder()"
      [windowSize]="windowSize()"
      (loadOlder)="loadOlderCount.set(loadOlderCount() + 1)"
    />
  `,
})
class WiringHost {
  readonly chat = viewChild.required(MlvChat);
  readonly messages = signal<MlvChatMessageData[]>([]);
  readonly hasOlder = signal(false);
  readonly windowSize = signal(150);
  readonly loadOlderCount = signal(0);

  /** Incremented once per real change-detection pass. */
  renders = 0;

  constructor() {
    afterEveryRender(() => {
      this.renders++;
    });
  }
}

describe('MlvChat scroll listener wiring', () => {
  let fixture: ComponentFixture<WiringHost>;
  let host: WiringHost;

  /** The element that genuinely scrolls — a child of the `mlv-scrollbar` host. */
  function viewport(): HTMLElement {
    const el = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLElement>('.mlv-scrollbar__viewport');
    expect(el).toBeTruthy();
    return el as HTMLElement;
  }

  async function build(): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideMlvI18nTesting(),
        { provide: ComponentFixtureAutoDetect, useValue: true },
      ],
    });
    fixture = TestBed.createComponent(WiringHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(build);

  // -------------------------------------------------------------------------
  // 1. Wiring — issue #73 regression
  // -------------------------------------------------------------------------

  it('emits loadOlder for a native scroll dispatched at the scrollbar viewport', async () => {
    host.messages.set(many(10));
    host.hasOlder.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.loadOlderCount()).toBe(0);

    viewport().dispatchEvent(new Event('scroll'));
    await fixture.whenStable();

    expect(host.loadOlderCount()).toBe(1);
  });

  it('does not react to a scroll dispatched at the mlv-scrollbar host', async () => {
    host.messages.set(many(10));
    host.hasOlder.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const scrollbarHost = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLElement>('mlv-scrollbar');
    expect(scrollbarHost).toBeTruthy();
    expect(scrollbarHost).not.toBe(viewport());

    // A `scroll` event does not bubble, so the host never sees the viewport's
    // event in a browser. The listener must not live here.
    scrollbarHost?.dispatchEvent(new Event('scroll'));
    await fixture.whenStable();

    expect(host.loadOlderCount()).toBe(0);
  });

  it('grows the render window from a native scroll at the viewport', async () => {
    host.messages.set(many(300));
    fixture.detectChanges();
    await fixture.whenStable();

    const internals = host.chat() as unknown as { _renderCount(): number };
    expect(internals._renderCount()).toBe(150);

    viewport().dispatchEvent(new Event('scroll'));
    await fixture.whenStable();

    expect(internals._renderCount()).toBe(200);
  });

  // -------------------------------------------------------------------------
  // 2. Teardown
  // -------------------------------------------------------------------------

  it('stops reacting to scroll after the fixture is destroyed', async () => {
    // The render window is the observable to watch here, not `loadOlder`: an
    // `output()` is torn down with its component, so a leaked listener would
    // emit into the void and the counter would look clean either way. The
    // window signal keeps answering after destroy, so it does show the leak.
    host.messages.set(many(300));
    fixture.detectChanges();
    await fixture.whenStable();

    const internals = host.chat() as unknown as { _renderCount(): number };
    const viewportEl = viewport();
    viewportEl.dispatchEvent(new Event('scroll'));
    await fixture.whenStable();
    expect(internals._renderCount()).toBe(200);

    fixture.destroy();

    expect(() => viewportEl.dispatchEvent(new Event('scroll'))).not.toThrow();
    expect(internals._renderCount()).toBe(200);
  });

  // -------------------------------------------------------------------------
  // 3. Change-detection pass count
  // -------------------------------------------------------------------------

  it('runs no change-detection pass for a burst of no-op scrolls', async () => {
    // 10 messages, no older history: every scroll resolves to the same pinned
    // state and the same render window, so the handler writes no signal.
    host.messages.set(many(10));
    fixture.detectChanges();
    await fixture.whenStable();

    // One scroll to reach steady state, then measure the burst.
    viewport().dispatchEvent(new Event('scroll'));
    await fixture.whenStable();

    const SCROLLS = 20;
    const before = host.renders;
    for (let i = 0; i < SCROLLS; i++) {
      viewport().dispatchEvent(new Event('scroll'));
      await fixture.whenStable();
    }
    const passes = host.renders - before;

    // Bound: nothing observable changes across the burst, so a correct
    // implementation runs ZERO passes. A template `(scroll)` binding runs
    // Angular's listener wrapper, which calls `markViewDirty` and notifies the
    // change-detection scheduler unconditionally — one pass per event, 20.
    expect(passes).toBe(0);
    expect(passes).toBeLessThan(SCROLLS);
  });
});

// ---------------------------------------------------------------------------
// 4. Passive registration
// ---------------------------------------------------------------------------

describe('MlvChat scroll listener registration', () => {
  interface Registration {
    target: EventTarget;
    options: boolean | AddEventListenerOptions | undefined;
  }

  let original: typeof EventTarget.prototype.addEventListener;
  let scrollRegistrations: Registration[];

  beforeEach(() => {
    scrollRegistrations = [];
    original = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (
      this: EventTarget,
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ): void {
      if (type === 'scroll') {
        scrollRegistrations.push({ target: this, options });
      }
      return original.call(this, type, listener, options);
    } as typeof EventTarget.prototype.addEventListener;
  });

  afterEach(() => {
    EventTarget.prototype.addEventListener = original;
  });

  it('registers the viewport scroll listener as passive', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideMlvI18nTesting(),
        { provide: ComponentFixtureAutoDetect, useValue: true },
      ],
    });
    const fixture = TestBed.createComponent(WiringHost);
    fixture.componentInstance.messages.set(many(3));
    fixture.detectChanges();
    await fixture.whenStable();

    const viewportEl = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLElement>('.mlv-scrollbar__viewport');
    const onViewport = scrollRegistrations.filter(
      (r) => r.target === viewportEl,
    );

    expect(onViewport.length).toBeGreaterThan(0);
    for (const registration of onViewport) {
      expect(registration.options).toEqual(
        expect.objectContaining({ passive: true }),
      );
    }
  });
});
