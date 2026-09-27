import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal, viewChild } from '@angular/core';
import { OverlayContainer } from '@angular/cdk/overlay';
import { Subject } from 'rxjs';
import type {
  MlvOptionsInput,
  MlvOptionsSearchFn,
  MlvSelectOption,
} from '@malva-ui/core/dropdown';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvCombobox } from './combobox';
import { MlvComboboxSelectedItemDef } from '../combobox-template.directives';

/**
 * #349 (audit OC-06): for `{ label, value }` options the combobox rendered the
 * committed **value** — chips "UA", "FR"; a single combobox "UA" in its input —
 * because it ran `toOption` over the value instead of taking the option that
 * value matched. `defaultOptionTransform('UA')` can only produce the label
 * `'UA'`. The same defect in `mlv-select` is #290.
 */

interface Country extends MlvSelectOption<string> {
  /** An extra option field, so the selected template can prove it got the option. */
  code: string;
}

const COUNTRIES: Country[] = [
  { label: 'Ukraine', value: 'UA', code: 'ua' },
  { label: 'France', value: 'FR', code: 'fr' },
  { label: 'Germany', value: 'DE', code: 'de' },
];

@Component({
  template: `<mlv-combobox
    label="Country"
    [options]="options()"
    [searchFn]="searchFn()"
    [searchDebounce]="0"
    [multiple]="multiple()"
    [allowCreate]="allowCreate()"
    [(value)]="value"
  />`,
  imports: [MlvCombobox],
})
class Host {
  readonly combobox = viewChild.required(MlvCombobox<unknown>);
  readonly options = signal<MlvOptionsInput<unknown>>(COUNTRIES);
  readonly searchFn = signal<MlvOptionsSearchFn<unknown> | null>(null);
  readonly multiple = signal(false);
  readonly allowCreate = signal(false);
  readonly value = signal<unknown>(null);
}

@Component({
  template: `<mlv-combobox
    label="Country"
    multiple
    [options]="countries"
    [(value)]="value"
  >
    <ng-template mlvComboboxSelectedItemDef let-option>
      <span class="country">{{ option.label }} ({{ option.code }})</span>
    </ng-template>
  </mlv-combobox>`,
  imports: [MlvCombobox, MlvComboboxSelectedItemDef],
})
class TemplateHost {
  readonly countries = COUNTRIES;
  readonly value = signal<unknown>(['UA']);
}

