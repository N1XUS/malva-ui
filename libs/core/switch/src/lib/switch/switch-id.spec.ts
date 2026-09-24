import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { form, FormField, required } from '@angular/forms/signals';
import { MlvFormField, MlvLabel } from '@malva-ui/core/form-utils';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations, runAxe } from '@malva-ui/internal-testing/axe';
import { MlvSwitch } from './switch';

@Component({
  imports: [MlvSwitch],
  template: `
    <mlv-switch
      id="wifi"
      description="Required to continue"
      message="Please turn it on"
      >Enable Wi-Fi</mlv-switch
    >
  `,
})
class StaticIdHost {}

@Component({
  imports: [MlvSwitch],
  template: `
    <mlv-switch
      [id]="id()"
      description="Required to continue"
      message="Please turn it on"
      >Enable Wi-Fi</mlv-switch
    >
  `,
})
class BoundIdHost {
  readonly id = signal('wifi-a');
}

@Component({
  imports: [MlvSwitch],
  template: `
    @for (row of rows; track row) {
      <mlv-switch [id]="'row-' + row">Row {{ row }}</mlv-switch>
    }
  `,
})
class ForIdHost {
  readonly rows = [1, 2, 3];
}

@Component({
  imports: [MlvSwitch],
  template: `<mlv-switch>No id</mlv-switch>`,
})
class NoIdHost {}

@Component({
  imports: [MlvSwitch],
  template: `
    <mlv-switch id="remember" [(checked)]="first">Remember me</mlv-switch>
    <mlv-switch id="remember" [(checked)]="second">Remember me too</mlv-switch>
  `,
})
class DuplicateIdHost {
  readonly first = signal(false);
  readonly second = signal(false);
}

@Component({
  imports: [MlvSwitch],
  template: `
    <section id="clash">Earlier element</section>
    <mlv-switch id="clash" [(checked)]="checked">Clashing id</mlv-switch>
  `,
})
class ClashIdHost {
  readonly checked = signal(false);
}

@Component({
  imports: [MlvSwitch, MlvFormField, MlvLabel, FormField],
  template: `
    <mlv-form-field>
      <mlv-label for="wifi">Enable Wi-Fi</mlv-label>
      <mlv-switch id="wifi" [formField]="wifiForm.wifi" />
    </mlv-form-field>
  `,
})
class FieldIdHost {
  readonly model = signal({ wifi: false });
  readonly wifiForm = form(this.model, (path) => {
    required(path.wifi);
  });
}

/**
 * #323 (FC-07): `inputId` was a field initializer — `readonly inputId =
 * this.id()` — so it read the `id` input before Angular set it and always held
 * the generated `mlv-control-N` default. A consumer `id` never reached the
 * native input: a static `id="wifi"` stayed on the non-focusable host (so
 * `getElementById`, an external `<label for>` and `aria-controls` targeted the
 * host) and a bound `[id]` landed nowhere at all.
 */
