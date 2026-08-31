import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import axe from 'axe-core';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MlvEditor } from './editor';

const editorStyles = readFileSync(
  join(process.cwd(), 'libs/editor/src/lib/editor/editor.scss'),
  'utf8',
);

@Component({
  imports: [MlvEditor],
  template: `
    <mlv-editor
      label="Article"
      [readonly]="readonly()"
      [disabled]="disabled()"
      [state]="state()"
      [message]="state() === 'error' ? 'Content is invalid' : ''"
      [characterLimit]="100"
      placeholder="Start writing"
    />
  `,
})
class A11yHost {
  readonly readonly = signal(false);
  readonly disabled = signal(false);
  readonly state = signal<'default' | 'error'>('default');
  readonly editor = viewChild.required(MlvEditor);
}

describe('MlvEditor accessibility', () => {
  async function createHost() {
    await TestBed.configureTestingModule({
      imports: [A11yHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(A11yHost);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it('keeps a stable named textbox across readonly, disabled, and error states', async () => {
    const fixture = await createHost();
    const host = fixture.componentInstance;
    const content = fixture.nativeElement.querySelector(
      '.ProseMirror',
    ) as HTMLElement;
    expect(content.getAttribute('role')).toBe('textbox');
    expect(content.getAttribute('aria-labelledby')).toBe(
      `${host.editor().id()}-label`,
    );
    expect(content.getAttribute('tabindex')).toBe('0');

    host.readonly.set(true);
    fixture.detectChanges();
    expect(content.getAttribute('aria-readonly')).toBe('true');
    expect(content.getAttribute('tabindex')).toBe('0');

    host.readonly.set(false);
    host.state.set('error');
    fixture.detectChanges();
    expect(content.getAttribute('aria-invalid')).toBe('true');
    expect(content.getAttribute('aria-describedby')).toBe(
      `${host.editor().id()}-message`,
    );

    host.disabled.set(true);
    fixture.detectChanges();
    expect(content.getAttribute('aria-disabled')).toBe('true');
    expect(content.getAttribute('tabindex')).toBe('-1');
  });

  it('uses Tiptap placeholder decorations without serializing placeholder text', async () => {
    const fixture = await createHost();
    const editor = fixture.componentInstance.editor().editor();
    const content = fixture.nativeElement.querySelector(
      '.ProseMirror',
    ) as HTMLElement;
    const placeholder = content.querySelector(
      '[data-placeholder]',
    ) as HTMLElement;
    expect(placeholder.getAttribute('data-placeholder')).toBe('Start writing');
    expect(placeholder.classList.contains('is-editor-empty')).toBe(true);
    expect(content.hasAttribute('placeholder')).toBe(false);
    expect(editor?.getHTML()).not.toContain('Start writing');

    editor?.commands.setContent('<p>Written</p><p></p>');
    fixture.detectChanges();
    expect(content.querySelector('.is-editor-empty')).toBeNull();
    expect(content.querySelector('.is-empty[data-placeholder]')).not.toBeNull();
    expect(editor?.getHTML()).not.toContain('Start writing');

    expect(editorStyles).toContain('.is-editor-empty:first-child');
    expect(editorStyles).not.toContain('.is-empty::before');
    expect(editorStyles).not.toContain(
      '--mlv-typography-heading-h3-letter-spacing',
    );
  });

  it('keeps the block handle out of the accessibility tree and the tab order', async () => {
    const fixture = await createHost();

    const handle = fixture.nativeElement.querySelector(
      '.mlv-editor__block-handle',
    ) as HTMLElement | null;

    expect(handle).not.toBeNull();
    expect(handle?.getAttribute('aria-hidden')).toBe('true');
    expect(handle?.hasAttribute('tabindex')).toBe(false);
    expect(
      fixture.nativeElement.querySelectorAll('[tabindex]:not([tabindex="-1"])')
        .length,
    ).toBeLessThanOrEqual(2);
  });

  it('has no serious or critical axe violations in representative states', async () => {
    const fixture = await createHost();
    const host = fixture.componentInstance;
    const editor = host.editor().editor();
    editor?.commands.insertTable({ rows: 2, cols: 1, withHeaderRow: true });
    editor?.commands.insertUploadPlaceholder({
      id: 'accessible-upload',
      progress: 42,
    });
    fixture.detectChanges();

    for (const state of ['default', 'readonly', 'error', 'disabled'] as const) {
      host.readonly.set(state === 'readonly');
      host.disabled.set(state === 'disabled');
      host.state.set(state === 'error' ? 'error' : 'default');
      fixture.detectChanges();
      const results = await axe.run(fixture.nativeElement as HTMLElement, {
        resultTypes: ['violations'],
        // jsdom has no canvas-backed contrast computation; token contrast is
        // covered by browser/manual review rather than a false automated result.
        rules: { 'color-contrast': { enabled: false } },
      });
      expect(
        results.violations.filter(
          ({ impact }) => impact === 'serious' || impact === 'critical',
        ),
      ).toEqual([]);
    }
  }, 20_000);
});
