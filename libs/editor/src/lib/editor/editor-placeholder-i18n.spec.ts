import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import type { EnvironmentProviders, Provider } from '@angular/core';
import { Component, signal } from '@angular/core';
import type { MlvLanguage } from '@malva-ui/i18n';
import { MlvI18nService, provideMlvI18n } from '@malva-ui/i18n';
import { deLanguage } from '@malva-ui/i18n/de';
import { enLanguage } from '@malva-ui/i18n/en';
import { ukLanguage } from '@malva-ui/i18n/uk';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvEditor } from './editor';

/**
 * #371: an empty `mlv-editor` showed the English `placeholder` default
 * ("Write something…") in every locale, and the placeholder was handed to
 * Tiptap once, at creation, so no later value — a bound `placeholder` change
 * or a language switch — ever reached the decoration. It now resolves from the
 * optional `editor.placeholder` key, English fallback, and follows both.
 */
@Component({
  imports: [MlvEditor],
  template: `@if (bound()) {
      <mlv-editor label="Notes" [placeholder]="placeholder()" />
    } @else {
      <mlv-editor label="Notes" />
    }`,
})
class EditorHost {
  readonly bound = signal(false);
  readonly placeholder = signal('Start writing');
}

/**
 * Records each `(transaction)` emission as its `docChanged` flag — a
 * primitive, so a failed assertion never pretty-prints a Tiptap transaction.
 */
@Component({
  imports: [MlvEditor],
  template: `<mlv-editor
    label="Notes"
    [placeholder]="placeholder()"
    (transaction)="docChanged.push($event.transaction.docChanged)"
  />`,
})
class TransactionHost {
  readonly placeholder = signal('Start writing');
  readonly docChanged: boolean[] = [];
}

/** The English pack with the #371 editor key replaced by a marker. */
const markerPack = {
  ...enLanguage,
  editor: { ...enLanguage.editor, placeholder: 'TYPE-HERE' },
} as MlvLanguage;

/** An older pack whose editor slice predates the #371 key. */
const legacyPack = (() => {
  const editor: Record<string, unknown> = { ...enLanguage.editor };
  delete editor['placeholder'];
  return { ...enLanguage, editor } as unknown as MlvLanguage;
})();

describe('MlvEditor — placeholder i18n (#371)', () => {
  let fixture: ComponentFixture<EditorHost>;

  const root = () => fixture.nativeElement as HTMLElement;

  async function render(
    providers: (Provider | EnvironmentProviders)[],
    pack?: MlvLanguage,
  ): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [EditorHost],
      providers,
    }).compileComponents();
    if (pack) TestBed.inject(MlvI18nService).setLanguage(pack);
    fixture = TestBed.createComponent(EditorHost);
    await settle();
  }

  async function withPack(pack: MlvLanguage): Promise<void> {
    await render([provideMlvI18n(async () => ({ default: pack }))], pack);
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const placeholder = () =>
    root()
      .querySelector('.ProseMirror [data-placeholder]')
      ?.getAttribute('data-placeholder') ?? null;

  it('shows the English placeholder under the testing pack', async () => {
    await render([provideMlvI18nTesting()]);
    expect(placeholder()).toBe('Write something…');
  });

  it('falls back to English for a pack that omits the key', async () => {
    await withPack(legacyPack);
    expect(placeholder()).toBe('Write something…');
  });

  it('reads the placeholder from the active pack', async () => {
    await withPack(markerPack);
    expect(placeholder()).toBe('TYPE-HERE');
  });

  it('renders the German pack and follows a live switch to Ukrainian', async () => {
    await withPack(deLanguage);
    expect(placeholder()).toBe('Schreiben Sie etwas…');

    TestBed.inject(MlvI18nService).setLanguage(ukLanguage);
    await settle();
    expect(placeholder()).toBe('Напишіть щось…');
  });

  it('keeps a bound placeholder over the pack and follows its changes', async () => {
    await withPack(deLanguage);
    fixture.componentInstance.bound.set(true);
    await settle();
    expect(placeholder()).toBe('Start writing');

    fixture.componentInstance.placeholder.set('Add a comment');
    await settle();
    expect(placeholder()).toBe('Add a comment');
  });

  it('emits one document-neutral transaction per placeholder change', async () => {
    await TestBed.configureTestingModule({
      imports: [TransactionHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const host = TestBed.createComponent(TransactionHost);
    const settleHost = async () => {
      host.detectChanges();
      await host.whenStable();
      host.detectChanges();
    };
    await settleHost();
    const events = host.componentInstance.docChanged;
    // Creation loads the value (a document change) and forces no redraw: the
    // editor starts with the placeholder it shows.
    expect(events.filter((changed) => !changed).length).toBe(0);
    const created = events.length;

    host.componentInstance.placeholder.set('Add a comment');
    await settleHost();
    expect(events.slice(created).join(',')).toBe('false');

    host.componentInstance.placeholder.set('Add a comment');
    await settleHost();
    expect(events.slice(created).join(',')).toBe('false');
    host.destroy();
  });

  it('has no axe violations with a localized pack', async () => {
    await withPack(deLanguage);
    await expectNoAxeViolations(root());
  });
});
