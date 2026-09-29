import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { enLanguage as en } from '@malva-ui/i18n/en';
import { MLV_EDITOR_I18N } from '@malva-ui/i18n';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import type { Editor } from '@tiptap/core';
import { MlvEditor } from '../editor/editor';
import { provideMlvEditorTextStyles } from './editor-text-styles';

@Component({
  imports: [MlvEditor],
  template: `<mlv-editor
    label="Article"
    [disabled]="disabled()"
    [(value)]="value"
  />`,
})
class StylesHost {
  value = '<p>plain text</p><h2>Title</h2>';
  readonly disabled = signal(false);
  readonly editor = viewChild.required(MlvEditor);
}

/** Mounted editor plus helpers to settle and query its toolbar. */
interface Mounted {
  readonly editor: Editor;
  readonly host: HTMLElement;
  readonly fixture: { componentInstance: StylesHost };
  settle(): Promise<void>;
  trigger(prefix: string): HTMLButtonElement;
  open(prefix: string): Promise<HTMLElement[]>;
}

async function mount(providers: unknown[] = []): Promise<Mounted> {
  await TestBed.configureTestingModule({
    imports: [StylesHost],
    providers: [provideMlvI18nTesting(), ...(providers as never[])],
  }).compileComponents();
  const fixture = TestBed.createComponent(StylesHost);
  fixture.detectChanges();
  await fixture.whenStable();
  const editor = fixture.componentInstance.editor().editor();
  if (!editor) throw new Error('Expected a browser editor.');
  const host = fixture.nativeElement as HTMLElement;
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const trigger = (prefix: string): HTMLButtonElement => {
    const found = [
      ...host.querySelectorAll<HTMLButtonElement>('button[aria-label]'),
    ].find((button) => button.getAttribute('aria-label')?.startsWith(prefix));
    if (!found) throw new Error(`No trigger named "${prefix}…".`);
    return found;
  };
  const open = async (prefix: string): Promise<HTMLElement[]> => {
    trigger(prefix).click();
    await settle();
    return [
      ...document.querySelectorAll<HTMLElement>(
        '.mlv-menu__panel [role="menuitem"]',
      ),
    ];
  };
  return { editor, host, fixture, settle, trigger, open };
}

const texts = (items: readonly HTMLElement[]): string[] =>
  items.map((item) => item.textContent?.trim() ?? '');
const current = (items: readonly HTMLElement[]): string[] =>
  texts(items.filter((item) => item.getAttribute('aria-current') === 'true'));

describe('text-style toolbar menus (#514)', () => {
  it('names the font trigger with its current value and applies a family', async () => {
    const { editor, trigger, open, settle } = await mount();
    editor.commands.setTextSelection({ from: 1, to: 6 });
    await settle();
    expect(trigger('Font:').getAttribute('aria-label')).toBe('Font: Default');
    expect(trigger('Font:').textContent?.trim()).toBe('Default');

    const items = await open('Font:');
    expect(texts(items)).toEqual([
      'Default',
      'Sans serif',
      'Serif',
      'Monospace',
    ]);
    expect(current(items)).toEqual(['Default']);
    const serif = items[2].querySelector<HTMLElement>(
      '.mlv-editor-style-menu__option',
    );
    expect(serif?.style.fontFamily).toContain('ui-serif');

    items[2].click();
    await settle();
    expect(editor.getAttributes('textStyle')['fontFamily']).toBe(
      "ui-serif, Georgia, 'Times New Roman', serif",
    );
    expect(trigger('Font:').getAttribute('aria-label')).toBe('Font: Serif');
    expect(trigger('Font:').textContent?.trim()).toBe('Serif');
  });

  it('matches a family re-quoted by the browser to its option', async () => {
    const { editor, trigger, open, settle } = await mount();
    // Chromium's CSSOM writes the serif stack back with double quotes, so an
    // HTML or Markdown round trip stores it in this form (measured).
    editor
      .chain()
      .setTextSelection({ from: 1, to: 6 })
      .setFontFamily('ui-serif,Georgia,"Times New Roman",serif')
      .run();
    await settle();
    expect(trigger('Font:').getAttribute('aria-label')).toBe('Font: Serif');
    expect(current(await open('Font:'))).toEqual(['Serif']);
  });

  it('marks the current size, strips its unit on the trigger and unsets through Default', async () => {
    const { editor, trigger, open, settle } = await mount();
    editor
      .chain()
      .setTextSelection({ from: 1, to: 6 })
      .setFontSize('18px')
      .run();
    await settle();
    expect(trigger('Font size').getAttribute('aria-label')).toBe(
      'Font size: 18',
    );
    expect(trigger('Font size').textContent?.trim()).toBe('18');

    const items = await open('Font size');
    expect(texts(items)).toEqual([
      'Default',
      '12',
      '14',
      '16',
      '18',
      '20',
      '24',
      '30',
      '36',
    ]);
    expect(current(items)).toEqual(['18']);
    items[0].click();
    await settle();
    expect(editor.getAttributes('textStyle')['fontSize'] ?? null).toBeNull();
    expect(editor.getHTML()).toContain('<p>plain text</p>');
  });

  it('shows a size outside the configured list on the trigger with no current item', async () => {
    const { editor, trigger, open, settle } = await mount([
      provideMlvEditorTextStyles({ fontSizes: ['14px', '28px'] }),
    ]);
    editor
      .chain()
      .setTextSelection({ from: 1, to: 6 })
      .setFontSize('13px')
      .run();
    await settle();
    expect(trigger('Font size').getAttribute('aria-label')).toBe(
      'Font size: 13',
    );
    const items = await open('Font size');
    expect(texts(items)).toEqual(['Default', '14', '28']);
    expect(current(items)).toEqual([]);
  });

  it('sets the block line height from an icon trigger named with the value', async () => {
    const { editor, trigger, open, settle } = await mount();
    editor.commands.setTextSelection(3);
    await settle();
    expect(trigger('Line height').getAttribute('aria-label')).toBe(
      'Line height: Default',
    );
    expect(trigger('Line height').textContent?.trim()).toBe('');
    expect(trigger('Line height').querySelector('svg')).not.toBeNull();

    const items = await open('Line height');
    expect(texts(items)).toEqual(['Default', '1', '1.15', '1.5', '2']);
    items[3].click();
    await settle();
    expect(editor.getHTML()).toContain(
      '<p style="line-height: 1.5;">plain text</p>',
    );
    expect(trigger('Line height').getAttribute('aria-label')).toBe(
      'Line height: 1.5',
    );
  });

  it('builds trigger names from the styleValue template, not by concatenation', async () => {
    const copy = signal({ ...en.editor, styleValue: '{value} ({label})' });
    const { trigger } = await mount([
      { provide: MLV_EDITOR_I18N, useValue: copy },
    ]);
    expect(trigger('Default (Font size').getAttribute('aria-label')).toBe(
      'Default (Font size)',
    );
  });

  it('disables every style trigger while the editor is disabled', async () => {
    const { fixture, trigger, settle } = await mount();
    fixture.componentInstance.disabled.set(true);
    await settle();
    for (const name of ['Font:', 'Font size', 'Line height']) {
      expect(trigger(name).disabled, name).toBe(true);
    }
  });

  it.each(['Font:', 'Font size', 'Line height'])(
    'has no axe violations with the %s menu open',
    async (name) => {
      const { editor, open, settle } = await mount();
      editor.commands.setTextSelection(3);
      await settle();
      expect((await open(name)).length).toBeGreaterThan(1);
      await expectNoAxeViolations(document.body);
    },
  );
});
