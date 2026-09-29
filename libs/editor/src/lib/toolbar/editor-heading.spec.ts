import { LiveAnnouncer } from '@angular/cdk/a11y';
import { Clipboard } from '@angular/cdk/clipboard';
import { Component, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import type { Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { MlvEditor } from '../editor/editor';
import { MlvEditorHeadingAnchors } from '../extensions/heading-anchors/editor-heading-anchors';
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

@Component({
  imports: [MlvEditor, MlvEditorHeading, MlvEditorToolbarStartDef],
  template: `
    <mlv-editor label="Article" [extensions]="extensions" [(value)]="value">
      <mlv-editor-heading mlvEditorToolbarStart data-heading />
    </mlv-editor>
  `,
})
class HeadingLinkHost {
  extensions: Extensions = [StarterKit, MlvEditorHeadingAnchors];
  value = '<p>plain</p><h2>Second part</h2><h3></h3>';
  readonly editor = viewChild.required(MlvEditor);
}

describe('MlvEditorHeading "Copy link to heading"', () => {
  async function open(
    block: number,
    extensions?: Extensions,
    value?: string,
  ): Promise<{ panel: HTMLElement | null; copy: ReturnType<typeof vi.fn> }> {
    await TestBed.configureTestingModule({
      imports: [HeadingLinkHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const copy = vi
      .spyOn(TestBed.inject(Clipboard), 'copy')
      .mockReturnValue(true) as unknown as ReturnType<typeof vi.fn>;
    vi.spyOn(TestBed.inject(LiveAnnouncer), 'announce').mockResolvedValue();
    const fixture = TestBed.createComponent(HeadingLinkHost);
    if (extensions) fixture.componentInstance.extensions = extensions;
    if (value !== undefined) fixture.componentInstance.value = value;
    fixture.detectChanges();
    await fixture.whenStable();
    const editor = fixture.componentInstance.editor().editor();
    if (!editor) throw new Error('Expected a browser editor.');
    let position = 0;
    editor.state.doc.forEach((node, offset, index) => {
      if (index === block) position = offset + 1;
    });
    editor.commands.setTextSelection(position);
    fixture.detectChanges();
    await fixture.whenStable();
    const trigger = fixture.debugElement
      .query(By.css('[data-heading]'))
      .nativeElement.querySelector(
        'button[aria-label="Heading level"]',
      ) as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    return { panel: document.querySelector('.mlv-menu__panel'), copy };
  }

  const copyItem = (panel: HTMLElement | null): HTMLElement | undefined =>
    [...(panel?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])].find(
      (item) => item.textContent?.trim() === 'Copy link to heading',
    );

  it('copies the caret heading link from the menu', async () => {
    const { panel, copy } = await open(1);
    const item = copyItem(panel);
    expect(item?.getAttribute('aria-disabled')).not.toBe('true');
    item?.click();
    expect(copy).toHaveBeenCalledTimes(1);
    expect(String(copy.mock.calls[0]?.[0])).toMatch(/#second-part$/u);
  });

  it('is not offered on a paragraph', async () => {
    const { panel } = await open(0);
    expect(panel).not.toBeNull();
    expect(copyItem(panel)).toBeUndefined();
  });

  it('is not offered without the anchors extension', async () => {
    const { panel } = await open(1, [StarterKit]);
    expect(panel).not.toBeNull();
    expect(copyItem(panel)).toBeUndefined();
  });

  it('is disabled on a heading with no anchor', async () => {
    const { panel } = await open(2);
    expect(copyItem(panel)?.getAttribute('aria-disabled')).toBe('true');
  });

  it('has no axe violations with the item open', async () => {
    // Without the fixture's empty `<h3>`, which is document content axe
    // reports as `empty-heading` whether or not this menu exists.
    const { panel } = await open(
      1,
      undefined,
      '<p>plain</p><h2>Second part</h2>',
    );
    expect(copyItem(panel)).toBeDefined();
    await expectNoAxeViolations(document.body);
  });
});
