import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import type { Signal } from '@angular/core';
import { Component, signal, viewChild } from '@angular/core';
import { OverlayContainer } from '@angular/cdk/overlay';
import { By } from '@angular/platform-browser';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import axe from 'axe-core';
import { Subject } from 'rxjs';
import { MlvInput } from '@malva-ui/core/input';
import { MlvPopup } from '@malva-ui/core/popup';
import type { MlvPopupMobileMode } from '@malva-ui/core/popup';
import { MlvDataSource } from '@malva-ui/cdk/data-source';
import { MlvSelectDataSource } from '@malva-ui/core/dropdown';
import type {
  MlvOptionsInput,
  MlvOptionsSearchFn,
} from '@malva-ui/core/dropdown';
import { MlvCombobox } from './combobox';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

interface Tag {
  id: number;
  name: string;
}

@Component({
  template: `<mlv-combobox [options]="['Option 1', 'Option 2']" />`,
  imports: [MlvCombobox],
})
class TestHostComponent {
  readonly combobox = viewChild.required(MlvCombobox);
}

@Component({
  template: `<mlv-combobox
    [options]="['Option 1', 'Option 2']"
    [multiple]="true"
  />`,
  imports: [MlvCombobox],
})
class MultiHostComponent {
  readonly combobox = viewChild.required(MlvCombobox);
}

@Component({
  template: `<mlv-combobox
    [options]="['Option 1', 'Option 2']"
    [allowCreate]="true"
  />`,
  imports: [MlvCombobox],
})
class AllowCreateHostComponent {
  readonly combobox = viewChild.required(MlvCombobox);
}

@Component({
  template: `<mlv-combobox
    [options]="['Option 1', 'Option 2']"
    [disabled]="disabled"
    [readonly]="readonly"
  />`,
  imports: [MlvCombobox],
})
class GatedHostComponent {
  readonly combobox = viewChild.required(MlvCombobox);
  disabled = false;
  readonly = false;
}

@Component({
  template: `<mlv-combobox
    [options]="tags"
    [toOption]="toOption"
    [compareWith]="compareWith"
  />`,
  imports: [MlvCombobox],
})
class CompareWithHostComponent {
  readonly combobox = viewChild.required(MlvCombobox<Tag>);
  readonly tags: Tag[] = [
    { id: 1, name: 'Alpha' },
    { id: 2, name: 'Beta' },
  ];
  readonly toOption = (t: Tag) => ({ label: t.name, value: t });
  readonly compareWith = (a: Tag, b: Tag) => a.id === b.id;
}

function setup<T extends { combobox: unknown }>(
  host: new () => T,
): ComponentFixture<T> {
  const fixture = TestBed.createComponent(host);
  fixture.detectChanges();
  return fixture;
}

function nativeInput(fixture: ComponentFixture<unknown>): HTMLInputElement {
  return fixture.debugElement
    .query(By.css('.mlv-combobox__input'))
    .nativeElement.querySelector('input') as HTMLInputElement;
}

function setComboboxValue<T>(
  fixture: ComponentFixture<unknown>,
  combobox: MlvCombobox<T>,
  value: T | T[] | null,
): void {
  combobox.value.set(value);
  fixture.detectChanges();
}

