import { Component, getDebugNode, signal, viewChild } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import type { Editor } from '@tiptap/core';
import { vi } from 'vitest';
import type { MlvEditorAiProvider } from '../ai/editor-ai.types';
import type { MlvEditorToolbarAppearance } from '../editor.types';
import { MlvEditorToolbarRoot } from '../toolbar/editor-toolbar-root';
import { MlvEditorToolbarDef } from '../toolbar/editor-toolbar.defs';
import { MlvEditorToolbarWidget } from '../toolbar/editor-toolbar-widget';
import { MlvEditor } from './editor';

/** A provider that answers every request with one chunk. */
const PROVIDER: MlvEditorAiProvider = {
  async *stream() {
    yield 'Improved';
  },
};

@Component({
  imports: [MlvEditor],
  template: `
    <div [attr.dir]="dir()">
      <mlv-editor
        label="Clean"
        [value]="value()"
        [aiProvider]="provider()"
        [readonly]="readonly()"
        [disabled]="disabled()"
        [toolbarAppearance]="appearance()"
      />
    </div>
  `,
})
class CleanHost {
  readonly value = signal<string | null>('<p>Alpha beta</p><p>Gamma</p>');
  readonly provider = signal<MlvEditorAiProvider | undefined>(PROVIDER);
  readonly readonly = signal(false);
  readonly disabled = signal(false);
  readonly appearance = signal<MlvEditorToolbarAppearance>('clean');
  readonly dir = signal<'ltr' | 'rtl' | null>(null);
  readonly editor = viewChild.required(MlvEditor);
}

@Component({
  imports: [MlvEditor],
  template: `
    <mlv-editor
      label="Slots"
      value="<p>Alpha beta</p>"
      toolbarAppearance="clean"
    >
      <button type="button" mlvEditorToolbarStart data-start>Start</button>
      <button type="button" mlvEditorToolbarEnd data-end>End</button>
    </mlv-editor>
  `,
})
class SlotHost {}

@Component({
  imports: [MlvEditor, MlvEditorToolbarDef, MlvEditorToolbarWidget],
  template: `
    <mlv-editor label="Own" value="<p>Alpha beta</p>" toolbarAppearance="clean">
      <ng-template mlvEditorToolbar>
        <button mlvEditorToolbarWidget type="button" data-own>Copy</button>
      </ng-template>
    </mlv-editor>
  `,
})
class ReplacementHost {}

interface Harness<T> {
  fixture: ComponentFixture<T>;
  root: HTMLElement;
  editor: Editor;
  content: HTMLElement;
  settle(): Promise<void>;
  select(from: number, to?: number): Promise<void>;
}

async function mount<T>(
  type: new () => T,
  editorOf: (host: T, root: HTMLElement) => Editor | null | undefined,
  configure?: (host: T) => void,
): Promise<Harness<T>> {
  await TestBed.configureTestingModule({
    imports: [type],
    providers: [provideMlvI18nTesting()],
  }).compileComponents();
  const fixture = TestBed.createComponent(type);
  configure?.(fixture.componentInstance);
  document.body.appendChild(fixture.nativeElement);
  fixture.detectChanges();
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const editor = editorOf(fixture.componentInstance, root);
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
    content,
    settle,
    select: async (from, to = from) => {
      content.focus();
      editor.commands.setTextSelection({ from, to });
      await settle();
    },
  };
}

const mountClean = (configure?: (host: CleanHost) => void) =>
  mount(CleanHost, (host) => host.editor().editor(), configure);

/** Tiptap editor of the only `mlv-editor` under `root`. */
function editorUnder(root: HTMLElement): Editor | null | undefined {
  const element = root.querySelector('mlv-editor') as HTMLElement;
  return getDebugNode(element)?.injector.get(MlvEditor).editor();
}

function pane(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.mlv-editor-bubble');
}

function shown(): boolean {
  const bubble = pane();
  return (
    bubble !== null && !bubble.classList.contains('mlv-editor-bubble--hidden')
  );
}

/** Tag names of the rendered N1 default groups, in DOM order. */
function defaultGroupTags(scope: ParentNode): string[] {
  const groups = scope.querySelector('.mlv-editor-default-toolbar-groups');
  return groups ? [...groups.children].map((child) => child.localName) : [];
}

/**
 * The N1 default group set as `main` renders it (#514): `'bar'` and
 * `'floating'` must keep it element for element (U10).
 */
