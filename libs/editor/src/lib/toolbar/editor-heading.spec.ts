import { Component, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import StarterKit from '@tiptap/starter-kit';
import { MlvEditor } from '../editor/editor';
import { MlvEditorToolbarStartDef } from './editor-toolbar.defs';
import { MlvEditorHeading, type MlvEditorHeadingLevel } from './editor-heading';

@Component({
  imports: [MlvEditor, MlvEditorHeading, MlvEditorToolbarStartDef],
  template: `
    <mlv-editor [extensions]="extensions">
      <mlv-editor-heading
        mlvEditorToolbarStart
        [levels]="levels"
        data-restricted-heading
      />
    </mlv-editor>
  `,
})
class HeadingHost {
  readonly extensions = [StarterKit.configure({ heading: { levels: [4, 2] } })];
  readonly levels = [3, 4, 2, 4, 1] as readonly MlvEditorHeadingLevel[];
  readonly editor = viewChild.required(MlvEditor);
}

describe('MlvEditorHeading levels', () => {
  it('preserves paragraph and caller order while filtering duplicate and unavailable levels', async () => {
    await TestBed.configureTestingModule({
      imports: [HeadingHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(HeadingHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const heading = fixture.debugElement.query(
      By.css('[data-restricted-heading]'),
    );
    const trigger = heading.nativeElement.querySelector(
      'button[aria-label="Heading level"]',
    ) as HTMLButtonElement;
    const component = heading.componentInstance as MlvEditorHeading;
    const supportedLevels = (
      component as unknown as {
        readonly _levels: () => readonly MlvEditorHeadingLevel[];
      }
    )._levels();

    expect(trigger.textContent?.trim()).toBe('');
    expect(trigger.querySelector('svg')).not.toBeNull();
    expect(trigger.getAttribute('aria-label')).toBe('Heading level');
    expect(supportedLevels).toEqual([4, 2]);
  });
});

@Component({
  imports: [MlvEditor, MlvEditorHeading, MlvEditorToolbarStartDef],
  template: `
    <mlv-editor [extensions]="extensions" [(value)]="value">
      <mlv-editor-heading mlvEditorToolbarStart data-heading />
    </mlv-editor>
  `,
})
class HeadingStateHost {
  readonly extensions = [StarterKit];
  value = '<p>plain</p><h2>second</h2><h4>fourth</h4>';
  readonly editor = viewChild.required(MlvEditor);
}

describe('MlvEditorHeading trigger state', () => {
  /**
   * The trigger is a menu button, so it reflects the active block type through
   * `mlv-button--selected` (paint only) rather than `aria-pressed`, which would
   * claim the toggle-button pattern on top of `aria-haspopup`/`aria-expanded`.
   */
  async function headingTrigger(): Promise<{
    trigger: HTMLButtonElement;
    editor: NonNullable<ReturnType<MlvEditor['editor']>>;
    settle: () => Promise<void>;
  }> {
    await TestBed.configureTestingModule({
      imports: [HeadingStateHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(HeadingStateHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const editor = fixture.componentInstance.editor().editor();
    if (!editor) throw new Error('Expected a browser editor.');

    return {
      trigger: fixture.debugElement
        .query(By.css('[data-heading]'))
        .nativeElement.querySelector(
          'button[aria-label="Heading level"]',
        ) as HTMLButtonElement,
      editor,
      settle: async () => {
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
      },
    };
  }

  /** Lucide renders its icon name as a `lucide-<name>` class on the `<svg>`. */
  function iconName(trigger: HTMLButtonElement): string | undefined {
    return [...(trigger.querySelector('svg')?.classList ?? [])].find(
      (token) => token.startsWith('lucide-') && token !== 'lucide-icon',
    );
  }

  /** First text position inside the top-level block at `index`. */
  function insideBlock(
    editor: NonNullable<ReturnType<MlvEditor['editor']>>,
    index: number,
  ): number {
    let position = 0;
    editor.state.doc.forEach((node, offset, childIndex) => {
      if (childIndex === index) position = offset + 1;
    });
    return position;
  }

  it('stays unselected on a paragraph and shows the generic heading glyph', async () => {
    const { trigger, editor, settle } = await headingTrigger();
    editor.commands.setTextSelection(insideBlock(editor, 0));
    await settle();

    expect(trigger.classList).not.toContain('mlv-button--selected');
    expect(trigger.hasAttribute('aria-pressed')).toBe(false);
    expect(iconName(trigger)).toBe('lucide-heading');
  });

  it('selects the trigger and swaps in the level glyph inside a heading', async () => {
    const { trigger, editor, settle } = await headingTrigger();

    editor.commands.setTextSelection(insideBlock(editor, 1));
    await settle();
    expect(trigger.classList).toContain('mlv-button--selected');
    expect(trigger.hasAttribute('aria-pressed')).toBe(false);
    expect(iconName(trigger)).toBe('lucide-heading-2');

    editor.commands.setTextSelection(insideBlock(editor, 2));
    await settle();
    expect(trigger.classList).toContain('mlv-button--selected');
    expect(iconName(trigger)).toBe('lucide-heading-4');
  });
});