describe('MlvCombobox', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('should create', () => {
    const el = fixture.nativeElement.querySelector('mlv-combobox');
    expect(el).toBeTruthy();
  });

  it('exposes a single combobox role on the native input only', () => {
    const input = nativeInput(fixture);
    const host = fixture.nativeElement.querySelector('mlv-input');
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    // No duplicate role leaked onto the mlv-input host element (defect #5).
    expect(host.getAttribute('role')).toBeNull();
  });

  it('provides a polite aria-live status region', () => {
    const status = fixture.nativeElement.querySelector(
      '.mlv-combobox__sr-status',
    ) as HTMLElement;
    expect(status).toBeTruthy();
    expect(status.getAttribute('aria-live')).toBe('polite');
  });

  it('announces the result count through i18n', () => {
    const combobox = fixture.componentInstance.combobox();
    combobox.onInputFocus();
    fixture.detectChanges();
    const status = fixture.nativeElement.querySelector(
      '.mlv-combobox__sr-status',
    ) as HTMLElement;
    expect(status.textContent).toContain('2 results available');
  });

  describe('chevron toggle (defect #4)', () => {
    it('renders a real, labelled toggle button kept out of the tab order', () => {
      const arrow = fixture.nativeElement.querySelector(
        '.mlv-combobox__arrow',
      ) as HTMLButtonElement;
      expect(arrow.tagName).toBe('BUTTON');
      expect(arrow.getAttribute('type')).toBe('button');
      expect(arrow.getAttribute('tabindex')).toBe('-1');
      expect(arrow.getAttribute('aria-label')).toBeTruthy();
      expect(arrow.getAttribute('aria-hidden')).toBeNull();
    });

    it('toggles the popup open and closed via mousedown', () => {
      const combobox = fixture.componentInstance.combobox();
      const arrow = fixture.nativeElement.querySelector(
        '.mlv-combobox__arrow',
      ) as HTMLButtonElement;

      arrow.dispatchEvent(new MouseEvent('mousedown', { cancelable: true }));
      fixture.detectChanges();
      expect(combobox.isOpen()).toBe(true);

      arrow.dispatchEvent(new MouseEvent('mousedown', { cancelable: true }));
      fixture.detectChanges();
      expect(combobox.isOpen()).toBe(false);
    });
  });

  describe('open on focus / typing (defect #1)', () => {
    it('opens the dropdown when the input gains focus', () => {
      const combobox = fixture.componentInstance.combobox();
      expect(combobox.isOpen()).toBe(false);
      nativeInput(fixture).dispatchEvent(new FocusEvent('focus'));
      fixture.detectChanges();
      expect(combobox.isOpen()).toBe(true);
      expect(combobox.focused()).toBe(true);
    });

    it('opens the dropdown when the user types', () => {
      const combobox = fixture.componentInstance.combobox();
      const input = nativeInput(fixture);
      input.value = 'Opt';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      fixture.detectChanges();
      expect(combobox.isOpen()).toBe(true);
      expect(combobox.searchQuery()).toBe('Opt');
    });

    it('marks the control touched and closes on blur', () => {
      const combobox = fixture.componentInstance.combobox();
      const touched = vi.fn();
      combobox.touch.subscribe(touched);
      combobox.isOpen.set(true);
      nativeInput(fixture).dispatchEvent(new FocusEvent('blur'));
      fixture.detectChanges();
      expect(combobox.isOpen()).toBe(false);
      expect(touched).toHaveBeenCalled();
    });
  });

  describe('focus return (defect #2)', () => {
    it('setInitialFocus focuses the inner input, not the trigger div', () => {
      const combobox = fixture.componentInstance.combobox();
      const input = fixture.debugElement.query(By.directive(MlvInput))
        .componentInstance as MlvInput;
      const focusSpy = vi.spyOn(input, 'focus');
      combobox.setInitialFocus();
      expect(focusSpy).toHaveBeenCalled();
    });

    it('refocuses the input after a single-select commit', () => {
      const combobox = fixture.componentInstance.combobox();
      const input = fixture.debugElement.query(By.directive(MlvInput))
        .componentInstance as MlvInput;
      const focusSpy = vi.spyOn(input, 'focus');
      combobox.isOpen.set(true);
      combobox.selectValues(['Option 1']);
      expect(combobox.isOpen()).toBe(false);
      expect(focusSpy).toHaveBeenCalled();
    });
  });

  describe('display value (defect #3)', () => {
    it('renders the selected label as the real input value, not the placeholder', () => {
      const combobox = fixture.componentInstance.combobox();
      setComboboxValue(fixture, combobox, 'Option 1');
      fixture.detectChanges();
      const input = nativeInput(fixture);
      expect(input.value).toBe('Option 1');
      // The placeholder stays the generic search hint, never the selected value.
      expect(input.getAttribute('placeholder')).toBe('Search...');
    });
  });

  describe('stale search text (defect #7)', () => {
    it('reverts unsubmitted search text to the committed label on close', () => {
      const combobox = fixture.componentInstance.combobox();
      setComboboxValue(fixture, combobox, 'Option 1');
      combobox.isOpen.set(true);
      combobox.onSearchInput({ target: { value: 'zzz' } } as unknown as Event);
      expect(combobox.searchQuery()).toBe('zzz');

      combobox.onEscape(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();
      expect(combobox.isOpen()).toBe(false);
      expect(combobox.searchQuery()).toBe('Option 1');
    });

    it('resets stale search text on writeValue', () => {
      const combobox = fixture.componentInstance.combobox();
      combobox.searchQuery.set('leftover');
      setComboboxValue(fixture, combobox, 'Option 2');
      expect(combobox.searchQuery()).toBe('Option 2');
    });
  });

  describe('activedescendant navigation (defect #6, #12)', () => {
    it('opens and activates the first option on the first ArrowDown', () => {
      const combobox = fixture.componentInstance.combobox();
      combobox.onArrowDown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      fixture.detectChanges();
      expect(combobox.isOpen()).toBe(true);
      expect(nativeInput(fixture).getAttribute('aria-activedescendant')).toBe(
        `${combobox.listboxId()}-option-0`,
      );
    });

    it('wraps the active option and keeps focus available for typing', () => {
      const combobox = fixture.componentInstance.combobox();
      const arrow = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      combobox.onArrowDown(arrow); // -> 0
      combobox.onArrowDown(arrow); // -> 1
      combobox.onArrowDown(arrow); // wraps -> 0
      fixture.detectChanges();
      expect(nativeInput(fixture).getAttribute('aria-activedescendant')).toBe(
        `${combobox.listboxId()}-option-0`,
      );

      // Typing mid-navigation still works (focus never left the input): the
      // active descendant resets and filtering applies.
      const input = nativeInput(fixture);
      input.value = 'Option 2';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      fixture.detectChanges();
      expect(combobox.searchQuery()).toBe('Option 2');
      expect(combobox.filteredOptions().map((o) => o.label)).toEqual([
        'Option 2',
      ]);
      expect(
        nativeInput(fixture).getAttribute('aria-activedescendant'),
      ).toBeNull();
    });

    it('Enter selects the active option', () => {
      const combobox = fixture.componentInstance.combobox();
      combobox.onArrowDown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      combobox.onEnterKey(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(combobox.value()).toBe('Option 1');
      expect(combobox.selectionService.selectedValues()).toEqual(['Option 1']);
    });
  });

  describe('escape close-then-clear (defect #12)', () => {
    it('first press closes, second press clears the selection', () => {
      const combobox = fixture.componentInstance.combobox();
      setComboboxValue(fixture, combobox, 'Option 1');
      combobox.isOpen.set(true);

      combobox.onEscape(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(combobox.isOpen()).toBe(false);
      expect(combobox.selectionService.selectedValues()).toEqual(['Option 1']);

      combobox.onEscape(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(combobox.selectionService.selectedValues()).toEqual([]);
      expect(combobox.value()).toBeNull();
    });
  });

  describe('forms <-> aria value bridge', () => {
    it('a scalar model value normalises into the aria selection array (single-select)', () => {
      const combobox = fixture.componentInstance.combobox();
      setComboboxValue(fixture, combobox, 'Option 1');
      expect(combobox.selectionService.selectedValues()).toEqual(['Option 1']);
    });

    it('a null model value clears the selection', () => {
      const combobox = fixture.componentInstance.combobox();
      setComboboxValue(fixture, combobox, 'Option 1');
      setComboboxValue(fixture, combobox, null);
      expect(combobox.selectionService.selectedValues()).toEqual([]);
    });

    it('panel selection collapses to the scalar value in single-select mode', () => {
      const combobox = fixture.componentInstance.combobox();
      combobox.selectValues(['Option 2']);
      expect(combobox.value()).toBe('Option 2');
    });

    it('clearing the selection emits null in single-select mode', () => {
      const combobox = fixture.componentInstance.combobox();
      setComboboxValue(fixture, combobox, 'Option 1');
      combobox.selectValues([]);
      expect(combobox.value()).toBeNull();
    });

    it('links the input aria-controls to the rendered listbox DOM id when open', async () => {
      const overlayContainer = TestBed.inject(OverlayContainer);
      const overlayEl = overlayContainer.getContainerElement();

      fixture.componentInstance.combobox().isOpen.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const input = nativeInput(fixture);
      const listbox = overlayEl.querySelector(
        '[role="listbox"]',
      ) as HTMLElement;
      expect(listbox).toBeTruthy();
      expect(input.getAttribute('aria-controls')).toBe(
        fixture.componentInstance.combobox().listboxId(),
      );
      expect(listbox.getAttribute('id')).toBe(
        input.getAttribute('aria-controls'),
      );

      overlayContainer.ngOnDestroy();
    });
  });

  describe('click-outside exclusion (field click keeps list open)', () => {
    it('exposes the trigger row as the popup click-outside exclusion so caret clicks do not dismiss', () => {
      const combobox = fixture.componentInstance.combobox();
      const trigger = fixture.nativeElement.querySelector(
        '.mlv-combobox__trigger',
      ) as HTMLElement;
      const excluded = (
        combobox as unknown as {
          _popupExcludeElements: () => HTMLElement[];
        }
      )._popupExcludeElements();

      // The trigger row is treated as "inside" the popup for dismissal.
      expect(excluded).toContain(trigger);
      // The input (where the caret is repositioned) lives within that element,
      // so a click on it is not an outside click.
      expect(trigger.contains(nativeInput(fixture))).toBe(true);
    });
  });

  describe('reconciliation guard (data-loss regression)', () => {
    it('keeps the committed value when typing filters the selected option out of view', () => {
      const combobox = fixture.componentInstance.combobox();
      setComboboxValue(fixture, combobox, 'Option 1');
      combobox.isOpen.set(true);
      const before = combobox.value();

      // User types text that filters the selected option out of the list.
      combobox.onSearchInput({ target: { value: 'zzz' } } as unknown as Event);
      expect(combobox.filteredOptions()).toEqual([]);

      // The aria listbox reconciles its value model down to the (empty) rendered
      // set and re-emits []. That is NOT a user action — it must be ignored.
      combobox.selectValues([]);

      expect(combobox.selectionService.selectedValues()).toEqual(['Option 1']);
      expect(combobox.value()).toBe(before);
      // The popup stays open so the user can keep searching.
      expect(combobox.isOpen()).toBe(true);
    });

    it('stays open on a spurious re-emit of the committed value while it is still visible', () => {
      const combobox = fixture.componentInstance.combobox();
      setComboboxValue(fixture, combobox, 'Option 1');
      combobox.isOpen.set(true);
      const before = combobox.value();

      // Typing keeps the selected option visible.
      combobox.onSearchInput({
        target: { value: 'Option' },
      } as unknown as Event);
      expect(combobox.filteredOptions().map((o) => o.label)).toEqual([
        'Option 1',
        'Option 2',
      ]);

      // A spurious re-emit of the same committed value must not run commit
      // side-effects (which would wrongly close a single-select popup).
      combobox.selectValues(['Option 1']);

      expect(combobox.isOpen()).toBe(true);
      expect(combobox.selectionService.selectedValues()).toEqual(['Option 1']);
      expect(combobox.value()).toBe(before);
    });

    it('still deselects when the user clicks a selected, still-visible option', () => {
      const combobox = fixture.componentInstance.combobox();
      setComboboxValue(fixture, combobox, 'Option 1');
      // Not searching: the selected option is visible in the rendered list.
      expect(
        combobox.filteredOptions().some((o) => o.value === 'Option 1'),
      ).toBe(true);

      // Genuine deselection of a visible option — removal must be honoured.
      combobox.selectValues([]);

      expect(combobox.selectionService.selectedValues()).toEqual([]);
      expect(combobox.value()).toBeNull();
    });

    it('replaces the committed value on a genuine re-search selection', () => {
      const combobox = fixture.componentInstance.combobox();
      setComboboxValue(fixture, combobox, 'Option 1');
      combobox.onSearchInput({
        target: { value: 'Option 2' },
      } as unknown as Event);
      // User clicks the newly-filtered option.
      combobox.selectValues(['Option 2']);
      expect(combobox.selectionService.selectedValues()).toEqual(['Option 2']);
    });
  });

  describe('clearable (defect #10)', () => {
    it('onClear clears the selection + query, emits null and refocuses', () => {
      const combobox = fixture.componentInstance.combobox();
      const input = fixture.debugElement.query(By.directive(MlvInput))
        .componentInstance as MlvInput;
      const focusSpy = vi.spyOn(input, 'focus');
      setComboboxValue(fixture, combobox, 'Option 1');

      combobox.onClear();
      expect(combobox.selectionService.selectedValues()).toEqual([]);
      expect(combobox.searchQuery()).toBe('');
      expect(combobox.value()).toBeNull();
      expect(focusSpy).toHaveBeenCalled();
    });
  });
});

describe('MlvCombobox (multi-select)', () => {
  let fixture: ComponentFixture<MultiHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MultiHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = setup(MultiHostComponent);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('accepts a multi-select array model value', () => {
    const combobox = fixture.componentInstance.combobox();
    setComboboxValue(fixture, combobox, ['Option 1', 'Option 2']);
    expect(combobox.selectionService.selectedValues()).toEqual([
      'Option 1',
      'Option 2',
    ]);
  });

  it('renders selected values as closable chips (defect #3)', () => {
    const combobox = fixture.componentInstance.combobox();
    setComboboxValue(fixture, combobox, ['Option 1', 'Option 2']);
    fixture.detectChanges();
    const chips = fixture.nativeElement.querySelectorAll('.mlv-combobox__chip');
    expect(chips.length).toBe(2);
    expect(chips[0].textContent).toContain('Option 1');
    expect(chips[1].textContent).toContain('Option 2');
  });

  it('removing a chip deselects that value and keeps the others', () => {
    const combobox = fixture.componentInstance.combobox();
    setComboboxValue(fixture, combobox, ['Option 1', 'Option 2']);
    combobox.removeSelected('Option 1');
    expect(combobox.selectionService.selectedValues()).toEqual(['Option 2']);
    expect(combobox.value()).toEqual(['Option 2']);
  });

  it('panel selection emits the raw array in multi-select mode', () => {
    const combobox = fixture.componentInstance.combobox();
    combobox.selectValues(['Option 1', 'Option 2']);
    expect(combobox.value()).toEqual(['Option 1', 'Option 2']);
  });

  it('stays open after selecting in multi-select mode', () => {
    const combobox = fixture.componentInstance.combobox();
    combobox.isOpen.set(true);
    combobox.selectValues(['Option 1']);
    expect(combobox.isOpen()).toBe(true);
  });

  describe('chip backspace (tokenizer parity)', () => {
    const backspace = (input: HTMLInputElement): void => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Backspace',
          bubbles: true,
          cancelable: true,
        }),
      );
      fixture.detectChanges();
    };
    const nativeInput = (): HTMLInputElement =>
      fixture.nativeElement.querySelector('input') as HTMLInputElement;
    const armedChips = (): NodeListOf<HTMLElement> =>
      fixture.nativeElement.querySelectorAll('.mlv-combobox__chip--armed');

    it('first Backspace in the empty input arms the last chip without deleting', () => {
      const combobox = fixture.componentInstance.combobox();
      setComboboxValue(fixture, combobox, ['Option 1', 'Option 2']);
      fixture.detectChanges();

      backspace(nativeInput());

      expect(combobox.selectionService.selectedValues()).toEqual([
        'Option 1',
        'Option 2',
      ]);
      expect(armedChips().length).toBe(1);
      expect(armedChips()[0].textContent).toContain('Option 2');
    });

    it('second Backspace removes the armed chip and arms the new last one', () => {
      const combobox = fixture.componentInstance.combobox();
      setComboboxValue(fixture, combobox, ['Option 1', 'Option 2']);
      fixture.detectChanges();

      backspace(nativeInput());
      backspace(nativeInput());

      expect(combobox.selectionService.selectedValues()).toEqual(['Option 1']);
      expect(combobox.value()).toEqual(['Option 1']);
      expect(armedChips().length).toBe(1);
      expect(armedChips()[0].textContent).toContain('Option 1');
    });

    it('removing the final chip leaves the input focused and disarmed', () => {
      const combobox = fixture.componentInstance.combobox();
      setComboboxValue(fixture, combobox, ['Option 1']);
      fixture.detectChanges();

      backspace(nativeInput());
      backspace(nativeInput());

      expect(combobox.selectionService.selectedValues()).toEqual([]);
      expect(armedChips().length).toBe(0);
    });

    it('does not intercept Backspace while the input holds text', () => {
      const combobox = fixture.componentInstance.combobox();
      setComboboxValue(fixture, combobox, ['Option 1']);
      fixture.detectChanges();
      const input = nativeInput();
      input.value = 'abc';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      fixture.detectChanges();

      backspace(input);

      expect(combobox.selectionService.selectedValues()).toEqual(['Option 1']);
      expect(armedChips().length).toBe(0);
    });

    it('typing disarms an armed chip', () => {
      const combobox = fixture.componentInstance.combobox();
      setComboboxValue(fixture, combobox, ['Option 1']);
      fixture.detectChanges();
      const input = nativeInput();

      backspace(input);
      expect(armedChips().length).toBe(1);

      input.value = 'x';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      fixture.detectChanges();
      expect(armedChips().length).toBe(0);
    });
  });

  describe('reconciliation guard (data-loss regression)', () => {
    it('keeps earlier picks when typing to add another value', () => {
      const combobox = fixture.componentInstance.combobox();
      setComboboxValue(fixture, combobox, ['Option 1']);
      combobox.isOpen.set(true);

      // Type to find another option — this filters the already-picked value out
      // of the rendered list.
      combobox.onSearchInput({
        target: { value: 'Option 2' },
      } as unknown as Event);
      expect(combobox.filteredOptions().map((o) => o.label)).toEqual([
        'Option 2',
      ]);

      // aria reconciles the filtered-out pick out of its model and re-emits []
      // — must be ignored so the earlier pick survives.
      combobox.selectValues([]);
      expect(combobox.selectionService.selectedValues()).toEqual(['Option 1']);

      // User clicks the newly-visible option to add it: the earlier (filtered-
      // out) pick is preserved alongside the new one.
      combobox.selectValues(['Option 2']);
      expect(combobox.selectionService.isSelected('Option 1')).toBe(true);
      expect(combobox.selectionService.isSelected('Option 2')).toBe(true);
      expect(combobox.selectionService.selectedValues().length).toBe(2);
    });

    it('honours a genuine deselection of a still-visible option, keeping filtered-out picks', () => {
      const combobox = fixture.componentInstance.combobox();
      setComboboxValue(fixture, combobox, ['Option 1', 'Option 2']);
      // Both options visible (no active search) — clicking Option 1 deselects it.
      combobox.selectValues(['Option 2']);
      expect(combobox.selectionService.selectedValues()).toEqual(['Option 2']);
    });
  });
});

