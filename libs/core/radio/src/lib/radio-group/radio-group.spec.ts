import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import type { Type } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvRadioGroup } from './radio-group';
import { MlvRadio } from '../radio/radio';
import { MlvRtlService } from '@malva-ui/cdk/utils';

// ---------------------------------------------------------------------------
// Host components
// ---------------------------------------------------------------------------

@Component({
  template: `
    <mlv-radio-group [(value)]="value" [state]="state" [readonly]="readonly">
      <mlv-radio [value]="'a'">A</mlv-radio>
      <mlv-radio [value]="'b'">B</mlv-radio>
      <mlv-radio [value]="'c'">C</mlv-radio>
    </mlv-radio-group>
  `,
  imports: [MlvRadioGroup, MlvRadio],
})
class TemplateHost {
  value: unknown = undefined;
  state = 'default';
  readonly = false;
}

@Component({
  template: `
    <mlv-radio-group [formControl]="ctrl">
      <mlv-radio [value]="'a'">A</mlv-radio>
      <mlv-radio [value]="'b'">B</mlv-radio>
    </mlv-radio-group>
  `,
  imports: [MlvRadioGroup, MlvRadio, ReactiveFormsModule],
})
class ReactiveHost {
  ctrl = new FormControl<string>('a');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRadios(fixture: ComponentFixture<unknown>): HTMLInputElement[] {
  return Array.from(
    fixture.nativeElement.querySelectorAll('.mlv-radio__native'),
  );
}

function getGroupEl(fixture: ComponentFixture<unknown>): HTMLElement {
  return fixture.nativeElement.querySelector('mlv-radio-group');
}

async function createFixture<T>(
  hostClass: Type<T>,
): Promise<ComponentFixture<T>> {
  await TestBed.configureTestingModule({
    imports: [hostClass],
  }).compileComponents();
  const fixture = TestBed.createComponent(hostClass);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('MlvRadioGroup', () => {
  describe('rendering', () => {
    it('has role="radiogroup" on the host', async () => {
      const fixture = await createFixture(TemplateHost);
      expect(getGroupEl(fixture).getAttribute('role')).toBe('radiogroup');
    });

    it('projects each radio', async () => {
      const fixture = await createFixture(TemplateHost);
      expect(getRadios(fixture).length).toBe(3);
    });

    it('applies the default state modifier class', async () => {
      const fixture = await createFixture(TemplateHost);
      expect(
        getGroupEl(fixture).classList.contains(
          'mlv-radio-group--state-default',
        ),
      ).toBe(true);
    });
  });

  describe('selection', () => {
    it('selects a radio on native change and updates the model', async () => {
      const fixture = await createFixture(TemplateHost);
      const radios = getRadios(fixture);
      radios[1].dispatchEvent(new Event('change', { bubbles: true }));
      fixture.detectChanges();
      expect(fixture.componentInstance.value).toBe('b');
    });

    it('moves the roving tab stop to the selected radio', async () => {
      const fixture = await createFixture(TemplateHost);
      const radios = getRadios(fixture);
      radios[2].dispatchEvent(new Event('change', { bubbles: true }));
      fixture.detectChanges();
      const tabbable = radios.filter((r) => r.getAttribute('tabindex') === '0');
      expect(tabbable.length).toBe(1);
      expect(radios[2].getAttribute('tabindex')).toBe('0');
    });
  });

  describe('keyboard navigation', () => {
    it('ArrowDown moves selection to the next radio', async () => {
      const fixture = await createFixture(TemplateHost);
      // Attached to the document so radio.focus() fires the focus event that
      // syncs the FocusKeyManager's active item.
      document.body.appendChild(fixture.nativeElement);
      try {
        const radios = getRadios(fixture);
        radios[0].dispatchEvent(new Event('change', { bubbles: true }));
        fixture.detectChanges();

        getGroupEl(fixture).dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'ArrowDown',
            bubbles: true,
            cancelable: true,
          }),
        );
        fixture.detectChanges();
        expect(fixture.componentInstance.value).toBe('b');
      } finally {
        fixture.nativeElement.remove();
      }
    });
  });

