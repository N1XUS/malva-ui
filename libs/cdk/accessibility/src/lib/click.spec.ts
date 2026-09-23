import {
  ChangeDetectionStrategy,
  Component,
  input,
  signal,
} from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
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

/**
 * One host of every kind the activation rule tells apart. Each binding logs
 * `<host>:<event type>` per emission, so the assertions compare plain strings.
 */
@Component({
  selector: 'mlv-click-activation-host',
  imports: [MlvClick],
  template: `
    <button
      type="button"
      data-host="button"
      mlvClick
      [hostRole]="null"
      (mlvClick)="record('button', $event)"
    >
      Button
    </button>
    <input
      type="button"
      value="Input button"
      data-host="input-button"
      mlvClick
      [hostRole]="null"
      (mlvClick)="record('input-button', $event)"
    />
    <input
      type="checkbox"
      aria-label="Check"
      data-host="input-checkbox"
      mlvClick
      [hostRole]="null"
      (mlvClick)="record('input-checkbox', $event)"
    />
    <input
      type="radio"
      aria-label="Pick"
      data-host="input-radio"
      mlvClick
      [hostRole]="null"
      (mlvClick)="record('input-radio', $event)"
    />
    <input
      type="submit"
      value="Submit"
      data-host="input-submit"
      mlvClick
      [hostRole]="null"
      (mlvClick)="record('input-submit', $event)"
    />
    <input
      type="reset"
      value="Reset"
      data-host="input-reset"
      mlvClick
      [hostRole]="null"
      (mlvClick)="record('input-reset', $event)"
    />
    <input
      type="image"
      alt="Image button"
      data-host="input-image"
      mlvClick
      [hostRole]="null"
      (mlvClick)="record('input-image', $event)"
    />
    <input
      type="file"
      aria-label="File"
      data-host="input-file"
      mlvClick
      [hostRole]="null"
      (mlvClick)="record('input-file', $event)"
    />
    <input
      type="color"
      aria-label="Colour"
      data-host="input-color"
      mlvClick
      [hostRole]="null"
      (mlvClick)="record('input-color', $event)"
    />
    <textarea
      aria-label="Notes"
      data-host="textarea"
      mlvClick
      [hostRole]="null"
      (mlvClick)="record('textarea', $event)"
    ></textarea>
    <select
      aria-label="Choice"
      data-host="select"
      mlvClick
      [hostRole]="null"
      (mlvClick)="record('select', $event)"
    >
      <option>One</option>
    </select>
    <div
      contenteditable="true"
      aria-label="Editor"
      data-host="contenteditable"
      mlvClick
      [hostRole]="null"
      (mlvClick)="record('contenteditable', $event)"
    ></div>
    <map name="activation-map">
      <area
        href="#activation-target"
        alt="Area"
        shape="rect"
        coords="0,0,10,10"
        data-host="area-href"
        mlvClick
        [hostRole]="null"
        (mlvClick)="record('area-href', $event)"
      />
    </map>
    <!-- Another listener cancels the keydown: the browser clicks nothing. -->
    <button
      type="button"
      data-host="button-cancelled"
      mlvClick
      [hostRole]="null"
      (keydown)="$event.preventDefault()"
      (mlvClick)="record('button-cancelled', $event)"
    >
      Cancelled
    </button>
    <!-- Focused, then disabled: the keydown arrives, no click follows. -->
    <button
      type="button"
      disabled
      data-host="button-disabled"
      mlvClick
      [hostRole]="null"
      (mlvClick)="record('button-disabled', $event)"
    >
      Disabled
    </button>
    <a
      href="#activation-target"
      data-host="a-href"
      mlvClick
      [hostRole]="null"
      (mlvClick)="record('a-href', $event)"
      >Link</a
    >
    <details>
      <summary
        data-host="summary"
        mlvClick
        [hostRole]="null"
        (mlvClick)="record('summary', $event)"
      >
        More
      </summary>
      Body
    </details>
    <!-- Only a <details>' first <summary> toggles it; an open one renders a
         second, which the browser does not click. -->
    <details open>
      <summary>First summary</summary>
      <summary
        data-host="summary-second"
        mlvClick
        (mlvClick)="record('summary-second', $event)"
      >
        Second summary
      </summary>
      Body
    </details>
    <!-- Outside a <details>: no toggle behaviour, so no browser click. -->
    <summary
      data-host="summary-orphan"
      mlvClick
      (mlvClick)="record('summary-orphan', $event)"
    >
      Orphan summary
    </summary>
    <a data-host="a" mlvClick (mlvClick)="record('a', $event)"
      >Anchor without href</a
    >
    <div data-host="div" mlvClick (mlvClick)="record('div', $event)">Div</div>
    <span data-host="span" mlvClick (mlvClick)="record('span', $event)"
      >Span</span
    >
    <input
      type="text"
      aria-label="Field"
      data-host="input-text"
      mlvClick
      [hostRole]="null"
      (mlvClick)="record('input-text', $event)"
    />
    <div data-host="wrapper" mlvClick (mlvClick)="record('wrapper', $event)">
      <button type="button" class="inner-button">Inner button</button>
      <input class="inner-field" aria-label="Inner field" />
    </div>
    <!-- Shadow roots are attached by the specs that need them. -->
    <div
      data-host="shadow-wrapper"
      mlvClick
      (mlvClick)="record('shadow-wrapper', $event)"
    >
      <span class="shadow-slot"></span>
    </div>
    <div
      data-host="shadow-host"
      mlvClick
      (mlvClick)="record('shadow-host', $event)"
    ></div>
    <a
      data-host="dynamic"
      mlvClick
      [attr.href]="dynamicHref()"
      (mlvClick)="record('dynamic', $event)"
      >Dynamic</a
    >
  `,
})
class ActivationHost {
  /** `<host>:<event type>`, one entry per `mlvClick` emission. */
  readonly emissions: string[] = [];