describe('MlvSwitch — consumer id (#323)', () => {
  async function render<T>(host: new () => T): Promise<ComponentFixture<T>> {
    await TestBed.configureTestingModule({
      imports: [host],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(host);
    await settle(fixture);
    return fixture;
  }

  async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function root(fixture: ComponentFixture<unknown>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function native(fixture: ComponentFixture<unknown>): HTMLInputElement {
    return root(fixture).querySelector(
      '.mlv-switch__native',
    ) as HTMLInputElement;
  }

  function host(fixture: ComponentFixture<unknown>): HTMLElement {
    return root(fixture).querySelector('mlv-switch') as HTMLElement;
  }

  function ownLabel(fixture: ComponentFixture<unknown>): HTMLLabelElement {
    return root(fixture).querySelector(
      '.mlv-switch__label',
    ) as HTMLLabelElement;
  }

  /** Every id in the fixture that more than one element carries. */
  function duplicateIds(fixture: ComponentFixture<unknown>): string[] {
    const seen = new Map<string, number>();
    for (const element of Array.from(root(fixture).querySelectorAll('[id]'))) {
      seen.set(element.id, (seen.get(element.id) ?? 0) + 1);
    }
    return [...seen].filter(([, count]) => count > 1).map(([id]) => id);
  }

  /**
   * `duplicate-id-aria` is a `reviewOnFail` rule, so axe reports a duplicate
   * id referenced by `for` / `aria-describedby` as **incomplete**, never as a
   * violation — `expectNoAxeViolations()` alone cannot see one.
   */
  async function axeDuplicateIds(
    fixture: ComponentFixture<unknown>,
  ): Promise<string> {
    const results = await runAxe(root(fixture));
    return results.incomplete
      .filter((result) => result.id.startsWith('duplicate-id'))
      .map((result) =>
        result.nodes.map((node) => node.target.join(' ')).join(', '),
      )
      .join('; ');
  }

  it('puts a static id on the native input, not on the host', async () => {
    const fixture = await render(StaticIdHost);

    expect(native(fixture).id).toBe('wifi');
    // The own label wraps the input and names it by containment; it carries
    // no `for`, which would hand the association to whatever element the
    // consumer's id resolves to first (#323 review).
    expect(ownLabel(fixture).hasAttribute('for')).toBe(false);
    expect(ownLabel(fixture).control).toBe(native(fixture));
    // The host is role-less and not focusable; the id moves off it, so the
    // consumer's id names exactly one element — the control.
    expect(host(fixture).hasAttribute('id')).toBe(false);
    expect(document.getElementById('wifi')).toBe(native(fixture));
    expect(duplicateIds(fixture)).toEqual([]);
  });

  it('derives the description and message ids from the consumer id', async () => {
    const fixture = await render(StaticIdHost);

    const description = root(fixture).querySelector(
      'mlv-description',
    ) as HTMLElement;
    const message = root(fixture).querySelector('mlv-message') as HTMLElement;
    expect(description.id).toBe('wifi-description');
    expect(message.id).toBe('wifi-message');
    expect(native(fixture).getAttribute('aria-describedby')).toBe(
      'wifi-description wifi-message',
    );
  });

  it('puts a bound id on the native input and follows it when it changes', async () => {
    const fixture = await render(BoundIdHost);

    expect(native(fixture).id).toBe('wifi-a');
    expect(ownLabel(fixture).control).toBe(native(fixture));
    expect(native(fixture).getAttribute('aria-describedby')).toBe(
      'wifi-a-description wifi-a-message',
    );

    fixture.componentInstance.id.set('wifi-b');
    await settle(fixture);

    expect(native(fixture).id).toBe('wifi-b');
    expect(ownLabel(fixture).control).toBe(native(fixture));
    expect(
      (root(fixture).querySelector('mlv-description') as HTMLElement).id,
    ).toBe('wifi-b-description');
    expect((root(fixture).querySelector('mlv-message') as HTMLElement).id).toBe(
      'wifi-b-message',
    );
    expect(native(fixture).getAttribute('aria-describedby')).toBe(
      'wifi-b-description wifi-b-message',
    );
    // A property binding feeds the input only; the host never carries it.
    expect(host(fixture).hasAttribute('id')).toBe(false);
    expect(duplicateIds(fixture)).toEqual([]);
  });

  it('keeps inputId in step with id', async () => {
    const fixture = await render(BoundIdHost);
    const toggle = fixture.debugElement.children[0]
      .componentInstance as MlvSwitch;
    expect(toggle.inputId).toBe('wifi-a');

    fixture.componentInstance.id.set('wifi-b');
    await settle(fixture);
    expect(toggle.inputId).toBe('wifi-b');
  });

  it('gives each switch in an @for its own bound id', async () => {
    const fixture = await render(ForIdHost);
    const ids = Array.from(
      root(fixture).querySelectorAll<HTMLInputElement>('.mlv-switch__native'),
      (input) => input.id,
    );
    expect(ids).toEqual(['row-1', 'row-2', 'row-3']);
  });

  it('still generates an id when the consumer sets none', async () => {
    const fixture = await render(NoIdHost);
    expect(native(fixture).id).toMatch(/^mlv-control-\d+$/);
    expect(ownLabel(fixture).control).toBe(native(fixture));
    expect(host(fixture).hasAttribute('id')).toBe(false);
  });

  it('lets an external <mlv-label for> name the native input inside a form field', async () => {
    const fixture = await render(FieldIdHost);

    const fieldLabel = root(fixture).querySelector(
      'mlv-label > label',
    ) as HTMLLabelElement;
    expect(fieldLabel.getAttribute('for')).toBe('wifi');
    // The association the field's own "names nothing" warning recommends
    // for a control that reports no label target (#197): before, `for`
    // pointed at the `mlv-switch` host, which `<label for>` cannot name.
    expect(fieldLabel.control).toBe(native(fixture));

    native(fixture).dispatchEvent(new FocusEvent('blur'));
    await settle(fixture);
    const fieldMessage = root(fixture).querySelector(
      '.mlv-form-field > mlv-message',
    ) as HTMLElement;
    expect(fieldMessage.id).not.toBe('');
    expect(native(fixture).getAttribute('aria-describedby')).toBe(
      fieldMessage.id,
    );
    expect(native(fixture).id).toBe('wifi');
  });

  it('does not warn about a missing name when an external label names it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await render(FieldIdHost);
      const messages = warn.mock.calls.map((call) => String(call[0]));
      expect(messages.filter((text) => text.includes('[mlv-switch]'))).toEqual(
        [],
      );
    } finally {
      warn.mockRestore();
    }
  });

  it('keeps each own label on its own input when two switches share an id', async () => {
    const fixture = await render(DuplicateIdHost);
    const inputs = Array.from(
      root(fixture).querySelectorAll<HTMLInputElement>('.mlv-switch__native'),
    );
    const labels = Array.from(
      root(fixture).querySelectorAll<HTMLLabelElement>('.mlv-switch__label'),
    );

    // Duplicate ids are the consumer's defect, but they must not cross-wire
    // the controls: a `for` on the own label would resolve to the first
    // `id="remember"` and leave the second input nameless.
    expect(inputs.map((input) => input.labels?.length ?? 0)).toEqual([1, 1]);
    expect(
      labels.map((label, index) => label.control === inputs[index]),
    ).toEqual([true, true]);

    (labels[1].querySelector('.mlv-switch__content') as HTMLElement).click();
    await settle(fixture);
    expect([
      fixture.componentInstance.first(),
      fixture.componentInstance.second(),
    ]).toEqual([false, true]);
  });

  it('keeps its own label when an earlier element already carries the id', async () => {
    const fixture = await render(ClashIdHost);

    expect(native(fixture).labels?.length ?? 0).toBe(1);
    expect(ownLabel(fixture).control).toBe(native(fixture));

    (
      ownLabel(fixture).querySelector('.mlv-switch__content') as HTMLElement
    ).click();
    await settle(fixture);
    expect(fixture.componentInstance.checked()).toBe(true);
  });

  it.each([
    ['a static id', StaticIdHost],
    ['a bound id', BoundIdHost],
    ['an id inside a form field', FieldIdHost],
  ] as const)(
    'has no axe violations and no duplicate ids with %s',
    async (_label, hostType) => {
      const fixture = await render(hostType as new () => unknown);
      await expectNoAxeViolations(root(fixture));
      expect(await axeDuplicateIds(fixture)).toBe('');
    },
  );
});
