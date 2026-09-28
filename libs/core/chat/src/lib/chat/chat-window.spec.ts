import { Component, signal, viewChild } from '@angular/core';
import {
  ComponentFixtureAutoDetect,
  TestBed,
  type ComponentFixture,
} from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvChat } from './chat';
import type { MlvChatMessageData } from '../chat.types';

/**
 * Render-window specs (#354): what a reader who has scrolled up keeps in the
 * DOM while messages keep arriving, and which nodes survive the window moving.
 *
 * jsdom performs no layout, so the viewport's scroll metrics are stubbed on the
 * element that really scrolls (`.mlv-scrollbar__viewport`) and a native
 * `scroll` event is dispatched at it — the same path a browser takes. Every
 * assertion reads the rendered DOM or the node identity, not a method call.
 */

const msg = (id: string, authorId = 'u1'): MlvChatMessageData => ({
  id,
  authorId,
  text: id,
  timestamp: new Date('2026-07-27T10:00:00'),
});

const many = (count: number, prefix = 'm', from = 0): MlvChatMessageData[] =>
  Array.from({ length: count }, (_, i) => msg(`${prefix}${from + i}`));

@Component({
  imports: [MlvChat],
  template: `
    <mlv-chat [messages]="messages()" selfId="me" [windowSize]="windowSize()" />
  `,
})
class WindowHost {
  readonly chat = viewChild.required(MlvChat);
  readonly messages = signal<MlvChatMessageData[]>([]);
  readonly windowSize = signal(150);
}