  /** Drives the last anchor between "no href" and "href". */
  readonly dynamicHref = signal<string | null>(null);

  record(host: string, event: Event): void {
    this.emissions.push(`${host}:${event.type}`);
    // Keeps jsdom from following the fragment link into the shared window.
    if (event.type === 'click') event.preventDefault();
  }
}

type ActivationKey = 'Enter' | ' ';

/**
 * Replays one physical key press the way a browser dispatches it: `keydown`,
 * then — only when the focused element's activation behaviour runs for that
 * key and nothing cancelled the keydown — a `click` on that element. jsdom
 * runs no activation behaviour for a key, so the spec dispatches the click the
 * browser would have. Which element kinds get one is **measured**, not
 * assumed: Chrome 153 via playwright-core, one trusted press per kind (#299).
 * All three events are `composed`, as the browser's are, so they leave a
 * shadow root the way a real key press does.
 */
function press(
  target: HTMLElement,
  key: ActivationKey,
  browserClicks: boolean,
  init: KeyboardEventInit = {},
): KeyboardEvent {
  const keydown = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    composed: true,
    ...init,
  });
  target.dispatchEvent(keydown);
  if (browserClicks && !keydown.defaultPrevented) {
    target.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        composed: true,
      }),
    );
  }
  target.dispatchEvent(
    new KeyboardEvent('keyup', {
      key,
      bubbles: true,
      cancelable: true,
      composed: true,
    }),
  );
  return keydown;
}

/**
 * One activation, one emission (#299).
 *
 * A native `<button>` and an `<a href>` already turn Enter (and a button also
 * Space) into a `click`. The directive used to emit for that keydown **and**
 * for the click the browser synthesised from it, so pagination's Next jumped
 * two pages and a notification action ran twice. Each row is one key press on
 * one host kind; the third column is whether the measured browser clicks.
 */
