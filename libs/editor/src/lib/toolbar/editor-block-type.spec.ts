import { Component, signal, viewChild } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import type { Editor, Extensions } from '@tiptap/core';
import { closeHistory } from '@tiptap/pm/history';
import StarterKit from '@tiptap/starter-kit';
import { MlvEditor } from '../editor/editor';
import { MlvEditorBlockType } from './editor-block-type';
import type { MlvEditorHeadingLevel } from './editor-heading';
import { MlvEditorToolbarStartDef } from './editor-toolbar.defs';

@Component({
  imports: [MlvEditor, MlvEditorBlockType, MlvEditorToolbarStartDef],
  template: `
    <mlv-editor
      label="Block type"
      [value]="value()"
      [extensions]="extensions()"
      [readonly]="readonly()"
    >
      <mlv-editor-block-type mlvEditorToolbarStart [levels]="levels()" />
    </mlv-editor>
  `,
})
class BlockTypeHost {
  readonly value = signal<string | null>(
    '<p>Plain</p><h2>Second</h2><ul><li><p>Item</p></li></ul>' +
      '<blockquote><p>Quote</p></blockquote><pre><code>code</code></pre>',
  );
  readonly extensions = signal<Extensions | undefined>(undefined);
  readonly levels = signal<readonly MlvEditorHeadingLevel[]>([1, 2, 3]);
  readonly readonly = signal(false);
  readonly editor = viewChild.required(MlvEditor);
}

interface Harness {
  fixture: ComponentFixture<BlockTypeHost>;
  root: HTMLElement;
  editor: Editor;
  trigger: HTMLButtonElement;
  settle(): Promise<void>;
  caretIn(text: string): Promise<void>;
  open(): Promise<HTMLElement>;
  items(): HTMLElement[];
  choose(label: string): Promise<void>;
}

async function mount(
  configure?: (host: BlockTypeHost) => void,
): Promise<Harness> {
  await TestBed.configureTestingModule({
    imports: [BlockTypeHost],
    providers: [provideMlvI18nTesting()],
  }).compileComponents();
  const fixture = TestBed.createComponent(BlockTypeHost);
  configure?.(fixture.componentInstance);
  document.body.appendChild(fixture.nativeElement);
  fixture.detectChanges();
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const editor = fixture.componentInstance.editor().editor();
  if (!editor) throw new Error('Expected a mounted Tiptap editor.');
  const settle = async () => {
    await Promise.resolve();
    fixture.detectChanges();
    await fixture.whenStable();
  };
  const panel = () => document.querySelector<HTMLElement>('.mlv-menu__panel');
  const items = () => [
    ...(panel()?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []),
  ];
  const harness: Harness = {
    fixture,
    root,
    editor,
    trigger: root.querySelector(
      '.mlv-editor-block-type button',
    ) as HTMLButtonElement,
    settle,
    caretIn: async (text) => {
      let position = -1;
      editor.state.doc.descendants((node, pos) => {
        if (position < 0 && node.isText && node.text?.includes(text)) {
          position = pos + 1;
        }
      });
      if (position < 0) throw new Error(`No text "${text}" in the document.`);
      editor.commands.setTextSelection(position);
      await settle();
    },
    open: async () => {
      harness.trigger.click();
      await settle();
      const open = panel();
      if (!open) throw new Error('Expected the block-type menu to open.');
      return open;
    },
    items,
    choose: async (label) => {
      const item = items().find((each) => each.textContent?.trim() === label);
      if (!item) throw new Error(`No menu item "${label}".`);
      item.click();
      await settle();
    },
  };
  await settle();
  return harness;
}

const labels = (items: HTMLElement[]) =>
  items.map((item) => item.textContent?.trim());

