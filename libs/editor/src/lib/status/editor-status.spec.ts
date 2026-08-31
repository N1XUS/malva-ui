import { Component, signal, viewChild } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import StarterKit from '@tiptap/starter-kit';
import { MlvEditor } from '../editor/editor';
import { countMlvEditorWords } from '../extensions/editor-extensions';
import { MlvEditorStatus } from './editor-status';

@Component({
  imports: [MlvEditor],
  template: `
    <mlv-editor
      [value]="value()"
      (valueChange)="value.set($event); changes.push($event)"
      [characterLimit]="limit()"
    />
  `,
})
class StatusHost {
  readonly value = signal<string | null>(null);
  readonly limit = signal<number | null>(20);
  readonly changes: Array<string | null> = [];
  readonly editor = viewChild.required(MlvEditor);
}

describe('MlvEditorStatus', () => {
  async function createHost(): Promise<ComponentFixture<StatusHost>> {
    await TestBed.configureTestingModule({
      imports: [StatusHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(StatusHost);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it('uses CharacterCount storage and the shared Unicode word counter', async () => {
    const fixture = await createHost();
    const editor = fixture.componentInstance.editor().editor();
    if (!editor) throw new Error('Expected editor.');
    editor.commands.setContent('<p>One\u00a0two\u2003three</p>');
    fixture.detectChanges();

    const status = fixture.debugElement.query(By.directive(MlvEditorStatus))
      .componentInstance as MlvEditorStatus;
    expect(status).toBeDefined();
    expect(editor.storage.characterCount.characters()).toBe(
      'One\u00a0two\u2003three'.length,
    );
    expect(status?.characters()).toBe('One\u00a0two\u2003three'.length);
    expect(status?.words()).toBe(3);
    expect(countMlvEditorWords(' \tOne\u00a0two\u2003three\n')).toBe(3);
    expect(countMlvEditorWords(' \u2003 ')).toBe(0);

    const output = fixture.nativeElement.querySelector(
      'mlv-editor-status [role="status"]',
    ) as HTMLElement;
    expect(output.textContent).toContain(
      `${'One\u00a0two\u2003three'.length}/20 characters`,
    );
    expect(output.textContent).toContain('3 words');
    expect(output.getAttribute('aria-label')).toContain('remaining');
  });

  it('updates after transactions without dispatching or emitting a value for selection-only changes', async () => {
    const fixture = await createHost();
    const host = fixture.componentInstance;
    const editor = host.editor().editor();
    if (!editor) throw new Error('Expected editor.');
    editor.commands.setContent('<p>Count me</p>');
    fixture.detectChanges();
    host.changes.length = 0;
    const transactionsBefore = editor.state.tr.doc.content.size;

    editor.commands.setTextSelection(2);
    fixture.detectChanges();

    expect(host.changes).toEqual([]);
    expect(editor.state.doc.content.size).toBe(transactionsBefore);
    expect(
      fixture.nativeElement.querySelector('mlv-editor-status').textContent,
    ).toContain('8/20 characters');
  });

  it('normalizes invalid limits to unlimited and degrades quietly without CharacterCount', async () => {
    @Component({
      imports: [MlvEditor],
      template: `
        <mlv-editor [extensions]="extensions" [characterLimit]="limit()" />
      `,
    })
    class CustomHost {
      readonly extensions = [StarterKit.configure({})];
      readonly limit = signal<number | null>(Number.NaN);
    }

    await TestBed.configureTestingModule({
      imports: [CustomHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(CustomHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const status = fixture.nativeElement.querySelector(
      'mlv-editor-status',
    ) as HTMLElement;
    expect(status.hidden).toBe(true);
    expect(status.textContent?.trim()).toBe('');
  });
});
