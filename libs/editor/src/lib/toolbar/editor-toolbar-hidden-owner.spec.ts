import { Component, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { Editor, type Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import type { MlvEditorToolbarContext } from '../editor-toolbar-context';
import { MlvEditor } from '../editor/editor';
import { mlvEditorDefaultExtensions } from '../extensions/editor-extensions';
import { MlvEditorAlignment } from './editor-alignment';
import { MlvEditorFontSize } from './editor-font-size';
import { MlvEditorToolbar } from './editor-toolbar';
import { MlvEditorToolbarDef } from './editor-toolbar.defs';
import { MlvEditorToolbarRoot } from './editor-toolbar-root';

/** Hosts whose `hidden` both "unsupported" and "narrow" decide. */
const HOSTS = [
  'mlv-editor-font-family',
  'mlv-editor-font-size',
  'mlv-editor-alignment',
  'mlv-editor-line-height',
] as const;

@Component({
  imports: [MlvEditor],
  template: `<mlv-editor label="Doc" [extensions]="extensions()" />`,
})
class EditorHost {
  readonly extensions = signal<Extensions>([StarterKit]);
}

@Component({
  imports: [
    MlvEditor,
    MlvEditorToolbarDef,
    MlvEditorAlignment,
    MlvEditorFontSize,
  ],
  template: `
    <mlv-editor label="Doc">
      <ng-template mlvEditorToolbar>
        <mlv-editor-alignment />
        <mlv-editor-font-size />
      </ng-template>
    </mlv-editor>
  `,
})
class CustomToolbarHost {}

@Component({
  imports: [MlvEditorToolbar],
  template: '<mlv-editor-toolbar [context]="context" />',
})
class StandaloneHost {
  readonly editor = signal<Editor | null>(null);
  readonly context: MlvEditorToolbarContext = {
    editor: this.editor.asReadonly(),
    disabled: signal(false).asReadonly(),
    readonly: signal(false).asReadonly(),
    focused: signal(false).asReadonly(),
    editable: signal(true).asReadonly(),
    format: signal<'html'>('html').asReadonly(),
    zoom: signal(100),
    run: (command) => {
      const editor = this.editor();
      return editor ? command(editor) : false;
    },
    can: (command) => {
      const editor = this.editor();
      return editor ? command(editor) : false;
    },
    isActive: (name, attributes) =>
      this.editor()?.isActive(name, attributes) ?? false,
    reportError: () => undefined,
  };
}

/** Editors created outside a component, destroyed after each spec. */
const standaloneEditors: Editor[] = [];
afterEach(() => {
  for (const editor of standaloneEditors.splice(0)) editor.destroy();
});

async function create<T>(
  type: new () => T,
  configure?: (instance: T) => void,
): Promise<ComponentFixture<T>> {
  await TestBed.configureTestingModule({
    imports: [type],
    providers: [provideMlvI18nTesting()],
  }).compileComponents();
  const fixture = TestBed.createComponent(type);
  configure?.(fixture.componentInstance);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

/** Sets narrow mode on the fixture's toolbar root and settles. */
async function setNarrow(
  fixture: ComponentFixture<unknown>,
  narrow: boolean,
): Promise<void> {
  fixture.debugElement
    .query(By.directive(MlvEditorToolbarRoot))
    .injector.get(MlvEditorToolbarRoot)
    .narrow.set(narrow);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

/** `hidden` of each host, keyed by tag, as one comparable string. */
function hiddenState(fixture: ComponentFixture<unknown>): string {
  const root = fixture.nativeElement as HTMLElement;
  return HOSTS.map((tag) => {
    const host = root.querySelector<HTMLElement>(tag);
    return `${tag}=${host === null ? 'absent' : String(host.hidden)}`;
  }).join(' ');
}

const allHidden = HOSTS.map((tag) => `${tag}=true`).join(' ');
const allShown = HOSTS.map((tag) => `${tag}=false`).join(' ');

describe('one hidden owner per toolbar host (#514 review)', () => {
  it('keeps unsupported hosts hidden across wide → narrow → wide', async () => {
    const fixture = await create(EditorHost);
    expect(hiddenState(fixture)).toBe(allHidden);
    await setNarrow(fixture, true);
    expect(hiddenState(fixture)).toBe(allHidden);
    await setNarrow(fixture, false);
    expect(hiddenState(fixture)).toBe(allHidden);
  });

  it('still hides supported hosts while narrow and restores them after', async () => {
    const fixture = await create(EditorHost, (host) =>
      host.extensions.set(mlvEditorDefaultExtensions()),
    );
    expect(hiddenState(fixture)).toBe(allShown);
    await setNarrow(fixture, true);
    expect(hiddenState(fixture)).toBe(allHidden);
    await setNarrow(fixture, false);
    expect(hiddenState(fixture)).toBe(allShown);
  });

  it('keeps unsupported hosts hidden in the standalone shell after a round trip', async () => {
    const fixture = await create(StandaloneHost, (host) => {
      const editor = new Editor({
        extensions: [StarterKit],
        content: '<p>Text</p>',
      });
      standaloneEditors.push(editor);
      host.editor.set(editor);
    });
    expect(hiddenState(fixture)).toBe(allHidden);
    await setNarrow(fixture, true);
    await setNarrow(fixture, false);
    expect(hiddenState(fixture)).toBe(allHidden);
  });

  it('leaves controls in a consumer toolbar visible while narrow', async () => {
    const fixture = await create(CustomToolbarHost);
    await setNarrow(fixture, true);
    const root = fixture.nativeElement as HTMLElement;
    expect(
      ['mlv-editor-alignment', 'mlv-editor-font-size']
        .map(
          (tag) =>
            `${tag}=${String(root.querySelector<HTMLElement>(tag)?.hidden)}`,
        )
        .join(' '),
    ).toBe('mlv-editor-alignment=false mlv-editor-font-size=false');
  });
});
