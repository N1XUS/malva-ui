import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { MlvSelectionService } from '@malva-ui/core/form-utils';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import type { MlvSelectOption } from '../select-option';
import { MlvDropdownPanel } from './dropdown-panel';

/**
 * #370: `[mlvAutocomplete]` needs a "No results found" row. The panel's
 * default slot renders inside `role="listbox"`, where a text row with no
 * option fails axe `aria-required-children`; the `[mlvDropdownPanelEmpty]`
 * slot renders the row after the listbox instead, under the same
 * "no options and not loading" condition.
 */
@Component({
  imports: [MlvDropdownPanel],
  template: `
    <mlv-dropdown-panel
      listboxId="lb"
      ariaLabel="Fruit"
      [options]="options()"
      [loading]="loading()"
    >
      <div mlvDropdownPanelEmpty class="probe-empty">No results found</div>
    </mlv-dropdown-panel>
  `,
})
class EmptySlotHost {
  readonly options = signal<MlvSelectOption<string>[]>([]);
  readonly loading = signal(false);
}

describe('MlvDropdownPanel — [mlvDropdownPanelEmpty] slot (#370)', () => {
  let fixture: ComponentFixture<EmptySlotHost>;
  let host: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmptySlotHost],
      providers: [MlvSelectionService],
    }).compileComponents();
    fixture = TestBed.createComponent(EmptySlotHost);
    host = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const row = (): HTMLElement | null => host.querySelector('.probe-empty');

  it('renders the row after the listbox, not inside it', () => {
    const listbox = host.querySelector('[role="listbox"]');
    expect(listbox).not.toBeNull();
    expect(row()?.textContent?.trim()).toBe('No results found');
    expect(row()?.closest('[role="listbox"]') ?? null).toBeNull();
  });

  it('is axe-clean with the empty row', async () => {
    await expectNoAxeViolations(host);
  });

  it('withholds the row while loading', async () => {
    fixture.componentInstance.loading.set(true);
    await settle();
    expect(row()).toBeNull();

    fixture.componentInstance.loading.set(false);
    await settle();
    expect(row()).not.toBeNull();
  });

  it('withholds the row while there are options', async () => {
    fixture.componentInstance.options.set([{ label: 'Apple', value: 'apple' }]);
    await settle();
    expect(row()).toBeNull();
    expect(host.querySelectorAll('[role="option"]').length).toBe(1);

    fixture.componentInstance.options.set([]);
    await settle();
    expect(row()).not.toBeNull();
  });
});
