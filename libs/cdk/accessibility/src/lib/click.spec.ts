import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expectNoAxeViolations, runAxe } from '@malva-ui/internal-testing/axe';

import { MlvClick } from './click';

@Component({
  selector: 'mlv-click-test-host',
  imports: [MlvClick],
  template: `
    <div mlvClick>Apply filter</div>

    <div mlvClick disabled>Apply filter (disabled)</div>

    <div mlvClick aria-label="Dismiss">
      <span aria-hidden="true">&times;</span>
    </div>

    <div mlvClick hostRole="link">Open profile</div>

    <a href="#profile" mlvClick [hostRole]="null">Profile</a>
  `,
})
class ClickTestHost {}

@Component({
  selector: 'mlv-click-unnamed-host',
  imports: [MlvClick],
  template: `
    <div mlvClick>
      <span aria-hidden="true">&times;</span>
    </div>
  `,
})
class UnnamedClickHost {}

/**
 * Accessibility sweep — `[mlvClick]`.
 *
 * The directive's whole DOM contribution is two host attributes, `role` and
 * `tabindex`, written onto an element the consumer chose. That is exactly the
 * pair axe judges: a widget role makes the host owe an accessible name
 * (`aria-command-name` for a synthesised one, `link-name` for a link), and
 * `tabindex` decides whether it is a tab stop. So the sweep is parameterised
 * over the states that change either attribute — default, `disabled`
 * (`tabindex="-1"`), icon-only with an `aria-label`, a role passed through
 * `hostRole` the way `mlv-select` passes `combobox`, and `[hostRole]="null"` on
 * a host whose semantics are native — rather than over one rendering.
 */
describe('MlvClick accessibility', () => {
  it('has no axe violations across role, disabled and hostRole states', async () => {
    await TestBed.configureTestingModule({
      imports: [ClickTestHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(ClickTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    const hosts = [...host.querySelectorAll('[mlvClick]')] as HTMLElement[];
    expect(hosts).toHaveLength(5);
    // State 1 — default: a synthesised button in the tab order.
    expect(hosts[0].getAttribute('role')).toBe('button');
    expect(hosts[0].getAttribute('tabindex')).toBe('0');
    // State 2 — `disabled`: out of the tab order, still a button.
    expect(hosts[1].getAttribute('tabindex')).toBe('-1');
    expect(hosts[1].getAttribute('role')).toBe('button');
    // State 3 — icon-only: named by `aria-label`, glyph hidden.
    expect(hosts[2].getAttribute('aria-label')).toBe('Dismiss');
    // State 4 — a role handed to the directive, not written beside it.
    expect(hosts[3].getAttribute('role')).toBe('link');
    // State 5 — `[hostRole]="null"`: no `role` attribute at all, so the native
    // element's own semantics are what reach the a11y tree.
    expect(hosts[4].getAttribute('role')).toBeNull();
    expect(hosts[4].tagName).toBe('A');

    await expectNoAxeViolations(host);
  });

  /**
   * Non-vacuity, and the finding the sweep above is actually asking about.
   * `[mlvClick]` synthesises `role="button"` on any host, so a host whose only
   * content is an `aria-hidden` glyph has a widget role and no accessible name
   * — a WCAG 4.1.2 failure the consumer, not the directive, has to fix. Pinned
   * so the clean sweep above cannot quietly become a sweep that checks nothing.
   */
  it('surfaces the missing accessible name when a consumer gives it none', async () => {
    await TestBed.configureTestingModule({
      imports: [UnnamedClickHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(UnnamedClickHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const results = await runAxe(fixture.nativeElement as HTMLElement);
    expect(results.violations.map((violation) => violation.id)).toContain(
      'aria-command-name',
    );
  });
});