  describe('read-only', () => {
    @Component({
      template: `
        <mlv-radio-group [(value)]="value" [readonly]="true">
          <mlv-radio [value]="'a'">A</mlv-radio>
          <mlv-radio [value]="'b'">B</mlv-radio>
        </mlv-radio-group>
      `,
      imports: [MlvRadioGroup, MlvRadio],
    })
    class ReadonlyHost {
      value: unknown = undefined;
    }

    it('adds the readonly modifier class and blocks selection', async () => {
      const fixture = await createFixture(ReadonlyHost);

      expect(
        getGroupEl(fixture).classList.contains('mlv-radio-group--readonly'),
      ).toBe(true);

      const radios = getRadios(fixture);
      radios[1].dispatchEvent(new Event('change', { bubbles: true }));
      fixture.detectChanges();
      expect(fixture.componentInstance.value).toBeUndefined();
    });
  });

  describe('reactive forms / form disabled', () => {
    it('checks the radio matching the initial FormControl value', async () => {
      const fixture = await createFixture(ReactiveHost);
      const radios = getRadios(fixture);
      expect(radios[0].getAttribute('aria-checked')).toBe('true');
      expect(radios[1].getAttribute('aria-checked')).toBe('false');
    });

    it('propagates FormControl.disable() to the radio group', async () => {
      const fixture = await createFixture(ReactiveHost);
      fixture.componentInstance.ctrl.disable();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(
        getGroupEl(fixture).classList.contains('mlv-radio-group--disabled'),
      ).toBe(true);

      // Selection must be blocked while disabled via the form control.
      const radios = getRadios(fixture);
      radios[1].dispatchEvent(new Event('change', { bubbles: true }));
      fixture.detectChanges();
      expect(fixture.componentInstance.ctrl.value).toBe('a');
    });
  });
});

@Component({
  template: `
    <mlv-radio-group
      label="Plan"
      required
      description="Billed monthly."
      message="Pick one"
    >
      <mlv-radio [value]="'a'">A</mlv-radio>
    </mlv-radio-group>
  `,
  imports: [MlvRadioGroup, MlvRadio],
})
class RadioGroupFieldSurfaceHost {}

describe('MlvRadioGroup field surface', () => {
  let fixture: ComponentFixture<RadioGroupFieldSurfaceHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RadioGroupFieldSurfaceHost],
    }).compileComponents();
    fixture = TestBed.createComponent(RadioGroupFieldSurfaceHost);
    await fixture.whenStable();
  });

  it('marks the radiogroup required and shows the label marker', () => {
    const group = fixture.nativeElement.querySelector(
      'mlv-radio-group',
    ) as HTMLElement;
    expect(group.getAttribute('role')).toBe('radiogroup');
    expect(group.getAttribute('aria-required')).toBe('true');
    expect(
      fixture.nativeElement.querySelector('.mlv-label__required'),
    ).not.toBeNull();
  });

  it('renders description and message and describes the group with both', () => {
    const description = fixture.nativeElement.querySelector(
      'mlv-description',
    ) as HTMLElement;
    const message = fixture.nativeElement.querySelector(
      'mlv-message',
    ) as HTMLElement;
    expect(description.textContent?.trim()).toBe('Billed monthly.');
    expect(message.textContent?.trim()).toBe('Pick one');

    const group = fixture.nativeElement.querySelector(
      'mlv-radio-group',
    ) as HTMLElement;
    expect((group.getAttribute('aria-describedby') ?? '').split(' ')).toEqual([
      description.id,
      message.id,
    ]);
  });
});