describe('MlvClick activation', () => {
  let fixture: ComponentFixture<ActivationHost>;

  const hostEl = (id: string): HTMLElement =>
    (fixture.nativeElement as HTMLElement).querySelector(
      `[data-host="${id}"]`,
    ) as HTMLElement;

  /** A copy, so a failing `expect` never pretty-prints the component. */
  const emissions = (): string[] => [...fixture.componentInstance.emissions];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActivationHost],
    }).compileComponents();
    fixture = TestBed.createComponent(ActivationHost);
    fixture.detectChanges();
    await fixture.whenStable();
    // jsdom 22 does not implement `isContentEditable` (it reads `undefined`);
    // a browser reports `true` for `contenteditable="true"`.
    Object.defineProperty(hostEl('contenteditable'), 'isContentEditable', {
      value: true,
    });
  });

  it.each<[string, ActivationKey, boolean, boolean]>([
    // host, key, browser clicks, Space's default cancelled
    ['button', 'Enter', true, false],
    ['button', ' ', true, false],
    ['input-button', 'Enter', true, false],
    ['input-button', ' ', true, false],
    ['input-submit', 'Enter', true, false],
    ['input-submit', ' ', true, false],
    ['input-reset', 'Enter', true, false],
    ['input-reset', ' ', true, false],
    ['input-image', 'Enter', true, false],
    ['input-image', ' ', true, false],
    ['input-file', 'Enter', true, false],
    ['input-file', ' ', true, false],
    ['input-color', 'Enter', true, false],
    ['input-color', ' ', true, false],
    // The toggles click on Space only; Enter is the directive's own emission.
    ['input-checkbox', 'Enter', false, false],
    ['input-checkbox', ' ', true, false],
    ['input-radio', 'Enter', false, false],
    ['input-radio', ' ', true, false],
    ['a-href', 'Enter', true, false],
    ['a-href', ' ', false, true],
    ['area-href', 'Enter', true, false],
    ['area-href', ' ', false, true],
    ['summary', 'Enter', true, false],
    ['summary', ' ', true, false],
    ['summary-second', 'Enter', false, false],
    ['summary-second', ' ', false, true],
    ['summary-orphan', 'Enter', false, false],
    ['summary-orphan', ' ', false, true],
    ['a', 'Enter', false, false],
    ['a', ' ', false, true],
    ['div', 'Enter', false, false],
    ['div', ' ', false, true],
    ['span', 'Enter', false, false],
    ['span', ' ', false, true],
    // A text field, a picker or an editor owns Space (it types one, or opens
    // the list), so nothing is cancelled.
    ['input-text', 'Enter', false, false],
    ['input-text', ' ', false, false],
    ['textarea', 'Enter', false, false],
    ['textarea', ' ', false, false],
    ['select', 'Enter', false, false],
    ['select', ' ', false, false],
    ['contenteditable', 'Enter', false, false],
    ['contenteditable', ' ', false, false],
  ])(
    '%s + %j emits exactly once (browser click: %s)',
    (id, key, browserClicks, cancelsDefault) => {
      const keydown = press(hostEl(id), key, browserClicks);

      // The browser's click is the emission where it exists; the directive's
      // own keydown path is the emission only where it does not.
      expect(emissions()).toEqual([
        `${id}:${browserClicks ? 'click' : 'keydown'}`,
      ]);
      // Space consumed as an activation must not also scroll the page; a
      // native host keeps its keydown untouched, since cancelling it would
      // cancel the browser's own activation.
      expect(keydown.defaultPrevented).toBe(cancelsDefault);
    },
  );

  it('emits exactly once per pointer click on every host kind', () => {
    const ids = [
      'button',
      'input-button',
      'input-checkbox',
      'a-href',
      'summary',
      'a',
      'div',
      'span',
      'input-text',
    ];
    for (const id of ids) {
      hostEl(id).dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      );
    }

    expect(emissions()).toEqual(ids.map((id) => `${id}:click`));
  });

  it.each<[string, ActivationKey]>([
    ['button-cancelled', 'Enter'],
    ['button-cancelled', ' '],
    ['button-disabled', 'Enter'],
    ['button-disabled', ' '],
  ])('%s + %j emits nothing: the browser clicks nothing', (id, key) => {
    // A cancelled keydown suppresses the button's activation, and a disabled
    // button has none; the directive leaves a native host's key to the
    // browser, so no click means no emission (#299 migration, shapes b / f).
    const keydown = press(hostEl(id), key, !id.endsWith('disabled'));

    expect(emissions()).toEqual([]);
    expect(keydown.defaultPrevented).toBe(id === 'button-cancelled');
  });

  it('lets a native descendant own its key press', () => {
    const innerButton = hostEl('wrapper').querySelector(
      '.inner-button',
    ) as HTMLElement;

    // Enter on a `<button>` inside the host: the browser clicks the inner
    // button and that click bubbles to the host — the one emission.
    press(innerButton, 'Enter', true);

    expect(emissions()).toEqual(['wrapper:click']);
  });

  it('never cancels Space typed into a field inside the host', () => {
    const field = hostEl('wrapper').querySelector(
      '.inner-field',
    ) as HTMLElement;

    const keydown = press(field, ' ', false);

    expect(keydown.defaultPrevented).toBe(false);
    // Unchanged: a key bubbling out of a non-activating descendant still
    // reaches the host's keydown path.
    expect(emissions()).toEqual(['wrapper:keydown']);
  });

  /**
   * A shadow root retargets `event.target` to its host for every listener
   * outside it, so a `<button>` inside a web component — or a
   * `ViewEncapsulation.ShadowDom` child — read as the component's host element.
   * The directive reads `composedPath()[0]` instead. Measured, Chrome 153:
   * with `event.target` each of these emitted twice, or cancelled the
   * button's Space and swallowed a typed space (#299).
   */
  describe('through a shadow root', () => {
    /** Attaches a shadow root holding `html` and returns its first element. */
    const inShadow = (
      shadowHost: Element,
      mode: ShadowRootMode,
      html: string,
    ): HTMLElement => {
      const root = shadowHost.attachShadow({ mode });
      root.innerHTML = html;
      return root.firstElementChild as HTMLElement;
    };

    it.each<ActivationKey>(['Enter', ' '])(
      'lets a <button> in an open shadow root under the host own %j',
      (key) => {
        const slot = hostEl('shadow-wrapper').querySelector(
          '.shadow-slot',
        ) as HTMLElement;
        const button = inShadow(
          slot,
          'open',
          '<button type="button">Inner</button>',
        );

        const keydown = press(button, key, true);

        expect(emissions()).toEqual(['shadow-wrapper:click']);
        expect(keydown.defaultPrevented).toBe(false);
      },
    );

    it.each<ActivationKey>(['Enter', ' '])(
      "lets a <button> in the host's own open shadow root own %j",
      (key) => {
        const button = inShadow(
          hostEl('shadow-host'),
          'open',
          '<button type="button">Inner</button>',
        );

        const keydown = press(button, key, true);

        // `event.target === host` cancelled Space here too, which suppressed
        // the button's own click (a cancelled keydown activates nothing).
        expect(emissions()).toEqual(['shadow-host:click']);
        expect(keydown.defaultPrevented).toBe(false);
      },
    );

    it("never cancels Space typed into a field in the host's own shadow root", () => {
      const field = inShadow(
        hostEl('shadow-host'),
        'open',
        '<input aria-label="Shadow field" />',
      );

      const keydown = press(field, ' ', false);

      expect(keydown.defaultPrevented).toBe(false);
      expect(emissions()).toEqual(['shadow-host:keydown']);
    });

    /**
     * A **known limit**, pinned so the documented list of double-emission
     * shapes stays true: a closed root hides its tree from `composedPath()`
     * too, so the directive sees only the shadow host and cannot know the
     * browser will click. Goes red if a later change sees through it — then
     * update the class JSDoc, `libs-accessibility.md` and the migration doc.
     */
    it('still emits twice for a <button> in a closed shadow root (documented)', () => {
      const slot = hostEl('shadow-wrapper').querySelector(
        '.shadow-slot',
      ) as HTMLElement;
      const button = inShadow(
        slot,
        'closed',
        '<button type="button">Inner</button>',
      );

      press(button, 'Enter', true);

      expect(emissions()).toEqual([
        'shadow-wrapper:keydown',
        'shadow-wrapper:click',
      ]);
    });
  });

  it('ignores Enter and Space pressed with a modifier', () => {
    const div = hostEl('div');

    const shiftEnter = press(div, 'Enter', false, { shiftKey: true });
    const ctrlSpace = press(div, ' ', false, { ctrlKey: true });

    expect(emissions()).toEqual([]);
    expect(shiftEnter.defaultPrevented).toBe(false);
    expect(ctrlSpace.defaultPrevented).toBe(false);
  });

  it('reads the host kind per key press, so a late `href` is honoured', async () => {
    const anchor = hostEl('dynamic');

    press(anchor, 'Enter', false);
    expect(emissions()).toEqual(['dynamic:keydown']);

    fixture.componentInstance.dynamicHref.set('#activation-target');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(anchor.getAttribute('href')).toBe('#activation-target');

    press(anchor, 'Enter', true);
    expect(emissions()).toEqual(['dynamic:keydown', 'dynamic:click']);
  });
});
