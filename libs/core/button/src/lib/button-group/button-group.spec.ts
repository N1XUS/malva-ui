import { Component } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvButton } from '../button/button';
import { MlvButtonGroup } from './button-group';

@Component({
  imports: [MlvButton, MlvButtonGroup],
  template: `
    <mlv-button-group variant="error" aria-label="Document actions">
      <button mlvButton>Delete</button>
      <button mlvButton variant="outlined">Cancel</button>
    </mlv-button-group>
  `,
})
class ButtonGroupTestHost {}

@Component({
  imports: [MlvButton, MlvButtonGroup],
  template: `
    <mlv-button-group>
      <button mlvButton>Delete</button>
      <button mlvButton>Cancel</button>
    </mlv-button-group>
  `,
})
class UnlabelledButtonGroupHost {}

describe('MlvButtonGroup', () => {
  let fixture: ComponentFixture<ButtonGroupTestHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonGroupTestHost],
    }).compileComponents();

    fixture = TestBed.createComponent(ButtonGroupTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('renders an accessible native group', () => {
    const group = fixture.nativeElement.querySelector('mlv-button-group');
    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('aria-label')).toBe('Document actions');
  });

  it('provides its variant while preserving a child override', () => {
    const buttons = fixture.nativeElement.querySelectorAll('.mlv-button');
    expect(buttons[0].classList).toContain('mlv-button--variant-error');
    expect(buttons[1].classList).toContain('mlv-button--variant-outlined');
  });
});

/**
 * Accessibility sweep — `mlv-button-group`.
 *
 * The group's only DOM contribution is `role="group"` on its host, so the sweep
 * is rooted at the fixture root: `role="group"` is a container role, and what
 * it owns — the projected buttons — is only in scope from an ancestor. A sweep
 * rooted at a child button would never evaluate the group at all. The named and
 * unnamed groups are separate states because a `group` with no accessible name
 * is a different node to axe than one with a label.
 */
describe('MlvButtonGroup accessibility', () => {
  it('has no axe violations for a labelled group owning its buttons', async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonGroupTestHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(ButtonGroupTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    const group = host.querySelector('mlv-button-group') as HTMLElement;
    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('aria-label')).toBe('Document actions');
    expect(group.querySelectorAll('button.mlv-button')).toHaveLength(2);

    await expectNoAxeViolations(host);
  });

  it('has no axe violations for an unlabelled group', async () => {
    await TestBed.configureTestingModule({
      imports: [UnlabelledButtonGroupHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(UnlabelledButtonGroupHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    // State: the component supplies the role but never a name — a consumer
    // that omits `aria-label` gets a nameless `group`, which is what this pins.
    const group = host.querySelector('mlv-button-group') as HTMLElement;
    expect(group.getAttribute('role')).toBe('group');
    expect(group.hasAttribute('aria-label')).toBe(false);

    await expectNoAxeViolations(host);
  });
});
