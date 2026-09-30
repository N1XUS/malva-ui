import { Component, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MlvEditor } from '../editor/editor';
import { mlvEditorDefaultExtensions } from '../extensions/editor-extensions';
import { MlvEditorToc } from './editor-toc';
import {
  collectMlvEditorTocHeadings,
  mlvEditorTocHeadingsEqual,
  type MlvEditorTocHeading,
  type MlvEditorTocMemo,
} from './editor-toc-headings';

/**
 * § 13 of the clean-mode design budgets the TOC in time; unit tests assert the
 * work instead, because wall-clock thresholds are flaky on shared runners.
 * The measured milliseconds are reported in the PR, not asserted here.
 */

/** `blocks` top-level blocks, one `<h2>` every `every` blocks. */
function documentHtml(blocks: number, every: number): string {
  let html = '';
  for (let index = 0; index < blocks; index += 1) {
    html +=
      index % every === 0
        ? `<h2>Section ${index / every}</h2>`
        : `<p>Paragraph ${index} with a few words of text.</p>`;
  }
  return html;
}

/** A memo that counts its misses — the top-level blocks actually walked. */
function countingMemo(): MlvEditorTocMemo & { misses: number } {
  const map = new WeakMap<ProseMirrorNode, readonly MlvEditorTocHeading[]>();
  return {
    misses: 0,
    get(block) {
      const found = map.get(block);
      if (!found) this.misses += 1;
      return found;
    },
    set(block, value) {
      map.set(block, value);
      return this as never;
    },
  };
}

const editors: Editor[] = [];

afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('MlvEditorToc work per keystroke (#516, § 13)', () => {
  function createEditor(): Editor {
    const element = document.createElement('div');
    document.body.append(element);
    const editor = new Editor({
      element,
      extensions: mlvEditorDefaultExtensions({ headingAnchors: true }),
    });
    editors.push(editor);
    // Loaded the way MlvEditor loads a value, so the anchors are assigned.
    editor
      .chain()
      .setMeta('addToHistory', false)
      .setContent(documentHtml(2000, 10), { emitUpdate: false })
      .run();
    return editor;
  }

  /** Position just inside the first text of the top-level block at `index`. */
  function textPos(editor: Editor, index: number): number {
    let pos = -1;
    editor.state.doc.forEach((_node, offset, blockIndex) => {
      if (blockIndex === index) pos = offset + 2;
    });
    return pos;
  }

  it('walks one block for a keystroke in a paragraph and leaves the list equal', () => {
    const editor = createEditor();
    const memo = countingMemo();
    const before = collectMlvEditorTocHeadings(editor.state.doc, memo);
    expect(before).toHaveLength(200);
    expect(memo.misses).toBe(2000);

    memo.misses = 0;
    editor.view.dispatch(
      editor.state.tr.insertText('x', textPos(editor, 1001)),
    );
    const after = collectMlvEditorTocHeadings(editor.state.doc, memo);
    expect(memo.misses).toBe(1);
    expect(mlvEditorTocHeadingsEqual(before, after)).toBe(true);
  });

  it('walks one block for a keystroke in a heading', () => {
    const editor = createEditor();
    const memo = countingMemo();
    const before = collectMlvEditorTocHeadings(editor.state.doc, memo);

    memo.misses = 0;
    editor.view.dispatch(
      editor.state.tr.insertText('x', textPos(editor, 1000)),
    );
    const after = collectMlvEditorTocHeadings(editor.state.doc, memo);
    expect(memo.misses).toBe(1);
    expect(mlvEditorTocHeadingsEqual(before, after)).toBe(false);
    expect(
      after.filter((heading, index) => heading !== before[index]),
    ).toHaveLength(1);
  });
});

@Component({
  imports: [MlvEditor, MlvEditorToc],
  template: `
    <mlv-editor #doc label="Document" [value]="value" [headingAnchors]="true" />
    <nav mlvEditorToc [context]="doc"></nav>
  `,
})
class PerfHost {
  readonly value = documentHtml(400, 2);
  readonly toc = viewChild.required(MlvEditorToc);
}

describe('MlvEditorToc rect reads per frame (#516, § 13)', () => {
  it('reads at most ⌈log₂ n⌉ + 2 rects per frame over 200 headings', async () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    await TestBed.configureTestingModule({
      imports: [PerfHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(PerfHost);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.toc().items()).toHaveLength(200);

    const headings = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        '.ProseMirror h2',
      ),
    );
    const position = new Map(
      headings.map((heading, index) => [heading, index]),
    );
    let reads = 0;
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: Element) {
        if (position.has(this as HTMLElement)) reads += 1;
        return {
          top: ((position.get(this as HTMLElement) ?? 0) - 120) * 40,
        } as DOMRect;
      },
    );
    frames.splice(0).forEach((frame) => frame(0));
    reads = 0;
    for (let index = 0; index < 5; index += 1) {
      // The editor schedules its own frames too; the TOC adds at most one,
      // however many scroll events arrive before it runs.
      document.body.dispatchEvent(new Event('scroll'));
      const pending = frames.length;
      for (let burst = 0; burst < 20; burst += 1) {
        document.body.dispatchEvent(new Event('scroll'));
      }
      expect(frames).toHaveLength(pending);
      frames.splice(0).forEach((frame) => frame(0));
    }
    expect(reads / 5).toBeLessThanOrEqual(Math.ceil(Math.log2(200)) + 2);
    expect(fixture.componentInstance.toc().activeAnchor()).toBe(
      fixture.componentInstance.toc().items()[120].anchor,
    );
    fixture.destroy();
  });
});