describe('MlvCombobox (allowCreate)', () => {
  let fixture: ComponentFixture<AllowCreateHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AllowCreateHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = setup(AllowCreateHostComponent);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('Enter emits the created value (collapsed to scalar) and valueCreated', () => {
    const combobox = fixture.componentInstance.combobox();
    const created: string[] = [];
    combobox.valueCreated.subscribe((v: string) => created.push(v));

    combobox.searchQuery.set('Brand New');
    combobox.onEnterKey();

    expect(created).toEqual(['Brand New']);
    expect(combobox.value()).toBe('Brand New');
    expect(combobox.selectionService.selectedValues()).toEqual(['Brand New']);
  });

  it('does not create a duplicate or re-emit valueCreated for an already-created value', () => {
    const combobox = fixture.componentInstance.combobox();
    const created: string[] = [];
    combobox.valueCreated.subscribe((v: string) => created.push(v));

    combobox.searchQuery.set('New Tag');
    combobox.onEnterKey();
    // Re-entering the same value must not create a second time nor re-emit.
    combobox.searchQuery.set('New Tag');
    combobox.onEnterKey();

    expect(created).toEqual(['New Tag']);
    expect(combobox.selectionService.selectedValues()).toEqual(['New Tag']);
  });

  it('Enter on an exact match selects (never deselects) in single-select', () => {
    const combobox = fixture.componentInstance.combobox();
    setComboboxValue(fixture, combobox, 'Option 1');
    combobox.searchQuery.set('Option 1');
    combobox.onEnterKey();
    expect(combobox.selectionService.selectedValues()).toEqual(['Option 1']);
  });

  it('keeps a created value when re-searching (reconciliation guard)', () => {
    const combobox = fixture.componentInstance.combobox();
    combobox.searchQuery.set('Brand New');
    combobox.onEnterKey();
    expect(combobox.selectionService.selectedValues()).toEqual(['Brand New']);

    // The created value is never a rendered option, so re-searching makes aria
    // reconcile it out of the listbox and re-emit — must not wipe the selection.
    combobox.onSearchInput({ target: { value: 'Opt' } } as unknown as Event);
    expect(
      combobox.filteredOptions().some((o) => o.value === 'Brand New'),
    ).toBe(false);
    combobox.selectValues([]);
    expect(combobox.selectionService.selectedValues()).toEqual(['Brand New']);
  });
});

