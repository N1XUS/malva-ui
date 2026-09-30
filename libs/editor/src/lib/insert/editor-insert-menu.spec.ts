import { Component, getDebugNode, signal, viewChild } from '@angular/core';
import type { Provider } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { LucideMessageSquare, provideLucideIcons } from '@lucide/angular';
import { TestBed } from '@angular/core/testing';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { MlvContextMenuTrigger } from '@malva-ui/core/menu';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import type { Editor } from '@tiptap/core';
import { undo, undoDepth } from '@tiptap/pm/history';
import type { Transaction } from '@tiptap/pm/state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MLV_EDITOR_AI_CONTEXT } from '../ai/editor-ai-context';
import { MLV_EDITOR_AI_PROMPT } from '../ai/editor-ai-prompt';
import type { MlvEditorAiProvider } from '../ai/editor-ai.types';
import { MlvEditor } from '../editor/editor';
import type {
  MlvEditorError,
  MlvEditorImageUploader,
  MlvEditorToolbarAppearance,
} from '../editor.types';
import { mlvEditorBlockInserter } from '../extensions/editor-block-inserter';
import { mlvEditorDefaultInsertItems } from './editor-insert-items';
import type { MlvEditorInsertMenu } from './editor-insert-menu';
import type { MlvEditorInsertItem } from './editor-insert.types';

/** A provider that answers every request with one chunk. */
const PROVIDER: MlvEditorAiProvider = {
  async *stream() {
    yield 'Improved';
  },
};

/** An uploader that never settles: the dialog only has to open. */
const UPLOADER: MlvEditorImageUploader = {
  upload: () => new Promise(() => undefined),
};

@Component({
  imports: [MlvEditor],
  template: `
    <div [attr.dir]="dir()">
      <mlv-editor
        label="Clean"
        [value]="value()"
        [aiProvider]="provider()"
        [imageUploader]="uploader()"
        [insertItems]="items()"
        [readonly]="readonly()"
        [disabled]="disabled()"
        [toolbarAppearance]="appearance()"
        (editorError)="errors.push($event)"
      />
    </div>
  `,
})
class MenuHost {
  readonly value = signal<string | null>('<p>Alpha beta</p><p>Gamma</p>');
  readonly provider = signal<MlvEditorAiProvider | undefined>(PROVIDER);
  readonly uploader = signal<MlvEditorImageUploader | undefined>(undefined);
  readonly items = signal<readonly MlvEditorInsertItem[] | undefined>(
    undefined,
  );
  readonly readonly = signal(false);
  readonly disabled = signal(false);
  readonly appearance = signal<MlvEditorToolbarAppearance>('clean');
  readonly dir = signal<'ltr' | 'rtl' | null>(null);
  readonly errors: MlvEditorError[] = [];
  readonly editor = viewChild.required(MlvEditor);
}

interface Harness {
  fixture: ComponentFixture<MenuHost>;
  root: HTMLElement;
  editor: Editor;
  content: HTMLElement;
  settle(): Promise<void>;
  caret(pos: number): Promise<void>;
  menu(): MlvEditorInsertMenu | null;
  /** Transactions dispatched since mount, focus / blur bookkeeping excluded. */
  transactions: Transaction[];
}

async function mount(
  configure?: (host: MenuHost) => void,
  providers: Provider[] = [],
): Promise<Harness> {
  await TestBed.configureTestingModule({
    imports: [MenuHost],
    providers: [provideMlvI18nTesting(), ...providers],
  }).compileComponents();
  const fixture = TestBed.createComponent(MenuHost);
  configure?.(fixture.componentInstance);
  document.body.appendChild(fixture.nativeElement);
  fixture.detectChanges();
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const editor = fixture.componentInstance.editor().editor();
  if (!editor) throw new Error('Expected a mounted Tiptap editor.');
  const settle = async () => {
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
    await fixture.whenStable();
  };
  await settle();
  const content = root.querySelector('.ProseMirror') as HTMLElement;
  const transactions: Transaction[] = [];
  editor.on('transaction', ({ transaction }) => {
    if (transaction.getMeta('focus') || transaction.getMeta('blur')) return;
    transactions.push(transaction);
  });
  return {
    fixture,
    root,
    editor,
    content,
    settle,
    transactions,
    caret: async (pos) => {
      content.focus();
      editor.commands.setTextSelection(pos);
      await settle();
    },
    menu: () => {
      const element = root.querySelector('mlv-editor-insert-menu');
      return element
        ? (getDebugNode(element)?.componentInstance as MlvEditorInsertMenu)
        : null;
    },
  };
}