// ---------------------------------------------------------------------------
// Scoped direction (#147)
//
// The group answers all four arrows for WAI-ARIA radiogroup semantics, so the
// horizontal pair is direction-sensitive and resolves against the group's own
// host — a `[dir]` ancestor mirrors it while the document stays LTR, and so
// does the `dir` CDK stamps on an overlay pane the group is rendered in.
// ---------------------------------------------------------------------------

@Component({
  template: `
    <div [attr.dir]="scopeDir">
      <mlv-radio-group [(value)]="value">
        <mlv-radio [value]="'a'">A</mlv-radio>
        <mlv-radio [value]="'b'">B</mlv-radio>
        <mlv-radio [value]="'c'">C</mlv-radio>
      </mlv-radio-group>
    </div>
  `,
  imports: [MlvRadioGroup, MlvRadio],
})
class ScopedDirHost {
  value: unknown = undefined;
  scopeDir: 'rtl' | 'ltr' = 'rtl';
}

describe('MlvRadioGroup scoped direction', () => {
  let rtlService: MlvRtlService | null = null;

  afterEach(() => {
    rtlService?.setDirection('ltr');
    rtlService = null;
    document.documentElement.removeAttribute('dir');
  });

  /**
   * Attaches the fixture to the document so `radio.focus()` fires the focus
   * event that syncs the FocusKeyManager's active item, seeds the selection on
   * the first radio and runs `body` with the fixture live.
   */
  async function withScopedFixture(
    scopeDir: 'rtl' | 'ltr',
    documentDir: 'rtl' | 'ltr',
    body: (
      fixture: ComponentFixture<ScopedDirHost>,
      keydown: (key: string) => void,
    ) => void,
  ): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ScopedDirHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(ScopedDirHost);
    fixture.componentInstance.scopeDir = scopeDir;
    rtlService = TestBed.inject(MlvRtlService);
    rtlService.setDirection(documentDir);
    fixture.detectChanges();
    await fixture.whenStable();

    document.body.appendChild(fixture.nativeElement);
    try {
      getRadios(fixture)[0].dispatchEvent(
        new Event('change', { bubbles: true }),
      );
      fixture.detectChanges();

      body(fixture, (key: string) => {
        getGroupEl(fixture).dispatchEvent(
          new KeyboardEvent('keydown', {
            key,
            bubbles: true,
            cancelable: true,
          }),
        );
        fixture.detectChanges();
      });
    } finally {
      fixture.nativeElement.remove();
    }
  }

  it('mirrors the horizontal arrows inside a [dir="rtl"] subtree while the document stays LTR', async () => {
    await withScopedFixture('rtl', 'ltr', (fixture, keydown) => {
      expect(rtlService?.direction()).toBe('ltr');

      keydown('ArrowLeft');
      expect(fixture.componentInstance.value).toBe('b'); // "next" once mirrored
      keydown('ArrowRight');
      expect(fixture.componentInstance.value).toBe('a');
    });
  });

  it('leaves the vertical arrows alone inside a [dir="rtl"] subtree', async () => {
    await withScopedFixture('rtl', 'ltr', (fixture, keydown) => {
      keydown('ArrowDown');
      expect(fixture.componentInstance.value).toBe('b'); // vertical never mirrors
      keydown('ArrowUp');
      expect(fixture.componentInstance.value).toBe('a');
    });
  });

  it('keeps a [dir="ltr"] island unmirrored while the document is RTL', async () => {
    await withScopedFixture('ltr', 'rtl', (fixture, keydown) => {
      expect(rtlService?.direction()).toBe('rtl');

      keydown('ArrowRight');
      expect(fixture.componentInstance.value).toBe('b'); // the island reads LTR
      keydown('ArrowLeft');
      expect(fixture.componentInstance.value).toBe('a');
    });
  });
});

