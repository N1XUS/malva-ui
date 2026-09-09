import {
  ChangeDetectionStrategy,
  Component,
  input,
  signal,
} from '@angular/core';
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

/**
 * A component that owns `[attr.role]` on its own host, the way `MlvListItem`
 * owns `itemRole`. Co-hosting `[mlvClick]` on one of these is the shape #223
 * was found in.
 *
 * `itemRole` is an input rather than a literal so the last row below can make
 * the component's binding *change* after first render — the case that
 * separates "the directive always wins" from what actually happens.
 */
@Component({
  selector: 'mlv-click-roled',
  template: '<ng-content />',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.role]': 'itemRole()' },
})
class RoledHost {
  readonly itemRole = input<string | null>('listitem');
}

@Component({
  selector: 'mlv-click-cohost',
  imports: [MlvClick, RoledHost],
  template: `
    <mlv-click-roled mlvClick>Default</mlv-click-roled>
    <mlv-click-roled mlvClick [hostRole]="null">Nulled</mlv-click-roled>
    <mlv-click-roled mlvClick [hostRole]="'menuitem'">Agreed</mlv-click-roled>
    <mlv-click-roled mlvClick [itemRole]="lateRole()">Late</mlv-click-roled>
  `,
})
class CoHostedRoleHost {
  /** Flipped after first render by the spec below. */
  readonly lateRole = signal<string | null>('listitem');
}

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
   * The co-hosting contract, pinned because it is counter-intuitive and cost a
   * shipped a11y defect (#223).
   *
   * Two `[attr.role]` host bindings on one element do **not** resolve by a
   * fixed precedence. Each is dirty-checked against its own previous value and
   * writes the attribute only on a pass where that value changed; the
   * directive's bindings merely run after the component's, so the directive
   * wins a same-pass *tie*. First render is always such a tie — both write —
   * which is why `[mlvClick]`'s default silently replaces the component's role.
   * On a later pass where only the component's expression changed, only the
   * component writes, and the component wins (row 4).
   *
   * So the rule is "whichever binding changed value most recently, directive
   * first on a tie" — not "the directive always wins". The safe shape is
   * therefore the same for both: write the same value through both bindings,
   * which is order- and timing-independent (row 3).
   */
  it('resolves `role` by which binding changed last, not by a fixed precedence', async () => {
    await TestBed.configureTestingModule({
      imports: [CoHostedRoleHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(CoHostedRoleHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const rows = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll(
        'mlv-click-roled',
      ),
    );

    expect(rows.map((row) => row.getAttribute('role'))).toEqual([
      // First render is a tie, and the directive's default breaks it against
      // the component's `listitem`.
      'button',
      // `null` does not hand the role back — it deletes it.
      null,
      // Agreeing values are stable whichever binding runs last.
      'menuitem',
      // Same tie as row 1, so far.
      'button',
    ]);

    // Row 4 only: the component's expression changes, the directive's does
    // not, so only the component writes — and the "last writer" is now the
    // component. `MlvSidebarItem._hostRole` is exactly this shape in-library:
    // a `computed()` that flips between `null`, `'menuitem'` and `'button'`.
    fixture.componentInstance.lateRole.set('menuitem');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(rows[3].getAttribute('role')).toBe('menuitem');
    expect(rows[0].getAttribute('role')).toBe('button');

    // And it keeps winning on every later change, including back to `null`.
    fixture.componentInstance.lateRole.set(null);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(rows[3].getAttribute('role')).toBeNull();
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