describe('MlvCombobox (compareWith)', () => {
  let fixture: ComponentFixture<CompareWithHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompareWithHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = setup(CompareWithHostComponent);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('matches a deserialized object value onto its option instance (defect #13)', () => {
    const host = fixture.componentInstance;
    const combobox = host.combobox();
    // A structurally-equal but non-identical value, as if deserialized.
    setComboboxValue(fixture, combobox, { id: 1, name: 'Alpha' });

    const selected = combobox.selectionService.selectedValues();
    expect(selected.length).toBe(1);
    // Normalised to the actual option instance (reference equality).
    expect(selected[0]).toBe(host.tags[0]);
    expect(combobox.selectionService.isSelected(host.tags[0])).toBe(true);
    // Display value agrees.
    expect(nativeInput(fixture).value).toBe('Alpha');
  });
});

describe('MlvCombobox (disabled / readonly gating, defect #4)', () => {
  let fixture: ComponentFixture<GatedHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GatedHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = setup(GatedHostComponent);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  for (const state of ['disabled', 'readonly'] as const) {
    it(`suppresses every open path when ${state}`, () => {
      fixture.componentInstance[state] = true;
      fixture.detectChanges();
      const combobox = fixture.componentInstance.combobox();

      combobox.onInputFocus();
      combobox.onSearchInput({ target: { value: 'x' } } as unknown as Event);
      combobox.onArrowDown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      combobox.onChevronMousedown(
        new MouseEvent('mousedown', { cancelable: true }),
      );
      fixture.detectChanges();

      expect(combobox.isOpen()).toBe(false);
    });
  }
});

/**
 * Option groups: a `toOption` that tags each option with a `group` label makes
 * the shared dropdown panel render sticky, non-selectable section headers. The
 * combobox is otherwise unchanged — headers are not options, so they are skipped
 * by keyboard navigation, excluded from the filtered result set (a header shows
 * only when a child matches the query), and never appear in the CVA value.
 */
