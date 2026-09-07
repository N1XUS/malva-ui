import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';

import { MlvSpacer } from './spacer';

@Component({
  selector: 'mlv-spacer-test-host',
  imports: [MlvSpacer],
  template: `
    <div class="plain">
      <button type="button">Save</button>
      <mlv-spacer />
      <button type="button">Cancel</button>
    </div>

    <div role="toolbar" aria-label="Formatting">
      <button type="button">Bold</button>
      <mlv-spacer />
      <button type="button">Italic</button>
    </div>

    <ul role="menu" aria-label="Commands">
      <li role="menuitem" tabindex="0">
        Open
        <mlv-spacer />
        <span aria-hidden="true">&rsaquo;</span>
      </li>
    </ul>

    <ul role="list" class="owning-list">
      <li role="listitem">Item</li>
      <mlv-spacer />
    </ul>
  `,
})
class SpacerTestHost {}

/**
 * Accessibility sweep — `<mlv-spacer>`.
 *
 * The component renders an empty element with one class and nothing else, so
 * on its own there is nothing for axe to judge. What is worth judging is where
 * it lands: a roleless element inside a container role is *owned* by that role,
 * and a role with a required-children contract (`list`, `menu`, `listbox`)
 * counts it. So the states here are the parents the library actually puts a
 * spacer into — a plain flex row (`mlv-toolbar`, `[mlvActionBar]`), an explicit
 * `role="toolbar"`, and a `role="menuitem"` row (the `mlv-menubar` shape) —
 * plus a `role="list"`, the strictest parent, so the owned-children answer is
 * pinned rather than assumed.
 */
describe('MlvSpacer accessibility', () => {
  it('has no axe violations in the parents the library places it in', async () => {
    await TestBed.configureTestingModule({
      imports: [SpacerTestHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(SpacerTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    // Four spacers, one per parent shape, each an empty element with no role.
    const spacers = [...host.querySelectorAll('mlv-spacer')] as HTMLElement[];
    expect(spacers).toHaveLength(4);
    expect(spacers.every((el) => el.getAttribute('role') === null)).toBe(true);
    expect(spacers.every((el) => el.textContent === '')).toBe(true);
    expect(spacers.every((el) => el.classList.contains('mlv-spacer'))).toBe(
      true,
    );

    // Rooted at the host, so every container role above a spacer — the toolbar,
    // the menu and the list — is itself in scope. A sweep rooted at a spacer
    // would never evaluate the rule those parents own.
    await expectNoAxeViolations(host);
  });
});