describe('MlvCombobox — option labels for { label, value } options (#349)', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Host, TemplateHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(Host);
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

  /** Types into the trigger input the way a user would. */
  function type(text: string): void {
    input().value = text;
    input().dispatchEvent(new Event('input', { bubbles: true }));
  }

  function key(name: string): void {
    input().dispatchEvent(
      new KeyboardEvent('keydown', {
        key: name,
        bubbles: true,
        cancelable: true,
      }),
    );
  }

  describe('multi-select chips', () => {
    beforeEach(async () => {
      fixture.componentInstance.multiple.set(true);
      await settle();
    });

    it('shows the matched options’ labels for a written value', async () => {
      fixture.componentInstance.value.set(['UA', 'FR']);
      await settle();

      expect(chips()).toEqual(['Ukraine', 'France']);
    });

    it('shows the label of an option picked from the list', async () => {
      input().focus();
      await settle();
      type('germ');
      await settle();
      key('ArrowDown');
      key('Enter');
      await settle();

      expect(fixture.componentInstance.value()).toEqual(['DE']);
      expect(chips()).toEqual(['Germany']);
    });

    it('announces the armed chip by its label', async () => {
      fixture.componentInstance.value.set(['UA', 'FR']);
      await settle();
      input().focus();
      key('Backspace');
      await settle();

      const status = Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll(
          '.mlv-combobox__sr-status',
        ),
      ).map((region) => (region.textContent ?? '').trim());
      expect(status).toContain('France');
      expect(status).not.toContain('FR');
    });

    it('still falls back to the value for one no option matches (allowCreate)', async () => {
      fixture.componentInstance.allowCreate.set(true);
      fixture.componentInstance.value.set(['UA']);
      await settle();
      input().focus();
      type('Atlantis');
      await settle();
      key('Enter');
      await settle();

      expect(fixture.componentInstance.value()).toEqual(['UA', 'Atlantis']);
      expect(chips()).toEqual(['Ukraine', 'Atlantis']);
    });
  });

  describe('single-select committed label', () => {
    it('shows the matched option’s label for a written value', async () => {
      fixture.componentInstance.value.set('UA');
      await settle();

      expect(input().value).toBe('Ukraine');
    });

    it('reverts to the label, not the value, when a search is abandoned on blur', async () => {
      fixture.componentInstance.value.set('UA');
      await settle();
      input().focus();
      type('fra');
      await settle();
      input().blur();
      await settle();

      expect(fixture.componentInstance.value()).toBe('UA');
      expect(input().value).toBe('Ukraine');
    });

    it('keeps the label of a picked option after blur', async () => {
      input().focus();
      await settle();
      type('fra');
      await settle();
      key('ArrowDown');
      key('Enter');
      await settle();
      input().blur();
      await settle();

      expect(fixture.componentInstance.value()).toBe('FR');
      expect(input().value).toBe('France');
    });
  });

  describe('falsy option values (the #300 shapes)', () => {
    const ANSWERS: MlvSelectOption<unknown>[] = [
      { label: 'No', value: false },
      { label: 'Zero', value: 0 },
      { label: 'Empty', value: '' },
      { label: 'None', value: null },
    ];

    beforeEach(async () => {
      fixture.componentInstance.options.set(ANSWERS);
      await settle();
    });

    it('labels every chip, falsy values included', async () => {
      fixture.componentInstance.multiple.set(true);
      fixture.componentInstance.value.set([false, 0, '', null]);
      await settle();

      expect(chips()).toEqual(['No', 'Zero', 'Empty', 'None']);
    });

    it.each<[unknown, string]>([
      [false, 'No'],
      [0, 'Zero'],
    ])('shows the label for a single value of %j', async (value, label) => {
      fixture.componentInstance.value.set(value);
      await settle();

      expect(input().value).toBe(label);
    });
  });

  it('hands the selected-item template the matched option itself', async () => {
    const templated = TestBed.createComponent(TemplateHost);
    templated.detectChanges();
    await templated.whenStable();
    templated.detectChanges();

    const rendered = (templated.nativeElement as HTMLElement).querySelector(
      '.mlv-combobox__chip .country',
    );
    expect(rendered?.textContent?.trim()).toBe('Ukraine (ua)');
  });

  /**
   * A remote source (`searchFn`, `MlvDataSource`) holds only the current
   * query's results, so the option a value matched can leave the list while the
   * value stays committed. Resolving from the current list alone would flip a
   * chip from "Ukraine" to "UA" as soon as the user searched for something
   * else; the label resolved while the option was listed is kept instead.
   */
  describe('remote source: a resolved label outlives the result list', () => {
    function installSearchFn(): Subject<unknown[]>[] {
      const subjects: Subject<unknown[]>[] = [];
      fixture.componentInstance.options.set([]);
      fixture.componentInstance.searchFn.set(() => {
        const subject = new Subject<unknown[]>();
        subjects.push(subject);
        return subject.asObservable();
      });
      return subjects;
    }

    it('keeps a chip’s label while later searches exclude its option', async () => {
      fixture.componentInstance.multiple.set(true);
      const subjects = installSearchFn();
      await settle();
      input().focus();
      await settle();
      subjects[0].next(COUNTRIES);
      await settle();
      key('ArrowDown');
      key('Enter');
      await settle();
      expect(chips()).toEqual(['Ukraine']);

      type('fr');
      await settle();
      subjects[1].next([COUNTRIES[1]]);
      await settle();
      expect(chips()).toEqual(['Ukraine']);

      key('ArrowDown');
      key('Enter');
      await settle();
      // The commit re-searches '' — answered here with nothing at all.
      expect(subjects).toHaveLength(3);
      subjects[2].next([]);
      await settle();
      expect(fixture.componentInstance.value()).toEqual(['UA', 'FR']);
      expect(chips()).toEqual(['Ukraine', 'France']);
    });

    it('keeps a single-select label after the post-commit re-search', async () => {
      const subjects = installSearchFn();
      await settle();
      input().focus();
      await settle();
      subjects[0].next(COUNTRIES);
      await settle();
      type('ger');
      await settle();
      subjects[1].next([COUNTRIES[2]]);
      await settle();
      key('ArrowDown');
      key('Enter');
      await settle();
      // The commit re-searches '' — answered here with nothing at all.
      expect(subjects).toHaveLength(3);
      subjects[2].next([]);
      await settle();

      expect(fixture.componentInstance.value()).toBe('DE');
      expect(input().value).toBe('Germany');
    });

    it('forgets the label once the value is deselected', async () => {
      fixture.componentInstance.multiple.set(true);
      const subjects = installSearchFn();
      await settle();
      input().focus();
      await settle();
      subjects[0].next(COUNTRIES);
      await settle();
      key('ArrowDown');
      key('Enter');
      await settle();
      // A search whose results exclude Ukraine — the adapter takes one
      // emission per query, so only a new query can replace the list.
      type('fr');
      await settle();
      expect(subjects).toHaveLength(2);
      subjects[1].next([COUNTRIES[1]]);
      await settle();
      expect(chips()).toEqual(['Ukraine']);

      fixture.componentInstance.combobox().removeSelected('UA');
      await settle();
      expect(chips()).toEqual([]);

      // Written back while no result lists it: nothing is remembered for a
      // value that left the selection, so it renders as its value again.
      fixture.componentInstance.value.set(['UA']);
      await settle();
      expect(chips()).toEqual(['UA']);
    });
  });
});
