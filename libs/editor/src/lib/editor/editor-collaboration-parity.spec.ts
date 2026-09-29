import { Component, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import type { AnyExtension, Extensions } from '@tiptap/core';
import type { Transaction } from '@tiptap/pm/state';
import type { MlvEditorTransactionOrigin } from '../editor.types';
import {
  mlvEditorDefaultExtensions,
  normalizeMlvEditorCharacterLimit,
} from '../extensions/editor-extensions';
import { MlvEditor } from './editor';

/*
 * #515: collaboration is opt-in. An editor with no `mlvEditorCollaboration`
 * binding gets the preset, the extension set, the value timing and the
 * transaction origins it had before collaboration existed.
 */

/** Extensions only a collaborating editor carries. */
const COLLABORATION_EXTENSIONS = [
  'collaboration',
  'mlvEditorCollaborationSchemaGuard',
  'mlvEditorPositionTracker',
  'mlvEditorCollaborationCharacterLimit',
];

/** The extension named `name` in a preset. */
const find = (extensions: Extensions, name: string): AnyExtension => {
  const extension = extensions.find((candidate) => candidate.name === name);
  if (!extension) throw new Error(`the preset has no "${name}" extension`);
  return extension as AnyExtension;
};

@Component({
  imports: [MlvEditor],
  template: `
    <mlv-editor
      label="Body"
      [value]="value"
      (valueChange)="changes.push($event)"
      (transaction)="origins.push($event.origin)"
    />
  `,
})
class PlainHost {
  readonly editor = viewChild.required(MlvEditor);
  readonly value = '<p>Hello</p>';
  readonly changes: string[] = [];
  readonly origins: MlvEditorTransactionOrigin[] = [];
}

describe('MlvEditor without collaboration (#515 parity)', () => {
  it.each([
    ['defaults', 7],
    ['a zero limit', 0],
    ['no limit', null],
  ] as const)('keeps the default preset unchanged with %s', (_label, limit) => {
    const ownBlockFilter = (tr: Transaction) => tr.docChanged;
    const ownAnchorFilter = (tr: Transaction) => !tr.docChanged;
    const preset = mlvEditorDefaultExtensions({
      characterLimit: limit,
      blockIds: { filterTransaction: ownBlockFilter },
      headingAnchors: { filterTransaction: ownAnchorFilter },
    });
    const names = preset.map((extension) => extension.name);

    for (const name of COLLABORATION_EXTENSIONS)
      expect(names).not.toContain(name);
    expect(Object.keys(find(preset, 'starterKit').options)).not.toContain(
      'undoRedo',
    );
    expect(find(preset, 'characterCount').options.limit).toBe(
      normalizeMlvEditorCharacterLimit(limit),
    );
    const blockId = find(preset, 'blockId').options;
    expect(blockId.filterTransaction).toBe(ownBlockFilter);
    expect(blockId.assignOnCreate).toBe(true);
    expect(find(preset, 'headingAnchors').options.filterTransaction).toBe(
      ownAnchorFilter,
    );
  });

  it('mounts no collaboration extension, emits synchronously and reports every transaction as local', async () => {
    await TestBed.configureTestingModule({
      imports: [PlainHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(PlainHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;
    const editor = host.editor().editor();
    if (!editor) throw new Error('the editor created no Tiptap instance');

    const names = editor.extensionManager.extensions.map(
      (extension) => extension.name,
    );
    for (const name of COLLABORATION_EXTENSIONS)
      expect(names).not.toContain(name);
    expect(names).toContain('undoRedo');
    expect(
      editor.state.plugins
        .map((plugin) => (plugin as unknown as { key: string }).key)
        .filter((key) => key.startsWith('y-')),
    ).toEqual([]);

    editor.commands.insertContent('!');
    // No awaiting: the value is written in the same task, not on a timer.
    expect(host.changes).toHaveLength(1);
    expect(host.changes[0]).toContain('!');

    editor.commands.undo();
    expect(host.changes).toHaveLength(2);
    expect(host.origins.length).toBeGreaterThan(1);
    expect([...new Set(host.origins)]).toEqual(['local']);

    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const shell = root.querySelector('mlv-editor') as HTMLElement;
    expect(shell.classList.contains('mlv-editor--collaborative')).toBe(false);
    expect(shell.classList.contains('mlv-editor--syncing')).toBe(false);
    expect(root.querySelector('.ProseMirror')?.hasAttribute('aria-busy')).toBe(
      false,
    );
    fixture.destroy();
  });
});
