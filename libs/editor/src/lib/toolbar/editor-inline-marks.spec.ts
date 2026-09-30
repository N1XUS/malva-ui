import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import type { Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { MlvEditor } from '../editor/editor';
import type { MlvEditorInlineMark } from './editor-inline-marks';
import { MlvEditorInlineMarks } from './editor-inline-marks';

@Component({
  imports: [MlvEditor, MlvEditorInlineMarks],
  template: `
    <mlv-editor label="Marks" value="<p>Alpha</p>" [extensions]="extensions()">
      <mlv-editor-inline-marks mlvEditorToolbarStart [marks]="marks()" />
    </mlv-editor>
  `,
})
class MarksHost {
  readonly marks = signal<readonly MlvEditorInlineMark[] | undefined>(
    undefined,
  );
  readonly extensions = signal<Extensions | undefined>(undefined);
}

async function names(
  configure: (host: MarksHost) => void,
): Promise<(string | null)[]> {
  await TestBed.configureTestingModule({
    imports: [MarksHost],
    providers: [provideMlvI18nTesting()],
  }).compileComponents();
  const fixture = TestBed.createComponent(MarksHost);
  configure(fixture.componentInstance);
  document.body.appendChild(fixture.nativeElement);
  fixture.detectChanges();
  await fixture.whenStable();
  await Promise.resolve();
  fixture.detectChanges();
  await fixture.whenStable();
  const group = (fixture.nativeElement as HTMLElement).querySelector(
    '[mlvEditorToolbarStart]',
  ) as HTMLElement;
  // A mark whose extension is absent keeps its command button, hidden.
  return [...group.querySelectorAll('button')]
    .filter((button) => button.closest('[hidden]') === null)
    .map((button) => button.getAttribute('aria-label'));
}

describe('MlvEditorInlineMarks marks (#516)', () => {
  it('renders all seven marks by default, in the fixed order', async () => {
    expect(await names(() => undefined)).toEqual([
      'Bold',
      'Italic',
      'Strike-through',
      'Underline',
      'Inline code',
      'Subscript',
      'Superscript',
    ]);
  });

  it('filters to the listed marks and keeps the fixed order whatever order they are written in', async () => {
    expect(
      await names((host) => host.marks.set(['code', 'italic', 'bold'])),
    ).toEqual(['Bold', 'Italic', 'Inline code']);
  });

  it('ignores an unknown mark and renders nothing for an empty list', async () => {
    expect(
      await names((host) =>
        host.marks.set(['bold', 'blink' as MlvEditorInlineMark]),
      ),
    ).toEqual(['Bold']);
    TestBed.resetTestingModule();
    expect(await names((host) => host.marks.set([]))).toEqual([]);
  });

  it('still hides a listed mark whose extension is absent', async () => {
    expect(
      await names((host) => {
        host.extensions.set([StarterKit]);
        host.marks.set(['superscript', 'bold']);
      }),
    ).toEqual(['Bold']);
  });
});
