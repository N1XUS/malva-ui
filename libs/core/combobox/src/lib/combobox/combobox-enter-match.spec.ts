import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal, viewChild } from '@angular/core';
import { OverlayContainer } from '@angular/cdk/overlay';
import { Subject } from 'rxjs';
import type {
  MlvOptionMatcher,
  MlvOptionsInput,
  MlvOptionsSearchFn,
  MlvSelectOption,
} from '@malva-ui/core/dropdown';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvCombobox } from './combobox';

/**
 * #350 (audit OC-07): Enter decided whether the typed text named an existing
 * entry with a **case-only** comparison, while the list beneath it folds case
 * **and** diacritics (`normalizeForMatch`). Typing `cafe` listed "Café", yet
 * Enter treated it as no match: with `allowCreate` it minted a second value
 * `cafe` and emitted `valueCreated`; without it, it did nothing. The create
 * guard against the selection compared the raw text to the selected **values**
 * by `compareWith`, so a selected "Café" did not stop `cafe`, and a selected
 * `{ label: 'Ukraine', value: 'UA' }` did not stop `Ukraine` either.
 */

const COUNTRIES: MlvSelectOption<string>[] = [
  { label: 'Ukraine', value: 'UA' },
  { label: 'France', value: 'FR' },
];

@Component({
  template: `<mlv-combobox
    label="Tags"
    [options]="options()"
    [searchFn]="searchFn()"
    [matcher]="matcher()"
    [searchDebounce]="0"
    [multiple]="multiple()"
    [allowCreate]="allowCreate()"
    [(value)]="value"
    (valueCreated)="created.push($event)"
  />`,
  imports: [MlvCombobox],
})
class Host {
  readonly combobox = viewChild.required(MlvCombobox<unknown>);
  readonly options = signal<MlvOptionsInput<unknown>>([]);
  readonly searchFn = signal<MlvOptionsSearchFn<unknown> | null>(null);
  readonly matcher = signal<MlvOptionMatcher<unknown> | undefined>(undefined);
  readonly multiple = signal(false);
  readonly allowCreate = signal(true);
  readonly value = signal<unknown>(null);
  readonly created: unknown[] = [];
}