// ---------------------------------------------------------------------------
// Roving tab stop with disabled radios (#307)
//
// A disabled native radio cannot take focus, so a tab stop left on one leaves
// the group with none at all and Tab skips it. Measured in Chromium 145,
// Firefox 146 and WebKit 26 with native inputs: a disabled radio carrying
// `tabindex="0"` beside `tabindex="-1"` siblings is 0 stops; moving the `0` to
// an enabled sibling is 1. The same holds when the *checked* radio is the
// disabled one — natively Chromium and Firefox then Tab to the first enabled
// radio, and the group follows them (WebKit reaches no radio in that group
// either way, natively included).
// ---------------------------------------------------------------------------

interface Plan {
  id: string;
  label: string;
  disabled: boolean;
}

@Component({
  template: `
    <mlv-radio-group label="Notification channel" [(value)]="value">
      @for (plan of plans(); track plan.id) {
        <mlv-radio [value]="plan.id" [disabled]="plan.disabled">{{
          plan.label
        }}</mlv-radio>
      }
    </mlv-radio-group>
  `,
  imports: [MlvRadioGroup, MlvRadio],
})
class ChannelsRadioHost {
  readonly value = signal<unknown>(undefined);
  readonly plans = signal<Plan[]>([
    { id: 'sms', label: 'SMS', disabled: true },
    { id: 'email', label: 'Email', disabled: false },
    { id: 'push', label: 'Push', disabled: false },
  ]);

  /** Sets one radio's `disabled` flag, leaving the rest untouched. */
  setDisabled(id: string, disabled: boolean): void {
    this.plans.update((list) =>
      list.map((p) => (p.id === id ? { ...p, disabled } : p)),
    );
  }
}

/**
 * The radios a browser's Tab sequence reaches: enabled, and not taken out of
 * the order by `tabindex="-1"`. jsdom does not model this itself — it treats a
 * disabled input carrying a `tabindex` as focusable — so the predicate is
 * spelled out, matching the measurement above.
 */
function radioTabStops(fixture: ComponentFixture<unknown>): string[] {
  return getRadios(fixture)
    .filter((r) => !r.disabled && r.getAttribute('tabindex') !== '-1')
    .map((r) => r.closest('mlv-radio')?.textContent?.trim() ?? '');
}

describe('MlvRadioGroup roving tab stop with disabled radios (#307)', () => {
  let fixture: ComponentFixture<ChannelsRadioHost>;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    fixture = await createFixture(ChannelsRadioHost);
    // Attached so `.focus()` fires the focus event that reports the radio to
    // the group's key manager, as a real Tab or click would.
    document.body.appendChild(fixture.nativeElement);
  });

  afterEach(() => {
    (fixture.nativeElement as HTMLElement).remove();
  });

  it('gives the tab stop to the first enabled radio when none is checked and the first is disabled', () => {
    expect(radioTabStops(fixture)).toEqual(['Email']);
    expect(getRadios(fixture).map((r) => r.getAttribute('tabindex'))).toEqual([
      '-1',
      '0',
      '-1',
    ]);
  });

  it('gives the tab stop to the first enabled radio when the checked one is disabled', async () => {
    fixture.componentInstance.value.set('sms');
    await settle();

    expect(getRadios(fixture)[0].checked).toBe(true);
    expect(radioTabStops(fixture)).toEqual(['Email']);
  });

  it('keeps the tab stop on the checked radio while it is enabled', async () => {
    fixture.componentInstance.value.set('push');
    await settle();

    expect(radioTabStops(fixture)).toEqual(['Push']);
  });

  it('moves the tab stop to the first enabled radio when the checked one becomes disabled', async () => {
    fixture.componentInstance.setDisabled('sms', false);
    await settle();
    getRadios(fixture)[1].dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    expect(fixture.componentInstance.value()).toBe('email');
    expect(radioTabStops(fixture)).toEqual(['Email']);

    fixture.componentInstance.setDisabled('email', true);
    await settle();

    // The first enabled radio, not the next one after Email: natively,
    // Chromium and Firefox Tab to the first enabled radio of a group whose
    // checked radio is disabled.
    expect(getRadios(fixture)[1].checked).toBe(true);
    expect(radioTabStops(fixture)).toEqual(['SMS']);
  });

  it('keeps arrow navigation on the focused radio when a radio is added', async () => {
    getRadios(fixture)[1].dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    expect(fixture.componentInstance.value()).toBe('email');
    expect(document.activeElement).toBe(getRadios(fixture)[1]);

    fixture.componentInstance.plans.update((list) => [
      ...list,
      { id: 'slack', label: 'Slack', disabled: false },
    ]);
    await settle();

    // ArrowDown moves on from Email, not back to the first enabled radio.
    getGroupEl(fixture).dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    expect(fixture.componentInstance.value()).toBe('push');
    expect(radioTabStops(fixture)).toEqual(['Push']);
  });

  it('has no axe violations with a disabled first radio', async () => {
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });
});

