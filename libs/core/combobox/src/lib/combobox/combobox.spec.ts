import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import type { Signal, WritableSignal } from '@angular/core';
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
import type { MlvBreakpoint } from '@malva-ui/cdk/utils';
import { MlvBreakpointService, MlvRtlService } from '@malva-ui/cdk/utils';
import {
  defaultCompareWith,
  MlvSelectDataSource,
} from '@malva-ui/core/dropdown';
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

@Component({
  template: `<mlv-combobox
    [options]="tags"
    [toOption]="toOption"
    [multiple]="multiple"
  />`,
  imports: [MlvCombobox],
})
class DefaultCompareWithHostComponent {
  readonly combobox = viewChild.required(MlvCombobox<Tag>);
  readonly tags: Tag[] = [
    { id: 1, name: 'Alpha' },
    { id: 2, name: 'Beta' },
  ];
  multiple = false;
  readonly toOption = (t: Tag) => ({ label: t.name, value: t });
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

/**
 * A consumer that never sets `compareWith` must see exactly the reference
 * (`===`) semantics it always had. The input default is now the shared
 * module-level `defaultCompareWith` — so the reconciliation helpers can
 * recognise it and take their `Set` fast path — rather than a per-instance
 * inline arrow. Same behaviour, one reference.
 */
describe('MlvCombobox (default compareWith, unset by the consumer)', () => {
  let fixture: ComponentFixture<DefaultCompareWithHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DefaultCompareWithHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = setup(DefaultCompareWithHostComponent);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('resolves to the shared default comparator', () => {
    expect(fixture.componentInstance.combobox().compareWith()).toBe(
      defaultCompareWith,
    );
  });

  it('selects an option written by reference', () => {
    const host = fixture.componentInstance;
    const combobox = host.combobox();
    setComboboxValue(fixture, combobox, host.tags[1]);
    expect(combobox.selectionService.selectedValues()[0]).toBe(host.tags[1]);
    expect(combobox.selectionService.isSelected(host.tags[1])).toBe(true);
    expect(nativeInput(fixture).value).toBe('Beta');
  });

  it('does NOT collapse a structurally-equal value onto its option instance', () => {
    const host = fixture.componentInstance;
    const combobox = host.combobox();
    const written = { id: 1, name: 'Alpha' };
    setComboboxValue(fixture, combobox, written);
    // The `MlvCombobox (compareWith)` block above normalises this onto
    // `host.tags[0]`; under the default it must stay the written reference.
    expect(combobox.selectionService.selectedValues()[0]).toBe(written);
    expect(combobox.selectionService.isSelected(host.tags[0])).toBe(false);
  });

  it('ignores an aria reconciliation emit that only drops a filtered-out value', () => {
    const host = fixture.componentInstance;
    const combobox = host.combobox();
    setComboboxValue(fixture, combobox, host.tags[0]);
    // Type a query that filters Alpha out of the rendered list, then let aria
    // reconcile its model down to the (now empty) rendered set.
    combobox.onSearchInput({ target: { value: 'Beta' } } as unknown as Event);
    fixture.detectChanges();
    combobox.selectValues([]);
    fixture.detectChanges();
    expect(combobox.selectionService.selectedValues()[0]).toBe(host.tags[0]);
  });

  it('still honours a genuine deselect of a rendered option', () => {
    const host = fixture.componentInstance;
    const combobox = host.combobox();
    setComboboxValue(fixture, combobox, host.tags[0]);
    // No query — Alpha is still rendered, so dropping it is a real deselect.
    combobox.selectValues([]);
    fixture.detectChanges();
    expect(combobox.selectionService.selectedValues()).toEqual([]);
  });

  it('re-adds committed values aria dropped only because they were filtered out (multi)', () => {
    const host = fixture.componentInstance;
    host.multiple = true;
    fixture.detectChanges();
    const combobox = host.combobox();
    setComboboxValue(fixture, combobox, [host.tags[0]]);

    // Filter Alpha out of view, then genuinely pick Beta.
    combobox.onSearchInput({ target: { value: 'Beta' } } as unknown as Event);
    fixture.detectChanges();
    combobox.selectValues([host.tags[1]]);
    fixture.detectChanges();

    const selected = combobox.selectionService.selectedValues();
    expect(selected.length).toBe(2);
    expect(selected[0]).toBe(host.tags[1]);
    // Committed order preserved after the incoming values.
    expect(selected[1]).toBe(host.tags[0]);
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

/**
 * The value-vs-options cross-checks — `_allValuesMatched`, `_chipOptions` and
 * `_applyPendingValues` — used to be nested `selected × options` scans, re-run
 * on every option-list change. `resolvedOptions()` is the **accumulated**
 * lazily-paged list, so every page append re-ran the whole scan and the total
 * cost of a scroll session grew quadratically. All three now share one
 * `valueIndex` over the resolved option values.
 *
 * `defaultCompareWith` cannot be wrapped in a spy — `valueIndex` recognises it
 * *by reference*, so a wrapper would silently take the pairwise path and
 * measure nothing. The observable channel is instead a counting `value`
 * accessor on the options `toOption` produces: a scan that reaches through
 * `option.value` increments it, a scan over the values already extracted into
 * the index does not.
 *
 * (That the index itself takes its `Map` fast path for an identity comparator
 * — rather than a pairwise scan of the extracted values — is guarded at the
 * unit level, in `reconciliation.spec.ts`.)
 */
describe('MlvCombobox — value-vs-options cost', () => {
  const PAGE = 500;
  const pages = Array.from({ length: 4 }, (_, p) =>
    Array.from({ length: PAGE }, (_, i) => `p${p}-${i}`),
  );

  /** Reads of any resolved option's `value`, across every consumer. */
  let valueReads = 0;

  const countingToOption = (item: string) => {
    const option = { label: item } as { label: string; value: string };
    Object.defineProperty(option, 'value', {
      get: () => {
        valueReads++;
        return item;
      },
      enumerable: true,
      configurable: true,
    });
    return option;
  };

  @Component({
    imports: [MlvCombobox],
    template: `<mlv-combobox
      id="perf"
      multiple
      loading
      [options]="options()"
      [toOption]="toOption"
      [compareWith]="compareWith()"
      [(value)]="value"
    />`,
  })
  class HostComponent {
    readonly combobox = viewChild.required(MlvCombobox<string>);
    readonly options = signal<string[]>(pages[0]);
    readonly value = signal<string[] | null>(null);
    readonly compareWith =
      signal<(a: string, b: string) => boolean>(defaultCompareWith);
    readonly toOption = countingToOption;
  }

  beforeEach(async () => {
    valueReads = 0;
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
  });

  /**
   * Commits `selected` values and returns the fixture. The last committed value
   * is deliberately **absent** from the options, so `_allValuesMatched` cannot
   * short-circuit on an early miss and `_chipOptions` takes its filtering
   * branch (`_awaitingValueLabel` is true) rather than returning early. The
   * present values sit at the **end** of page 0, so a pairwise `some()` cannot
   * short-circuit near the front and under-report either.
   */
  function commit(
    selected: number,
    compare = defaultCompareWith as (a: string, b: string) => boolean,
  ): ComponentFixture<HostComponent> {
    const fixture = TestBed.createComponent(HostComponent);
    const host = fixture.componentInstance;
    host.compareWith.set(compare);
    host.value.set([...pages[0].slice(PAGE - (selected - 1)), 'not-an-option']);
    fixture.detectChanges();
    return fixture;
  }

  /** `.value` reads caused by appending one more page of options. */
  function readsForAppend(
    fixture: ComponentFixture<HostComponent>,
    upToPage: number,
  ): number {
    valueReads = 0;
    fixture.componentInstance.options.set(pages.slice(0, upToPage + 1).flat());
    fixture.detectChanges();
    return valueReads;
  }

  it('costs nothing at all when nothing is selected', () => {
    // The regression an eagerly-built index causes, and the reason `valueIndex`
    // walks nothing until its first query: `_applyPendingValues` asks for the
    // index on **every** option-list change, and with no committed value it
    // then queries it zero times. `_allValuesMatched` is never evaluated either
    // (`hasValue()` short-circuits both `_awaitingValueLabel` and the adapter's
    // `eager` gate), so a page append must cost exactly nothing.
    //
    // A purely differential assertion cannot see this: the cost is constant in
    // the selection size, so it cancels out of every difference.
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    valueReads = 0;
    fixture.componentInstance.options.set([...pages[0], ...pages[1]]);
    fixture.detectChanges();
    expect(valueReads).toBe(0);
  });

  it('costs at most one walk of the accumulated options per page append', () => {
    // The absolute companion to the differential test below. One walk builds
    // the index; every query after that is O(1). A nested scan would be ~50x
    // this at 50 committed values.
    const accumulated = 2 * PAGE;
    expect(readsForAppend(commit(1), 1)).toBeLessThanOrEqual(accumulated + 4);
    expect(readsForAppend(commit(50), 1)).toBeLessThanOrEqual(
      accumulated + 4 * 50,
    );
  });

  it('costs the same per page append whether 1 or 50 values are selected', () => {
    // Differential, so no magic constant is needed:
    //   fast path  reads(R) = c × options + O(R)   — options term independent of R
    //   nested     reads(R) = c × options + R × options
    // 49 more selected values would add 49 × 1000 reads to a nested scan.
    const one = readsForAppend(commit(1), 1);
    const fifty = readsForAppend(commit(50), 1);
    expect(fifty - one).toBeLessThan(PAGE);
  });

  it('stays linear in the accumulated option count as pages arrive', () => {
    // The motivating scenario: 50 committed values, four pages appended one at
    // a time. Each append may re-walk the accumulated list a constant number of
    // times; it may not walk it once per committed value.
    const fixture = commit(50);
    for (let page = 1; page < pages.length; page++) {
      const accumulated = PAGE * (page + 1);
      expect(readsForAppend(fixture, page)).toBeLessThan(3 * accumulated);
    }
  });

  it('keeps the pairwise scan for a custom comparator', () => {
    // A consumer-supplied comparator must not be routed through a keyed
    // container — its equivalence relation is unknown. Comparator calls
    // therefore still scale with the committed selection.
    const calls = (selected: number) => {
      let count = 0;
      const custom = (a: string, b: string) => {
        count++;
        return a === b;
      };
      readsForAppend(commit(selected, custom), 1);
      return count;
    };
    expect(calls(50) - calls(1)).toBeGreaterThan(PAGE);
  });
});

/**
 * End-to-end proof that the identity fast path is exactly the comparator it
 * stands in for. `Set`/`Map` membership is SameValueZero, which agrees with
 * neither identity comparator: `===` and SameValueZero differ on `(NaN, NaN)`,
 * `Object.is` and SameValueZero on `(+0, -0)`. `valueIndex` bails to the
 * pairwise path on those, and these assertions read the result of that bail
 * through the control's public surface.
 *
 * `[loading]` pins `_ready()` false, so the loading variant
 * (`.mlv-combobox--loading`) appears exactly when `_allValuesMatched` is false
 * — which also puts `_chipOptions` on its filtering branch, so the rendered
 * chips report the second cross-check.
 */
describe('MlvCombobox — identity comparator edge values', () => {
  @Component({
    imports: [MlvCombobox],
    template: `<mlv-combobox
      id="edge"
      multiple
      loading
      [options]="options()"
      [compareWith]="compareWith()"
      [(value)]="value"
    />`,
  })
  class HostComponent {
    readonly combobox = viewChild.required(MlvCombobox<number>);
    readonly options = signal<number[]>([]);
    readonly value = signal<number[] | null>(null);
    readonly compareWith =
      signal<(a: number, b: number) => boolean>(defaultCompareWith);
  }

  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
  });

  /** Whether `_allValuesMatched` came out false, read off the loading variant. */
  const awaitingLabel = () =>
    (
      fixture.nativeElement.querySelector('mlv-combobox') as HTMLElement
    ).classList.contains('mlv-combobox--loading');
  /** Chips rendered — `_chipOptions`, which while awaiting keeps only resolved values. */
  const chipCount = () =>
    fixture.nativeElement.querySelectorAll('.mlv-combobox__chip').length;
  const committed = () =>
    fixture.componentInstance.combobox().selectionService.selectedValues();

  function setup(
    options: number[],
    values: number[],
    compare?: (a: number, b: number) => boolean,
  ): void {
    if (compare) fixture.componentInstance.compareWith.set(compare);
    fixture.componentInstance.options.set(options);
    fixture.componentInstance.value.set(values);
    fixture.detectChanges();
  }

  it('a committed NaN never matches a NaN option under the `===` default', () => {
    // `NaN === NaN` is false. A `Map` keyed on NaN would say the value matched,
    // drop the loading variant, and render the chip.
    setup([Number.NaN, 1], [Number.NaN, 1]);
    expect(awaitingLabel()).toBe(true);
    // `_chipOptions` keeps only the value that resolved — 1, never the NaN.
    expect(chipCount()).toBe(1);
    expect(Object.is(committed()[0], Number.NaN)).toBe(true);
  });

  it('a committed NaN DOES match a NaN option under Object.is', () => {
    setup([Number.NaN, 1], [Number.NaN, 1], Object.is);
    expect(awaitingLabel()).toBe(false);
    expect(chipCount()).toBe(2);
  });

  it('a committed -0 matches a +0 option under `===` — and takes its instance', () => {
    // `+0 === -0`, so the option matches; `_applyPendingValues` then replaces
    // the written `-0` with the option's own `+0`, exactly as the pairwise
    // `options.find(...)?.value ?? v` always did. Not a no-op — the sign flips.
    setup([0], [-0]);
    expect(awaitingLabel()).toBe(false);
    expect(Object.is(committed()[0], 0)).toBe(true);
    expect(Object.is(committed()[0], -0)).toBe(false);
  });

  it('a committed -0 does NOT match a +0 option under Object.is (hazard on the querying side)', () => {
    // The option list is hazard-free, so the index is keyed — but a queried -0
    // must still be answered pairwise, or SameValueZero would conflate it.
    setup([0], [-0], Object.is);
    expect(awaitingLabel()).toBe(true);
    expect(chipCount()).toBe(0);
    expect(Object.is(committed()[0], -0)).toBe(true);
  });

  it('a committed +0 does NOT match a -0 option under Object.is (hazard on the keyed side)', () => {
    setup([-0], [0], Object.is);
    expect(awaitingLabel()).toBe(true);
    expect(Object.is(committed()[0], 0)).toBe(true);
  });

  it('an empty option list leaves every committed value unmatched and unchanged', () => {
    setup([], [7]);
    expect(awaitingLabel()).toBe(true);
    expect(chipCount()).toBe(0);
    expect(committed()).toEqual([7]);
  });

  it('an empty selection is matched vacuously, whatever the options', () => {
    fixture.componentInstance.options.set([1, 2, 3]);
    fixture.detectChanges();
    expect(awaitingLabel()).toBe(false);
    expect(chipCount()).toBe(0);
  });
});
/**
 * Argument-order coverage for the **option-side** index. `_allValuesMatched`,
 * `_chipOptions` and `_applyPendingValues` all call
 * `compare(option.value, committedValue)`, and `valueIndex` applies
 * `compare(indexedValue, queriedValue)` — so the option list must be the
 * indexed side. Every other comparator in this suite (`===`, `Object.is`,
 * `(a, b) => a.id === b.id`) is **symmetric** and cannot see a transposition;
 * these two can, from both directions.
 *
 * A consumer's `compareWith` is an arbitrary predicate and is under no
 * obligation to be symmetric, so this is a real behaviour contract, not a
 * stylistic one.
 */
describe('MlvCombobox — option-side comparator argument order', () => {
  /**
   * True only when the OPTION value is the first argument. Reflexive on option
   * values (so it survives `_applyPendingValues` rewriting the committed value
   * onto the option instance), but `optionFirst('opt:b', 'sel:b')` is `true`
   * while `optionFirst('sel:b', 'opt:b')` is `false` — the asymmetry a
   * transposition trips over.
   */
  const optionFirst = (a: string, b: string) =>
    a.startsWith('opt:') && a.slice(4) === b.slice(4);
  /** The transpose: true only in the order the sites must NOT use. */
  const selectionFirst = (a: string, b: string) => optionFirst(b, a);

  @Component({
    imports: [MlvCombobox],
    template: `<mlv-combobox
      id="order"
      multiple
      loading
      [options]="options"
      [compareWith]="compareWith()"
      [(value)]="value"
    />`,
  })
  class HostComponent {
    readonly combobox = viewChild.required(MlvCombobox<string>);
    readonly options = ['opt:a', 'opt:b'];
    readonly value = signal<string[] | null>(null);
    readonly compareWith =
      signal<(a: string, b: string) => boolean>(optionFirst);
  }

  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
  });

  const awaitingLabel = () =>
    (
      fixture.nativeElement.querySelector('mlv-combobox') as HTMLElement
    ).classList.contains('mlv-combobox--loading');
  const chipCount = () =>
    fixture.nativeElement.querySelectorAll('.mlv-combobox__chip').length;
  const committed = () =>
    fixture.componentInstance.combobox().selectionService.selectedValues();

  function setup(compare: (a: string, b: string) => boolean): void {
    fixture.componentInstance.compareWith.set(compare);
    fixture.detectChanges();
    fixture.componentInstance.value.set(['sel:b']);
    fixture.detectChanges();
  }

  it('matches when the option value is compare()`s FIRST argument', () => {
    setup(optionFirst);
    // `_applyPendingValues` — `find((o) => compare(o.value, written))` resolves
    // the written value onto the option instance.
    expect(committed()).toEqual(['opt:b']);
    // `_allValuesMatched` — the committed value has an option, so the loading
    // variant is off despite `[loading]`... which also puts `_chipOptions` on
    // its early-return branch.
    expect(awaitingLabel()).toBe(false);
    expect(chipCount()).toBe(1);
  });

  it('does not match when only the TRANSPOSED order would', () => {
    setup(selectionFirst);
    // Nothing may match: a transposed index would flip each of these
    // independently — the committed value would resolve onto `opt:b`,
    // `_allValuesMatched` would drop the loading variant, and `_chipOptions`
    // would render a chip.
    expect(committed()).toEqual(['sel:b']);
    expect(awaitingLabel()).toBe(true);
    expect(chipCount()).toBe(0);
  });
});

/**
 * #150 — the dropdown takes the trigger's measured width as a **floor**, never
 * as an exact width, so an option longer than the trigger grows the panel
 * instead of being clipped.
 *
 * jsdom runs no layout, so "the panel grew" is asserted where the constraint is
 * actually expressed — the CDK overlay pane's own inline sizing. An exact
 * `width` pins the pane to the trigger's box (the bug); a `min-width` with no
 * `width` leaves the pane a `fit-content` flex item inside the flexible
 * bounding box (the fix), free to grow to its content and clamped by that box
 * (which CDK sizes to the space up to the viewport edge) via CDK's own
 * `.cdk-overlay-pane { max-width: 100% }`.
 */
describe('MlvCombobox — dropdown panel width (#150)', () => {
  const VIEWPORT_WIDTH = 1024;
  const VIEWPORT_HEIGHT = 768;
  /** Trigger box: 200px wide, 40px from the viewport's inline-start edge. */
  const TRIGGER_RECT = {
    x: 40,
    y: 100,
    left: 40,
    top: 100,
    right: 240,
    bottom: 132,
    width: 200,
    height: 32,
  };
  /** A label far wider than the 200px trigger. */
  const LONG_OPTION = 'comfortable — the density every control starts at';

  @Component({
    template: `<mlv-combobox
      [options]="options"
      [multiple]="multiple()"
      [dropdownMinWidth]="dropdownMinWidth()"
      [dropdownMaxWidth]="dropdownMaxWidth()"
      [(value)]="value"
    />`,
    imports: [MlvCombobox],
  })
  class HostComponent {
    readonly combobox = viewChild.required(MlvCombobox<string>);
    readonly options = ['compact', LONG_OPTION, 'spacious'];
    readonly multiple = signal(false);
    readonly value = signal<string | string[] | null>(null);
    readonly dropdownMinWidth = signal<number | string | undefined>(undefined);
    readonly dropdownMaxWidth = signal<number | string | undefined>(undefined);
  }

  let fixture: ComponentFixture<HostComponent>;
  let overlayContainer: OverlayContainer;
  let rtlService: MlvRtlService;

  /** Replaces an element's zero-sized jsdom box with a real one. */
  function stubRect(element: Element, rect: Record<string, number>): void {
    const full = { toJSON: () => rect, ...rect };
    element.getBoundingClientRect = () => full as unknown as DOMRect;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    overlayContainer = TestBed.inject(OverlayContainer);
    rtlService = TestBed.inject(MlvRtlService);
    // jsdom reports `documentElement.clientWidth === 0`; CDK reads it as the viewport.
    Object.defineProperty(document.documentElement, 'clientWidth', {
      value: VIEWPORT_WIDTH,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, 'clientHeight', {
      value: VIEWPORT_HEIGHT,
      configurable: true,
    });
  });

  afterEach(() => {
    rtlService.setDirection('ltr');
    document.documentElement.removeAttribute('dir');
    Reflect.deleteProperty(document.documentElement, 'clientWidth');
    Reflect.deleteProperty(document.documentElement, 'clientHeight');
    overlayContainer.ngOnDestroy();
  });

  /** Measures the trigger through the real `mlvResizeObserver` path, then opens. */
  async function open(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const trigger = fixture.nativeElement.querySelector(
      '.mlv-combobox__trigger',
    ) as HTMLElement;
    // The overlay's origin is the popup container, not the trigger it wraps.
    stubRect(
      fixture.nativeElement.querySelector('mlv-popup-container') as Element,
      TRIGGER_RECT,
    );
    stubRect(trigger, TRIGGER_RECT);
    fixture.componentInstance
      .combobox()
      .updateTriggerWidth([
        { target: trigger } as unknown as ResizeObserverEntry,
      ]);
    fixture.componentInstance.combobox().isOpen.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const pane = () =>
    overlayContainer
      .getContainerElement()
      .querySelector('.cdk-overlay-pane') as HTMLElement;
  const boundingBox = () =>
    overlayContainer
      .getContainerElement()
      .querySelector(
        '.cdk-overlay-connected-position-bounding-box',
      ) as HTMLElement | null;

  it('floors the panel at the trigger width instead of pinning it', async () => {
    await open();

    expect(overlayContainer.getContainerElement().textContent).toContain(
      LONG_OPTION,
    );
    expect(pane().style.minWidth).toBe('200px');
    expect(pane().style.width).toBe('');
  });

  it('raises the floor to an explicit dropdownMinWidth', async () => {
    fixture.componentInstance.dropdownMinWidth.set('30rem');
    await open();

    // Both bounds survive as a CSS `max()`, so the author's units resolve in
    // the browser rather than being converted to px in TypeScript.
    expect(pane().style.minWidth).toBe('max(200px, 30rem)');
    expect(pane().style.width).toBe('');
  });

  it('never lets dropdownMinWidth shrink the panel below its trigger', async () => {
    // The input raises the floor; it does not replace it. A value under the
    // trigger width is the reading a consumer is most likely to get wrong, so
    // the trigger width stays in the `max()` and wins.
    fixture.componentInstance.dropdownMinWidth.set(80);
    await open();

    expect(pane().style.minWidth).toBe('max(200px, 80px)');
  });

  it('caps the panel at an explicit dropdownMaxWidth', async () => {
    fixture.componentInstance.dropdownMaxWidth.set('24rem');
    await open();

    // With flexible dimensions the cap lands on the bounding box, not the
    // pane: CDK clears `max-width` on the pane and applies the configured
    // value to the box the pane is laid out inside. That is the same
    // mechanism the viewport clamp uses, so the two compose.
    expect(boundingBox()?.style.maxWidth).toBe('24rem');
    // The floor is unaffected by the ceiling.
    expect(pane().style.minWidth).toBe('200px');
  });

  it('emits no max-width when none is set, leaving the viewport as the only cap', async () => {
    await open();

    expect(boundingBox()?.style.maxWidth).toBe('');
    expect(pane().style.maxWidth).toBe('');
  });

  it('keeps the floor with the panel check marks (multi-select)', async () => {
    fixture.componentInstance.multiple.set(true);
    fixture.componentInstance.value.set([LONG_OPTION]);
    await open();

    expect(
      overlayContainer
        .getContainerElement()
        .querySelectorAll('.mlv-dropdown-panel__item-check').length,
    ).toBe(1);
    expect(pane().style.minWidth).toBe('200px');
    expect(pane().style.width).toBe('');
  });

  it('grows toward inline-end and stays anchored at the start edge (LTR)', async () => {
    await open();

    const box = boundingBox();
    expect(box?.getAttribute('dir')).toBe('ltr');
    expect(box?.style.left).toBe(`${TRIGGER_RECT.left}px`);
    // Bounded by the viewport's inline-end edge — the clamp for a pane that
    // carries no `width` of its own.
    expect(box?.style.width).toBe(`${VIEWPORT_WIDTH - TRIGGER_RECT.left}px`);
    expect(box?.style.alignItems).toBe('flex-start');
    expect(pane().style.width).toBe('');
    expect(pane().style.maxWidth).toBe('');
  });

  it('grows toward inline-end (leftward) under a global RTL flip', async () => {
    rtlService.setDirection('rtl');
    await open();

    const box = boundingBox();
    expect(box?.getAttribute('dir')).toBe('rtl');
    // Anchored at the trigger's start edge — its RIGHT edge in RTL.
    expect(box?.style.right).toBe(`${VIEWPORT_WIDTH - TRIGGER_RECT.right}px`);
    expect(box?.style.width).toBe(`${TRIGGER_RECT.right}px`);
    expect(pane().style.minWidth).toBe('200px');
    expect(pane().style.width).toBe('');
  });

  it('follows a [dir="rtl"] scope while the document stays LTR', async () => {
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector('mlv-combobox') as HTMLElement
    ).setAttribute('dir', 'rtl');
    await open();

    expect(rtlService.direction()).toBe('ltr');
    expect(document.documentElement.getAttribute('dir')).not.toBe('rtl');
    expect(boundingBox()?.getAttribute('dir')).toBe('rtl');
    expect(boundingBox()?.style.right).toBe(
      `${VIEWPORT_WIDTH - TRIGGER_RECT.right}px`,
    );
    expect(pane().style.minWidth).toBe('200px');
    expect(pane().style.width).toBe('');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Breakpoint flip while the sheet is open (#126 / #144)
// ────────────────────────────────────────────────────────────────────────────

/**
 * `mlv-combobox` is the heaviest `isFullscreen()` consumer: the flag decides
 * which of its two inputs owns `role="combobox"` and its ARIA, gates the blur
 * handler, and drives the focus handoff. It also opens anchored with
 * `[hasBackdrop]="false"`, so a mid-open conversion would need a scrim CDK
 * cannot attach — which is why the popup latches the mode per open.
 *
 * Before the latch, a viewport flip mid-open moved `role="combobox"` from the
 * focused in-sheet input back to the backdrop-occluded outer trigger input,
 * leaving the focused element with no combobox semantics at all.
 */
class FakeBreakpointService {
  readonly down: WritableSignal<boolean> = signal(false);
  isDown(_bp: MlvBreakpoint): WritableSignal<boolean> {
    return this.down;
  }
  isUp(_bp: MlvBreakpoint): WritableSignal<boolean> {
    return signal(false);
  }
}

describe('MlvCombobox — breakpoint flip while the sheet is open', () => {
  @Component({
    template: `<mlv-combobox
      id="fav"
      label="Favourite"
      [options]="['Apple', 'Banana', 'Cherry']"
      mobileMode="auto"
    />`,
    imports: [MlvCombobox],
  })
  class AutoModeHostComponent {
    readonly combobox = viewChild.required(MlvCombobox<string>);
  }

  let fixture: ComponentFixture<AutoModeHostComponent>;
  let overlayContainer: OverlayContainer;
  let breakpoint: FakeBreakpointService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AutoModeHostComponent],
      providers: [
        provideMlvI18nTesting(),
        { provide: MlvBreakpointService, useClass: FakeBreakpointService },
      ],
    }).compileComponents();

    breakpoint = TestBed.inject(
      MlvBreakpointService,
    ) as unknown as FakeBreakpointService;
    fixture = TestBed.createComponent(AutoModeHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    overlayContainer = TestBed.inject(OverlayContainer);
  });

  afterEach(() => overlayContainer.ngOnDestroy());

  const overlayEl = (): HTMLElement => overlayContainer.getContainerElement();

  const sheetInput = (): HTMLInputElement | null =>
    overlayEl().querySelector('.mlv-combobox__sheet-input input');

  const outerInput = (): HTMLInputElement =>
    fixture.debugElement
      .query(By.css('.mlv-combobox__input'))
      .nativeElement.querySelector('input') as HTMLInputElement;

  /** Every element in the component + overlay currently claiming the role. */
  const comboboxRoleOwners = (): string[] =>
    [
      ...fixture.nativeElement.querySelectorAll('[role="combobox"]'),
      ...overlayEl().querySelectorAll('[role="combobox"]'),
    ].map((el: Element) => (el as HTMLElement).id || '(no id)');

  async function open(): Promise<void> {
    fixture.componentInstance.combobox().isOpen.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function crossBreakpoint(down: boolean): Promise<void> {
    breakpoint.down.set(down);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('keeps the in-sheet input owning role="combobox" when the viewport widens', async () => {
    breakpoint.down.set(true);
    await open();

    const sheet = sheetInput();
    expect(sheet).not.toBeNull();
    // Exactly one combobox, and it is the in-sheet one the user is typing in.
    expect(comboboxRoleOwners()).toEqual([sheet?.id ?? '(missing)']);

    await crossBreakpoint(false);

    // The pane is still a viewport-filling sheet with the outer input behind a
    // solid scrim. Handing the role back to it would leave the focused in-sheet
    // input with no combobox semantics and the occluded one claiming them.
    expect(sheetInput()).not.toBeNull();
    expect(comboboxRoleOwners()).toEqual([sheet?.id ?? '(missing)']);
  });

  it('keeps the outer input owning role="combobox" when the viewport narrows', async () => {
    breakpoint.down.set(false);
    await open();

    expect(sheetInput()).toBeNull();
    expect(comboboxRoleOwners()).toEqual([outerInput().id]);

    await crossBreakpoint(true);

    // The overlay stays an anchored, scrimless dropdown, so no in-sheet input
    // is rendered — the outer input must not relinquish the role to nothing.
    expect(sheetInput()).toBeNull();
    expect(comboboxRoleOwners()).toEqual([outerInput().id]);
  });
});

/**
 * #154 — the panel #150 freed to grow still had nowhere to grow into: both
 * dropdown positions were `start`-aligned, so a trigger near the viewport's
 * inline-end edge got a bounding box only as wide as the sliver of room after
 * it. `end`-aligned fallbacks let the panel anchor its inline-end edge to the
 * trigger and grow back toward inline-start instead. See the equivalent block
 * in `select.spec.ts` for the full grid; the position list is shared.
 */
describe('MlvCombobox — dropdown inline-axis fallback (#154)', () => {
  const VIEWPORT_WIDTH = 1024;
  const VIEWPORT_HEIGHT = 768;
  /** The panel's own box: wider than the room left beside an edge trigger. */
  const PANEL_WIDTH = 300;
  const PANEL_HEIGHT = 200;

  const rect = (left: number, width: number) => ({
    x: left,
    y: 100,
    left,
    top: 100,
    right: left + width,
    bottom: 132,
    width,
    height: 32,
  });

  /** 60px trigger with only 20px of room after its physical right edge. */
  const RIGHT_EDGE_RECT = rect(944, 60);
  /** The mirror image: 60px trigger 20px from the physical left edge. */
  const LEFT_EDGE_RECT = rect(20, 60);
  /** Room on both sides — the case the preferred `start` pair must keep. */
  const ROOMY_RECT = rect(40, 200);

  @Component({
    template: `<mlv-combobox [options]="options" />`,
    imports: [MlvCombobox],
  })
  class HostComponent {
    readonly combobox = viewChild.required(MlvCombobox<string>);
    readonly options = ['a', 'b'];
  }

  let fixture: ComponentFixture<HostComponent>;
  let overlayContainer: OverlayContainer;
  let rtlService: MlvRtlService;

  const nativeGetBoundingClientRect = Element.prototype.getBoundingClientRect;

  /** Replaces an element's zero-sized jsdom box with a real one. */
  function stubRect(element: Element, box: Record<string, number>): void {
    const full = { toJSON: () => box, ...box };
    element.getBoundingClientRect = () => full as unknown as DOMRect;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    overlayContainer = TestBed.inject(OverlayContainer);
    rtlService = TestBed.inject(MlvRtlService);
    Object.defineProperty(document.documentElement, 'clientWidth', {
      value: VIEWPORT_WIDTH,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, 'clientHeight', {
      value: VIEWPORT_HEIGHT,
      configurable: true,
    });

    // The pane does not exist until CDK attaches it and CDK measures it inside
    // that same attach, so it is stubbed on the prototype rather than on the
    // instance. With a 0x0 pane `isCompletelyWithinViewport` compares
    // `0 === 0` and every candidate fits outright, so a spec that does not stub
    // the pane pins `positions[0]` and can never reach a fallback.
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (this.classList?.contains('cdk-overlay-pane')) {
        const box = {
          x: 0,
          y: 0,
          left: 0,
          top: 0,
          right: PANEL_WIDTH,
          bottom: PANEL_HEIGHT,
          width: PANEL_WIDTH,
          height: PANEL_HEIGHT,
        };
        return { toJSON: () => box, ...box } as unknown as DOMRect;
      }
      return nativeGetBoundingClientRect.call(this);
    };
  });

  afterEach(() => {
    Element.prototype.getBoundingClientRect = nativeGetBoundingClientRect;
    rtlService.setDirection('ltr');
    document.documentElement.removeAttribute('dir');
    Reflect.deleteProperty(document.documentElement, 'clientWidth');
    Reflect.deleteProperty(document.documentElement, 'clientHeight');
    overlayContainer.ngOnDestroy();
  });

  /** Places the trigger at `box` and opens the dropdown. */
  async function openAt(box: Record<string, number>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const trigger = fixture.nativeElement.querySelector(
      '.mlv-combobox__trigger',
    ) as HTMLElement;
    // The overlay's origin is the popup container, not the trigger it wraps.
    stubRect(
      fixture.nativeElement.querySelector('mlv-popup-container') as Element,
      box,
    );
    stubRect(trigger, box);
    fixture.componentInstance
      .combobox()
      .updateTriggerWidth([
        { target: trigger } as unknown as ResizeObserverEntry,
      ]);
    fixture.componentInstance.combobox().isOpen.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /**
   * The anchored inset, the width and `align-items` together identify the
   * applied pair. The opposite inset is not asserted: CDK writes `auto` there
   * and jsdom's `cssstyle` rejects `auto` on `left`/`right`, silently keeping
   * the `0px` left by CDK's own reset.
   */
  const boundingBox = () =>
    overlayContainer
      .getContainerElement()
      .querySelector(
        '.cdk-overlay-connected-position-bounding-box',
      ) as HTMLElement | null;

  it('anchors the panel to the trigger inline-end edge when inline-end room runs out (LTR)', async () => {
    await openAt(RIGHT_EDGE_RECT);

    const box = boundingBox();
    expect(box?.style.right).toBe(
      `${VIEWPORT_WIDTH - RIGHT_EDGE_RECT.right}px`,
    );
    expect(box?.style.width).toBe(`${RIGHT_EDGE_RECT.right}px`);
    expect(box?.style.alignItems).toBe('flex-end');
  });

  it('keeps the preferred start-aligned position when there is inline-end room', async () => {
    await openAt(ROOMY_RECT);

    const box = boundingBox();
    expect(box?.style.left).toBe(`${ROOMY_RECT.left}px`);
    expect(box?.style.width).toBe(`${VIEWPORT_WIDTH - ROOMY_RECT.left}px`);
    expect(box?.style.alignItems).toBe('flex-start');
  });

  it('mirrors the fallback under a [dir="rtl"] scope while the document stays LTR', async () => {
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector('mlv-combobox') as HTMLElement
    ).setAttribute('dir', 'rtl');
    // Inline-end is the physical LEFT edge in RTL, so it is a trigger hugging
    // the left of the viewport that has nowhere to grow.
    await openAt(LEFT_EDGE_RECT);

    expect(rtlService.direction()).toBe('ltr');
    const box = boundingBox();
    expect(box?.getAttribute('dir')).toBe('rtl');
    expect(box?.style.left).toBe(`${LEFT_EDGE_RECT.left}px`);
    expect(box?.style.width).toBe(`${VIEWPORT_WIDTH - LEFT_EDGE_RECT.left}px`);
    expect(box?.style.alignItems).toBe('flex-end');
  });
});
