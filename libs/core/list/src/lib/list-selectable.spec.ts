import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { Listbox, Option } from '@angular/aria/listbox';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvList } from './list/list';
import { MlvListItem } from './list-item/list-item';
import { MlvListItemSelectable, MlvListSelectable } from './list-selectable';

@Component({
  imports: [MlvList, MlvListItem, MlvListSelectable, MlvListItemSelectable],
  template: `
    <!-- aria-label because a listbox owes an accessible name and mlv-list
         cannot invent one: the shipped consumer, mlv-dropdown-panel, binds
         [attr.aria-label]="ariaLabel()" on this same element. -->
    <mlv-list
      selectable
      listRole="listbox"
      aria-label="Fruit"
      [listboxId]="listboxId()"
      [multiple]="multiple()"
      [selectionMode]="selectionMode()"
      [softDisabled]="softDisabled()"
      [value]="value()"
      (valueChange)="onChange($event)"
    >
      <mlv-list-item itemRole="option" [value]="'apple'" label="Apple"
        >Apple</mlv-list-item
      >
      <mlv-list-item itemRole="option" [value]="'banana'" label="Banana"
        >Banana</mlv-list-item
      >
      <mlv-list-item
        itemRole="option"
        [value]="'cherry'"
        label="Cherry"
        [disabled]="true"
        >Cherry</mlv-list-item
      >
    </mlv-list>
  `,
})
class HostComponent {
  readonly multiple = signal(false);
  readonly listboxId = signal('my-listbox');
  readonly selectionMode = signal<'follow' | 'explicit'>('explicit');
  readonly softDisabled = signal(false);
  readonly value = signal<string[]>([]);
  readonly changed: string[][] = [];
  onChange(next: readonly string[]): void {
    this.changed.push([...next]);
  }
}

describe('MlvListSelectable (aria listbox migration)', () => {
  let fixture: ComponentFixture<HostComponent>;

  function listbox(): Listbox<string> {
    return fixture.debugElement.query(By.css('mlv-list')).injector.get(Listbox);
  }

  function selectable(): MlvListSelectable<string> {
    return fixture.debugElement
      .query(By.css('mlv-list'))
      .injector.get(MlvListSelectable);
  }

  function optionEls(): HTMLElement[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll('mlv-list-item'),
    ) as HTMLElement[];
  }

  function options(): Option<string>[] {
    return fixture.debugElement
      .queryAll(By.directive(Option))
      .map((d) => d.injector.get(Option));
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('applies the aria Listbox host directive to the selectable list', () => {
    expect(listbox()).toBeInstanceOf(Listbox);
  });

  it('renders listbox/option roles so aria pointer selection can resolve options', () => {
    const list = fixture.nativeElement.querySelector('mlv-list');
    expect(list.getAttribute('role')).toBe('listbox');
    optionEls().forEach((el) => expect(el.getAttribute('role')).toBe('option'));
  });

  it('exposes selectionMode so consumers can pin "explicit" (no select-on-arrow)', () => {
    expect(listbox().selectionMode()).toBe('explicit');
    fixture.componentInstance.selectionMode.set('follow');
    fixture.detectChanges();
    expect(listbox().selectionMode()).toBe('follow');
  });

  it('exposes softDisabled so consumers can pin false (skip disabled in navigation)', () => {
    expect(listbox().softDisabled()).toBe(false);
    fixture.componentInstance.softDisabled.set(true);
    fixture.detectChanges();
    expect(listbox().softDisabled()).toBe(true);
  });

  it('maps the public "multiple" input onto aria "multi"', () => {
    expect(listbox().multi()).toBe(false);
    fixture.componentInstance.multiple.set(true);
    fixture.detectChanges();
    expect(listbox().multi()).toBe(true);
  });

  it('forwards the "value" input into the aria value model', () => {
    fixture.componentInstance.value.set(['banana']);
    fixture.detectChanges();
    expect(listbox().value()).toEqual(['banana']);
  });

  it('registers each item as an aria Option carrying its value', () => {
    const values = options().map((o) => o.value());
    expect(values).toEqual(['apple', 'banana', 'cherry']);
  });

  it('marks the disabled item as an aria-disabled option', () => {
    const cherry = options()[2];
    expect(cherry.disabled()).toBe(true);
  });

  it('feeds each option text content to the aria typeahead label', () => {
    const labels = options().map((o) => o.label());
    expect(labels).toEqual(['Apple', 'Banana', 'Cherry']);
  });

  it('emits valueChange with the selected values array on click', () => {
    optionEls()[1].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.changed.at(-1)).toEqual(['banana']);
    expect(listbox().value()).toEqual(['banana']);
  });

  it('focusFirst() activates the first option via aria gotoFirst()', () => {
    selectable().focusFirst();
    fixture.detectChanges();
    expect(options()[0].active()).toBe(true);
  });

  it('forwards listboxId into aria Listbox.id so the rendered DOM id matches (no aria-owned override)', () => {
    const list = fixture.nativeElement.querySelector('mlv-list') as HTMLElement;
    // The consumer-provided id wins over aria's auto-generated `ng-listbox-*`.
    expect(listbox().id()).toBe('my-listbox');
    expect(list.getAttribute('id')).toBe('my-listbox');

    fixture.componentInstance.listboxId.set('other-listbox');
    fixture.detectChanges();
    expect(list.getAttribute('id')).toBe('other-listbox');
  });
  it('is reachable from a template through exportAs "mlvListItemSelectable"', () => {
    // The `Mlv` prefix migration (docs/migrations/2026-07-mlv-prefix.md) renamed
    // every public name with no deprecated aliases. `exportAs` is public template
    // API, and this one was missed on both halves — the directive still declared
    // `uiListItemSelectable` and libs-list.md still documented it, so the two
    // agreed with each other and disagreed with every other symbol in the repo.
    // Nothing catches an `exportAs` typo except a template that uses it, and no
    // template did. Reference case: MlvResizeObserver, same defect, same PR.
    @Component({
      imports: [MlvList, MlvListItem, MlvListSelectable, MlvListItemSelectable],
      template: `
        <mlv-list selectable listRole="listbox">
          <mlv-list-item
            #ref="mlvListItemSelectable"
            itemRole="option"
            [value]="'apple'"
            label="Apple"
            >Apple</mlv-list-item
          >
        </mlv-list>
      `,
    })
    class ExportAsHost {}

    const exportFixture = TestBed.createComponent(ExportAsHost);
    exportFixture.detectChanges();

    const ref = exportFixture.debugElement.query(
      By.directive(MlvListItemSelectable),
    );
    expect(ref.injector.get(MlvListItemSelectable)).toBeInstanceOf(
      MlvListItemSelectable,
    );
  });
});