// ---------------------------------------------------------------------------
// Radios projected through `@for`
//
// A `@for` row's inputs are bound when the row view refreshes, which is after
// the effects of the view declaring the group have run. Selection used to read
// each radio's `value` untracked, so it matched every radio against
// `undefined`: with no group value every radio claimed `checked` (three tab
// stops, `aria-checked="true"` on inputs the browser left unchecked, and the
// last radio drawn selected); with a value, none was.
// ---------------------------------------------------------------------------

describe('MlvRadioGroup with radios projected through @for', () => {
  async function render(
    value: unknown,
  ): Promise<ComponentFixture<ChannelsRadioHost>> {
    await TestBed.configureTestingModule({
      imports: [ChannelsRadioHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(ChannelsRadioHost);
    fixture.componentInstance.value.set(value);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it('checks no radio while the group has no value', async () => {
    const fixture = await render(undefined);

    expect(getRadios(fixture).map((r) => r.checked)).toEqual([
      false,
      false,
      false,
    ]);
    expect(
      getRadios(fixture).map((r) => r.getAttribute('aria-checked')),
    ).toEqual(['false', 'false', 'false']);
    expect(radioTabStops(fixture)).toEqual(['Email']);
  });

  it('checks the radio matching the initial value', async () => {
    const fixture = await render('push');

    expect(getRadios(fixture).map((r) => r.checked)).toEqual([
      false,
      false,
      true,
    ]);
    expect(radioTabStops(fixture)).toEqual(['Push']);
  });
});

// ---------------------------------------------------------------------------
// Checked state follows each radio's own `value`
//
// A radio is checked while `radio.value() === group.value()`, re-evaluated
// whenever either side changes — a later `[value]` change on a radio written
// directly in the template re-syncs it too, not only the first binding of a
// `@for` row. The comparison is identity, so an option object re-created on
// refresh stops matching the group value until `value` is pointed at it.
// ---------------------------------------------------------------------------

@Component({
  template: `
    <mlv-radio-group label="Size" [(value)]="value">
      <mlv-radio [value]="aValue()">A</mlv-radio>
      <mlv-radio value="b">B</mlv-radio>
    </mlv-radio-group>
  `,
  imports: [MlvRadioGroup, MlvRadio],
})
class BoundValueRadioHost {
  readonly value = signal<unknown>('x');
  readonly aValue = signal<unknown>('a');
}

interface Tier {
  id: string;
  label: string;
}

@Component({
  template: `
    <mlv-radio-group label="Tier" [(value)]="value">
      @for (tier of tiers(); track tier.id) {
        <mlv-radio [value]="tier">{{ tier.label }}</mlv-radio>
      }
    </mlv-radio-group>
  `,
  imports: [MlvRadioGroup, MlvRadio],
})
class ObjectValueRadioHost {
  readonly value = signal<unknown>(undefined);
  readonly tiers = signal<Tier[]>([
    { id: 'free', label: 'Free' },
    { id: 'pro', label: 'Pro' },
  ]);
}

function checkedStates(fixture: ComponentFixture<unknown>): string[] {
  return getRadios(fixture).map(
    (r) => `${r.checked}/${r.getAttribute('aria-checked')}`,
  );
}

describe("MlvRadioGroup checked state follows each radio's value", () => {
  async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('checks a radio whose value changes to equal the group value, and unchecks it when it changes away', async () => {
    const fixture = await createFixture(BoundValueRadioHost);
    expect(checkedStates(fixture)).toEqual(['false/false', 'false/false']);

    fixture.componentInstance.aValue.set('x');
    await settle(fixture);
    expect(checkedStates(fixture)).toEqual(['true/true', 'false/false']);
    expect(radioTabStops(fixture)).toEqual(['A']);

    fixture.componentInstance.aValue.set('y');
    await settle(fixture);
    expect(checkedStates(fixture)).toEqual(['false/false', 'false/false']);
    // The group value is left alone: only what is drawn as checked follows.
    expect(fixture.componentInstance.value()).toBe('x');
  });

  it('checks no radio once the selected option object is re-created, until the value is pointed at the new object', async () => {
    const fixture = await createFixture(ObjectValueRadioHost);
    const [, pro] = fixture.componentInstance.tiers();
    getRadios(fixture)[1].dispatchEvent(new Event('change', { bubbles: true }));
    await settle(fixture);
    expect(fixture.componentInstance.value()).toBe(pro);
    expect(checkedStates(fixture)).toEqual(['false/false', 'true/true']);

    // A refresh that re-creates the options with the same ids. No radio's
    // value is identical to the group value any more, so none is drawn as
    // checked and the tab stop falls back to the first enabled radio.
    fixture.componentInstance.tiers.update((list) =>
      list.map((tier) => ({ ...tier })),
    );
    await settle(fixture);
    expect(fixture.componentInstance.value()).toBe(pro);
    expect(checkedStates(fixture)).toEqual(['false/false', 'false/false']);
    expect(radioTabStops(fixture)).toEqual(['Free']);

    // The consumer's remedy: point the value at the new object.
    fixture.componentInstance.value.set(fixture.componentInstance.tiers()[1]);
    await settle(fixture);
    expect(checkedStates(fixture)).toEqual(['false/false', 'true/true']);
    expect(radioTabStops(fixture)).toEqual(['Pro']);
  });
});

// ---------------------------------------------------------------------------
// A group with no radio
//
// The key manager exists only while the group has radios. Before, a group that
// started empty had none behind a non-null assertion, so an arrow key reaching
// its host threw; and a group whose radios were all removed kept a manager
// over the detached radios, so a later arrow key selected one's value.
// ---------------------------------------------------------------------------

function dispatchGroupArrowDown(fixture: ComponentFixture<unknown>): Event {
  const event = new KeyboardEvent('keydown', {
    key: 'ArrowDown',
    bubbles: true,
    cancelable: true,
  });
  getGroupEl(fixture).dispatchEvent(event);
  return event;
}

describe('MlvRadioGroup with no radio', () => {
  it('ignores an arrow key while no radio has rendered yet', async () => {
    await TestBed.configureTestingModule({
      imports: [ChannelsRadioHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(ChannelsRadioHost);
    fixture.componentInstance.plans.set([]);
    fixture.detectChanges();
    await fixture.whenStable();

    // jsdom reports a listener's exception instead of rethrowing it from
    // dispatchEvent, so `defaultPrevented` is what goes red without the guard.
    const event = dispatchGroupArrowDown(fixture);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(event.defaultPrevented).toBe(false);
    expect(fixture.componentInstance.value()).toBeUndefined();
  });

  it('does not select a removed radio when an arrow key arrives after every radio is gone', async () => {
    const fixture = await createFixture(ChannelsRadioHost);
    expect(getRadios(fixture)).toHaveLength(3);

    fixture.componentInstance.plans.set([]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(getRadios(fixture)).toHaveLength(0);

    const event = dispatchGroupArrowDown(fixture);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(event.defaultPrevented).toBe(false);
    expect(fixture.componentInstance.value()).toBeUndefined();
  });
});