/** Presses Mod+Alt+Enter (Control here: jsdom reports no Apple platform). */
function chord(content: HTMLElement): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: 'Enter',
    ctrlKey: true,
    altKey: true,
    bubbles: true,
    cancelable: true,
  });
  content.dispatchEvent(event);
  return event;
}

/** Waits one task: the keyboard open focuses its first item a task later. */
const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve));

function panel(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.mlv-menu__panel');
}

function menuItems(): HTMLElement[] {
  return [
    ...(panel()?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []),
  ];
}

function itemLabels(): string[] {
  return menuItems().map((item) => item.textContent?.trim() ?? '');
}

function groupLabels(): string[] {
  return [...(panel()?.querySelectorAll('[mlvMenuGroupLabel]') ?? [])].map(
    (label) => label.textContent?.trim() ?? '',
  );
}

async function choose(label: string, settle: () => Promise<void>) {
  const item = menuItems().find(
    (element) => element.textContent?.trim() === label,
  );
  if (!item) {
    throw new Error(`Expected the "${label}" item in [${itemLabels()}].`);
  }
  item.click();
  await settle();
}

/** Ends the popup leave animation jsdom never runs, detaching the panel. */
async function completeClose(settle: () => Promise<void>) {
  document
    .querySelectorAll('.mlv-popup--leave')
    .forEach((element) =>
      element.dispatchEvent(new Event('animationend', { bubbles: true })),
    );
  await settle();
}

/** Presses Escape in the panel and lets it detach. */
async function escape(settle: () => Promise<void>) {
  const focused = document.activeElement as HTMLElement | null;
  const target = focused && panel()?.contains(focused) ? focused : panel();
  target?.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    }),
  );
  await settle();
  await completeClose(settle);
}

/** A plain `DOMRect`-shaped value; jsdom has no `DOMRect` constructor. */
function rect(left: number, top: number, width: number, height: number) {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  } as DOMRect;
}

const blockTypes = (editor: Editor) =>
  editor.getJSON().content?.map((node) => node.type) ?? [];