describe('MlvCombobox — option groups', () => {
  interface Food {
    name: string;
    kind: string;
  }

  @Component({
    template: `<mlv-combobox [options]="foods" [toOption]="toOption" />`,
    imports: [MlvCombobox],
  })
  class GroupedHostComponent {
    readonly combobox = viewChild.required(MlvCombobox<Food>);
    readonly foods: Food[] = [
      { name: 'Apple', kind: 'Fruit' },
      { name: 'Banana', kind: 'Fruit' },
      { name: 'Carrot', kind: 'Vegetable' },
    ];
    readonly toOption = (f: Food) => ({
      label: f.name,
      value: f,
      group: f.kind,
    });
  }

  let fixture: ComponentFixture<GroupedHostComponent>;
  let overlayContainer: OverlayContainer;
  let overlayEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GroupedHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(GroupedHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    overlayContainer = TestBed.inject(OverlayContainer);
    overlayEl = overlayContainer.getContainerElement();
  });

  afterEach(() => overlayContainer.ngOnDestroy());

  async function open(): Promise<MlvCombobox<Food>> {
    const combobox = fixture.componentInstance.combobox();
    combobox.isOpen.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return combobox;
  }

  function type(query: string): void {
    const input = nativeInput(fixture);
    input.value = query;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }

  function headerLabels(): (string | undefined)[] {
    return Array.from(
      overlayEl.querySelectorAll('.mlv-dropdown-panel__group-header'),
    ).map((h) => h.textContent?.trim());
  }

  it('renders a sticky header per group, options excluded from the header count', async () => {
    await open();
    expect(overlayEl.querySelectorAll('[role="group"]').length).toBe(2);
    expect(headerLabels()).toEqual(['Fruit', 'Vegetable']);
    expect(overlayEl.querySelectorAll('[role="option"]').length).toBe(3);
  });

  it('uses only the popup scrollbar for the dropdown panel', async () => {
    await open();
    expect(overlayEl.querySelectorAll('mlv-scrollbar').length).toBe(1);
    expect(
      overlayEl.querySelector('.mlv-popup__scrollbar.mlv-scrollbar'),
    ).toBeTruthy();
    expect(
      overlayEl.querySelector('.mlv-dropdown-panel__scrollbar'),
    ).toBeNull();
  });

  it('hides a group header when the filter removes all its options', async () => {
    await open();
    type('Carrot');
    await fixture.whenStable();
    fixture.detectChanges();
    // Only the "Vegetable" group has a surviving option, so only its header shows.
    expect(headerLabels()).toEqual(['Vegetable']);
    expect(overlayEl.querySelectorAll('[role="option"]').length).toBe(1);
  });

  it('shows only the group whose child matches the filter', async () => {
    await open();
    type('App');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(headerLabels()).toEqual(['Fruit']);
    expect(
      fixture.componentInstance
        .combobox()
        .filteredOptions()
        .map((o) => o.label),
    ).toEqual(['Apple']);
  });

  it('navigation skips headers — activeIndex enumerates only real options', async () => {
    const combobox = await open();
    // Three real options, no header entries in the filtered set.
    expect(combobox.filteredOptions().length).toBe(3);
    combobox.onArrowDown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    fixture.detectChanges();
    // The active descendant resolves to a real option element (role="option").
    const activeId = nativeInput(fixture).getAttribute('aria-activedescendant');
    const active = overlayEl.querySelector(`#${activeId}`) as HTMLElement;
    expect(active).toBeTruthy();
    expect(active.getAttribute('role')).toBe('option');
  });

  it('never commits a group label — only real option values', async () => {
    const combobox = await open();
    combobox.selectValues([{ name: 'Carrot', kind: 'Vegetable' }]);
    expect(combobox.value()).toEqual({
      name: 'Carrot',
      kind: 'Vegetable',
    });
    expect(combobox.selectionService.selectedValues()).toEqual([
      { name: 'Carrot', kind: 'Vegetable' },
    ]);
  });
});

/**
 * `role="listbox"` is an ARIA input field (axe's `aria-input-field-name`
 * rule flags it unnamed) — the dropdown panel's `ariaLabel` must carry the
 * same resolved accessible name as the outer trigger input
 * (`_panelAriaLabel`: the visible `label`, else the explicit `ariaLabel`
 * input).
 */
