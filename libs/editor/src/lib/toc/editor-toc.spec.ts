import { DOCUMENT } from '@angular/common';
import { Component, signal, viewChild } from '@angular/core';
import type { Provider } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import type { Editor } from '@tiptap/core';
import { undoDepth } from '@tiptap/pm/history';
import type { Transaction } from '@tiptap/pm/state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MlvEditorToolbarContext } from '../editor-toolbar-context';
import { MlvEditor } from '../editor/editor';
import { provideMlvEditorHeadingLinks } from '../editor/editor-heading-links';
import type { MlvEditorHeadingAnchorOptions } from '../extensions/heading-anchors/editor-heading-anchors';
import type { MlvEditorHeadingLevel } from '../toolbar/editor-heading';
import { MlvEditorToc, type MlvEditorTocItem } from './editor-toc';

@Component({
  imports: [MlvEditor, MlvEditorToc],
  template: `
    <div [attr.dir]="dir()">
      <mlv-editor
        #doc
        label="Document"
        [value]="value()"
        [headingAnchors]="anchors()"
        [readonly]="readonly()"
        [disabled]="disabled()"
      />
      @if (showToc()) {
        <nav
          mlvEditorToc
          [context]="doc"
          [levels]="levels()"
          [ariaLabel]="ariaLabel()"
          (itemClick)="clicks.push($event)"
        ></nav>
      }
    </div>
  `,
})
class TocHost {
  readonly value = signal<string | null>(
    '<h1>Intro</h1><p>Body text</p><h2>Setup</h2><p>More</p><h2>Usage</h2>',
  );
  readonly anchors = signal<boolean | Partial<MlvEditorHeadingAnchorOptions>>(
    true,
  );
  readonly readonly = signal(false);
  readonly disabled = signal(false);
  readonly levels = signal<readonly MlvEditorHeadingLevel[]>([1, 2, 3]);
  readonly ariaLabel = signal<string | undefined>(undefined);
  readonly dir = signal<'ltr' | 'rtl' | null>(null);
  readonly showToc = signal(true);
  readonly clicks: MlvEditorTocItem[] = [];
  readonly toc = viewChild.required(MlvEditorToc);
  readonly editor = viewChild.required(MlvEditor);
}

/** Two editors without anchors; the TOC follows whichever `second` picks. */
@Component({
  imports: [MlvEditor, MlvEditorToc],
  template: `
    <mlv-editor #first label="First" value="<h2>One</h2>" />
    <mlv-editor #second label="Second" value="<h2>Two</h2>" />
    <nav mlvEditorToc [context]="useSecond() ? second : first"></nav>
  `,
})
class TwoEditorsHost {
  readonly useSecond = signal(false);
  readonly toc = viewChild.required(MlvEditorToc);
}

interface Harness {
  fixture: ComponentFixture<TocHost>;
  host: TocHost;
  root: HTMLElement;
  nav: HTMLElement;
  editor: Editor;
  content: HTMLElement;
  toc: MlvEditorToc;
  settle(): Promise<void>;
}

async function mount(
  configure?: (host: TocHost) => void,
  providers: Provider[] = [],
): Promise<Harness> {
  await TestBed.configureTestingModule({
    imports: [TocHost],
    providers: [provideMlvI18nTesting(), ...providers],
  }).compileComponents();
  const fixture = TestBed.createComponent(TocHost);
  configure?.(fixture.componentInstance);
  document.body.appendChild(fixture.nativeElement);
  fixture.detectChanges();
  await fixture.whenStable();
  const settle = async () => {
    await Promise.resolve();
    fixture.detectChanges();
    await fixture.whenStable();
  };
  await settle();
  const root = fixture.nativeElement as HTMLElement;
  const host = fixture.componentInstance;
  const editor = host.editor().editor();
  if (!editor) throw new Error('Expected a mounted Tiptap editor.');
  return {
    fixture,
    host,
    root,
    nav: root.querySelector('nav') as HTMLElement,
    editor,
    content: root.querySelector('.ProseMirror') as HTMLElement,
    toc: host.toc(),
    settle,
  };
}

/** Link texts in document order. */
const linkTexts = (nav: HTMLElement) =>
  Array.from(nav.querySelectorAll('.mlv-editor-toc__link')).map((link) =>
    link.textContent?.trim(),
  );