const N1_DEFAULT_GROUPS = [
  'mlv-editor-undo-redo',
  'mlv-divider',
  'mlv-editor-zoom',
  'mlv-divider',
  'mlv-editor-heading',
  'mlv-editor-list',
  'mlv-divider',
  'mlv-editor-font-family',
  'mlv-editor-font-size',
  'mlv-divider',
  'mlv-editor-inline-marks',
  'mlv-divider',
  'mlv-editor-text-color',
  'mlv-editor-highlight',
  'mlv-editor-clear-formatting',
  'mlv-divider',
  'mlv-editor-alignment',
  'mlv-editor-line-height',
  'mlv-divider',
  'mlv-editor-link',
  'mlv-editor-table',
  'mlv-divider',
  'mlv-editor-block-insert',
  'mlv-divider',
  'mlv-editor-image-upload',
];

describe('MlvEditor toolbarAppearance="clean" (#516)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.inject(MlvRtlService).setDirection('ltr');
  });

  it('renders the clean bubble groups in the selection bubble, not the N1 groups', async () => {
    const { root, select } = await mountClean();
    const host = root.querySelector('mlv-editor') as HTMLElement;
    expect(host.classList.contains('mlv-editor--toolbar-clean')).toBe(true);
    expect(host.classList.contains('mlv-editor--toolbar-floating')).toBe(false);
    expect(host.classList.contains('mlv-editor--toolbar-bar')).toBe(false);
    expect(root.querySelector('.mlv-editor__toolbar-band')).toBeNull();

    await select(1, 6);
    expect(shown()).toBe(true);
    const bubble = pane() as HTMLElement;
    expect(bubble.querySelector('mlv-editor-bubble-groups')).not.toBeNull();
    expect(
      bubble.querySelector('mlv-editor-default-toolbar-groups'),
    ).toBeNull();
    expect(bubble.querySelector('mlv-editor-toolbar-overflow')).toBeNull();
    expect(root.querySelector('mlv-editor-ai-prompt')).not.toBeNull();
  });

  it.each(['bar', 'floating'] as const)(
    'keeps the %s appearance on the N1 groups, its overflow and its own host class',
    async (appearance) => {
      const { root, select } = await mountClean((host) =>
        host.appearance.set(appearance),
      );
      await select(1, 6);
      const scope: ParentNode = appearance === 'bar' ? root : (pane() ?? root);
      const host = root.querySelector('mlv-editor') as HTMLElement;
      expect(defaultGroupTags(scope)).toEqual(N1_DEFAULT_GROUPS);
      expect(scope.querySelector('mlv-editor-toolbar-overflow')).not.toBeNull();
      expect(document.querySelector('mlv-editor-bubble-groups')).toBeNull();
      expect(root.querySelector('mlv-editor-ai-prompt')).toBeNull();
      expect(host.classList.contains('mlv-editor--toolbar-clean')).toBe(false);
      expect(host.classList.contains(`mlv-editor--toolbar-${appearance}`)).toBe(
        true,
      );
      expect(pane() === null).toBe(appearance === 'bar');
    },
  );

  it('renders the consumer start and end slots in the clean bubble', async () => {
    const { select } = await mount(SlotHost, (_host, root) =>
      editorUnder(root),
    );
    await select(1, 6);
    const bubble = pane() as HTMLElement;
    expect(bubble.querySelector('[data-start]')).not.toBeNull();
    expect(bubble.querySelector('[data-end]')).not.toBeNull();
    expect(bubble.querySelector('mlv-editor-bubble-groups')).not.toBeNull();
  });

  it('renders a complete [mlvEditorToolbar] replacement instead of the clean groups', async () => {
    const { select } = await mount(ReplacementHost, (_host, root) =>
      editorUnder(root),
    );
    await select(1, 6);
    const bubble = pane() as HTMLElement;
    expect(bubble.querySelector('[data-own]')).not.toBeNull();
    expect(bubble.querySelector('mlv-editor-bubble-groups')).toBeNull();
  });

  it('advertises Alt+F10 and the insert chord while clean and editable, and nothing while readonly or disabled', async () => {
    const { fixture, content, settle } = await mountClean();
    expect(content.getAttribute('aria-keyshortcuts')).toBe(
      'Alt+F10 Control+Alt+Enter',
    );

    // The chord is clean-only: floating keeps its own single shortcut.
    fixture.componentInstance.appearance.set('floating');
    await settle();
    expect(content.getAttribute('aria-keyshortcuts')).toBe('Alt+F10');
    fixture.componentInstance.appearance.set('clean');
    await settle();

    fixture.componentInstance.readonly.set(true);
    await settle();
    expect(content.hasAttribute('aria-keyshortcuts')).toBe(false);

    fixture.componentInstance.readonly.set(false);
    fixture.componentInstance.disabled.set(true);
    await settle();
    expect(content.hasAttribute('aria-keyshortcuts')).toBe(false);
  });

  it('spells the insert chord with Meta on Apple platforms, as ProseMirror reads Mod', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    const { content } = await mountClean();
    expect(content.getAttribute('aria-keyshortcuts')).toBe(
      'Alt+F10 Meta+Alt+Enter',
    );
  });

  it('renders no bubble controls and no prompt target while readonly or disabled', async () => {
    const { fixture, select, settle } = await mountClean();
    await select(1, 6);
    expect(shown()).toBe(true);

    fixture.componentInstance.readonly.set(true);
    await settle();
    expect(shown()).toBe(false);
    expect(
      pane()?.querySelector('mlv-editor-bubble-groups') ?? null,
    ).toBeNull();

    fixture.componentInstance.readonly.set(false);
    fixture.componentInstance.disabled.set(true);
    await settle();
    expect(shown()).toBe(false);
  });

  it('summons the bubble at a caret with Alt+F10 and focuses its first control, Insert block (D-B11)', async () => {
    const { content, select, settle } = await mountClean();
    await select(2);
    expect(shown()).toBe(false);

    const event = new KeyboardEvent('keydown', {
      key: 'F10',
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, 'keyCode', { get: () => 121 });
    content.dispatchEvent(event);
    await settle();

    expect(shown()).toBe(true);
    const bubble = pane() as HTMLElement;
    // At a caret the first slot is Insert block, not Improve (D-B11).
    expect(bubble.querySelector('mlv-editor-ai-improve')).toBeNull();
    const groups = bubble.querySelector('mlv-editor-bubble-groups');
    expect(groups?.firstElementChild?.localName).toBe(
      'mlv-editor-insert-menu-button',
    );
    const insert = bubble.querySelector('mlv-editor-insert-menu-button button');
    expect(insert?.getAttribute('aria-label')).toBe('Insert block');
    expect(document.activeElement === insert).toBe(true);
  });

  describe('axe', () => {
    it('has no violations with the clean bubble open over a text selection, with a provider', async () => {
      const { root, select } = await mountClean();
      await select(1, 6);
      expect(
        pane()?.querySelector('mlv-editor-ai-improve:not([hidden])'),
      ).not.toBeNull();
      await expectNoAxeViolations(root);
      await expectNoAxeViolations(document.body);
    });

    it('has no violations with the clean bubble open over a text selection, without a provider', async () => {
      const { select } = await mountClean((host) =>
        host.provider.set(undefined),
      );
      await select(1, 6);
      expect(pane()?.querySelector('mlv-editor-ai-improve')).toBeNull();
      await expectNoAxeViolations(document.body);
    });

    it('has no violations with the bubble summoned at a caret', async () => {
      const { content, select, settle } = await mountClean();
      await select(2);
      const event = new KeyboardEvent('keydown', {
        key: 'F10',
        altKey: true,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'keyCode', { get: () => 121 });
      content.dispatchEvent(event);
      await settle();
      expect(shown()).toBe(true);
      await expectNoAxeViolations(document.body);
    });

    it('has no violations with the narrow clean bubble', async () => {
      const { select, settle } = await mountClean();
      await select(1, 6);
      const toolbar = pane()?.querySelector('[mlvEditorToolbarRoot]');
      const root = getDebugNode(toolbar as Element)?.injector.get(
        MlvEditorToolbarRoot,
      );
      root?.narrow.set(true);
      await settle();
      expect(
        pane()?.querySelector('.mlv-editor-ai-improve--compact'),
      ).not.toBeNull();
      await expectNoAxeViolations(document.body);
    });

    it('has no violations under a scoped [dir="rtl"], the pane following the scope', async () => {
      const { select } = await mountClean((host) => host.dir.set('rtl'));
      expect(TestBed.inject(MlvRtlService).direction()).toBe('ltr');
      await select(1, 6);
      const bubble = pane() as HTMLElement;
      expect(bubble.closest('[dir]')?.getAttribute('dir')).toBe('rtl');
      await expectNoAxeViolations(document.body);
    });
  });
});
