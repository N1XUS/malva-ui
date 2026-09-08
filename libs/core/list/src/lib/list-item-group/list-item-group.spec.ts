import type { ComponentFixture } from '@angular/core/testing';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvList } from '../list/list';
import { MlvListItem } from '../list-item/list-item';
import { MlvListItemGroup } from './list-item-group';

@Component({
  imports: [MlvListItemGroup],
  template: `<mlv-list-item-group label="Group">Content</mlv-list-item-group>`,
})
class TestListItemGroupHostComponent {}

/**
 * A `variant="plain"` list — the collapsible shape. Both groups render a
 * toggler; the first uses the bare `open` attribute, which is the form the
 * library documents for every other boolean input.
 */
@Component({
  imports: [MlvList, MlvListItem, MlvListItemGroup],
  template: `
    <mlv-list>
      <mlv-list-item-group label="Account" open>
        <mlv-list-item>Profile</mlv-list-item>
      </mlv-list-item-group>
      <mlv-list-item-group label="Network">
        <mlv-list-item>Wi-Fi</mlv-list-item>
      </mlv-list-item-group>
    </mlv-list>
  `,
})
class PlainGroupsHost {}

/**
 * A `variant="inset"` list — the shape `apps/docs`' list examples 5 and 8 ship.
 * The variant pins group content open, so no toggler may be rendered.
 */
@Component({
  imports: [MlvList, MlvListItem, MlvListItemGroup],
  template: `
    <mlv-list variant="inset">
      <mlv-list-item-group label="Account" open>
        <mlv-list-item>Profile</mlv-list-item>
      </mlv-list-item-group>
      <mlv-list-item-group label="Network">
        <mlv-list-item>Wi-Fi</mlv-list-item>
      </mlv-list-item-group>
    </mlv-list>
  `,
})
class InsetGroupsHost {}

function groups(fixture: ComponentFixture<unknown>): MlvListItemGroup[] {
  return fixture.debugElement
    .queryAll(By.directive(MlvListItemGroup))
    .map((debugEl) => debugEl.componentInstance as MlvListItemGroup);
}

describe('MlvListItemGroup', () => {
  let fixture: ComponentFixture<TestListItemGroupHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestListItemGroupHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestListItemGroupHostComponent);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders a collapsible toggler when there is no enclosing list', () => {
    // `libs/core/src/ssr-smoke.spec.ts` renders a group outside any list; it
    // must stay collapsible, because nothing pins its content open.
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.mlv-list-item-group__toggler')).not.toBeNull();
    expect(
      host
        .querySelector('mlv-list-item-group')
        ?.classList.contains('mlv-list-item-group--pinned'),
    ).toBe(false);
  });
});

describe('MlvListItemGroup open coercion', () => {
  let fixture: ComponentFixture<PlainGroupsHost>;

  beforeEach(async () => {
    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [PlainGroupsHost],
    }).compileComponents();
    fixture = TestBed.createComponent(PlainGroupsHost);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('resolves the bare `open` attribute to true', () => {
    // The documented attribute form binds the empty string. Without a
    // `coerceBooleanProperty` transform it reads falsy, and the group renders
    // collapsed while the markup says it is open.
    const [openGroup, closedGroup] = groups(fixture);
    expect(openGroup.open()).toBe(true);
    expect(closedGroup.open()).toBe(false);
  });

  it('reflects the coerced state on the host class and aria-expanded', () => {
    const host = fixture.nativeElement as HTMLElement;
    const hosts = [
      ...host.querySelectorAll('mlv-list-item-group'),
    ] as HTMLElement[];
    expect(
      hosts.map((el) => el.classList.contains('mlv-list-item-group--toggled')),
    ).toEqual([true, false]);

    const togglers = [
      ...host.querySelectorAll('.mlv-list-item-group__toggler'),
    ] as HTMLButtonElement[];
    expect(togglers.map((t) => t.getAttribute('aria-expanded'))).toEqual([
      'true',
      'false',
    ]);
  });

  it('toggles from the coerced state rather than from the raw attribute', async () => {
    // A toggle on a group opened by the bare attribute must close it. When the
    // raw value is `''`, `!value` is `true` and the first click opens it again.
    const host = fixture.nativeElement as HTMLElement;
    const toggler = host.querySelector(
      '.mlv-list-item-group__toggler',
    ) as HTMLButtonElement;
    toggler.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(toggler.getAttribute('aria-expanded')).toBe('false');
    expect(
      (
        host.querySelector('mlv-list-item-group') as HTMLElement
      ).classList.contains('mlv-list-item-group--toggled'),
    ).toBe(false);
  });

  it('has no axe violations for collapsible groups in a plain list', async () => {
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });
});

describe('MlvListItemGroup inside variant="inset"', () => {
  let fixture: ComponentFixture<InsetGroupsHost>;

  beforeEach(async () => {
    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [InsetGroupsHost],
    }).compileComponents();
    fixture = TestBed.createComponent(InsetGroupsHost);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('renders no toggler at all, because the variant pins the content open', () => {
    // The inset stylesheet pins `__content` to `grid-template-rows: 1fr` and
    // hides the chevron, so a rendered toggler is a `<button aria-expanded>`
    // making a claim about content it does not control — WCAG 4.1.2.
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('.mlv-list-item-group__toggler')).toHaveLength(
      0,
    );
    expect(host.querySelectorAll('[aria-expanded]')).toHaveLength(0);
    expect(host.querySelectorAll('button')).toHaveLength(0);
  });

  it('stamps the pinned modifier on every group host', () => {
    const host = fixture.nativeElement as HTMLElement;
    const hosts = [
      ...host.querySelectorAll('mlv-list-item-group'),
    ] as HTMLElement[];
    expect(hosts).toHaveLength(2);
    expect(
      hosts.map((el) => el.classList.contains('mlv-list-item-group--pinned')),
    ).toEqual([true, true]);
  });

  it('renders the section label as inert text that names the content list', () => {
    const host = fixture.nativeElement as HTMLElement;
    const labels = [
      ...host.querySelectorAll('.mlv-list-item-group__label'),
    ] as HTMLElement[];
    expect(labels.map((el) => el.textContent?.trim())).toEqual([
      'Account',
      'Network',
    ]);

    const contents = [
      ...host.querySelectorAll('.mlv-list-item-group__content'),
    ] as HTMLElement[];
    expect(contents.map((el) => el.getAttribute('aria-labelledby'))).toEqual(
      labels.map((el) => el.id),
    );
    expect(labels.every((el) => !!el.id)).toBe(true);
  });

  it('has no axe violations for pinned groups in an inset list', async () => {
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });
});
