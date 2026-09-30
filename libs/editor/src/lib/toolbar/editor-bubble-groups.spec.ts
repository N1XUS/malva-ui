import { Component, getDebugNode, signal, viewChild } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import type { Editor, Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import type { MlvEditorAiProvider } from '../ai/editor-ai.types';
import { MlvEditor } from '../editor/editor';
import type { MlvEditorToolbarAppearance } from '../editor.types';
import { MlvEditorBubbleGroups } from './editor-bubble-groups';
import { MlvEditorToolbarRoot } from './editor-toolbar-root';

/** A provider that answers every request with one chunk. */
const PROVIDER: MlvEditorAiProvider = {
  async *stream() {
    yield 'Improved';
  },
};

/**
 * The groups mounted in a bar editor's start slot: the DOM stays put while
 * the selection moves, unlike the bubble, which hides at a caret.
 */
@Component({
  imports: [MlvEditor, MlvEditorBubbleGroups],
  template: `
    <mlv-editor
      label="Groups"
      [value]="value()"
      [aiProvider]="provider()"
      [extensions]="extensions()"
      [toolbarAppearance]="appearance()"
    >
      @if (slotted()) {
        <mlv-editor-bubble-groups mlvEditorToolbarStart [narrow]="narrow()" />
      }
    </mlv-editor>
  `,
})
class GroupsHost {
  readonly value = signal<string | null>('<p>Alpha beta</p><p>Gamma</p>');
  readonly provider = signal<MlvEditorAiProvider | undefined>(PROVIDER);
  readonly extensions = signal<Extensions | undefined>(undefined);
  readonly appearance = signal<MlvEditorToolbarAppearance>('bar');
  readonly slotted = signal(true);
  readonly narrow = signal(false);
  readonly editor = viewChild.required(MlvEditor);
}

interface Harness {
  fixture: ComponentFixture<GroupsHost>;
  root: HTMLElement;
  editor: Editor;
  settle(): Promise<void>;
  select(from: number, to?: number): Promise<void>;
}

async function mount(configure?: (host: GroupsHost) => void): Promise<Harness> {
  await TestBed.configureTestingModule({
    imports: [GroupsHost],
    providers: [provideMlvI18nTesting()],
  }).compileComponents();
  const fixture = TestBed.createComponent(GroupsHost);
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
  return {
    fixture,
    root,
    editor,
    settle,
    select: async (from, to = from) => {
      content.focus();
      editor.commands.setTextSelection({ from, to });
      await settle();
    },
  };
}

/** Local names of the groups' rendered children, in DOM order. */
function childTags(scope: ParentNode): string[] {
  const groups = scope.querySelector('mlv-editor-bubble-groups');
  return groups ? [...groups.children].map((child) => child.localName) : [];
}

/** Accessible names of the marks group's buttons. */
function markNames(scope: ParentNode): (string | null)[] {
  return [
    ...scope.querySelectorAll(
      'mlv-editor-bubble-groups mlv-editor-inline-marks button',
    ),
  ].map((button) => button.getAttribute('aria-label'));
}

function pane(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.mlv-editor-bubble');
}

async function openMore(settle: () => Promise<void>): Promise<string[]> {
  const trigger = document.querySelector<HTMLButtonElement>(
    'mlv-editor-bubble-more button',
  );
  if (!trigger) throw new Error('Expected the More trigger.');
  trigger.click();
  await settle();
  const panel = document.querySelector('.mlv-menu__panel');
  if (!panel) throw new Error('Expected the More menu to open.');
  return [...panel.querySelectorAll('[role="menuitem"]')].map(
    (item) => item.textContent?.trim() ?? '',
  );
}

describe('MlvEditorBubbleGroups (#516)', () => {
  it('leads with Improve and its divider over a text selection with a provider, dropping both at a caret', async () => {
    const { root, select } = await mount();
    await select(1, 6);
    expect(childTags(root).slice(0, 3)).toEqual([
      'mlv-editor-ai-improve',
      'mlv-divider',
      'mlv-editor-block-type',
    ]);

    await select(2);
    // Slotted into a bar editor, which renders no command menu, the caret
    // slot (Insert block, D-B11) stays empty too: no hidden button, no gap.
    expect(childTags(root)[0]).toBe('mlv-editor-block-type');
    expect(
      root.querySelector('mlv-editor-bubble-groups mlv-editor-ai-improve'),
    ).toBeNull();
    expect(
      root.querySelector(
        'mlv-editor-bubble-groups mlv-editor-insert-menu-button',
      ),
    ).toBeNull();
  });

  it('leads with Insert block and its divider at a caret in a clean editor (D-B11)', async () => {
    const { root, editor, settle } = await mount((host) => {
      host.appearance.set('clean');
      host.slotted.set(false);
    });
    const content = root.querySelector('.ProseMirror') as HTMLElement;
    content.focus();
    editor.commands.setTextSelection(2);
    const event = new KeyboardEvent('keydown', {
      key: 'F10',
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, 'keyCode', { get: () => 121 });
    content.dispatchEvent(event);
    await settle();
    expect(childTags(pane() as HTMLElement).slice(0, 3)).toEqual([
      'mlv-editor-insert-menu-button',
      'mlv-divider',
      'mlv-editor-block-type',
    ]);
  });

  it('renders no Improve and no leading divider without a provider', async () => {
    const { root, select } = await mount((host) =>
      host.provider.set(undefined),
    );
    await select(1, 6);
    expect(childTags(root)).toEqual([
      'mlv-editor-block-type',
      'mlv-divider',
      'mlv-editor-inline-marks',
      'mlv-divider',
      'mlv-editor-link',
      'mlv-divider',
      'mlv-editor-text-color',
      'mlv-editor-highlight',
      'mlv-editor-bubble-more',
    ]);
  });

  it('shows five marks wide and bold and italic narrow, with a compact Improve', async () => {
    const { root, fixture, select, settle } = await mount();
    await select(1, 6);
    expect(markNames(root)).toEqual([
      'Bold',
      'Italic',
      'Strike-through',
      'Underline',
      'Inline code',
    ]);
    expect(root.querySelector('.mlv-editor-ai-improve--compact')).toBeNull();

    fixture.componentInstance.narrow.set(true);
    await settle();
    expect(markNames(root)).toEqual(['Bold', 'Italic']);
    expect(
      root.querySelector('.mlv-editor-ai-improve--compact'),
    ).not.toBeNull();
  });

  it('lists the narrow marks in More only while narrow', async () => {
    const { fixture, select, settle } = await mount();
    await select(1, 6);
    const wide = await openMore(settle);
    expect(wide).not.toContain('Underline');
    expect(wide).not.toContain('Inline code');
    expect(wide).toEqual(expect.arrayContaining(['Subscript', 'Superscript']));
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    await settle();

    fixture.componentInstance.narrow.set(true);
    await settle();
    const narrow = await openMore(settle);
    expect(narrow).toEqual(
      expect.arrayContaining(['Underline', 'Strike-through', 'Inline code']),
    );
  });

  it('gates every More row on its command, hiding the button when none is registered', async () => {
    const { root, fixture, select, settle } = await mount((host) =>
      host.extensions.set([StarterKit]),
    );
    await select(1, 6);
    const more = root.querySelector(
      'mlv-editor-bubble-groups mlv-editor-bubble-more',
    ) as HTMLElement;
    // StarterKit registers no alignment, sub/superscript, reset, font or
    // line-height command, so the wide More has nothing to list.
    expect(more.hidden).toBe(true);

    fixture.componentInstance.narrow.set(true);
    await settle();
    expect(more.hidden).toBe(false);
    expect(await openMore(settle)).toEqual([
      'Underline',
      'Strike-through',
      'Inline code',
    ]);
  });

  it('skips hidden controls when roving: End lands on the last control shown', async () => {
    const { select, settle } = await mount((host) => {
      host.slotted.set(false);
      host.appearance.set('clean');
      host.extensions.set([StarterKit]);
    });
    await select(1, 6);
    const bubble = pane() as HTMLElement;
    // No colour extensions and nothing for More: all three hide.
    for (const selector of [
      'mlv-editor-text-color',
      'mlv-editor-highlight',
      'mlv-editor-bubble-more',
    ]) {
      expect((bubble.querySelector(selector) as HTMLElement).hidden).toBe(true);
    }
    const first = bubble.querySelector(
      'mlv-editor-ai-improve button',
    ) as HTMLButtonElement;
    first.focus();
    first.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'End',
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    expect(document.activeElement?.closest('mlv-editor-link')).not.toBeNull();
  });

  it('has no axe violations with the narrow bubble More menu open', async () => {
    const { select, settle } = await mount((host) => {
      host.slotted.set(false);
      host.appearance.set('clean');
    });
    await select(1, 6);
    const toolbar = pane()?.querySelector('[mlvEditorToolbarRoot]');
    getDebugNode(toolbar as Element)
      ?.injector.get(MlvEditorToolbarRoot)
      .narrow.set(true);
    await settle();
    expect(await openMore(settle)).toContain('Underline');
    await expectNoAxeViolations(document.body);
  });
});