describe('MlvEditorBlockType (#516)', () => {
  it('names the trigger after the block at the caret, innermost type first', async () => {
    const { trigger, caretIn } = await mount();
    const cases: readonly (readonly [string, string])[] = [
      ['Plain', 'Paragraph'],
      ['Second', 'Heading level 2'],
      ['Item', 'Bullet list'],
      ['Quote', 'Blockquote'],
      ['code', 'Code block'],
    ];
    for (const [text, label] of cases) {
      await caretIn(text);
      expect(trigger.textContent?.trim()).toBe(label);
      expect(trigger.getAttribute('aria-label')).toBe(`Block type: ${label}`);
    }
  });

  it('offers paragraph, the levels, the lists, quote and code block, marking the current one', async () => {
    const { open, items, caretIn } = await mount();
    await caretIn('Second');
    await open();
    expect(labels(items())).toEqual([
      'Paragraph',
      'Heading level 1',
      'Heading level 2',
      'Heading level 3',
      'Bullet list',
      'Ordered list',
      'Task list',
      'Blockquote',
      'Code block',
    ]);
    const current = items().filter(
      (item) => item.getAttribute('aria-current') === 'true',
    );
    expect(labels(current)).toEqual(['Heading level 2']);
  });

  it('converts in one transaction, so one undo restores the block', async () => {
    const { editor, open, choose, caretIn } = await mount();
    const before = editor.getHTML();
    await caretIn('Plain');
    await open();
    let changes = 0;
    const count = ({
      transaction,
    }: {
      transaction: { docChanged: boolean };
    }) => {
      if (transaction.docChanged) changes += 1;
    };
    editor.on('transaction', count);
    await choose('Heading level 1');
    editor.off('transaction', count);
    expect(changes).toBe(1);
    expect(editor.getHTML()).toContain('<h1>Plain</h1>');
    editor.commands.undo();
    expect(editor.getHTML()).toBe(before);
  });

  it('converts out of a list and a quote instead of nesting', async () => {
    const { editor, open, choose, caretIn } = await mount();
    await caretIn('Item');
    await open();
    await choose('Paragraph');
    expect(editor.getHTML()).not.toContain('<ul>');
    expect(editor.getHTML()).toContain('<p>Item</p>');

    await caretIn('Quote');
    await open();
    await choose('Heading level 3');
    expect(editor.getHTML()).not.toContain('<blockquote>');
    expect(editor.getHTML()).toContain('<h3>Quote</h3>');
  });

  it('wraps a multi-paragraph selection inside a table cell in one list, keeping the table', async () => {
    const { editor, fixture, open, choose, settle } = await mount((host) =>
      host.value.set('<p>Before</p>'),
    );
    editor
      .chain()
      .setContent('<p>Before</p>')
      .setTextSelection(1)
      .insertTable({ rows: 2, cols: 2, withHeaderRow: false })
      .run();
    // Two paragraphs in the first cell.
    editor.commands.insertContent('<p>One</p><p>Two</p>');
    await settle();
    let from = -1;
    let to = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'One') from = pos;
      if (node.isText && node.text === 'Two') to = pos + 3;
    });
    editor.commands.setTextSelection({ from, to });
    // Starts a new history group, so the undo below reverts the conversion
    // alone and not the table set-up typed just before it.
    editor.view.dispatch(closeHistory(editor.state.tr));
    fixture.detectChanges();
    await settle();
    const before = editor.getJSON();

    await open();
    await choose('Bullet list');
    const html = editor.getHTML();
    expect(html).toContain('<table');
    expect(html).toMatch(
      /<td[^>]*><ul><li><p>One<\/p><\/li><li><p>Two<\/p><\/li><\/ul><\/td>/u,
    );
    editor.commands.undo();
    expect(editor.getJSON()).toEqual(before);
  });

  it('follows levels and hides types whose extension is missing', async () => {
    const { open, items } = await mount((host) => {
      host.extensions.set([
        StarterKit.configure({
          heading: { levels: [1, 2] },
          codeBlock: false,
          blockquote: false,
        }),
      ]);
      host.value.set('<p>Plain</p>');
      host.levels.set([2, 3, 1, 2]);
    });
    await open();
    expect(labels(items())).toEqual([
      'Paragraph',
      'Heading level 2',
      'Heading level 1',
      'Bullet list',
      'Ordered list',
    ]);
  });

  it('disables the trigger while readonly', async () => {
    const { fixture, trigger, settle } = await mount();
    expect(trigger.disabled).toBe(false);
    fixture.componentInstance.readonly.set(true);
    await settle();
    // A readonly editor renders no bar at all (#498): nothing to reach.
    expect(
      fixture.nativeElement.querySelector('.mlv-editor-block-type'),
    ).toBeNull();
  });

  it('has no axe violations with the menu open', async () => {
    const { open, caretIn } = await mount();
    await caretIn('Plain');
    await open();
    await expectNoAxeViolations(document.body);
  });
});