/**
 * Accessibility sweeps — `mlv-list[selectable]`.
 *
 * `selectable` puts `@angular/aria`'s `Listbox` on the same host that already
 * carries `mlv-list`'s `listRole`, so the container role here is `listbox` and
 * the rows are `option`s. Like every container role, `listbox` owns its rows,
 * and both `aria-required-children` (on the listbox) and `aria-required-parent`
 * (on each option) are decided from the container down — so the sweeps are
 * rooted at the fixture root, not at a row.
 *
 * The states swept are the ones that change what the rows expose: single
 * selection with one option selected, and multi-select with two, each alongside
 * a disabled option that reports `aria-disabled` rather than vanishing.
 */
describe('MlvListSelectable accessibility', () => {
  let a11yFixture: ComponentFixture<HostComponent>;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents();
    a11yFixture = TestBed.createComponent(HostComponent);
    root = a11yFixture.nativeElement as HTMLElement;
    a11yFixture.detectChanges();
    await a11yFixture.whenStable();
  });

  it('has no axe violations for a single-select listbox', async () => {
    a11yFixture.componentInstance.value.set(['banana']);
    a11yFixture.detectChanges();
    await a11yFixture.whenStable();

    // State: a listbox owning three options, one selected and one disabled,
    // with a single roving tab stop.
    const list = root.querySelector('mlv-list') as HTMLElement;
    expect(list.getAttribute('role')).toBe('listbox');
    expect(list.querySelectorAll('[role="option"]')).toHaveLength(3);
    expect(list.querySelectorAll('[aria-selected="true"]')).toHaveLength(1);
    expect(list.querySelectorAll('[aria-disabled="true"]')).toHaveLength(1);

    await expectNoAxeViolations(root);
  });

  it('has no axe violations for a multi-select listbox', async () => {
    a11yFixture.componentInstance.multiple.set(true);
    a11yFixture.componentInstance.value.set(['apple', 'banana']);
    a11yFixture.detectChanges();
    await a11yFixture.whenStable();

    // State: `aria-multiselectable` is now on the container and two options
    // report selection — a different node set to the single-select sweep.
    const list = root.querySelector('mlv-list') as HTMLElement;
    expect(list.getAttribute('aria-multiselectable')).toBe('true');
    expect(list.querySelectorAll('[aria-selected="true"]')).toHaveLength(2);

    await expectNoAxeViolations(root);
  });
});
