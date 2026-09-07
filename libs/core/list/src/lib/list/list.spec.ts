import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvList } from './list';
import { MlvListItem } from '../list-item/list-item';
import { MlvListItemGroup } from '../list-item-group/list-item-group';
import { MlvListItemLink } from '../list-item-link/list-item-link';
import { MlvListItemActions } from '../list-item-actions';
import { MlvListItemByline } from '../list-item-byline';
import { MlvListItemMedia } from '../list-item-media';
import { MlvListItemTitle } from '../list-item-title';

describe('MlvList', () => {
  let component: MlvList;
  let fixture: ComponentFixture<MlvList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvList],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('emits no appearance modifier for the default appearance', () => {
    fixture.detectChanges();
    expect(
      fixture.nativeElement.classList.contains('mlv-list--appearance-menu'),
    ).toBe(false);
  });

  it('adds mlv-list--appearance-menu when appearance="menu"', () => {
    fixture.componentRef.setInput('appearance', 'menu');
    fixture.detectChanges();
    expect(
      fixture.nativeElement.classList.contains('mlv-list--appearance-menu'),
    ).toBe(true);
  });
});

@Component({
  imports: [
    MlvList,
    MlvListItem,
    MlvListItemMedia,
    MlvListItemTitle,
    MlvListItemByline,
    MlvListItemActions,
  ],
  template: `
    <mlv-list>
      <mlv-list-item>Plain row</mlv-list-item>
      <mlv-list-item unread accent="warning">
        <svg mlvListItemMedia aria-hidden="true" viewBox="0 0 20 20"></svg>
        <span mlvListItemTitle>Push notifications</span>
        <span mlvListItemByline>Get notified straight away.</span>
        <div mlvListItemActions>
          <button type="button">Configure</button>
        </div>
      </mlv-list-item>
    </mlv-list>
  `,
})
class ListRowsHost {}

@Component({
  imports: [MlvList, MlvListItem, MlvListItemGroup],
  template: `
    <mlv-list variant="inset">
      <!-- [open]="true", not a bare open attribute: the model is
           model<BooleanInput>(false) with no coerceBooleanProperty transform,
           so the attribute form binds the empty string and reads falsy. -->
      <mlv-list-item-group label="Alerts" [open]="true">
        <mlv-list-item>Push notifications</mlv-list-item>
      </mlv-list-item-group>
      <mlv-list-item-group label="Privacy">
        <mlv-list-item>Read receipts</mlv-list-item>
      </mlv-list-item-group>
    </mlv-list>
  `,
})
class ListGroupsHost {}

@Component({
  imports: [MlvList, MlvListItem, MlvListItemLink],
  template: `
    <mlv-list listRole="menu" appearance="menu" aria-label="Trail">
      <mlv-list-item itemRole="none">
        <a mlvListItemLink role="menuitem" href="#home">Home</a>
      </mlv-list-item>
      <mlv-list-item itemRole="menuitem">Settings</mlv-list-item>
    </mlv-list>
  `,
})
class ListMenuHost {}

/**
 * Accessibility sweeps — `mlv-list` and the row components it owns.
 *
 * `mlv-list` writes a **container role** (`listRole`, `'list'` by default), and
 * a container role owns every roled or focusable descendant it reaches through
 * roleless wrappers. That makes the container, not a row, the element the
 * interesting rules are evaluated on — `aria-required-children` on the list,
 * `aria-required-parent` on each item — so every sweep here is rooted above the
 * `<mlv-list>` element rather than at an item.
 *
 * The states swept are the renderings that differ in structure: plain rows, the
 * rich layout (media / title / byline / actions, which puts a real control
 * inside a `listitem`), `mlv-list-item-group` (which interposes its own
 * `<button>` + content `<div>` between the list and its rows — the shape most
 * likely to break an owned-children contract), and the `role="menu"` variant
 * with both an `itemRole="none"` row wrapping an `<a role="menuitem">` and a
 * row that claims `menuitem` itself. Selectable listbox rendering is swept in
 * `list-selectable.spec.ts`, where the listbox host directive lives.
 */
describe('MlvList accessibility', () => {
  it('has no axe violations for plain and rich rows in a role="list"', async () => {
    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ListRowsHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(ListRowsHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    // State: the container claims `list`, both rows claim `listitem`, and the
    // rich row holds an interactive control inside one of them.
    const list = root.querySelector('mlv-list') as HTMLElement;
    expect(list.getAttribute('role')).toBe('list');
    expect(list.querySelectorAll('[role="listitem"]')).toHaveLength(2);
    expect(
      list.querySelector('.mlv-list-item--rich [mlvListItemActions] button'),
    ).not.toBeNull();

    await expectNoAxeViolations(root);
  });

  it('has no axe violations for collapsible groups inside a role="list"', async () => {
    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ListGroupsHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(ListGroupsHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    // State: two group togglers — one expanded, one collapsed — sitting as
    // direct children of the `role="list"` container, each `aria-controls`
    // resolving to the content region it owns.
    const list = root.querySelector('mlv-list') as HTMLElement;
    expect(list.getAttribute('role')).toBe('list');
    const togglers = [
      ...list.querySelectorAll('.mlv-list-item-group__toggler'),
    ] as HTMLButtonElement[];
    expect(togglers).toHaveLength(2);
    expect(togglers.map((t) => t.getAttribute('aria-expanded'))).toEqual([
      'true',
      'false',
    ]);
    for (const toggler of togglers) {
      const controls = toggler.getAttribute('aria-controls') as string;
      expect(root.querySelectorAll(`#${controls}`)).toHaveLength(1);
    }

    await expectNoAxeViolations(root);
  });

  it('has no axe violations for the role="menu" variant', async () => {
    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ListMenuHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(ListMenuHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    // State: a named `menu` owning one `itemRole="none"` row that delegates
    // `menuitem` to a projected anchor, and one row that claims it directly.
    const list = root.querySelector('mlv-list') as HTMLElement;
    expect(list.getAttribute('role')).toBe('menu');
    expect(list.querySelectorAll('[role="menuitem"]')).toHaveLength(2);
    expect(list.querySelector('[role="none"]')).not.toBeNull();

    await expectNoAxeViolations(root);
  });
});