/** Scroll metrics the stubbed viewport reports. */
interface Metrics {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

describe('MlvChat render window (#354)', () => {
  let fixture: ComponentFixture<WindowHost>;
  let host: WindowHost;
  let metrics: Metrics;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  /** The element that genuinely scrolls — a child of the `mlv-scrollbar` host. */
  function viewport(): HTMLElement {
    const el = root().querySelector<HTMLElement>('.mlv-scrollbar__viewport');
    expect(el).toBeTruthy();
    return el as HTMLElement;
  }

  /** Rendered message articles, oldest first. */
  function articles(): HTMLElement[] {
    return Array.from(root().querySelectorAll<HTMLElement>('.mlv-chat__item'));
  }

  /** The text (= id, see `msg`) of each rendered message, oldest first. */
  function renderedIds(): string[] {
    return articles().map(
      (article) =>
        article.querySelector('.mlv-chat-message__text')?.textContent?.trim() ??
        '',
    );
  }

  /** The article rendering the message with `id`, if it is in the DOM. */
  function articleFor(id: string): HTMLElement | undefined {
    return articles()[renderedIds().indexOf(id)];
  }

  /** Stubs the viewport's layout metrics; `scrollTop` stays writable. */
  function stubMetrics(initial: Metrics): void {
    metrics = { ...initial };
    const el = viewport();
    Object.defineProperty(el, 'scrollTop', {
      configurable: true,
      get: () => metrics.scrollTop,
      set: (value: number) => {
        metrics.scrollTop = value;
      },
    });
    Object.defineProperty(el, 'scrollHeight', {
      configurable: true,
      get: () => metrics.scrollHeight,
    });
    Object.defineProperty(el, 'clientHeight', {
      configurable: true,
      get: () => metrics.clientHeight,
    });
  }

  /** Moves the stubbed viewport and delivers the native scroll event. */
  async function scrollTo(scrollTop: number): Promise<void> {
    metrics.scrollTop = scrollTop;
    viewport().dispatchEvent(new Event('scroll'));
    await fixture.whenStable();
  }

  /** Scrolls the reader up, away from both edges: unpinned, no window growth. */
  async function unpin(): Promise<void> {
    await scrollTo(2000);
  }

  /** Scrolls back to the newest message: pinned again. */
  async function repin(): Promise<void> {
    await scrollTo(metrics.scrollHeight - metrics.clientHeight);
  }

  async function append(messages: MlvChatMessageData[]): Promise<void> {
    host.messages.update((list) => [...list, ...messages]);
    await fixture.whenStable();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideMlvI18nTesting(),
        { provide: ComponentFixtureAutoDetect, useValue: true },
      ],
    });
    fixture = TestBed.createComponent(WindowHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    stubMetrics({ scrollTop: 0, scrollHeight: 5000, clientHeight: 500 });
  });

  describe('while the reader is scrolled up', () => {
    beforeEach(async () => {
      host.messages.set(many(200));
      await fixture.whenStable();
      await unpin();
    });

    it('keeps the first rendered message when a batch arrives', async () => {
      expect(renderedIds()[0]).toBe('m50');
      expect(articles()).toHaveLength(150);
      const reading = articleFor('m50');

      await append(many(10, 'm', 200));

      expect(renderedIds()[0]).toBe('m50');
      expect(renderedIds().at(-1)).toBe('m209');
      expect(articles()).toHaveLength(160);
      // The node under the reader is the same element, not a re-created one.
      expect(articleFor('m50')).toBe(reading);
    });

    it('keeps the first rendered message across one-by-one arrivals', async () => {
      const reading = articleFor('m55');

      for (let i = 200; i < 210; i++) await append([msg(`m${i}`)]);

      expect(renderedIds()[0]).toBe('m50');
      expect(articles()).toHaveLength(160);
      expect(articleFor('m55')).toBe(reading);
    });

    it('keeps the first rendered message when the newest one is replaced along with an arrival', async () => {
      // An optimistic `tmp` id swapped for the server's, plus a new message:
      // the previous newest id is gone, so this is not a plain append.
      host.messages.update((list) => [...list, msg('tmp-1')]);
      await fixture.whenStable();
      expect(renderedIds()[0]).toBe('m50');

      host.messages.update((list) => [
        ...list.slice(0, -1),
        msg('srv-1'),
        msg('m200'),
      ]);
      await fixture.whenStable();

      expect(renderedIds()[0]).toBe('m50');
      expect(renderedIds().at(-1)).toBe('m200');
    });

    it('keeps the first rendered message when the consumer mutates its array in place', async () => {
      // A capped buffer: the consumer drops its oldest message and appends a
      // new one in the array it handed over last time, then passes a copy.
      // An index into that previous array no longer points at `m50`.
      const list = host.messages();
      list.shift();
      list.push(msg('m200'));
      host.messages.set([...list]);
      await fixture.whenStable();

      expect(renderedIds()[0]).toBe('m50');
      expect(renderedIds().at(-1)).toBe('m200');
      expect(articles()).toHaveLength(151);
    });

    it('still grows the window at the top edge on top of the held arrivals', async () => {
      await append(many(10, 'm', 200));
      expect(articles()).toHaveLength(160);

      await scrollTo(10);

      expect(renderedIds()[0]).toBe('m0');
      expect(articles()).toHaveLength(210);
    });

    it('trims back to windowSize once the reader returns to the newest message', async () => {
      await append(many(10, 'm', 200));
      expect(articles()).toHaveLength(160);

      await repin();

      expect(articles()).toHaveLength(150);
      expect(renderedIds()[0]).toBe('m60');
      expect(renderedIds().at(-1)).toBe('m209');
    });

    it('trims back to windowSize when the new-messages pill jump lands in one scroll event', async () => {
      await append(many(500, 'm', 200));
      expect(articles()).toHaveLength(650);

      const pill = root().querySelector<HTMLButtonElement>('.mlv-chat__pill');
      expect(pill).toBeTruthy();
      pill?.click();
      await fixture.whenStable();
      // The jump lands at the bottom in a single scroll event, already pinned.
      viewport().dispatchEvent(new Event('scroll'));
      await fixture.whenStable();

      expect(articles()).toHaveLength(150);
      expect(renderedIds().at(-1)).toBe('m699');

      // Pinned again: the next arrival slides a window of `windowSize`.
      await append([msg('m700')]);
      expect(articles()).toHaveLength(150);
      expect(renderedIds()[0]).toBe('m551');
    });
  });

  describe('after the window grew at the top', () => {
    it('holds the start the window grew to, not the one it had', async () => {
      host.messages.set(many(400));
      await fixture.whenStable();
      await unpin();
      expect(renderedIds()[0]).toBe('m250');

      await scrollTo(10);
      expect(renderedIds()[0]).toBe('m200');
      await unpin();

      await append(many(10, 'm', 400));

      expect(renderedIds()[0]).toBe('m200');
      expect(articles()).toHaveLength(210);
    });
  });

  describe('while the reader sits at the newest message', () => {
    it('still slides the window: the oldest rendered message leaves', async () => {
      host.messages.set(many(200));
      await fixture.whenStable();

      await append(many(10, 'm', 200));

      expect(articles()).toHaveLength(150);
      expect(renderedIds()[0]).toBe('m60');
    });

    it('keeps the group element when the group loses its first message', async () => {
      // Every `msg()` shares an author and a timestamp: the whole window is
      // one group, headed by the oldest rendered message.
      host.messages.set(many(200));
      await fixture.whenStable();
      const groups = root().querySelectorAll('.mlv-chat__group');
      expect(groups).toHaveLength(1);
      const group = groups[0];
      const survivor = articleFor('m100');

      await append([msg('m200')]);

      expect(renderedIds()[0]).toBe('m51');
      const after = root().querySelectorAll('.mlv-chat__group');
      expect(after).toHaveLength(1);
      expect(after[0]).toBe(group);
      expect(articleFor('m100')).toBe(survivor);
    });

    it('does not re-create a live message whose group loses its first message', async () => {
      host.windowSize.set(5);
      host.messages.set(many(5));
      await fixture.whenStable();

      await append([msg('live-1')]);
      const live = articleFor('live-1');
      expect(live?.classList).toContain('mlv-chat__item--enter');

      // The group head (`m1`) leaves the window; `live-1` stays in it.
      await append([msg('live-2')]);

      expect(renderedIds()).toEqual(['m2', 'm3', 'm4', 'live-1', 'live-2']);
      // Same element: its enter animation is not replayed by a re-creation.
      expect(articleFor('live-1')).toBe(live);
    });
  });

  describe('live-arrival marks', () => {
    it('does not animate a live message again when it re-enters the window', async () => {
      host.windowSize.set(5);
      host.messages.set(many(5));
      await fixture.whenStable();

      await append([msg('live-1')]);
      expect(articleFor('live-1')?.classList).toContain(
        'mlv-chat__item--enter',
      );

      // Pinned: five more arrivals push `live-1` out of the window.
      await append(many(5, 'n'));
      expect(renderedIds()).not.toContain('live-1');

      // Scrolling to the top grows the window back over it.
      await scrollTo(10);
      const returned = articleFor('live-1');
      expect(returned).toBeTruthy();
      expect(returned?.classList).not.toContain('mlv-chat__item--enter');
    });

    it('marks only rendered messages when the newest id is replaced', async () => {
      host.windowSize.set(20);
      host.messages.set(many(200));
      await fixture.whenStable();

      // The previous newest id is gone, so every message counts as fresh; only
      // the twenty rendered ones may get a mark. A mark on an unrendered
      // message would outlive every pruning until the window grew over it.
      host.messages.update((list) => [...list.slice(0, -1), msg('srv-1')]);
      await fixture.whenStable();

      // Growing the window renders `m150` for the first time since then.
      await scrollTo(10);
      const returned = articleFor('m150');
      expect(returned).toBeTruthy();
      expect(returned?.classList).not.toContain('mlv-chat__item--enter');
    });

    it('keeps only marks for messages still in the window', async () => {
      host.windowSize.set(20);
      host.messages.set(many(20));
      await fixture.whenStable();

      for (let i = 0; i < 200; i++) await append([msg(`live-${i}`)]);

      const liveIds = (
        host.chat() as unknown as { _liveIds(): ReadonlySet<string> }
      )._liveIds();
      expect(liveIds.size).toBeLessThanOrEqual(20);
      expect(root().querySelectorAll('.mlv-chat__item--enter')).toHaveLength(
        20,
      );
    });
  });
});