describe('MlvCombobox — dropdown panel accessible name', () => {
  @Component({
    imports: [MlvCombobox],
    template: `
      <mlv-combobox
        id="fruit"
        [label]="label()"
        ariaLabel="Fruit search"
        [options]="['Apple', 'Banana']"
      />
    `,
  })
  class NamedHostComponent {
    readonly combobox = viewChild.required(MlvCombobox);
    readonly label = signal('Fruit');
  }

  let overlayContainer: OverlayContainer;
  let overlayEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NamedHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    overlayContainer = TestBed.inject(OverlayContainer);
    overlayEl = overlayContainer.getContainerElement();
  });

  afterEach(() => overlayContainer.ngOnDestroy());

  async function open(): Promise<ComponentFixture<NamedHostComponent>> {
    const fixture = TestBed.createComponent(NamedHostComponent);
    fixture.detectChanges();
    fixture.componentInstance.combobox().isOpen.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('names the rendered listbox from the visible label', async () => {
    await open();
    const listbox = overlayEl.querySelector('[role="listbox"]') as HTMLElement;
    expect(listbox).toBeTruthy();
    expect(listbox.getAttribute('aria-label')).toBe('Fruit');
  });

  it('falls back to ariaLabel on the listbox when no visible label is set', async () => {
    const fixture = await open();
    fixture.componentInstance.label.set('');
    fixture.detectChanges();
    const listbox = overlayEl.querySelector('[role="listbox"]') as HTMLElement;
    expect(listbox.getAttribute('aria-label')).toBe('Fruit search');
  });

  it('is axe-clean with the dropdown open', async () => {
    await open();
    const results = await axe.run(document.body, {
      rules: {
        'color-contrast': { enabled: false },
        // The isolated TestBed document intentionally has no application-level
        // main landmark; that responsibility belongs to the consuming shell.
        region: { enabled: false },
      },
    });
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Mobile fullscreen sheet (mobileMode) — in-sheet search input
// ---------------------------------------------------------------------------

/**
 * In full-screen mode the combobox projects an in-sheet search input into the
 * popup's `[mlvPopupHeaderContent]` slot (the outer trigger input is occluded
 * by the solid backdrop and blocked by the sheet's focus trap). The in-sheet
 * input reuses the same `searchQuery` + keyboard handlers and carries the
 * combobox ARIA while the outer input relinquishes it, so exactly one
 * `role="combobox"` is exposed. `mobileMode="fullscreen"` forces the sheet
 * regardless of viewport for deterministic testing.
 */
describe('MlvCombobox — mobile fullscreen sheet', () => {
  @Component({
    template: `<mlv-combobox
      id="fav"
      [label]="label()"
      [options]="['Apple', 'Banana', 'Cherry']"
      [multiple]="multiple()"
      [mobileMode]="mobileMode()"
      [mobileTitle]="mobileTitle()"
    />`,
    imports: [MlvCombobox],
  })
  class FullscreenHostComponent {
    readonly combobox = viewChild.required(MlvCombobox<string>);
    readonly label = signal('Favourite');
    readonly multiple = signal(false);
    readonly mobileMode = signal<MlvPopupMobileMode>('fullscreen');
    readonly mobileTitle = signal<string | undefined>(undefined);
  }

  let fixture: ComponentFixture<FullscreenHostComponent>;
  let overlayContainer: OverlayContainer;
  let overlayEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FullscreenHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(FullscreenHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    overlayContainer = TestBed.inject(OverlayContainer);
    overlayEl = overlayContainer.getContainerElement();
  });

  afterEach(() => overlayContainer.ngOnDestroy());

  async function open(): Promise<MlvCombobox<string>> {
    const combobox = fixture.componentInstance.combobox();
    combobox.isOpen.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return combobox;
  }

  function panel(): HTMLElement {
    return overlayEl.querySelector('.mlv-popup') as HTMLElement;
  }

  function sheetInput(): HTMLInputElement {
    return overlayEl.querySelector(
      '.mlv-combobox__sheet-input input',
    ) as HTMLInputElement;
  }

  function outerInput(): HTMLInputElement {
    return fixture.debugElement
      .query(By.css('.mlv-combobox__input'))
      .nativeElement.querySelector('input') as HTMLInputElement;
  }

  function typeInto(input: HTMLInputElement, query: string): void {
    input.value = query;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }

  function key(input: HTMLInputElement, k: string): void {
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
  }

  it('defaults mobileMode to "auto" and forwards it (plus the derived title) to the popup', () => {
    fixture.componentInstance.mobileMode.set('auto');
    fixture.detectChanges();
    const popup = fixture.debugElement.query(By.directive(MlvPopup))
      .componentInstance as MlvPopup;
    expect(popup.mobileMode()).toBe('auto');
    // Title falls back to the field label.
    expect(popup.mobileTitle()).toBe('Favourite');
  });

  it('does not open the sheet on focus alone (Tab focus / programmatic refocus)', () => {
    const combobox = fixture.componentInstance.combobox();
    outerInput().dispatchEvent(new FocusEvent('focus'));
    fixture.detectChanges();
    expect(combobox.isOpen()).toBe(false);
    expect(panel()).toBeNull();
  });

  it('opens the sheet on trigger click', () => {
    const combobox = fixture.componentInstance.combobox();
    outerInput().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(combobox.isOpen()).toBe(true);
  });

  it('does not reopen when close restores focus to the trigger (no focus loop)', async () => {
    const combobox = await open();
    combobox.isOpen.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    // The afterClosed handler refocuses the outer trigger input — that focus
    // event previously re-entered onInputFocus and reopened the sheet.
    outerInput().dispatchEvent(new FocusEvent('focus'));
    fixture.detectChanges();
    expect(combobox.isOpen()).toBe(false);
  });

  it('renders the fullscreen header with an in-sheet search input carrying the combobox role', async () => {
    await open();
    expect(panel().classList.contains('mlv-popup--fullscreen')).toBe(true);
    expect(panel().querySelector('.mlv-popup__header')).not.toBeNull();
    expect(panel().querySelector('.mlv-popup__title')?.textContent).toContain(
      'Favourite',
    );

    const inSheet = sheetInput();
    expect(inSheet).toBeTruthy();
    expect(inSheet.getAttribute('role')).toBe('combobox');
    expect(inSheet.getAttribute('aria-autocomplete')).toBe('list');
    // The outer trigger input relinquishes the combobox role while full-screen
    // so only one combobox is exposed.
    expect(outerInput().getAttribute('role')).toBeNull();
  });

  it('typing in the in-sheet input filters the options', async () => {
    const combobox = await open();
    typeInto(sheetInput(), 'Ban');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(combobox.searchQuery()).toBe('Ban');
    expect(combobox.filteredOptions().map((o) => o.label)).toEqual(['Banana']);
  });

  it('activedescendant navigation works from the in-sheet input', async () => {
    await open();
    const inSheet = sheetInput();
    key(inSheet, 'ArrowDown');
    const activeId = inSheet.getAttribute('aria-activedescendant');
    expect(activeId).toBeTruthy();
    const active = overlayEl.querySelector(`#${activeId}`) as HTMLElement;
    expect(active?.getAttribute('role')).toBe('option');
  });

  it('Enter selects the active option, closes, and restores focus to the outer input', async () => {
    const combobox = await open();
    const inSheet = sheetInput();
    key(inSheet, 'ArrowDown'); // activate "Apple"
    key(inSheet, 'Enter');
    fixture.detectChanges();

    expect(combobox.selectionService.selectedValues()).toEqual(['Apple']);
    expect(combobox.isOpen()).toBe(false);

    // Drive the leave animation so the overlay detaches and `afterClosed`
    // (→ focus restore) runs.
    panel()?.dispatchEvent(new Event('animationend'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(outerInput());
  });

  it('Escape reverts stale search text and closes the sheet', async () => {
    const combobox = await open();
    typeInto(sheetInput(), 'zzz');
    expect(combobox.searchQuery()).toBe('zzz');
    key(sheetInput(), 'Escape');
    expect(combobox.isOpen()).toBe(false);
    // Nothing was committed, so the reverted text is the empty committed label.
    expect(combobox.searchQuery()).toBe('');
  });

  it('renders selected chips inside the sheet in multi-select mode', async () => {
    fixture.componentInstance.multiple.set(true);
    fixture.detectChanges();
    const combobox = await open();
    combobox.selectValues(['Apple']);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const chips = panel().querySelectorAll(
      '.mlv-combobox__sheet-chips mlv-chip',
    );
    expect(chips.length).toBe(1);
    expect(chips[0].textContent).toContain('Apple');
  });
});

// ---------------------------------------------------------------------------
// Inline clear button (value-gated, rendered BEFORE the chevron)
// ---------------------------------------------------------------------------
@Component({
  template: `<mlv-combobox clearable [options]="['Option 1', 'Option 2']" />`,
  imports: [MlvCombobox],
})
class ClearableHostComponent {
  readonly combobox = viewChild.required(MlvCombobox<string>);
}

describe('MlvCombobox (inline clear button)', () => {
  let fixture: ComponentFixture<ClearableHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClearableHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(ClearableHostComponent);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  const clearEl = (): HTMLElement | null =>
    fixture.nativeElement.querySelector('.mlv-combobox__clear');

  it('renders the clear button only while a value is present', () => {
    const combobox = fixture.componentInstance.combobox();
    expect(clearEl()).toBeNull(); // clearable but empty — no X

    setComboboxValue(fixture, combobox, 'Option 1');
    fixture.detectChanges();
    expect(clearEl()).not.toBeNull();

    combobox.onClear();
    fixture.detectChanges();
    expect(clearEl()).toBeNull();
  });

  it('places the clear button BEFORE the chevron in the trigger row', () => {
    setComboboxValue(fixture, fixture.componentInstance.combobox(), 'Option 1');
    const clear = clearEl() as HTMLElement;
    const arrow = fixture.nativeElement.querySelector(
      '.mlv-combobox__arrow',
    ) as HTMLElement;
    expect(clear).not.toBeNull();
    expect(
      clear.compareDocumentPosition(arrow) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('suppresses the wrapper-rendered clear button (ownsClearButton)', () => {
    setComboboxValue(fixture, fixture.componentInstance.combobox(), 'Option 1');
    expect(
      fixture.nativeElement.querySelectorAll('mlv-button-close').length,
    ).toBe(1);
  });

  it('keeps the inline clear action as one native button and emits one cleared value', async () => {
    const combobox = fixture.componentInstance.combobox();
    setComboboxValue(fixture, combobox, 'Option 1');
    fixture.detectChanges();
    const valueChanges = vi.fn();
    combobox.value.subscribe(valueChanges);

    const closeHost = fixture.nativeElement.querySelector(
      'mlv-button-close',
    ) as HTMLElement;
    const clearButton = closeHost.querySelector('button') as HTMLButtonElement;
    expect(closeHost).not.toBeNull();
    expect(closeHost.getAttribute('role')).toBeNull();
    expect(closeHost.getAttribute('tabindex')).toBeNull();
    expect(closeHost.querySelectorAll('button')).toHaveLength(1);

    const results = await axe.run(fixture.nativeElement, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results.violations.map(({ id }) => id)).not.toContain(
      'nested-interactive',
    );

    clearButton.click();
    expect(valueChanges).toHaveBeenCalledTimes(1);
    expect(valueChanges).toHaveBeenLastCalledWith(null);
  });
});

describe('MlvCombobox — popup density forwarding', () => {
  @Component({
    template: `<mlv-combobox
      [options]="['Apple', 'Banana']"
      mlvDensity="compact"
      mobileMode="off"
    />`,
    imports: [MlvCombobox],
  })
  class DenseHostComponent {
    readonly combobox = viewChild.required(MlvCombobox<string>);
  }

  it('stamps the forwarded mlvDensity on the detached popup panel', async () => {
    await TestBed.configureTestingModule({
      imports: [DenseHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    const fixture = TestBed.createComponent(DenseHostComponent);
    fixture.detectChanges();
    const overlayContainer = TestBed.inject(OverlayContainer);

    fixture.componentInstance.combobox().isOpen.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const panel = overlayContainer
      .getContainerElement()
      .querySelector('.mlv-popup');
    expect(panel).not.toBeNull();
    expect(panel?.classList.contains('mlv--compact')).toBe(true);

    overlayContainer.ngOnDestroy();
  });
});

// ---------------------------------------------------------------------------
// Async option sources (MlvOptionsAdapter integration)
// ---------------------------------------------------------------------------

/**
 * `options` accepts an array, an `Observable`, or an `MlvDataSource`, and a
 * `searchFn` supersedes it with a remote search. Local sources are filtered by
 * the combobox; remote ones own their filtering and the combobox renders the
 * items as-is. A committed value whose label has not resolved yet renders the
 * loading variant (inert field + spinner in place of the chevron).
 */
/**
 * A paged `MlvDataSource` whose fetches resolve only when the spec calls
 * `flush()`. `perPage` is 2, so a 4-item backing array needs two pages — which
 * is what makes `hasMore` / `loadingMore` observable in jsdom (the panel's
 * scroll sentinel cannot fire there: every layout metric is `0`).
 *
 * `_loading` flips **synchronously** with the request, per the `MlvDataSource`
 * contract, so `loading()` is already true on the tick the page is asked for.
 */
class PagedTagSource extends MlvDataSource<Tag> {
  private readonly _slice = signal<Tag[]>([]);
  /** @private The pending page's resolution, run by `flush()`. */
  private _pending: (() => void) | null = null;

  readonly totalItems = signal(0);

  constructor(private readonly _all: Tag[]) {
    super();
    this._perPage.set(2);
    this.totalItems.set(_all.length);
    this._fetch();
  }

  connect(): Signal<Tag[]> {
    return this._slice.asReadonly();
  }

  override setPage(page: number): void {
    super.setPage(page);
    this._fetch();
  }

  /** Resolves the in-flight page request. */
  flush(): void {
    const pending = this._pending;
    this._pending = null;
    pending?.();
  }

  /** @private Starts a page request: loading now, slice on `flush()`. */
  private _fetch(): void {
    const page = this.page();
    const perPage = this.perPage();
    this._loading.set(true);
    this._pending = () => {
      this._slice.set(this._all.slice((page - 1) * perPage, page * perPage));
      this._loading.set(false);
    };
  }
}

describe('MlvCombobox — async sources', () => {
  @Component({
    template: `<mlv-combobox
      [options]="options()"
      [searchFn]="searchFn()"
      [searchDebounce]="0"
      [loading]="loading()"
      [multiple]="multiple()"
      [toOption]="toOption"
      [compareWith]="compareWith"
    />`,
    imports: [MlvCombobox],
  })
  class AsyncHost {
    readonly combobox = viewChild.required(MlvCombobox<Tag>);
    readonly options = signal<MlvOptionsInput<Tag>>([]);
    readonly searchFn = signal<MlvOptionsSearchFn<Tag> | null>(null);
    readonly loading = signal(false);
    readonly multiple = signal(false);
    readonly toOption = (t: Tag) => ({ label: t.name, value: t });
    readonly compareWith = (a: Tag, b: Tag) => a.id === b.id;
  }

  let fixture: ComponentFixture<AsyncHost>;
  let overlayEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AsyncHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = setup(AsyncHost);
    await fixture.whenStable();
    fixture.detectChanges();
    overlayEl = TestBed.inject(OverlayContainer).getContainerElement();
  });

  afterEach(() => TestBed.inject(OverlayContainer).ngOnDestroy());

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('renders the loading variant while a preset value has no label yet, then resolves it', async () => {
    const subject = new Subject<Tag[]>();
    fixture.componentInstance.options.set(subject.asObservable());
    const combobox = fixture.componentInstance.combobox();
    setComboboxValue(fixture, combobox, { id: 2, name: '' } as Tag);
    await settle();
    const host = fixture.nativeElement.querySelector(
      'mlv-combobox',
    ) as HTMLElement;
    expect(host.classList).toContain('mlv-combobox--loading');
    expect(
      fixture.nativeElement.querySelector('.mlv-combobox__loader'),
    ).toBeTruthy();
    expect(nativeInput(fixture).value).toBe('');
    expect(nativeInput(fixture).readOnly).toBe(true);
    // Clicking must not open while awaiting.
    combobox.onTriggerClick();
    expect(combobox.isOpen()).toBe(false);

    subject.next([
      { id: 1, name: 'Alpha' },
      { id: 2, name: 'Beta' },
    ]);
    await settle();
    expect(host.classList).not.toContain('mlv-combobox--loading');
    expect(nativeInput(fixture).value).toBe('Beta');
    expect(nativeInput(fixture).readOnly).toBe(false);
  });

  it('remote searchFn: no local filtering, spinner row inside the open dropdown, list stays open', async () => {
    const subject = new Subject<Tag[]>();
    const queries: string[] = [];
    fixture.componentInstance.searchFn.set((q) => {
      queries.push(q);
      return subject.asObservable();
    });
    await settle();
    const combobox = fixture.componentInstance.combobox();
    combobox.onInputFocus();
    await settle();
    expect(queries).toEqual(['']);
    expect(
      overlayEl.querySelector('.mlv-dropdown-panel__loading'),
    ).toBeTruthy();
    subject.next([
      { id: 1, name: 'Alpha' },
      { id: 2, name: 'Beta' },
    ]);
    await settle();
    expect(overlayEl.querySelectorAll('[role="option"]').length).toBe(2);

    const input = nativeInput(fixture);
    input.value = 'zzz';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    expect(queries).toEqual(['', 'zzz']);
    expect(combobox.isOpen()).toBe(true);
    // Remote mode never filters locally: both options remain until the server answers.
    expect(overlayEl.querySelectorAll('[role="option"]').length).toBe(2);
    expect(
      overlayEl.querySelector('.mlv-dropdown-panel--loading'),
    ).toBeTruthy();
    subject.next([]);
    await settle();
    expect(overlayEl.querySelectorAll('[role="option"]').length).toBe(0);
    expect(
      overlayEl.querySelector('.mlv-combobox__empty')?.textContent,
    ).toContain('No results found');
  });

  it('[loading] input renders the panel spinner row too', async () => {
    fixture.componentInstance.options.set([{ id: 1, name: 'Alpha' }]);
    fixture.componentInstance.loading.set(true);
    await settle();
    fixture.componentInstance.combobox().onInputFocus();
    await settle();
    expect(
      overlayEl.querySelector('.mlv-dropdown-panel__loading'),
    ).toBeTruthy();
    expect(overlayEl.querySelectorAll('[role="option"]').length).toBe(1);
  });

  it('forwards data-source paging to the panel', async () => {
    const ds = new MlvSelectDataSource<Tag>([{ id: 1, name: 'A' }]);
    fixture.componentInstance.options.set(ds);
    await settle();
    fixture.componentInstance.combobox().onInputFocus();
    await settle();
    expect(
      overlayEl.querySelector('.mlv-dropdown-panel__sentinel'),
    ).toBeTruthy();
    expect(overlayEl.querySelectorAll('[role="option"]').length).toBe(1);
  });

  /**
   * @private Installs a `searchFn` that hands back a fresh `Subject` per call,
   * so a spec can resolve each query independently (and assert the exact query
   * sequence the source was asked for).
   */
  function installSearchFn(): {
    queries: string[];
    subjects: Subject<Tag[]>[];
  } {
    const queries: string[] = [];
    const subjects: Subject<Tag[]>[] = [];
    fixture.componentInstance.searchFn.set((q) => {
      queries.push(q);
      const subject = new Subject<Tag[]>();
      subjects.push(subject);
      return subject.asObservable();
    });
    return { queries, subjects };
  }

  /** @private Types `value` into the trigger input the way a user would. */
  function type(value: string): void {
    const input = nativeInput(fixture);
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  it('keeps the typed query while a remote response lands, then commits normally', async () => {
    const { subjects } = installSearchFn();
    await settle();
    const combobox = fixture.componentInstance.combobox();
    // A committed value first: its label resolves from the eager load, so the
    // field is past the loading variant before the user starts typing.
    setComboboxValue(fixture, combobox, { id: 3, name: '' } as Tag);
    await settle();
    subjects[0].next([{ id: 3, name: 'Cara' }]);
    await settle();
    expect(nativeInput(fixture).value).toBe('Cara');

    combobox.onInputFocus();
    await settle();
    type('ali');
    await settle();
    subjects[1].next([
      { id: 7, name: 'Alice' },
      { id: 8, name: 'Alicia' },
    ]);
    await settle();

    // The response must not reset the input to the committed label — the user
    // is still typing. It also must not stop the search: the matched substring
    // is still highlighted, which only happens while `_searching` is true.
    expect(nativeInput(fixture).value).toBe('ali');
    expect(overlayEl.querySelectorAll('[role="option"]').length).toBe(2);
    expect(
      overlayEl.querySelector('.mlv-dropdown-panel__match')?.textContent,
    ).toBe('Ali');

    // Committing still closes and shows the new label.
    combobox.onArrowDown(new KeyboardEvent('keydown'));
    combobox.onEnterKey();
    await settle();
    expect(combobox.isOpen()).toBe(false);
    expect(nativeInput(fixture).value).toBe('Alice');
  });

  it('multi-select: a remote response landing does not clear the typed query', async () => {
    fixture.componentInstance.multiple.set(true);
    const { subjects } = installSearchFn();
    await settle();
    const combobox = fixture.componentInstance.combobox();
    combobox.onInputFocus();
    await settle();
    subjects[0].next([
      { id: 1, name: 'Alpha' },
      { id: 2, name: 'Beta' },
    ]);
    await settle();
    combobox.onArrowDown(new KeyboardEvent('keydown'));
    combobox.onEnterKey();
    await settle();

    // Type to add another; the response for that query must leave the text alone.
    type('be');
    await settle();
    subjects[1].next([{ id: 2, name: 'Beta' }]);
    await settle();
    expect(nativeInput(fixture).value).toBe('be');
    expect(overlayEl.querySelectorAll('[role="option"]').length).toBe(1);
    expect(
      fixture.nativeElement.querySelector('.mlv-combobox__chip')?.textContent,
    ).toContain('Alpha');
  });

  it('resets the remote search after a multi-select commit', async () => {
    fixture.componentInstance.multiple.set(true);
    const { queries, subjects } = installSearchFn();
    await settle();
    const combobox = fixture.componentInstance.combobox();
    combobox.onInputFocus();
    await settle();
    subjects[0].next([
      { id: 1, name: 'Alpha' },
      { id: 2, name: 'Beta' },
    ]);
    await settle();
    type('zz');
    await settle();
    subjects[1].next([{ id: 2, name: 'Beta' }]);
    await settle();
    expect(queries).toEqual(['', 'zz']);

    combobox.onArrowDown(new KeyboardEvent('keydown'));
    combobox.onEnterKey();
    await settle();
    // The query is cleared visually, so the source must be asked for the
    // unfiltered list again instead of leaving `zz`'s results under a blank input.
    expect(nativeInput(fixture).value).toBe('');
    expect(queries).toEqual(['', 'zz', '']);
  });

  it('resets the remote search on clear', async () => {
    const { queries, subjects } = installSearchFn();
    await settle();
    const combobox = fixture.componentInstance.combobox();
    combobox.onInputFocus();
    await settle();
    subjects[0].next([{ id: 1, name: 'Alpha' }]);
    await settle();
    type('zz');
    await settle();
    expect(queries).toEqual(['', 'zz']);

    combobox.onClear();
    await settle();
    expect(queries).toEqual(['', 'zz', '']);
  });

  it('drives data-source paging through the panel bindings', async () => {
    const ds = new PagedTagSource([
      { id: 1, name: 'One' },
      { id: 2, name: 'Two' },
      { id: 3, name: 'Three' },
      { id: 4, name: 'Four' },
    ]);
    fixture.componentInstance.options.set(ds);
    await settle();
    fixture.componentInstance.combobox().onInputFocus();
    await settle();
    // Page one is still in flight — the panel shows the top spinner row.
    expect(
      overlayEl.querySelector('.mlv-dropdown-panel__loading'),
    ).toBeTruthy();

    ds.flush();
    await settle();
    expect(overlayEl.querySelectorAll('[role="option"]').length).toBe(2);
    expect(
      overlayEl.querySelector('.mlv-dropdown-panel__sentinel'),
    ).toBeTruthy();
    expect(overlayEl.querySelector('.mlv-dropdown-panel__loading')).toBeNull();

    // Page two: `[loadingMore]` renders the bottom status row (not the top
    // spinner) and the already-rendered options stay put.
    ds.setPage(2);
    await settle();
    expect(
      overlayEl.querySelector('.mlv-dropdown-panel__loading-more'),
    ).toBeTruthy();
    expect(overlayEl.querySelector('.mlv-dropdown-panel__loading')).toBeNull();
    expect(overlayEl.querySelectorAll('[role="option"]').length).toBe(2);

    ds.flush();
    await settle();
    expect(overlayEl.querySelectorAll('[role="option"]').length).toBe(4);
    expect(
      overlayEl.querySelector('.mlv-dropdown-panel__loading-more'),
    ).toBeNull();
  });
});

describe('MlvCombobox stylesheet — chevron flip + rotation origin', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const scss = readFileSync(join(dir, 'combobox.scss'), 'utf8');

  // The chevron used to swap icon component (LucideChevronUp/Down, driven by
  // isOpen()) AND rotate 180deg on `--open` — the two cancelled out, so an
  // open combobox kept pointing down. Fixed to mirror mlv-select's single
  // mechanism: one static chevron-down icon, rotated by CSS alone.
  it('rotates the arrow 180deg while open, driven by the existing open-state class', () => {
    const openBlock = scss.match(
      /&--open\s*{\s*\.#\{\$block\}__arrow\s*{([^}]*)}/,
    );
    expect(openBlock).toBeTruthy();
    expect(openBlock?.[1]).toContain('transform: rotate(180deg);');
  });

  it('fills the arrow box with its svg so rotation pivots on the glyph center', () => {
    const arrowBlock = scss.match(/&__arrow\s*{([\s\S]*?)\n {4}}/);
    expect(arrowBlock).toBeTruthy();
    expect(arrowBlock?.[1]).toContain('transform-origin: center;');
    expect(arrowBlock?.[1]).toMatch(
      /svg\s*{\s*width:\s*100%;\s*height:\s*100%;/,
    );
  });
});