/** The link for `text`. */
function link(nav: HTMLElement, text: string): HTMLAnchorElement {
  const found = Array.from(
    nav.querySelectorAll<HTMLAnchorElement>('.mlv-editor-toc__link'),
  ).find((candidate) => candidate.textContent?.trim() === text);
  if (!found) throw new Error(`Expected the "${text}" link.`);
  return found;
}

/** A primary-button click on `target`, optionally modified. */
function click(target: Element, init: MouseEventInit = {}): MouseEvent {
  const event = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    button: 0,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

describe('MlvEditorToc (#516, U9)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.inject(MlvRtlService).setDirection('ltr');
    document.body.innerHTML = '';
  });

  it('lists anchored headings: the level filter, empty headings skipped, skipped levels nested, a heading inside a quote', async () => {
    const { nav, toc } = await mount((host) =>
      host.value.set(
        '<h1>Intro</h1><p>x</p><h3>Deep   one </h3>' +
          '<blockquote><h2>Quoted</h2></blockquote><h2></h2><h4>Four</h4>',
      ),
    );
    expect(toc.items().map((item) => [item.text, item.level])).toEqual([
      ['Intro', 1],
      ['Deep one', 3],
      ['Quoted', 2],
    ]);
    // h1 → h3 nests one step, with no empty wrapper item.
    const top = nav.querySelector(':scope > ol') as HTMLElement;
    expect(top.children).toHaveLength(1);
    const nested = top.querySelectorAll(':scope > li > ol > li');
    expect(nested).toHaveLength(2);
    expect(
      Array.from(nav.querySelectorAll('li')).map(
        (item) => item.firstElementChild?.tagName,
      ),
    ).toEqual(['A', 'A', 'A']);
    expect(
      link(nav, 'Intro').style.getPropertyValue('--mlv-editor-toc-depth'),
    ).toBe('0');
    expect(
      link(nav, 'Deep one').style.getPropertyValue('--mlv-editor-toc-depth'),
    ).toBe('1');
    expect(
      link(nav, 'Quoted').style.getPropertyValue('--mlv-editor-toc-depth'),
    ).toBe('1');
  });

  it('finds a heading below a non-heading block, such as a list item', async () => {
    const { nav } = await mount((h) =>
      h.value.set(
        '<h2>Top</h2><ul><li><p>Item</p><h3>In a list</h3></li></ul>',
      ),
    );
    expect(linkTexts(nav)).toEqual(['Top', 'In a list']);
  });

  it('follows the levels input', async () => {
    const { host, nav, settle } = await mount();
    expect(linkTexts(nav)).toEqual(['Intro', 'Setup', 'Usage']);
    host.levels.set([2]);
    await settle();
    expect(linkTexts(nav)).toEqual(['Setup', 'Usage']);
  });

  it('builds ids with the idPrefix passed through headingAnchors, and hrefs from a provided MLV_EDITOR_HEADING_LINKS', async () => {
    const { nav, content, toc } = await mount(
      (host) => host.anchors.set({ idPrefix: 'doc-' }),
      [provideMlvEditorHeadingLinks({ href: ({ id }) => `/guide#${id}` })],
    );
    expect(toc.items()[0]).toEqual({
      anchor: 'intro',
      id: 'doc-intro',
      level: 1,
      text: 'Intro',
      href: '/guide#doc-intro',
    });
    expect(content.querySelector('h1')?.id).toBe('doc-intro');
    expect(link(nav, 'Intro').getAttribute('href')).toBe('/guide#doc-intro');
  });

  it('renders nothing and warns once in dev without headingAnchors', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { host, nav, toc, editor, settle } = await mount((h) =>
      h.anchors.set(false),
    );
    expect(toc.ready()).toBe(false);
    expect(toc.items()).toEqual([]);
    expect(nav.querySelector('ol, .mlv-editor-toc__empty')).toBeNull();
    const warnings = () =>
      warn.mock.calls.filter((call) =>
        String(call[0]).includes('headingAnchors'),
      );
    expect(warnings()).toHaveLength(1);
    editor.commands.insertContent('<h2>Later</h2>');
    host.levels.set([1, 2]);
    await settle();
    expect(warnings()).toHaveLength(1);
    expect(nav.querySelector('ol')).toBeNull();
  });

  it('warns once per TOC, even when its context moves to another editor without anchors', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await TestBed.configureTestingModule({
      imports: [TwoEditorsHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(TwoEditorsHost);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
    const warnings = () =>
      warn.mock.calls.filter((call) =>
        String(call[0]).includes('headingAnchors'),
      ).length;
    expect(warnings()).toBe(1);
    fixture.componentInstance.useSecond.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.toc().ready()).toBe(false);
    expect(warnings()).toBe(1);
  });

  it('shows the empty state once ready, and names the landmark', async () => {
    const { host, nav, settle } = await mount((h) =>
      h.value.set('<p>Plain</p>'),
    );
    expect(
      nav.querySelector('.mlv-editor-toc__empty')?.textContent?.trim(),
    ).toBe('No headings yet');
    expect(nav.querySelector('ol')).toBeNull();
    expect(nav.getAttribute('aria-label')).toBe('Table of contents');
    host.ariaLabel.set('Guide contents');
    await settle();
    expect(nav.getAttribute('aria-label')).toBe('Guide contents');
  });

  it('keeps the items reference while typing in a paragraph, and the unchanged items while typing in a heading', async () => {
    const { editor, toc } = await mount();
    const before = toc.items();
    editor.view.dispatch(editor.state.tr.insertText('!', 10));
    expect(toc.items()).toBe(before);
    editor.view.dispatch(editor.state.tr.insertText('X', 21));
    const after = toc.items();
    expect(after).not.toBe(before);
    expect(after.map((item) => item.text)).toEqual([
      'Intro',
      'SXetup',
      'Usage',
    ]);
    expect(after[0]).toBe(before[0]);
    expect(after[2]).toBe(before[2]);
  });

  it('updates the list from a remote-origin transaction', async () => {
    const { editor, nav, toc, settle } = await mount();
    const { schema, doc, tr } = editor.state;
    editor.view.dispatch(
      tr
        .insert(
          doc.content.size,
          schema.nodes['heading'].create(
            { level: 2, anchor: 'remote-part' },
            schema.text('Remote part'),
          ),
        )
        .setMeta('origin', 'remote')
        .setMeta('addToHistory', false),
    );
    await settle();
    expect(toc.items().map((item) => item.text)).toContain('Remote part');
    expect(linkTexts(nav)).toContain('Remote part');
  });

  describe('activation', () => {
    /** Position of the top-level block whose text is `text`. */
    function blockPos(editor: Editor, text: string): number {
      let found = -1;
      editor.state.doc.forEach((node, offset) => {
        if (node.textContent === text) found = offset;
      });
      return found;
    }

    /** Stubs the reading line: ProseMirror margin 40, heading at 500. */
    function stubGeometry(editor: Editor, content: HTMLElement) {
      const someProp = editor.view.someProp.bind(editor.view);
      vi.spyOn(editor.view, 'someProp').mockImplementation(((
        name: string,
        f?: (value: unknown) => unknown,
      ) =>
        name === 'scrollMargin' && !f
          ? { top: 40, bottom: 5, left: 5, right: 5 }
          : someProp(name as never, f as never)) as never);
      const heading = Array.from(content.querySelectorAll('h2')).find(
        (element) => element.textContent === 'Setup',
      ) as HTMLElement;
      vi.spyOn(heading, 'getBoundingClientRect').mockReturnValue({
        top: 500,
      } as DOMRect);
      const margin = Number.parseFloat(
        getComputedStyle(heading).scrollMarginBlockStart,
      );
      return { heading, line: 40 + (Number.isFinite(margin) ? margin : 0) };
    }

    it('scrolls the heading to the reading line, puts the caret in it without scrolling or history, focuses, and emits', async () => {
      const { editor, content, nav, host } = await mount();
      const { line } = stubGeometry(editor, content);
      const scrollBy = vi
        .spyOn(window, 'scrollBy')
        .mockImplementation(() => undefined);
      const transactions: Transaction[] = [];
      editor.on('transaction', ({ transaction }) => {
        if (!transaction.getMeta('focus') && !transaction.getMeta('blur')) {
          transactions.push(transaction);
        }
      });
      const depth = undoDepth(editor.state);
      const event = click(link(nav, 'Setup'));

      expect(event.defaultPrevented).toBe(true);
      expect(scrollBy).toHaveBeenCalledWith({
        top: 500 - line,
        behavior: 'smooth',
      });
      expect(editor.state.selection.from).toBe(blockPos(editor, 'Setup') + 1);
      expect(transactions).toHaveLength(1);
      expect(transactions[0].scrolledIntoView).toBe(false);
      expect(transactions[0].docChanged).toBe(false);
      expect(undoDepth(editor.state)).toBe(depth);
      expect(document.activeElement).toBe(content);
      expect(host.clicks.map((item) => item.text)).toEqual(['Setup']);
    });

    it('scrolls instantly under prefers-reduced-motion', async () => {
      const { editor, content, nav } = await mount();
      const { line } = stubGeometry(editor, content);
      const scrollBy = vi
        .spyOn(window, 'scrollBy')
        .mockImplementation(() => undefined);
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: (query: string) => ({ matches: query.includes('reduce') }),
      });
      try {
        click(link(nav, 'Setup'));
      } finally {
        Reflect.deleteProperty(window, 'matchMedia');
      }
      expect(scrollBy).toHaveBeenCalledWith({
        top: 500 - line,
        behavior: 'auto',
      });
    });

    it('leaves a modified click to the browser', async () => {
      const { editor, content, nav, host } = await mount();
      stubGeometry(editor, content);
      const scrollBy = vi
        .spyOn(window, 'scrollBy')
        .mockImplementation(() => undefined);
      const selection = editor.state.selection;
      const event = click(link(nav, 'Setup'), { ctrlKey: true });
      expect(event.defaultPrevented).toBe(false);
      expect(scrollBy).not.toHaveBeenCalled();
      expect(editor.state.selection).toBe(selection);
      expect(host.clicks).toEqual([]);
    });

    it('only scrolls for a disabled editor', async () => {
      const { editor, content, nav, host } = await mount((h) =>
        h.disabled.set(true),
      );
      stubGeometry(editor, content);
      const scrollBy = vi
        .spyOn(window, 'scrollBy')
        .mockImplementation(() => undefined);
      const selection = editor.state.selection;
      click(link(nav, 'Setup'));
      expect(scrollBy).toHaveBeenCalledTimes(1);
      expect(editor.state.selection).toBe(selection);
      expect(document.activeElement).not.toBe(content);
      expect(host.clicks).toHaveLength(1);
    });

    it('moves the caret into the heading of a readonly editor, focusing with preventScroll', async () => {
      const { editor, content, nav } = await mount((h) => h.readonly.set(true));
      stubGeometry(editor, content);
      vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined);
      const focus = vi.spyOn(content, 'focus');
      click(link(nav, 'Setup'));
      expect(editor.state.selection.from).toBe(blockPos(editor, 'Setup') + 1);
      expect(focus).toHaveBeenCalledWith({ preventScroll: true });
      expect(document.activeElement).toBe(content);
    });
  });

  describe('active tracking', () => {
    interface Tracking {
      harness: Harness;
      frames: FrameRequestCallback[];
      tops: number[];
      line: number;
      reads: () => number;
      flush(): Promise<void>;
    }

    /**
     * Captures animation frames, stubs ProseMirror's margin at 40 and each
     * heading's top from `tops` (counting the reads), before the first render.
     */
    async function track(
      configure?: (host: TocHost) => void,
    ): Promise<Tracking> {
      const frames: FrameRequestCallback[] = [];
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
        (callback) => {
          frames.push(callback);
          return frames.length;
        },
      );
      vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(
        () => undefined,
      );
      const harness = await mount(configure);
      const { editor, content, settle } = harness;
      const someProp = editor.view.someProp.bind(editor.view);
      vi.spyOn(editor.view, 'someProp').mockImplementation(((
        name: string,
        f?: (value: unknown) => unknown,
      ) =>
        name === 'scrollMargin' && !f
          ? { top: 40, bottom: 5, left: 5, right: 5 }
          : someProp(name as never, f as never)) as never);
      const tops: number[] = [];
      let reads = 0;
      const headings = Array.from(
        content.querySelectorAll<HTMLElement>('h1, h2'),
      );
      headings.forEach((heading, index) =>
        vi.spyOn(heading, 'getBoundingClientRect').mockImplementation(() => {
          reads += 1;
          return { top: tops[index] } as DOMRect;
        }),
      );
      const margin = Number.parseFloat(
        getComputedStyle(headings[0]).scrollMarginBlockStart,
      );
      return {
        harness,
        frames,
        tops,
        line: 40 + (Number.isFinite(margin) ? margin : 0),
        reads: () => reads,
        async flush() {
          frames.splice(0).forEach((frame) => frame(0));
          await settle();
        },
      };
    }

    const anchors = (toc: MlvEditorToc) =>
      toc.items().map((item) => item.anchor);

    it('marks the last heading at or above the reading line, nothing above the first heading', async () => {
      const tracking = await track();
      const { toc, nav } = tracking.harness;
      const [intro, setup, usage] = anchors(toc);
      const cases: [number[], string | null][] = [
        [[tracking.line + 60, 400, 800], null],
        [[-200, tracking.line + 1, 800], setup],
        [[-200, tracking.line + 2, 800], intro],
        [[-600, -300, tracking.line - 1], usage],
      ];
      for (const [tops, expected] of cases) {
        tracking.tops.splice(0, 3, ...tops);
        window.dispatchEvent(new Event('resize'));
        await tracking.flush();
        expect(toc.activeAnchor()).toBe(expected);
      }
      expect(link(nav, 'Usage').classList).toContain(
        'mlv-editor-toc__link--active',
      );
      expect(link(nav, 'Usage').getAttribute('aria-current')).toBe('location');
      expect(link(nav, 'Intro').hasAttribute('aria-current')).toBe(false);
      expect(usage).toBeTruthy();
    });

    it('never marks a heading that is not laid out, whose all-zero rect would read as passed', async () => {
      const tracking = await track();
      const { toc, content } = tracking.harness;
      const [intro, , usage] = anchors(toc);
      // "Setup" sits in a collapsed block: `display: none`, an all-zero rect.
      const setup = content.querySelectorAll<HTMLElement>('h1, h2')[1];
      vi.spyOn(setup, 'getBoundingClientRect').mockReturnValue({
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        width: 0,
        height: 0,
      } as DOMRect);
      const cases: [number[], string | null][] = [
        [[-200, 0, 800], intro],
        [[-600, 0, -300], usage],
        [[tracking.line + 60, 0, 800], null],
      ];
      for (const [tops, expected] of cases) {
        tracking.tops.splice(0, 3, ...tops);
        window.dispatchEvent(new Event('resize'));
        await tracking.flush();
        expect(toc.activeAnchor()).toBe(expected);
      }
    });

    it('marks the last heading above the bottom edge once the page is scrolled to its end', async () => {
      const tracking = await track();
      const { toc } = tracking.harness;
      const root = document.documentElement;
      Object.defineProperty(root, 'scrollHeight', {
        configurable: true,
        value: 2000,
      });
      Object.defineProperty(root, 'clientHeight', {
        configurable: true,
        value: 768,
      });
      Object.defineProperty(root, 'scrollTop', {
        configurable: true,
        value: 1232,
      });
      try {
        tracking.tops.splice(0, 3, -900, -400, window.innerHeight - 10);
        document.dispatchEvent(new Event('scroll'));
        await tracking.flush();
        expect(toc.activeAnchor()).toBe(anchors(toc)[2]);
      } finally {
        Reflect.deleteProperty(root, 'scrollHeight');
        Reflect.deleteProperty(root, 'clientHeight');
        Reflect.deleteProperty(root, 'scrollTop');
      }
    });

    it('keeps at most one frame pending however many scroll events arrive, and reads at most ⌈log₂(n + 1)⌉ tops per frame', async () => {
      const tracking = await track();
      await tracking.flush();
      tracking.tops.splice(0, 3, -200, 10, 800);
      const before = tracking.reads();
      for (let index = 0; index < 20; index += 1) {
        document.body.dispatchEvent(new Event('scroll'));
      }
      window.dispatchEvent(new Event('resize'));
      expect(tracking.frames).toHaveLength(1);
      await tracking.flush();
      expect(tracking.reads() - before).toBeLessThanOrEqual(
        Math.ceil(Math.log2(4)),
      );
    });

    it('cancels a pending frame on destroy', async () => {
      const tracking = await track();
      tracking.tops.push(100, 300);
      const cancelled = new Set<number>();
      vi.mocked(window.cancelAnimationFrame).mockImplementation((id) => {
        cancelled.add(id);
      });
      document.dispatchEvent(new Event('scroll'));
      expect(tracking.frames.length).toBeGreaterThan(0);
      const reads = tracking.reads();
      // Destroy the TOC alone: the editor stays, so a frame left pending
      // would still find headings to measure.
      tracking.harness.host.showToc.set(false);
      tracking.harness.fixture.detectChanges();
      // Run every frame nobody cancelled: the TOC's must not be among them.
      tracking.frames.forEach((frame, index) => {
        if (!cancelled.has(index + 1)) frame(0);
      });
      expect(tracking.reads()).toBe(reads);
    });
  });

  it('binds its scroll listener to the injected DOCUMENT, and releases it on destroy', async () => {
    const isolated = document.implementation.createHTMLDocument('toc');
    const net = trackListeners(isolated);
    const ambient = trackListeners(document);
    await TestBed.configureTestingModule({
      imports: [StubTocHost],
      providers: [
        provideMlvI18nTesting(),
        { provide: DOCUMENT, useValue: isolated },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(StubTocHost);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(net.get('scroll')).toBe(1);
    expect(ambient.get('scroll')).toBeUndefined();
    fixture.destroy();
    expect(net.get('scroll')).toBe(0);
  });

  describe('axe', () => {
    it('sweeps the empty state once ready', async () => {
      const { root, nav } = await mount((host) =>
        host.value.set('<p>Plain</p>'),
      );
      expect(nav.querySelector('.mlv-editor-toc__empty')).not.toBeNull();
      await expectNoAxeViolations(root);
    });

    it('sweeps the populated list', async () => {
      const { root } = await mount();
      await expectNoAxeViolations(root);
    });

    it('sweeps the list with an active item', async () => {
      const frames: FrameRequestCallback[] = [];
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
        (callback) => {
          frames.push(callback);
          return frames.length;
        },
      );
      const { root, nav, content, settle } = await mount();
      content
        .querySelectorAll<HTMLElement>('h1, h2')
        .forEach((heading, index) =>
          vi
            .spyOn(heading, 'getBoundingClientRect')
            .mockReturnValue({ top: index === 0 ? -100 : 900 } as DOMRect),
        );
      frames.splice(0).forEach((frame) => frame(0));
      await settle();
      expect(nav.querySelector('[aria-current="location"]')).not.toBeNull();
      await expectNoAxeViolations(root);
    });

    it('sweeps the list beside a readonly editor', async () => {
      const { root } = await mount((host) => host.readonly.set(true));
      await expectNoAxeViolations(root);
    });

    it('sweeps the populated list under a scoped [dir="rtl"]', async () => {
      const { root, nav } = await mount((host) => host.dir.set('rtl'));
      expect(TestBed.inject(MlvRtlService).direction()).toBe('ltr');
      expect(nav.closest('[dir]')?.getAttribute('dir')).toBe('rtl');
      expect(linkTexts(nav)).toEqual(['Intro', 'Setup', 'Usage']);
      await expectNoAxeViolations(root);
    });
  });
});

@Component({
  imports: [MlvEditorToc],
  template: `<nav mlvEditorToc [context]="context"></nav>`,
})
class StubTocHost {
  readonly context = {
    editor: signal<Editor | null>(null),
    disabled: signal(false),
    readonly: signal(false),
  } as unknown as MlvEditorToolbarContext;
}

/** Net listener count per event type on `target` (spies both methods). */
function trackListeners(target: EventTarget): Map<string, number> {
  const net = new Map<string, number>();
  const bump = (type: string, delta: number): void =>
    void net.set(type, (net.get(type) ?? 0) + delta);
  const realAdd = target.addEventListener.bind(target);
  const realRemove = target.removeEventListener.bind(target);
  vi.spyOn(target, 'addEventListener').mockImplementation(
    (type, listener, options) => {
      bump(type, 1);
      realAdd(type, listener, options);
    },
  );
  vi.spyOn(target, 'removeEventListener').mockImplementation(
    (type, listener, options) => {
      bump(type, -1);
      realRemove(type, listener, options);
    },
  );
  return net;
}