describe('MlvEditorInsertMenu (#516, U7)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.inject(MlvRtlService).setDirection('ltr');
  });

  it('lists the built-in groups in order under their labels, AI first with a provider', async () => {
    const { content, caret, settle } = await mount();
    await caret(2);
    expect(chord(content).defaultPrevented).toBe(true);
    await settle();
    expect(panel()?.getAttribute('aria-label')).toBe('Insert block');
    expect(groupLabels()).toEqual(['AI', 'Basic blocks', 'Lists', 'Insert']);
    expect(itemLabels()).toEqual([
      'Ask AI…',
      'Paragraph',
      'Heading level 1',
      'Heading level 2',
      'Heading level 3',
      'Blockquote',
      'Code block',
      'Bullet list',
      'Ordered list',
      'Task list',
      'Insert table',
      'Horizontal rule',
    ]);
  });

  it('drops the AI group without a provider and the image item without an uploader', async () => {
    const { content, caret, settle } = await mount((host) =>
      host.provider.set(undefined),
    );
    await caret(2);
    chord(content);
    await settle();
    expect(groupLabels()).toEqual(['Basic blocks', 'Lists', 'Insert']);
    expect(itemLabels()).not.toContain('Ask AI…');
    expect(itemLabels()).not.toContain('Upload image');
  });

  it('inserts the chosen block after a non-empty source in one undoable transaction, caret inside', async () => {
    const { editor, content, caret, settle, transactions } = await mount();
    await caret(2);
    chord(content);
    await settle();
    const before = editor.state.doc;
    transactions.length = 0;
    await choose('Heading level 2', settle);

    expect(blockTypes(editor)).toEqual(['paragraph', 'heading', 'paragraph']);
    expect(editor.getJSON().content?.[1]?.attrs?.['level']).toBe(2);
    expect(transactions.filter((tr) => tr.docChanged)).toHaveLength(1);
    const { $head } = editor.state.selection;
    expect($head.parent.type.name).toBe('heading');
    expect(editor.state.selection.empty).toBe(true);

    // Undo applied off-view: jsdom has no `getClientRects` for the scroll
    // into view a dispatched undo asks for.
    let restored = editor.state;
    expect(undoDepth(editor.state)).toBe(1);
    undo(editor.state, (tr) => {
      restored = editor.state.apply(tr);
    });
    expect(restored.doc.eq(before)).toBe(true);
  });

  it('converts an empty source paragraph in place', async () => {
    const { editor, content, caret, settle } = await mount((host) =>
      host.value.set('<p></p><p>Alpha</p>'),
    );
    await caret(1);
    chord(content);
    await settle();
    await choose('Bullet list', settle);
    expect(blockTypes(editor)).toEqual(['bulletList', 'paragraph']);
    expect(editor.state.selection.$head.parent.type.name).toBe('paragraph');
    expect(editor.state.selection.$head.node(-1).type.name).toBe('listItem');
  });

  it('resolves the target when the item runs, not when the menu opened', async () => {
    const { editor, content, caret, settle } = await mount();
    await caret(2);
    chord(content);
    await settle();
    editor.commands.setTextSelection(14);
    await settle();
    await choose('Horizontal rule', settle);
    expect(blockTypes(editor)).toEqual([
      'paragraph',
      'paragraph',
      'horizontalRule',
      'paragraph',
    ]);
  });

  it('leaves the document untouched when dismissed, and returns focus with the caret intact (D-B2)', async () => {
    const { editor, content, caret, settle, transactions } = await mount();
    await caret(4);
    const doc = editor.state.doc;
    const undoDepth = editor.can().undo();
    transactions.length = 0;

    chord(content);
    await settle();
    await nextTask();
    await settle();
    expect(document.activeElement).toBe(menuItems()[0]);
    await escape(settle);

    expect(panel()).toBeNull();
    expect(transactions).toHaveLength(0);
    expect(editor.state.doc).toBe(doc);
    expect(editor.can().undo()).toBe(undoDepth);
    expect(document.activeElement).toBe(content);
    expect(editor.state.selection.from).toBe(4);
  });

  it('collapses into another source block with one selection-only transaction', async () => {
    const { editor, caret, settle, transactions, menu } = await mount();
    await caret(2);
    const doc = editor.state.doc;
    transactions.length = 0;

    menu()?.open({ pos: 12, rect: rect(0, 0, 24, 24), via: 'pointer' });
    await settle();
    expect(panel()).not.toBeNull();
    expect(transactions).toHaveLength(1);
    expect(transactions[0].docChanged).toBe(false);
    expect(transactions[0].getMeta('addToHistory')).toBe(false);
    expect(editor.state.selection.from).toBe(18);

    await escape(settle);
    expect(transactions).toHaveLength(1);
    expect(editor.state.doc).toBe(doc);
  });

  it('previews the insertion point while open and retracts it on close', async () => {
    const { root, content, caret, settle } = await mount();
    await caret(2);
    chord(content);
    await settle();
    const indicator = root.querySelector('.mlv-editor__drop-indicator');
    expect(indicator?.getAttribute('data-visible')).toBe('true');
    await escape(settle);
    expect(indicator?.getAttribute('data-visible')).toBe('false');
  });

  it('reports an item that throws as a recoverable unsupported-command error', async () => {
    const { fixture, content, caret, settle } = await mount((host) =>
      host.items.set([
        {
          id: 'broken',
          label: 'Broken',
          group: 'custom',
          run: () => {
            throw new Error('boom');
          },
        },
      ]),
    );
    await caret(2);
    chord(content);
    await settle();
    await choose('Broken', settle);
    expect(
      fixture.componentInstance.errors.map(({ code, recoverable }) => ({
        code,
        recoverable,
      })),
    ).toEqual([{ code: 'unsupported-command', recoverable: true }]);
  });

  it('renders no icon for an unregistered icon name, warns once per name, and the item still runs', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const run = vi.fn(() => true);
    const { content, caret, settle } = await mount((host) =>
      host.items.set([
        {
          id: 'note',
          label: 'Note',
          group: 'custom',
          icon: 'message-square',
          run,
        },
        {
          id: 'aside',
          label: 'Aside',
          group: 'custom',
          icon: 'message-square',
          run: () => true,
        },
      ]),
    );
    const iconWarnings = () =>
      warn.mock.calls.filter(([message]) =>
        String(message).includes("'message-square'"),
      );
    await caret(2);
    chord(content);
    await settle();
    expect(itemLabels()).toEqual(['Note', 'Aside']);
    expect(
      panel()?.querySelectorAll('.mlv-editor-insert-menu__icon').length,
    ).toBe(0);
    expect(iconWarnings()).toHaveLength(1);

    await choose('Note', settle);
    expect(run).toHaveBeenCalledTimes(1);
    await completeClose(settle);
    chord(content);
    await settle();
    expect(itemLabels()).toEqual(['Note', 'Aside']);
    expect(iconWarnings()).toHaveLength(1);
  });

  it('renders an icon name the application registered with provideLucideIcons', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { content, caret, settle } = await mount(
      (host) =>
        host.items.set([
          {
            id: 'note',
            label: 'Note',
            group: 'custom',
            icon: 'message-square',
            run: () => true,
          },
        ]),
      [provideLucideIcons(LucideMessageSquare)],
    );
    await caret(2);
    chord(content);
    await settle();
    expect(
      panel()?.querySelectorAll('.mlv-editor-insert-menu__icon').length,
    ).toBe(1);
    expect(
      warn.mock.calls.filter(([message]) =>
        String(message).includes('message-square'),
      ),
    ).toEqual([]);
  });

  it('replaces the defaults with insertItems, and extends them by spreading the defaults', async () => {
    const callout: MlvEditorInsertItem = {
      id: 'callout',
      label: 'Callout',
      group: 'custom',
      run: ({ chain }) => chain().toggleBlockquote().run(),
    };
    const { fixture, content, caret, settle } = await mount((host) =>
      host.items.set([callout]),
    );
    await caret(2);
    chord(content);
    await settle();
    expect(itemLabels()).toEqual(['Callout']);
    expect(groupLabels()).toEqual([]);
    await escape(settle);

    fixture.componentInstance.items.set([
      ...mlvEditorDefaultInsertItems(),
      callout,
    ]);
    await settle();
    chord(content);
    await settle();
    expect(itemLabels().at(-1)).toBe('Callout');
    expect(itemLabels()[0]).toBe('Ask AI…');
  });

  it('hides unavailable items and disables items that are not enabled', async () => {
    const { content, caret, settle } = await mount((host) =>
      host.items.set([
        { id: 'a', label: 'Shown', group: 'style', run: () => true },
        {
          id: 'b',
          label: 'Absent',
          group: 'style',
          available: () => false,
          run: () => true,
        },
        {
          id: 'c',
          label: 'Greyed',
          group: 'style',
          enabled: () => false,
          run: () => true,
        },
      ]),
    );
    await caret(2);
    chord(content);
    await settle();
    expect(itemLabels()).toEqual(['Shown', 'Greyed']);
    expect(menuItems()[1].getAttribute('aria-disabled')).toBe('true');
  });

  it('disables Ask AI while the AI cannot start, and opens the prompt for insert-below', async () => {
    const { editor, root, content, caret, settle } = await mount();
    const element = root.querySelector('mlv-editor') as HTMLElement;
    const injector = getDebugNode(element)?.injector;
    const ai = injector?.get(MLV_EDITOR_AI_CONTEXT);
    const prompt = injector?.get(MLV_EDITOR_AI_PROMPT);
    if (!ai || !prompt) throw new Error('Expected the AI context and prompt.');
    const open = vi.spyOn(prompt, 'open').mockImplementation(() => undefined);

    const canStart = vi.spyOn(ai, 'canStart').mockReturnValue(false);
    await caret(2);
    chord(content);
    await settle();
    expect(menuItems()[0].getAttribute('aria-disabled')).toBe('true');
    await escape(settle);

    canStart.mockReturnValue(true);
    chord(content);
    await settle();
    expect(menuItems()[0].hasAttribute('aria-disabled')).toBe(false);
    const doc = editor.state.doc;
    await choose('Ask AI…', settle);
    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0][0].output).toBe('insert-below');
    expect(typeof open.mock.calls[0][0].anchor.top).toBe('number');
    // Nothing is written until the prompt applies: the caret stays in the
    // source block the output lands below.
    expect(editor.state.doc).toBe(doc);
    expect(editor.state.selection.$head.parent.textContent).toBe('Alpha beta');
  });

  it('opens the shared upload dialog from the image item; a dismiss leaves the document untouched and returns focus', async () => {
    const { editor, content, caret, settle, transactions } = await mount(
      (host) => host.uploader.set(UPLOADER),
    );
    await caret(2);
    chord(content);
    await settle();
    const before = JSON.stringify(editor.getJSON());
    const depth = undoDepth(editor.state);
    await choose('Upload image', settle);
    const dialog = document.querySelector('mlv-editor-image-upload-dialog');
    expect(dialog).not.toBeNull();
    // No block is prepared before an upload starts.
    expect(transactions.some((tr) => tr.docChanged)).toBe(false);

    document
      .querySelector('.mlv-dialog-container')
      ?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    // Ends the dialog leave animation jsdom never runs.
    document
      .querySelector('.mlv-dialog')
      ?.dispatchEvent(new Event('animationend'));
    await settle();
    expect(document.querySelector('mlv-editor-image-upload-dialog')).toBeNull();
    expect(document.activeElement).toBe(content);
    expect(JSON.stringify(editor.getJSON())).toBe(before);
    expect(undoDepth(editor.state)).toBe(depth);
  });

  // `<p>Alpha beta</p><p></p><p>Gamma</p>`: 2 is in "Alpha beta", 13 in the
  // empty paragraph.
  it.each([
    [
      'after a non-empty source',
      2,
      ['paragraph:Alpha beta', 'image:', 'paragraph:', 'paragraph:Gamma'],
    ],
    [
      'in place of an empty paragraph source',
      13,
      ['paragraph:Alpha beta', 'image:', 'paragraph:Gamma'],
    ],
  ] as const)(
    'lands a submitted image %s, creating no extra paragraph',
    async (_case, pos, expected) => {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:menu-image');
      vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);
      const upload = vi
        .fn()
        .mockResolvedValue({ src: 'https://cdn.test/menu.png' });
      const { editor, content, caret, settle } = await mount((host) => {
        host.uploader.set({ upload });
        host.value.set('<p>Alpha beta</p><p></p><p>Gamma</p>');
      });
      await caret(pos);
      chord(content);
      await settle();
      await choose('Upload image', settle);
      const file = new File(['image'], 'menu.png', { type: 'image/png' });
      const input = document.querySelector<HTMLInputElement>(
        '.mlv-file-upload__input',
      );
      if (!input) throw new Error('Expected the dialog file input.');
      Object.defineProperty(input, 'files', {
        configurable: true,
        value: [file],
      });
      input.dispatchEvent(new Event('change'));
      await settle();
      const alt = Array.from(
        document.querySelectorAll<HTMLInputElement>('.mlv-input__native'),
      ).find(
        (candidate) =>
          candidate.getAttribute('aria-label') === 'Alternative text',
      );
      if (!alt) throw new Error('Expected the alternative-text field.');
      alt.value = 'Menu image';
      alt.dispatchEvent(new Event('input'));
      await settle();
      Array.from(
        document.querySelectorAll<HTMLButtonElement>('.mlv-dialog button'),
      )
        .find((button) => button.textContent?.trim() === 'Upload image')
        ?.click();
      await settle();
      await settle();

      expect(upload).toHaveBeenCalledTimes(1);
      const blocks: string[] = [];
      editor.state.doc.forEach((node) =>
        blocks.push(`${node.type.name}:${node.textContent}`),
      );
      expect(blocks).toEqual(expected);
      expect(editor.getHTML()).toContain('menu.png');
    },
  );

  it('closes when the editor turns readonly', async () => {
    const { fixture, content, caret, settle, menu } = await mount();
    await caret(2);
    chord(content);
    await settle();
    expect(menu()?.isOpen()).toBe(true);
    fixture.componentInstance.readonly.set(true);
    await settle();
    await completeClose(settle);
    expect(menu()?.isOpen()).toBe(false);
    expect(panel()).toBeNull();
  });

  it('dismisses the bubble first, then opens with the first item focused: the full keyboard path', async () => {
    const { editor, content, caret, settle } = await mount();
    await caret(4);
    const summon = new KeyboardEvent('keydown', {
      key: 'F10',
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(summon, 'keyCode', { get: () => 121 });
    content.dispatchEvent(summon);
    await settle();
    const insert = document.querySelector<HTMLButtonElement>(
      '.mlv-editor-bubble mlv-editor-insert-menu-button button',
    );
    expect(document.activeElement === insert).toBe(true);

    insert?.click();
    await settle();
    const bubble = document.querySelector('.mlv-editor-bubble');
    expect(bubble?.classList.contains('mlv-editor-bubble--hidden')).toBe(true);
    await nextTask();
    await settle();
    expect(document.activeElement).toBe(menuItems()[0]);

    await choose('Bullet list', settle);
    expect(blockTypes(editor)).toEqual([
      'paragraph',
      'bulletList',
      'paragraph',
    ]);
    expect(editor.state.selection.$head.node(-1).type.name).toBe('listItem');
  });

  it('reports the menu as expanded on Insert block, controlling the open panel', async () => {
    const { content, caret, settle } = await mount();
    await caret(4);
    const summon = new KeyboardEvent('keydown', {
      key: 'F10',
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(summon, 'keyCode', { get: () => 121 });
    content.dispatchEvent(summon);
    await settle();
    const insert = document.querySelector<HTMLButtonElement>(
      '.mlv-editor-bubble mlv-editor-insert-menu-button button',
    );
    expect(insert?.getAttribute('aria-haspopup')).toBe('menu');
    expect(insert?.getAttribute('aria-expanded')).toBe('false');
    expect(insert?.hasAttribute('aria-controls')).toBe(false);

    insert?.click();
    await settle();
    expect(insert?.getAttribute('aria-expanded')).toBe('true');
    const controls = insert?.getAttribute('aria-controls');
    expect(controls).toBeTruthy();
    expect(document.getElementById(controls ?? '')).toBe(panel());

    await escape(settle);
    expect(insert?.getAttribute('aria-expanded')).toBe('false');
    expect(insert?.hasAttribute('aria-controls')).toBe(false);
  });

  it('keeps focus in the content when the "+" opens it by pointer', async () => {
    const { content, caret, settle, menu } = await mount();
    await caret(2);
    menu()?.open({ pos: 0, rect: rect(0, 0, 24, 24), via: 'pointer' });
    await settle();
    await nextTask();
    await settle();
    expect(panel()).not.toBeNull();
    expect(document.activeElement).toBe(content);
  });
});

describe('MlvEditorInsertMenu outside the clean appearance, direction and a11y (#516)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.inject(MlvRtlService).setDirection('ltr');
  });

  it.each(['bar', 'floating'] as const)(
    'leaves Mod+Alt+Enter to the browser and renders no menu or "+" in %s',
    async (appearance) => {
      const { root, editor, content, caret, settle, menu } = await mount(
        (host) => host.appearance.set(appearance),
      );
      await caret(2);
      expect(chord(content).defaultPrevented).toBe(false);
      await settle();
      expect(panel()).toBeNull();
      expect(menu()).toBeNull();
      mlvEditorBlockInserter(editor.view)?.publish('0px', 0);
      expect(root.querySelector('.mlv-editor__block-add')).toBeNull();
    },
  );

  it('removes the "+" when the appearance leaves clean', async () => {
    const { fixture, root, editor, settle } = await mount();
    mlvEditorBlockInserter(editor.view)?.publish('0px', 0);
    expect(root.querySelector('.mlv-editor__block-add')).not.toBeNull();
    fixture.componentInstance.appearance.set('bar');
    await settle();
    expect(root.querySelector('.mlv-editor__block-add')).toBeNull();
  });

  it('opens at the inline-start edge of the slot under a scoped [dir="rtl"], the pane following the scope', async () => {
    const openAt = vi.spyOn(MlvContextMenuTrigger.prototype, 'openAt');
    const { caret, settle, menu } = await mount((host) => host.dir.set('rtl'));
    expect(TestBed.inject(MlvRtlService).direction()).toBe('ltr');
    await caret(2);
    menu()?.open({ pos: 0, rect: rect(300, 40, 24, 24), via: 'pointer' });
    await settle();
    expect(openAt.mock.calls[0].slice(0, 2)).toEqual([300, 40]);
    expect(panel()?.closest('[dir]')?.getAttribute('dir')).toBe('rtl');
  });

  it('opens at the inline-end edge of the slot in LTR', async () => {
    const openAt = vi.spyOn(MlvContextMenuTrigger.prototype, 'openAt');
    const { caret, settle, menu } = await mount();
    await caret(2);
    menu()?.open({ pos: 0, rect: rect(300, 40, 24, 24), via: 'pointer' });
    await settle();
    expect(openAt.mock.calls[0].slice(0, 2)).toEqual([324, 40]);
    expect(panel()?.closest('[dir]')?.getAttribute('dir')).toBe('ltr');
  });

  describe('axe', () => {
    it('has no violations with the command menu open, with a provider (sweep 7)', async () => {
      const { content, caret, settle } = await mount();
      await caret(2);
      chord(content);
      await settle();
      expect(groupLabels()[0]).toBe('AI');
      await expectNoAxeViolations(document.body);
    });

    it('has no violations with the command menu open, without a provider (sweep 7)', async () => {
      const { content, caret, settle } = await mount((host) =>
        host.provider.set(undefined),
      );
      await caret(2);
      chord(content);
      await settle();
      expect(groupLabels()[0]).toBe('Basic blocks');
      await expectNoAxeViolations(document.body);
    });

    it('has no violations with a consumer item and an unlabelled custom group (sweep 8)', async () => {
      const { content, caret, settle } = await mount((host) =>
        host.items.set([
          ...mlvEditorDefaultInsertItems(),
          {
            id: 'callout',
            label: 'Callout',
            group: 'custom',
            icon: 'text-quote',
            run: ({ chain }) => chain().toggleBlockquote().run(),
          },
        ]),
      );
      await caret(2);
      chord(content);
      await settle();
      expect(itemLabels().at(-1)).toBe('Callout');
      await expectNoAxeViolations(document.body);
    });

    it('has no violations with the gutter "+" visible (sweep 10)', async () => {
      const { root, editor } = await mount();
      mlvEditorBlockInserter(editor.view)?.publish('0px', 0);
      const add = root.querySelector('.mlv-editor__block-add');
      expect(add?.getAttribute('data-visible')).toBe('true');
      await expectNoAxeViolations(root);
    });

    it('has no violations with the command menu open under a scoped [dir="rtl"] (sweep 12)', async () => {
      const { content, caret, settle } = await mount((host) =>
        host.dir.set('rtl'),
      );
      await caret(2);
      chord(content);
      await settle();
      expect(panel()?.closest('[dir]')?.getAttribute('dir')).toBe('rtl');
      await expectNoAxeViolations(document.body);
    });
  });
});