describe('MlvCombobox — Enter matches typed text the way the list does (#350)', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => TestBed.inject(OverlayContainer).ngOnDestroy());

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const input = (): HTMLInputElement =>
    (fixture.nativeElement as HTMLElement).querySelector(
      '.mlv-combobox__input input',
    ) as HTMLInputElement;

  const chips = (): string[] =>
    Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll(
        '.mlv-combobox__trigger > .mlv-combobox__chip',
      ),
    ).map((chip) => (chip.textContent ?? '').trim());

  /** Labels of the options the open list renders, in order. */
  const listed = (): string[] =>
    fixture.componentInstance
      .combobox()
      .filteredOptions()
      .map((option) => option.label);

  /** The open panel's empty-state text, trimmed. */
  const emptyState = (): string =>
    (document.querySelector('.mlv-combobox__empty')?.textContent ?? '').trim();

  /** The polite result-count announcement, trimmed. */
  const announcement = (): string =>
    (
      (fixture.nativeElement as HTMLElement).querySelector(
        '.mlv-combobox__sr-status',
      )?.textContent ?? ''
    ).trim();

  /** Focuses the trigger input and types `text` the way a user would. */
  async function type(text: string): Promise<void> {
    input().focus();
    await settle();
    input().value = text;
    input().dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  }

  /** Types `text` (see {@link type}), then presses Enter. */
  async function typeAndEnter(text: string): Promise<void> {
    await type(text);
    input().dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
  }

  async function use(options: MlvOptionsInput<unknown>): Promise<void> {
    host.options.set(options);
    await settle();
  }

  describe('a listed option the list shows for the query', () => {
    it('is selected, not created, when the text differs by diacritics', async () => {
      await use(['Café']);
      input().focus();
      await settle();
      input().value = 'cafe';
      input().dispatchEvent(new Event('input', { bubbles: true }));
      await settle();
      // The list and Enter must agree on what "cafe" names.
      expect(listed()).toEqual(['Café']);

      input().dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      );
      await settle();

      expect(host.value()).toBe('Café');
      expect(host.created).toEqual([]);
      expect(input().value).toBe('Café');
    });

    it('is selected in multi-select when case and diacritics both differ', async () => {
      host.multiple.set(true);
      await use(['Café', 'Tea']);
      await typeAndEnter('CAFE');

      expect(host.value()).toEqual(['Café']);
      expect(chips()).toEqual(['Café']);
      expect(host.created).toEqual([]);
    });

    it('is selected without allowCreate too', async () => {
      host.allowCreate.set(false);
      await use(['Café', 'Tea']);
      await typeAndEnter('cafe');

      expect(host.value()).toBe('Café');
    });

    /**
     * The fold strips every `\p{Diacritic}`, not only Latin accents, so text
     * that differs from a listed label by any of them names it — including
     * pairs a reader of those scripts calls different words. Both ways: the
     * mark may be on the typed text or on the label.
     */
    it.each([
      ['ASCII ^', '1.2.3', '^1.2.3'],
      ['kana handakuten', 'ピル', 'ビル'],
      ['prolonged sound mark', 'ハート', 'ハト'],
      ['Cyrillic breve', 'мои', 'мой'],
      ['ASCII ^, on the label', '^1.2.3', '1.2.3'],
      ['backticks, on the label', '`code`', 'code'],
      ['prolonged mark, on the label', 'カー', 'カ'],
    ])('is selected across the fold: %s', async (_, label, typed) => {
      host.allowCreate.set(false);
      await use([label]);
      await typeAndEnter(typed);

      expect(host.value()).toBe(label);
    });

    it('is selected when it is canonically equal (NFD label, NFC typed)', async () => {
      const decomposed = 'Re\u0301sume\u0301';
      await use(['Resume', decomposed]);
      await typeAndEnter('Résumé');

      expect(host.value()).toBe(decomposed);
      expect(host.created).toEqual([]);
    });
  });

  /**
   * Folding makes several listed options answer one query. The one that needs
   * the least folding wins: the same text first, then the same text in another
   * case, and only then the same letters without their diacritics — so typing
   * an option's label exactly never lands on a different option.
   */
  describe('the closest of several matching options wins', () => {
    it.each<[string, string[], string, string]>([
      [
        'exact text, over a plain twin first',
        ['Resume', 'Résumé'],
        'Résumé',
        'Résumé',
      ],
      [
        'exact text, over an accented twin first',
        ['Résumé', 'Resume'],
        'Resume',
        'Resume',
      ],
      ['exact text, over another case', ['apple', 'Apple'], 'Apple', 'Apple'],
      [
        'another case, over a diacritic fold',
        ['resume', 'RÉSUMÉ'],
        'Résumé',
        'RÉSUMÉ',
      ],
      [
        'the first in list order, among equals',
        ['Resume', 'Résumé'],
        'RESUME',
        'Resume',
      ],
    ])('%s', async (_, options, typed, expected) => {
      await use(options);
      await typeAndEnter(typed);

      expect(host.value()).toBe(expected);
      expect(host.created).toEqual([]);
    });
  });

  /**
   * Every label the case-only comparison before #350 named is still named:
   * the exact and case-only ranks never consult the fold. `normalizeForMatch`
   * strips every `\p{Diacritic}`, so a label made only of them (`^`, `` ` ``,
   * `´`) folds to `''`, and a final sigma folds differently once a spacing mark
   * after it is stripped — yet typed exactly, or in another case, each is
   * still the option Enter selects. Text that folds to `''` names no *other*
   * label through the fold. Decomposed text in another case is named by the
   * as-written comparison, where NFC and lower-casing do not commute.
   */
  describe('every label the case-only comparison named', () => {
    const MARKS: MlvSelectOption<string>[] = [
      { label: '+', value: 'plus' },
      { label: '^', value: 'pow' },
    ];

    it('is selected when typed exactly, without allowCreate', async () => {
      host.allowCreate.set(false);
      await use(MARKS);
      await typeAndEnter('^');

      expect(host.value()).toBe('pow');
    });

    it('is selected, not created, with allowCreate', async () => {
      await use(MARKS);
      await typeAndEnter('^');

      expect(host.value()).toBe('pow');
      expect(host.created).toEqual([]);
    });

    it('is not named by other text that folds to nothing', async () => {
      await use(MARKS);
      await typeAndEnter('`');

      expect(host.value()).toBe('`');
      expect(host.created).toEqual(['`']);
    });

    it('is selected in another case when its fold differs (final sigma)', async () => {
      // U+0F3E is `Diacritic=Yes` but not case-ignorable: before it, Σ lowers
      // to final ς; once the fold strips it, Σ sits mid-word and lowers to σ.
      const label = 'ΑΣ\u0F3EΒ';
      const typed = 'ας\u0F3Eβ';
      host.allowCreate.set(false);
      // The default filter keeps the two apart; a consumer matcher lists all.
      host.matcher.set(() => true);
      await use([{ label, value: 'sigma' }]);
      await typeAndEnter(typed);

      expect(host.value()).toBe('sigma');
    });

    it('is selected in another case when typed decomposed', async () => {
      // `T` + U+0308 has no precomposed form, `t` + U+0308 does (U+1E97): NFC
      // of the typed text no longer lower-cases to the label, so only the
      // comparison as written names it. Without that, the fold picks `t`.
      const label = 'T\u0308';
      const typed = 't\u0308';
      host.allowCreate.set(false);
      await use(['t', label]);
      await typeAndEnter(typed);

      expect(host.value()).toBe(label);
    });
  });

  describe('a selected token', () => {
    beforeEach(() => host.multiple.set(true));

    it('stops text equal to a selected value by compareWith', async () => {
      host.value.set(['UA']);
      await use(COUNTRIES);
      await typeAndEnter('UA');

      expect(host.value()).toEqual(['UA']);
      expect(chips()).toEqual(['Ukraine']);
      expect(host.created).toEqual([]);
    });

    it('stops a second token that differs by diacritics', async () => {
      await typeAndEnter('Café');
      expect(host.value()).toEqual(['Café']);

      await typeAndEnter('cafe');

      expect(host.value()).toEqual(['Café']);
      expect(chips()).toEqual(['Café']);
      expect(host.created).toEqual(['Café']);
    });

    it('stops a second token that differs by case', async () => {
      await typeAndEnter('New Tag');
      await typeAndEnter('new tag');

      expect(host.value()).toEqual(['New Tag']);
      expect(host.created).toEqual(['New Tag']);
    });

    it('is kept in single-select, the input showing it again', async () => {
      host.multiple.set(false);
      await settle();
      await typeAndEnter('Café');
      await typeAndEnter('CAFE');

      expect(host.value()).toBe('Café');
      expect(host.created).toEqual(['Café']);
      expect(input().value).toBe('Café');
    });

    /**
     * The guard reads the selected option's **label**, which #349 made real: a
     * value `'UA'` shown as "Ukraine" and no longer listed (a remote source
     * lists only the current query's results) still stops `Ukraine`. Against
     * the value it could not — `'Ukraine' !== 'UA'`.
     */
    it('stops text naming a labelled selection its value does not spell', async () => {
      const subjects: Subject<unknown[]>[] = [];
      host.options.set([]);
      host.searchFn.set(() => {
        const subject = new Subject<unknown[]>();
        subjects.push(subject);
        return subject.asObservable();
      });
      await settle();
      input().focus();
      await settle();
      subjects[0].next(COUNTRIES);
      await settle();
      input().value = 'ukr';
      input().dispatchEvent(new Event('input', { bubbles: true }));
      await settle();
      subjects[1].next([COUNTRIES[0]]);
      await settle();
      input().dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      );
      input().dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      );
      await settle();
      expect(host.value()).toEqual(['UA']);
      // The commit re-searches '' — answered with nothing.
      expect(subjects).toHaveLength(3);
      subjects[2].next([]);
      await settle();
      expect(chips()).toEqual(['Ukraine']);

      for (const typed of ['Ukraine', 'UKRAINE']) {
        input().value = typed;
        input().dispatchEvent(new Event('input', { bubbles: true }));
        await settle();
        // The query's own results do not list Ukraine.
        subjects[subjects.length - 1].next([COUNTRIES[1]]);
        await settle();
        expect(listed()).toEqual(['France']);
        input().dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
        );
        await settle();
      }

      expect(host.value()).toEqual(['UA']);
      expect(chips()).toEqual(['Ukraine']);
      expect(host.created).toEqual([]);
    });
  });

  describe('a created value', () => {
    beforeEach(() => host.multiple.set(true));

    it('is the text as typed (trimmed), never its folded form', async () => {
      await use(['Tea']);
      await typeAndEnter('  Crème Brûlée  ');

      expect(host.value()).toEqual(['Crème Brûlée']);
      expect(host.created).toEqual(['Crème Brûlée']);
    });

    it('is still created when the text only contains a listed label', async () => {
      await use(['Café']);
      await typeAndEnter('caf');

      expect(host.value()).toEqual(['caf']);
      expect(host.created).toEqual(['caf']);
    });
  });

  /**
   * With nothing listed, the panel offered "Press Enter to add" for any text
   * while `allowCreate` was on — also for text Enter refuses to add because it
   * names a selected value. It now offers the add exactly when Enter makes it,
   * and says "No results found" otherwise, on screen and in the live region.
   */
  describe('the empty state', () => {
    beforeEach(() => host.multiple.set(true));

    it('offers the add for text Enter would add', async () => {
      await use(['Tea']);
      await type('Coffee');

      expect(listed()).toEqual([]);
      expect(emptyState()).toBe('Press Enter to add "Coffee"');
      expect(announcement()).toBe('Press Enter to add "Coffee"');
    });

    it.each([
      ['a selected label in another case and accents', 'cafe'],
      ['a selected label exactly', 'Café'],
    ])('does not offer it for %s', async (_, typed) => {
      await typeAndEnter('Café');
      await type(typed);

      expect(listed()).toEqual([]);
      expect(emptyState()).toBe('No results found');
      expect(announcement()).toBe('No results found');
    });

    it('does not offer it for a selected value by compareWith', async () => {
      host.value.set(['UA']);
      await use(COUNTRIES);
      await type('UA');

      expect(listed()).toEqual([]);
      expect(emptyState()).toBe('No results found');
      expect(announcement()).toBe('No results found');
    });
  });
});
