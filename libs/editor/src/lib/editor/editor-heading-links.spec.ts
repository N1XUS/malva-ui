import { LiveAnnouncer } from '@angular/cdk/a11y';
import { Clipboard } from '@angular/cdk/clipboard';
import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import type { Editor, JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { MlvEditorHeadingAnchors } from '../extensions/heading-anchors/editor-heading-anchors';
import { MlvEditor } from './editor';
import { provideMlvEditorHeadingLinks } from './editor-heading-links';

@Component({
  imports: [MlvEditor],
  template: `
    <mlv-editor
      label="Article"
      headingAnchors
      [readonly]="readonly()"
      [disabled]="disabled()"
      [value]="value()"
      (valueChange)="emitted.push($event)"
    />
  `,
})
class AnchorsHost {
  readonly readonly = signal(false);
  readonly disabled = signal(false);
  readonly value = signal<string | null>('<h2>Getting started</h2><p>Body</p>');
  readonly emitted: (string | null)[] = [];
  readonly editor = viewChild.required(MlvEditor);
}

@Component({
  imports: [MlvEditor],
  template: `
    <mlv-editor
      label="Article"
      [extensions]="extensions"
      value="<h2>Custom</h2>"
    />
  `,
})
class ConsumerArrayHost {
  readonly extensions = [StarterKit.configure({}), MlvEditorHeadingAnchors];
}

@Component({
  imports: [MlvEditor],
  template: `
    <mlv-editor
      label="Article"
      blockIds
      [value]="value()"
      (valueChange)="emitted.push($event)"
    />
  `,
})
class BlockIdsHost {
  readonly value = signal<string | null>('<p>One</p><h2>Two</h2>');
  readonly emitted: (string | null)[] = [];
  readonly editor = viewChild.required(MlvEditor);
}

/** Lets Tiptap's deferred `onCreate` run, then settles Angular. */
async function settle(fixture: { whenStable(): Promise<unknown> }) {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await fixture.whenStable();
}

async function create<T>(type: new () => T, providers: unknown[] = []) {
  await TestBed.configureTestingModule({
    imports: [type],
    providers: [provideMlvI18nTesting(), ...(providers as never[])],
  }).compileComponents();
  const clipboard = TestBed.inject(Clipboard);
  const copy = vi.spyOn(clipboard, 'copy').mockReturnValue(true);
  const announce = vi
    .spyOn(TestBed.inject(LiveAnnouncer), 'announce')
    .mockResolvedValue();
  const fixture = TestBed.createComponent(type);
  fixture.detectChanges();
  await settle(fixture);
  return { fixture, copy, announce };
}

const linkButtons = (root: HTMLElement): HTMLButtonElement[] =>
  Array.from(root.querySelectorAll('button.mlv-editor__heading-link'));

const blockIdsOf = (json: JSONContent): unknown[] =>
  (json.content ?? []).map((node) => node.attrs?.['blockId']);

describe('MlvEditor headingAnchors', () => {
  it('renders the heading id and a named copy-link button', async () => {
    const { fixture } = await create(AnchorsHost);
    const root = fixture.nativeElement as HTMLElement;
    const heading = root.querySelector('.ProseMirror h2') as HTMLElement;
    expect(heading.id).toBe('getting-started');
    const [button] = linkButtons(root);
    expect(button?.getAttribute('aria-label')).toBe('Copy link to heading');
    expect(button?.closest('h2')).toBe(heading);
  });

  it('does not emit a value for the anchors it derives on load', async () => {
    const { fixture } = await create(AnchorsHost);
    expect(fixture.componentInstance.emitted).toEqual([]);
  });

  it('copies the default link and announces it on click', async () => {
    const { fixture, copy, announce } = await create(AnchorsHost);
    linkButtons(fixture.nativeElement)[0]?.click();
    const base = document.location.href.replace(/#.*$/u, '');
    expect(copy).toHaveBeenCalledWith(`${base}#getting-started`);
    expect(announce).toHaveBeenCalledWith('Link copied', 'polite');
  });

  it('drops the page fragment and keeps the query in the default link', async () => {
    const previous = document.location.href;
    history.replaceState(null, '', '/docs/editor?tab=2#old');
    try {
      const { fixture, copy } = await create(AnchorsHost);
      linkButtons(fixture.nativeElement)[0]?.click();
      expect(copy).toHaveBeenCalledWith(
        `${document.location.origin}/docs/editor?tab=2#getting-started`,
      );
    } finally {
      history.replaceState(null, '', previous);
    }
  });

  it('percent-encodes a non-ASCII id in the default link', async () => {
    const { fixture, copy } = await create(AnchorsHost);
    fixture.componentInstance.value.set('<h2>Привет мир</h2>');
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.ProseMirror h2')?.id).toBe('привет-мир');
    linkButtons(root)[0]?.click();
    expect(String(copy.mock.calls[0]?.[0])).toMatch(
      new RegExp(`#${encodeURIComponent('привет-мир')}$`, 'u'),
    );
  });

  it('builds the link through a provided MLV_EDITOR_HEADING_LINKS', async () => {
    const { fixture, copy } = await create(AnchorsHost, [
      provideMlvEditorHeadingLinks({
        href: ({ anchor, id }) => `https://docs.test/a#${id}|${anchor}`,
      }),
    ]);
    linkButtons(fixture.nativeElement)[0]?.click();
    expect(copy).toHaveBeenCalledWith(
      'https://docs.test/a#getting-started|getting-started',
    );
  });

  it('does not announce when the copy fails', async () => {
    const { fixture, copy, announce } = await create(AnchorsHost);
    copy.mockReturnValue(false);
    linkButtons(fixture.nativeElement)[0]?.click();
    expect(announce).not.toHaveBeenCalled();
  });

  it('is a tab stop only while readonly', async () => {
    const { fixture } = await create(AnchorsHost);
    const root = fixture.nativeElement as HTMLElement;
    expect(linkButtons(root)[0]?.tabIndex).toBe(-1);

    fixture.componentInstance.readonly.set(true);
    await fixture.whenStable();
    expect(linkButtons(root)[0]?.tabIndex).toBe(0);

    fixture.componentInstance.readonly.set(false);
    await fixture.whenStable();
    expect(linkButtons(root)[0]?.tabIndex).toBe(-1);
  });

  it('renders no button while disabled, and restores it after', async () => {
    const { fixture } = await create(AnchorsHost);
    const root = fixture.nativeElement as HTMLElement;
    fixture.componentInstance.disabled.set(true);
    await fixture.whenStable();
    expect(linkButtons(root)).toHaveLength(0);
    expect(root.querySelector('.ProseMirror h2')?.id).toBe('getting-started');

    fixture.componentInstance.disabled.set(false);
    await fixture.whenStable();
    expect(linkButtons(root)).toHaveLength(1);
  });

  it('copies from the heading menu command at the caret', async () => {
    const { fixture, copy, announce } = await create(AnchorsHost);
    const editor = fixture.componentInstance.editor().editor() as Editor;
    editor.commands.setTextSelection(3);
    expect(editor.commands.copyHeadingLink()).toBe(true);
    expect(copy).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it('wires a consumer extension array that includes the extension', async () => {
    const { fixture, copy } = await create(ConsumerArrayHost);
    const [button] = linkButtons(fixture.nativeElement);
    expect(button).toBeDefined();
    button?.click();
    expect(copy).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['editable', false, false],
    ['readonly', true, false],
    ['disabled', false, true],
  ] as const)('has no axe violations while %s', async (_, ro, disabled) => {
    const { fixture } = await create(AnchorsHost);
    fixture.componentInstance.readonly.set(ro);
    fixture.componentInstance.disabled.set(disabled);
    await fixture.whenStable();
    expect(linkButtons(fixture.nativeElement)).toHaveLength(disabled ? 0 : 1);
    await expectNoAxeViolations(document.body);
  });
});

describe('MlvEditor blockIds', () => {
  it('assigns an ID to every block of a loaded value', async () => {
    const { fixture } = await create(BlockIdsHost);
    const editor = fixture.componentInstance.editor().editor() as Editor;
    const ids = blockIdsOf(editor.getJSON());
    expect(ids.length).toBeGreaterThanOrEqual(2);
    for (const id of ids) expect(id).toMatch(/^[0-9a-z]{10}$/u);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('neither emits nor records history for the load-time IDs', async () => {
    const { fixture } = await create(BlockIdsHost);
    const editor = fixture.componentInstance.editor().editor() as Editor;
    expect(fixture.componentInstance.emitted).toEqual([]);
    expect(editor.can().undo()).toBe(false);
  });

  it('emits the IDs with the next user edit', async () => {
    const { fixture } = await create(BlockIdsHost);
    const editor = fixture.componentInstance.editor().editor() as Editor;
    editor.commands.insertContentAt(1, 'X');
    await fixture.whenStable();
    const last = fixture.componentInstance.emitted.at(-1) ?? '';
    expect(last).toContain('data-block-id=');
  });

  it('assigns IDs to a value applied after creation', async () => {
    const { fixture } = await create(BlockIdsHost);
    fixture.componentInstance.value.set('<p>Fresh</p><p>Second</p>');
    await settle(fixture);
    const editor = fixture.componentInstance.editor().editor() as Editor;
    const ids = blockIdsOf(editor.getJSON());
    for (const id of ids) expect(id).toMatch(/^[0-9a-z]{10}$/u);
    expect(fixture.componentInstance.emitted).toEqual([]);
  });
});
