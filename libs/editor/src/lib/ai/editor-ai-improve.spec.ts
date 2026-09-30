import { Component, signal, viewChild } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
// The documented public surface: reachable through the `@malva-ui/editor/ai`
// facade with the same identity the primary entry has.
import { MlvEditorAiImprove } from '@malva-ui/editor/ai';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import type { Editor } from '@tiptap/core';
import { vi } from 'vitest';
import { MlvEditor } from '../editor/editor';
import { MLV_EDITOR_AI_CONTEXT } from './editor-ai-context';
import type { MlvEditorAiContext } from './editor-ai-context';
import type { MlvEditorAiProvider } from './editor-ai.types';

/** A provider held at its first chunk until released. */
function createGatedProvider() {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const provider: MlvEditorAiProvider = {
    async *stream() {
      await gate;
      yield 'Improved';
    },
  };
  return { provider, release };
}

@Component({
  imports: [MlvEditor, MlvEditorAiImprove],
  template: `
    <mlv-editor
      label="Improve"
      [value]="value()"
      [aiProvider]="provider()"
      [readonly]="readonly()"
      [disabled]="disabled()"
    >
      <mlv-editor-ai-improve mlvEditorToolbarStart [compact]="compact()" />
    </mlv-editor>
  `,
})
class ImproveHost {
  readonly value = signal<string | null>('<p>Hello world</p><hr>');
  readonly provider = signal<MlvEditorAiProvider | undefined>(undefined);
  readonly readonly = signal(false);
  readonly disabled = signal(false);
  readonly compact = signal(false);
  readonly editor = viewChild.required(MlvEditor);
}

describe('MlvEditorAiImprove (#516)', () => {
  let fixture: ComponentFixture<ImproveHost>;
  let editor: Editor;

  async function settle(): Promise<void> {
    await Promise.resolve();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function ai(): MlvEditorAiContext {
    return fixture.debugElement
      .query(By.directive(MlvEditor))
      .injector.get(MLV_EDITOR_AI_CONTEXT) as MlvEditorAiContext;
  }

  function host(): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector(
      'mlv-editor-ai-improve',
    ) as HTMLElement;
  }

  function button(): HTMLButtonElement {
    return host().querySelector('button') as HTMLButtonElement;
  }

  function positionOf(
    predicate: (name: string, text?: string) => boolean,
  ): number {
    let found = -1;
    editor.state.doc.descendants((node, pos) => {
      if (found < 0 && predicate(node.type.name, node.text)) found = pos;
    });
    return found;
  }

  async function selectText(): Promise<void> {
    const from = positionOf((_name, text) => text === 'Hello world');
    editor.commands.setTextSelection({ from, to: from + 5 });
    await settle();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImproveHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(ImproveHost);
    fixture.componentInstance.provider.set(createGatedProvider().provider);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
    const mounted = fixture.componentInstance.editor().editor();
    if (!mounted) throw new Error('Expected a mounted Tiptap editor.');
    editor = mounted;
    await settle();
  });

  afterEach(async () => {
    await new Promise((resolve) => setTimeout(resolve));
    vi.restoreAllMocks();
  });

  it('hides without an AI provider', async () => {
    expect(host().hidden).toBe(false);
    fixture.componentInstance.provider.set(undefined);
    await settle();
    expect(host().hidden).toBe(true);
  });

  it('is enabled only for a non-empty text selection or select-all', async () => {
    await selectText();
    expect(button().disabled).toBe(false);

    editor.commands.setTextSelection(
      positionOf((_n, t) => t === 'Hello world') + 2,
    );
    await settle();
    expect(button().disabled).toBe(true);

    editor.commands.selectAll();
    await settle();
    expect(button().disabled).toBe(false);
  });

  it('is disabled on a node selection and on a table cell selection', async () => {
    editor.commands.setNodeSelection(
      positionOf((name) => name === 'horizontalRule'),
    );
    await settle();
    expect(editor.state.selection.constructor.name).toBe('NodeSelection');
    expect(button().disabled).toBe(true);

    editor
      .chain()
      .setTextSelection(editor.state.doc.content.size - 1)
      .insertTable({ rows: 1, cols: 2, withHeaderRow: false })
      .run();
    await settle();
    const cells: number[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'tableCell') cells.push(pos);
    });
    editor.commands.setCellSelection({
      anchorCell: cells[0],
      headCell: cells[1],
    });
    await settle();
    expect(editor.state.selection.constructor.name).toBe('CellSelection');
    expect(button().disabled).toBe(true);
  });

  it('is disabled while a transform runs and while the editor is disabled', async () => {
    await selectText();
    void ai().runTransform('improve');
    await settle();
    expect(ai().status()).toBe('running');
    expect(button().disabled).toBe(true);
    ai().cancel();
    await new Promise((resolve) => setTimeout(resolve));
    await settle();
    await selectText();
    expect(button().disabled).toBe(false);

    fixture.componentInstance.disabled.set(true);
    await settle();
    expect(button().disabled).toBe(true);
  });

  it('runs the default improve action over the selection, replacing it, and keeps the selection on press', async () => {
    const run = vi.spyOn(ai(), 'runTransform').mockResolvedValue();
    await selectText();
    const press = new Event('pointerdown', { bubbles: true, cancelable: true });
    button().dispatchEvent(press);
    expect(press.defaultPrevented).toBe(true);
    button().click();
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith('improve', {
      output: 'replace-selection',
    });

    editor.commands.setTextSelection(2);
    await settle();
    const idle = new Event('pointerdown', { bubbles: true, cancelable: true });
    button().dispatchEvent(idle);
    expect(idle.defaultPrevented).toBe(false);
  });

  it('shows its label wide and is named by aria-label and a tooltip when compact', async () => {
    await selectText();
    expect(button().textContent?.trim()).toBe('Improve writing');
    expect(button().hasAttribute('aria-label')).toBe(false);

    fixture.componentInstance.compact.set(true);
    await settle();
    expect(host().classList.contains('mlv-editor-ai-improve--compact')).toBe(
      true,
    );
    expect(button().getAttribute('aria-label')).toBe('Improve writing');
    expect(button().querySelector('.mlv-editor-ai-improve__label')).toBeNull();
  });

  it('has no axe violations, wide and compact', async () => {
    await selectText();
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
    fixture.componentInstance.compact.set(true);
    await settle();
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });

  describe('MlvEditorAiContext.canStart', () => {
    it('mirrors every runTransform refusal', async () => {
      expect(ai().canStart()).toBe(true);

      void ai().runTransform('improve');
      await settle();
      expect(ai().canStart()).toBe(false);
      ai().cancel();
      await new Promise((resolve) => setTimeout(resolve));
      await settle();
      expect(ai().canStart()).toBe(true);

      for (const flag of ['readonly', 'disabled'] as const) {
        fixture.componentInstance[flag].set(true);
        await settle();
        expect(ai().canStart()).toBe(false);
        fixture.componentInstance[flag].set(false);
        await settle();
        expect(ai().canStart()).toBe(true);
      }

      fixture.componentInstance.provider.set(undefined);
      await settle();
      expect(ai().canStart()).toBe(false);
    });

    it('is false while a review is pending', async () => {
      const provider: MlvEditorAiProvider = {
        async *stream() {
          yield 'Hi world';
        },
      };
      fixture.componentInstance.provider.set(provider);
      await settle();
      await selectText();
      await ai().runTransform('improve', { output: 'review' });
      await settle();
      expect(ai().status()).toBe('reviewing');
      expect(ai().canStart()).toBe(false);
    });
  });
});
